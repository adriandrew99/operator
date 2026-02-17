import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar/feed?token=<user_token>
 *
 * Generates a valid iCalendar (.ics) feed of the user's tasks.
 * Authentication is via a unique token query parameter (no session required).
 * This allows calendar apps (Google Calendar, Apple Calendar, etc.) to subscribe.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return new NextResponse('Missing token parameter', { status: 401 });
  }

  // Use service role key to look up user by token (no cookie auth for calendar subscriptions)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return new NextResponse('Server configuration error', { status: 500 });
  }

  const supabase = createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });

  try {
    // Find user by calendar token in metadata
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    const user = (usersData?.users || []).find(
      u => u.user_metadata?.calendar_feed_token === token
    );

    if (!user) {
      return new NextResponse('Invalid or expired token', { status: 401 });
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const fourteenDaysLater = new Date(today.getTime() + 14 * 86400000);
    const futureStr = fourteenDaysLater.toISOString().split('T')[0];

    // Fetch tasks: flagged for today + upcoming deadlines + scheduled tasks
    const [todayTasksRes, upcomingTasksRes, recurringRes, clientsRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, description, weight, energy, status, client_id, flagged_for_today, scheduled_date, scheduled_time_block, deadline, completed_at')
        .eq('user_id', user.id)
        .or(`flagged_for_today.eq.true,scheduled_date.eq.${todayStr}`)
        .in('status', ['active', 'completed']),
      supabase
        .from('tasks')
        .select('id, title, description, weight, energy, status, client_id, scheduled_date, scheduled_time_block, deadline, completed_at')
        .eq('user_id', user.id)
        .not('deadline', 'is', null)
        .gte('deadline', todayStr)
        .lte('deadline', futureStr)
        .in('status', ['active', 'completed']),
      supabase
        .from('recurring_tasks')
        .select('id, title, description, frequency, day_of_week, days_of_week, scheduled_time, weight, energy, client_id')
        .eq('user_id', user.id)
        .eq('is_active', true),
      supabase
        .from('clients')
        .select('id, name')
        .eq('user_id', user.id),
    ]);

    // Build client lookup
    const clientMap = new Map(
      (clientsRes.data || []).map((c: { id: string; name: string }) => [c.id, c.name])
    );

    // Merge and deduplicate tasks
    const allTasks = [...(todayTasksRes.data || []), ...(upcomingTasksRes.data || [])];
    const seenIds = new Set<string>();
    const uniqueTasks = allTasks.filter(t => {
      if (seenIds.has(t.id)) return false;
      seenIds.add(t.id);
      return true;
    });

    // Filter recurring tasks due today
    const dayOfWeek = today.getDay();
    const todayRecurring = (recurringRes.data || []).filter((rt: {
      frequency: string;
      day_of_week?: number;
      days_of_week?: number[];
    }) => {
      if (rt.frequency === 'daily') return true;
      if (rt.frequency === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
      if (rt.frequency === 'weekly') return dayOfWeek === (rt.day_of_week ?? 1);
      if (rt.frequency === 'custom' && rt.days_of_week) return rt.days_of_week.includes(dayOfWeek);
      return false;
    });

    // Generate iCalendar content
    const events: string[] = [];
    const nowStamp = formatICalDate(new Date());

    // Regular tasks
    for (const task of uniqueTasks) {
      const clientName = task.client_id ? clientMap.get(task.client_id) || '' : '';
      const isCompleted = task.status === 'completed';

      // Determine date: use scheduled_date, deadline, or today
      const eventDate = task.scheduled_date || task.deadline || todayStr;

      // Determine if timed or all-day
      const hasTime = task.scheduled_time_block && task.scheduled_time_block.match(/^\d+$/);
      let dtstart: string;
      let dtend: string;

      if (hasTime) {
        const hour = parseInt(task.scheduled_time_block, 10);
        const startDate = new Date(`${eventDate}T${String(hour).padStart(2, '0')}:00:00`);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour default
        dtstart = `DTSTART:${formatICalDateTime(startDate)}`;
        dtend = `DTEND:${formatICalDateTime(endDate)}`;
      } else {
        // All-day event
        dtstart = `DTSTART;VALUE=DATE:${eventDate.replace(/-/g, '')}`;
        const nextDay = new Date(eventDate + 'T00:00:00');
        nextDay.setDate(nextDay.getDate() + 1);
        dtend = `DTEND;VALUE=DATE:${nextDay.toISOString().split('T')[0].replace(/-/g, '')}`;
      }

      const descriptionParts: string[] = [];
      if (task.weight) descriptionParts.push(`Weight: ${task.weight}`);
      if (task.energy) descriptionParts.push(`Energy: ${task.energy}`);
      if (clientName) descriptionParts.push(`Client: ${clientName}`);
      if (task.description) descriptionParts.push(task.description);

      events.push([
        'BEGIN:VEVENT',
        `UID:task-${task.id}@nexus`,
        `DTSTAMP:${nowStamp}`,
        dtstart,
        dtend,
        `SUMMARY:${escapeICalText(task.title)}`,
        descriptionParts.length > 0 ? `DESCRIPTION:${escapeICalText(descriptionParts.join('\\n'))}` : null,
        task.weight ? `CATEGORIES:${task.weight}` : null,
        `STATUS:${isCompleted ? 'COMPLETED' : 'CONFIRMED'}`,
        'END:VEVENT',
      ].filter(Boolean).join('\r\n'));
    }

    // Recurring tasks (today only)
    for (const rt of todayRecurring) {
      const clientName = rt.client_id ? clientMap.get(rt.client_id) || '' : '';

      let dtstart: string;
      let dtend: string;

      if (rt.scheduled_time) {
        // Parse HH:MM format
        const [hours, minutes] = rt.scheduled_time.split(':').map(Number);
        const startDate = new Date(today);
        startDate.setHours(hours, minutes || 0, 0, 0);
        const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // 30 min default
        dtstart = `DTSTART:${formatICalDateTime(startDate)}`;
        dtend = `DTEND:${formatICalDateTime(endDate)}`;
      } else {
        // All-day
        dtstart = `DTSTART;VALUE=DATE:${todayStr.replace(/-/g, '')}`;
        const nextDay = new Date(today);
        nextDay.setDate(nextDay.getDate() + 1);
        dtend = `DTEND;VALUE=DATE:${nextDay.toISOString().split('T')[0].replace(/-/g, '')}`;
      }

      const descriptionParts: string[] = [];
      if (rt.weight) descriptionParts.push(`Weight: ${rt.weight}`);
      if (rt.energy) descriptionParts.push(`Energy: ${rt.energy}`);
      if (clientName) descriptionParts.push(`Client: ${clientName}`);
      if (rt.description) descriptionParts.push(rt.description);

      events.push([
        'BEGIN:VEVENT',
        `UID:recurring-${rt.id}-${todayStr}@nexus`,
        `DTSTAMP:${nowStamp}`,
        dtstart,
        dtend,
        `SUMMARY:${escapeICalText(rt.title)}`,
        descriptionParts.length > 0 ? `DESCRIPTION:${escapeICalText(descriptionParts.join('\\n'))}` : null,
        rt.weight ? `CATEGORIES:${rt.weight}` : null,
        'STATUS:CONFIRMED',
        'END:VEVENT',
      ].filter(Boolean).join('\r\n'));
    }

    // Build the full iCalendar document
    const ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Nexus//Operator OS//EN',
      'X-WR-CALNAME:Nexus Tasks',
      'X-WR-CALDESC:Tasks and deadlines from Nexus',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    return new NextResponse(ical, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="nexus-tasks.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Calendar feed error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

/* ━━━ iCal Helpers ━━━ */

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function formatICalDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${h}${min}${s}`;
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
