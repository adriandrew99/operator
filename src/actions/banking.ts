'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  getInstitutions,
  createRequisition,
  getRequisition,
  getTransactions,
  getBalances,
  getAccountDetails,
  deleteRequisition,
  type GCInstitution,
  type GCBalance,
} from '@/lib/gocardless';
import { suggestCategory } from '@/lib/bank-categories';
import type { BankConnection, BankTransaction } from '@/lib/types/database';

// ━━━ Bank Discovery ━━━

export async function getAvailableBanks(): Promise<GCInstitution[]> {
  return getInstitutions('GB');
}

// ━━━ Connection Management ━━━

export async function connectBank(institutionId: string, institutionName: string, institutionLogo: string | null): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUrl = `${appUrl}/api/banking/callback`;

  const requisition = await createRequisition(institutionId, redirectUrl, `user-${user.id}-${Date.now()}`);

  // Store pending connection
  await supabase.from('bank_connections').insert({
    user_id: user.id,
    institution_id: institutionId,
    institution_name: institutionName,
    institution_logo: institutionLogo,
    requisition_id: requisition.id,
    account_id: '', // populated after callback
    status: 'pending',
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return requisition.link;
}

export async function handleBankCallback(requisitionId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch requisition to get account IDs
  const requisition = await getRequisition(requisitionId);

  if (!requisition.accounts || requisition.accounts.length === 0) {
    // Auth failed or user cancelled
    await supabase
      .from('bank_connections')
      .update({ status: 'error', updated_at: new Date().toISOString() })
      .eq('requisition_id', requisitionId)
      .eq('user_id', user.id);
    return;
  }

  // For each account linked, create/update a connection
  for (const accountId of requisition.accounts) {
    let accountName: string | null = null;
    try {
      const details = await getAccountDetails(accountId);
      accountName = details.name || details.product || null;
    } catch {
      // Some banks don't support details endpoint
    }

    // Update the pending connection or insert new one per account
    const { data: existing } = await supabase
      .from('bank_connections')
      .select('id')
      .eq('requisition_id', requisitionId)
      .eq('user_id', user.id)
      .eq('account_id', '')
      .limit(1)
      .single();

    if (existing) {
      await supabase
        .from('bank_connections')
        .update({
          account_id: accountId,
          account_name: accountName,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Multiple accounts from same requisition — get the first pending record's institution info
      const { data: pending } = await supabase
        .from('bank_connections')
        .select('*')
        .eq('requisition_id', requisitionId)
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (pending) {
        await supabase.from('bank_connections').insert({
          user_id: user.id,
          institution_id: pending.institution_id,
          institution_name: pending.institution_name,
          institution_logo: pending.institution_logo,
          requisition_id: requisitionId,
          account_id: accountId,
          account_name: accountName,
          status: 'active',
          expires_at: pending.expires_at,
        });
      }
    }

    // Trigger initial sync for this account
    const { data: conn } = await supabase
      .from('bank_connections')
      .select('id')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .single();

    if (conn) {
      await syncBankTransactionsInternal(supabase, user.id, conn.id, accountId);
    }
  }

  revalidatePath('/finance');
}

// ━━━ Transaction Sync ━━━

async function syncBankTransactionsInternal(
  supabase: any,
  userId: string,
  connectionId: string,
  accountId: string,
  dateFrom?: string,
): Promise<number> {
  // Default: sync last 30 days if no dateFrom specified
  const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { booked } = await getTransactions(accountId, from);
  let imported = 0;

  for (const tx of booked) {
    const description = tx.remittanceInformationUnstructured
      || tx.remittanceInformationUnstructuredArray?.join(' ')
      || tx.additionalInformation
      || tx.creditorName
      || tx.debtorName
      || 'Unknown transaction';

    const amount = parseFloat(tx.transactionAmount.amount);
    const merchantName = tx.creditorName || tx.debtorName || null;
    const category = suggestCategory(description);

    const { error } = await supabase
      .from('bank_transactions')
      .upsert({
        user_id: userId,
        connection_id: connectionId,
        external_id: tx.transactionId,
        date: tx.bookingDate,
        description,
        amount,
        currency: tx.transactionAmount.currency || 'GBP',
        category,
        merchant_name: merchantName,
        raw_data: tx,
      }, {
        onConflict: 'user_id,connection_id,external_id',
      });

    if (!error) imported++;
  }

  // Update last synced timestamp
  await supabase
    .from('bank_connections')
    .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', connectionId);

  return imported;
}

export async function syncBankTransactions(connectionId: string): Promise<{ imported: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: conn } = await supabase
    .from('bank_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .single();

  if (!conn) throw new Error('Connection not found');
  if (conn.status === 'expired') throw new Error('Bank connection expired. Please re-connect.');

  const imported = await syncBankTransactionsInternal(supabase, user.id, conn.id, conn.account_id);
  revalidatePath('/finance');
  return { imported };
}

export async function syncAllConnections(): Promise<{ total: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: connections } = await supabase
    .from('bank_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active');

  let total = 0;
  for (const conn of connections || []) {
    try {
      const count = await syncBankTransactionsInternal(supabase, user.id, conn.id, conn.account_id);
      total += count;
    } catch (err) {
      console.error(`Sync failed for connection ${conn.id}:`, err);
      // Check if it's an access expired error
      const errMsg = String(err);
      if (errMsg.includes('expired') || errMsg.includes('EUA')) {
        await supabase
          .from('bank_connections')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', conn.id);
      }
    }
  }

  revalidatePath('/finance');
  return { total };
}

// ━━━ Data Fetching ━━━

export async function getBankConnections(): Promise<BankConnection[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('bank_connections')
    .select('*')
    .eq('user_id', user.id)
    .neq('status', 'pending')
    .order('created_at', { ascending: false });

  return (data || []) as BankConnection[];
}

export async function getBankTransactions(
  connectionId?: string,
  dateFrom?: string,
  dateTo?: string,
  limit: number = 200,
): Promise<BankTransaction[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('bank_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(limit);

  if (connectionId) query = query.eq('connection_id', connectionId);
  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);

  const { data } = await query;
  return (data || []) as BankTransaction[];
}

export async function getConnectionBalances(connectionId: string): Promise<GCBalance[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: conn } = await supabase
    .from('bank_connections')
    .select('account_id')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .single();

  if (!conn) throw new Error('Connection not found');
  return getBalances(conn.account_id);
}

// ━━━ Disconnect ━━━

export async function disconnectBank(connectionId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: conn } = await supabase
    .from('bank_connections')
    .select('requisition_id')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .single();

  if (conn) {
    // Try to revoke access at GoCardless (non-critical if it fails)
    try { await deleteRequisition(conn.requisition_id); } catch { /* ignore */ }
  }

  // Delete transactions first (FK), then connection
  await supabase.from('bank_transactions').delete().eq('connection_id', connectionId);
  await supabase.from('bank_connections').delete().eq('id', connectionId).eq('user_id', user.id);

  revalidatePath('/finance');
}

