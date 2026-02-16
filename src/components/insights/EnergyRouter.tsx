'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { Modal } from '@/components/ui/Modal';

interface EnergyRouterProps {
  todayTasks: {
    id: string;
    title: string;
    weight: string;
    energy: string;
    estimated_minutes: number | null;
    deadline: string | null;
    flagged_for_today: boolean;
  }[];
  fundamentalsCompleted: number;
  fundamentalsTotal: number;
}

type EnergyState = 'peak' | 'high' | 'medium' | 'low';

type TaskList = EnergyRouterProps['todayTasks'];

interface EnergyAnalysis {
  state: EnergyState;
  label: string;
  description: string;
  timeSlot: string;
  recommendation: {
    task: TaskList[number] | null;
    reasoning: string;
  };
  uncompletedByEnergy: {
    high: TaskList;
    medium: TaskList;
    low: TaskList;
  };
}

function getTimeSlot(hour: number): { slot: string; label: string } {
  if (hour >= 6 && hour < 11) return { slot: 'morning', label: 'Morning' };
  if (hour >= 11 && hour < 14) return { slot: 'midday', label: 'Midday' };
  if (hour >= 14 && hour < 17) return { slot: 'afternoon', label: 'Afternoon' };
  return { slot: 'evening', label: 'Evening' };
}

function getEnergyState(
  hour: number,
  fundamentalsCompleted: number,
  fundamentalsTotal: number
): { state: EnergyState; label: string; description: string } {
  const fundamentalRate = fundamentalsTotal > 0 ? fundamentalsCompleted / fundamentalsTotal : 0;

  if (hour >= 6 && hour < 11) {
    if (fundamentalRate >= 0.5) {
      return { state: 'peak', label: 'Peak Capacity', description: 'Fundamentals done, brain fresh. Ideal for your hardest work.' };
    }
    return { state: 'high', label: 'High Energy', description: 'Morning window open. Tackle demanding tasks now.' };
  }

  if (hour >= 11 && hour < 14) {
    return { state: 'high', label: 'High Energy', description: 'Still have cognitive bandwidth. Use it before the afternoon dip.' };
  }

  if (hour >= 14 && hour < 17) {
    return { state: 'medium', label: 'Declining', description: 'Afternoon energy dip. Focus on structured or routine tasks.' };
  }

  return { state: 'low', label: 'Wind Down', description: 'Evening mode. Good for creative thinking or tomorrow planning.' };
}

function getEnergyColor(state: EnergyState): string {
  switch (state) {
    case 'peak': return 'text-accent';
    case 'high': return 'text-accent-blue';
    case 'medium': return 'text-amber-400';
    case 'low': return 'text-text-tertiary';
  }
}

function getEnergyBgColor(state: EnergyState): string {
  switch (state) {
    case 'peak': return 'bg-accent/15';
    case 'high': return 'bg-accent-blue/15';
    case 'medium': return 'bg-amber-500/15';
    case 'low': return 'bg-surface-tertiary/60';
  }
}

function getEnergyBarColor(state: EnergyState): string {
  switch (state) {
    case 'peak': return 'bg-accent';
    case 'high': return 'bg-accent-blue';
    case 'medium': return 'bg-amber-400';
    case 'low': return 'bg-text-tertiary';
  }
}

const WEIGHT_BADGE: Record<string, string> = {
  high: 'bg-red-500/15 text-red-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low: 'bg-surface-tertiary text-text-tertiary',
};

