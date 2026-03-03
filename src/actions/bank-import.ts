'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { CATEGORY_KEYWORDS, suggestCategory } from '@/lib/bank-categories';

export interface ParsedTransaction {
  date: string;          // YYYY-MM-DD (uses 1st of month for P/L entries)
  description: string;
  amount: number;        // Always positive
  type: 'income' | 'expense';
  suggestedCategory?: string;
}

/* ━━━ CSV LINE PARSER ━━━ */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/* ━━━ DATE PARSER ━━━ */
const MONTH_NAMES: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseDate(str: string): string {
  const s = str.trim().replace(/"/g, '');
  if (!s) return '';

  // ISO: YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // ISO datetime: YYYY-MM-DDTHH:MM:SS
  const isoDatetime = s.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (isoDatetime) return `${isoDatetime[1]}-${isoDatetime[2]}-${isoDatetime[3]}`;

  // UK: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const ukMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (ukMatch) return `${ukMatch[3]}-${ukMatch[2].padStart(2, '0')}-${ukMatch[1].padStart(2, '0')}`;

  // UK short: DD/MM/YY
  const ukShort = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
  if (ukShort) {
    const yr = Number(ukShort[3]);
    const fullYear = yr >= 70 ? 1900 + yr : 2000 + yr;
    return `${fullYear}-${ukShort[2].padStart(2, '0')}-${ukShort[1].padStart(2, '0')}`;
  }

  // Named: DD Mon YYYY or D Mon YYYY
  const namedMatch = s.match(/^(\d{1,2})\s+(\w{3,})\s+(\d{4})$/i);
  if (namedMatch) {
    const m = MONTH_NAMES[namedMatch[2].toLowerCase().slice(0, 3)];
    if (m) return `${namedMatch[3]}-${m}-${namedMatch[1].padStart(2, '0')}`;
  }

  // Try JS Date parse as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return '';
}

/* ━━━ AMOUNT PARSER ━━━ */
function parseAmount(str: string): number {
  if (!str || str.trim() === '' || str.trim() === '-') return 0;
  // Remove currency symbols, commas, spaces, quotes
  const cleaned = str.replace(/[£$€"\s]/g, '').replace(/,/g, '');
  // Handle parentheses as negative
  const withNeg = cleaned.replace(/^\((.+)\)$/, '-$1');
  const num = Number(withNeg);
  return isNaN(num) ? 0 : num;
}


/* ═══════════════════════════════════════════════════════════════
   P/L REPORT DETECTION & PARSING
   Tide P/L exports have date-range column headers like:
   "Account number","Account description","6 Apr - 5 May 25",...,"YTD"
   ═══════════════════════════════════════════════════════════════ */

/**
 * Parse a Tide P/L date range header → YYYY-MM-01 using the START date's month.
 * Tide tax-month periods: "6 Apr - 5 May 25" = April, "6 Dec 25 - 5 Jan 26" = December.
 * The year often only appears on the end side, so we infer the start year from context.
 */
function parsePLColumnDate(header: string): string | null {
  const h = header.trim();

  // Match: "D Mon [YY] - D Mon YY"
  // Capture: startMonth, startYear (optional), endMonth, endYear
  const rangeMatch = h.match(
    /\d{1,2}\s+(\w{3})(?:\s+(\d{2,4}))?\s*-\s*\d{1,2}\s+(\w{3})\s+(\d{2,4})$/i
  );
  if (!rangeMatch) return null;

  const startMonthStr = rangeMatch[1].toLowerCase().slice(0, 3);
  const startYearRaw = rangeMatch[2]; // may be undefined
  const endMonthStr = rangeMatch[3].toLowerCase().slice(0, 3);
  const endYearRaw = rangeMatch[4];

  const startMonth = MONTH_NAMES[startMonthStr];
  const endMonth = MONTH_NAMES[endMonthStr];
  if (!startMonth || !endMonth) return null;

  let endYear = Number(endYearRaw);
  if (endYear < 100) endYear += 2000;

  let startYear: number;
  if (startYearRaw) {
    startYear = Number(startYearRaw);
    if (startYear < 100) startYear += 2000;
  } else {
    // No year on the start side — infer from end year
    // If start month is numerically after end month (e.g. Dec → Jan), start is previous year
    startYear = Number(startMonth) > Number(endMonth) ? endYear - 1 : endYear;
  }

  return `${startYear}-${startMonth}-01`;
}

function isPLReport(headers: string[]): boolean {
  // P/L reports have "Account number" or "Account description" in first columns
  // and date ranges like "6 Apr - 5 May 25" in subsequent columns
  const h = headers.map(s => s.toLowerCase().trim());
  const hasAccountCol = h.some(c => c.includes('account'));
  const hasDateRanges = headers.slice(2).some(col => parsePLColumnDate(col) !== null);
  return hasAccountCol && hasDateRanges;
}

/**
 * Parse a Tide P/L report using a summary-row strategy:
 *
 * 1. "Gross Profit/(Loss)" row → income per month (= Sales − Direct Expenses)
 *    This matches what the user sees in Tide as their core revenue.
 * 2. Individual OVERHEAD line items (rows with account numbers under "Overheads")
 *    → expenses, preserving descriptions + categories.
 * 3. Individual TAXATION line items (rows with account numbers under "Taxation")
 *    → expenses.
 * 4. "Other Income" line items (account 4900 etc.) → separate income entries
 *    so the user can toggle them in the review step.
 *
 * This avoids all double-counting issues and produces numbers that match
 * Tide's own P/L summary exactly.
 */
function parsePLReport(lines: string[]): ParsedTransaction[] {
  const headerFields = parseCSVLine(lines[0]);
  const transactions: ParsedTransaction[] = [];

  // Map column indices to YYYY-MM-01 dates
  const columnDates: (string | null)[] = headerFields.map(h => parsePLColumnDate(h));

  // Track which section we're in
  let currentSection: 'sales' | 'direct_expenses' | 'other_income' | 'overheads' | 'taxation' | 'unknown' = 'unknown';

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    if (fields.length < 3) continue;

    const accountNum = fields[0]?.trim() || '';
    const description = fields[1]?.trim() || '';
    if (!description) continue;

    const lower = description.toLowerCase().trim();

    // ── SUMMARY ROWS (no account number) ──
    if (!accountNum) {
      // Use "Gross Profit/(Loss)" as the core income figure
      // Skip the "Gross Profit/(Loss) %" row — those are percentages, not amounts
      if (lower.startsWith('gross profit') && !lower.includes('%')) {
        for (let col = 2; col < fields.length; col++) {
          const monthDate = columnDates[col];
          if (!monthDate) continue;
          const amount = parseAmount(fields[col] || '');
          if (amount === 0) continue;

          // Gross profit can be negative (loss month) — treat negative as expense
          if (amount > 0) {
            transactions.push({
              date: monthDate,
              description: 'Revenue (Gross Profit)',
              amount,
              type: 'income',
            });
          } else {
            transactions.push({
              date: monthDate,
              description: 'Net Loss (Direct Expenses > Sales)',
              amount: Math.abs(amount),
              type: 'expense',
              suggestedCategory: 'other',
            });
          }
        }
        continue;
      }

      // Update section context from section headers
      if (lower === 'sales' || lower === 'income') {
        currentSection = 'sales';
      } else if (lower.includes('direct expense')) {
        currentSection = 'direct_expenses';
      } else if (lower === 'other income') {
        currentSection = 'other_income';
      } else if (lower === 'overheads' || lower === 'overhead') {
        currentSection = 'overheads';
      } else if (lower === 'taxation' || lower === 'tax') {
        currentSection = 'taxation';
      }
      // Skip all other summary/total rows (Total Income, Total Overheads, Net Profit, etc.)
      continue;
    }

    // ── LINE ITEMS (with account number) ──
    // Skip Sales and Direct Expenses line items — already captured via Gross Profit
    if (currentSection === 'sales' || currentSection === 'direct_expenses') {
      continue;
    }

    // Other Income line items → income (user can toggle off in review)
    if (currentSection === 'other_income') {
      for (let col = 2; col < fields.length; col++) {
        const monthDate = columnDates[col];
        if (!monthDate) continue;
        const amount = parseAmount(fields[col] || '');
        if (amount === 0) continue;

        transactions.push({
          date: monthDate,
          description: `[${accountNum}] ${description}`,
          amount: Math.abs(amount),
          type: amount > 0 ? 'income' : 'expense',
          suggestedCategory: amount < 0 ? 'other' : undefined,
        });
      }
      continue;
    }

    // Overheads + Taxation line items → expenses
    if (currentSection === 'overheads' || currentSection === 'taxation') {
      for (let col = 2; col < fields.length; col++) {
        const monthDate = columnDates[col];
        if (!monthDate) continue;
        const amount = parseAmount(fields[col] || '');
        if (amount === 0) continue;

        // Negative overhead/tax = refund — skip (too small to matter, clutters review)
        if (amount < 0) continue;

        const category = suggestCategory(description);

        transactions.push({
          date: monthDate,
          description: `[${accountNum}] ${description}`,
          amount,
          type: 'expense',
          suggestedCategory: category || 'other',
        });
      }
      continue;
    }

    // Unknown section with account number — default to expense
    for (let col = 2; col < fields.length; col++) {
      const monthDate = columnDates[col];
      if (!monthDate) continue;
      const amount = parseAmount(fields[col] || '');
      if (amount === 0) continue;

      transactions.push({
        date: monthDate,
        description: `[${accountNum}] ${description}`,
        amount: Math.abs(amount),
        type: amount > 0 ? 'expense' : 'income',
        suggestedCategory: amount > 0 ? suggestCategory(description) : undefined,
      });
    }
  }

  return transactions;
}


/* ═══════════════════════════════════════════════════════════════
   TRANSACTION CSV DETECTION & PARSING
   Standard bank exports: Date, Description, Amount per row
   ═══════════════════════════════════════════════════════════════ */

interface ColumnMapping {
  dateCol: number;
  descriptionCol: number;
  amountCol: number | null;
  paidInCol: number | null;
  paidOutCol: number | null;
  categoryCol: number | null;
  format: string;
}

function detectColumns(headers: string[]): ColumnMapping | null {
  const h = headers.map(s => s.toLowerCase().trim());

  // Tide Variant B: Date, Timestamp, Paid in, Paid out, Transaction description
  if (h.includes('paid in') && h.includes('paid out') && h.includes('transaction description')) {
    return {
      dateCol: h.indexOf('date') >= 0 ? h.indexOf('date') : 0,
      descriptionCol: h.indexOf('transaction description'),
      amountCol: null,
      paidInCol: h.indexOf('paid in'),
      paidOutCol: h.indexOf('paid out'),
      categoryCol: null,
      format: 'tide-b',
    };
  }

  // Tide Variant C / full: look for "transaction id", "category name", "amount"
  if (h.includes('transaction id') || h.includes('transactionid')) {
    const descCol = h.findIndex(c => c === 'description' || c === 'narrative' || c === 'details');
    const amtCol = h.indexOf('amount');
    const catCol = h.findIndex(c => c.includes('category'));
    return {
      dateCol: h.findIndex(c => c === 'date' || c === 'timestamp' || c === 'transaction date'),
      descriptionCol: descCol >= 0 ? descCol : 3,
      amountCol: amtCol >= 0 ? amtCol : null,
      paidInCol: h.findIndex(c => c === 'paid in' || c === 'credit'),
      paidOutCol: h.findIndex(c => c === 'paid out' || c === 'debit'),
      categoryCol: catCol >= 0 ? catCol : null,
      format: 'tide-c',
    };
  }

  // Tide Variant A: Date, Reference, Amount, Cleared balance
  if (h.includes('reference') && h.includes('cleared balance')) {
    return {
      dateCol: h.indexOf('date') >= 0 ? h.indexOf('date') : 0,
      descriptionCol: h.indexOf('reference'),
      amountCol: h.indexOf('amount'),
      paidInCol: null,
      paidOutCol: null,
      categoryCol: null,
      format: 'tide-a',
    };
  }

  // Generic: Paid in / Paid out
  if (h.some(c => c.includes('paid in')) && h.some(c => c.includes('paid out'))) {
    return {
      dateCol: h.findIndex(c => c.includes('date')),
      descriptionCol: h.findIndex(c => c.includes('description') || c.includes('reference') || c.includes('narrative') || c.includes('details') || c.includes('type')),
      amountCol: null,
      paidInCol: h.findIndex(c => c.includes('paid in')),
      paidOutCol: h.findIndex(c => c.includes('paid out')),
      categoryCol: h.findIndex(c => c.includes('category')),
      format: 'paid-in-out',
    };
  }

  // Generic: Debit / Credit
  if (h.some(c => c.includes('debit')) && h.some(c => c.includes('credit'))) {
    return {
      dateCol: h.findIndex(c => c.includes('date')),
      descriptionCol: h.findIndex(c => c.includes('description') || c.includes('reference') || c.includes('narrative') || c.includes('details')),
      amountCol: null,
      paidInCol: h.findIndex(c => c.includes('credit')),
      paidOutCol: h.findIndex(c => c.includes('debit')),
      categoryCol: h.findIndex(c => c.includes('category')),
      format: 'debit-credit',
    };
  }

  // Generic: look for Date + Description + Amount
  const dateIdx = h.findIndex(c => c.includes('date'));
  const descIdx = h.findIndex(c => c.includes('description') || c.includes('reference') || c.includes('narrative') || c.includes('details') || c.includes('memo') || c.includes('payee'));
  const amtIdx = h.findIndex(c => c.includes('amount') || c.includes('value') || c.includes('sum'));

  if (dateIdx >= 0 && amtIdx >= 0) {
    return {
      dateCol: dateIdx,
      descriptionCol: descIdx >= 0 ? descIdx : (dateIdx === 0 ? 1 : 0),
      amountCol: amtIdx,
      paidInCol: null,
      paidOutCol: null,
      categoryCol: h.findIndex(c => c.includes('category')),
      format: 'generic-amount',
    };
  }

  return null;
}

function parseTransactionCSV(lines: string[], mapping: ColumnMapping): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = parseCSVLine(line);
    if (fields.length < 3) continue;

    const date = parseDate(fields[mapping.dateCol] || '');
    if (!date) continue;

    let description = (fields[mapping.descriptionCol] || '').trim();
    if (!description) {
      description = fields.filter((_, idx) =>
        idx !== mapping.dateCol && idx !== mapping.amountCol &&
        idx !== mapping.paidInCol && idx !== mapping.paidOutCol
      ).slice(0, 2).join(' ').trim();
    }
    if (!description) continue;

    let amount: number;
    let type: 'income' | 'expense';

    if (mapping.amountCol !== null) {
      const raw = parseAmount(fields[mapping.amountCol] || '');
      if (raw === 0) continue;
      amount = Math.abs(raw);
      type = raw > 0 ? 'income' : 'expense';
    } else if (mapping.paidInCol !== null && mapping.paidOutCol !== null) {
      const paidIn = parseAmount(fields[mapping.paidInCol] || '');
      const paidOut = parseAmount(fields[mapping.paidOutCol] || '');
      if (paidIn === 0 && paidOut === 0) continue;
      if (paidIn > 0) {
        amount = paidIn;
        type = 'income';
      } else {
        amount = Math.abs(paidOut);
        type = 'expense';
      }
    } else {
      continue;
    }

    let category: string | undefined;
    if (mapping.categoryCol !== null && mapping.categoryCol >= 0 && fields[mapping.categoryCol]) {
      category = fields[mapping.categoryCol].trim().toLowerCase().replace(/\s+/g, '_') || undefined;
    }
    if (!category && type === 'expense') {
      category = suggestCategory(description);
    }

    transactions.push({
      date,
      description: description.replace(/\s+/g, ' ').trim(),
      amount,
      type,
      suggestedCategory: category,
    });
  }

  return transactions;
}

