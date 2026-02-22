'use client';

import { useState, useCallback } from 'react';
import { FundamentalsTracker } from '@/components/today/FundamentalsTracker';
import { MonkeyBrainOverride } from '@/components/today/MonkeyBrainOverride';
import { DailyTasks } from '@/components/today/DailyTasks';
import { TodayTasks } from '@/components/today/TodayTasks';
import { HabitInsights } from '@/components/today/HabitInsights';
import { WeekView } from '@/components/today/WeekView';
import { RevenueRadar } from '@/components/insights/RevenueRadar';
import { EnergyRouter } from '@/components/insights/EnergyRouter';
import { FocusBlock } from '@/components/today/FocusBlock';
import { InfoBox } from '@/components/ui/InfoBox';
import { CelebrationBurst } from '@/components/ui/CelebrationBurst';
import { DayInReview } from '@/components/today/DayInReview';
import { BentoGrid, BentoItem } from '@/components/ui/BentoGrid';
import { useUndoStack } from '@/hooks/useUndoStack';
import type { CustomFundamental, Task, Client, CalendarEvent, OperatorScore } from '@/lib/types/database';
import type { RecurringTaskWithStatus } from '@/lib/types/recurring';

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
  dailyCapacity,
  calendarEvents = [],
  recurringStreaks,
  todayScore,
}: TodayDashboardProps) {
  const [sharedCompletedIds, setSharedCompletedIds] = useState<Set<string>>(new Set());
  const [externalUncompletedIds, setExternalUncompletedIds] = useState<Set<string>>(new Set());
  const [showMore, setShowMore] = useState(false);

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

  // Celebration tracking
  const serverCompletedIds = new Set(completedTodayTasks.map(t => t.id));
  const allCompletedIds = new Set([...sharedCompletedIds, ...serverCompletedIds]);
  const stillActiveTasks = todayTasks.filter(t => !allCompletedIds.has(t.id));
  const totalPlanTasks = stillActiveTasks.length + allCompletedIds.size;
  const allTasksDone = totalPlanTasks > 0 && allCompletedIds.size >= totalPlanTasks;
  const allFundamentalsDone = fundamentalsTotal > 0 && fundamentalsHitCount >= fundamentalsTotal;

  const completedCount = allCompletedIds.size;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <BentoGrid columns={2}>

        {/* ━━━ 1. FOCUS BLOCK (full width hero) ━━━ */}
        <BentoItem span="full" delay={0}>
          <FocusBlock
            todayTasks={todayTasks}
            completedTodayTasks={completedTodayTasks}
            todayScore={todayScore ?? null}
            streakDays={streakDays}
            fundamentalsHit={fundamentalsHitCount}
            fundamentalsTotal={fundamentalsTotal}
            dailyCapacity={dailyCapacity}
            calendarEvents={calendarEvents}
            clients={clients}
            completedCount={completedCount}
            totalCount={totalPlanTasks}
          />
        </BentoItem>

        {/* ━━━ 2. TODAY'S PLAN (full width) ━━━ */}
        <BentoItem span="full" delay={60}>
          <section className="card-elevated rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-section-heading text-text-primary">Today&apos;s Plan</h2>
              <InfoBox title="Today's Plan">
                <p>Tasks flagged for today or with today&apos;s deadline. Add tasks inline with weight + client assignment.</p>
              </InfoBox>
            </div>
            <TodayTasks tasks={todayTasks} clients={clients} completedTodayTasks={completedTodayTasks} weekTasks={weekTasks} todayStr={today} onTaskCompleted={onTaskCompleted} onTaskUncompleted={onTaskUncompleted} dailyCapacity={dailyCapacity} pushUndo={pushUndo} externalUncompletedIds={externalUncompletedIds} />
          </section>
        </BentoItem>

        {/* ━━━ 2b. ENERGY ROUTER (half width alongside fundamentals) ━━━ */}
        <BentoItem delay={90}>
          <section className="card-elevated rounded-2xl p-6 h-full">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-section-heading text-text-primary">Do Next</h2>
              <InfoBox title="Energy Router">
                <p>Recommends your next task based on current energy level, time of day, and task demands.</p>
              </InfoBox>
            </div>
            <EnergyRouter
              todayTasks={todayTasks}
              fundamentalsCompleted={fundamentalsHitCount}
              fundamentalsTotal={fundamentalsTotal}
            />
          </section>
        </BentoItem>

        {/* ━━━ 3. FUNDAMENTALS + RECURRING (side-by-side) ━━━ */}
        <BentoItem delay={120}>
          <section id="fundamentals-section" className="card-elevated rounded-2xl p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-section-heading text-text-primary">Fundamentals</h2>
              <span className="text-xs text-text-tertiary font-mono">{fundamentalsHitCount}/{fundamentalsTotal}</span>
            </div>
            <FundamentalsTracker
              fundamentals={customFundamentals}
              completions={fundamentalCompletions}
            />
          </section>
        </BentoItem>

        <BentoItem delay={180}>
          <section className="card-elevated rounded-2xl p-6 h-full">
            <h2 className="text-section-heading text-text-primary mb-4">Recurring Tasks</h2>
            <DailyTasks tasks={recurringTasks} allTasks={allRecurringTasks || recurringTasks} clients={clients} streaks={recurringStreaks} />
          </section>
        </BentoItem>

        {/* ━━━ 4. WEEK VIEW (full width) ━━━ */}
        <BentoItem span="full" delay={240}>
          <section className="card-elevated rounded-2xl p-6">
            <WeekView weekTasks={weekTasks} todayStr={today} recurringTasks={recurringTasks} clients={clients} externalCompletedIds={sharedCompletedIds} pushUndo={pushUndo} dailyCapacity={dailyCapacity} />
          </section>
        </BentoItem>

        {/* ━━━ 5. COLLAPSIBLE "MORE" SECTION ━━━ */}
        <BentoItem span="full" delay={300}>
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
        </BentoItem>

        {showMore && (
          <>
            {clients.length > 0 && (
              <BentoItem span="full" delay={0}>
                <section className="card-elevated rounded-2xl p-6">
                  <h2 className="text-section-heading text-text-primary mb-4">Revenue Radar</h2>
                  <RevenueRadar clients={clients} />
                </section>
              </BentoItem>
            )}

            <BentoItem span="full" delay={60}>
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
            </BentoItem>

            <BentoItem delay={120}>
              <MonkeyBrainOverride />
            </BentoItem>
          </>
        )}

        {/* ━━━ 6. DAY IN REVIEW (conditional — shows when all tasks done) ━━━ */}
        <BentoItem span="full" delay={showMore ? 240 : 360}>
          <DayInReview
            todayTasks={todayTasks}
            completedTodayTasks={completedTodayTasks}
            clients={clients}
            fundamentalsHit={fundamentalsHitCount}
            fundamentalsTotal={fundamentalsTotal}
            allTasksDone={allTasksDone}
            dailyCapacity={dailyCapacity}
          />
        </BentoItem>
      </BentoGrid>

      {/* ━━━ CELEBRATIONS ━━━ */}
      <CelebrationBurst trigger={allTasksDone} message="All tasks done!" />
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
