import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getTransactions } from '@/lib/gocardless';
import { suggestCategory } from '@/lib/bank-categories';

export const dynamic = 'force-dynamic';

/**
 * GET /api/banking/sync
 *
 * Cron-triggered route that syncs all active bank connections.
 * Runs every 6 hours to stay within GoCardless free-tier rate limits.
 *
 * Headers:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 });
  }

  // Check GoCardless is configured
  if (!process.env.GOCARDLESS_SECRET_ID || !process.env.GOCARDLESS_SECRET_KEY) {
    return NextResponse.json({ error: 'GoCardless not configured' }, { status: 500 });
  }

  const supabase = createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });

  // Fetch all active connections across all users
  const { data: connections, error: connErr } = await supabase
    .from('bank_connections')
    .select('*')
    .eq('status', 'active');

  if (connErr || !connections) {
    return NextResponse.json({ error: 'Failed to fetch connections', detail: connErr?.message }, { status: 500 });
  }

  // Check for expired connections
  const now = new Date();
  const results: { connectionId: string; userId: string; imported?: number; error?: string }[] = [];

  for (const conn of connections) {
    // Check if connection has expired
    if (conn.expires_at && new Date(conn.expires_at) < now) {
      await supabase
        .from('bank_connections')
        .update({ status: 'expired', updated_at: now.toISOString() })
        .eq('id', conn.id);
      results.push({ connectionId: conn.id, userId: conn.user_id, error: 'expired' });
      continue;
    }

    try {
      // Sync last 7 days of transactions
      const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { booked } = await getTransactions(conn.account_id, dateFrom);

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
            user_id: conn.user_id,
            connection_id: conn.id,
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

      // Update last synced
      await supabase
        .from('bank_connections')
        .update({ last_synced_at: now.toISOString(), updated_at: now.toISOString() })
        .eq('id', conn.id);

      results.push({ connectionId: conn.id, userId: conn.user_id, imported });
    } catch (err) {
      const errMsg = String(err);
      console.error(`Sync failed for ${conn.id}:`, errMsg);

      // Mark as expired if GoCardless says so
      if (errMsg.includes('expired') || errMsg.includes('EUA') || errMsg.includes('401')) {
        await supabase
          .from('bank_connections')
          .update({ status: 'expired', updated_at: now.toISOString() })
          .eq('id', conn.id);
      }

      results.push({ connectionId: conn.id, userId: conn.user_id, error: errMsg.slice(0, 200) });
    }
  }

  return NextResponse.json({
    synced: results.filter(r => !r.error).length,
    failed: results.filter(r => r.error).length,
    results,
  });
}