function parseFallbackCSV(lines: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = parseCSVLine(line);
    if (fields.length < 3) continue;

    const date = parseDate(fields[0]);
    if (!date) continue;

    let amountIdx = -1;
    for (let j = fields.length - 1; j >= 1; j--) {
      if (parseAmount(fields[j]) !== 0) { amountIdx = j; break; }
    }
    if (amountIdx < 0) continue;

    const raw = parseAmount(fields[amountIdx]);
    const description = fields.slice(1, amountIdx).join(' ').trim() || fields[1].trim();
    if (!description) continue;

    transactions.push({
      date,
      description: description.replace(/\s+/g, ' ').trim(),
      amount: Math.abs(raw),
      type: raw > 0 ? 'income' : 'expense',
      suggestedCategory: raw < 0 ? suggestCategory(description) : undefined,
    });
  }

  return transactions;
}


/* ═══════════════════════════════════════════════════════════════
   MAIN PARSER — auto-detects format
   ═══════════════════════════════════════════════════════════════ */

export async function parseBankStatement(csvContent: string): Promise<ParsedTransaction[]> {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Skip BOM
  if (lines[0].startsWith('\ufeff')) lines[0] = lines[0].slice(1);

  // 1. Check if this is a P/L report (date range columns)
  const headerFields = parseCSVLine(lines[0]);
  if (isPLReport(headerFields)) {
    return parsePLReport(lines);
  }

  // 2. Try transaction-based CSV with header detection
  const mapping = detectColumns(headerFields);
  if (mapping) {
    return parseTransactionCSV(lines, mapping);
  }

  // 3. Fallback positional parser
  return parseFallbackCSV(lines);
}


