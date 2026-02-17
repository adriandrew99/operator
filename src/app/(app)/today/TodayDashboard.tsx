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
import { LayoutCustomiser } from '@/components/layout/LayoutCustomiser';
import { InfoBox } from '@/components/ui/InfoBox';
import { CelebrationBurst } from '@/components/ui/CelebrationBurst';
import { DayOverview } from '@/components/today/DayOverview';
import { DayInReview } from '@/components/today/DayInReview';
import { useUndoStack } from '@/hooks/useUndoStack';
import { cn } from '@/lib/utils/cn';
import type { CustomFundamental, Task, Client, CalendarEvent } from '@/lib/types/database';
import type { RecurringTaskWithStatus } from '@/lib/types/recurring';
import type { DashboardLayoutPreferences } from '@/lib/types/dashboard-layout';
import { DEFAULT_DASHBOARD_LAYOUT } from '@/lib/types/dashboard-layout';

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
  dashboardLayout?: DashboardLayoutPreferences;
  recurringStreaks?: Record<string, number>;
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
  monthlyRevenue = 0,
  monthlyExpenses = 0,
  leftInCompany = 0,
  dailyCapacity,
  calendarEvents = [],
  userName,
  dashboardLayout,
  recurringStreaks,
}: TodayDashboardProps) {
  const [liveLayout, setLiveLayout] = useState<DashboardLayoutPreferences>(dashboardLayout ?? DEFAULT_DASHBOARD_LAYOUT);
  const layout = liveLayout.today;
  const [sharedCompletedIds, setSharedCompletedIds] = useState<Set<string>>(new Set());
  const [externalUncompletedIds, setExternalUncompletedIds] = useState<Set<string>>(new Set());

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

  return (
    <div className="space-y-8 stagger-in">

      {/* ━━━ LAYOUT CUSTOMISER ━━━ */}
      <div className="flex justify-end -mb-4">
        <LayoutCustomiser page="today" layout={liveLayout} onLayoutChange={setLiveLayout} />
      </div>

      {/* ━━━ DAY OVERVIEW (open typography — no card wrapper) ━━━ */}
      {layout.day_overview && <DayOverview
        todayTasks={todayTasks}
        completedTodayTasks={completedTodayTasks}
        weekTasks={weekTasks}
        recurringTasks={recurringTasks}
        clients={clients}
        calendarEvents={calendarEvents}
        today={today}
        fundamentalsHit={fundamentalsHitCount}
        fundamentalsTotal={fundamentalsTotal}
        streakDays={streakDays}
        dailyCapacity={dailyCapacity}
        userName={userName}
        monthlyRevenue={monthlyRevenue}
        monthlyExpenses={monthlyExpenses}
        leftInCompany={leftInCompany}
      />}

      {/* ━━━ TODAY'S PLAN ━━━ */}
      <section className="bg-surface-secondary rounded-xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Today&apos;s Plan</h2>
          <InfoBox title="Today's Plan">
            <p>Tasks flagged for today or with today&apos;s deadline. Add tasks inline with weight + client assignment.</p>
          </InfoBox>
        </div>
        <TodayTasks tasks={todayTasks} clients={clients} completedTodayTasks={completedTodayTasks} weekTasks={weekTasks} todayStr={today} onTaskCompleted={onTaskCompleted} onTaskUncompleted={onTaskUncompleted} dailyCapacity={dailyCapacity} pushUndo={pushUndo} externalUncompletedIds={externalUncompletedIds} />
      </section>

      {/* ━━━ WEEK OVERVIEW ━━━ */}
      {layout.week_overview && (
        <section className="bg-surface-secondary rounded-xl p-5 sm:p-6">
          <WeekView weekTasks={weekTasks} todayStr={today} recurringTasks={recurringTasks} clients={clients} externalCompletedIds={sharedCompletedIds} pushUndo={pushUndo} dailyCapacity={dailyCapacity} />
        </section>
      )}

      {/* ━━━ FUNDAMENTALS ━━━ */}
      {layout.fundamentals && (
        <section id="fundamentals-section" className="bg-surface-secondary rounded-xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Fundamentals</h2>
            <span className="text-xs text-text-tertiary font-mono">{fundamentalsHitCount}/{fundamentalsTotal}</span>
          </div>
          <FundamentalsTracker
            fundamentals={customFundamentals}
            completions={fundamentalCompletions}
          />
        </section>
      )}

      {/* ━━━ RECURRING + ENERGY ROUTER ━━━ */}
      {(layout.recurring_tasks || layout.energy_router) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {layout.recurring_tasks && (
            <section className="bg-surface-secondary rounded-xl p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Recurring Tasks</h2>
              <DailyTasks tasks={recurringTasks} allTasks={allRecurringTasks || recurringTasks} clients={clients} streaks={recurringStreaks} />
            </section>
          )}

          {layout.energy_router && (
            <section className="bg-surface-secondary rounded-xl p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Energy Router</h2>
              <EnergyRouter
                todayTasks={todayTasks}
                fundamentalsCompleted={fundamentalsHitCount}
                fundamentalsTotal={fundamentalsTotal}
              />
            </section>
          )}
        </div>
      )}

      {/* ━━━ REVENUE RADAR ━━━ */}
      {layout.revenue_radar && clients.length > 0 && (
        <section className="bg-surface-secondary rounded-xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Revenue Radar</h2>
          <RevenueRadar clients={clients} />
        </section>
      )}

      {/* ━━━ AI INSIGHTS ━━━ */}
      {layout.ai_insights && <section className="bg-surface-secondary rounded-xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-text-primary">AI Insights</h2>
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
      </section>}

      {/* ━━━ MONKEY BRAIN OVERRIDE ━━━ */}
      {layout.monkey_brain && <MonkeyBrainOverride />}

      {/* ━━━ DAY IN REVIEW ━━━ */}
      <DayInReview
        todayTasks={todayTasks}
        completedTodayTasks={completedTodayTasks}
        clients={clients}
        fundamentalsHit={fundamentalsHitCount}
        fundamentalsTotal={fundamentalsTotal}
        allTasksDone={allTasksDone}
        dailyCapacity={dailyCapacity}
      />

      {/* ━━━ CELEBRATIONS ━━━ */}
      <CelebrationBurst trigger={allTasksDone} message="All tasks done!" />
      <CelebrationBurst trigger={allFundamentalsDone} message="Fundamentals crushed!" />

      {/* ━━━ UNDO TOAST ━━━ */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface-secondary border border-border shadow-lg shadow-black/30">
            <span className="text-xs text-text-secondary">{undoToast}</span>
          </div>
        </div>
      )}
      {canUndo && !undoToast && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={undo}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-secondary border border-border shadow-lg shadow-black/30 text-xs text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
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
