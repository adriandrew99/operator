import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getToday } from '@/lib/utils/date';
import { getTaskMLU } from '@/lib/utils/mental-load';

export const dynamic = 'force-dynamic';

/**
 * GET /api/slack/daily-summary
 *
 * Triggered by an external cron service (Vercel Cron, etc.).
 * Authenticates via CRON_SECRET header, then sends a daily summary
 * to every user who has a Slack webhook URL configured.
 *
 * Headers:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  // Auth check via CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service role key to query all users (no cookie-based auth in cron)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 });
  }

  const supabase = createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });

  try {
    // List all users with slack_webhook_url in their metadata
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    const usersWithSlack = (usersData?.users || []).filter(
      u => u.user_metadata?.slack_webhook_url
    );

    if (usersWithSlack.length === 0) {
      return NextResponse.json({ message: 'No users with Slack webhooks configured', sent: 0 });
    }

    const today = getToday();
    let sentCount = 0;
    const errors: string[] = [];

    for (const user of usersWithSlack) {
      try {
        const webhookUrl = user.user_metadata.slack_webhook_url;

        // Fetch user's data
        const [tasksRes, completedRes, fundamentalsRes, completionsRes] = await Promise.all([
          supabase
            .from('tasks')
            .select('id, title, weight, energy, status, flagged_for_today, scheduled_date, deadline')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .or(`flagged_for_today.eq.true,scheduled_date.eq.${today},deadline.eq.${today}`),
          supabase
            .from('tasks')
            .select('id, weight, energy')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .gte('completed_at', `${today}T00:00:00`),
          supabase
            .from('custom_fundamentals')
            .select('id, label, icon')
            .eq('user_id', user.id)
            .eq('is_active', true),
          supabase
            .from('fundamental_completions')
            .select('fundamental_id, completed')
            .eq('user_id', user.id)
            .eq('date', today),
        ]);

        const todayTasks = tasksRes.data || [];
        const completedTasks = completedRes.data || [];
        const fundamentals = fundamentalsRes.data || [];
        const completions = completionsRes.data || [];

        const totalMLU = todayTasks.reduce((sum, t) => sum + getTaskMLU({ weight: t.weight, energy: t.energy }), 0);
        const completedMLU = completedTasks.reduce((sum, t) => sum + getTaskMLU({ weight: t.weight, energy: t.energy }), 0);

        const completedFundamentalIds = new Set(
          completions.filter((c: { completed: boolean }) => c.completed).map((c: { fundamental_id: string }) => c.fundamental_id)
        );
        const fundamentalsDone = fundamentals.filter(f => completedFundamentalIds.has(f.id)).length;

        const dateFormatted = new Date(today + 'T12:00:00').toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });

        const blocks = [
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
                text: `*Fundamentals*\n${fundamentalsDone} / ${fundamentals.length} done`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'Sent from Nexus',
              },
            ],
          },
        ];

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks }),
        });

        if (response.ok) {
          sentCount++;
        } else {
          errors.push(`User ${user.id}: Slack returned ${response.status}`);
        }
      } catch (err) {
        errors.push(`User ${user.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      message: `Daily summaries sent`,
      sent: sentCount,
      total: usersWithSlack.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Slack daily summary cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
