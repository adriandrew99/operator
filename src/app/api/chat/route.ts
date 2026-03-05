import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { getClientsWithOverrides, getExpenses, getFinancialSnapshot, getFinancialHistory, getSavingsGoals } from '@/actions/finance';
import { getStaffMembers } from '@/actions/staff';
import { getMonthStart } from '@/lib/utils/date';

export const dynamic = 'force-dynamic';

// Build a concise financial context string from user's data
async function buildFinancialContext(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const currentMonth = getMonthStart();

  const [clients, expenses, snapshot, history, goals, profileRes, staffMembersList] = await Promise.all([
    getClientsWithOverrides().catch(() => []),
    getExpenses(currentMonth).catch(() => []),
    getFinancialSnapshot(currentMonth).catch(() => null),
    getFinancialHistory(12).catch(() => []),
    getSavingsGoals().catch(() => []),
    Promise.resolve(supabase.from('profiles').select('monthly_salary, staff_cost').eq('id', user.id).single()).then(r => r.data).catch(() => null),
    getStaffMembers().catch(() => []),
  ]);

  const activeClients = (clients || []).filter((c: { is_active?: boolean; termination_date?: string | null }) =>
    c.is_active && !c.termination_date
  );

  const totalMRR = activeClients.reduce((sum: number, c: { retainer_amount?: number | null }) =>
    sum + (c.retainer_amount || 0), 0
  );

  const businessExpenses = (expenses || [])
    .filter((e: { expense_type?: string }) => (e.expense_type || 'business') === 'business')
    .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);

  const personalExpenses = (expenses || [])
    .filter((e: { expense_type?: string }) => e.expense_type === 'personal')
    .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);

  const lines: string[] = [
    `## Current Month: ${currentMonth}`,
    '',
    `### Active Clients (${activeClients.length})`,
    ...activeClients.map((c: { name: string; retainer_amount?: number | null; contract_end?: string | null; renewal_probability?: number | null; risk_flag?: boolean }) =>
      `- ${c.name}: £${c.retainer_amount || 0}/mo${c.contract_end ? ` (ends ${c.contract_end})` : ''}${c.renewal_probability != null ? ` [${Math.round(c.renewal_probability * 100)}% renewal]` : ''}${c.risk_flag ? ' ⚠️ AT RISK' : ''}`
    ),
    '',
    `### Revenue`,
    `- Confirmed MRR: £${totalMRR.toLocaleString()}`,
    `- This month revenue: £${snapshot?.total_revenue?.toLocaleString() || totalMRR.toLocaleString()}`,
    '',
    `### Expenses (This Month)`,
    `- Business expenses: £${businessExpenses.toLocaleString()}`,
    `- Personal expenses: £${personalExpenses.toLocaleString()}`,
    `- Total expenses: £${(snapshot?.total_expenses || (businessExpenses + personalExpenses)).toLocaleString()}`,
    ...(profileRes?.monthly_salary ? [`- Monthly salary: £${profileRes.monthly_salary.toLocaleString()}`] : []),
    '',
    `### Tax & Reserves`,
    `- Corp tax reserve (19%): £${snapshot?.corp_tax_reserve?.toLocaleString() || 'N/A'}`,
    `- Dividend paid: £${snapshot?.dividend_paid?.toLocaleString() || 'N/A'}`,
    '',
  ];

  // Staff members breakdown
  const activeStaffMembers = (staffMembersList || []).filter((m: { is_active: boolean }) => m.is_active);
  const totalStaffCost = activeStaffMembers.reduce((sum: number, m: { monthly_cost: number }) => sum + (m.monthly_cost || 0), 0);
  if (activeStaffMembers.length > 0) {
    lines.push(
      `### Staff / Contractors (${activeStaffMembers.length} active — £${totalStaffCost.toLocaleString()}/mo)`,
      ...activeStaffMembers.map((m: { name: string; role?: string | null; monthly_cost: number; notes?: string | null }) =>
        `- ${m.name}${m.role ? ` (${m.role})` : ''}: £${m.monthly_cost.toLocaleString()}/mo${m.notes ? ` — ${m.notes}` : ''}`
      ),
      `- Total staff cost: £${totalStaffCost.toLocaleString()}/mo (£${(totalStaffCost * 12).toLocaleString()}/yr)`,
      `- Corp tax saved from staff costs: £${Math.round(totalStaffCost * 12 * 0.19).toLocaleString()}/yr`,
      ''
    );
  } else if (profileRes?.staff_cost) {
    lines.push(
      `### Staff Costs`,
      `- Legacy staff cost: £${profileRes.staff_cost.toLocaleString()}/mo`,
      ''
    );
  }

  if (snapshot) {
    lines.push(
      `### Balances`,
      `- Company starting balance: £${snapshot.starting_balance?.toLocaleString() || '0'}`,
      ...(snapshot.net_worth != null ? [`- Net worth: £${snapshot.net_worth.toLocaleString()}`] : []),
      ...(snapshot.isa_balance ? [`- ISA balance: £${snapshot.isa_balance.toLocaleString()}`] : []),
      ...(snapshot.house_deposit_balance ? [`- House deposit: £${snapshot.house_deposit_balance.toLocaleString()}`] : []),
      ''
    );
  }

  if (goals && goals.length > 0) {
    lines.push(
      `### Savings Goals`,
      ...goals.map((g: { label: string; current_amount: number; target_amount: number }) =>
        `- ${g.label}: £${g.current_amount.toLocaleString()} / £${g.target_amount.toLocaleString()} (${Math.round((g.current_amount / g.target_amount) * 100)}%)`
      ),
      ''
    );
  }

  if (history && history.length > 1) {
    lines.push(
      `### Revenue Trend (last ${history.length} months)`,
      ...history.slice(-6).map((h: { month: string; total_revenue: number; total_expenses: number }) =>
        `- ${h.month}: Revenue £${h.total_revenue?.toLocaleString() || '0'}, Expenses £${h.total_expenses?.toLocaleString() || '0'}`
      ),
      ''
    );
  }

  // Client concentration risk
  if (activeClients.length > 0 && totalMRR > 0) {
    const topClient = activeClients.reduce((max: { name: string; retainer_amount?: number | null }, c: { name: string; retainer_amount?: number | null }) =>
      (c.retainer_amount || 0) > (max.retainer_amount || 0) ? c : max
    , activeClients[0]);
    const concentration = ((topClient.retainer_amount || 0) / totalMRR) * 100;
    lines.push(
      `### Risk Indicators`,
      `- Top client concentration: ${topClient.name} at ${concentration.toFixed(0)}% of revenue`,
      concentration > 50 ? `  ⚠️ HIGH concentration risk — over 50% from one client` : '',
      ''
    );
  }

  return lines.filter(Boolean).join('\n');
}

