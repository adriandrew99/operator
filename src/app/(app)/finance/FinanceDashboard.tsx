'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { InfoBox } from '@/components/ui/InfoBox';
import { formatCurrency, formatPercentage } from '@/lib/utils/currency';
import { UK_CORP_TAX_RATE, UK_DIVIDEND_TAX_RATE, UK_DIVIDEND_ALLOWANCE, UK_PERSONAL_ALLOWANCE, UK_NI_SECONDARY_THRESHOLD, UK_BASIC_RATE_LIMIT, UK_HIGHER_DIVIDEND_RATE, EXPENSE_CATEGORIES, STAGE_PROBABILITY_DEFAULTS } from '@/lib/constants';
import { createClientAction, updateClient, deleteClient } from '@/actions/finance';
import { createExpense, updateExpense, deleteExpense } from '@/actions/finance';
import { upsertFinancialSnapshot, updateFinancialSnapshot, deleteFinancialSnapshot } from '@/actions/finance';
import { createSavingsGoal, updateSavingsGoal, deleteSavingsGoal } from '@/actions/finance';
import { upsertClientOverride, deleteClientOverride, getClientOverridesForClient } from '@/actions/finance';
import { updateFinanceSettings } from '@/actions/settings';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { toCSV, downloadCSV, fileDate } from '@/lib/utils/export';
import { ExportButton } from '@/components/ui/ExportButton';

const BankImportModal = dynamic(() => import('@/components/finance/BankImportModal').then(m => ({ default: m.BankImportModal })), { ssr: false });
const IncomeChart = dynamic(() => import('@/components/finance/IncomeChart').then(m => ({ default: m.IncomeChart })), { ssr: false, loading: () => <div className="h-48 flex items-center justify-center text-xs text-text-tertiary">Loading chart...</div> });
const EarningsByClient = dynamic(() => import('@/components/finance/EarningsByClient').then(m => ({ default: m.EarningsByClient })), { ssr: false, loading: () => <div className="h-48 flex items-center justify-center text-xs text-text-tertiary">Loading chart...</div> });
import type { Client, Expense, FinancialSnapshot, PipelineLead, SavingsGoal, ClientMonthlyOverride } from '@/lib/types/database';
import type { ClientEnergyProfile, RevenueInsight } from '@/actions/insights';

interface FinanceDashboardProps {
  clients: Client[];
  expenses: Expense[];
  snapshot: FinancialSnapshot | null;
  history: FinancialSnapshot[];
  pipelineLeads: PipelineLead[];
  savingsGoals: SavingsGoal[];
  currentMonth: string; // YYYY-MM-DD format
  clientOverrides?: ClientMonthlyOverride[];
  clientEnergyProfiles?: ClientEnergyProfile[];
  insights?: RevenueInsight[];
  monthlySalary?: number;
  staffCost?: number;
}

