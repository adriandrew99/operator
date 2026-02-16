'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { calculateDailyLoad, getLoadLevel, DAILY_CAPACITY } from '@/lib/utils/mental-load';
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
  const loadLevel = getLoadLevel(dailyLoad, capacity);
  const totalCount = allTasks.length;
  const doneCount = completedTodayTasks.length;

  const greeting = getGreeting();
  const firstName = userName?.split(' ')[0] || '';

  // Current time for event highlighting
  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <section className="card-surface border border-border rounded-2xl px-4 sm:px-6 py-4 sm:py-5">
      {/* Greeting row */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-text-primary tracking-tight truncate">
            {greeting}{firstName ? `, ${firstName}` : ''}
          </h2>
          {streakDays > 0 && (
            <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full flex-shrink-0">
              {streakDays}d streak
            </span>
          )}
        </div>
        {weather && (
          <span className="text-xs text-text-secondary flex-shrink-0">
            {weather.icon} {weather.temp}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Tasks"
          value={`${doneCount}/${totalCount}`}
          done={doneCount >= totalCount && totalCount > 0}
        />
        <Stat
          label="Load"
          value={`${Math.round(dailyLoad)}/${capacity}`}
          color={
            loadLevel === 'light' ? 'text-emerald-400' :
            loadLevel === 'moderate' ? 'text-accent' :
            loadLevel === 'heavy' ? 'text-amber-400' : 'text-red-400'
          }
        />
        <Stat
          label="Habits"
          value={`${fundamentalsHit}/${fundamentalsTotal}`}
          done={fundamentalsHit >= fundamentalsTotal && fundamentalsTotal > 0}
        />
      </div>

      {/* Calendar events — show all today's events */}
      {calendarEvents.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5">
          <p className="text-[9px] text-text-tertiary uppercase tracking-wider font-medium mb-1.5">Schedule</p>
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
                      !event.color && (isCurrent ? 'bg-accent' : isPast ? 'bg-text-tertiary/30' : 'bg-blue-400')
                    )}
                    style={event.color ? { backgroundColor: isPast ? undefined : event.color, opacity: isPast ? 0.3 : undefined } : undefined}
                  />
                  <span className="text-[10px] text-text-tertiary font-mono w-[72px] flex-shrink-0">
                    {event.start_time.slice(0, 5)}{event.end_time ? `–${event.end_time.slice(0, 5)}` : ''}
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

function Stat({ label, value, done, color }: { label: string; value: string; done?: boolean; color?: string }) {
  return (
    <div className="text-center">
      <p className={cn(
        'text-sm sm:text-base font-bold font-mono leading-none',
        done ? 'text-accent' : color || 'text-text-primary'
      )}>
        {value}
      </p>
      <p className="text-[9px] text-text-tertiary uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
