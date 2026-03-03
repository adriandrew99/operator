import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getClients, getExpenses, getFinancialSnapshot, getFinancialHistory, getSavingsGoals, getClientOverrides, getAllClientOverrides, getAllOneoffPayments, getAllExpenseOverrides } from '@/actions/finance';
import { getClientEnergyProfiles, generateInsights } from '@/actions/insights';
import { getStaffMembers } from '@/actions/staff';
import { getBankConnections, getBankTransactions } from '@/actions/banking';
import { getMonthStart } from '@/lib/utils/date';
import { FinanceDashboard } from './FinanceDashboard';

export const dynamic = 'force-dynamic';

interface FinancePageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const month = params.month || getMonthStart();

  const [clients, expenses, snapshot, history, pipelineRes, savingsGoals, clientOverrides, allClientOverrides, clientEnergyProfiles, insights, profileRes, staffMembers, bankConnections, bankTransactions, oneoffPayments, expenseOverrides] = await Promise.all([
    getClients().catch(() => []),
    getExpenses(month).catch(() => []),
    getFinancialSnapshot(month).catch(() => null),
    getFinancialHistory().catch(() => []),
    Promise.resolve(supabase
      .from('pipeline_leads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })).catch(() => ({ data: [] })),
    getSavingsGoals().catch(() => []),
    getClientOverrides(month).catch(() => []),
    getAllClientOverrides().catch(() => []),
    getClientEnergyProfiles().catch(() => []),
    generateInsights().catch(() => []),
    Promise.resolve(supabase.from('profiles').select('*').eq('id', user.id).single()).catch(() => ({ data: null })),
    getStaffMembers().catch(() => []),
    getBankConnections().catch(() => []),
    getBankTransactions().catch(() => []),
    getAllOneoffPayments().catch(() => []),
    getAllExpenseOverrides().catch(() => []),
  ]);

  return (
    <FinanceDashboard
      clients={clients || []}
      expenses={expenses || []}
      snapshot={snapshot}
      history={history || []}
      pipelineLeads={pipelineRes.data || []}
      savingsGoals={savingsGoals || []}
      currentMonth={month}
      clientOverrides={clientOverrides || []}
      clientEnergyProfiles={clientEnergyProfiles || []}
      insights={insights || []}
      monthlySalary={Number(profileRes?.data?.monthly_salary) || 0}
      staffCost={Number(profileRes?.data?.staff_cost) || 0}
      staffMembers={staffMembers || []}
      bankConnections={bankConnections || []}
      bankTransactions={bankTransactions || []}
      oneoffPayments={oneoffPayments || []}
      expenseOverrides={expenseOverrides || []}
      allClientOverrides={allClientOverrides || []}
    />
  );
}
