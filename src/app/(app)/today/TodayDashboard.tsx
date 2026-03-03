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
    case 'light': return 'text-accent';
    case 'moderate': return 'text-text-primary';
    case 'heavy': return 'text-warning';
    case 'overloaded': return 'text-danger';
  }
}

function getLoadLabel(level: LoadLevel): string {
  switch (level) {
    case 'light': return 'Light day';
    case 'moderate': return 'Balanced';
    case 'heavy': return 'Heavy day';
    case 'overloaded': return 'Overloaded';
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

  // Energy data for metrics strip
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
    return { totalMLU, capacityPct, usedPct, loadLevel, highTasks, creativeTasks };
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ━━━ 1. DASHBOARD HEADER ━━━ */}
      <DashboardHeader
        userName={userName}
        pinnedNote={pinnedNote}
        quote={quote}
      />

      {/* ━━━ 2. METRICS STRIP ━━━ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 card-enter">
        {/* Daily Load */}
        <div className="card-elevated rounded-xl p-4">
          <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-1.5">Daily Load</p>
          <div className="flex items-baseline gap-1.5">
            <span className={cn('display-number-medium leading-none', getLoadAccent(energyData.loadLevel))}>
              {Math.round(energyData.totalMLU)}
            </span>
            <span className="text-xs text-text-tertiary font-mono">/ {dailyCapacity}</span>
          </div>
          <p className={cn('text-[11px] mt-1', getLoadAccent(energyData.loadLevel))}>
            {getLoadLabel(energyData.loadLevel)}
          </p>
          <div className="mt-2 h-1 rounded-full bg-surface-tertiary overflow-hidden">
            <div className="h-full flex">
              <div
                className="h-full bg-accent/50 transition-all duration-700"
                style={{ width: `${energyData.usedPct}%` }}
              />
              <div
                className="h-full bg-text-tertiary/15 transition-all duration-700"
                style={{ width: `${Math.max(0, energyData.capacityPct - energyData.usedPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className="card-elevated rounded-xl p-4">
          <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-1.5">Tasks</p>
          <div className="flex items-baseline gap-1">
            <span className="display-number-medium leading-none text-text-primary">{completedCount}</span>
            <span className="text-xs text-text-tertiary font-mono">/ {totalCount}</span>
          </div>
          {(energyData.highTasks > 0 || energyData.creativeTasks > 0) && (
            <p className="text-[11px] text-text-tertiary mt-1">
              {energyData.highTasks > 0 && `${energyData.highTasks} heavy`}
              {energyData.highTasks > 0 && energyData.creativeTasks > 0 && ' · '}
              {energyData.creativeTasks > 0 && `${energyData.creativeTasks} creative`}
            </p>
          )}
        </div>

        {/* MRR */}
        <div className="card-elevated rounded-xl p-4">
          <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-1.5">MRR</p>
          <span className="display-number-medium leading-none text-text-primary">
            £{confirmedMRR >= 1000 ? `${(confirmedMRR / 1000).toFixed(1)}k` : confirmedMRR.toLocaleString()}
          </span>
          <p className="text-[11px] text-text-tertiary mt-1">{activeClientCount} active clients</p>
        </div>

        {/* Habits */}
        <div className="card-elevated rounded-xl p-4">
          <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-1.5">Habits</p>
          <div className="flex items-baseline gap-1">
            <span className="display-number-medium leading-none text-text-primary">{fundamentalsHitCount}</span>
            <span className="text-xs text-text-tertiary font-mono">/ {fundamentalsTotal}</span>
          </div>
          {streakDays > 0 && (
            <p className="text-[11px] text-accent mt-1">{streakDays}d streak</p>
          )}
        </div>
      </div>

      {/* ━━━ 3. MAIN CONTENT — Task List + Sidebar ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 card-enter" style={{ animationDelay: '60ms' }}>
        {/* Left: Today's Plan */}
        <section className="card-elevated rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-section-heading text-text-primary">Today&apos;s Plan</h2>
            <InfoBox title="Today's Plan">
              <p>Tasks flagged for today or with today&apos;s deadline. Add tasks inline with weight + client assignment.</p>
            </InfoBox>
          </div>
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
        </section>

        {/* Right: Sidebar */}
        <div className="space-y-4 lg:space-y-0 lg:flex lg:flex-col">
          <section className="card-elevated rounded-2xl p-5 lg:flex-1">
            {/* Do Next */}
            <div className="mb-4">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-[0.06em] mb-3">Do Next</p>
              <EnergyRouter
                todayTasks={todayTasks}
                fundamentalsCompleted={fundamentalsHitCount}
                fundamentalsTotal={fundamentalsTotal}
                compact
              />
            </div>

            <div className="border-t border-border my-4" />

            {/* Fundamentals */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-[0.06em]">Fundamentals</p>
                <span className="text-xs text-text-tertiary font-mono">{fundamentalsHitCount}/{fundamentalsTotal}</span>
              </div>
              <FundamentalsTracker
                fundamentals={customFundamentals}
                completions={fundamentalCompletions}
                compact
              />
            </div>

            <div className="border-t border-border my-4" />

            {/* Recurring Tasks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-[0.06em]">Recurring</p>
                <span className="text-xs text-text-tertiary font-mono">{recurringCompletedCount}/{recurringTasks.length}</span>
              </div>
              <DailyTasks
                tasks={recurringTasks}
                allTasks={allRecurringTasks || recurringTasks}
                clients={clients}
                streaks={recurringStreaks}
                compact
              />
            </div>
          </section>
        </div>
      </div>

      {/* ━━━ 4. WEEK VIEW ━━━ */}
      <section className="card-elevated rounded-2xl p-6 card-enter" style={{ animationDelay: '120ms' }}>
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

      {/* ━━━ 5. COLLAPSIBLE "MORE" ━━━ */}
      <div className="card-enter" style={{ animationDelay: '180ms' }}>
        <button
          onClick={() => setShowMore(prev => !prev)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          <span>{showMore ? 'Show less' : 'More'}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {showMore && (
        <div className="space-y-5 animate-fade-in">
          {clients.length > 0 && (
            <section className="card-elevated rounded-2xl p-6">
              <h2 className="text-section-heading text-text-primary mb-4">Revenue Radar</h2>
              <RevenueRadar clients={clients} />
            </section>
          )}

          <section className="card-elevated rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-section-heading text-text-primary">AI Insights</h2>
              <InfoBox title="AI Habit Insights">
                <p>Pattern analysis across your tasks and fundamentals. Surfaces trends and suggestions.</p>
              </InfoBox>
            </div>
            <HabitInsights
              fundamentals={customFundamentals}
              completions={fundamentalCompletions}
              recurringTasks={recurringTasks}
              todayTasks={todayTasks}
              streakDays={streakDays}
            />
          </section>

          <MonkeyBrainOverride />
        </div>
      )}

      {/* ━━━ 6. DAY IN REVIEW ━━━ */}
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
          <div className="card-glass flex items-center gap-3 px-4 py-2.5 rounded-xl">
            <span className="text-xs text-text-secondary">{undoToast}</span>
          </div>
        </div>
      )}
      {canUndo && !undoToast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50">
          <button
            onClick={undo}
            className="card-glass flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-text-tertiary hover:text-text-primary transition-all duration-200 cursor-pointer"
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

// ━━━ Dashboard Header ━━━
function DashboardHeader({
  userName,
  pinnedNote,
  quote,
}: {
  userName?: string;
  pinnedNote?: PinnedNote | null;
  quote: { text: string; author: string };
}) {
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

  const greeting = getGreeting();
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="card-glass rounded-2xl p-6 sm:p-8 card-enter">
      <div className="flex flex-col gap-4">
        {/* Greeting + Date */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
              {greeting}{userName ? `, ${userName}` : ''}
            </h1>
            <p className="text-sm text-text-tertiary mt-0.5">{dateStr}</p>
          </div>
        </div>

        {/* Pinned note */}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              ref={inputRef}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveNote(); }
                if (e.key === 'Escape') { setIsEditing(false); setNoteText(pinnedNote?.content || ''); }
              }}
              placeholder="Pin a note for today..."
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary resize-none outline-none leading-relaxed"
              rows={2}
              maxLength={280}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveNote}
                disabled={isPending}
                className="text-[11px] text-accent hover:text-accent-bright transition-colors font-medium"
              >
                {isPending ? 'Saving...' : 'Pin'}
              </button>
              <button
                onClick={() => { setIsEditing(false); setNoteText(pinnedNote?.content || ''); }}
                className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : pinnedNote?.content ? (
          <div className="group flex items-start gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent mt-0.5 flex-shrink-0">
              <path d="M12 2l0 20" /><path d="M18 8l-6-6-6 6" /><path d="M5 12h14" />
            </svg>
            <p className="text-sm text-text-secondary leading-relaxed flex-1">{pinnedNote.content}</p>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => { setNoteText(pinnedNote.content); setIsEditing(true); }}
                className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
              >
                Edit
              </button>
              <span className="text-text-tertiary">·</span>
              <button
                onClick={handleUnpin}
                className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
              >
                Unpin
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-text-tertiary hover:text-text-secondary transition-colors text-left"
          >
            + Pin a note for today
          </button>
        )}

        {/* Daily quote */}
        <p className="text-xs text-text-tertiary italic leading-relaxed">
          &ldquo;{quote.text}&rdquo; — {quote.author}
        </p>
      </div>
    </div>
  );
}
