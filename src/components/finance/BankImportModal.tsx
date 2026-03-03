'use client';

import { useState, useRef, useTransition } from 'react';
import { cn } from '@/lib/utils/cn';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { parseBankStatement, importTransactions, resetMonthData, importIncomeAsOverrides, importOneoffPayments, type ParsedTransaction, type TransactionType } from '@/actions/bank-import';
import { createClientAction } from '@/actions/finance';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import type { Client } from '@/lib/types/database';

interface BankImportModalProps {
  open: boolean;
  onClose: () => void;
  clients?: Client[];
}

type ReviewTransaction = ParsedTransaction & {
  include: boolean;
  category: string;
  expenseType: 'business' | 'personal';
};

/** Special types that are NOT regular business expenses */
const SPECIAL_TYPES: TransactionType[] = ['transfer', 'dividend', 'salary', 'tax', 'vat', 'pension'];

const TYPE_LABELS: Record<string, { label: string; color: string; description: string }> = {
  transfer: { label: 'TRANSFER', color: 'bg-blue-500/15 text-blue-400', description: 'Internal transfer — excluded' },
  dividend: { label: 'DIVIDEND', color: 'bg-purple-500/15 text-purple-400', description: 'Updates dividend paid on snapshot' },
  salary: { label: 'SALARY', color: 'bg-amber-500/15 text-amber-400', description: 'Updates salary override for the month' },
  tax: { label: 'TAX', color: 'bg-red-500/15 text-red-400', description: 'Recorded as tax expense' },
  vat: { label: 'VAT', color: 'bg-orange-500/15 text-orange-400', description: 'Recorded as VAT expense' },
  pension: { label: 'PENSION', color: 'bg-teal-500/15 text-teal-400', description: 'Recorded as pension expense' },
};

