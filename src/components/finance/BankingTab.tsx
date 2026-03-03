'use client';

import { useState, useMemo, useTransition } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils/currency';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import {
  connectBank,
  syncBankTransactions,
  syncAllConnections,
  disconnectBank,
  detectRecurringPayments,
  getAvailableBanks,
} from '@/actions/banking';
import type { BankConnection, BankTransaction } from '@/lib/types/database';

interface BankingTabProps {
  connections: BankConnection[];
  transactions: BankTransaction[];
}

const CATEGORY_COLORS: Record<string, string> = {
  software: 'text-purple-400 bg-purple-400/10',
  hosting: 'text-blue-400 bg-blue-400/10',
  marketing: 'text-pink-400 bg-pink-400/10',
  office: 'text-amber-400 bg-amber-400/10',
  travel: 'text-cyan-400 bg-cyan-400/10',
  professional: 'text-indigo-400 bg-indigo-400/10',
  subscriptions: 'text-orange-400 bg-orange-400/10',
  insurance: 'text-emerald-400 bg-emerald-400/10',
  other: 'text-text-tertiary bg-surface-tertiary',
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function BankingTab({ connections, transactions }: BankingTabProps) {
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [banks, setBanks] = useState<any[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterConnection, setFilterConnection] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRecurringOnly, setShowRecurringOnly] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ━━━ Bank Picker ━━━

  async function handleOpenBankPicker() {
    setShowBankPicker(true);
    setLoadingBanks(true);
    try {
      const list = await getAvailableBanks();
      setBanks(list);
    } catch (err) {
      console.error('Failed to load banks:', err);
    } finally {
      setLoadingBanks(false);
    }
  }

  async function handleSelectBank(bank: any) {
    try {
      const authUrl = await connectBank(bank.id, bank.name, bank.logo || null);
      // Redirect to GoCardless consent page
      window.location.href = authUrl;
    } catch (err) {
      console.error('Failed to start bank connection:', err);
      alert('Failed to start bank connection. Check GoCardless credentials.');
    }
  }

  const filteredBanks = banks.filter(b =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  // ━━━ Sync & Disconnect ━━━

  async function handleSync(connectionId: string) {
    setSyncingId(connectionId);
    try {
      const result = await syncBankTransactions(connectionId);
      // Revalidation happens in the action
    } catch (err) {
      console.error('Sync failed:', err);
      alert(String(err));
    } finally {
      setSyncingId(null);
    }
  }

  async function handleSyncAll() {
    setSyncingId('all');
    try {
      await syncAllConnections();
    } catch (err) {
      console.error('Sync all failed:', err);
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDisconnect(connectionId: string) {
    setDisconnectingId(connectionId);
    try {
      await disconnectBank(connectionId);
    } catch (err) {
      console.error('Disconnect failed:', err);
    } finally {
      setDisconnectingId(null);
      setConfirmDisconnect(null);
    }
  }

  async function handleDetectRecurring() {
    startTransition(async () => {
      try {
        const count = await detectRecurringPayments();
        if (count > 0) {
          alert(`Detected ${count} recurring transactions`);
        } else {
          alert('No new recurring patterns found');
        }
      } catch (err) {
        console.error('Recurring detection failed:', err);
      }
    });
  }

  // ━━━ Filtered Transactions ━━━

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (filterType === 'income' && tx.amount < 0) return false;
      if (filterType === 'expense' && tx.amount >= 0) return false;
      if (filterCategory !== 'all' && tx.category !== filterCategory) return false;
      if (filterConnection !== 'all' && tx.connection_id !== filterConnection) return false;
      if (showRecurringOnly && !tx.is_recurring) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          tx.description.toLowerCase().includes(q) ||
          (tx.merchant_name?.toLowerCase().includes(q) ?? false) ||
          (tx.category?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [transactions, filterType, filterCategory, filterConnection, searchQuery, showRecurringOnly]);

  // ━━━ Recurring Summary ━━━

  const recurringSummary = useMemo(() => {
    const recurring = transactions.filter(tx => tx.is_recurring && tx.amount < 0);
    const groups: Record<string, { description: string; avgAmount: number; count: number; category: string | null }> = {};
    for (const tx of recurring) {
      const key = tx.recurring_group || tx.description;
      if (!groups[key]) {
        groups[key] = { description: tx.merchant_name || tx.description, avgAmount: 0, count: 0, category: tx.category };
      }
      groups[key].avgAmount += Math.abs(tx.amount);
      groups[key].count += 1;
    }
    // Average out per occurrence
    const entries = Object.values(groups).map(g => ({
      ...g,
      avgAmount: g.avgAmount / g.count,
    }));
    entries.sort((a, b) => b.avgAmount - a.avgAmount);
    const monthlyTotal = entries.reduce((sum, e) => sum + e.avgAmount, 0);
    return { entries, monthlyTotal };
  }, [transactions]);

  // ━━━ Render ━━━

  return (
    <div className="space-y-5 stagger-in">

      {/* Connected Accounts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-section-heading text-text-primary">Connected Accounts</h2>
          <div className="flex items-center gap-2">
            {connections.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSyncAll}
                disabled={syncingId === 'all'}
              >
                {syncingId === 'all' ? 'Syncing…' : 'Sync All'}
              </Button>
            )}
            <Button size="sm" onClick={handleOpenBankPicker}>
              + Connect Bank
            </Button>
          </div>
        </div>

        {connections.length === 0 ? (
          <div className="card-elevated rounded-2xl p-8 text-center">
            <p className="text-2xl mb-2">🏦</p>
            <p className="text-sm text-text-secondary mb-1">No bank accounts connected</p>
            <p className="text-xs text-text-tertiary mb-4">
              Connect your Tide, Starling, or other UK bank account to automatically sync transactions.
            </p>
            <Button size="sm" onClick={handleOpenBankPicker}>Connect Your First Bank</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {connections.map(conn => (
              <div key={conn.id} className="card-elevated rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {conn.institution_logo ? (
                    <img
                      src={conn.institution_logo}
                      alt={conn.institution_name}
                      className="w-8 h-8 rounded-lg object-contain bg-white p-0.5"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-surface-tertiary flex items-center justify-center text-sm">🏦</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{conn.institution_name}</p>
                    <p className="text-xs text-text-tertiary truncate">{conn.account_name || 'Current Account'}</p>
                  </div>
                  <Badge variant={conn.status === 'active' ? 'default' : conn.status === 'expired' ? 'warning' : 'danger'}>
                    {conn.status}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span>Last synced: {timeAgo(conn.last_synced_at)}</span>
                  {conn.expires_at && (
                    <span>Expires: {new Date(conn.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {conn.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSync(conn.id)}
                      disabled={syncingId === conn.id}
                      className="flex-1"
                    >
                      {syncingId === conn.id ? 'Syncing…' : 'Sync Now'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleOpenBankPicker}
                      className="flex-1"
                    >
                      Re-connect
                    </Button>
                  )}
                  {confirmDisconnect === conn.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDisconnect(conn.id)}
                        disabled={disconnectingId === conn.id}
                        className="text-danger"
                      >
                        {disconnectingId === conn.id ? '…' : 'Confirm'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDisconnect(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDisconnect(conn.id)}>
                      Disconnect
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recurring Payments Summary */}
      {recurringSummary.entries.length > 0 && (
        <section className="card-elevated rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔁</span>
              <h3 className="text-card-title text-text-primary">Recurring Payments</h3>
            </div>
            <span className="text-sm font-semibold text-text-primary">{formatCurrency(recurringSummary.monthlyTotal)}/mo</span>
          </div>
          <div className="space-y-1.5">
            {recurringSummary.entries.slice(0, 8).map((entry, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs text-text-secondary truncate">{entry.description}</span>
                  {entry.category && (
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0', CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.other)}>
                      {entry.category}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-text-primary ml-3">{formatCurrency(entry.avgAmount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transaction Feed */}
      {transactions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-section-heading text-text-primary">Transactions</h2>
            <Button size="sm" variant="ghost" onClick={handleDetectRecurring} disabled={isPending}>
              {isPending ? 'Detecting…' : 'Detect Recurring'}
            </Button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search transactions…"
              className="w-48 text-xs"
            />
            <div className="flex items-center gap-1">
              {(['all', 'income', 'expense'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
                    filterType === type
                      ? 'bg-surface-tertiary text-text-primary'
                      : 'text-text-tertiary hover:text-text-secondary'
                  )}
                >
                  {type === 'all' ? 'All' : type === 'income' ? 'Income' : 'Expenses'}
                </button>
              ))}
            </div>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="bg-surface-secondary border border-border rounded-lg px-2 py-1 text-xs text-text-secondary cursor-pointer"
            >
              <option value="all">All categories</option>
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {connections.length > 1 && (
              <select
                value={filterConnection}
                onChange={e => setFilterConnection(e.target.value)}
                className="bg-surface-secondary border border-border rounded-lg px-2 py-1 text-xs text-text-secondary cursor-pointer"
              >
                <option value="all">All accounts</option>
                {connections.map(c => (
                  <option key={c.id} value={c.id}>{c.institution_name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowRecurringOnly(!showRecurringOnly)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
                showRecurringOnly
                  ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              🔁 Recurring
            </button>
          </div>

          {/* Transaction List */}
          <div className="card-elevated rounded-2xl divide-y divide-border overflow-hidden">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-text-tertiary">No transactions match your filters</p>
              </div>
            ) : (
              filtered.slice(0, 100).map(tx => (
                <div key={tx.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-surface-secondary/50 transition-colors">
                  {/* Date */}
                  <span className="text-xs text-text-tertiary w-16 flex-shrink-0">
                    {new Date(tx.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-primary truncate">
                      {tx.is_recurring && <span className="mr-1 opacity-60">🔁</span>}
                      {tx.merchant_name || tx.description}
                    </p>
                    {tx.merchant_name && tx.description !== tx.merchant_name && (
                      <p className="text-[10px] text-text-tertiary truncate">{tx.description}</p>
                    )}
                  </div>

                  {/* Category */}
                  {tx.category && tx.category !== 'other' && (
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0',
                      CATEGORY_COLORS[tx.category] || CATEGORY_COLORS.other
                    )}>
                      {tx.category}
                    </span>
                  )}

                  {/* Amount */}
                  <span className={cn(
                    'text-xs font-medium w-20 text-right flex-shrink-0',
                    tx.amount > 0 ? 'text-emerald-400' : 'text-text-primary'
                  )}>
                    {tx.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                  </span>
                </div>
              ))
            )}
            {filtered.length > 100 && (
              <div className="px-4 py-2 text-center">
                <p className="text-[10px] text-text-tertiary">Showing 100 of {filtered.length} transactions</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Bank Picker Modal */}
      <Modal open={showBankPicker} onClose={() => setShowBankPicker(false)} title="Connect a Bank">
        <div className="space-y-3">
          <Input
            value={bankSearch}
            onChange={e => setBankSearch(e.target.value)}
            placeholder="Search banks…"
          />
          {loadingBanks ? (
            <div className="py-8 text-center">
              <p className="text-xs text-text-tertiary">Loading available banks…</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-1">
              {filteredBanks.length === 0 ? (
                <p className="text-xs text-text-tertiary text-center py-4">
                  {bankSearch ? 'No banks match your search' : 'No banks available'}
                </p>
              ) : (
                filteredBanks.map(bank => (
                  <button
                    key={bank.id}
                    onClick={() => handleSelectBank(bank)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-secondary transition-colors cursor-pointer text-left"
                  >
                    {bank.logo ? (
                      <img src={bank.logo} alt={bank.name} className="w-7 h-7 rounded-lg object-contain bg-white p-0.5" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-surface-tertiary flex items-center justify-center text-xs">🏦</div>
                    )}
                    <span className="text-sm text-text-primary">{bank.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
          <p className="text-[10px] text-text-tertiary text-center">
            Powered by GoCardless Open Banking. Your credentials are never stored.
          </p>
        </div>
      </Modal>
    </div>
  );
}
