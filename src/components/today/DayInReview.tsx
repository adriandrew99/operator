'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { getTaskMLU, getEstimatedMinutes } from '@/lib/utils/mental-load';
import { sendNotification, requestNotificationPermission, canNotify } from '@/lib/utils/notifications';
import { playCompleteSound } from '@/lib/utils/sounds';
import { DailyCheckIn } from '@/components/score/DailyCheckIn';
import type { Task, Client, CheckInRatings, OperatorScore } from '@/lib/types/database';

interface DayInReviewProps {
  todayTasks: Task[];
  completedTodayTasks: Task[];
  clients: Client[];
  fundamentalsHit: number;
  fundamentalsTotal: number;
  allTasksDone: boolean;
  dailyCapacity?: number;
  existingCheckIn: CheckInRatings | null;
  existingNotes: string | null;
  onCheckInSaved: (score: OperatorScore) => void;
  celebrationPlayed: boolean;
}

/**
 * "Day in Review" — shows a summary card when all tasks for the day are completed.
 * Celebrates the win, provides useful stats, and flows into the daily check-in.
 */
export function DayInReview({
  todayTasks,
  completedTodayTasks,
  clients,
  fundamentalsHit,
  fundamentalsTotal,
  allTasksDone,
  dailyCapacity = 20,
  existingCheckIn,
  existingNotes,
  onCheckInSaved,
  celebrationPlayed,
}: DayInReviewProps) {
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const notifiedRef = useRef(false);

  // Only show once all tasks are done AND celebration has finished (or wasn't needed)
  // If celebration played, show immediately after it completes.
  // If no celebration (e.g. page loaded with tasks already done), show after a short delay.
  useEffect(() => {
    if (!allTasksDone || dismissed) {
      setVisible(false);
      return;
    }

    // If celebration hasn't played yet, wait for it
    if (!celebrationPlayed) {
      return;
    }

    // Celebration finished (or was skipped) — slide in after a short beat
    const timer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(timer);
  }, [allTasksDone, dismissed, celebrationPlayed]);

  // Send push notification when all tasks are done (once per session)
  useEffect(() => {
    if (allTasksDone && !notifiedRef.current) {
      notifiedRef.current = true;
      sendNotification({
        title: '\u2705 All tasks done!',
        body: 'Your day in review is ready.',
        tag: 'day-in-review',
        url: '/today',
      });
    }
  }, [allTasksDone]);

  // Combine server-completed + today tasks for the full picture
  const allTasks = useMemo(() => {
    const ids = new Set(completedTodayTasks.map(t => t.id));
    const combined = [...completedTodayTasks];
    for (const t of todayTasks) {
      if (!ids.has(t.id)) combined.push(t);
    }
    return combined;
  }, [todayTasks, completedTodayTasks]);

  const stats = useMemo(() => {
    const completed = completedTodayTasks.filter(t => !t.is_personal);
    const totalMLU = completed.reduce((s, t) => s + getTaskMLU({ weight: t.weight, energy: t.energy }), 0);
    const totalMinutes = completed.reduce((s, t) => s + getEstimatedMinutes(t), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    // Client breakdown
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const clientWork: Record<string, { name: string; tasks: number; mlu: number }> = {};
    for (const t of completed) {
      const name = t.client_id ? (clientMap.get(t.client_id) || 'Unknown') : 'Personal';
      if (!clientWork[name]) clientWork[name] = { name, tasks: 0, mlu: 0 };
      clientWork[name].tasks++;
      clientWork[name].mlu += getTaskMLU({ weight: t.weight, energy: t.energy });
    }
    const topClients = Object.values(clientWork).sort((a, b) => b.mlu - a.mlu).slice(0, 3);

    // Energy split
    const creativeMLU = completed
      .filter(t => t.energy === 'creative')
      .reduce((s, t) => s + getTaskMLU({ weight: t.weight, energy: t.energy }), 0);
    const creativePct = totalMLU > 0 ? Math.round((creativeMLU / totalMLU) * 100) : 0;

    // Weight split
    const highCount = completed.filter(t => t.weight === 'high').length;
    const highPct = completed.length > 0 ? Math.round((highCount / completed.length) * 100) : 0;

    const capacityPct = dailyCapacity > 0 ? Math.round((totalMLU / dailyCapacity) * 100) : 0;

    return {
      totalTasks: completed.length,
      totalMLU: Math.round(totalMLU * 10) / 10,
      timeStr: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
      topClients,
      creativePct,
      highPct,
      capacityPct,
    };
  }, [completedTodayTasks, clients, dailyCapacity]);

  // Generate a contextual message
  const message = useMemo(() => {
    if (stats.capacityPct >= 100) return "You went all in today. Time to recharge.";
    if (stats.capacityPct >= 80) return "Heavy day. Great output \u2014 protect your evening.";
    if (stats.capacityPct >= 50) return "Solid, balanced day. Well managed.";
    if (stats.totalTasks <= 2) return "Light day. Sometimes less is more.";
    return "Clean day. Everything handled.";
  }, [stats]);

  const handleCheckInSaved = (score: OperatorScore) => {
    playCompleteSound();
    setShowCheckIn(false);
    onCheckInSaved(score);
  };

  if (!visible) return null;

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border border-border bg-surface-secondary',
      'transition-all duration-700 ease-out',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
    )}>
      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer z-10"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{'\u2705'}</span>
            <p className="text-xs font-medium text-text-secondary ">Day in Review</p>
          </div>
          <p className="text-sm text-text-secondary italic">{message}</p>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ReviewStat label="Tasks Done" value={String(stats.totalTasks)} />
          <ReviewStat label="Energy Used" value={`${stats.totalMLU}`} unit="MLU" />
          <ReviewStat label="Est. Time" value={stats.timeStr} />
          <ReviewStat
            label="Capacity"
            value={`${stats.capacityPct}%`}
            color={stats.capacityPct > 100 ? 'text-text-primary' : stats.capacityPct > 80 ? 'text-text-secondary' : 'text-text-primary'}
          />
        </div>

        {/* Client breakdown */}
        {stats.topClients.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-tertiary ">Where your energy went</p>
            <div className="flex flex-wrap gap-2">
              {stats.topClients.map(c => (
                <div key={c.name} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-tertiary border border-border">
                  <span className="text-xs font-medium text-text-primary">{c.name}</span>
                  <span className="text-xs text-text-tertiary">{c.tasks} tasks · {c.mlu} MLU</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Energy mix bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full overflow-hidden bg-surface-tertiary flex">
            <div className="h-full bg-purple-400/80 transition-all" style={{ width: `${stats.creativePct}%` }} />
            <div className="h-full bg-gray-500/60 transition-all" style={{ width: `${100 - stats.creativePct}%` }} />
          </div>
          <span className="text-xs text-text-tertiary whitespace-nowrap">
            {stats.creativePct}% creative · {100 - stats.creativePct}% admin
          </span>
        </div>

        {/* Fundamentals */}
        {fundamentalsTotal > 0 && (
          <p className="text-xs text-text-secondary">
            Fundamentals: <span className={cn('font-medium', fundamentalsHit >= fundamentalsTotal ? 'text-text-primary' : 'text-text-primary')}>
              {fundamentalsHit}/{fundamentalsTotal}
            </span>
            {fundamentalsHit >= fundamentalsTotal && ' \u2014 all done \u2713'}
          </p>
        )}

        {/* ━━━ DAILY CHECK-IN INTEGRATION ━━━ */}
        {existingCheckIn ? (
          /* Already checked in — show compact inline summary */
          <DailyCheckIn
            existingCheckIn={existingCheckIn}
            existingNotes={existingNotes}
            onSaved={handleCheckInSaved}
            variant="inline"
          />
        ) : showCheckIn ? (
          /* Check-in form expanded inline */
          <div className="animate-slide-up">
            <DailyCheckIn
              existingCheckIn={null}
              existingNotes={null}
              onSaved={handleCheckInSaved}
              variant="inline"
            />
          </div>
        ) : (
          /* Prompt to reflect */
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary font-medium">How did today feel?</p>
                <p className="text-xs text-text-tertiary mt-0.5">30-second reflection to close out the day.</p>
              </div>
              <button
                onClick={() => setShowCheckIn(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-text-primary text-background text-xs font-medium hover:bg-text-primary/90 transition-all cursor-pointer"
              >
                Reflect now
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Notification prompt */}
        {!canNotify() && typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'denied' && (
          <button
            onClick={async () => {
              await requestNotificationPermission();
            }}
            className="text-xs text-text-secondary hover:text-text-primary font-medium cursor-pointer transition-colors"
          >
            {'\uD83D\uDD14'} Enable notifications to get day summaries even when the app is in the background
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewStat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="rounded-xl bg-surface-tertiary border border-border px-3 py-2">
      <p className="text-xs text-text-tertiary ">{label}</p>
      <p className={cn('text-base font-bold font-mono mt-0.5', color || 'text-text-primary')}>
        {value}
        {unit && <span className="text-xs text-text-tertiary font-normal ml-1">{unit}</span>}
      </p>
    </div>
  );
}
