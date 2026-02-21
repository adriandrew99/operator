'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { calculateDailyLoad, DAILY_CAPACITY } from '@/lib/utils/mental-load';
import type { Task, Client, CalendarEvent } from '@/lib/types/database';
import type { RecurringTaskWithStatus } from '@/lib/types/recurring';

interface DayOverviewProps {
  todayTasks: Task[];
  completedTodayTasks: Task[];
  weekTasks: Task[];
  recurringTasks: RecurringTaskWithStatus[];
  clients: Client[];
  calendarEvents?: CalendarEvent[];
  today: string;
  fundamentalsHit: number;
  fundamentalsTotal: number;
  streakDays: number;
  dailyCapacity?: number;
  userName?: string;
  monthlyRevenue?: number;
  monthlyExpenses?: number;
  leftInCompany?: number;
}

interface WeatherData {
  temp: string;
  condition: string;
  icon: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatFullDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

const WEATHER_ICONS: Record<string, string> = {
  'Clear': '\u2600\uFE0F', 'Sunny': '\u2600\uFE0F', 'Partly cloudy': '\u26C5',
  'Cloudy': '\u2601\uFE0F', 'Overcast': '\u2601\uFE0F', 'Mist': '\uD83C\uDF2B\uFE0F',
  'Fog': '\uD83C\uDF2B\uFE0F', 'Light rain': '\uD83C\uDF26\uFE0F', 'Rain': '\uD83C\uDF27\uFE0F',
  'Heavy rain': '\uD83C\uDF27\uFE0F', 'Light drizzle': '\uD83C\uDF26\uFE0F', 'Drizzle': '\uD83C\uDF26\uFE0F',
  'Thunderstorm': '\u26C8\uFE0F', 'Snow': '\uD83C\uDF28\uFE0F', 'Light snow': '\uD83C\uDF28\uFE0F',
  'Sleet': '\uD83C\uDF28\uFE0F',
};

function getWeatherIcon(condition: string): string {
  if (WEATHER_ICONS[condition]) return WEATHER_ICONS[condition];
  const lower = condition.toLowerCase();
  if (lower.includes('rain') || lower.includes('drizzle')) return '\uD83C\uDF27\uFE0F';
  if (lower.includes('cloud') || lower.includes('overcast')) return '\u2601\uFE0F';
  if (lower.includes('snow') || lower.includes('sleet')) return '\uD83C\uDF28\uFE0F';
  if (lower.includes('fog') || lower.includes('mist')) return '\uD83C\uDF2B\uFE0F';
  if (lower.includes('thunder') || lower.includes('storm')) return '\u26C8\uFE0F';
  if (lower.includes('sun') || lower.includes('clear')) return '\u2600\uFE0F';
  return '\uD83C\uDF24\uFE0F';
}

export function DayOverview({
  todayTasks,
  completedTodayTasks,
  calendarEvents = [],
  today,
  fundamentalsHit,
  fundamentalsTotal,
  streakDays,
  dailyCapacity,
  userName,
}: DayOverviewProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const cached = sessionStorage.getItem('weather-cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.ts && Date.now() - parsed.ts < 30 * 60 * 1000) {
          setWeather(parsed.data);
          return;
        }
      } catch { /* ignore */ }
    }

    fetch('https://wttr.in/?format=j1', { signal: AbortSignal.timeout(5000) })
      .then(res => res.json())
      .then(data => {
        const current = data.current_condition?.[0];
        if (current) {
          const weatherData: WeatherData = {
            temp: current.temp_C + '\u00B0',
            condition: current.weatherDesc?.[0]?.value || '',
            icon: getWeatherIcon(current.weatherDesc?.[0]?.value || ''),
          };
          setWeather(weatherData);
          sessionStorage.setItem('weather-cache', JSON.stringify({ data: weatherData, ts: Date.now() }));
        }
      })
      .catch(() => {});
  }, []);

  const capacity = dailyCapacity ?? DAILY_CAPACITY;
  const allTasks = [...todayTasks, ...completedTodayTasks];
  const dailyLoad = calculateDailyLoad(allTasks);
  const totalCount = allTasks.length;
  const doneCount = completedTodayTasks.length;

  const greeting = getGreeting();
  const firstName = userName?.split(' ')[0] || '';
  const dateStr = formatFullDate();

  // Current time for event highlighting
  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <section className="space-y-5">
      {/* ━━━ Greeting — open typography, no card ━━━ */}
      <div>
        <h2 className="heading-serif text-2xl sm:text-4xl text-text-primary">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h2>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <p className="text-base text-text-secondary">{dateStr}</p>
          {weather && (
            <span className="text-sm text-text-tertiary">
              {weather.icon} {weather.temp}
            </span>
          )}
          {streakDays > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-text-secondary font-sans font-medium px-2.5 py-0.5 rounded-full bg-text-primary/8 border border-border">
              {streakDays}d streak
            </span>
          )}
        </div>
      </div>

      {/* ━━━ Inline stats — quiet, typographic ━━━ */}
      <p className="text-sm text-text-tertiary font-sans">
        <span className="text-text-secondary">{doneCount}</span>
        <span>/{totalCount} tasks</span>
        <span className="mx-2 text-border">·</span>
        <span className="text-text-secondary">{Math.round(dailyLoad)}</span>
        <span>/{capacity} MLU</span>
        {fundamentalsTotal > 0 && (
          <>
            <span className="mx-2 text-border">·</span>
            <span className="text-text-secondary">{fundamentalsHit}</span>
            <span>/{fundamentalsTotal} fundamentals</span>
          </>
        )}
      </p>

      {/* ━━━ Calendar events ━━━ */}
      {calendarEvents.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-text-tertiary font-medium font-sans mb-2">Schedule</p>
          {calendarEvents
            .filter(e => e.date === today)
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .map(event => {
              const isPast = event.end_time && event.end_time < nowTime;
              const isCurrent = event.start_time <= nowTime && (!event.end_time || event.end_time > nowTime);
              return (
                <div key={event.id} className={cn(
                  'flex items-center gap-2.5',
                  isPast && 'opacity-40'
                )}>
                  <div
                    className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      isCurrent && 'animate-pulse',
                      !event.color && (isCurrent ? 'bg-text-primary' : isPast ? 'bg-text-tertiary/30' : 'bg-text-secondary')
                    )}
                    style={event.color ? { backgroundColor: isPast ? undefined : event.color, opacity: isPast ? 0.3 : undefined } : undefined}
                  />
                  <span className="text-xs text-text-tertiary font-mono w-auto sm:w-[72px] flex-shrink-0 whitespace-nowrap">
                    {event.start_time.slice(0, 5)}{event.end_time ? `\u2013${event.end_time.slice(0, 5)}` : ''}
                  </span>
                  <span className={cn(
                    'text-xs truncate',
                    isCurrent ? 'text-text-primary font-medium' : 'text-text-secondary'
                  )}>{event.title}</span>
                </div>
              );
            })}
        </div>
      )}
    </section>
  );
}