// ━━━ Recurring Payment Detection ━━━

export async function detectRecurringPayments(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // Fetch last 90 days of transactions
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: transactions } = await supabase
    .from('bank_transactions')
    .select('id, description, amount, merchant_name, date')
    .eq('user_id', user.id)
    .gte('date', ninetyDaysAgo)
    .order('date', { ascending: true });

  if (!transactions || transactions.length === 0) return 0;

  // Group by normalised description + similar amount
  const groups: Record<string, typeof transactions> = {};
  for (const tx of transactions) {
    const key = normaliseForGrouping(tx.merchant_name || tx.description);
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }

  let marked = 0;
  for (const [groupKey, txs] of Object.entries(groups)) {
    // Need at least 2 occurrences with similar amounts to be "recurring"
    if (txs.length < 2) continue;

    // Check if amounts are similar (within 10% of median)
    const amounts = txs.map(t => Math.abs(Number(t.amount)));
    const median = amounts.sort((a, b) => a - b)[Math.floor(amounts.length / 2)];
    const similar = amounts.filter(a => Math.abs(a - median) / (median || 1) < 0.1);
    if (similar.length < 2) continue;

    // Mark as recurring
    const ids = txs.map(t => t.id);
    await supabase
      .from('bank_transactions')
      .update({ is_recurring: true, recurring_group: groupKey })
      .in('id', ids);

    marked += ids.length;
  }

  revalidatePath('/finance');
  return marked;
}

function normaliseForGrouping(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3) // Use first 3 words as key
    .join(' ');
}
