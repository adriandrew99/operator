'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getToday } from '@/lib/utils/date';
import { getTaskMLU } from '@/lib/utils/mental-load';

/* ━━━ Save / Retrieve Webhook URL ━━━ */

export async function saveSlackWebhookUrl(url: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Validate URL format
  if (url && !url.startsWith('https://hooks.slack.com/')) {
    throw new Error('Invalid Slack webhook URL. It should start with https://hooks.slack.com/');
  }

  const { error } = await supabase.auth.updateUser({
    data: { slack_webhook_url: url || null },
  });

  if (error) {
    console.error('Failed to save Slack webhook URL:', error);
    throw new Error('Failed to save Slack webhook URL');
  }

  revalidatePath('/settings');
}

export async function getSlackWebhookUrl(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return user.user_metadata?.slack_webhook_url || null;
}

/* ━━━ Test Webhook ━━━ */

export async function testSlackWebhook(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    if (!url.startsWith('https://hooks.slack.com/')) {
      return { ok: false, message: 'Invalid webhook URL format.' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ':white_check_mark: *Nexus connected successfully*\nYour daily summaries will appear here.',
            },
          },
        ],
      }),
    });

    if (response.ok) {
      return { ok: true, message: 'Test message sent successfully.' };
    }
    return { ok: false, message: `Slack returned ${response.status}. Check the webhook URL.` };
  } catch {
    return { ok: false, message: 'Failed to reach Slack. Check the URL and try again.' };
  }
}

/* ━━━ Send Daily Summary ━━━ */

interface TaskRow { id: string; title: string; weight: string; energy: string; status: string; flagged_for_today: boolean; scheduled_date: string | null; deadline: string | null; is_personal?: boolean }
interface CompletedRow { id: string; weight: string; energy: string; is_personal?: boolean }
interface FundamentalRow { id: string; label: string; icon: string }
interface CompletionRow { fundamental_id: string; completed: boolean }
interface RecurringRow { id: string; title: string }
interface RecurringCompRow { recurring_task_id: string }

export async function sendSlackDailySummary() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const webhookUrl = user.user_metadata?.slack_webhook_url;
  if (!webhookUrl) throw new Error('No Slack webhook URL configured');

  const today = getToday();

  // Fetch data in parallel — wrap in Promise.resolve() per project pattern
  const [tasksRes, completedRes, fundamentalsRes, completionsRes, recurringRes, recurringCompletionsRes] = await Promise.all([
    Promise.resolve(
      supabase
        .from('tasks')
        .select('id, title, weight, energy, status, flagged_for_today, scheduled_date, deadline')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .or(`flagged_for_today.eq.true,scheduled_date.eq.${today},deadline.eq.${today}`)
    ).catch(() => ({ data: [] as TaskRow[], error: null })),
    Promise.resolve(
      supabase
        .from('tasks')
        .select('id, weight, energy')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', `${today}T00:00:00`)
    ).catch(() => ({ data: [] as CompletedRow[], error: null })),
    Promise.resolve(
      supabase
        .from('custom_fundamentals')
        .select('id, label, icon')
        .eq('user_id', user.id)
        .eq('is_active', true)
    ).catch(() => ({ data: [] as FundamentalRow[], error: null })),
    Promise.resolve(
      supabase
        .from('fundamental_completions')
        .select('fundamental_id, completed')
        .eq('user_id', user.id)
        .eq('date', today)
    ).catch(() => ({ data: [] as CompletionRow[], error: null })),
    Promise.resolve(
      supabase
        .from('recurring_tasks')
        .select('id, title')
        .eq('user_id', user.id)
        .eq('is_active', true)
    ).catch(() => ({ data: [] as RecurringRow[], error: null })),
    Promise.resolve(
      supabase
        .from('recurring_task_completions')
        .select('recurring_task_id')
        .eq('user_id', user.id)
        .eq('date', today)
    ).catch(() => ({ data: [] as RecurringCompRow[], error: null })),
  ]);

  const todayTasks = (tasksRes.data || []) as TaskRow[];
  const completedTasks = (completedRes.data || []) as CompletedRow[];
  const fundamentals = (fundamentalsRes.data || []) as FundamentalRow[];
  const completions = (completionsRes.data || []) as CompletionRow[];
  const recurringTasks = (recurringRes.data || []) as RecurringRow[];
  const recurringCompletions = new Set(
    ((recurringCompletionsRes.data || []) as RecurringCompRow[]).map(c => c.recurring_task_id)
  );

  // Calculate MLU (exclude personal tasks)
  const totalMLU = todayTasks.filter((t: TaskRow) => !t.is_personal).reduce((sum: number, t: TaskRow) => sum + getTaskMLU({ weight: t.weight as 'low' | 'medium' | 'high', energy: t.energy as 'admin' | 'creative' }), 0);
  const completedMLU = completedTasks.filter((t: CompletedRow) => !t.is_personal).reduce((sum: number, t: CompletedRow) => sum + getTaskMLU({ weight: t.weight as 'low' | 'medium' | 'high', energy: t.energy as 'admin' | 'creative' }), 0);

  // Fundamentals status
  const completedFundamentalIds = new Set(
    completions.filter(c => c.completed).map(c => c.fundamental_id)
  );
  const fundamentalsDone = fundamentals.filter(f => completedFundamentalIds.has(f.id)).length;
  const fundamentalsTotal = fundamentals.length;

  // Recurring tasks status
  const recurringDone = recurringTasks.filter(t => recurringCompletions.has(t.id)).length;
  const recurringTotal = recurringTasks.length;

  // Build Slack Block Kit payload
  const dateFormatted = new Date(today + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Daily Summary  -  ${dateFormatted}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Tasks*\n${completedTasks.length} / ${todayTasks.length + completedTasks.length} completed`,
        },
        {
          type: 'mrkdwn',
          text: `*Mental Load*\n${completedMLU} / ${totalMLU + completedMLU} MLU used`,
        },
        {
          type: 'mrkdwn',
          text: `*Fundamentals*\n${fundamentalsDone} / ${fundamentalsTotal} done`,
        },
        {
          type: 'mrkdwn',
          text: `*Recurring*\n${recurringDone} / ${recurringTotal} done`,
        },
      ],
    },
    {
      type: 'divider',
    },
  ];

  // Remaining tasks
  if (todayTasks.length > 0) {
    const taskLines = todayTasks.slice(0, 10).map((t: TaskRow) => {
      const weightIcon = t.weight === 'high' ? ':red_circle:' : t.weight === 'medium' ? ':large_orange_circle:' : ':white_circle:';
      return `${weightIcon}  ${t.title}`;
    });
    if (todayTasks.length > 10) {
      taskLines.push(`_...and ${todayTasks.length - 10} more_`);
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Remaining Tasks*\n${taskLines.join('\n')}`,
      },
    });
  }

  // Fundamentals detail
  if (fundamentals.length > 0) {
    const fundLines = fundamentals.map((f: FundamentalRow) => {
      const done = completedFundamentalIds.has(f.id);
      return `${done ? ':white_check_mark:' : ':black_square_button:'}  ${f.icon} ${f.label}`;
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Fundamentals*\n${fundLines.join('\n')}`,
      },
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: 'Sent from Nexus',
      },
    ],
  });

  // Send to Slack
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed with status ${response.status}`);
  }

  return { ok: true };
}
