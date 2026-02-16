'use client';

import { useState, useRef, useTransition } from 'react';
import { cn } from '@/lib/utils/cn';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { parseBankStatement, importTransactions, resetMonthData, type ParsedTransaction } from '@/actions/bank-import';
import { EXPENSE_CATEGORIES } from '@/lib/constants';

interface BankImportModalProps {
  open: boolean;
  onClose: () => void;
}

type ReviewTransaction = ParsedTransaction & {
  include: boolean;
  category: string;
  expenseType: 'business' | 'personal';
};

/** Derive unique months from a set of transactions */
function getMonthsFromTransactions(txns: ReviewTransaction[]): string[] {
  const months = new Set<string>();
  txns.forEach(t => {
    if (t.date && t.date.length >= 7) months.add(t.date.slice(0, 7));
  });
  return Array.from(months).sort();
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[Number(m) - 1]} ${year}`;
}

/** Show month name for P/L entries (all 1st of month), or MM-DD for transaction entries */
function formatDateLabel(date: string): string {
  if (!date || date.length < 10) return date;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = Number(date.slice(5, 7));
  const day = date.slice(8, 10);
  // P/L entries are always 1st of month — show "Jun 25" instead of "06-01"
  if (day === '01') {
    return `${names[month - 1]} ${date.slice(2, 4)}`;
  }
  // Transaction entries — show "15 Jun" (UK format)
  return `${Number(day)} ${names[month - 1]}`;
}

export function BankImportModal({ open, onClose }: BankImportModalProps) {
  const [step, setStep] = useState<'upload' | 'review' | 'importing' | 'done'>('upload');
  const [transactions, setTransactions] = useState<ReviewTransaction[]>([]);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ importedExpenses: number; importedIncome: number; monthsReset: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [resetMonths, setResetMonths] = useState(true);
  const [importProgress, setImportProgress] = useState('');

  function handleReset() {
    setStep('upload');
    setTransactions([]);
    setError('');
    setResult(null);
    setResetMonths(true);
    setImportProgress('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.CSV')) {
      setError('Please upload a CSV file. PDF parsing is not yet supported.');
      return;
    }

    try {
      const text = await file.text();
      const parsed = await parseBankStatement(text);

      if (parsed.length === 0) {
        setError('No transactions found in this file. Make sure it\'s a valid CSV bank statement.');
        return;
      }

      setTransactions(parsed.map(t => ({
        ...t,
        include: true,
        category: t.suggestedCategory || 'other',
        expenseType: 'business' as const,
      })));
      setStep('review');
    } catch {
      setError('Failed to parse the file. Please check the format.');
    }
  }

  function toggleAll(include: boolean) {
    setTransactions(prev => prev.map(t => ({ ...t, include })));
  }

  function toggleTransaction(index: number) {
    setTransactions(prev => prev.map((t, i) => i === index ? { ...t, include: !t.include } : t));
  }

  function updateCategory(index: number, category: string) {
    setTransactions(prev => prev.map((t, i) => i === index ? { ...t, category } : t));
  }

  function updateExpenseType(index: number, expenseType: 'business' | 'personal') {
    setTransactions(prev => prev.map((t, i) => i === index ? { ...t, expenseType } : t));
  }

  function handleImport() {
    const toImport = transactions.filter(t => t.include).map(t => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type,
      category: t.type === 'expense' ? t.category : undefined,
      expenseType: t.type === 'expense' ? t.expenseType : undefined,
    }));

    if (toImport.length === 0) {
      setError('No transactions selected for import.');
      return;
    }

    setStep('importing');
    startTransition(async () => {
      try {
        let monthsResetCount = 0;

        // Reset months first if enabled
        if (resetMonths) {
          const months = getMonthsFromTransactions(transactions.filter(t => t.include));
          setImportProgress(`Resetting ${months.length} month(s) of existing data...`);
          for (const month of months) {
            await resetMonthData(month + '-01');
            monthsResetCount++;
          }
        }

        setImportProgress(`Importing ${toImport.length} transactions...`);
        const res = await importTransactions(toImport);
        setResult({ ...res, monthsReset: monthsResetCount });
        setStep('done');
      } catch (e) {
        setError(`Import failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        setStep('review');
      }
    });
  }

  const includedCount = transactions.filter(t => t.include).length;
  const includedExpenses = transactions.filter(t => t.include && t.type === 'expense');
  const includedIncome = transactions.filter(t => t.include && t.type === 'income');
  const totalExpenses = includedExpenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome = includedIncome.reduce((s, t) => s + t.amount, 0);
  const affectedMonths = getMonthsFromTransactions(transactions.filter(t => t.include));

  return (
    <Modal open={open} onClose={handleClose} title="Import Bank Statement" className="max-w-2xl">
      <div className="space-y-4">
        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-xs text-text-secondary">
              Upload a CSV bank statement or P/L report. Transactions will be categorised automatically and you can review before importing.
            </p>

            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border/60 rounded-xl p-8 text-center cursor-pointer hover:border-accent/40 transition-colors"
            >
              <svg className="w-8 h-8 mx-auto text-text-tertiary mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-sm text-text-secondary font-medium">Click to upload CSV</p>
              <p className="text-[10px] text-text-tertiary mt-1">Supports Tide P/L reports, bank statements, and most UK bank CSV formats</p>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.CSV"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="text-[10px] text-text-tertiary space-y-1">
              <p><strong>How to export:</strong></p>
              <p>Tide: Accounting → Reports → P/L → Export CSV. Or Banking → Transactions → Download. Monzo: Statements → CSV.</p>
            </div>
          </div>
        )}

        {/* STEP 2: Review */}
        {step === 'review' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-secondary">
                {transactions.length} transactions found. Review and confirm.
              </p>
              <div className="flex gap-2">
                <button onClick={() => toggleAll(true)} className="text-[10px] text-accent cursor-pointer">Select All</button>
                <button onClick={() => toggleAll(false)} className="text-[10px] text-text-tertiary cursor-pointer">Deselect All</button>
              </div>
            </div>

            {/* Summary bar */}
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg bg-accent/10 border border-accent/20 px-3 py-2 text-center">
                <p className="text-[9px] text-accent uppercase">Income ({includedIncome.length})</p>
                <p className="text-sm font-bold text-accent">{'\u00A3'}{totalIncome.toFixed(2)}</p>
              </div>
              <div className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-center">
                <p className="text-[9px] text-red-400 uppercase">Expenses ({includedExpenses.length})</p>
                <p className="text-sm font-bold text-red-400">{'\u00A3'}{totalExpenses.toFixed(2)}</p>
              </div>
            </div>

            {/* Month reset toggle */}
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-text-primary">Reset existing data before import</p>
                  <p className="text-[9px] text-text-tertiary mt-0.5">
                    Clears expenses & snapshots for {affectedMonths.length === 1
                      ? formatMonthLabel(affectedMonths[0])
                      : `${affectedMonths.length} months (${affectedMonths.map(formatMonthLabel).join(', ')})`
                    } before importing. Prevents duplicates.
                  </p>
                </div>
                <button
                  onClick={() => setResetMonths(!resetMonths)}
                  className={cn(
                    'w-10 h-5.5 rounded-full flex-shrink-0 relative transition-colors cursor-pointer',
                    resetMonths ? 'bg-accent' : 'bg-border/60'
                  )}
                >
                  <div className={cn(
                    'absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-all',
                    resetMonths ? 'left-[1.3rem]' : 'left-0.5'
                  )} />
                </button>
              </div>
            </div>

            {/* Transaction list */}
            <div className="max-h-[35vh] overflow-y-auto space-y-1 -mx-1 px-1">
              {transactions.map((t, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all',
                    t.include ? 'bg-surface-tertiary/40' : 'opacity-40'
                  )}
                >
                  <button
                    onClick={() => toggleTransaction(i)}
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 cursor-pointer transition-all',
                      t.include ? 'bg-accent border-accent text-white' : 'border-border'
                    )}
                  >
                    {t.include && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  <span className="text-[10px] text-text-tertiary font-mono flex-shrink-0 w-16">{formatDateLabel(t.date)}</span>
                  <span className="text-text-primary truncate flex-1 min-w-0">{t.description}</span>

                  {t.type === 'expense' && t.include && (
                    <select
                      value={t.category}
                      onChange={(e) => updateCategory(i, e.target.value)}
                      className="text-[9px] bg-surface-secondary border border-border/40 rounded px-1.5 py-0.5 text-text-secondary cursor-pointer flex-shrink-0"
                    >
                      {EXPENSE_CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  )}

                  {t.type === 'expense' && t.include && (
                    <button
                      onClick={() => updateExpenseType(i, t.expenseType === 'business' ? 'personal' : 'business')}
                      className={cn(
                        'text-[8px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 cursor-pointer',
                        t.expenseType === 'business' ? 'bg-accent/20 text-accent' : 'bg-purple-500/20 text-purple-400'
                      )}
                    >
                      {t.expenseType === 'business' ? 'BIZ' : 'PERS'}
                    </button>
                  )}

                  <span className={cn(
                    'font-mono font-medium flex-shrink-0 text-right w-16',
                    t.type === 'income' ? 'text-accent' : 'text-red-400'
                  )}>
                    {t.type === 'income' ? '+' : '-'}{'\u00A3'}{t.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <button onClick={handleReset} className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer">
                ← Start over
              </button>
              <Button size="sm" onClick={handleImport} disabled={includedCount === 0}>
                {resetMonths ? 'Reset & Import' : 'Import'} {includedCount} transactions
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Importing */}
        {step === 'importing' && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-text-secondary">{importProgress || `Importing ${includedCount} transactions...`}</p>
          </div>
        )}

        {/* STEP 4: Done */}
        {step === 'done' && result && (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center mx-auto">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Import Complete</p>
              <p className="text-xs text-text-tertiary mt-1">
                {result.monthsReset > 0 && `${result.monthsReset} month(s) reset. `}
                {result.importedExpenses > 0 && `${result.importedExpenses} expenses added. `}
                {result.importedIncome > 0 && `${result.importedIncome} income entries recorded.`}
                {result.importedExpenses === 0 && result.importedIncome === 0 && 'No transactions imported.'}
              </p>
            </div>
            <Button size="sm" onClick={handleClose}>Done</Button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>
    </Modal>
  );
}