export function EnergyRouter({
  todayTasks,
  fundamentalsCompleted,
  fundamentalsTotal,
}: EnergyRouterProps) {
  const [showDetail, setShowDetail] = useState(false);

  const analysis = useMemo<EnergyAnalysis>(() => {
    const hour = new Date().getHours();
    const { label: timeLabel } = getTimeSlot(hour);
    const { state, label, description } = getEnergyState(hour, fundamentalsCompleted, fundamentalsTotal);

    // Only include tasks that are genuinely for today:
    // - flagged_for_today, OR deadline is today specifically
    // Excludes old overdue tasks that have past deadlines
    const todayStr = new Date().toISOString().split('T')[0];
    const uncompleted = todayTasks.filter((t) =>
      t.flagged_for_today || t.deadline === todayStr || !t.deadline
    );
    const high = uncompleted.filter((t) => t.energy === 'creative' || t.weight === 'high');
    const medium = uncompleted.filter(
      (t) => !high.includes(t) && (t.energy === 'creative' || t.weight === 'medium')
    );
    const low = uncompleted.filter(
      (t) => !high.includes(t) && !medium.includes(t)
    );

    let recommendedPool: typeof todayTasks;
    let reasoning: string;

    switch (state) {
      case 'peak':
        recommendedPool = high.length > 0 ? high : medium.length > 0 ? medium : low;
        reasoning = high.length > 0 ? 'Peak cognitive window. This is your highest-impact task.'
          : medium.length > 0 ? 'No high-energy tasks left. Tackle this medium task while you\u2019re sharp.'
          : 'All demanding tasks done. Handle what\u2019s left.';
        break;
      case 'high':
        recommendedPool = high.length > 0 ? high : medium;
        reasoning = high.length > 0 ? 'High energy available. Attack your most demanding task.'
          : 'No high-energy tasks queued. This medium task is your best use of focus.';
        break;
      case 'medium':
        recommendedPool = medium.length > 0 ? medium : low.length > 0 ? low : high;
        reasoning = medium.length > 0 ? 'Energy is moderate. This task matches your current capacity.'
          : low.length > 0 ? 'Shift to lighter tasks as energy declines.'
          : 'Only high-energy tasks remain. Consider if you have the bandwidth or defer.';
        break;
      case 'low':
      default:
        recommendedPool = low.length > 0 ? low : medium.length > 0 ? medium : high;
        reasoning = low.length > 0 ? 'Low energy period. Handle admin or light creative work.'
          : medium.length > 0 ? 'No low-energy tasks. This medium task is manageable.'
          : 'Only intensive tasks left. Consider deferring to tomorrow morning.';
        break;
    }

    const recommendedTask = recommendedPool.length > 0 ? recommendedPool[0] : null;

    return {
      state, label, description, timeSlot: timeLabel,
      recommendation: { task: recommendedTask, reasoning },
      uncompletedByEnergy: { high, medium, low },
    };
  }, [todayTasks, fundamentalsCompleted, fundamentalsTotal]);

  const barLevels: { key: EnergyState; label: string; active: boolean }[] = [
    { key: 'peak', label: 'Peak', active: analysis.state === 'peak' },
    { key: 'high', label: 'High', active: analysis.state === 'high' },
    { key: 'medium', label: 'Med', active: analysis.state === 'medium' },
    { key: 'low', label: 'Low', active: analysis.state === 'low' },
  ];

  return (
    <>
      <div className="space-y-5 cursor-pointer" onClick={() => setShowDetail(true)}>
        {/* Energy Level Visual */}
        <div className="rounded-xl bg-surface-tertiary/40 border border-border/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className={cn('text-sm font-semibold', getEnergyColor(analysis.state))}>
              {analysis.label}
            </span>
            <span
              className={cn(
                'text-[10px] px-2.5 py-1 rounded-lg font-medium',
                getEnergyBgColor(analysis.state),
                getEnergyColor(analysis.state)
              )}
            >
              {analysis.timeSlot}
            </span>
          </div>
          <p className="text-xs text-text-tertiary leading-relaxed">{analysis.description}</p>

          {/* Energy bar visualization */}
          <div className="flex items-end gap-4 h-12 pt-1">
            {barLevels.map((level, i) => {
              const heights = [44, 33, 22, 11];
              return (
                <div key={level.key} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      'w-full rounded-sm transition-all duration-300',
                      level.active ? getEnergyBarColor(level.key) : 'bg-surface-tertiary'
                    )}
                    style={{ height: `${heights[i]}px` }}
                  />
                  <span className={cn('text-[9px]', level.active ? getEnergyColor(level.key) : 'text-text-tertiary')}>
                    {level.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Task Recommendation */}
        {analysis.recommendation.task ? (
          <div className="rounded-xl bg-accent/5 border border-accent/15 p-4 space-y-2.5">
            <p className="text-[10px] font-medium text-accent uppercase tracking-wider">
              Do This Next
            </p>
            <p className="text-sm font-medium text-text-primary leading-snug">
              {analysis.recommendation.task.title}
            </p>
            <div className="flex items-center gap-2.5">
              <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium', WEIGHT_BADGE[analysis.recommendation.task.weight] || WEIGHT_BADGE.medium)}>
                {analysis.recommendation.task.weight}
              </span>
              {analysis.recommendation.task.estimated_minutes && (
                <span className="text-[10px] text-text-tertiary font-mono">
                  ~{analysis.recommendation.task.estimated_minutes}m
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              {analysis.recommendation.reasoning}
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-surface-tertiary/50 border border-border/50 p-4">
            <p className="text-xs text-text-tertiary text-center">
              No uncompleted tasks to route.
            </p>
          </div>
        )}

        {/* Queue summary */}
        <div className="flex items-center gap-4 text-[11px] text-text-tertiary pt-1">
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-red-400">{analysis.uncompletedByEnergy.high.length}H</span>
            <span className="text-border">/</span>
            <span className="font-mono text-amber-400">{analysis.uncompletedByEnergy.medium.length}M</span>
            <span className="text-border">/</span>
            <span className="font-mono text-text-tertiary">{analysis.uncompletedByEnergy.low.length}L</span>
          </span>
          <span className="ml-auto text-[9px] text-text-tertiary/50">Tap for details</span>
        </div>
      </div>

      {/* Expanded Detail Modal */}
      <Modal open={showDetail} onClose={() => setShowDetail(false)} title="Energy Router — Deep Dive">
        <div className="space-y-5">
          {/* Current state */}
          <div>
            <p className="text-[10px] text-text-tertiary uppercase tracking-widest mb-2">Current State</p>
            <div className="flex items-center gap-3">
              <span className={cn('text-lg font-bold', getEnergyColor(analysis.state))}>{analysis.label}</span>
              <span className={cn('text-[10px] px-2 py-0.5 rounded-md', getEnergyBgColor(analysis.state), getEnergyColor(analysis.state))}>
                {analysis.timeSlot}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-2 leading-relaxed">{analysis.description}</p>
          </div>

          {/* How it works */}
          <div>
            <p className="text-[10px] text-text-tertiary uppercase tracking-widest mb-2">How It Works</p>
            <div className="space-y-2 text-[11px] text-text-secondary leading-relaxed">
              <p>The Energy Router maps your task queue against your estimated cognitive capacity based on:</p>
              <ul className="list-disc list-inside space-y-1 text-text-tertiary">
                <li>Time of day (mornings = peak, afternoons = declining)</li>
                <li>Fundamentals progress ({fundamentalsCompleted}/{fundamentalsTotal})</li>
              </ul>
              <p>It then recommends the best task to tackle right now based on the energy required vs what you have available.</p>
            </div>
          </div>

          {/* Task queue breakdown */}
          {([
            { key: 'high' as const, label: 'High Energy', color: 'text-red-400', tasks: analysis.uncompletedByEnergy.high },
            { key: 'medium' as const, label: 'Medium Energy', color: 'text-amber-400', tasks: analysis.uncompletedByEnergy.medium },
            { key: 'low' as const, label: 'Low Energy', color: 'text-text-tertiary', tasks: analysis.uncompletedByEnergy.low },
          ]).map(group => (
            <div key={group.key}>
              <p className={cn('text-[10px] font-medium uppercase tracking-widest mb-2', group.color)}>
                {group.label} ({group.tasks.length})
              </p>
              {group.tasks.length === 0 ? (
                <p className="text-[11px] text-text-tertiary/60 pl-2">No tasks in this category</p>
              ) : (
                <div className="space-y-1.5">
                  {group.tasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-tertiary/30">
                      <div className={cn('w-2 h-2 rounded-full', WEIGHT_BADGE[t.weight]?.split(' ')[0] || 'bg-surface-tertiary')} />
                      <span className="text-xs text-text-primary flex-1 truncate">{t.title}</span>
                      {t.estimated_minutes && <span className="text-[10px] text-text-tertiary font-mono">{t.estimated_minutes}m</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