function getMonthLabel(monthStr: string): string {
  const d = new Date(monthStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function isCurrentMonth(monthStr: string): boolean {
  const now = new Date();
  const d = new Date(monthStr + 'T00:00:00');
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isFutureMonth(monthStr: string): boolean {
  const now = new Date();
  const currentFirst = new Date(now.getFullYear(), now.getMonth(), 1);
  const d = new Date(monthStr + 'T00:00:00');
  return d > currentFirst;
}

function monthsFromNow(monthStr: string): number {
  const now = new Date();
  const d = new Date(monthStr + 'T12:00:00');
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
}

function formatLocalMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function shiftMonth(monthStr: string, delta: number): string {
  const d = new Date(monthStr + 'T12:00:00');
  d.setMonth(d.getMonth() + delta);
  return formatLocalMonth(d);
}

export function FinanceDashboard({ clients, expenses, snapshot, history, pipelineLeads, savingsGoals, currentMonth, clientOverrides = [], clientEnergyProfiles = [], insights = [], monthlySalary = 0, staffCost = 0 }: FinanceDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'expenses' | 'forecast' | 'personal' | 'year'>('overview');
  const [showClientModal, setShowClientModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showBankImport, setShowBankImport] = useState(false);
  const [expandedBox, setExpandedBox] = useState<'revenue' | 'expenses' | 'net' | 'possible' | null>(null);
  const [editingOverrideClientId, setEditingOverrideClientId] = useState<string | null>(null);
  const [overrideEditAmount, setOverrideEditAmount] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [showTaxDetail, setShowTaxDetail] = useState(false);
  // What-If Mode state
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [whatIfExcludedClients, setWhatIfExcludedClients] = useState<Set<string>>(new Set());
  const [whatIfHypotheticals, setWhatIfHypotheticals] = useState<{ name: string; amount: number }[]>([]);
  const [whatIfExpenseScale, setWhatIfExpenseScale] = useState(100); // percentage
  const [whatIfStaffCostOverride, setWhatIfStaffCostOverride] = useState<number | null>(null);
  const [whatIfNewClientName, setWhatIfNewClientName] = useState('');
  const [whatIfNewClientAmount, setWhatIfNewClientAmount] = useState('');
  // FY month overrides — client-side only, for projecting partial/future months
  const [fyOverrides, setFyOverrides] = useState<Record<string, { revenue?: number; expenses?: number }>>({});
  const [fyEditingMonth, setFyEditingMonth] = useState<string | null>(null);
  const [fyEditField, setFyEditField] = useState<'revenue' | 'expenses'>('revenue');
  const [fyEditValue, setFyEditValue] = useState('');
  const router = useRouter();
  const isCurrent = isCurrentMonth(currentMonth);
  const isFuture = isFutureMonth(currentMonth);
  const futureOffset = monthsFromNow(currentMonth);
  const maxFutureMonths = 12;

  function navigateMonth(month: string) {
    router.replace(`/finance?month=${month}`);
  }

  const activeClients = clients.filter((c) => {
    if (!c.is_active) return false;
    const viewedMonth = new Date(currentMonth + 'T12:00:00');
    // Exclude clients whose termination date has passed before the viewed month
    if (c.termination_date) {
      const termDate = new Date(c.termination_date + 'T12:00:00');
      if (termDate < viewedMonth) return false;
    }
    // Exclude clients whose contract hasn't started yet
    if (c.contract_start) {
      const startDate = new Date(c.contract_start + 'T12:00:00');
      if (startDate > viewedMonth) return false;
    }
    return true;
  });

  // Build override map: client_id -> override amount for current month
  // Use local state so optimistic updates reflect immediately
  const serverOverrideMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of clientOverrides) {
      map[o.client_id] = Number(o.amount);
    }
    return map;
  }, [clientOverrides]);

  const [localOverrides, setLocalOverrides] = useState<Record<string, number | null>>({});

  // Merge: local optimistic overrides take precedence over server data
  const overrideMap = useMemo(() => {
    const map: Record<string, number> = { ...serverOverrideMap };
    for (const [clientId, val] of Object.entries(localOverrides)) {
      if (val === null) {
        delete map[clientId]; // removed override
      } else {
        map[clientId] = val;
      }
    }
    return map;
  }, [serverOverrideMap, localOverrides]);

  // Reset local overrides when server data updates (after revalidation)
  useEffect(() => {
    setLocalOverrides({});
  }, [clientOverrides]);

  // Use override amount if exists, otherwise base retainer
  function getClientMonthlyAmount(client: Client): number {
    if (overrideMap[client.id] !== undefined) return overrideMap[client.id];
    return client.retainer_amount || 0;
  }

  const liveRevenue = activeClients.reduce((sum, c) => sum + getClientMonthlyAmount(c), 0);
  const businessExpensesList = expenses.filter(e => (e.expense_type || 'business') === 'business');
  const personalExpensesList = expenses.filter(e => e.expense_type === 'personal');
  const liveBusinessExpenses = businessExpensesList.reduce((sum, e) => sum + e.amount, 0);
  const livePersonalExpenses = personalExpensesList.reduce((sum, e) => sum + e.amount, 0);
  const totalBusinessCosts = liveBusinessExpenses + staffCost + monthlySalary; // includes staff/contractor costs + director salary
  const liveExpenses = totalBusinessCosts; // alias for backward compat (charts, forecast)

  // For past months, prefer snapshot data (which captures historical reality) over live client calculations
  const monthlyRevenue = (!isCurrent && snapshot?.total_revenue) ? Number(snapshot.total_revenue) : liveRevenue;
  const monthlyExpenses = (!isCurrent && snapshot?.total_expenses != null) ? Number(snapshot.total_expenses) : totalBusinessCosts;
  const taxableProfit = Math.max(0, monthlyRevenue - monthlyExpenses);
  const taxReserve = taxableProfit * UK_CORP_TAX_RATE;
  const leftInCompany = taxableProfit; // revenue - expenses (tax shown separately, paid at year end)

  // Pipeline projected revenue (unweighted total for backward compat)
  const pipelineRevenue = pipelineLeads
    .filter(l => l.stage !== 'lost' && l.stage !== 'closed')
    .reduce((sum, l) => sum + (l.estimated_value || 0), 0);

  // All active clients (including future-start) for forecast projections
  const allActiveClients = useMemo(() => clients.filter(c => c.is_active), [clients]);

  // ━━━ Future month projection tiers ━━━
  const futureProjection = useMemo(() => {
    if (!isFuture) return null;
    const targetMonth = new Date(currentMonth + 'T12:00:00');

    // Confirmed: active clients whose contracts will be active during target month
    let confirmed = 0;
    const confirmedBreakdown: { name: string; amount: number; note?: string; isLost?: boolean; clientId?: string; baseRetainer?: number }[] = [];
    const lostClients: { name: string; amount: number; reason: string }[] = [];
    const upcomingClients: { name: string; amount: number; startDate: string }[] = [];

    for (const c of allActiveClients) {
      // Use override for this month if one exists, otherwise base retainer
      const baseRetainer = c.retainer_amount || 0;
      const retainer = overrideMap[c.id] !== undefined ? overrideMap[c.id] : baseRetainer;
      if (retainer === 0 && baseRetainer === 0) continue;

      const contractStart = c.contract_start ? new Date(c.contract_start + 'T12:00:00') : null;
      const contractEnd = c.contract_end ? new Date(c.contract_end + 'T12:00:00') : null;
      const termDate = c.termination_date ? new Date(c.termination_date + 'T12:00:00') : null;

      // If client has hard termination date before target month → lost
      if (termDate && termDate < targetMonth) {
        lostClients.push({
          name: c.name,
          amount: retainer,
          reason: `Terminates ${new Date(c.termination_date!).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`,
        });
        continue;
      }

      // If client hasn't started yet by target month → skip (but track for display)
      if (contractStart && contractStart > targetMonth) {
        upcomingClients.push({
          name: c.name,
          amount: retainer,
          startDate: c.contract_start!,
        });
        continue;
      }

      // If client is_ending but no termination date yet, flag but include at reduced probability
      if (c.is_ending && !termDate) {
        const renewalProb = c.renewal_probability ?? 20; // lower default for ending clients
        const weighted = retainer * (renewalProb / 100);
        confirmed += weighted;
        confirmedBreakdown.push({
          name: c.name,
          amount: weighted,
          note: `Ending — ${renewalProb}% renewal`,
          isLost: true,
          clientId: c.id,
          baseRetainer: c.retainer_amount || 0,
        });
        continue;
      }

      const hasOverride = overrideMap[c.id] !== undefined;
      const overrideTag = hasOverride ? ' (override)' : '';

      // Client starts during this target month → show with note
      const startsThisMonth = contractStart && contractStart.getFullYear() === targetMonth.getFullYear() && contractStart.getMonth() === targetMonth.getMonth();

      // If contract ends before target month, factor in renewal probability
      if (contractEnd && contractEnd < targetMonth) {
        const renewalProb = c.renewal_probability ?? 50;
        const weighted = retainer * (renewalProb / 100);
        confirmed += weighted;
        confirmedBreakdown.push({
          name: c.name,
          amount: weighted,
          note: `Contract ends ${contractEnd.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} — ${renewalProb}% renewal${overrideTag}`,
          clientId: c.id,
          baseRetainer: baseRetainer,
        });
      } else {
        confirmed += retainer;
        const startNote = startsThisMonth ? `Starts ${contractStart!.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : undefined;
        confirmedBreakdown.push({ name: c.name, amount: retainer, clientId: c.id, baseRetainer: baseRetainer, note: startNote || (hasOverride ? 'override' : undefined) });
      }
    }

    // Pipeline leads split by probability
    const activeLeads = pipelineLeads.filter(l => l.stage !== 'lost' && l.stage !== 'closed');
    let likely = 0;
    let possible = 0;
    const likelyBreakdown: { name: string; amount: number; probability: number }[] = [];
    const possibleBreakdown: { name: string; amount: number; probability: number }[] = [];

    for (const l of activeLeads) {
      const prob = l.probability ?? STAGE_PROBABILITY_DEFAULTS[l.stage] ?? 0;
      const value = l.estimated_value || 0;
      if (prob >= 60) {
        likely += value;
        likelyBreakdown.push({ name: l.name, amount: value, probability: prob });
      } else if (prob > 0) {
        possible += value;
        possibleBreakdown.push({ name: l.name, amount: value, probability: prob });
      }
    }

    return {
      confirmed,
      likely,
      possible,
      total: confirmed + likely + possible,
      confirmedBreakdown,
      likelyBreakdown,
      possibleBreakdown,
      lostClients,
      upcomingClients,
    };
  }, [isFuture, currentMonth, allActiveClients, pipelineLeads, overrideMap]);

  // For future months, use projected confirmed revenue; for past/current, use normal logic
  const effectiveRevenue = isFuture && futureProjection ? futureProjection.confirmed : monthlyRevenue;
  const effectiveExpenses = isFuture ? totalBusinessCosts : monthlyExpenses; // carry forward current biz expenses + staff
  const effectiveTaxableProfit = Math.max(0, effectiveRevenue - effectiveExpenses);
  const effectiveTaxReserve = effectiveTaxableProfit * UK_CORP_TAX_RATE;
  const effectiveLeftInCompany = effectiveTaxableProfit; // revenue - expenses (tax shown separately)

  // ━━━ What-If Scenario Calculations ━━━
  // Use effective values as baseline so What-If works correctly for future months too
  const baselineRevenue = isFuture && futureProjection ? effectiveRevenue : monthlyRevenue;
  const baselineExpenses = isFuture ? effectiveExpenses : monthlyExpenses;
  const baselineLeftInCompany = isFuture ? effectiveLeftInCompany : leftInCompany;

  const whatIfCalc = useMemo(() => {
    if (!whatIfMode) return null;
    // Revenue: active clients minus excluded, plus hypotheticals
    const scenarioClients = activeClients.filter(c => !whatIfExcludedClients.has(c.id));
    const clientRevenue = scenarioClients.reduce((sum, c) => sum + getClientMonthlyAmount(c), 0);
    const hypotheticalRevenue = whatIfHypotheticals.reduce((sum, h) => sum + h.amount, 0);
    const scenarioRevenue = clientRevenue + hypotheticalRevenue;
    // Expenses: scaled
    const scaledBusinessExpenses = liveBusinessExpenses * (whatIfExpenseScale / 100);
    const scenarioStaffCost = whatIfStaffCostOverride !== null ? whatIfStaffCostOverride : staffCost;
    const scenarioExpenses = scaledBusinessExpenses + scenarioStaffCost + monthlySalary;
    // Tax + profit
    const scenarioTaxableProfit = Math.max(0, scenarioRevenue - scenarioExpenses);
    const scenarioTaxReserve = scenarioTaxableProfit * UK_CORP_TAX_RATE;
    const scenarioLeftInCompany = scenarioTaxableProfit; // revenue - expenses (tax shown separately)
    // Deltas — compare against the effective baseline (handles future months correctly)
    const revenueDelta = scenarioRevenue - baselineRevenue;
    const expensesDelta = scenarioExpenses - baselineExpenses;
    const profitDelta = scenarioLeftInCompany - baselineLeftInCompany;
    return {
      revenue: scenarioRevenue,
      expenses: scenarioExpenses,
      taxableProfit: scenarioTaxableProfit,
      taxReserve: scenarioTaxReserve,
      leftInCompany: scenarioLeftInCompany,
      clientCount: scenarioClients.length + whatIfHypotheticals.length,
      revenueDelta,
      expensesDelta,
      profitDelta,
    };
  }, [whatIfMode, whatIfExcludedClients, whatIfHypotheticals, whatIfExpenseScale, whatIfStaffCostOverride, activeClients, liveBusinessExpenses, staffCost, monthlySalary, baselineRevenue, baselineExpenses, baselineLeftInCompany, overrideMap]);

  function resetWhatIf() {
    setWhatIfExcludedClients(new Set());
    setWhatIfHypotheticals([]);
    setWhatIfExpenseScale(100);
    setWhatIfStaffCostOverride(null);
    setWhatIfNewClientName('');
    setWhatIfNewClientAmount('');
  }

  // ━━━ Salary Allowance Tracker ━━━
  // UK personal allowance: £12,570/year — salary above this is taxable (effectively a dividend for the company)
  const annualSalaryProjected = monthlySalary * 12;
  const salaryAllowanceUsedPct = annualSalaryProjected > 0 ? Math.min(100, (annualSalaryProjected / UK_PERSONAL_ALLOWANCE) * 100) : 0;
  const salaryExceedsAllowance = annualSalaryProjected > UK_PERSONAL_ALLOWANCE;
  const salaryExcess = Math.max(0, annualSalaryProjected - UK_PERSONAL_ALLOWANCE);
  // How many months of current salary until allowance is hit
  const monthsUntilAllowanceHit = monthlySalary > 0 ? Math.floor(UK_PERSONAL_ALLOWANCE / monthlySalary) : Infinity;
  const monthlyAllowanceLimit = Math.floor(UK_PERSONAL_ALLOWANCE / 12); // £1,047/month

  // Revenue stability — Herfindahl-Hirschman Index weighted by renewal probability
  const { stabilityScore, stabilityInsights } = useMemo(() => {
    if (activeClients.length === 0) return { stabilityScore: 0, stabilityInsights: [] as string[] };
    if (monthlyRevenue === 0) return { stabilityScore: 0, stabilityInsights: [] as string[] };

    const insights: string[] = [];

    const shares = activeClients.map(c => ({
      name: c.name,
      share: ((c.retainer_amount || 0) / monthlyRevenue) * 100,
      renewal: c.renewal_probability ?? 50,
    }));

    const hhi = shares.reduce((sum, s) => sum + s.share * s.share, 0);
    const diversityScore = Math.max(0, 100 - (hhi / 100));
    const avgRenewal = shares.reduce((sum, s) => sum + s.renewal, 0) / shares.length;
    const countBonus = Math.min(20, activeClients.length * 5);
    const raw = (diversityScore * 0.4) + (avgRenewal * 0.4) + countBonus;
    const score = Math.min(100, Math.round(raw));

    // Generate auto-insights
    const sortedShares = [...shares].sort((a, b) => b.share - a.share);
    const topClient = sortedShares[0];
    if (topClient && topClient.share > 50) {
      insights.push(`${topClient.name} accounts for ${topClient.share.toFixed(0)}% of revenue — high concentration risk.`);
    } else if (topClient && topClient.share > 35) {
      insights.push(`${topClient.name} is your largest client at ${topClient.share.toFixed(0)}% of revenue.`);
    }

    if (activeClients.length < 3) {
      insights.push(`Only ${activeClients.length} active client${activeClients.length === 1 ? '' : 's'}. Adding more would reduce risk.`);
    } else if (activeClients.length >= 5) {
      insights.push(`${activeClients.length} active clients — good diversification.`);
    }

    const lowRenewal = shares.filter(s => s.renewal < 50);
    if (lowRenewal.length > 0) {
      insights.push(`${lowRenewal.length} client${lowRenewal.length === 1 ? '' : 's'} with <50% renewal probability — monitor closely.`);
    }

    if (avgRenewal >= 75) {
      insights.push(`Average renewal probability is strong at ${avgRenewal.toFixed(0)}%.`);
    } else if (avgRenewal < 50) {
      insights.push(`Average renewal probability is low at ${avgRenewal.toFixed(0)}% — focus on retention.`);
    }

    const expiringClients = activeClients.filter(c =>
      c.contract_end && new Date(c.contract_end) < new Date(Date.now() + 90 * 86400000)
    );
    if (expiringClients.length > 0) {
      insights.push(`${expiringClients.length} contract${expiringClients.length === 1 ? '' : 's'} expiring within 90 days.`);
    }

    const endingClients = activeClients.filter(c => c.is_ending);
    if (endingClients.length > 0) {
      const endingRevenue = endingClients.reduce((sum, c) => sum + (c.retainer_amount || 0), 0);
      insights.push(`${endingClients.length} client${endingClients.length === 1 ? '' : 's'} ending — ${formatCurrency(endingRevenue)}/mo at risk.`);
    }

    return { stabilityScore: score, stabilityInsights: insights };
  }, [activeClients, monthlyRevenue]);

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'forecast' as const, label: 'Forecast' },
    { key: 'year' as const, label: 'FY' },
    { key: 'clients' as const, label: `Clients (${activeClients.length})` },
    { key: 'expenses' as const, label: 'Expenses' },
    { key: 'personal' as const, label: 'Personal' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 relative z-0">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Finance</h1>
          <p className="text-xs sm:text-sm text-text-tertiary mt-0.5 sm:mt-1">Revenue, expenses & projections</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          {/* Month Navigator */}
          <div className="relative flex items-center gap-0.5 sm:gap-1 bg-surface-tertiary/40 rounded-xl border border-border/50 px-0.5 sm:px-1 py-0.5">
            <button
              onClick={() => navigateMonth(shiftMonth(currentMonth, -1))}
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
              title="Previous month"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={() => setShowMonthPicker(prev => !prev)}
              className={cn(
                'px-1.5 sm:px-3 py-1 text-[11px] sm:text-xs font-medium rounded-lg transition-colors min-w-[90px] sm:min-w-[120px] text-center cursor-pointer',
                isCurrent
                  ? 'text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {getMonthLabel(currentMonth)}
            </button>
            <button
              onClick={() => navigateMonth(shiftMonth(currentMonth, 1))}
              className={cn(
                'p-1.5 rounded-lg transition-colors cursor-pointer',
                futureOffset >= maxFutureMonths
                  ? 'text-text-tertiary/30 cursor-not-allowed'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-surface-hover'
              )}
              disabled={futureOffset >= maxFutureMonths}
              title="Next month"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Month Picker Dropdown */}
            {showMonthPicker && (
              <div className="absolute top-full right-0 mt-2 z-50 w-56 p-3 rounded-xl bg-surface-primary border border-border shadow-lg">
                {(() => {
                  const now = new Date();
                  const currentYear = now.getFullYear();
                  const currentMonthIdx = now.getMonth();
                  // Show 6 past months + current + 12 future
                  const months: { label: string; value: string; isCur: boolean }[] = [];
                  for (let offset = -6; offset <= 12; offset++) {
                    const d = new Date(currentYear, currentMonthIdx + offset, 1);
                    const val = formatLocalMonth(d);
                    const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
                    months.push({ label, value: val, isCur: offset === 0 });
                  }
                  // Group by year
                  const byYear: Record<string, typeof months> = {};
                  months.forEach(m => {
                    const yr = m.value.slice(0, 4);
                    (byYear[yr] = byYear[yr] || []).push(m);
                  });
                  return (
                    <div className="max-h-60 overflow-y-auto space-y-3">
                      {Object.entries(byYear).map(([year, yearMonths]) => (
                        <div key={year}>
                          <p className="text-[10px] text-text-tertiary font-semibold uppercase tracking-widest mb-1.5">{year}</p>
                          <div className="grid grid-cols-3 gap-1">
                            {yearMonths.map(m => (
                              <button
                                key={m.value}
                                onClick={() => {
                                  navigateMonth(m.value);
                                  setShowMonthPicker(false);
                                }}
                                className={cn(
                                  'text-[11px] py-1.5 px-2 rounded-lg transition-colors text-center cursor-pointer',
                                  m.value === currentMonth
                                    ? 'bg-accent text-black font-semibold'
                                    : m.isCur
                                      ? 'bg-accent/10 text-accent hover:bg-accent/20'
                                      : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
                                )}
                              >
                                {m.label.split(' ')[0]}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <button
            onClick={() => { setWhatIfMode(prev => !prev); if (whatIfMode) resetWhatIf(); }}
            className={cn(
              'hidden sm:flex px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer',
              whatIfMode
                ? 'bg-purple-500/15 text-purple-400 border-purple-500/40 shadow-lg shadow-purple-500/10'
                : 'bg-surface-tertiary/40 text-text-secondary border-border/50 hover:text-text-primary hover:bg-surface-tertiary'
            )}
          >
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
              </svg>
              {whatIfMode ? 'Exit What-If' : 'What-If'}
            </span>
          </button>
          <Button size="sm" variant="secondary" onClick={() => setShowSnapshotModal(true)} className="hidden sm:inline-flex">+ Monthly Record</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowBankImport(true)} className="hidden sm:inline-flex">
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import CSV
            </span>
          </Button>
          <ExportButton
            className="hidden sm:flex"
            options={[
              {
                label: 'Export Expenses (CSV)',
                description: `${getMonthLabel(currentMonth)} expenses`,
                action: () => {
                  const csv = toCSV(expenses.map(e => ({
                    Date: e.date,
                    Description: e.description,
                    Amount: e.amount,
                    Category: e.category || '',
                    Type: e.expense_type || 'business',
                  })));
                  downloadCSV(csv, `nexus-expenses-${currentMonth}-${fileDate()}.csv`);
                },
              },
              {
                label: 'Export Clients (CSV)',
                description: 'Active clients with retainers',
                action: () => {
                  const csv = toCSV(clients.map(c => ({
                    Name: c.name,
                    Retainer: c.retainer_amount || 0,
                    Active: c.is_active ? 'Yes' : 'No',
                    'Risk Flag': c.risk_flag || 'None',
                    'Contract End': c.contract_end || '',
                    'Renewal %': c.renewal_probability ?? '',
                  })));
                  downloadCSV(csv, `nexus-clients-${fileDate()}.csv`);
                },
              },
              {
                label: 'Export Monthly History (CSV)',
                description: 'All financial snapshots',
                action: () => {
                  const csv = toCSV(history.map(s => ({
                    Month: s.month,
                    Revenue: s.total_revenue || 0,
                    Expenses: s.total_expenses || 0,
                    'Corp Tax': s.corp_tax_reserve || 0,
                    'Starting Balance': s.starting_balance || 0,
                    'Dividend Paid': s.dividend_paid || 0,
                  })));
                  downloadCSV(csv, `nexus-financial-history-${fileDate()}.csv`);
                },
              },
            ]}
          />
        </div>
      </div>

      {/* Future month banner */}
      {isFuture && futureProjection && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-purple-400 shrink-0">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <p className="text-xs text-purple-400">
            <span className="font-semibold">Projected month.</span> Revenue based on active clients + probability-weighted pipeline leads.
          </p>
        </div>
      )}

      {/* Past month info banner */}
      {!isCurrent && !isFuture && !snapshot && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-400">
            No financial record for {getMonthLabel(currentMonth)}. Revenue shown is based on current active clients.
          </p>
          <button
            onClick={() => setShowSnapshotModal(true)}
            className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap ml-3"
          >
            + Add Record
          </button>
        </div>
      )}

      {/* ━━━ What-If Scenario Panel ━━━ */}
      {whatIfMode && whatIfCalc && (
        <div className="p-5 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <h3 className="text-sm font-bold text-purple-400">What-If Scenario</h3>
            </div>
            <button onClick={resetWhatIf} className="text-[10px] text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">Reset All</button>
          </div>

          {/* Scenario Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client Toggles */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Toggle Clients</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {activeClients.map(c => {
                  const isExcluded = whatIfExcludedClients.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setWhatIfExcludedClients(prev => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        });
                      }}
                      className={cn(
                        'flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs transition-all cursor-pointer',
                        isExcluded
                          ? 'bg-red-500/10 border border-red-500/20 text-red-400 line-through'
                          : 'bg-surface-tertiary/30 border border-border/30 text-text-primary hover:bg-surface-tertiary/60'
                      )}
                    >
                      <span>{c.name}</span>
                      <span className="font-mono text-[11px]">{isExcluded ? '-' : ''}{formatCurrency(getClientMonthlyAmount(c))}</span>
                    </button>
                  );
                })}
              </div>

              {/* Add hypothetical client */}
              <div className="pt-2 border-t border-border/30">
                <p className="text-[10px] text-text-tertiary mb-1.5">Add hypothetical client</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Client name"
                    value={whatIfNewClientName}
                    onChange={e => setWhatIfNewClientName(e.target.value)}
                    className="flex-1 text-xs bg-surface-secondary border border-border/50 rounded-lg px-2.5 py-1.5 text-text-primary placeholder:text-text-tertiary/50 outline-none focus:ring-1 focus:ring-purple-500/30"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-text-tertiary">£</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={whatIfNewClientAmount}
                      onChange={e => setWhatIfNewClientAmount(e.target.value)}
                      className="w-20 text-xs bg-surface-secondary border border-border/50 rounded-lg px-2 py-1.5 text-text-primary outline-none focus:ring-1 focus:ring-purple-500/30 font-mono"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (whatIfNewClientName && Number(whatIfNewClientAmount) > 0) {
                        setWhatIfHypotheticals(prev => [...prev, { name: whatIfNewClientName, amount: Number(whatIfNewClientAmount) }]);
                        setWhatIfNewClientName('');
                        setWhatIfNewClientAmount('');
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-purple-500/15 text-purple-400 text-xs font-medium hover:bg-purple-500/25 transition-colors cursor-pointer"
                  >+</button>
                </div>
                {whatIfHypotheticals.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {whatIfHypotheticals.map((h, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/15">
                        <span className="text-xs text-purple-400">{h.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-purple-400">+{formatCurrency(h.amount)}</span>
                          <button onClick={() => setWhatIfHypotheticals(prev => prev.filter((_, j) => j !== i))} className="text-purple-400/50 hover:text-purple-400 cursor-pointer text-xs">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Expense & Staff Adjustments */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Expense Scaling</p>
                  <span className={cn('text-xs font-mono font-semibold', whatIfExpenseScale !== 100 ? 'text-purple-400' : 'text-text-tertiary')}>{whatIfExpenseScale}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={200}
                  step={5}
                  value={whatIfExpenseScale}
                  onChange={e => setWhatIfExpenseScale(Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-tertiary rounded-full appearance-none cursor-pointer accent-purple-400"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-text-tertiary">-50%</span>
                  <span className="text-[9px] text-text-tertiary">Current</span>
                  <span className="text-[9px] text-text-tertiary">+100%</span>
                </div>
              </div>

              {staffCost > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Staff Cost</p>
                    <span className={cn('text-xs font-mono', whatIfStaffCostOverride !== null ? 'text-purple-400 font-semibold' : 'text-text-tertiary')}>
                      {formatCurrency(whatIfStaffCostOverride !== null ? whatIfStaffCostOverride : staffCost)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.round(staffCost * 3)}
                    step={50}
                    value={whatIfStaffCostOverride !== null ? whatIfStaffCostOverride : staffCost}
                    onChange={e => setWhatIfStaffCostOverride(Number(e.target.value))}
                    className="w-full h-1.5 bg-surface-tertiary rounded-full appearance-none cursor-pointer accent-purple-400"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Comparison Results */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-3 border-t border-purple-500/20">
            <div className="text-center p-3 rounded-xl bg-surface-primary/60 border border-border/30">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Revenue</p>
              <p className="text-lg font-bold text-text-primary">{formatCurrency(whatIfCalc.revenue)}</p>
              <p className={cn('text-[11px] font-semibold mt-0.5', whatIfCalc.revenueDelta > 0 ? 'text-emerald-400' : whatIfCalc.revenueDelta < 0 ? 'text-red-400' : 'text-text-tertiary')}>
                {whatIfCalc.revenueDelta > 0 ? '+' : ''}{whatIfCalc.revenueDelta !== 0 ? formatCurrency(whatIfCalc.revenueDelta) : 'No change'}
              </p>
            </div>
            <div className="text-center p-3 rounded-xl bg-surface-primary/60 border border-border/30">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Expenses</p>
              <p className="text-lg font-bold text-text-secondary">{formatCurrency(whatIfCalc.expenses)}</p>
              <p className={cn('text-[11px] font-semibold mt-0.5', whatIfCalc.expensesDelta < 0 ? 'text-emerald-400' : whatIfCalc.expensesDelta > 0 ? 'text-red-400' : 'text-text-tertiary')}>
                {whatIfCalc.expensesDelta > 0 ? '+' : ''}{whatIfCalc.expensesDelta !== 0 ? formatCurrency(whatIfCalc.expensesDelta) : 'No change'}
              </p>
            </div>
            <div className={cn('text-center p-3 rounded-xl border', whatIfCalc.profitDelta > 0 ? 'bg-emerald-500/5 border-emerald-500/20' : whatIfCalc.profitDelta < 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-surface-primary/60 border-border/30')}>
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Left in Company</p>
              <p className={cn('text-lg font-bold', whatIfCalc.profitDelta > 0 ? 'text-emerald-400' : whatIfCalc.profitDelta < 0 ? 'text-red-400' : 'text-text-primary')}>{formatCurrency(whatIfCalc.leftInCompany)}</p>
              <p className={cn('text-[11px] font-semibold mt-0.5', whatIfCalc.profitDelta > 0 ? 'text-emerald-400' : whatIfCalc.profitDelta < 0 ? 'text-red-400' : 'text-text-tertiary')}>
                {whatIfCalc.profitDelta > 0 ? '+' : ''}{whatIfCalc.profitDelta !== 0 ? formatCurrency(whatIfCalc.profitDelta) : 'No change'}
              </p>
            </div>
          </div>

          {/* Tax detail row */}
          <div className="flex items-center justify-center gap-6 text-[10px] text-text-tertiary">
            <span>Tax: {formatCurrency(whatIfCalc.taxReserve)} ({formatPercentage(UK_CORP_TAX_RATE)})</span>
            <span>Clients: {whatIfCalc.clientCount}</span>
            <span>vs current: {whatIfCalc.profitDelta >= 0 ? '+' : ''}{formatCurrency(whatIfCalc.profitDelta)}/mo</span>
          </div>
        </div>
      )}

      {/* Mobile action bar — What-If, Record, Import (hidden on desktop where they're in the header) */}
      <div className="flex sm:hidden items-center gap-2 -mt-1">
        <button
          onClick={() => { setWhatIfMode(prev => !prev); if (whatIfMode) resetWhatIf(); }}
          className={cn(
            'px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all border cursor-pointer',
            whatIfMode
              ? 'bg-purple-500/15 text-purple-400 border-purple-500/40'
              : 'bg-surface-tertiary/40 text-text-secondary border-border/50'
          )}
        >
          {whatIfMode ? 'Exit What-If' : '🔧 What-If'}
        </button>
        <button onClick={() => setShowSnapshotModal(true)} className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium bg-surface-tertiary/40 text-text-secondary border border-border/50 cursor-pointer">
          + Record
        </button>
        <button onClick={() => setShowBankImport(true)} className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium bg-surface-tertiary/40 text-text-secondary border border-border/50 cursor-pointer">
          CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 sm:gap-1 border-b border-border overflow-x-auto scrollbar-none overscroll-x-contain touch-pan-x">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors duration-200 border-b-2 -mb-px cursor-pointer whitespace-nowrap flex-shrink-0',
              activeTab === tab.key
                ? 'text-accent border-accent'
                : 'text-text-secondary border-transparent hover:text-text-primary'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-5 stagger-in">
          {/* Top metrics */}
          {isFuture && futureProjection ? (
            <div className="space-y-3">
              {/* Projected revenue range */}
              <div className="card-surface border border-purple-500/30 rounded-2xl p-4 sm:p-5 bg-purple-500/5">
                <p className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider mb-2">Projected Revenue Range</p>
                <p className="text-2xl font-bold text-text-primary">
                  {formatCurrency(futureProjection.confirmed)} – {formatCurrency(futureProjection.total)}
                </p>
                <p className="text-[10px] text-text-tertiary mt-1">Confirmed to optimistic (incl. pipeline)</p>
              </div>

              {/* Three tier cards */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button onClick={() => setExpandedBox(expandedBox === 'revenue' ? null : 'revenue')} className={cn('card-surface border border-emerald-500/30 rounded-2xl card-hover p-3 sm:p-4 text-left transition-all cursor-pointer', expandedBox === 'revenue' ? 'ring-1 ring-emerald-500/30' : '')}>
                  <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">Confirmed</p>
                  <p className="text-lg sm:text-xl font-bold text-emerald-400">{formatCurrency(futureProjection.confirmed)}</p>
                  <p className="text-[9px] text-text-tertiary mt-1">Active clients</p>
                  <p className="text-[8px] text-emerald-400/40 mt-1.5">Tap for client list</p>
                </button>
                <button onClick={() => setExpandedBox(expandedBox === 'expenses' ? null : 'expenses')} className={cn('card-surface border border-amber-500/30 rounded-2xl card-hover p-4 text-left transition-all cursor-pointer', expandedBox === 'expenses' ? 'ring-1 ring-amber-500/30' : '')}>
                  <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">Likely</p>
                  <p className="text-xl font-bold text-amber-400">{formatCurrency(futureProjection.likely)}</p>
                  <p className="text-[9px] text-text-tertiary mt-1">Pipeline ≥60%</p>
                  <p className="text-[8px] text-amber-400/40 mt-1.5">Tap for breakdown</p>
                </button>
                <button onClick={() => setExpandedBox(expandedBox === 'possible' ? null : 'possible')} className={cn('card-surface border border-purple-500/30 rounded-2xl card-hover p-4 text-left transition-all cursor-pointer', expandedBox === 'possible' ? 'ring-1 ring-purple-500/30' : '')}>
                  <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-1">Possible</p>
                  <p className="text-xl font-bold text-purple-400">{formatCurrency(futureProjection.possible)}</p>
                  <p className="text-[9px] text-text-tertiary mt-1">Pipeline &lt;60%</p>
                  <p className="text-[8px] text-purple-400/40 mt-1.5">Tap for breakdown</p>
                </button>
              </div>

              {/* Bottom row: expenses + left in company */}
              <div className="grid grid-cols-2 gap-3">
                <div className="card-surface border border-border rounded-2xl p-4">
                  <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Est. Expenses</p>
                  <p className="text-lg font-bold text-text-secondary">{formatCurrency(effectiveExpenses)}</p>
                  <p className="text-[9px] text-text-tertiary mt-1">Carried from current</p>
                </div>
                <div className="card-surface border border-accent/30 rounded-2xl p-4 bg-accent/5">
                  <p className="text-[10px] font-semibold text-accent uppercase tracking-wider mb-1">Est. Left in Co.</p>
                  <p className="text-lg font-bold text-accent">{formatCurrency(effectiveLeftInCompany)}</p>
                  <p className="text-[9px] text-amber-400/60 mt-1">~{formatCurrency(effectiveTaxReserve)} tax</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => setExpandedBox(expandedBox === 'revenue' ? null : 'revenue')} className={cn('card-surface border rounded-2xl card-hover p-5 text-left transition-all cursor-pointer', expandedBox === 'revenue' ? 'border-accent/40 ring-1 ring-accent/20' : 'border-border')}>
                <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Revenue</p>
                <p className="text-2xl font-bold text-text-primary">{formatCurrency(monthlyRevenue)}</p>
                <p className="text-[10px] text-text-tertiary mt-1">{activeClients.length} client{activeClients.length !== 1 ? 's' : ''}</p>
              </button>
              <button onClick={() => setExpandedBox(expandedBox === 'expenses' ? null : 'expenses')} className={cn('card-surface border rounded-2xl card-hover p-5 text-left transition-all cursor-pointer', expandedBox === 'expenses' ? 'border-accent/40 ring-1 ring-accent/20' : 'border-border')}>
                <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Expenses</p>
                <p className="text-2xl font-bold text-text-secondary">{formatCurrency(monthlyExpenses)}</p>
                <p className="text-[10px] text-text-tertiary mt-1">Inc. salary & staff</p>
              </button>
              <button onClick={() => setExpandedBox(expandedBox === 'net' ? null : 'net')} className={cn('card-surface border rounded-2xl card-hover p-5 text-left transition-all cursor-pointer', expandedBox === 'net' ? 'ring-1 ring-accent/30 border-accent/40' : 'border-accent/30 bg-accent/5')}>
                <p className="text-[11px] font-semibold text-accent uppercase tracking-wider mb-1">Left in Company</p>
                <p className="text-2xl font-bold text-accent">{formatCurrency(leftInCompany)}</p>
                <p className="text-[10px] text-amber-400/60 mt-1">~{formatCurrency(taxReserve)} tax</p>
              </button>
            </div>
          )}

          {/* Metric Breakdown Panel */}
          {expandedBox && (
            <div className="p-4 rounded-xl bg-surface-tertiary/40 border border-border/50 animate-fade-in">
              {expandedBox === 'revenue' && isFuture && futureProjection ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-emerald-400">Confirmed Revenue — Active Clients</p>
                    <span className="text-[9px] text-text-tertiary">Click amount to set override</span>
                  </div>
                  {futureProjection.confirmedBreakdown.length === 0 && futureProjection.lostClients.length === 0 ? (
                    <p className="text-xs text-text-tertiary">No confirmed revenue for this month</p>
                  ) : (
                    <>
                      {futureProjection.confirmedBreakdown.map((item, i) => {
                        const isEditingThis = item.clientId && editingOverrideClientId === item.clientId;
                        return (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={cn('text-xs', item.isLost ? 'text-red-400' : 'text-text-secondary')}>{item.name}</span>
                            {item.note && (
                              <span className={cn(
                                'text-[9px] px-1.5 py-0.5 rounded-md font-medium',
                                item.isLost ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
                              )}>{item.note}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isEditingThis ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-text-tertiary">£</span>
                                <input
                                  type="number"
                                  value={overrideEditAmount}
                                  onChange={(e) => setOverrideEditAmount(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && item.clientId) {
                                      const val = Number(overrideEditAmount);
                                      const cid = item.clientId!;
                                      setEditingOverrideClientId(null);
                                      setOverrideEditAmount('');
                                      if (val === (item.baseRetainer || 0)) {
                                        // Same as base — remove override for this month
                                        setLocalOverrides(prev => ({ ...prev, [cid]: null }));
                                        getClientOverridesForClient(cid)
                                          .then(overridesForClient => {
                                            const match = overridesForClient.find((o: ClientMonthlyOverride) => o.month === currentMonth.slice(0, 7));
                                            if (match) return deleteClientOverride(match.id);
                                          })
                                          .catch(err => console.error('Override delete failed:', err));
                                      } else {
                                        // Optimistic update + fire-and-forget upsert
                                        setLocalOverrides(prev => ({ ...prev, [cid]: val }));
                                        upsertClientOverride(cid, currentMonth, val).catch(err => console.error('Override save failed:', err));
                                      }
                                    } else if (e.key === 'Escape') {
                                      setEditingOverrideClientId(null);
                                      setOverrideEditAmount('');
                                    }
                                  }}
                                  className="w-20 text-xs bg-surface-secondary border border-accent/40 rounded-lg px-2 py-0.5 text-text-primary outline-none focus:ring-1 focus:ring-accent/20 font-mono"
                                  autoFocus
                                />
                                <button
                                  onClick={() => { setEditingOverrideClientId(null); setOverrideEditAmount(''); }}
                                  className="text-[10px] text-text-tertiary hover:text-text-secondary"
                                >✕</button>
                              </div>
                            ) : item.clientId && !item.isLost ? (
                              <button
                                onClick={() => { setEditingOverrideClientId(item.clientId!); setOverrideEditAmount(String(item.amount)); }}
                                className={cn('text-xs font-mono hover:text-accent transition-colors cursor-pointer', item.isLost ? 'text-red-400' : 'text-emerald-400')}
                                title="Click to set override for this month"
                              >
                                {formatCurrency(item.amount)}
                              </button>
                            ) : (
                              <span className={cn('text-xs font-mono', item.isLost ? 'text-red-400' : 'text-emerald-400')}>{formatCurrency(item.amount)}</span>
                            )}
                          </div>
                        </div>
                        );
                      })}
                      {futureProjection.lostClients.length > 0 && (
                        <div className="pt-2 mt-2 border-t border-red-500/20">
                          <p className="text-[10px] font-semibold text-red-400 mb-2">Lost by This Month</p>
                          {futureProjection.lostClients.map((lc, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-red-400 line-through">{lc.name}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400 font-medium">{lc.reason}</span>
                              </div>
                              <span className="text-xs font-mono text-red-400/60 line-through">{formatCurrency(lc.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {futureProjection.upcomingClients && futureProjection.upcomingClients.length > 0 && (
                        <div className="pt-2 mt-2 border-t border-blue-500/20">
                          <p className="text-[10px] font-semibold text-blue-400 mb-2">Starting After This Month</p>
                          {futureProjection.upcomingClients.map((uc, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-blue-400">{uc.name}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-400 font-medium">
                                  Starts {new Date(uc.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <span className="text-xs font-mono text-blue-400/60">{formatCurrency(uc.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : expandedBox === 'revenue' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-text-primary">Monthly Revenue Breakdown</p>
                    <span className="text-[9px] text-text-tertiary">Click amount to adjust for this month</span>
                  </div>
                  {activeClients.length === 0 ? (
                    <p className="text-xs text-text-tertiary">No active clients</p>
                  ) : (
                    activeClients.map(c => {
                      const hasOverride = overrideMap[c.id] !== undefined;
                      const amount = getClientMonthlyAmount(c);
                      const isEditingThis = editingOverrideClientId === c.id;
                      return (
                        <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary">{c.name}</span>
                            {hasOverride && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-medium">override</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isEditingThis ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-text-tertiary">£</span>
                                <input
                                  type="number"
                                  value={overrideEditAmount}
                                  onChange={(e) => setOverrideEditAmount(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = Number(overrideEditAmount);
                                      setEditingOverrideClientId(null);
                                      setOverrideEditAmount('');
                                      setOverrideError(null);
                                      if (val === (c.retainer_amount || 0)) {
                                        // Same as base retainer — remove override
                                        setLocalOverrides(prev => ({ ...prev, [c.id]: null }));
                                        if (hasOverride) {
                                          getClientOverridesForClient(c.id)
                                            .then(overridesForClient => {
                                              const match = overridesForClient.find((o: ClientMonthlyOverride) => o.month === currentMonth.slice(0, 7));
                                              if (match) return deleteClientOverride(match.id);
                                            })
                                            .catch((err: unknown) => {
                                              const msg = err instanceof Error ? err.message : 'Failed to remove override';
                                              setOverrideError(msg);
                                            });
                                        }
                                      } else {
                                        // Optimistic update + fire-and-forget upsert
                                        setLocalOverrides(prev => ({ ...prev, [c.id]: val }));
                                        upsertClientOverride(c.id, currentMonth, val).catch((err: unknown) => {
                                          const msg = err instanceof Error ? err.message : 'Failed to save override';
                                          setOverrideError(msg);
                                        });
                                      }
                                    } else if (e.key === 'Escape') {
                                      setEditingOverrideClientId(null);
                                      setOverrideEditAmount('');
                                    }
                                  }}
                                  className="w-20 text-xs bg-surface-secondary border border-accent/40 rounded-lg px-2 py-0.5 text-text-primary outline-none focus:ring-1 focus:ring-accent/20 font-mono"
                                  autoFocus
                                />
                                <button
                                  onClick={() => {
                                    const val = Number(overrideEditAmount);
                                    setEditingOverrideClientId(null);
                                    setOverrideEditAmount('');
                                    setOverrideError(null);
                                    if (val === (c.retainer_amount || 0)) {
                                      setLocalOverrides(prev => ({ ...prev, [c.id]: null }));
                                      if (hasOverride) {
                                        getClientOverridesForClient(c.id)
                                          .then(overridesForClient => {
                                            const match = overridesForClient.find((o: ClientMonthlyOverride) => o.month === currentMonth.slice(0, 7));
                                            if (match) return deleteClientOverride(match.id);
                                          })
                                          .catch((err: unknown) => {
                                            const msg = err instanceof Error ? err.message : 'Failed to remove override';
                                            setOverrideError(msg);
                                          });
                                      }
                                    } else {
                                      setLocalOverrides(prev => ({ ...prev, [c.id]: val }));
                                      upsertClientOverride(c.id, currentMonth, val).catch((err: unknown) => {
                                        const msg = err instanceof Error ? err.message : 'Failed to save override';
                                        setOverrideError(msg);
                                      });
                                    }
                                  }}
                                  className="text-[10px] text-accent hover:text-accent/80 font-medium cursor-pointer"
                                >Save</button>
                                <button
                                  onClick={() => { setEditingOverrideClientId(null); setOverrideEditAmount(''); }}
                                  className="text-[10px] text-text-tertiary hover:text-text-secondary cursor-pointer"
                                >✕</button>
                              </div>
                            ) : (
                              <>
                                {hasOverride && (
                                  <span className="text-[10px] text-text-tertiary line-through">{formatCurrency(c.retainer_amount || 0)}</span>
                                )}
                                <button
                                  onClick={() => { setEditingOverrideClientId(c.id); setOverrideEditAmount(String(amount)); }}
                                  className="text-xs font-mono text-text-primary hover:text-accent transition-colors cursor-pointer"
                                  title="Click to set override for this month"
                                >
                                  {formatCurrency(amount)}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {!isCurrent && !isFuture && snapshot?.total_revenue ? (
                    <p className="text-[10px] text-text-tertiary mt-2 pt-2 border-t border-border/30">Using recorded snapshot data for this month</p>
                  ) : null}
                </div>
              )}
              {expandedBox === 'expenses' && isFuture && futureProjection ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-amber-400 mb-2">Likely Revenue — Pipeline ≥60% Probability</p>
                  {futureProjection.likelyBreakdown.length === 0 ? (
                    <p className="text-xs text-text-tertiary">No likely pipeline leads</p>
                  ) : (
                    futureProjection.likelyBreakdown.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-secondary">{item.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-medium">{item.probability}%</span>
                        </div>
                        <span className="text-xs font-mono text-amber-400">{formatCurrency(item.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : expandedBox === 'expenses' && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-text-primary mb-3">Monthly Expenses Breakdown</p>
                  {businessExpensesList.length === 0 && monthlySalary === 0 && staffCost === 0 ? (
                    <p className="text-xs text-text-tertiary">No expenses recorded for this month</p>
                  ) : (
                    <>
                      {Object.entries(
                        businessExpensesList.reduce<Record<string, number>>((acc, e) => {
                          acc[e.category] = (acc[e.category] || 0) + e.amount;
                          return acc;
                        }, {})
                      ).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
                        <div key={cat} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                          <span className="text-xs text-text-secondary capitalize">{cat}</span>
                          <span className="text-xs font-mono text-text-primary">{formatCurrency(total)}</span>
                        </div>
                      ))}
                      {monthlySalary > 0 && (
                        <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-text-secondary">Director salary</span>
                            {salaryExceedsAllowance && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">Over £{(UK_PERSONAL_ALLOWANCE / 1000).toFixed(1)}k</span>
                            )}
                          </div>
                          <span className="text-xs font-mono text-text-primary">{formatCurrency(monthlySalary)}</span>
                        </div>
                      )}
                      {staffCost > 0 && (
                        <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                          <span className="text-xs text-text-secondary">Staff / contractors</span>
                          <span className="text-xs font-mono text-text-primary">{formatCurrency(staffCost)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between py-1.5 mt-1 pt-2 border-t border-border/40">
                        <span className="text-xs font-semibold text-text-primary">Total</span>
                        <span className="text-xs font-mono font-semibold text-text-primary">{formatCurrency(monthlyExpenses)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
              {expandedBox === 'possible' && isFuture && futureProjection && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-purple-400 mb-2">Possible Revenue — Pipeline &lt;60%</p>
                  {futureProjection.possibleBreakdown.length === 0 ? (
                    <p className="text-xs text-text-tertiary">No possible pipeline leads</p>
                  ) : (
                    futureProjection.possibleBreakdown.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-secondary">{item.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-400 font-medium">{item.probability}%</span>
                        </div>
                        <span className="text-xs font-mono text-purple-400">{formatCurrency(item.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
              {expandedBox === 'net' && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-text-primary mb-3">Left in Company</p>
                  <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                    <span className="text-xs text-text-secondary">Revenue</span>
                    <span className="text-xs font-mono text-text-primary">{formatCurrency(monthlyRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                    <span className="text-xs text-red-400">− Expenses</span>
                    <span className="text-xs font-mono text-red-400">{formatCurrency(monthlyExpenses)}</span>
                  </div>
                  {(monthlySalary > 0 || staffCost > 0) && (
                    <p className="text-[9px] text-text-tertiary -mt-1 mb-1 pl-3">
                      Inc. {monthlySalary > 0 ? `${formatCurrency(monthlySalary)} salary` : ''}{monthlySalary > 0 && staffCost > 0 ? ', ' : ''}{staffCost > 0 ? `${formatCurrency(staffCost)} staff` : ''}
                    </p>
                  )}
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-xs font-semibold text-accent">= Left in company</span>
                    <span className="text-xs font-mono font-semibold text-accent">{formatCurrency(leftInCompany)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 mt-1 pt-2 border-t border-border/20">
                    <span className="text-[10px] text-amber-400/70">Est. corp tax (19%, year-end)</span>
                    <span className="text-[10px] font-mono text-amber-400/70">{formatCurrency(taxReserve)}</span>
                  </div>
                  {monthlySalary > 0 && salaryExceedsAllowance && (
                    <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 mt-2">
                      <p className="text-[10px] text-red-400">
                        Salary ({formatCurrency(annualSalaryProjected)}/yr) exceeds £{(UK_PERSONAL_ALLOWANCE / 1000).toFixed(1)}k allowance by {formatCurrency(salaryExcess)}. Excess is taxed as income — pay as dividends instead.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Override save error */}
          {overrideError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between animate-fade-in">
              <p className="text-xs text-red-400">{overrideError}</p>
              <button onClick={() => setOverrideError(null)} className="text-[10px] text-red-400 hover:text-red-300 ml-3">✕</button>
            </div>
          )}

          {/* Stability + Pipeline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <section className="card-surface border border-border rounded-2xl card-hover p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-5 rounded-full bg-blue-500" />
                <h2 className="text-sm font-bold text-text-primary">Revenue Stability</h2>
                <InfoBox title="Revenue Stability">
                  <p>Measures client diversification (Herfindahl index) weighted by renewal probability and client count.</p>
                  <p className="mt-1">Higher = more stable. Low score means revenue is concentrated in few clients.</p>
                </InfoBox>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-text-primary">{stabilityScore}</div>
                <div className="flex-1">
                  <div className="w-full h-2 bg-surface-tertiary rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full progress-fill', stabilityScore >= 70 ? 'bg-accent' : stabilityScore >= 40 ? 'bg-amber-400' : 'bg-red-400')}
                      style={{ width: `${stabilityScore}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-text-tertiary mt-1.5">
                    {stabilityScore >= 70 ? 'Healthy diversification' : stabilityScore >= 40 ? 'Moderate concentration risk' : 'High concentration risk'}
                  </p>
                </div>
              </div>
              {/* Auto insights */}
              {stabilityInsights.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/50 space-y-1.5">
                  {stabilityInsights.map((insight, i) => {
                    // Pick contextual icon + color based on insight content
                    let icon = '→';
                    let iconColor = 'text-accent';
                    if (insight.includes('concentration risk') || insight.includes('at risk') || insight.includes('ending')) {
                      icon = '⚠';
                      iconColor = 'text-amber-400';
                    } else if (insight.includes('low') || insight.includes('<50%') || insight.includes('focus on retention')) {
                      icon = '↓';
                      iconColor = 'text-red-400';
                    } else if (insight.includes('expiring')) {
                      icon = '⏳';
                      iconColor = 'text-amber-400';
                    } else if (insight.includes('good diversification') || insight.includes('strong')) {
                      icon = '✓';
                      iconColor = 'text-emerald-400';
                    } else if (insight.includes('Adding more') || insight.includes('Only')) {
                      icon = '!';
                      iconColor = 'text-amber-400';
                    } else if (insight.includes('largest client')) {
                      icon = '◉';
                      iconColor = 'text-blue-400';
                    }
                    return (
                      <p key={i} className="text-[11px] text-text-secondary flex items-start gap-2">
                        <span className={cn('mt-0.5 shrink-0 text-[10px]', iconColor)}>{icon}</span>
                        {insight}
                      </p>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="card-surface border border-border rounded-2xl card-hover p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-5 rounded-full bg-purple-500" />
                <h2 className="text-sm font-bold text-text-primary">Pipeline</h2>
                <InfoBox title="Pipeline Value">
                  <p>Total estimated value of all active pipeline leads (not yet closed or lost).</p>
                  <p className="mt-1">Go to the Pipeline tab to manage leads and set probability for each.</p>
                </InfoBox>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-text-primary">{formatCurrency(pipelineRevenue)}</div>
              </div>
              <p className="text-[10px] text-text-tertiary mt-2">
                {pipelineLeads.filter(l => l.stage !== 'lost' && l.stage !== 'closed').length} active leads in pipeline
              </p>
              {pipelineLeads.filter(l => l.stage === 'proposal_sent').length > 0 && (
                <p className="text-[10px] text-amber-400 mt-1">
                  {pipelineLeads.filter(l => l.stage === 'proposal_sent').length} proposals awaiting response
                </p>
              )}
            </section>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="card-surface border border-border rounded-2xl card-hover p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-5 rounded-full bg-accent" />
                <h2 className="text-sm font-bold text-text-primary">Income Over Time</h2>
                <InfoBox title="Income Over Time">
                  <p>Historical monthly revenue and expenses from your financial snapshots.</p>
                  <p className="mt-1">Add monthly records via the Forecast tab to build this history.</p>
                </InfoBox>
              </div>
              <IncomeChart snapshots={history} currentMonthRevenue={isCurrent ? liveRevenue : undefined} currentMonthExpenses={isCurrent ? liveExpenses : undefined} />
            </section>
            <section className="card-surface border border-border rounded-2xl card-hover p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-5 rounded-full bg-cyan-500" />
                <h2 className="text-sm font-bold text-text-primary">Revenue by Client</h2>
                <InfoBox title="Revenue by Client">
                  <p>Visual breakdown of how your monthly revenue is split across active clients.</p>
                  <p className="mt-1">Large slices indicate concentration risk — aim for balanced distribution.</p>
                </InfoBox>
              </div>
              <EarningsByClient clients={clients.map(c => overrideMap[c.id] !== undefined ? { ...c, retainer_amount: overrideMap[c.id] } : c)} />
            </section>
          </div>

          {/* Insights & Recommendations */}
          {insights.length > 0 && (
            <section className="card-surface border border-border rounded-2xl card-hover p-6 space-y-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-1 h-5 rounded-full bg-amber-500" />
                <h2 className="text-sm font-bold text-text-primary">Insights & Recommendations</h2>
                <InfoBox title="Insights">
                  <p>Auto-generated observations based on your client data, contracts, and revenue patterns.</p>
                  <p className="mt-1">Colour-coded by severity: green = positive, amber = warning, red = action needed.</p>
                </InfoBox>
              </div>
              <InsightCards insights={insights} />
            </section>
          )}

          {/* Mental Energy Per Client */}
          {clientEnergyProfiles.length > 0 && clientEnergyProfiles.some(p => p.totalMLU > 0) && (
            <section className="card-surface border border-border rounded-2xl card-hover p-6 space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-1 h-5 rounded-full bg-purple-500" />
                <h2 className="text-sm font-bold text-text-primary">Mental Energy Per Client</h2>
                <InfoBox title="Mental Energy">
                  <p>Shows how much cognitive energy (MLU) each client demands relative to what they pay.</p>
                  <p className="mt-1">Higher £/MLU = better return on your mental investment.</p>
                </InfoBox>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-text-tertiary font-medium">Client</th>
                      <th className="text-right py-2 text-text-tertiary font-medium">Revenue</th>
                      <th className="text-right py-2 text-text-tertiary font-medium">MLU</th>
                      <th className="text-center py-2 text-text-tertiary font-medium">Energy Mix</th>
                      <th className="text-right py-2 text-text-tertiary font-medium">£/MLU</th>
                      <th className="text-right py-2 text-text-tertiary font-medium">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientEnergyProfiles.filter(p => p.totalMLU > 0).map((profile) => {
                      const totalMix = profile.energyMix.creative + profile.energyMix.admin;
                      const creativePct = totalMix > 0 ? (profile.energyMix.creative / totalMix) * 100 : 0;
                      const adminPct = totalMix > 0 ? (profile.energyMix.admin / totalMix) * 100 : 0;
                      return (
                        <tr key={profile.clientId} className="border-b border-border/50 hover:bg-surface-tertiary/30 transition-colors">
                          <td className="py-2.5 text-text-primary font-medium">{profile.name}</td>
                          <td className="py-2.5 text-right text-text-secondary">{formatCurrency(profile.monthlyRevenue)}/mo</td>
                          <td className="py-2.5 text-right text-text-secondary">{profile.totalMLU}</td>
                          <td className="py-2.5">
                            <div className="flex items-center justify-center">
                              <div className="w-16 h-2 rounded-full overflow-hidden bg-surface-tertiary flex">
                                <div className="h-full bg-purple-400" style={{ width: `${creativePct}%` }} title={`Creative: ${Math.round(creativePct)}%`} />
                                <div className="h-full bg-gray-500" style={{ width: `${adminPct}%` }} title={`Admin: ${Math.round(adminPct)}%`} />
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 text-right font-mono text-text-primary">£{profile.revenuePerMLU.toFixed(2)}</td>
                          <td className="py-2.5 text-right">
                            <span className={cn(
                              'px-2 py-0.5 rounded-md text-[10px] font-medium',
                              profile.revenuePerMLU > 5 ? 'bg-emerald-500/15 text-emerald-400' :
                              profile.revenuePerMLU > 2 ? 'bg-amber-500/15 text-amber-400' :
                              'bg-red-500/15 text-red-400'
                            )}>
                              {profile.revenuePerMLU > 5 ? 'Efficient' : profile.revenuePerMLU > 2 ? 'Average' : 'Draining'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-text-tertiary pt-1">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-purple-400" /><span>Creative</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-gray-500" /><span>Admin</span></div>
              </div>
            </section>
          )}

          {/* Savings Goals */}
          <SavingsGoalsSection goals={savingsGoals} leftInCompany={leftInCompany} />
        </div>
      )}

      {/* FORECAST TAB */}
      {activeTab === 'forecast' && (
        <ForecastTab
          monthlyRevenue={monthlyRevenue}
          monthlyExpenses={monthlyExpenses}
          leftInCompany={leftInCompany}
          pipelineRevenue={pipelineRevenue}
          pipelineLeads={pipelineLeads}
          history={history}
          activeClients={allActiveClients}
          snapshot={snapshot}
          overrideMap={overrideMap}
          liveExpenses={liveExpenses}
          currentMonth={currentMonth}
        />
      )}

      {/* CLIENTS TAB */}
      {activeTab === 'clients' && (
        <ClientsTab
          clients={clients}
          monthlyRevenue={monthlyRevenue}
          overrideMap={overrideMap}
          currentMonth={currentMonth}
          onAddClient={() => setShowClientModal(true)}
          onDeleteClient={(id) => {
            deleteClient(id).catch(e => console.error('Failed to delete client:', e));
          }}
        />
      )}

      {/* EXPENSES TAB */}
      {activeTab === 'expenses' && (
        <ExpensesTab
          expenses={expenses}
          monthLabel={getMonthLabel(currentMonth)}
          isCurrent={isCurrent}
          onAddExpense={() => setShowExpenseModal(true)}
          onEditExpense={(expense) => setEditingExpense(expense)}
          onDeleteExpense={(id) => {
            deleteExpense(id).catch(e => console.error('Failed to delete expense:', e));
          }}
          monthlySalary={monthlySalary}
          staffCost={staffCost}
        />
      )}

      {/* PERSONAL FINANCE TAB */}
      {activeTab === 'personal' && (() => {
        // ── Actual this-month numbers ──
        const dividendPaid = Number(snapshot?.dividend_paid) || 0;
        const salary = monthlySalary;
        const grossPersonalIncome = dividendPaid + salary;
        const taxableDividends = Math.max(0, dividendPaid - UK_DIVIDEND_ALLOWANCE / 12); // monthly allowance share
        const dividendTaxActual = taxableDividends * UK_DIVIDEND_TAX_RATE;
        const personalExpTotal = livePersonalExpenses;
        const personalNet = grossPersonalIncome - dividendTaxActual - personalExpTotal;

        // ── Tax-Efficient Strategy (annual projection) ──
        // monthlyExpenses already includes salary + staffCost (via totalBusinessCosts)
        const annualRevenue = monthlyRevenue * 12;
        const annualCosts = monthlyExpenses * 12; // includes salary + staff costs
        const annualProfit = Math.max(0, annualRevenue - annualCosts); // profit AFTER salary

        // Director salary already included in costs — use actual salary for display
        const annualSalary = monthlySalary * 12;

        // Corp tax on profit (salary already deducted via monthlyExpenses)
        const corpTax = annualProfit * UK_CORP_TAX_RATE;
        const distributableProfit = annualProfit - corpTax;

        // Dividend tax: basic vs higher rate bands
        // Total income = salary + dividends — determines which band dividends fall in
        const basicRateSpace = Math.max(0, UK_BASIC_RATE_LIMIT - annualSalary);
        const dividendsInBasicRate = Math.min(distributableProfit, basicRateSpace);
        const dividendsInHigherRate = Math.max(0, distributableProfit - dividendsInBasicRate);
        const maxDividend = distributableProfit;
        const taxableDividendOpt = Math.max(0, maxDividend - UK_DIVIDEND_ALLOWANCE);
        const taxableBasic = Math.min(taxableDividendOpt, Math.max(0, dividendsInBasicRate - UK_DIVIDEND_ALLOWANCE));
        const taxableHigher = Math.max(0, taxableDividendOpt - taxableBasic);
        const dividendTaxOpt = taxableBasic * UK_DIVIDEND_TAX_RATE + taxableHigher * UK_HIGHER_DIVIDEND_RATE;
        const inHigherRate = dividendsInHigherRate > 0;

        // Total personal tax (at optimal salary of £9,100: zero income tax, zero NI)
        const personalTaxTotal = dividendTaxOpt;
        const netTakeHome = annualSalary + maxDividend - personalTaxTotal;
        const effectiveRate = (annualRevenue - (annualCosts - annualSalary)) > 0
          ? ((personalTaxTotal + corpTax) / (annualRevenue - (annualCosts - annualSalary)) * 100)
          : 0;

        return (
          <div className="space-y-5 stagger-in">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Personal Finance</h3>
              <p className="text-xs text-text-tertiary mt-0.5">What you take home from the business</p>
            </div>

            {/* ━━━ This Month — what you actually took ━━━ */}
            <div className="card-surface border border-accent/30 rounded-2xl p-4 sm:p-5 bg-accent/5">
              <h4 className="text-xs uppercase tracking-wider text-accent font-medium mb-3">This Month — Actuals</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Salary</span>
                  <span className="text-text-primary font-medium">{formatCurrency(salary)}</span>
                </div>
                {dividendPaid > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Dividends</span>
                    <span className="text-text-primary font-medium">{formatCurrency(dividendPaid)}</span>
                  </div>
                )}
                {dividendTaxActual > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Dividend tax (8.75%)</span>
                    <span className="text-amber-400">-{formatCurrency(dividendTaxActual)}</span>
                  </div>
                )}
                {personalExpTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Personal expenses</span>
                    <span className="text-red-400">-{formatCurrency(personalExpTotal)}</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between text-base font-bold">
                  <span className="text-text-primary">Net personal</span>
                  <span className={personalNet >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(personalNet)}</span>
                </div>
              </div>
              {salary === 0 && dividendPaid === 0 && (
                <p className="text-[10px] text-text-tertiary mt-2">Set salary in Expenses tab. Log dividends in Monthly Record.</p>
              )}
            </div>

            {/* ━━━ Annual business overview (synced with Overview tab) ━━━ */}
            <div className="card-surface border border-border rounded-2xl p-4 sm:p-5 space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-text-tertiary font-medium mb-2">Annual Business Summary</h4>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Revenue</span>
                <span className="text-text-primary font-mono">{formatCurrency(annualRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">All costs{monthlySalary > 0 || staffCost > 0 ? ' (inc. salary & staff)' : ''}</span>
                <span className="text-red-400 font-mono">-{formatCurrency(annualCosts)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Corp tax (19%)</span>
                <span className="text-amber-400 font-mono">-{formatCurrency(annualProfit * UK_CORP_TAX_RATE)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
                <span className="text-text-primary">Left in company</span>
                <span className="text-accent font-mono">{formatCurrency(annualProfit - annualProfit * UK_CORP_TAX_RATE)}</span>
              </div>
              <p className="text-[10px] text-text-tertiary pt-1">Based on {formatCurrency(monthlyRevenue)}/mo revenue, {formatCurrency(monthlyExpenses)}/mo costs</p>
            </div>

            {/* ━━━ Tax-Efficient Strategy ━━━ */}
            {annualProfit > 0 && (
              <div className="card-surface border border-blue-500/30 rounded-2xl overflow-hidden bg-blue-500/5">
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs uppercase tracking-wider text-blue-400 font-medium">Optimal Extraction</h4>
                    <span className="text-[9px] text-text-tertiary bg-surface-tertiary/50 px-2 py-0.5 rounded-full">Recommendation</span>
                  </div>

                  {/* Simple 3-row summary */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Salary</span>
                      <span className="text-text-primary font-mono">{formatCurrency(annualSalary)}<span className="text-text-tertiary text-[10px]">/yr</span></span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Dividends (max available)</span>
                      <span className="text-text-primary font-mono">{formatCurrency(maxDividend)}<span className="text-text-tertiary text-[10px]">/yr</span></span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Dividend tax</span>
                      <span className="text-amber-400 font-mono">-{formatCurrency(dividendTaxOpt)}<span className="text-text-tertiary text-[10px]">/yr</span></span>
                    </div>
                    <div className="border-t border-blue-500/20 pt-2 flex justify-between text-base font-bold">
                      <span className="text-text-primary">Take-home</span>
                      <span className="text-green-400 font-mono">{formatCurrency(netTakeHome)}<span className="text-xs text-text-tertiary font-normal">/yr</span></span>
                    </div>
                    <div className="flex justify-between text-xs text-text-tertiary">
                      <span>Monthly</span>
                      <span className="font-mono">{formatCurrency(netTakeHome / 12)}/mo</span>
                    </div>
                    <div className="flex justify-between text-xs text-text-tertiary">
                      <span>Effective rate (all taxes)</span>
                      <span className="font-mono">{effectiveRate.toFixed(1)}%</span>
                    </div>
                  </div>

                  {inHigherRate && (
                    <p className="text-[11px] text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                      {formatCurrency(dividendsInHigherRate)} of dividends falls in the higher rate band (33.75%). You could leave some in the company to stay under {formatCurrency(UK_BASIC_RATE_LIMIT)}.
                    </p>
                  )}
                </div>

                {/* Expandable detail */}
                <button
                  onClick={() => setShowTaxDetail(!showTaxDetail)}
                  className="w-full px-5 py-2.5 border-t border-blue-500/20 flex items-center justify-center gap-2 text-[11px] text-blue-400 hover:bg-blue-500/5 transition-colors cursor-pointer"
                >
                  <svg className={cn('w-3 h-3 transition-transform', showTaxDetail && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  {showTaxDetail ? 'Hide' : 'How this works'}
                </button>

                {showTaxDetail && (
                  <div className="px-5 pb-5 space-y-3 border-t border-blue-500/10 pt-4 animate-fade-in text-[11px]">
                    <div className="space-y-1.5">
                      <p className="text-text-tertiary font-medium uppercase tracking-wider text-[10px]">Salary</p>
                      <p className="text-text-secondary">{formatCurrency(annualSalary)}/yr — deducted as a business cost before corp tax.{annualSalary <= UK_NI_SECONDARY_THRESHOLD ? ' Below the NI threshold: zero income tax, zero NI.' : ''}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-text-tertiary font-medium uppercase tracking-wider text-[10px]">Corporation Tax</p>
                      <p className="text-text-secondary">Profit after all costs: {formatCurrency(annualProfit)}, taxed at 19% = {formatCurrency(corpTax)}. Leaves {formatCurrency(distributableProfit)} for dividends.</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-text-tertiary font-medium uppercase tracking-wider text-[10px]">Dividends</p>
                      <p className="text-text-secondary">First {formatCurrency(UK_DIVIDEND_ALLOWANCE)} tax-free. Basic rate 8.75% up to {formatCurrency(UK_BASIC_RATE_LIMIT)} total income.{inHigherRate ? ` Higher rate 33.75% on the rest.` : ''}</p>
                    </div>
                    <div className="space-y-1 border-t border-border/30 pt-3">
                      <p className="text-text-tertiary font-medium uppercase tracking-wider text-[10px]">Tax Summary</p>
                      <div className="flex justify-between"><span className="text-text-secondary">Corp tax (company pays)</span><span className="font-mono text-text-primary">{formatCurrency(corpTax)}</span></div>
                      <div className="flex justify-between"><span className="text-text-secondary">Dividend tax (you pay)</span><span className="font-mono text-text-primary">{formatCurrency(dividendTaxOpt)}</span></div>
                      <div className="flex justify-between font-semibold"><span className="text-text-primary">Total tax</span><span className="font-mono text-amber-400">{formatCurrency(corpTax + dividendTaxOpt)}</span></div>
                      <p className="text-text-tertiary mt-1">A PAYE employee earning {formatCurrency(netTakeHome)} would pay ~25-35% in tax + NI.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Personal expenses detail */}
            {personalExpensesList.length > 0 && (
              <div className="card-surface border border-border rounded-2xl p-4 sm:p-5 space-y-2">
                <h4 className="text-xs uppercase tracking-wider text-purple-400 font-medium mb-1">Personal Expenses</h4>
                {personalExpensesList.map(e => (
                  <div key={e.id} className="flex justify-between text-sm">
                    <span className="text-text-secondary">{e.description}</span>
                    <span className="text-text-primary">{formatCurrency(e.amount, true)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
                  <span className="text-text-primary">Total</span>
                  <span className="text-red-400">{formatCurrency(personalExpTotal)}</span>
                </div>
              </div>
            )}

            <p className="text-[10px] text-text-tertiary">
              Salary &amp; staff costs: Expenses tab. Dividends: Monthly Record. Rates: UK 2024/25.
            </p>
          </div>
        );
      })()}

      {/* FINANCIAL YEAR TAB */}
      {activeTab === 'year' && (() => {
        // UK Financial Year: 6 April → 5 April
        const now = new Date();
        const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // April = month 3
        const fyStart = `${fyStartYear}-04-01`;
        const fyEnd = `${fyStartYear + 1}-03-31`;
        const fyLabel = `${fyStartYear}/${String(fyStartYear + 1).slice(-2)}`;

        // Build monthly data from history snapshots within this FY
        const fySnapshots = history
          .filter(s => s.month >= fyStart && s.month <= fyEnd)
          .sort((a, b) => a.month.localeCompare(b.month));

        // If current month is in FY and no snapshot, use live data
        const currentMonthKey = currentMonth.slice(0, 7);
        const fyCurrentKey = formatLocalMonth(now).slice(0, 7);
        const hasCurrentSnap = fySnapshots.some(s => s.month.slice(0, 7) === fyCurrentKey);

        const allMonths: { month: string; label: string; revenue: number; expenses: number; tax: number; net: number; isLive: boolean; hasOverride: boolean }[] = [];

        // Fill months from FY start to current month
        const cursor = new Date(fyStart + 'T12:00:00');
        const endDate = new Date(Math.min(now.getTime(), new Date(fyEnd + 'T12:00:00').getTime()));

        while (cursor <= endDate) {
          const monthKey = formatLocalMonth(cursor);
          const monthKeyShort = monthKey.slice(0, 7);
          const snap = fySnapshots.find(s => s.month.slice(0, 7) === monthKeyShort);
          const isCurrentLive = monthKeyShort === currentMonthKey.slice(0, 7) && !hasCurrentSnap;

          const baseRev = isCurrentLive ? monthlyRevenue : (Number(snap?.total_revenue) || 0);
          const baseExp = isCurrentLive ? monthlyExpenses : (Number(snap?.total_expenses) || 0);

          // Apply FY overrides if set
          const override = fyOverrides[monthKeyShort];
          const rev = override?.revenue !== undefined ? override.revenue : baseRev;
          const exp = override?.expenses !== undefined ? override.expenses : baseExp;
          const tax = Math.max(0, rev - exp) * UK_CORP_TAX_RATE;
          const hasOverride = override?.revenue !== undefined || override?.expenses !== undefined;

          allMonths.push({
            month: monthKey,
            label: cursor.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
            revenue: rev,
            expenses: exp,
            tax: tax,
            net: Math.max(0, rev - exp), // left in company (before tax)
            isLive: isCurrentLive,
            hasOverride,
          });

          cursor.setMonth(cursor.getMonth() + 1);
        }

        const ytdRevenue = allMonths.reduce((s, m) => s + m.revenue, 0);
        const ytdExpenses = allMonths.reduce((s, m) => s + m.expenses, 0);
        const ytdTax = allMonths.reduce((s, m) => s + m.tax, 0);
        const ytdNet = Math.max(0, ytdRevenue - ytdExpenses); // left in company (before tax)
        const ytdDividends = fySnapshots.reduce((s, snap) => s + (Number(snap.dividend_paid) || 0), 0);
        const monthsElapsed = allMonths.length;
        const avgMonthlyRevenue = monthsElapsed > 0 ? ytdRevenue / monthsElapsed : 0;
        const projectedAnnualRevenue = avgMonthlyRevenue * 12;

        return (
          <div className="space-y-5">
            {/* FY Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-text-primary">
                  Financial Year {fyLabel}
                </h2>
                <p className="text-xs text-text-tertiary mt-0.5">
                  6 April {fyStartYear} — 5 April {fyStartYear + 1} ({monthsElapsed} months elapsed)
                </p>
              </div>
            </div>

            {/* YTD Summary Cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="card-surface border border-accent/20 rounded-xl p-3 sm:p-4 bg-accent/5">
                <p className="text-[9px] text-accent uppercase tracking-wider font-medium">YTD Revenue</p>
                <p className="text-lg sm:text-xl font-bold text-accent mt-1">{formatCurrency(ytdRevenue)}</p>
              </div>
              <div className="card-surface border border-border rounded-xl p-3 sm:p-4">
                <p className="text-[9px] text-text-tertiary uppercase tracking-wider font-medium">YTD Expenses</p>
                <p className="text-lg sm:text-xl font-bold text-text-secondary mt-1">{formatCurrency(ytdExpenses)}</p>
              </div>
              <div className={cn('card-surface border rounded-xl p-3 sm:p-4', ytdNet > 0 ? 'border-accent/30 bg-accent/5' : 'border-red-500/20 bg-red-500/5')}>
                <p className={cn('text-[9px] uppercase tracking-wider font-medium', ytdNet > 0 ? 'text-accent' : 'text-red-400')}>Left in Company</p>
                <p className={cn('text-lg sm:text-xl font-bold mt-1', ytdNet > 0 ? 'text-accent' : 'text-red-400')}>{formatCurrency(ytdNet)}</p>
                <p className="text-[8px] text-amber-400/60 mt-0.5">~{formatCurrency(ytdTax)} tax</p>
              </div>
            </div>

            {/* Projection bar */}
            <div className={cn('card-surface border rounded-xl p-4 sm:p-5', Object.keys(fyOverrides).length > 0 ? 'border-blue-500/30' : 'border-border')}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-text-secondary">Annual Projection</p>
                  {Object.keys(fyOverrides).length > 0 && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold">WITH OVERRIDES</span>
                  )}
                </div>
                <p className="text-xs text-text-tertiary">Based on {monthsElapsed}-month average</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[9px] text-text-tertiary uppercase tracking-wider">Projected Revenue</p>
                  <p className="text-sm font-bold text-accent mt-0.5">{formatCurrency(projectedAnnualRevenue)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-tertiary uppercase tracking-wider">Avg Monthly</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{formatCurrency(avgMonthlyRevenue)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-tertiary uppercase tracking-wider">Dividends Drawn</p>
                  <p className="text-sm font-bold text-purple-400 mt-0.5">{formatCurrency(ytdDividends)}</p>
                </div>
              </div>
            </div>

            {/* Monthly Breakdown Table */}
            <div className="card-surface border border-border rounded-xl overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-border/50 flex items-center justify-between">
                <p className="text-xs font-medium text-text-secondary">Monthly Breakdown</p>
                <div className="flex items-center gap-2">
                  {Object.keys(fyOverrides).length > 0 && (
                    <button
                      onClick={() => { setFyOverrides({}); setFyEditingMonth(null); }}
                      className="text-[9px] text-text-tertiary hover:text-text-secondary cursor-pointer"
                    >
                      Clear overrides
                    </button>
                  )}
                  <p className="text-[9px] text-text-tertiary">Click revenue or expenses to override</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left px-3 sm:px-4 py-2 text-text-tertiary font-medium uppercase tracking-wider text-[9px]">Month</th>
                      <th className="text-right px-3 sm:px-4 py-2 text-text-tertiary font-medium uppercase tracking-wider text-[9px]">Revenue</th>
                      <th className="text-right px-3 sm:px-4 py-2 text-text-tertiary font-medium uppercase tracking-wider text-[9px] hidden sm:table-cell">Expenses</th>
                      <th className="text-right px-3 sm:px-4 py-2 text-text-tertiary font-medium uppercase tracking-wider text-[9px]">Left in Co.</th>
                      <th className="text-right px-3 sm:px-4 py-2 text-text-tertiary/50 font-medium uppercase tracking-wider text-[9px] hidden sm:table-cell" title="Estimated 19% corp tax (paid year-end)">Tax est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMonths.map((m) => {
                      const monthKey = m.month.slice(0, 7);
                      const isEditingRevenue = fyEditingMonth === monthKey && fyEditField === 'revenue';
                      const isEditingExpenses = fyEditingMonth === monthKey && fyEditField === 'expenses';

                      return (
                        <tr key={m.month} className={cn('border-b border-border/20 hover:bg-surface-hover/30', m.isLive && 'bg-accent/5', m.hasOverride && 'bg-blue-500/5')}>
                          <td className="px-3 sm:px-4 py-2.5 font-medium text-text-primary">
                            {m.label}
                            {m.isLive && <span className="ml-1.5 text-[8px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-semibold">LIVE</span>}
                            {m.hasOverride && <span className="ml-1.5 text-[8px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold">EST</span>}
                          </td>
                          <td
                            className="text-right px-3 sm:px-4 py-2.5 text-accent font-medium cursor-pointer hover:bg-accent/10 transition-colors"
                            onClick={() => {
                              if (isEditingRevenue) return;
                              setFyEditingMonth(monthKey);
                              setFyEditField('revenue');
                              setFyEditValue(String(Math.round(m.revenue)));
                            }}
                          >
                            {isEditingRevenue ? (
                              <input
                                type="number"
                                autoFocus
                                value={fyEditValue}
                                onChange={(e) => setFyEditValue(e.target.value)}
                                onBlur={() => {
                                  const val = Number(fyEditValue);
                                  if (!isNaN(val) && val >= 0) {
                                    setFyOverrides(prev => ({ ...prev, [monthKey]: { ...prev[monthKey], revenue: val } }));
                                  }
                                  setFyEditingMonth(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = Number(fyEditValue);
                                    if (!isNaN(val) && val >= 0) {
                                      setFyOverrides(prev => ({ ...prev, [monthKey]: { ...prev[monthKey], revenue: val } }));
                                    }
                                    setFyEditingMonth(null);
                                  } else if (e.key === 'Escape') {
                                    setFyEditingMonth(null);
                                  }
                                }}
                                className="w-20 text-right bg-surface-secondary border border-accent/40 rounded px-1.5 py-0.5 text-xs text-accent font-medium outline-none focus:border-accent"
                              />
                            ) : (
                              <span className={m.hasOverride && fyOverrides[monthKey]?.revenue !== undefined ? 'underline decoration-dotted decoration-blue-400' : ''}>
                                {formatCurrency(m.revenue)}
                              </span>
                            )}
                          </td>
                          <td
                            className="text-right px-3 sm:px-4 py-2.5 text-text-secondary hidden sm:table-cell cursor-pointer hover:bg-surface-hover/50 transition-colors"
                            onClick={() => {
                              if (isEditingExpenses) return;
                              setFyEditingMonth(monthKey);
                              setFyEditField('expenses');
                              setFyEditValue(String(Math.round(m.expenses)));
                            }}
                          >
                            {isEditingExpenses ? (
                              <input
                                type="number"
                                autoFocus
                                value={fyEditValue}
                                onChange={(e) => setFyEditValue(e.target.value)}
                                onBlur={() => {
                                  const val = Number(fyEditValue);
                                  if (!isNaN(val) && val >= 0) {
                                    setFyOverrides(prev => ({ ...prev, [monthKey]: { ...prev[monthKey], expenses: val } }));
                                  }
                                  setFyEditingMonth(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = Number(fyEditValue);
                                    if (!isNaN(val) && val >= 0) {
                                      setFyOverrides(prev => ({ ...prev, [monthKey]: { ...prev[monthKey], expenses: val } }));
                                    }
                                    setFyEditingMonth(null);
                                  } else if (e.key === 'Escape') {
                                    setFyEditingMonth(null);
                                  }
                                }}
                                className="w-20 text-right bg-surface-secondary border border-border/60 rounded px-1.5 py-0.5 text-xs text-text-secondary font-medium outline-none focus:border-accent"
                              />
                            ) : (
                              <span className={m.hasOverride && fyOverrides[monthKey]?.expenses !== undefined ? 'underline decoration-dotted decoration-blue-400' : ''}>
                                {formatCurrency(m.expenses)}
                              </span>
                            )}
                          </td>
                          <td className={cn('text-right px-3 sm:px-4 py-2.5 font-medium', m.net > 0 ? 'text-accent' : 'text-red-400')}>{formatCurrency(m.net)}</td>
                          <td className="text-right px-3 sm:px-4 py-2.5 text-amber-400/40 hidden sm:table-cell">{formatCurrency(m.tax)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-surface-tertiary/20 font-semibold">
                      <td className="px-3 sm:px-4 py-2.5 text-text-primary">Total</td>
                      <td className="text-right px-3 sm:px-4 py-2.5 text-accent">{formatCurrency(ytdRevenue)}</td>
                      <td className="text-right px-3 sm:px-4 py-2.5 text-text-secondary hidden sm:table-cell">{formatCurrency(ytdExpenses)}</td>
                      <td className={cn('text-right px-3 sm:px-4 py-2.5', ytdNet > 0 ? 'text-accent' : 'text-red-400')}>{formatCurrency(ytdNet)}</td>
                      <td className="text-right px-3 sm:px-4 py-2.5 text-amber-400/40 hidden sm:table-cell">{formatCurrency(ytdTax)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modals */}
      <ClientFormModal open={showClientModal} onClose={() => setShowClientModal(false)} />
      <ExpenseFormModal
        open={showExpenseModal || !!editingExpense}
        onClose={() => { setShowExpenseModal(false); setEditingExpense(null); }}
        expense={editingExpense}
      />
      <SnapshotFormModal open={showSnapshotModal} onClose={() => setShowSnapshotModal(false)} />
      <BankImportModal open={showBankImport} onClose={() => setShowBankImport(false)} />
    </div>
  );
}

// ━━━ FORECAST TAB ━━━
function ForecastTab({
  monthlyRevenue, monthlyExpenses, leftInCompany, pipelineRevenue, pipelineLeads, history, activeClients, snapshot, overrideMap = {}, liveExpenses = 0, currentMonth,
}: {
  monthlyRevenue: number; monthlyExpenses: number; leftInCompany: number; pipelineRevenue: number;
  pipelineLeads: PipelineLead[]; history: FinancialSnapshot[]; activeClients: Client[];
  snapshot: FinancialSnapshot | null; overrideMap?: Record<string, number>; liveExpenses?: number; currentMonth: string;
}) {
  const [forecastMonths, setForecastMonths] = useState(6);
  const [startingBalance, setStartingBalance] = useState(String(Number(snapshot?.starting_balance) || 0));
  const [editingStartBalance, setEditingStartBalance] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<FinancialSnapshot | null>(null);
  // Sync starting balance when snapshot data changes from server
  useEffect(() => {
    setStartingBalance(String(Number(snapshot?.starting_balance) || 0));
  }, [snapshot?.starting_balance]);

  const startBal = Number(startingBalance) || 0;

  // ━━━ Tiered projection data ━━━
  const projectionData = useMemo(() => {
    const startFrom = new Date(currentMonth + 'T00:00:00');
    const rows: { month: string; confirmed: number; likely: number; possible: number; cumulative: number; cumulativeOptimistic: number }[] = [];
    let cumulativeCash = startBal;
    let cumulativeOptimistic = startBal;

    const activeLeads = pipelineLeads.filter(l => l.stage !== 'lost' && l.stage !== 'closed');

    for (let i = 0; i <= forecastMonths; i++) {
      const futureDate = new Date(startFrom);
      futureDate.setMonth(startFrom.getMonth() + i);
      const label = futureDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      const targetMonth = new Date(futureDate.getFullYear(), futureDate.getMonth(), 1);

      // Calculate confirmed revenue for this month
      let confirmed = 0;
      for (const c of activeClients) {
        const retainer = c.retainer_amount || 0;
        if (retainer === 0) continue;
        const contractStart = c.contract_start ? new Date(c.contract_start + 'T00:00:00') : null;
        const contractEnd = c.contract_end ? new Date(c.contract_end + 'T00:00:00') : null;
        const termDate = c.termination_date ? new Date(c.termination_date + 'T00:00:00') : null;
        // Client hasn't started yet → skip this month
        if (contractStart && contractStart > targetMonth) continue;
        // Hard termination date → skip entirely
        if (termDate && termDate < targetMonth) continue;
        // Ending client without termination date → reduced probability
        if (c.is_ending && !termDate) {
          confirmed += retainer * ((c.renewal_probability ?? 20) / 100);
          continue;
        }
        // Contract ends before target → apply renewal probability
        if (contractEnd && contractEnd < targetMonth) {
          confirmed += retainer * ((c.renewal_probability ?? 50) / 100);
        } else {
          confirmed += retainer;
        }
      }

      // Pipeline likely (≥60%) and possible (<60%) — full value, probability is binary likelihood
      let likely = 0;
      let possible = 0;
      for (const l of activeLeads) {
        const prob = l.probability ?? STAGE_PROBABILITY_DEFAULTS[l.stage] ?? 0;
        const value = l.estimated_value || 0;
        if (prob >= 60) likely += value;
        else if (prob > 0) possible += value;
      }

      const expenses = liveExpenses;
      const monthNet = Math.max(0, confirmed - expenses); // left in company = revenue - expenses (tax paid year-end)
      const monthNetOptimistic = Math.max(0, (confirmed + likely + possible) - expenses);

      if (i > 0) {
        cumulativeCash += monthNet;
        cumulativeOptimistic += monthNetOptimistic;
      }

      rows.push({
        month: label,
        confirmed,
        likely,
        possible,
        cumulative: cumulativeCash,
        cumulativeOptimistic,
      });
    }
    return rows;
  }, [activeClients, pipelineLeads, liveExpenses, forecastMonths, startBal, currentMonth]);

  const maxRevenue = projectionData.length > 0
    ? Math.max(...projectionData.map(r => r.confirmed + r.likely + r.possible), 1)
    : 1;
  const maxCum = projectionData.length > 0 ? Math.max(...projectionData.map(r => Math.max(Math.abs(r.cumulative), Math.abs(r.cumulativeOptimistic))), 1) : 1;

  function handleSaveStartingBalance() {
    const val = Number(startingBalance);
    setEditingStartBalance(false);
    // Fire-and-forget: don't block navigation
    upsertFinancialSnapshot({ starting_balance: val }).catch(e => console.error('Failed to save starting balance:', e));
  }

  function handleSaveEditSnapshot(id: string, revenue: string, expensesAmt: string) {
    const rev = Number(revenue) || 0;
    const exp = Number(expensesAmt) || 0;
    setEditingSnapshot(null);
    // Fire-and-forget: don't block navigation
    updateFinancialSnapshot(id, {
      total_revenue: rev,
      total_expenses: exp,
      corp_tax_reserve: rev * UK_CORP_TAX_RATE,
    }).catch(e => console.error('Failed to update snapshot:', e));
  }

  function handleDeleteSnapshot(id: string) {
    // Fire-and-forget: don't block navigation
    deleteFinancialSnapshot(id).catch(e => console.error('Failed to delete snapshot:', e));
  }

  return (
    <div className="space-y-5 stagger-in">
      {/* Cash Projection */}
      <section className="card-surface border border-border rounded-2xl card-hover p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-accent" />
            <h2 className="text-sm font-bold text-text-primary">Cash Projection</h2>
            <InfoBox title="Cash Projection">
              <p>Projects cash accumulation from your starting balance plus monthly net income.</p>
              <p className="mt-1">Set your starting balance to match your current business account.</p>
            </InfoBox>
          </div>
          <div className="flex items-center gap-2">
            {[3, 6, 12].map(m => (
              <button
                key={m}
                onClick={() => setForecastMonths(m)}
                className={cn(
                  'text-xs px-3 py-1 rounded-lg font-medium transition-colors',
                  forecastMonths === m ? 'bg-accent/15 text-accent' : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                {m}mo
              </button>
            ))}
          </div>
        </div>

        {/* Starting balance */}
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-surface-tertiary/40 border border-border/50">
          <span className="text-xs text-text-secondary">Starting Balance:</span>
          {editingStartBalance ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveStartingBalance()}
                className="w-28 text-sm bg-surface-secondary border border-border/40 rounded-xl px-2 py-1 text-text-primary outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors font-mono"
                autoFocus
              />
              <button onClick={handleSaveStartingBalance} className="text-[10px] text-accent font-medium">
                Save
              </button>
              <button onClick={() => setEditingStartBalance(false)} className="text-[10px] text-text-tertiary">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setEditingStartBalance(true)}
              className="text-sm font-bold text-text-primary hover:text-accent transition-colors font-mono"
            >
              {formatCurrency(startBal)}
            </button>
          )}
          <span className="text-[10px] text-text-tertiary ml-auto">Click to edit</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl font-bold text-accent">
              {formatCurrency(projectionData[projectionData.length - 1]?.cumulative || 0)}
            </span>
            <span className="text-sm text-text-tertiary">conservative in {forecastMonths} months</span>
            {projectionData[projectionData.length - 1]?.cumulativeOptimistic !== projectionData[projectionData.length - 1]?.cumulative && (
              <span className="text-sm text-purple-400/70">
                (optimistic: {formatCurrency(projectionData[projectionData.length - 1]?.cumulativeOptimistic || 0)})
              </span>
            )}
          </div>

          {/* Stacked revenue bars — tiered */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">Monthly Revenue Projection</p>
            <div className="grid grid-cols-1 gap-1.5">
              {projectionData.map((row, i) => {
                const confirmedPct = maxRevenue > 0 ? (row.confirmed / maxRevenue) * 100 : 0;
                const likelyPct = maxRevenue > 0 ? (row.likely / maxRevenue) * 100 : 0;
                const possiblePct = maxRevenue > 0 ? (row.possible / maxRevenue) * 100 : 0;
                const expenses = liveExpenses;
                const net = Math.max(0, row.confirmed - expenses);
                return (
                  <div key={i} className="group/bar relative flex items-center gap-3">
                    <span className="text-[10px] text-text-tertiary w-14 text-right font-mono">{row.month}</span>
                    <div className="flex-1 h-5 bg-surface-tertiary rounded-md overflow-hidden flex cursor-pointer">
                      <div className="h-full bg-emerald-500/40" style={{ width: `${Math.min(100, confirmedPct)}%` }} />
                      <div className="h-full bg-amber-500/40" style={{ width: `${Math.min(100 - confirmedPct, likelyPct)}%` }} />
                      <div className="h-full bg-purple-500/30" style={{ width: `${Math.min(100 - confirmedPct - likelyPct, possiblePct)}%` }} />
                    </div>
                    <span className="text-[10px] font-mono w-20 text-right shrink-0 text-text-secondary">
                      {formatCurrency(row.confirmed + row.likely + row.possible)}
                    </span>
                    {/* Hover tooltip */}
                    <div className="absolute left-16 top-full mt-1 z-50 hidden group-hover/bar:block w-56 p-3 rounded-xl bg-surface-primary border border-border shadow-lg">
                      <p className="text-[10px] font-semibold text-text-primary mb-2">{row.month} Breakdown</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-emerald-400">Confirmed</span>
                          <span className="font-mono text-text-primary">{formatCurrency(row.confirmed)}</span>
                        </div>
                        {row.likely > 0 && (
                          <div className="flex justify-between text-[10px]">
                            <span className="text-amber-400">Likely (≥60%)</span>
                            <span className="font-mono text-text-primary">{formatCurrency(row.likely)}</span>
                          </div>
                        )}
                        {row.possible > 0 && (
                          <div className="flex justify-between text-[10px]">
                            <span className="text-purple-400">Possible (&lt;60%)</span>
                            <span className="font-mono text-text-primary">{formatCurrency(row.possible)}</span>
                          </div>
                        )}
                        <div className="border-t border-border/50 pt-1 mt-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-text-tertiary">− Expenses</span>
                            <span className="font-mono text-red-400">{formatCurrency(expenses)}</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-semibold pt-1">
                            <span className={net >= 0 ? 'text-accent' : 'text-red-400'}>Left in co.</span>
                            <span className={cn('font-mono', net >= 0 ? 'text-accent' : 'text-red-400')}>{formatCurrency(net)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-[10px] text-text-tertiary pt-2">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-emerald-500/40" /><span>Confirmed</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-amber-500/40" /><span>Likely (≥60%)</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-purple-500/30" /><span>Possible (&lt;60%)</span></div>
            </div>
          </div>

          {/* Cumulative cash bars */}
          <div className="space-y-1 mt-4">
            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">Cumulative Cash (Conservative)</p>
            <div className="grid grid-cols-1 gap-1.5">
              {projectionData.map((row, i) => {
                const pct = maxCum > 0 ? Math.max(2, (Math.abs(row.cumulative) / maxCum) * 100) : 0;
                const optPct = maxCum > 0 ? Math.max(2, (Math.abs(row.cumulativeOptimistic) / maxCum) * 100) : 0;
                const diff = row.cumulativeOptimistic - row.cumulative;
                return (
                  <div key={i} className="group/cum relative flex items-center gap-3">
                    <span className="text-[10px] text-text-tertiary w-14 text-right font-mono">{row.month}</span>
                    <div className="flex-1 relative h-5 cursor-pointer">
                      {/* Optimistic dotted outline */}
                      <div
                        className="absolute top-0 left-0 h-full border border-dashed border-purple-400/30 rounded-md"
                        style={{ width: `${Math.min(100, optPct)}%` }}
                      />
                      {/* Conservative fill */}
                      <div className="absolute top-0 left-0 h-full bg-surface-tertiary rounded-md overflow-hidden" style={{ width: '100%' }}>
                        <div
                          className={cn(
                            'h-full rounded-md progress-fill',
                            row.cumulative >= 0 ? 'bg-accent/30' : 'bg-red-500/30'
                          )}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                    <span className={cn(
                      'text-[10px] font-mono w-20 text-right shrink-0',
                      row.cumulative >= 0 ? 'text-accent' : 'text-red-400'
                    )}>
                      {formatCurrency(row.cumulative)}
                    </span>
                    {/* Hover tooltip */}
                    <div className="absolute left-16 top-full mt-1 z-50 hidden group-hover/cum:block w-52 p-3 rounded-xl bg-surface-primary border border-border shadow-lg">
                      <p className="text-[10px] font-semibold text-text-primary mb-2">{row.month} Cash Position</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-text-secondary">Conservative</span>
                          <span className={cn('font-mono', row.cumulative >= 0 ? 'text-accent' : 'text-red-400')}>{formatCurrency(row.cumulative)}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-purple-400">Optimistic</span>
                          <span className="font-mono text-purple-400">{formatCurrency(row.cumulativeOptimistic)}</span>
                        </div>
                        {diff > 0 && (
                          <div className="flex justify-between text-[10px] pt-1 border-t border-border/50">
                            <span className="text-text-tertiary">Pipeline upside</span>
                            <span className="font-mono text-purple-400">+{formatCurrency(diff)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-[10px] text-text-tertiary pt-2">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-accent/30" /><span>Conservative (confirmed only)</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm border border-dashed border-purple-400/30" /><span>Optimistic (all tiers)</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Revenue forecast breakdown — 3 tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <section className="card-surface border border-emerald-500/20 rounded-2xl card-hover p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1 h-5 rounded-full bg-emerald-500" />
            <h2 className="text-sm font-bold text-emerald-400">Confirmed</h2>
            <InfoBox title="Confirmed Revenue">
              <p>Revenue from active clients with current retainers. This is your baseline income.</p>
              <p className="mt-1">Monthly overrides are reflected here if set.</p>
            </InfoBox>
          </div>
          <p className="text-2xl font-bold text-text-primary mb-3">{formatCurrency(monthlyRevenue)}</p>
          <div className="space-y-1">
            {activeClients.map(c => {
              const hasOverride = overrideMap[c.id] !== undefined;
              const amount = hasOverride ? overrideMap[c.id] : (c.retainer_amount || 0);
              return (
                <div key={c.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-secondary">{c.name}</span>
                    {hasOverride && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400">override</span>}
                  </div>
                  <span className="text-[11px] font-mono text-text-primary">{formatCurrency(amount)}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card-surface border border-amber-500/20 rounded-2xl card-hover p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1 h-5 rounded-full bg-amber-500" />
            <h2 className="text-sm font-bold text-amber-400">Likely</h2>
            <InfoBox title="Likely Revenue">
              <p>Pipeline leads with ≥60% probability. These are strong prospects that may convert.</p>
              <p className="mt-1">Full deal value is shown — adjust probability in the Pipeline tab.</p>
            </InfoBox>
          </div>
          <p className="text-2xl font-bold text-amber-400 mb-3">
            {formatCurrency(pipelineLeads.filter(l => l.stage !== 'lost' && l.stage !== 'closed').reduce((sum, l) => {
              const prob = l.probability ?? STAGE_PROBABILITY_DEFAULTS[l.stage] ?? 0;
              return prob >= 60 ? sum + (l.estimated_value || 0) : sum;
            }, 0))}
          </p>
          <div className="space-y-1">
            {pipelineLeads.filter(l => l.stage !== 'lost' && l.stage !== 'closed' && (l.probability ?? STAGE_PROBABILITY_DEFAULTS[l.stage] ?? 0) >= 60).map(l => (
              <div key={l.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-secondary">{l.name}</span>
                  <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400">{l.probability ?? STAGE_PROBABILITY_DEFAULTS[l.stage] ?? 0}%</span>
                </div>
                <span className="text-[11px] font-mono text-text-primary">{formatCurrency(l.estimated_value || 0)}</span>
              </div>
            ))}
            {pipelineLeads.filter(l => l.stage !== 'lost' && l.stage !== 'closed' && (l.probability ?? STAGE_PROBABILITY_DEFAULTS[l.stage] ?? 0) >= 60).length === 0 && (
              <p className="text-xs text-text-tertiary">No likely leads</p>
            )}
          </div>
        </section>

        <section className="card-surface border border-purple-500/20 rounded-2xl card-hover p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1 h-5 rounded-full bg-purple-500" />
            <h2 className="text-sm font-bold text-purple-400">Possible</h2>
            <InfoBox title="Possible Revenue">
              <p>Pipeline leads with &lt;60% probability. Earlier-stage prospects that could convert.</p>
              <p className="mt-1">Use the Pipeline tab to update stages and probability as deals progress.</p>
            </InfoBox>
          </div>
          <p className="text-2xl font-bold text-purple-400 mb-3">
            {formatCurrency(pipelineLeads.filter(l => l.stage !== 'lost' && l.stage !== 'closed').reduce((sum, l) => {
              const prob = l.probability ?? STAGE_PROBABILITY_DEFAULTS[l.stage] ?? 0;
              return prob > 0 && prob < 60 ? sum + (l.estimated_value || 0) : sum;
            }, 0))}
          </p>
          <div className="space-y-1">
            {pipelineLeads.filter(l => l.stage !== 'lost' && l.stage !== 'closed' && (l.probability ?? STAGE_PROBABILITY_DEFAULTS[l.stage] ?? 0) > 0 && (l.probability ?? STAGE_PROBABILITY_DEFAULTS[l.stage] ?? 0) < 60).map(l => (
              <div key={l.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-secondary">{l.name}</span>
                  <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/15 text-purple-400">{l.probability ?? STAGE_PROBABILITY_DEFAULTS[l.stage] ?? 0}%</span>
                </div>
                <span className="text-[11px] font-mono text-text-primary">{formatCurrency(l.estimated_value || 0)}</span>
              </div>
            ))}
            {pipelineLeads.filter(l => l.stage !== 'lost' && l.stage !== 'closed' && (l.probability ?? STAGE_PROBABILITY_DEFAULTS[l.stage] ?? 0) > 0 && (l.probability ?? STAGE_PROBABILITY_DEFAULTS[l.stage] ?? 0) < 60).length === 0 && (
              <p className="text-xs text-text-tertiary">No possible leads</p>
            )}
          </div>
        </section>
      </div>

      {/* Monthly P&L */}
      <section className="card-surface border border-border rounded-2xl card-hover p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-5 rounded-full bg-amber-500" />
          <h2 className="text-sm font-bold text-text-primary">Monthly P&amp;L Breakdown</h2>
          <InfoBox title="P&L Breakdown">
            <p>Revenue minus expenses = what stays in the business each month.</p>
          </InfoBox>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-surface-tertiary/50">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Revenue</p>
            <p className="text-sm font-bold text-text-primary">{formatCurrency(monthlyRevenue)}</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-tertiary/50">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Expenses</p>
            <p className="text-sm font-bold text-text-secondary">{formatCurrency(monthlyExpenses)}</p>
          </div>
          <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
            <p className="text-[10px] text-accent uppercase tracking-wider mb-1">Left in Co.</p>
            <p className="text-sm font-bold text-accent">{formatCurrency(leftInCompany)}</p>
            <p className="text-[8px] text-amber-400/60 mt-0.5">~{formatCurrency(Math.max(0, monthlyRevenue - monthlyExpenses) * UK_CORP_TAX_RATE)} tax</p>
          </div>
        </div>
      </section>

      {/* Historical Snapshots — Editable */}
      <section className="card-surface border border-border rounded-2xl card-hover p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-5 rounded-full bg-cyan-500" />
          <h2 className="text-sm font-bold text-text-primary">Monthly History</h2>
          <InfoBox title="Monthly History">
            <p>Your recorded financial snapshots. Click Edit to adjust revenue or expense figures for any month.</p>
            <p className="mt-1">Use &quot;+ Monthly Record&quot; to backfill historical months or record the current month.</p>
          </InfoBox>
          <span className="text-[10px] text-text-tertiary ml-auto">{history.length} months recorded</span>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-text-tertiary text-center py-4">No historical data yet. Use &quot;+ Monthly Record&quot; to add previous months.</p>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-5 gap-2 px-3 py-1.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
              <span>Month</span>
              <span className="text-right">Revenue</span>
              <span className="text-right">Expenses</span>
              <span className="text-right">Net</span>
              <span className="text-right">Actions</span>
            </div>
            {[...history].reverse().map(snap => {
              const monthStr = String(snap.month);
              const dateStr = monthStr.length <= 7 ? monthStr + '-01' : monthStr;
              const parsed = new Date(dateStr + 'T00:00:00');
              const label = !isNaN(parsed.getTime())
                ? parsed.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                : monthStr;
              const net = (Number(snap.total_revenue) || 0) - (Number(snap.total_expenses) || 0);

              return (
                <div key={snap.id} className="grid grid-cols-5 gap-2 px-3 py-2 rounded-lg hover:bg-surface-tertiary/40 transition-colors items-center">
                  <span className="text-xs text-text-primary font-medium">{label}</span>
                  <span className="text-xs font-mono text-text-primary text-right">{formatCurrency(Number(snap.total_revenue) || 0)}</span>
                  <span className="text-xs font-mono text-text-secondary text-right">{formatCurrency(Number(snap.total_expenses) || 0)}</span>
                  <span className={cn('text-xs font-mono text-right font-medium', net >= 0 ? 'text-accent' : 'text-red-400')}>
                    {formatCurrency(net)}
                  </span>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditingSnapshot(snap)}
                      className="text-[10px] text-text-tertiary hover:text-accent transition-colors cursor-pointer"
                      title="Edit snapshot"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSnapshot(snap.id)}
                      className="text-[10px] text-text-tertiary hover:text-red-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                      title="Delete snapshot"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Snapshot Edit Modal */}
      {editingSnapshot && (
        <SnapshotEditModal
          snapshot={editingSnapshot}
          onClose={() => setEditingSnapshot(null)}
          onSave={handleSaveEditSnapshot}
          isPending={false}
        />
      )}
    </div>
  );
}

function SnapshotEditModal({ snapshot, onClose, onSave, isPending }: {
  snapshot: FinancialSnapshot;
  onClose: () => void;
  onSave: (id: string, revenue: string, expenses: string) => void;
  isPending: boolean;
}) {
  const [revenue, setRevenue] = useState(String(Number(snapshot.total_revenue) || 0));
  const [expensesAmt, setExpensesAmt] = useState(String(Number(snapshot.total_expenses) || 0));

  const monthStr = String(snapshot.month);
  const dateStr = monthStr.length <= 7 ? monthStr + '-01' : monthStr;
  const parsed = new Date(dateStr + 'T00:00:00');
  const label = !isNaN(parsed.getTime())
    ? parsed.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : monthStr;

  return (
    <Modal open onClose={onClose} title={`Edit ${label}`}>
      <div className="space-y-4">
        <Input label="Revenue (GBP)" type="number" step="0.01" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
        <Input label="Expenses (GBP)" type="number" step="0.01" value={expensesAmt} onChange={(e) => setExpensesAmt(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(snapshot.id, revenue, expensesAmt)} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ━━━ CLIENTS TAB ━━━
function ClientsTab({
  clients, monthlyRevenue, overrideMap, currentMonth, onAddClient, onDeleteClient,
}: {
  clients: Client[]; monthlyRevenue: number; overrideMap: Record<string, number>; currentMonth: string; onAddClient: () => void; onDeleteClient: (id: string) => void;
}) {
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  return (
    <div className="space-y-4 stagger-in">
      <div className="flex justify-between items-center">
        <p className="text-sm text-text-secondary">{clients.length} total clients</p>
        <Button size="sm" onClick={onAddClient}>+ Add Client</Button>
      </div>

      {clients.length === 0 ? (
        <div className="card-surface border border-border rounded-2xl p-8 text-center">
          <p className="text-sm text-text-tertiary">No clients yet. Add your first client to track revenue.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => {
            const share = monthlyRevenue > 0 ? ((client.retainer_amount || 0) / monthlyRevenue) * 100 : 0;
            return (
              <div
                key={client.id}
                className="card-surface border border-border rounded-xl p-4 card-hover cursor-pointer"
                onClick={() => setEditingClient(client)}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-text-primary">{client.name}</p>
                      {client.risk_flag && <Badge variant="danger">Risk</Badge>}
                      {!client.is_active && <Badge variant="default">Inactive</Badge>}
                      {client.is_ending && <Badge variant="danger">Ending</Badge>}
                      {client.is_active && !client.is_ending && share > 40 && <Badge variant="danger">High concentration</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-text-secondary flex-wrap">
                      {client.retainer_amount != null && (
                        <span className="font-medium">
                          {overrideMap[client.id] !== undefined ? (
                            <><span className="line-through text-text-tertiary mr-1">{formatCurrency(client.retainer_amount)}</span>{formatCurrency(overrideMap[client.id])}/mo</>
                          ) : (
                            <>{formatCurrency(client.retainer_amount)}/mo</>
                          )}
                        </span>
                      )}
                      {overrideMap[client.id] !== undefined && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-medium">override</span>
                      )}
                      {client.is_active && monthlyRevenue > 0 && (
                        <span className="text-text-tertiary">{share.toFixed(0)}% of revenue</span>
                      )}
                      {client.payment_day && (
                        <span className="inline-flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          Pays {getOrdinal(client.payment_day)} of month
                        </span>
                      )}
                      {client.renewal_probability != null && (
                        <span className={cn(
                          client.renewal_probability >= 70 ? 'text-accent' : client.renewal_probability >= 40 ? 'text-amber-400' : 'text-red-400'
                        )}>
                          {formatPercentage(client.renewal_probability)} renewal
                        </span>
                      )}
                      {client.contract_end && (
                        <span className={cn(
                          new Date(client.contract_end) < new Date(Date.now() + 60 * 86400000) ? 'text-amber-400' : 'text-text-tertiary'
                        )}>
                          Ends {new Date(client.contract_end).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      {client.is_ending && client.notice_period_months && (
                        <span className="text-red-400">
                          {client.notice_period_months} month{client.notice_period_months !== 1 ? 's' : ''} notice
                        </span>
                      )}
                      {client.termination_date && (
                        <span className="text-red-400">
                          Final payment {new Date(client.termination_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <span className="text-[10px] text-text-tertiary group-hover:text-text-secondary">Edit</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-tertiary">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Client Edit Modal */}
      {editingClient && (
        <ClientEditModal
          client={editingClient}
          currentMonth={currentMonth}
          onClose={() => setEditingClient(null)}
          onDelete={() => onDeleteClient(editingClient.id)}
        />
      )}
    </div>
  );
}

function ClientEditModal({ client, currentMonth, onClose, onDelete }: {
  client: Client; currentMonth: string; onClose: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(client.name);
  const [retainer, setRetainer] = useState(String(client.retainer_amount || ''));
  const [paymentDay, setPaymentDay] = useState(String(client.payment_day || ''));
  const [renewalProb, setRenewalProb] = useState(String(client.renewal_probability ?? ''));
  const [isActive, setIsActive] = useState(client.is_active);
  const [isEnding, setIsEnding] = useState(client.is_ending || false);
  const [noticePeriod, setNoticePeriod] = useState(String(client.notice_period_months || ''));
  const [terminationDate, setTerminationDate] = useState(client.termination_date || '');
  const [contractStart, setContractStart] = useState(client.contract_start || '');
  const [contractEnd, setContractEnd] = useState(client.contract_end || '');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Monthly overrides
  const [overrides, setOverrides] = useState<ClientMonthlyOverride[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(true);
  const [overrideMonth, setOverrideMonth] = useState(currentMonth.slice(0, 7));
  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [overridePending, setOverridePending] = useState(false);

  useEffect(() => {
    getClientOverridesForClient(client.id).then((data) => {
      setOverrides(data);
      setLoadingOverrides(false);
    }).catch(() => setLoadingOverrides(false));
  }, [client.id]);

  function handleAddOverride() {
    if (!overrideMonth || !overrideAmount) return;
    setOverridePending(true);
    upsertClientOverride(client.id, overrideMonth + '-01', Number(overrideAmount), overrideNotes || undefined)
      .then(() => getClientOverridesForClient(client.id))
      .then(updated => {
        setOverrides(updated);
        setOverrideAmount('');
        setOverrideNotes('');
      })
      .catch(e => console.error('Failed to save override:', e))
      .finally(() => setOverridePending(false));
  }

  function handleDeleteOverride(id: string) {
    setOverridePending(true);
    setOverrides(prev => prev.filter(o => o.id !== id));
    deleteClientOverride(id)
      .catch(e => {
        console.error('Failed to delete override:', e);
        // Revert on error
        getClientOverridesForClient(client.id).then(setOverrides).catch(() => {});
      })
      .finally(() => setOverridePending(false));
  }

  function handleSave() {
    setSaving(true);
    setSaveError('');
    updateClient(client.id, {
      name,
      retainer_amount: retainer ? Number(retainer) : null,
      payment_day: paymentDay ? Number(paymentDay) : null,
      renewal_probability: renewalProb ? Number(renewalProb) : null,
      is_active: isActive,
      is_ending: isEnding,
      notice_period_months: isEnding && noticePeriod ? Number(noticePeriod) : null,
      termination_date: isEnding && terminationDate ? terminationDate : null,
      contract_start: contractStart || null,
      contract_end: contractEnd || null,
    })
      .then(() => onClose())
      .catch(e => {
        console.error('Failed to save client:', e);
        setSaveError('Failed to save. Check console for details.');
        setSaving(false);
      });
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${client.name}`}>
      <div className="space-y-4">
        <Input label="Client Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Monthly Retainer (GBP)" type="number" value={retainer} onChange={(e) => setRetainer(e.target.value)} />
          <Input label="Payment Day" type="number" min="1" max="31" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} />
        </div>
        <Input label="Renewal Probability (%)" type="number" min="0" max="100" value={renewalProb} onChange={(e) => setRenewalProb(e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Contract Start" type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} />
          <Input label="Contract End" type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-[var(--accent)]" />
            Active
          </label>
        </div>

        {/* Monthly Overrides Section */}
        <div className="border-t border-border/50 pt-4">
          <p className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
            Monthly Amount Overrides
            <span className="text-[9px] font-normal text-text-tertiary">Set different amounts for specific months</span>
          </p>

          {/* Add override form */}
          <div className="flex items-end gap-2 mb-3 flex-wrap">
            <div>
              <label className="text-[10px] text-text-tertiary block mb-1">Month</label>
              <input
                type="month"
                value={overrideMonth}
                onChange={(e) => setOverrideMonth(e.target.value)}
                className="text-xs bg-surface-secondary border border-border/40 rounded-xl px-2 py-1.5 text-text-primary outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-text-tertiary block mb-1">Amount (GBP)</label>
              <input
                type="number"
                value={overrideAmount}
                onChange={(e) => setOverrideAmount(e.target.value)}
                placeholder={String(client.retainer_amount || 0)}
                className="w-28 text-xs bg-surface-secondary border border-border/40 rounded-xl px-2 py-1.5 text-text-primary outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-text-tertiary block mb-1">Notes</label>
              <input
                type="text"
                value={overrideNotes}
                onChange={(e) => setOverrideNotes(e.target.value)}
                placeholder="Optional note"
                className="w-32 text-xs bg-surface-secondary border border-border/40 rounded-xl px-2 py-1.5 text-text-primary outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors"
              />
            </div>
            <button
              onClick={handleAddOverride}
              disabled={overridePending || !overrideMonth || !overrideAmount}
              className="text-[10px] text-accent font-medium disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 cursor-pointer"
            >
              {overridePending ? '...' : 'Set'}
            </button>
          </div>

          {/* Existing overrides list */}
          {loadingOverrides ? (
            <p className="text-[10px] text-text-tertiary">Loading overrides...</p>
          ) : overrides.length > 0 ? (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {overrides.map(o => {
                const d = new Date(o.month + '-01T00:00:00');
                const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
                return (
                  <div key={o.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-surface-tertiary/30 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary font-medium">{label}</span>
                      <span className="font-mono text-amber-400">{formatCurrency(Number(o.amount))}</span>
                      {o.notes && <span className="text-text-tertiary text-[10px]">({o.notes})</span>}
                    </div>
                    <button
                      onClick={() => handleDeleteOverride(o.id)}
                      disabled={overridePending}
                      className="text-[10px] text-text-tertiary hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-text-tertiary">No overrides set. Base retainer ({formatCurrency(client.retainer_amount || 0)}/mo) used for all months.</p>
          )}
        </div>

        {/* Termination section */}
        <div className="border-t border-border/50 pt-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isEnding} onChange={(e) => setIsEnding(e.target.checked)} className="accent-red-500" />
            <span className="text-red-400 font-medium">Client ending work</span>
          </label>
          {isEnding && (
            <div className="mt-3 space-y-3 pl-1 border-l-2 border-red-500/20 ml-1 animate-fade-in">
              <div className="grid grid-cols-2 gap-3 pl-3">
                <Input label="Notice Period (months)" type="number" min="0" value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)} placeholder="e.g., 2" />
                <Input label="Final Payment Date" type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} />
              </div>
              <p className="text-[10px] text-text-tertiary pl-3">
                Revenue from this client will be excluded from stability calculations after the termination date.
              </p>
            </div>
          )}
        </div>

        {saveError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{saveError}</p>
        )}

        <div className="flex items-center justify-between pt-2">
          {showConfirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">Are you sure?</span>
              <button onClick={() => { onDelete(); onClose(); }} className="text-xs text-red-400 font-medium hover:text-red-300">Yes, delete</button>
              <button onClick={() => setShowConfirmDelete(false)} className="text-xs text-text-tertiary">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setShowConfirmDelete(true)} className="text-xs text-text-tertiary hover:text-red-400 transition-colors">
              Delete client
            </button>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ━━━ SAVINGS GOALS ━━━
function SavingsGoalsSection({ goals, leftInCompany }: {
  goals: SavingsGoal[];
  leftInCompany: number;
}) {
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [editMode, setEditMode] = useState<'balance' | 'adjust' | 'target'>('balance');
  const [editValue, setEditValue] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCurrent, setNewCurrent] = useState('0');
  const [newColor, setNewColor] = useState('blue');
  const [isPending, setIsPending] = useState(false);

  const GOAL_COLORS = ['blue', 'purple', 'emerald', 'amber', 'cyan', 'pink', 'red'];

  function handleAddGoal() {
    if (!newLabel.trim() || !newTarget) return;
    setIsPending(true);
    setNewLabel('');
    setNewTarget('');
    setNewCurrent('0');
    setShowAddGoal(false);
    createSavingsGoal({
      label: newLabel.trim(),
      target_amount: Number(newTarget),
      current_amount: Number(newCurrent) || 0,
      color: newColor,
    }).catch(e => console.error('Failed to create savings goal:', e)).finally(() => setIsPending(false));
  }

  function handleUpdateBalance(goal: SavingsGoal, newAmount: number) {
    setEditingGoal(null);
    setEditValue('');
    setEditMode('balance');
    updateSavingsGoal(goal.id, { current_amount: newAmount })
      .catch(e => console.error('Failed to update savings goal:', e));
  }

  function handleAdjustBalance(goal: SavingsGoal, adjustment: number) {
    setEditingGoal(null);
    setEditValue('');
    setEditMode('balance');
    updateSavingsGoal(goal.id, { current_amount: Math.max(0, goal.current_amount + adjustment) })
      .catch(e => console.error('Failed to adjust savings goal:', e));
  }

  function handleUpdateTarget(goal: SavingsGoal, newTarget: number) {
    setEditingGoal(null);
    setEditValue('');
    setEditMode('balance');
    updateSavingsGoal(goal.id, { target_amount: newTarget })
      .catch(e => console.error('Failed to update savings target:', e));
  }

  function handleDeleteGoal(id: string) {
    deleteSavingsGoal(id).catch(e => console.error('Failed to delete savings goal:', e));
  }

  function getColorClass(color: string) {
    const map: Record<string, string> = {
      blue: 'bg-blue-500', purple: 'bg-purple-500', emerald: 'bg-emerald-500',
      amber: 'bg-amber-500', cyan: 'bg-cyan-500', pink: 'bg-pink-500', red: 'bg-red-500',
    };
    return map[color] || 'bg-blue-500';
  }

  return (
    <section className="card-surface border border-border rounded-2xl card-hover p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 rounded-full bg-emerald-500" />
          <h2 className="text-sm font-bold text-text-primary">Savings Goals</h2>
          <InfoBox title="Savings Goals">
            <p>Set up custom savings goals and track progress. Click the balance to update it.</p>
          </InfoBox>
        </div>
        <button
          onClick={() => setShowAddGoal(!showAddGoal)}
          className="text-[10px] text-accent hover:text-accent/80 font-medium flex items-center gap-1 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add Goal
        </button>
      </div>

      {/* Add Goal Form */}
      {showAddGoal && (
        <div className="p-4 rounded-xl bg-surface-tertiary/40 border border-border/50 space-y-4 mb-4 animate-fade-in">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Goal name (e.g., ISA, House Deposit, Emergency Fund)"
            className="w-full text-sm bg-transparent text-text-primary placeholder:text-text-tertiary/50 outline-none"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">Target Amount (£)</label>
              <input
                type="number"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full text-xs bg-surface-secondary border border-border/40 rounded-xl px-2.5 py-2 text-text-primary outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">Saved So Far (£)</label>
              <input
                type="number"
                value={newCurrent}
                onChange={(e) => setNewCurrent(e.target.value)}
                placeholder="0"
                className="w-full text-xs bg-surface-secondary border border-border/40 rounded-xl px-2.5 py-2 text-text-primary outline-none focus:border-accent/50 transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-tertiary mr-1">Colour:</span>
              {GOAL_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={cn(
                    'w-5 h-5 rounded-full transition-all cursor-pointer',
                    getColorClass(c),
                    newColor === c ? 'ring-2 ring-offset-2 ring-offset-[var(--surface)] ring-white/30 scale-110' : 'opacity-50 hover:opacity-75'
                  )}
                />
              ))}
            </div>
            <button
              onClick={handleAddGoal}
              disabled={isPending || !newLabel.trim() || !newTarget}
              className="text-xs text-accent font-medium disabled:opacity-40 hover:text-accent/80 transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-accent/10"
            >
              {isPending ? 'Saving...' : 'Create Goal'}
            </button>
          </div>
        </div>
      )}

      {goals.length === 0 && !showAddGoal ? (
        <p className="text-xs text-text-tertiary text-center py-4">
          No savings goals set up yet. Click &quot;+ Add Goal&quot; to create your first one.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map(g => {
            const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
            const remaining = Math.max(0, g.target_amount - g.current_amount);
            const monthsToGoal = leftInCompany > 0 ? Math.ceil(remaining / leftInCompany) : Infinity;
            const isEditing = editingGoal?.id === g.id;

            return (
              <div key={g.id} className="p-4 rounded-xl bg-surface-tertiary/40 space-y-3 group">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-text-primary">{g.label}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-text-tertiary">{pct.toFixed(0)}%</p>
                    <button
                      onClick={() => handleDeleteGoal(g.id)}
                      className="text-[10px] text-text-tertiary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full progress-fill', getColorClass(g.color))} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  {isEditing && editMode === 'balance' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateBalance(g, Number(editValue))}
                        className="w-24 text-xs bg-surface-secondary border border-border/40 rounded-xl px-2 py-1 text-text-primary outline-none focus:border-accent/40 transition-colors"
                        autoFocus
                      />
                      <button onClick={() => handleUpdateBalance(g, Number(editValue))} className="text-[10px] text-accent font-medium cursor-pointer">Save</button>
                      <button onClick={() => { setEditingGoal(null); setEditValue(''); }} className="text-[10px] text-text-tertiary cursor-pointer">Cancel</button>
                    </div>
                  ) : isEditing && editMode === 'adjust' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-tertiary">+/-</span>
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdjustBalance(g, Number(editValue))}
                        placeholder="e.g. 500 or -200"
                        className="w-28 text-xs bg-surface-secondary border border-border/40 rounded-xl px-2 py-1 text-text-primary outline-none focus:border-accent/40 transition-colors"
                        autoFocus
                      />
                      <button onClick={() => handleAdjustBalance(g, Number(editValue))} className="text-[10px] text-accent font-medium cursor-pointer">Apply</button>
                      <button onClick={() => { setEditingGoal(null); setEditValue(''); }} className="text-[10px] text-text-tertiary cursor-pointer">Cancel</button>
                    </div>
                  ) : isEditing && editMode === 'target' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-tertiary">Target:</span>
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateTarget(g, Number(editValue))}
                        className="w-24 text-xs bg-surface-secondary border border-border/40 rounded-xl px-2 py-1 text-text-primary outline-none focus:border-accent/40 transition-colors"
                        autoFocus
                      />
                      <button onClick={() => handleUpdateTarget(g, Number(editValue))} className="text-[10px] text-accent font-medium cursor-pointer">Save</button>
                      <button onClick={() => { setEditingGoal(null); setEditValue(''); }} className="text-[10px] text-text-tertiary cursor-pointer">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditingGoal(g); setEditMode('balance'); setEditValue(String(g.current_amount)); }}
                        className="text-sm font-bold text-text-primary hover:text-accent transition-colors cursor-pointer"
                        title="Set exact balance"
                      >
                        {formatCurrency(g.current_amount)}
                      </button>
                      <button
                        onClick={() => { setEditingGoal(g); setEditMode('adjust'); setEditValue(''); }}
                        className="text-[10px] text-text-tertiary hover:text-accent transition-colors opacity-0 group-hover:opacity-100 cursor-pointer px-1"
                        title="Add or subtract amount"
                      >
                        +/-
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => { setEditingGoal(g); setEditMode('target'); setEditValue(String(g.target_amount)); }}
                    className="text-[10px] text-text-tertiary hover:text-accent transition-colors cursor-pointer"
                    title="Edit target"
                  >
                    of {formatCurrency(g.target_amount)}
                  </button>
                </div>
                {remaining > 0 && leftInCompany > 0 && monthsToGoal !== Infinity && (
                  <p className="text-[10px] text-text-tertiary">
                    ~{monthsToGoal} months to goal at current rate
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ━━━ INSIGHT CARDS (expandable) ━━━
function InsightCards({ insights }: { insights: RevenueInsight[] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const severityStyles: Record<string, { bg: string; icon: string; text: string }> = {
    positive: { bg: 'bg-emerald-500/8 border-emerald-500/20', icon: '↑', text: 'text-emerald-400' },
    info: { bg: 'bg-accent/8 border-accent/20', icon: '→', text: 'text-accent' },
    warning: { bg: 'bg-amber-500/8 border-amber-500/20', icon: '⚠', text: 'text-amber-400' },
    danger: { bg: 'bg-red-500/8 border-red-500/20', icon: '!', text: 'text-red-400' },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {insights.map((insight, i) => {
        const isExpanded = expandedIdx === i;
        const style = severityStyles[insight.severity] || severityStyles.info;
        return (
          <button
            key={i}
            onClick={() => setExpandedIdx(isExpanded ? null : i)}
            className={cn(
              'rounded-xl border px-4 py-3 text-left transition-all cursor-pointer',
              style.bg,
              isExpanded && 'ring-1 ring-white/10'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('text-xs shrink-0', style.text)}>{style.icon}</span>
                <svg className={cn('w-3 h-3 shrink-0 transition-transform', isExpanded && 'rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <p className="text-xs font-medium text-text-primary">{insight.title}</p>
              </div>
              {insight.metric && (
                <span className={cn('text-xs font-bold shrink-0', style.text)}>
                  {insight.metric}
                </span>
              )}
            </div>
            {isExpanded && (
              <p className="text-[11px] text-text-secondary leading-relaxed mt-2 ml-7">{insight.detail}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ━━━ EXPENSES TAB ━━━
function ExpensesTab({
  expenses, monthLabel, isCurrent, onAddExpense, onEditExpense, onDeleteExpense, monthlySalary = 0, staffCost = 0,
}: {
  expenses: Expense[]; monthLabel: string; isCurrent: boolean; onAddExpense: () => void; onEditExpense: (expense: Expense) => void; onDeleteExpense: (id: string) => void;
  monthlySalary?: number; staffCost?: number;
}) {
  const [editingSalary, setEditingSalary] = useState(false);
  const [editingStaff, setEditingStaff] = useState(false);
  const [salaryInput, setSalaryInput] = useState(String(monthlySalary));
  const [staffInput, setStaffInput] = useState(String(staffCost));
  const [savingField, setSavingField] = useState<string | null>(null);

  // Sync inputs when server data changes
  useEffect(() => { setSalaryInput(String(monthlySalary)); }, [monthlySalary]);
  useEffect(() => { setStaffInput(String(staffCost)); }, [staffCost]);

  function handleSaveSalary() {
    const val = Number(salaryInput) || 0;
    setSavingField('salary');
    updateFinanceSettings({ monthly_salary: val })
      .catch(err => console.error('Failed to update salary:', err))
      .finally(() => { setSavingField(null); setEditingSalary(false); });
  }

  function handleSaveStaff() {
    const val = Number(staffInput) || 0;
    setSavingField('staff');
    updateFinanceSettings({ staff_cost: val })
      .catch(err => console.error('Failed to update staff cost:', err))
      .finally(() => { setSavingField(null); setEditingStaff(false); });
  }

  const businessExpenses = expenses.filter(e => (e.expense_type || 'business') === 'business');
  const personalExpenses = expenses.filter(e => e.expense_type === 'personal');
  const businessTotal = businessExpenses.reduce((sum, e) => sum + e.amount, 0);
  const personalTotal = personalExpenses.reduce((sum, e) => sum + e.amount, 0);

  function renderExpenseList(items: Expense[]) {
    if (items.length === 0) return (
      <div className="card-surface border border-border rounded-2xl p-4 sm:p-6 text-center">
        <p className="text-xs text-text-tertiary">No expenses.</p>
      </div>
    );
    return (
      <div className="space-y-2">
        {items.map((expense) => (
          <div key={expense.id} className="card-surface border border-border rounded-xl p-4 flex items-center justify-between card-hover group">
            <div className="space-y-1 min-w-0 flex-1 cursor-pointer" onClick={() => onEditExpense(expense)}>
              <p className="text-sm font-medium text-text-primary">{expense.description}</p>
              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <Badge variant="default">{expense.category}</Badge>
                <span>{expense.date}</span>
                {expense.is_recurring && <Badge variant="accent">Recurring</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-text-primary">{formatCurrency(expense.amount, true)}</span>
              <button onClick={() => onEditExpense(expense)} className="text-text-tertiary hover:text-accent transition-colors text-xs cursor-pointer opacity-0 group-hover:opacity-100">Edit</button>
              <button onClick={() => onDeleteExpense(expense.id)} className="text-text-tertiary hover:text-danger transition-colors text-xs cursor-pointer opacity-0 group-hover:opacity-100">Delete</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 stagger-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {monthLabel}: <span className="text-text-primary font-semibold">{formatCurrency(businessTotal + personalTotal + staffCost)}</span>
          {!isCurrent && <span className="text-text-tertiary text-xs ml-2">(viewing past month)</span>}
        </p>
        <Button size="sm" onClick={onAddExpense}>+ Add Expense</Button>
      </div>

      {/* Salary & Contractor Costs */}
      <div className="card-surface border border-border rounded-2xl p-4 sm:p-5 space-y-4">
        <h4 className="text-xs uppercase tracking-wider text-text-tertiary font-medium">Salary & Staff Costs</h4>

        {/* Personal Salary */}
        <div className="flex items-center justify-between group">
          <div className="space-y-0.5">
            <p className="text-sm text-text-primary">Your Salary</p>
            <p className="text-[10px] text-text-tertiary">Monthly salary drawn from business — auto-imported to Personal Income</p>
          </div>
          {editingSalary ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={salaryInput}
                onChange={(e) => setSalaryInput(e.target.value)}
                className="w-24 bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary text-right font-mono focus:outline-none focus:border-accent"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSalary(); if (e.key === 'Escape') { setEditingSalary(false); setSalaryInput(String(monthlySalary)); } }}
              />
              <button onClick={handleSaveSalary} disabled={savingField === 'salary'} className="text-xs text-accent hover:text-accent/80 cursor-pointer">
                {savingField === 'salary' ? '...' : 'Save'}
              </button>
              <button onClick={() => { setEditingSalary(false); setSalaryInput(String(monthlySalary)); }} className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingSalary(true)}
              className="text-sm font-semibold text-text-primary hover:text-accent transition-colors cursor-pointer group-hover:underline decoration-dotted underline-offset-2"
            >
              {formatCurrency(monthlySalary)}/mo
            </button>
          )}
        </div>

        {/* Contractor / Staff Cost */}
        <div className="flex items-center justify-between group border-t border-border/50 pt-4">
          <div className="space-y-0.5">
            <p className="text-sm text-text-primary">Staff / Contractor Costs</p>
            <p className="text-[10px] text-text-tertiary">Monthly staff costs — deducted from business profit before corp tax</p>
          </div>
          {editingStaff ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={staffInput}
                onChange={(e) => setStaffInput(e.target.value)}
                className="w-24 bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary text-right font-mono focus:outline-none focus:border-accent"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveStaff(); if (e.key === 'Escape') { setEditingStaff(false); setStaffInput(String(staffCost)); } }}
              />
              <button onClick={handleSaveStaff} disabled={savingField === 'staff'} className="text-xs text-accent hover:text-accent/80 cursor-pointer">
                {savingField === 'staff' ? '...' : 'Save'}
              </button>
              <button onClick={() => { setEditingStaff(false); setStaffInput(String(staffCost)); }} className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingStaff(true)}
              className="text-sm font-semibold text-text-primary hover:text-accent transition-colors cursor-pointer group-hover:underline decoration-dotted underline-offset-2"
            >
              {formatCurrency(staffCost)}/mo
            </button>
          )}
        </div>

        {/* Summary */}
        <div className="border-t border-border pt-3 flex justify-between text-xs text-text-tertiary">
          <span>Total fixed costs (salary + staff)</span>
          <span className="font-mono text-text-secondary">{formatCurrency(monthlySalary + staffCost)}/mo</span>
        </div>
      </div>

      {/* Business Expenses */}
      <div className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-text-tertiary font-medium">Business Expenses — {formatCurrency(businessTotal)}</h4>
        {renderExpenseList(businessExpenses)}
      </div>

      {/* Personal Expenses */}
      {personalExpenses.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs uppercase tracking-wider text-purple-400 font-medium">Personal — {formatCurrency(personalTotal)}</h4>
          {renderExpenseList(personalExpenses)}
        </div>
      )}
    </div>
  );
}

// ━━━ MODALS ━━━
function ClientFormModal({ open, onClose }: {
  open: boolean; onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [retainer, setRetainer] = useState('');
  const [paymentDay, setPaymentDay] = useState('');
  const [fixedContract, setFixedContract] = useState(false);
  const [contractMonths, setContractMonths] = useState('');
  const [renewalProb, setRenewalProb] = useState('80');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [isPending, setIsPending] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setIsPending(true);
    const clientData = {
      name,
      retainer_amount: retainer ? Number(retainer) : undefined,
      payment_day: paymentDay ? Number(paymentDay) : undefined,
      contract_length_months: fixedContract && contractMonths ? Number(contractMonths) : undefined,
      renewal_probability: renewalProb ? Number(renewalProb) : undefined,
      contract_start: fixedContract && contractStart ? contractStart : undefined,
      contract_end: fixedContract && contractEnd ? contractEnd : undefined,
    };
    setName(''); setRetainer(''); setPaymentDay(''); setFixedContract(false);
    setContractMonths(''); setRenewalProb('80'); setContractStart(''); setContractEnd('');
    onClose();
    createClientAction(clientData)
      .catch(err => console.error('Failed to create client:', err))
      .finally(() => setIsPending(false));
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Client">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Client Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Monthly Retainer (GBP)" type="number" value={retainer} onChange={(e) => setRetainer(e.target.value)} placeholder="0" />
          <Input label="Payment Day of Month" type="number" min="1" max="31" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} placeholder="1" />
        </div>
        <Input label="Renewal Probability (%)" type="number" min="0" max="100" value={renewalProb} onChange={(e) => setRenewalProb(e.target.value)} />

        {/* Fixed contract toggle */}
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input type="checkbox" checked={fixedContract} onChange={(e) => setFixedContract(e.target.checked)} className="accent-[var(--accent)]" />
          Fixed-term contract
        </label>

        {fixedContract && (
          <div className="space-y-3 pl-1 border-l-2 border-accent/20 ml-1 animate-fade-in">
            <div className="grid grid-cols-2 gap-3 pl-3">
              <Input label="Contract Start" type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} />
              <Input label="Contract End" type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} />
            </div>
            <div className="pl-3">
              <Input label="Contract Length (months)" type="number" value={contractMonths} onChange={(e) => setContractMonths(e.target.value)} placeholder="12" />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isPending || !name}>{isPending ? 'Adding...' : 'Add Client'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ExpenseFormModal({ open, onClose, expense }: {
  open: boolean; onClose: () => void; expense?: Expense | null;
}) {
  const isEditing = !!expense;
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('software');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [expenseType, setExpenseType] = useState<'business' | 'personal'>('business');
  const [isPending, setIsPending] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (expense) {
      setDescription(expense.description);
      setAmount(String(expense.amount));
      setCategory(expense.category);
      setDate(expense.date);
      setIsRecurring(expense.is_recurring);
      setExpenseType(expense.expense_type || 'business');
    } else {
      setDescription('');
      setAmount('');
      setCategory('software');
      setDate(new Date().toISOString().split('T')[0]);
      setIsRecurring(false);
      setExpenseType('business');
    }
  }, [expense]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description || !amount) return;
    setIsPending(true);
    const expenseData = { description, amount: Number(amount), category, date, is_recurring: isRecurring, expense_type: expenseType };
    onClose();

    if (isEditing && expense) {
      updateExpense(expense.id, expenseData)
        .catch(err => console.error('Failed to update expense:', err))
        .finally(() => setIsPending(false));
    } else {
      setDescription(''); setAmount(''); setCategory('software'); setIsRecurring(false); setExpenseType('business');
      createExpense(expenseData)
        .catch(err => console.error('Failed to create expense:', err))
        .finally(() => setIsPending(false));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Edit Expense' : 'Add Expense'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Amount (GBP)" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
        </div>
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="accent-[var(--accent)]" />
            Recurring
          </label>
          <div className="flex items-center gap-1 bg-surface-secondary rounded-lg p-0.5">
            <button type="button" onClick={() => setExpenseType('business')}
              className={cn('px-3 py-1 text-xs rounded-md transition-all cursor-pointer', expenseType === 'business' ? 'bg-accent text-white' : 'text-text-tertiary hover:text-text-secondary')}>
              Business
            </button>
            <button type="button" onClick={() => setExpenseType('personal')}
              className={cn('px-3 py-1 text-xs rounded-md transition-all cursor-pointer', expenseType === 'personal' ? 'bg-purple-500 text-white' : 'text-text-tertiary hover:text-text-secondary')}>
              Personal
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isPending || !description || !amount}>{isPending ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Expense')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SnapshotFormModal({ open, onClose }: {
  open: boolean; onClose: () => void;
}) {
  const [month, setMonth] = useState('');
  const [revenue, setRevenue] = useState('');
  const [expensesAmt, setExpensesAmt] = useState('');
  const [isPending, setIsPending] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!month) return;
    setIsPending(true);
    const monthDate = month + '-01';
    const rev = Number(revenue) || 0;
    const exp = Number(expensesAmt) || 0;
    setMonth(''); setRevenue(''); setExpensesAmt('');
    onClose();
    upsertFinancialSnapshot({
      month: monthDate,
      total_revenue: rev,
      total_expenses: exp,
      corp_tax_reserve: rev * UK_CORP_TAX_RATE,
    }).catch(err => console.error('Failed to save snapshot:', err)).finally(() => setIsPending(false));
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Monthly Record">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Total Income (GBP)" type="number" step="0.01" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="Include all income — retainers, one-off work, etc." />
          <Input label="Total Expenses (GBP)" type="number" step="0.01" value={expensesAmt} onChange={(e) => setExpensesAmt(e.target.value)} placeholder="0" />
        </div>
        <p className="text-[10px] text-text-tertiary">
          Record total income for this month — including one-off projects, past clients, and retainer work.
          When you scroll to this month, these figures will be used instead of current client retainers.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isPending || !month}>{isPending ? 'Saving...' : 'Save Record'}</Button>
        </div>
      </form>
    </Modal>
  );
}