/* ━━━ RESET MONTH DATA ━━━ */
/** Delete all expenses for a given month and reset the financial snapshot */
export async function resetMonthData(month: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // month format: YYYY-MM-01
  const monthKey = month.slice(0, 7); // YYYY-MM
  const monthStart = `${monthKey}-01`;
  const monthEnd = `${monthKey}-31`; // safe upper bound

  // Delete expenses in this month
  const { error: expError } = await supabase
    .from('expenses')
    .delete()
    .eq('user_id', user.id)
    .gte('date', monthStart)
    .lte('date', monthEnd);

  if (expError) console.error('Failed to delete expenses:', expError);

  // Reset financial snapshot for this month
  const { error: snapError } = await supabase
    .from('financial_snapshots')
    .delete()
    .eq('user_id', user.id)
    .eq('month', monthStart);

  if (snapError) console.error('Failed to delete snapshot:', snapError);

  // Delete client monthly overrides for this month
  const { error: overrideError } = await supabase
    .from('client_monthly_overrides')
    .delete()
    .eq('user_id', user.id)
    .eq('month', monthKey);

  if (overrideError) console.warn('Failed to delete client overrides:', overrideError.message);

  // Delete one-off payments for this month
  const { error: oneoffError } = await supabase
    .from('oneoff_payments')
    .delete()
    .eq('user_id', user.id)
    .eq('month', monthKey);

  if (oneoffError) console.warn('Failed to delete one-off payments:', oneoffError.message);

  revalidatePath('/finance');
  return { success: true };
}


