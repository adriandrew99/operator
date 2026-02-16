'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface CalendarSource {
  id: string;        // unique ID per calendar
  label: string;     // user-given name e.g. "Work", "Personal"
  url: string;       // normalised iCal URL
  color: string;     // hex colour for event dots
  enabled: boolean;
}

export interface ExternalCalendarEvent {
  id: string;
  title: string;
  start: string;      // ISO datetime
  end: string;        // ISO datetime
  location?: string;
  description?: string;
  allDay: boolean;
  calendarColor?: string; // colour from the source calendar
  calendarLabel?: string; // label from the source calendar
}

const DEFAULT_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];

/** Save the full list of calendar sources */
export async function saveCalendarSources(sources: CalendarSource[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Validate + normalise each URL
  const normalised = sources.map(s => ({
    ...s,
    url: s.url.replace(/^webcal:\/\//, 'https://'),
  }));

  for (const s of normalised) {
    if (s.url && !s.url.startsWith('http://') && !s.url.startsWith('https://')) {
      throw new Error(`Invalid URL for "${s.label}". Must start with http://, https://, or webcal://`);
    }
  }

  const { error } = await supabase.auth.updateUser({
    data: { calendar_sources: normalised },
  });

  if (error) {
    console.error('Failed to save calendar sources:', error);
    throw new Error('Failed to save calendars. Please try again.');
  }

  revalidatePath('/settings');
  revalidatePath('/today');
}

/** Get all saved calendar sources (migrates legacy single-URL format) */
export async function getCalendarSources(): Promise<CalendarSource[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Check for new multi-calendar format
  const sources = user.user_metadata?.calendar_sources;
  if (Array.isArray(sources) && sources.length > 0) {
    return sources as CalendarSource[];
  }

  // Migrate legacy single-URL format
  const legacyUrl = user.user_metadata?.calendar_url;
  if (legacyUrl && typeof legacyUrl === 'string') {
    const migrated: CalendarSource[] = [{
      id: 'legacy-1',
      label: 'Calendar',
      url: legacyUrl,
      color: DEFAULT_COLORS[0],
      enabled: true,
    }];
    // Auto-migrate to new format
    try {
      await supabase.auth.updateUser({ data: { calendar_sources: migrated } });
    } catch { /* best effort */ }
    return migrated;
  }

  // Also check profiles table fallback
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('calendar_url')
      .eq('id', user.id)
      .single();
    if (profile?.calendar_url) {
      const migrated: CalendarSource[] = [{
        id: 'legacy-1',
        label: 'Calendar',
        url: profile.calendar_url,
        color: DEFAULT_COLORS[0],
        enabled: true,
      }];
      try {
        await supabase.auth.updateUser({ data: { calendar_sources: migrated } });
      } catch { /* best effort */ }
      return migrated;
    }
  } catch { /* column may not exist */ }

  return [];
}

/** Legacy compatibility — save a single URL (used by old callers) */
export async function saveCalendarUrl(url: string) {
  const sources = await getCalendarSources();
  if (sources.length > 0) {
    // Update first calendar
    sources[0].url = url.replace(/^webcal:\/\//, 'https://');
    await saveCalendarSources(sources);
  } else {
    await saveCalendarSources([{
      id: `cal-${Date.now()}`,
      label: 'Calendar',
      url: url.replace(/^webcal:\/\//, 'https://'),
      color: DEFAULT_COLORS[0],
      enabled: true,
    }]);
  }
}

/** Legacy compatibility — get first calendar URL */
export async function getCalendarUrl(): Promise<string | null> {
  const sources = await getCalendarSources();
  const first = sources.find(s => s.enabled);
  return first?.url || null;
}

/** Parse an iCal feed and extract today's events */
function parseICalEvents(icalData: string, targetDate: string): ExternalCalendarEvent[] {
  const events: ExternalCalendarEvent[] = [];
  // Unfold continuation lines (lines starting with space or tab are continuations)
  const lines = icalData.replace(/\r\n /g, '').replace(/\r\n\t/g, '').split(/\r?\n/);

  // Target date for recurring event matching
  const target = new Date(targetDate + 'T00:00:00');

  let inEvent = false;
  let current: Partial<ExternalCalendarEvent & {
    dtstart: string; dtend: string; uid: string; summary: string;
    rrule: string; exdates: string[];
  }> = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = { exdates: [] };
      continue;
    }
    if (line === 'END:VEVENT') {
      inEvent = false;
      if (current.summary && current.dtstart) {
        const start = parseICalDate(current.dtstart);
        const end = current.dtend ? parseICalDate(current.dtend) : start;
        if (!start) continue;

        const startDate = start.toISOString().split('T')[0];
        const endDate = end ? end.toISOString().split('T')[0] : startDate;
        const isAllDay = current.dtstart.length <= 8 || current.dtstart.includes('VALUE=DATE');
        const durationMs = end ? end.getTime() - start.getTime() : 0;

        // Check if target date is excluded (EXDATE)
        const isExcluded = current.exdates?.some(ex => {
          const exDate = parseICalDate(ex);
          return exDate && exDate.toISOString().split('T')[0] === targetDate;
        });

        if (isExcluded) continue;

        // Direct date match
        let matches = startDate === targetDate || (startDate <= targetDate && endDate >= targetDate);

        // RRULE recurring event check
        if (!matches && current.rrule && startDate <= targetDate) {
          matches = rruleMatchesDate(current.rrule, start, target);
        }

        if (matches) {
          // For recurring events, adjust start/end times to target date
          let eventStart: Date;
          let eventEnd: Date;
          if (startDate === targetDate) {
            eventStart = start;
            eventEnd = end || start;
          } else {
            // Recurring: use original time but on target date
            eventStart = new Date(target);
            eventStart.setHours(start.getHours(), start.getMinutes(), start.getSeconds());
            eventEnd = new Date(eventStart.getTime() + durationMs);
          }

          events.push({
            id: current.uid || `evt-${events.length}`,
            title: unescapeIcal(current.summary),
            start: eventStart.toISOString(),
            end: eventEnd.toISOString(),
            location: current.location ? unescapeIcal(current.location) : undefined,
            description: current.description ? unescapeIcal(current.description) : undefined,
            allDay: isAllDay,
          });
        }
      }
      continue;
    }
    if (!inEvent) continue;

    // Parse properties
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).split(';')[0].toUpperCase();
    const value = line.slice(colonIdx + 1);

    switch (key) {
      case 'SUMMARY': current.summary = value; break;
      case 'DTSTART': current.dtstart = line.slice(line.indexOf(':') + 1); break;
      case 'DTEND': current.dtend = line.slice(line.indexOf(':') + 1); break;
      case 'UID': current.uid = value; break;
      case 'LOCATION': current.location = value; break;
      case 'DESCRIPTION': current.description = value; break;
      case 'RRULE': current.rrule = value; break;
      case 'EXDATE': current.exdates?.push(value); break;
    }
  }

  // Deduplicate by UID (Google Calendar can include both RRULE event + individual overrides)
  const seen = new Set<string>();
  const dedupedEvents = events.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  // Sort by start time
  dedupedEvents.sort((a, b) => a.start.localeCompare(b.start));
  return dedupedEvents;
}