type IncomeMapping = {
  type: 'client' | 'oneoff' | 'skip';
  clientId?: string;
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

/** Fuzzy match a transaction description against client names */
function autoMatchClient(description: string, clients: Client[]): string | undefined {
  const desc = description.toLowerCase();
  for (const c of clients) {
    const name = c.name.toLowerCase();
    // Check if client name appears in description (or vice versa)
    if (desc.includes(name) || name.includes(desc)) {
      return c.id;
    }
    // Check individual words (for multi-word client names)
    const words = name.split(/\s+/).filter(w => w.length > 3);
    if (words.some(w => desc.includes(w))) {
      return c.id;
    }
  }
  return undefined;
}

export function BankImportModal({ open, onClose, clients = [] }: BankImportModalProps) {
  const [step, setStep] = useState<'upload' | 'review' | 'map-income' | 'importing' | 'done'>('upload');
  const [transactions, setTransactions] = useState<ReviewTransaction[]>([]);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ importedExpenses: number; importedDividends: number; importedSalary: number; importedTax: number; mappedToClients: number; oneoffPayments: number; skippedIncome: number; monthsReset: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [resetMonths, setResetMonths] = useState(true);
  const [importProgress, setImportProgress] = useState('');

  // Income mapping state
  const [incomeMappings, setIncomeMappings] = useState<Record<number, IncomeMapping>>({});
  const [localClients, setLocalClients] = useState<Client[]>([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientRetainer, setNewClientRetainer] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);

  // Merge prop clients with any newly created ones
  const allClients = [...clients, ...localClients];

  function handleReset() {
    setStep('upload');
    setTransactions([]);
    setError('');
    setResult(null);
    setResetMonths(true);
    setImportProgress('');
    setIncomeMappings({});
    setLocalClients([]);
    setShowNewClient(false);
    setNewClientName('');
    setNewClientRetainer('');
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
        include: t.type !== 'transfer', // Auto-exclude transfers; all others included by default
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

  function updateTransactionType(index: number, type: TransactionType) {
    setTransactions(prev => prev.map((t, i) => i === index ? { ...t, type, include: type !== 'transfer' } : t));
  }

  function handleReviewNext() {
    const hasIncome = transactions.some(t => t.include && t.type === 'income');
    if (hasIncome) {
      // Auto-match income transactions to clients
      const mappings: Record<number, IncomeMapping> = {};
      transactions.forEach((t, i) => {
        if (t.include && t.type === 'income') {
          const matchedId = autoMatchClient(t.description, allClients);
          mappings[i] = matchedId
            ? { type: 'client', clientId: matchedId }
            : { type: 'skip' };
        }
      });
      setIncomeMappings(mappings);
      setStep('map-income');
    } else {
      handleImport();
    }
  }

  function updateIncomeMapping(index: number, value: string) {
    if (value === '__oneoff__') {
      setIncomeMappings(prev => ({ ...prev, [index]: { type: 'oneoff' } }));
    } else if (value === '__skip__') {
      setIncomeMappings(prev => ({ ...prev, [index]: { type: 'skip' } }));
    } else {
      setIncomeMappings(prev => ({ ...prev, [index]: { type: 'client', clientId: value } }));
    }
  }

  async function handleCreateClient() {
    if (!newClientName.trim()) return;
    setCreatingClient(true);
    try {
      const result = await createClientAction({
        name: newClientName.trim(),
        retainer_amount: Number(newClientRetainer) || 0,
        is_active: true,
      });
      if (result && typeof result === 'object' && 'id' in result) {
        setLocalClients(prev => [...prev, result as Client]);
      }
      setNewClientName('');
      setNewClientRetainer('');
      setShowNewClient(false);
    } catch (e) {
      setError(`Failed to create client: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setCreatingClient(false);
    }
  }

  function handleImport() {
    // Gather all included transactions except transfers
    const included = transactions.filter(t => t.include && t.type !== 'transfer');

    if (included.length === 0 && Object.keys(incomeMappings).length === 0) {
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

        // Build import payload — expenses, dividends, salary, tax, vat, pension all go through importTransactions
        const toImport = included
          .filter(t => t.type !== 'income') // income handled separately via mappings
          .map(t => ({
            date: t.date,
            description: t.description,
            amount: t.amount,
            type: t.type,
            category: t.type === 'expense' ? t.category : undefined,
            expenseType: t.type === 'expense' ? t.expenseType : undefined,
          }));

        let importedExpenses = 0;
        let importedDividends = 0;
        let importedSalary = 0;
        let importedTax = 0;

        if (toImport.length > 0) {
          const expCount = toImport.filter(t => t.type === 'expense').length;
          const specialCount = toImport.filter(t => t.type !== 'expense').length;
          setImportProgress(`Importing ${expCount} expenses${specialCount > 0 ? ` + ${specialCount} special items` : ''}...`);
          const res = await importTransactions(toImport);
          importedExpenses = res.importedExpenses;
          importedDividends = res.importedDividends;
          importedSalary = res.importedSalary;
          importedTax = res.importedTax;
        }

        // Process income mappings
        let mappedToClients = 0;
        let oneoffCount = 0;
        let skippedIncome = 0;

        const clientMappings: { clientId: string; month: string; amount: number }[] = [];
        const oneoffMappings: { description: string; month: string; amount: number }[] = [];

        for (const [indexStr, mapping] of Object.entries(incomeMappings)) {
          const idx = Number(indexStr);
          const t = transactions[idx];
          if (!t || !t.include) continue;

          if (mapping.type === 'client' && mapping.clientId) {
            clientMappings.push({
              clientId: mapping.clientId,
              month: t.date.slice(0, 7),
              amount: t.amount,
            });
          } else if (mapping.type === 'oneoff') {
            oneoffMappings.push({
              description: t.description,
              month: t.date.slice(0, 7),
              amount: t.amount,
            });
          } else {
            skippedIncome++;
          }
        }

        if (clientMappings.length > 0) {
          setImportProgress(`Mapping ${clientMappings.length} income entries to clients...`);
          const res = await importIncomeAsOverrides(clientMappings);
          mappedToClients = res.imported;
        }

        if (oneoffMappings.length > 0) {
          setImportProgress(`Creating ${oneoffMappings.length} one-off payments...`);
          const res = await importOneoffPayments(oneoffMappings);
          oneoffCount = res.imported;
        }

        setResult({
          importedExpenses,
          importedDividends,
          importedSalary,
          importedTax,
          mappedToClients,
          oneoffPayments: oneoffCount,
          skippedIncome,
          monthsReset: monthsResetCount,
        });
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
  const includedDividends = transactions.filter(t => t.include && t.type === 'dividend');
  const includedSalary = transactions.filter(t => t.include && t.type === 'salary');
  const includedTaxVatPension = transactions.filter(t => t.include && (t.type === 'tax' || t.type === 'vat' || t.type === 'pension'));
  const transferCount = transactions.filter(t => t.type === 'transfer').length;
  const totalExpenses = includedExpenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome = includedIncome.reduce((s, t) => s + t.amount, 0);
  const totalDividends = includedDividends.reduce((s, t) => s + t.amount, 0);
  const totalSalary = includedSalary.reduce((s, t) => s + t.amount, 0);
  const affectedMonths = getMonthsFromTransactions(transactions.filter(t => t.include));

  // Income mapping stats
  const mappedClientCount = Object.values(incomeMappings).filter(m => m.type === 'client' && m.clientId).length;
  const mappedOneoffCount = Object.values(incomeMappings).filter(m => m.type === 'oneoff').length;
  const mappedSkipCount = Object.values(incomeMappings).filter(m => m.type === 'skip').length;

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
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-border-light transition-colors"
            >
              <svg className="w-8 h-8 mx-auto text-text-tertiary mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-sm text-text-secondary font-medium">Click to upload CSV</p>
              <p className="text-xs text-text-tertiary mt-1">Supports Tide P/L reports, bank statements, and most UK bank CSV formats</p>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.CSV"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="text-xs text-text-tertiary space-y-1">
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
                <button onClick={() => toggleAll(true)} className="text-xs text-text-primary cursor-pointer">Select All</button>
                <button onClick={() => toggleAll(false)} className="text-xs text-text-tertiary cursor-pointer">Deselect All</button>
              </div>
            </div>

            {/* Summary bar */}
            <div className="flex flex-wrap gap-2">
              <div className="flex-1 min-w-[100px] rounded-lg bg-surface-tertiary border border-border px-3 py-2 text-center">
                <p className="text-xs text-text-tertiary uppercase">Income ({includedIncome.length})</p>
                <p className="text-sm font-bold text-text-primary">{'\u00A3'}{totalIncome.toFixed(2)}</p>
              </div>
              <div className="flex-1 min-w-[100px] rounded-lg bg-surface-tertiary border border-border px-3 py-2 text-center">
                <p className="text-xs text-text-tertiary uppercase">Expenses ({includedExpenses.length})</p>
                <p className="text-sm font-bold text-text-primary">{'\u00A3'}{totalExpenses.toFixed(2)}</p>
              </div>
              {includedDividends.length > 0 && (
                <div className="flex-1 min-w-[100px] rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-2 text-center">
                  <p className="text-xs text-purple-400 uppercase">Dividends ({includedDividends.length})</p>
                  <p className="text-sm font-bold text-purple-300">{'\u00A3'}{totalDividends.toFixed(2)}</p>
                </div>
              )}
              {includedSalary.length > 0 && (
                <div className="flex-1 min-w-[100px] rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-center">
                  <p className="text-xs text-amber-400 uppercase">Salary ({includedSalary.length})</p>
                  <p className="text-sm font-bold text-amber-300">{'\u00A3'}{totalSalary.toFixed(2)}</p>
                </div>
              )}
              {(includedTaxVatPension.length > 0 || transferCount > 0) && (
                <div className="flex-1 min-w-[100px] rounded-lg bg-surface-tertiary border border-border px-3 py-2 text-center">
                  {includedTaxVatPension.length > 0 && <p className="text-xs text-text-tertiary">Tax/VAT/Pension: {includedTaxVatPension.length}</p>}
                  {transferCount > 0 && <p className="text-xs text-text-tertiary">Transfers: {transferCount} (excluded)</p>}
                </div>
              )}
            </div>

            {/* Month reset toggle */}
            <div className="rounded-lg bg-surface-tertiary border border-border px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary">Reset existing data before import</p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    Clears expenses, revenue records & snapshots for {affectedMonths.length === 1
                      ? formatMonthLabel(affectedMonths[0])
                      : `${affectedMonths.length} months (${affectedMonths.map(formatMonthLabel).join(', ')})`
                    } before importing. Prevents duplicates.
                  </p>
                </div>
                <button
                  onClick={() => setResetMonths(!resetMonths)}
                  className={cn(
                    'w-10 h-5.5 rounded-full flex-shrink-0 relative transition-colors cursor-pointer',
                    resetMonths ? 'bg-text-primary' : 'bg-border/60'
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
                    t.include ? 'bg-surface-tertiary' : 'opacity-40'
                  )}
                >
                  <button
                    onClick={() => toggleTransaction(i)}
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 cursor-pointer transition-all',
                      t.include ? 'bg-text-primary border-text-primary text-background' : 'border-border'
                    )}
                  >
                    {t.include && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  <span className="text-xs text-text-tertiary font-mono flex-shrink-0 w-16">{formatDateLabel(t.date)}</span>
                  <span className="text-text-primary truncate flex-1 min-w-0">{t.description}</span>

                  {/* Type selector for outgoing transactions */}
                  {t.type !== 'income' && t.include && (
                    <select
                      value={t.type}
                      onChange={(e) => updateTransactionType(i, e.target.value as TransactionType)}
                      className={cn(
                        'text-xs border rounded px-1.5 py-0.5 cursor-pointer flex-shrink-0',
                        t.type === 'expense' ? 'bg-surface-secondary border-border text-text-secondary'
                          : t.type === 'dividend' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                          : t.type === 'salary' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : t.type === 'tax' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                          : t.type === 'vat' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                          : t.type === 'pension' ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                          : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      )}
                    >
                      <option value="expense">Expense</option>
                      <option value="dividend">Dividend</option>
                      <option value="salary">Salary</option>
                      <option value="tax">Corp Tax</option>
                      <option value="vat">VAT</option>
                      <option value="pension">Pension</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  )}

                  {t.type === 'expense' && t.include && (
                    <select
                      value={t.category}
                      onChange={(e) => updateCategory(i, e.target.value)}
                      className="text-xs bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-text-secondary cursor-pointer flex-shrink-0"
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
                        'text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 cursor-pointer',
                        t.expenseType === 'business' ? 'bg-surface-tertiary text-text-primary' : 'bg-surface-tertiary text-text-secondary'
                      )}
                    >
                      {t.expenseType === 'business' ? 'BIZ' : 'PERS'}
                    </button>
                  )}

                  {t.type === 'income' && t.include && (
                    <span className="text-xs text-text-tertiary flex-shrink-0 italic">Map next →</span>
                  )}

                  <span className={cn(
                    'font-mono font-medium flex-shrink-0 text-right w-16',
                    t.type === 'income' ? 'text-text-primary'
                      : SPECIAL_TYPES.includes(t.type) ? 'text-text-tertiary'
                      : 'text-text-secondary'
                  )}>
                    {t.type === 'income' ? '+' : '-'}{'\u00A3'}{t.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button onClick={handleReset} className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer">
                ← Start over
              </button>
              {includedIncome.length > 0 ? (
                <Button size="sm" onClick={handleReviewNext} disabled={includedCount === 0}>
                  Next: Map Income →
                </Button>
              ) : (
                <Button size="sm" onClick={handleImport} disabled={includedCount === 0}>
                  {resetMonths ? 'Reset & Import' : 'Import'} {includedCount} transactions
                </Button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Map Income */}
        {step === 'map-income' && (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-text-secondary">
                Map each income entry to a client. This records per-client revenue for accurate historical tracking.
              </p>
            </div>

            {/* Summary bar */}
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg bg-surface-tertiary border border-border px-3 py-2 text-center">
                <p className="text-xs text-text-tertiary">Mapped to clients</p>
                <p className="text-sm font-bold text-text-primary">{mappedClientCount}</p>
              </div>
              <div className="flex-1 rounded-lg bg-surface-tertiary border border-border px-3 py-2 text-center">
                <p className="text-xs text-text-tertiary">One-off payments</p>
                <p className="text-sm font-bold text-text-primary">{mappedOneoffCount}</p>
              </div>
              <div className="flex-1 rounded-lg bg-surface-tertiary border border-border px-3 py-2 text-center">
                <p className="text-xs text-text-tertiary">Skipped</p>
                <p className="text-sm font-bold text-text-secondary">{mappedSkipCount}</p>
              </div>
            </div>

            {/* Income transaction mapping list */}
            <div className="max-h-[35vh] overflow-y-auto space-y-1.5 -mx-1 px-1">
              {transactions.map((t, i) => {
                if (!t.include || t.type !== 'income') return null;
                const mapping = incomeMappings[i] || { type: 'skip' };
                return (
                  <div key={i} className="rounded-lg bg-surface-tertiary px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-text-tertiary font-mono flex-shrink-0">{formatDateLabel(t.date)}</span>
                        <span className="text-xs text-text-primary truncate">{t.description}</span>
                      </div>
                      <span className="text-xs font-mono font-medium text-text-primary flex-shrink-0">
                        +{'\u00A3'}{t.amount.toFixed(2)}
                      </span>
                    </div>
                    <select
                      value={mapping.type === 'client' ? (mapping.clientId || '__skip__') : mapping.type === 'oneoff' ? '__oneoff__' : '__skip__'}
                      onChange={(e) => updateIncomeMapping(i, e.target.value)}
                      className="w-full text-xs bg-surface-secondary border border-border rounded px-2 py-1.5 text-text-primary cursor-pointer"
                    >
                      <option value="__skip__">Skip (don&apos;t import)</option>
                      <option value="__oneoff__">One-off payment</option>
                      {allClients.length > 0 && (
                        <optgroup label="Map to client">
                          {allClients
                            .filter(c => c.is_active)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name}{c.retainer_amount ? ` (£${c.retainer_amount}/mo)` : ''}
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Add new client */}
            {showNewClient ? (
              <div className="rounded-lg border border-border bg-surface-tertiary px-3 py-2.5 space-y-2">
                <p className="text-xs font-medium text-text-primary">New Client</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Client name"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="flex-1 text-xs bg-surface-secondary border border-border rounded px-2 py-1.5 text-text-primary"
                  />
                  <input
                    type="number"
                    placeholder="Monthly retainer"
                    value={newClientRetainer}
                    onChange={(e) => setNewClientRetainer(e.target.value)}
                    className="w-28 text-xs bg-surface-secondary border border-border rounded px-2 py-1.5 text-text-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateClient} disabled={!newClientName.trim() || creatingClient}>
                    {creatingClient ? 'Creating...' : 'Create Client'}
                  </Button>
                  <button onClick={() => setShowNewClient(false)} className="text-xs text-text-tertiary cursor-pointer">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewClient(true)}
                className="text-xs text-text-secondary hover:text-text-primary cursor-pointer"
              >
                + Add new client
              </button>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button onClick={() => setStep('review')} className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer">
                ← Back to review
              </button>
              <Button size="sm" onClick={handleImport}>
                {resetMonths ? 'Reset & Import' : 'Import'} All
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Importing */}
        {step === 'importing' && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-text-secondary">{importProgress || `Importing ${includedCount} transactions...`}</p>
          </div>
        )}

        {/* STEP 5: Done */}
        {step === 'done' && result && (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-tertiary flex items-center justify-center mx-auto">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-primary">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Import Complete</p>
              <div className="text-xs text-text-tertiary mt-1 space-y-0.5">
                {result.monthsReset > 0 && <p>{result.monthsReset} month(s) reset</p>}
                {result.importedExpenses > 0 && <p>{result.importedExpenses} expenses added</p>}
                {result.importedDividends > 0 && <p className="text-purple-400">{result.importedDividends} dividend(s) → snapshot</p>}
                {result.importedSalary > 0 && <p className="text-amber-400">{result.importedSalary} salary payment(s) → monthly override</p>}
                {result.importedTax > 0 && <p>{result.importedTax} tax/VAT/pension → expenses</p>}
                {result.mappedToClients > 0 && <p>{result.mappedToClients} income mapped to clients</p>}
                {result.oneoffPayments > 0 && <p>{result.oneoffPayments} one-off payments created</p>}
                {result.skippedIncome > 0 && <p>{result.skippedIncome} income skipped</p>}
                {result.importedExpenses === 0 && result.importedDividends === 0 && result.importedSalary === 0 && result.importedTax === 0 && result.mappedToClients === 0 && result.oneoffPayments === 0 && <p>No transactions imported.</p>}
              </div>
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