/* ━━━ IMPORT TRANSACTIONS ━━━ */
export async function importTransactions(
  transactions: { date: string; description: string; amount: number; type: 'income' | 'expense'; category?: string; expenseType?: 'business' | 'personal' }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const expenseRows = transactions.filter(t => t.type === 'expense');
  const incomeRows = transactions.filter(t => t.type === 'income');

  // Insert expenses in batches (Supabase has row limits on bulk inserts)
  if (expenseRows.length > 0) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < expenseRows.length; i += BATCH_SIZE) {
      const batch = expenseRows.slice(i, i + BATCH_SIZE);
      const expensesToInsert = batch.map(t => ({
        user_id: user.id,
        description: t.description,
        amount: t.amount,
        category: t.category || 'other',
        date: t.date,
        is_recurring: false,
        expense_type: t.expenseType || 'business',
      }));

      const { error } = await supabase
        .from('expenses')
        .insert(expensesToInsert);

      if (error) {
        console.error('Expense insert failed (batch', i, '):', error.message);
        // Retry without expense_type if column doesn't exist
        const { error: retryError } = await supabase
          .from('expenses')
          .insert(expensesToInsert.map(({ expense_type: _et, ...rest }) => rest));

        if (retryError) {
          console.error('Retry also failed:', retryError.message);
          // Last resort: try without is_recurring too
          const { error: lastError } = await supabase
            .from('expenses')
            .insert(batch.map(t => ({
              user_id: user.id,
              description: t.description,
              amount: t.amount,
              category: t.category || 'other',
              date: t.date,
            })));

          if (lastError) {
            throw new Error(`Failed to import expenses: ${lastError.message}`);
          }
        }
      }
    }
  }

  // Aggregate imported expenses by month and update snapshot expense totals only.
  // Revenue is always calculated live from client retainers — bank imports should not touch total_revenue.
  const expensesByMonth = new Map<string, number>();

  for (const t of expenseRows) {
    const monthKey = t.date.slice(0, 7) + '-01';
    expensesByMonth.set(monthKey, (expensesByMonth.get(monthKey) || 0) + t.amount);
  }

  for (const [month, monthExpenses] of expensesByMonth) {
    const { data: existing } = await supabase
      .from('financial_snapshots')
      .select('id, total_expenses')
      .eq('user_id', user.id)
      .eq('month', month)
      .single();

    if (existing) {
      const newExpenses = (Number(existing.total_expenses) || 0) + monthExpenses;
      await supabase
        .from('financial_snapshots')
        .update({
          total_expenses: newExpenses,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('financial_snapshots')
        .insert({
          user_id: user.id,
          month,
          total_revenue: 0,
          total_expenses: monthExpenses,
          corp_tax_reserve: 0,
          dividend_paid: 0,
        });
    }
  }

  revalidatePath('/finance');
  return { importedExpenses: expenseRows.length, importedIncome: incomeRows.length };
}


/* ━━━ IMPORT INCOME AS CLIENT OVERRIDES ━━━ */
/** Map income transactions to clients as monthly overrides */
export async function importIncomeAsOverrides(
  mappings: { clientId: string; month: string; amount: number }[]
) {
  if (mappings.length === 0) return { imported: 0 };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Group by (clientId, month) and sum amounts
  const grouped = new Map<string, { clientId: string; month: string; amount: number }>();
  for (const m of mappings) {
    const monthKey = m.month.slice(0, 7); // Ensure YYYY-MM
    const key = `${m.clientId}::${monthKey}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.amount += m.amount;
    } else {
      grouped.set(key, { clientId: m.clientId, month: monthKey, amount: m.amount });
    }
  }

  // Upsert each override
  let imported = 0;
  for (const { clientId, month, amount } of grouped.values()) {
    const { error } = await supabase
      .from('client_monthly_overrides')
      .upsert(
        {
          user_id: user.id,
          client_id: clientId,
          month,
          amount,
          notes: 'Bank import',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id,month' }
      );

    if (error) {
      console.error(`Failed to upsert override for ${clientId} ${month}:`, error.message);
    } else {
      imported++;
    }
  }

  revalidatePath('/finance');
  return { imported };
}


/* ━━━ IMPORT ONE-OFF PAYMENTS ━━━ */
/** Create one-off payment entries from bank import income */
export async function importOneoffPayments(
  payments: { description: string; month: string; amount: number }[]
) {
  if (payments.length === 0) return { imported: 0 };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let imported = 0;
  for (const p of payments) {
    const monthKey = p.month.slice(0, 7);
    const { error } = await supabase
      .from('oneoff_payments')
      .insert({
        user_id: user.id,
        description: p.description,
        amount: p.amount,
        month: monthKey,
        notes: 'Bank import',
      });

    if (error) {
      console.error(`Failed to insert one-off payment:`, error.message);
    } else {
      imported++;
    }
  }

  revalidatePath('/finance');
  return { imported };
}
