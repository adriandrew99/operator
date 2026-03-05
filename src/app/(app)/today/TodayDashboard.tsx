'use client';

import { useState, useCallback, useMemo, useTransition, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { FundamentalsTracker } from '@/components/today/FundamentalsTracker';
import { MonkeyBrainOverride } from '@/components/today/MonkeyBrainOverride';
import { DailyTasks } from '@/components/today/DailyTasks';
import { TodayTasks } from '@/components/today/TodayTasks';
import { HabitInsights } from '@/components/today/HabitInsights';
import { WeekView } from '@/components/today/WeekView';
import { RevenueRadar } from '@/components/insights/RevenueRadar';
import { EnergyRouter } from '@/components/insights/EnergyRouter';
import { InfoBox } from '@/components/ui/InfoBox';
import { CelebrationBurst } from '@/components/ui/CelebrationBurst';
import { CompletionCelebration } from '@/components/ui/CompletionCelebration';
import { DayInReview } from '@/components/today/DayInReview';
import { useUndoStack } from '@/hooks/useUndoStack';
import { calculateDailyLoad, DAILY_CAPACITY, getLoadLevel, type LoadLevel } from '@/lib/utils/mental-load';
import { savePinnedNote, unpinNote } from '@/actions/pinned-notes';
import type { CustomFundamental, Task, Client, CalendarEvent, OperatorScore, PinnedNote } from '@/lib/types/database';
import type { RecurringTaskWithStatus } from '@/lib/types/recurring';

// ━━━ Daily quotes — rotates by day of year ━━━
const DAILY_QUOTES = [
  { text: 'The obstacle is the way.', author: 'Marcus Aurelius' },
  { text: 'We are what we repeatedly do. Excellence is not an act, but a habit.', author: 'Aristotle' },
  { text: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
  { text: 'The best way to predict the future is to create it.', author: 'Peter Drucker' },
  { text: 'Done is better than perfect.', author: 'Sheryl Sandberg' },
  { text: 'What gets measured gets managed.', author: 'Peter Drucker' },
  { text: 'Discipline equals freedom.', author: 'Jocko Willink' },
  { text: 'Small daily improvements over time lead to stunning results.', author: 'Robin Sharma' },
  { text: 'Energy, not time, is the fundamental currency of high performance.', author: 'Jim Loehr' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'The most dangerous form of procrastination is the one that feels productive.', author: 'James Clear' },
  { text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
  { text: 'Your margin is your message.', author: 'Unknown' },
  { text: 'Revenue solves all known problems.', author: 'Eric Ries' },
  { text: 'Strategy is about making choices, trade-offs; it\'s about deliberately choosing to be different.', author: 'Michael Porter' },
  { text: 'Execution eats strategy for breakfast.', author: 'Peter Drucker' },
  { text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney' },
  { text: 'Hard choices, easy life. Easy choices, hard life.', author: 'Jerzy Gregorek' },
  { text: 'Compound interest is the eighth wonder of the world.', author: 'Albert Einstein' },
  { text: 'If you can\'t explain it simply, you don\'t understand it well enough.', author: 'Albert Einstein' },
  { text: 'The goal is not to be busy. The goal is to be effective.', author: 'Unknown' },
  { text: 'Work expands to fill the time available for its completion.', author: 'Parkinson\'s Law' },
  { text: 'Perfectionism is the voice of the oppressor.', author: 'Anne Lamott' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Ship it.', author: 'Seth Godin' },
  { text: 'Good enough today is better than perfect tomorrow.', author: 'Unknown' },
  { text: 'Protect the asset.', author: 'Greg McKeown' },
  { text: 'Less but better.', author: 'Dieter Rams' },
  { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
  { text: 'You can do anything, but not everything.', author: 'David Allen' },
  { text: 'If everything is important, then nothing is.', author: 'Patrick Lencioni' },
];

function getDailyQuote(): { text: string; author: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getLoadAccent(level: LoadLevel): string {
  switch (level) {
    case 'light': return 'text-accent-green';
    case 'moderate': return 'text-accent-blue';
    case 'heavy': return 'text-warning';
    case 'overloaded': return 'text-danger';
  }
}

function getLoadBg(level: LoadLevel): string {
  switch (level) {
    case 'light': return 'bg-accent-green/10';
    case 'moderate': return 'bg-accent-blue/10';
    case 'heavy': return 'bg-warning/10';
    case 'overloaded': return 'bg-danger/10';
  }
}

function getLoadLabel(level: LoadLevel): string {
  switch (level) {
    case 'light': return 'Light';
    case 'moderate': return 'Balanced';
    case 'heavy': return 'Heavy';
    case 'overloaded': return 'Overloaded';
  }
}

function getLoadBarColor(level: LoadLevel): string {
  switch (level) {
    case 'light': return 'bg-accent-green';
    case 'moderate': return 'bg-accent-blue';
    case 'heavy': return 'bg-warning';
    case 'overloaded': return 'bg-danger';
  }
}

interface TodayDashboardProps {
  customFundamentals: CustomFundamental[];
  fundamentalCompletions: Record<string, boolean>;
  streakDays: number;
  recurringTasks: RecurringTaskWithStatus[];
  allRecurringTasks?: RecurringTaskWithStatus[];
  todayTasks: Task[];
  completedTodayTasks?: Task[];
  weekTasks: Task[];
  today: string;
  clients: Client[];
  monthlyRevenue?: number;
  monthlyExpenses?: number;
  leftInCompany?: number;
  dailyCapacity?: number;
  calendarEvents?: CalendarEvent[];
  userName?: string;
  recurringStreaks?: Record<string, number>;
  todayScore?: OperatorScore | null;
  pinnedNote?: PinnedNote | null;
  confirmedMRR?: number;
}

export function TodayDashboard({
  customFundamentals,
  fundamentalCompletions,
  streakDays,
  recurringTasks,
  allRecurringTasks,
  todayTasks,
  completedTodayTasks = [],
  weekTasks,
  today,
  clients,
  dailyCapacity = DAILY_CAPACITY,
  calendarEvents = [],
  recurringStreaks,
  todayScore,
  pinnedNote,
  confirmedMRR = 0,
  userName,
}: TodayDashboardProps) {
  const [sharedCompletedIds, setSharedCompletedIds] = useState<Set<string>>(new Set());
  const [externalUncompletedIds, setExternalUncompletedIds] = useState<Set<string>>(new Set());
  const [showMore, setShowMore] = useState(false);
  const [currentScore, setCurrentScore] = useState<OperatorScore | null>(todayScore ?? null);
  const [computedDailyLoad, setComputedDailyLoad] = useState<number | null>(null);
  const [computedTaskCounts, setComputedTaskCounts] = useState<{ completed: number; total: number } | null>(null);

  const [celebrationPlayed, setCelebrationPlayed] = useState(() => {
    const serverDoneIds = new Set(completedTodayTasks.map(t => t.id));
    const activeFromServer = todayTasks.filter(t => !serverDoneIds.has(t.id));
    const totalFromServer = activeFromServer.length + serverDoneIds.size;
    return totalFromServer > 0 && serverDoneIds.size >= totalFromServer;
  });

  const handleUndo = useCallback((entry: import('@/hooks/useUndoStack').UndoEntry) => {
    if (entry.type === 'complete') {
      setSharedCompletedIds(prev => { const n = new Set(prev); n.delete(entry.taskId); return n; });
      setExternalUncompletedIds(prev => new Set(prev).add(entry.taskId));
    } else if (entry.type === 'uncomplete') {
      setSharedCompletedIds(prev => new Set(prev).add(entry.taskId));
    }
  }, []);

  const { pushUndo, canUndo, undo, toast: undoToast } = useUndoStack(handleUndo);

  const fundamentalsHitCount = customFundamentals.filter(
    (f) => fundamentalCompletions[f.id]
  ).length;
  const fundamentalsTotal = customFundamentals.length;

  const onTaskCompleted = useCallback((taskId: string) => {
    setSharedCompletedIds(prev => new Set(prev).add(taskId));
    setExternalUncompletedIds(prev => { const n = new Set(prev); n.delete(taskId); return n.size === prev.size ? prev : n; });
  }, []);
  const onTaskUncompleted = useCallback((taskId: string) => {
    setSharedCompletedIds(prev => { const n = new Set(prev); n.delete(taskId); return n; });
  }, []);
  const onDailyLoadChange = useCallback((load: number) => {
    setComputedDailyLoad(load);
  }, []);
  const onTaskCountsChange = useCallback((completed: number, total: number) => {
    setComputedTaskCounts({ completed, total });
  }, []);

  // Celebration tracking
  const serverCompletedIds = new Set(completedTodayTasks.map(t => t.id));
  const allCompletedIds = new Set([...sharedCompletedIds, ...serverCompletedIds]);
  const stillActiveTasks = todayTasks.filter(t => !allCompletedIds.has(t.id));
  const totalPlanTasks = stillActiveTasks.length + allCompletedIds.size;
  const allTasksDone = totalPlanTasks > 0 && allCompletedIds.size >= totalPlanTasks;
  const allFundamentalsDone = fundamentalsTotal > 0 && fundamentalsHitCount >= fundamentalsTotal;
  const completedCount = computedTaskCounts?.completed ?? allCompletedIds.size;
  const totalCount = computedTaskCounts?.total ?? totalPlanTasks;

  // Energy data for metrics
  const energyData = useMemo(() => {
    const allTasks = [...todayTasks, ...completedTodayTasks];
    const serverMLU = calculateDailyLoad(allTasks);
    const totalMLU = computedDailyLoad ?? serverMLU;
    const completedMLU = calculateDailyLoad(completedTodayTasks);
    const capacityPct = Math.min(100, (totalMLU / dailyCapacity) * 100);
    const usedPct = totalMLU > 0 ? Math.min(100, (completedMLU / dailyCapacity) * 100) : 0;
    const loadLevel = getLoadLevel(totalMLU, dailyCapacity);
    const nonPersonal = allTasks.filter(t => !('is_personal' in t && t.is_personal));
    const highTasks = nonPersonal.filter(t => (t.weight || 'medium') === 'high').length;
    const creativeTasks = nonPersonal.filter(t => (t.energy || 'admin') === 'creative').length;
    return { totalMLU, completedMLU, capacityPct, usedPct, loadLevel, highTasks, creativeTasks };
  }, [todayTasks, completedTodayTasks, dailyCapacity, computedDailyLoad]);

  const quote = useMemo(() => getDailyQuote(), []);
  const activeClientCount = clients.filter(c => {
    if (!c.is_active || !c.retainer_amount) return false;
    if (c.termination_date) {
      const termDate = new Date(c.termination_date + 'T12:00:00');
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      if (termDate < monthStart) return false;
    }
    return true;
  }).length;

  const recurringCompletedCount = recurringTasks.filter(t => t.completedToday).length;
  const taskCompletionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const fundamentalsPct = fundamentalsTotal > 0 ? Math.round((fundamentalsHitCount / fundamentalsTotal) * 100) : 0;

  // Calendar events for today
  const todayEvents = useMemo(() => {
    return calendarEvents
      .filter(e => {
        const eventDate = e.start_time?.split('T')[0] || e.date;
        return eventDate === today;
      })
      .sort((a, b) => {
        const aTime = a.start_time || '';
        const bTime = b.start_time || '';
        return aTime.localeCompare(bTime);
      });
  }, [calendarEvents, today]);

  const greeting = getGreeting();
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ━━━ HERO SECTION ━━━ */}
      <div className="relative overflow-hidden rounded-2xl card-enter">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.08] via-surface-secondary to-surface-secondary" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-accent/[0.04] to-transparent" />

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            {/* Left: Greeting */}
            <div className="space-y-1">
              <p className="text-xs text-text-tertiary uppercase tracking-[0.1em] font-medium">{dateStr}</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                {greeting}{userName ? `, ${userName}` : ''}
              </h1>
              <p className="text-sm text-text-tertiary italic">
                &ldquo;{quote.text}&rdquo; — <span className="text-text-secondary">{quote.author}</span>
              </p>
            </div>

            {/* Right: Quick pulse */}
            <div className="flex items-center gap-4">
              {streakDays > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
                  <span className="text-sm">🔥</span>
                  <span className="text-xs font-semibold text-accent">{streakDays}d</span>
                </div>
              )}
              <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border', getLoadBg(energyData.loadLevel), 'border-transparent')}>
                <div className={cn('w-1.5 h-1.5 rounded-full', getLoadBarColor(energyData.loadLevel))} />
                <span className={cn('text-xs font-medium', getLoadAccent(energyData.loadLevel))}>{getLoadLabel(energyData.loadLevel)}</span>
              </div>
            </div>
          </div>

          {/* Pinned Note */}
          <PinnedNoteSection pinnedNote={pinnedNote} />
        </div>
      </div>

      {/* ━━━ METRIC CARDS — 4 distinct cards ━━━ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 card-enter" style={{ animationDelay: '40ms' }}>
        {/* Capacity / Load */}
        <div className="relative overflow-hidden rounded-xl bg-surface-secondary border border-border p-4 group hover:border-border-light transition-colors">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium">Capacity</p>
            <div className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', getLoadBg(energyData.loadLevel), getLoadAccent(energyData.loadLevel))}>
              {Math.round(energyData.capacityPct)}%
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-text-primary tabular-nums">{Math.round(energyData.totalMLU)}</span>
            <span className="text-sm text-text-tertiary font-mono">/ {dailyCapacity}</span>
          </div>
          {/* Mini capacity bar */}
          <div className="mt-3 h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
            <div className="h-full flex">
              <div
                className={cn('h-full rounded-full transition-all duration-700', getLoadBarColor(energyData.loadLevel))}
                style={{ width: `${energyData.usedPct}%` }}
              />
              <div
                className="h-full bg-text-tertiary/10 transition-all duration-700"
                style={{ width: `${Math.max(0, energyData.capacityPct - energyData.usedPct)}%` }}
              />
            </div>
          </div>
          <p className="text-[10px] text-text-tertiary mt-1.5">
            {energyData.highTasks > 0 && `${energyData.highTasks} heavy`}
            {energyData.highTasks > 0 && energyData.creativeTasks > 0 && ' · '}
            {energyData.creativeTasks > 0 && `${energyData.creativeTasks} creative`}
            {energyData.highTasks === 0 && energyData.creativeTasks === 0 && `${Math.round(energyData.completedMLU)} MLU done`}
          </p>
        </div>

        {/* Tasks */}
        <div className="relative overflow-hidden rounded-xl bg-surface-secondary border border-border p-4 group hover:border-border-light transition-colors">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium">Tasks</p>
            {taskCompletionPct === 100 && totalCount > 0 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green">Done ✓</span>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-text-primary tabular-nums">{completedCount}</span>
            <span className="text-sm text-text-tertiary font-mono">/ {totalCount}</span>
          </div>
          {/* Mini ring */}
          <div className="mt-2 flex items-center gap-2">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="var(--surface-tertiary)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="14" fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${taskCompletionPct * 0.88} 88`}
                className="transition-all duration-700"
              />
            </svg>
            <span className="text-xs text-text-tertiary">{taskCompletionPct}% complete</span>
          </div>
        </div>

        {/* MRR */}
        <div className="relative overflow-hidden rounded-xl bg-surface-secondary border border-border p-4 group hover:border-border-light transition-colors">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium">MRR</p>
          </div>
          <span className="text-2xl font-bold text-text-primary tabular-nums">
            £{confirmedMRR >= 1000 ? `${(confirmedMRR / 1000).toFixed(1)}k` : confirmedMRR.toLocaleString()}
          </span>
          <p className="text-[10px] text-text-tertiary mt-2">{activeClientCount} active client{activeClientCount !== 1 ? 's' : ''}</p>
          {/* Mini indicator */}
          <div className="mt-1.5 flex gap-1">
            {Array.from({ length: Math.min(activeClientCount, 6) }).map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-accent/40" />
            ))}
          </div>
        </div>

        {/* Habits */}
        <div className="relative overflow-hidden rounded-xl bg-surface-secondary border border-border p-4 group hover:border-border-light transition-colors">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium">Habits</p>
            {allFundamentalsDone && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green">All hit ✓</span>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-text-primary tabular-nums">{fundamentalsHitCount}</span>
            <span className="text-sm text-text-tertiary font-mono">/ {fundamentalsTotal}</span>
          </div>
          {/* Mini ring */}
          <div className="mt-2 flex items-center gap-2">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="var(--surface-tertiary)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="14" fill="none"
                stroke="var(--accent-green)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${fundamentalsPct * 0.88} 88`}
                className="transition-all duration-700"
              />
            </svg>
            {streakDays > 0 ? (
              <span className="text-xs text-accent">{streakDays}d streak</span>
            ) : (
              <span className="text-xs text-text-tertiary">{fundamentalsPct}% today</span>
            )}
          </div>
        </div>
      </div>

      {/* ━━━ MAIN CONTENT: 3-Column Layout ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 card-enter" style={{ animationDelay: '80ms' }}>

        {/* ── LEFT COLUMN: Task Plan ── */}
        <div className="space-y-5">
          {/* Today's Focus / Tasks */}
          <section className="bg-surface-secondary border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-1">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-text-primary">Today&apos;s Plan</h2>
                <InfoBox title="Today's Plan">
                  <p>Tasks flagged for today or with today&apos;s deadline. Add tasks inline with weight + client assignment.</p>
                </InfoBox>
              </div>
              {totalCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1 rounded-full bg-surface-tertiary overflow-hidden">
                    <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${taskCompletionPct}%` }} />
                  </div>
                  <span className="text-[11px] text-text-tertiary tabular-nums">{completedCount}/{totalCount}</span>
                </div>
              )}
            </div>
            <div className="px-6 pb-5">
              <TodayTasks
                tasks={todayTasks}
                clients={clients}
                completedTodayTasks={completedTodayTasks}
                weekTasks={weekTasks}
                todayStr={today}
                onTaskCompleted={onTaskCompleted}
                onTaskUncompleted={onTaskUncompleted}
                dailyCapacity={dailyCapacity}
                pushUndo={pushUndo}
                externalUncompletedIds={externalUncompletedIds}
                onDailyLoadChange={onDailyLoadChange}
                onTaskCountsChange={onTaskCountsChange}
              />
            </div>
          </section>

          {/* Week Overview */}
          <section className="bg-surface-secondary border border-border rounded-2xl p-6">
            <WeekView
              weekTasks={weekTasks}
              todayStr={today}
              recurringTasks={recurringTasks}
              clients={clients}
              externalCompletedIds={sharedCompletedIds}
              pushUndo={pushUndo}
              dailyCapacity={dailyCapacity}
            />
          </section>
        </div>

        {/* ── RIGHT COLUMN: Command Center ── */}
        <div className="space-y-4">

          {/* Energy Router — "Do Next" */}
          <div className="bg-surface-secondary border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-md bg-accent/10 flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-text-primary uppercase tracking-[0.06em]">Do Next</p>
            </div>
            <EnergyRouter
              todayTasks={todayTasks}
              fundamentalsCompleted={fundamentalsHitCount}
              fundamentalsTotal={fundamentalsTotal}
              compact
            />
          </div>

          {/* Calendar Events */}
          {todayEvents.length > 0 && (
            <div className="bg-surface-secondary border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-md bg-accent-blue/10 flex items-center justify-center">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-text-primary uppercase tracking-[0.06em]">Schedule</p>
                <span className="text-[10px] text-text-tertiary ml-auto">{todayEvents.length} event{todayEvents.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-1">
                {todayEvents.slice(0, 5).map((event, i) => {
                  const now = new Date();
                  const startTime = event.start_time ? new Date(event.start_time) : null;
                  const endTime = event.end_time ? new Date(event.end_time) : null;
                  const isCurrent = startTime && endTime && now >= startTime && now <= endTime;
                  const isPast = endTime ? now > endTime : false;
                  const timeStr = startTime
                    ? startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                    : 'All day';

                  return (
                    <div
                      key={event.id || i}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                        isCurrent ? 'bg-accent/[0.06] border border-accent/20' : 'hover:bg-surface-tertiary',
                        isPast && 'opacity-40'
                      )}
                    >
                      <div className={cn(
                        'w-1 h-6 rounded-full flex-shrink-0',
                        isCurrent ? 'bg-accent animate-pulse' : isPast ? 'bg-surface-tertiary' : 'bg-accent-blue/40'
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-xs truncate', isPast ? 'text-text-tertiary' : 'text-text-primary')}>
                          {event.title}
                        </p>
                        <p className="text-[10px] text-text-tertiary">{timeStr}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fundamentals */}
          <div className="bg-surface-secondary border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-accent-green/10 flex items-center justify-center">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-text-primary uppercase tracking-[0.06em]">Fundamentals</p>
              </div>
              <span className="text-[11px] text-text-tertiary tabular-nums">{fundamentalsHitCount}/{fundamentalsTotal}</span>
            </div>
            <FundamentalsTracker
              fundamentals={customFundamentals}
              completions={fundamentalCompletions}
              compact
            />
          </div>

          {/* Recurring Tasks */}
          <div className="bg-surface-secondary border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-purple-500/10 flex items-center justify-center">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgb(168,85,247)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-text-primary uppercase tracking-[0.06em]">Recurring</p>
              </div>
              <span className="text-[11px] text-text-tertiary tabular-nums">{recurringCompletedCount}/{recurringTasks.length}</span>
            </div>
            <DailyTasks
              tasks={recurringTasks}
              allTasks={allRecurringTasks || recurringTasks}
              clients={clients}
              streaks={recurringStreaks}
              compact
            />
          </div>

          {/* Insights Preview */}
          <div className="bg-surface-secondary border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-md bg-amber-500/10 flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgb(245,158,11)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-text-primary uppercase tracking-[0.06em]">Insights</p>
            </div>
            <HabitInsights
              fundamentals={customFundamentals}
              completions={fundamentalCompletions}
              recurringTasks={recurringTasks}
              todayTasks={todayTasks}
              streakDays={streakDays}
            />
          </div>
        </div>
      </div>

      {/* ━━━ EXPANDABLE SECTION ━━━ */}
      <div className="card-enter" style={{ animationDelay: '120ms' }}>
        <button
          onClick={() => setShowMore(prev => !prev)}
          className="w-full flex items-center justify-center gap-2 py-3 text-xs text-text-tertiary hover:text-text-secondary transition-colors rounded-xl hover:bg-surface-secondary"
        >
          <span>{showMore ? 'Show less' : 'More tools'}</span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {showMore && (
        <div className="space-y-5 animate-fade-in">
          {clients.length > 0 && (
            <section className="bg-surface-secondary border border-border rounded-2xl p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4">Revenue Radar</h2>
              <RevenueRadar clients={clients} />
            </section>
          )}

          <MonkeyBrainOverride />
        </div>
      )}

      {/* ━━━ DAY IN REVIEW ━━━ */}
      <DayInReview
        todayTasks={todayTasks}
        completedTodayTasks={completedTodayTasks}
        clients={clients}
        fundamentalsHit={fundamentalsHitCount}
        fundamentalsTotal={fundamentalsTotal}
        allTasksDone={allTasksDone}
        dailyCapacity={dailyCapacity}
        existingCheckIn={currentScore?.check_in ?? null}
        existingNotes={currentScore?.notes ?? null}
        onCheckInSaved={setCurrentScore}
        celebrationPlayed={celebrationPlayed}
      />

      {/* ━━━ CELEBRATIONS ━━━ */}
      <CompletionCelebration trigger={allTasksDone} onComplete={() => setCelebrationPlayed(true)} />
      <CelebrationBurst trigger={allFundamentalsDone} message="Fundamentals crushed!" />

      {/* ━━━ UNDO TOAST ━━━ */}
      {undoToast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-surface-elevated border border-border flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-lg">
            <span className="text-xs text-text-secondary">{undoToast}</span>
          </div>
        </div>
      )}
      {canUndo && !undoToast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50">
          <button
            onClick={undo}
            className="bg-surface-elevated border border-border flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-text-tertiary hover:text-text-primary transition-all duration-200 cursor-pointer shadow-lg"
            title="Undo last action (Cmd+Z)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6" /><path d="M3 13a9 9 0 0 1 3-6.36A9 9 0 0 1 21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.36-2.64" />
            </svg>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

// ━━━ Pinned Note — Compact inline ━━━
function PinnedNoteSection({ pinnedNote }: { pinnedNote?: PinnedNote | null }) {
  const [isEditing, setIsEditing] = useState(false);
  const [noteText, setNoteText] = useState(pinnedNote?.content || '');
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
    }
  }, [isEditing]);

  function handleSaveNote() {
    startTransition(async () => {
      await savePinnedNote(noteText);
      setIsEditing(false);
    });
  }

  function handleUnpin() {
    if (!pinnedNote) return;
    startTransition(async () => {
      await unpinNote(pinnedNote.id);
      setNoteText('');
    });
  }

  if (isEditing) {
    return (
      <div className="mt-4 space-y-2">
        <textarea
          ref={inputRef}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveNote(); }
            if (e.key === 'Escape') { setIsEditing(false); setNoteText(pinnedNote?.content || ''); }
          }}
          placeholder="Pin a note for today..."
          className="w-full bg-surface-tertiary/50 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary resize-none outline-none leading-relaxed border border-border focus:border-accent/30"
          rows={2}
          maxLength={280}
        />
        <div className="flex items-center gap-2">
          <button onClick={handleSaveNote} disabled={isPending} className="text-[11px] text-accent hover:text-accent-bright transition-colors font-medium">
            {isPending ? 'Saving...' : 'Pin'}
          </button>
          <button onClick={() => { setIsEditing(false); setNoteText(pinnedNote?.content || ''); }} className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (pinnedNote?.content) {
    return (
      <div className="mt-4 group flex items-start gap-2 px-3 py-2 rounded-lg bg-accent/[0.04] border border-accent/10">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent mt-0.5 flex-shrink-0">
          <path d="M12 2l0 20" /><path d="M18 8l-6-6-6 6" /><path d="M5 12h14" />
        </svg>
        <p className="text-xs text-text-secondary leading-relaxed flex-1">{pinnedNote.content}</p>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => { setNoteText(pinnedNote.content); setIsEditing(true); }} className="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors">Edit</button>
          <span className="text-text-tertiary text-[10px]">·</span>
          <button onClick={handleUnpin} className="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors">Unpin</button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setIsEditing(true)} className="mt-3 text-xs text-text-tertiary hover:text-text-secondary transition-colors text-left">
      + Pin a note for today
    </button>
  );
}