const SYSTEM_PROMPT = `You are the financial advisor embedded in Nexus, a founder's operating system for a UK-based freelance/agency operator. You have access to their real financial data which is provided below.

Your role:
- Answer questions about their finances using the data provided
- Provide actionable, specific advice grounded in their numbers
- Flag risks (client concentration, cash flow gaps, upcoming contract ends)
- Help with forecasting, budgeting, and strategic financial decisions
- All amounts are in GBP (£)
- Corp tax in UK is 19% (applied after ALL business expenses including staff costs and salary)
- Staff/contractor costs are deducted from revenue before corp tax — they reduce the tax bill
- Dividend tax: 8.75% basic rate, £1,000 annual allowance

Style:
- Be concise and direct — this is an operator who values efficiency
- Use specific numbers from their data, not generic advice
- Format with bullet points and bold for key figures
- Keep responses under 300 words unless asked for detailed analysis
- If you don't have enough data to answer, say so clearly`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'ANTHROPIC_API_KEY not configured. Add it to your .env.local file.' },
        { status: 500 }
      );
    }

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { message, history = [] } = await request.json();
    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build financial context
    const financialContext = await buildFinancialContext();

    const anthropic = new Anthropic({ apiKey });

    // Stream response using non-streaming approach wrapped in SSE
    // This avoids issues with the streaming API event format
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: `${SYSTEM_PROMPT}\n\n---\n\n## User's Financial Data\n\n${financialContext}`,
            messages: [
              ...history.slice(-10).map((m: { role: string; content: string }) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
              })),
              { role: 'user', content: message },
            ],
          });

          // Extract text from the response
          const text = response.content
            .filter((block): block is Anthropic.TextBlock => block.type === 'text')
            .map(block => block.text)
            .join('');

          // Send in chunks for a streaming feel
          const chunkSize = 20;
          for (let i = 0; i < text.length; i += chunkSize) {
            const chunk = text.slice(i, i + chunkSize);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          console.error('Anthropic API error:', errorMsg);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