/** Check if an RRULE applies to a target date */
function rruleMatchesDate(rrule: string, eventStart: Date, target: Date): boolean {
  const parts = Object.fromEntries(
    rrule.split(';').map(p => { const [k, v] = p.split('='); return [k, v]; })
  );

  const freq = parts.FREQ;
  const until = parts.UNTIL ? parseICalDate(parts.UNTIL) : null;
  const count = parts.COUNT ? parseInt(parts.COUNT) : null;
  const interval = parts.INTERVAL ? parseInt(parts.INTERVAL) : 1;
  const byDay = parts.BYDAY?.split(',') || [];

  // If UNTIL is before target, rule has expired
  if (until && until < target) return false;

  // Day mapping for BYDAY
  const DAY_MAP: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const targetDay = target.getDay();

  switch (freq) {
    case 'DAILY': {
      const daysDiff = Math.floor((target.getTime() - eventStart.getTime()) / 86400000);
      if (daysDiff < 0) return false;
      if (count && daysDiff / interval >= count) return false;
      return daysDiff % interval === 0;
    }

    case 'WEEKLY': {
      // Check if target day matches BYDAY or original event day
      const matchDays = byDay.length > 0
        ? byDay.map(d => DAY_MAP[d]).filter(d => d !== undefined)
        : [eventStart.getDay()];
      if (!matchDays.includes(targetDay)) return false;

      // Check interval (every N weeks)
      if (interval > 1) {
        const weeksDiff = Math.floor((target.getTime() - eventStart.getTime()) / (7 * 86400000));
        if (weeksDiff % interval !== 0) return false;
      }
      return true;
    }

    case 'MONTHLY': {
      // Simple: same day of month
      if (target.getDate() !== eventStart.getDate()) return false;
      const monthsDiff = (target.getFullYear() - eventStart.getFullYear()) * 12 + (target.getMonth() - eventStart.getMonth());
      if (monthsDiff < 0) return false;
      if (count && monthsDiff / interval >= count) return false;
      return monthsDiff % interval === 0;
    }

    case 'YEARLY': {
      if (target.getMonth() !== eventStart.getMonth() || target.getDate() !== eventStart.getDate()) return false;
      const yearsDiff = target.getFullYear() - eventStart.getFullYear();
      if (yearsDiff < 0) return false;
      if (count && yearsDiff / interval >= count) return false;
      return yearsDiff % interval === 0;
    }

    default:
      return false;
  }
}

