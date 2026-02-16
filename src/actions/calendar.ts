'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getCalendarEvents(startDate: string, endDate: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get fixed events for the date range
  const { data: fixedEvents, error: fixedError } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('start_time', { ascending: true });

  if (fixedError) throw fixedError;

  // Get recurring events that apply to this range
  const { data: recurringEvents, error: recurringError } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_recurring', true)
    .order('start_time', { ascending: true });

  if (recurringError) throw recurringError;

  // Expand recurring events into the date range
  const expanded = [...(fixedEvents || [])];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (const event of recurringEvents || []) {
    if (!event.recurrence_days || event.recurrence_days.length === 0) continue;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (event.recurrence_days.includes(dayOfWeek)) {
        const dateStr = current.toISOString().split('T')[0];
        // Don't duplicate if already in fixed events for this date
        const exists = expanded.some(e => e.id === event.id && e.date === dateStr);
        if (!exists) {
          expanded.push({
            ...event,
            date: dateStr,
          });
        }
      }
      current.setDate(current.getDate() + 1);
    }
  }

  return expanded;
}

export async function createCalendarEvent(eventData: {
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  event_type?: string;
  is_recurring?: boolean;
  recurrence_days?: number[];
  color?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('calendar_events')
    .insert({
      user_id: user.id,
      ...eventData,
    });

  if (error) throw error;
  revalidatePath('/planner');
}

export async function updateCalendarEvent(id: string, updates: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('calendar_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/planner');
}

export async function deleteCalendarEvent(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/planner');
}

export async function scheduleTask(taskId: string, scheduledDate: string, timeBlock: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tasks')
    .update({
      scheduled_date: scheduledDate,
      scheduled_time_block: timeBlock,
      deadline: scheduledDate, // keep deadline in sync so Today/WeekView picks it up
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/planner');
  revalidatePath('/today');
}

export async function unscheduleTask(taskId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tasks')
    .update({
      scheduled_date: null,
      scheduled_time_block: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/planner');
  revalidatePath('/today');
}

export async function getScheduledTasks(startDate: string, endDate: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_time_block', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getCompletedScheduledTasks(startDate: string, endDate: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .not('scheduled_date', 'is', null)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_time_block', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function autoScheduleTasks(weekStart: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const [tasksRes, eventsRes, scheduledRes, profileRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('scheduled_date', null)
      .or(`deadline.lte.${weekEndStr},flagged_for_today.eq.true,is_urgent.eq.true`)
      .order('sort_order', { ascending: true }),
    supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', weekStart)
      .lte('date', weekEndStr),
    supabase
      .from('tasks')
      .select('scheduled_date, scheduled_time_block, estimated_minutes')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('scheduled_date', weekStart)
      .lte('scheduled_date', weekEndStr)
      .not('scheduled_date', 'is', null),
    Promise.resolve(supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    ).catch(() => ({ data: null })),
  ]);

  const { data: tasks, error: tasksError } = tasksRes;
  if (tasksError) throw tasksError;
  if (!tasks || tasks.length === 0) return [];

  const events = eventsRes.data;
  const scheduledTasks = scheduledRes.data;

  // Work schedule from user profile (defaults: 9-17, Mon-Fri)
  const workStart = profileRes?.data?.work_start_hour ?? 9;
  const workEnd = profileRes?.data?.work_end_hour ?? 17;
  const workDays: number[] = profileRes?.data?.work_days ?? [1, 2, 3, 4, 5];

  // Build hourly availability grid per day
  const HOURS = Array.from({ length: workEnd - workStart + 1 }, (_, i) => i + workStart);
  const availability: Record<string, Set<number>> = {};

  for (let d = 0; d < 7; d++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ...
    // Only populate availability for work days
    availability[dateStr] = workDays.includes(dayOfWeek) ? new Set(HOURS) : new Set();

    // Remove hours occupied by calendar events
    for (const event of (events || []).filter(e => e.date === dateStr)) {
      const startH = parseInt(event.start_time.split(':')[0], 10);
      const endH = Math.ceil(timeToMinutes(event.end_time) / 60);
      for (let h = startH; h < endH; h++) availability[dateStr].delete(h);
    }

    // Remove hours occupied by already-scheduled tasks
    for (const t of (scheduledTasks || []).filter(st => st.scheduled_date === dateStr)) {
      const startH = parseInt(t.scheduled_time_block || '9', 10);
      const span = Math.max(1, Math.ceil((t.estimated_minutes || 30) / 60));
      for (let h = startH; h < startH + span; h++) availability[dateStr].delete(h);
    }
  }

  // Preferred hours by energy type
  const PREFERRED_HOURS: Record<string, number[]> = {
    deep: [8, 9, 10, 11, 14, 15, 7, 16, 6, 12, 13, 17, 18, 19, 20, 21],
    creative: [10, 11, 9, 14, 15, 8, 16, 7, 17, 6, 12, 13, 18, 19, 20, 21],
    admin: [12, 13, 14, 15, 16, 17, 18, 11, 10, 19, 9, 8, 20, 7, 21, 6],
  };

  // Sort tasks by priority
  const prioritized = [...tasks].sort((a, b) => {
    if (a.is_urgent && !b.is_urgent) return -1;
    if (!a.is_urgent && b.is_urgent) return 1;
    const wo: Record<string, number> = { high: 0, medium: 1, low: 2 };
    if ((wo[a.weight] ?? 1) !== (wo[b.weight] ?? 1)) return (wo[a.weight] ?? 1) - (wo[b.weight] ?? 1);
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  const assignments: { taskId: string; date: string; hour: string }[] = [];

  // Track load per day for even distribution
  const dayLoad: Record<string, number> = {};
  for (const date of Object.keys(availability)) {
    dayLoad[date] = 0;
  }
  // Count existing scheduled tasks toward day load
  for (const t of (scheduledTasks || [])) {
    if (t.scheduled_date && dayLoad[t.scheduled_date] !== undefined) {
      dayLoad[t.scheduled_date] += (t.estimated_minutes || 30);
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Day preference by energy type: deep work early in week, admin later
  const PREFERRED_DAYS_BY_ENERGY: Record<string, number[]> = {
    deep: [0, 1, 2, 3, 4, 5, 6],     // Mon-Sun (prefer start of week)
    creative: [1, 2, 0, 3, 4, 5, 6],  // Tue, Wed, Mon... (mid-week for creative)
    admin: [4, 3, 5, 2, 6, 1, 0],     // Fri, Thu, Sat... (end of week for admin)
  };

  for (const task of prioritized) {
    const span = Math.max(1, Math.ceil((task.estimated_minutes || 30) / 60));
    const preferredHours = PREFERRED_HOURS[task.energy] || PREFERRED_HOURS.admin;

    // Build smart day ordering
    const allDays = Object.keys(availability).sort();

    // Determine if this task MUST be scheduled today (no fallback to other days)
    const mustBeToday = availability[todayStr] && (
      (task.flagged_for_today && task.deadline && task.deadline <= todayStr) ||
      (task.deadline === todayStr)
    );

    // Priority 1: If flagged for today and today is in the week, prefer today
    const preferredDays: string[] = [];
    if (task.flagged_for_today && availability[todayStr]) {
      preferredDays.push(todayStr);
    }
    // Priority 2: Deadline day
    if (task.deadline && availability[task.deadline] && !preferredDays.includes(task.deadline)) {
      preferredDays.push(task.deadline);
    }

    // If must be today, only try today — skip if no slots available
    if (mustBeToday) {
      const targetDays = [todayStr];
      let scheduled = false;
      for (const day of targetDays) {
        const avail = availability[day];
        for (const startHour of preferredHours) {
          let fits = true;
          for (let h = startHour; h < startHour + span; h++) {
            if (!avail.has(h)) { fits = false; break; }
          }
          if (fits) {
            assignments.push({ taskId: task.id, date: day, hour: `${startHour}:00` });
            for (let h = startHour; h < startHour + span; h++) avail.delete(h);
            dayLoad[day] = (dayLoad[day] || 0) + (task.estimated_minutes || 30);
            scheduled = true;
            break;
          }
        }
        if (scheduled) break;
      }
      continue; // skip the normal day ordering below
    }

    // Priority 3: Sort remaining days by energy-based preference, then by least loaded
    const dayPreferenceOrder = PREFERRED_DAYS_BY_ENERGY[task.energy] || PREFERRED_DAYS_BY_ENERGY.admin;
    const remainingDays = allDays
      .filter(d => !preferredDays.includes(d))
      .sort((a, b) => {
        const aDay = new Date(a + 'T00:00:00').getDay();
        const bDay = new Date(b + 'T00:00:00').getDay();
        // Convert Sunday=0 to Monday=0 index
        const aIdx = aDay === 0 ? 6 : aDay - 1;
        const bIdx = bDay === 0 ? 6 : bDay - 1;
        const aPref = dayPreferenceOrder.indexOf(aIdx);
        const bPref = dayPreferenceOrder.indexOf(bIdx);
        // Primary sort: energy-based day preference; Secondary: least loaded day
        if (aPref !== bPref) return aPref - bPref;
        return (dayLoad[a] || 0) - (dayLoad[b] || 0);
      });

    const targetDays = [...preferredDays, ...remainingDays];

    let scheduled = false;
    for (const day of targetDays) {
      const avail = availability[day];
      for (const startHour of preferredHours) {
        // Check that all hours in the span are available
        let fits = true;
        for (let h = startHour; h < startHour + span; h++) {
          if (!avail.has(h)) { fits = false; break; }
        }
        if (fits) {
          assignments.push({ taskId: task.id, date: day, hour: `${startHour}:00` });
          for (let h = startHour; h < startHour + span; h++) avail.delete(h);
          dayLoad[day] = (dayLoad[day] || 0) + (task.estimated_minutes || 30);
          scheduled = true;
          break;
        }
      }
      if (scheduled) break;
    }
  }

  // Batch update all assignments — guard against concurrent runs by requiring scheduled_date IS NULL
  const now = new Date().toISOString();
  await Promise.all(
    assignments.map(a =>
      supabase
        .from('tasks')
        .update({ scheduled_date: a.date, scheduled_time_block: a.hour, updated_at: now })
        .eq('id', a.taskId)
        .eq('user_id', user.id)
        .is('scheduled_date', null)
    )
  );

  revalidatePath('/planner');
  return assignments;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}