function parseICalDate(dateStr: string): Date | null {
  try {
    // Format: YYYYMMDD or YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
    const clean = dateStr.replace(/[^0-9TZ]/g, '');
    if (clean.length === 8) {
      // All-day event: YYYYMMDD
      return new Date(`${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00`);
    }
    if (clean.length >= 15) {
      // Date with time: YYYYMMDDTHHMMSS(Z)
      const iso = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`;
      return clean.endsWith('Z') ? new Date(iso + 'Z') : new Date(iso);
    }
    return null;
  } catch {
    return null;
  }
}

function unescapeIcal(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** Fetch a single iCal feed and return parsed events */
async function fetchSingleCalendar(
  source: CalendarSource,
  targetDate: string
): Promise<ExternalCalendarEvent[]> {
  try {
    const response = await fetch(source.url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'OperatorOS/1.0 (Calendar Sync)',
        'Accept': 'text/calendar, text/plain, */*',
      },
    });

    if (!response.ok) {
      console.error(`Calendar "${source.label}" fetch failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const icalData = await response.text();

    if (!icalData.includes('BEGIN:VCALENDAR')) {
      console.error(`Calendar "${source.label}" response is not valid iCal data.`);
      return [];
    }

    const events = parseICalEvents(icalData, targetDate);
    // Tag each event with its source calendar colour and label
    return events.map(e => ({
      ...e,
      calendarColor: source.color,
      calendarLabel: source.label,
    }));
  } catch (error) {
    console.error(`Failed to fetch calendar "${source.label}":`, error);
    return [];
  }
}

/** Fetch and parse external calendar events from ALL enabled calendars */
export async function getExternalCalendarEvents(targetDate: string): Promise<ExternalCalendarEvent[]> {
  try {
    const sources = await getCalendarSources();
    const enabled = sources.filter(s => s.enabled && s.url);
    if (enabled.length === 0) return [];

    // Fetch all calendars in parallel
    const results = await Promise.all(
      enabled.map(s => fetchSingleCalendar(s, targetDate).catch(() => [] as ExternalCalendarEvent[]))
    );

    // Merge and sort
    const allEvents = results.flat();
    allEvents.sort((a, b) => a.start.localeCompare(b.start));
    return allEvents;
  } catch (error) {
    console.error('Failed to fetch external calendars:', error);
    return [];
  }
}

/** Test a single calendar URL and return event count for today */
export async function testCalendarUrl(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const normalised = url.replace(/^webcal:\/\//, 'https://');
    const today = new Date().toISOString().split('T')[0];

    const response = await fetch(normalised, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'OperatorOS/1.0 (Calendar Sync)',
        'Accept': 'text/calendar, text/plain, */*',
      },
    });

    if (!response.ok) {
      return { ok: false, message: `Fetch failed (${response.status}). Check the URL is correct.` };
    }

    const icalData = await response.text();
    if (!icalData.includes('BEGIN:VCALENDAR')) {
      return { ok: false, message: 'Response is not a valid calendar feed.' };
    }

    const events = parseICalEvents(icalData, today);
    if (events.length > 0) {
      return { ok: true, message: `Connected — ${events.length} event${events.length !== 1 ? 's' : ''} today` };
    }
    return { ok: true, message: 'Connected — no events today' };
  } catch {
    return { ok: false, message: 'Failed to reach calendar. Check the URL.' };
  }
}
