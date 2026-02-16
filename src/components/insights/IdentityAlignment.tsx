'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { InfoBox } from '@/components/ui/InfoBox';

interface IdentityAlignmentProps {
  fundamentals: { id: string; label: string }[];
  completions: Record<string, boolean>;
  streakDays: number;
  todayTasks: { weight: string; status: string; category: string }[];
}

interface Pillar {
  id: string;
  label: string;
  score: number;
  icon: string;
  detail: string;
}

const ICON_PRESETS: Record<string, string[]> = {
  builder: ['\u2692', '\u{1F6E0}', '\u26A1', '\u{1F3D7}'],
  disciplined: ['\u2693', '\u{1F6E1}', '\u{1F3AF}', '\u2694'],
  focused: ['\u25CE', '\u{1F50D}', '\u{1F4A1}', '\u{1F52D}'],
  consistent: ['\u221E', '\u{1F517}', '\u{1F504}', '\u{1F4C8}'],
};

const DEFAULT_LABELS: Record<string, string> = {
  builder: 'Builder',
  disciplined: 'Disciplined',
  focused: 'Focused',
  consistent: 'Consistent',
};

const DEFAULT_ICONS: Record<string, string> = {
  builder: '\u2692',
  disciplined: '\u2693',
  focused: '\u25CE',
  consistent: '\u221E',
};

function getPillarColor(score: number): string {
  if (score >= 70) return 'bg-accent';
  if (score >= 40) return 'bg-amber-400';
  return 'bg-red-400';
}

function getPillarTextColor(score: number): string {
  if (score >= 70) return 'text-accent';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getInsight(weakest: Pillar, customLabels: Record<string, string>): string {
  switch (weakest.id) {
    case 'builder':
      return `Your ${customLabels.builder} identity needs attention. Block focused time for deep work today \u2014 even 30 minutes compounds.`;
    case 'disciplined':
      return `${customLabels.disciplined} is slipping. Your fundamentals are your foundation \u2014 complete them before anything else.`;
    case 'focused':
      return `No high-impact tasks completed yet. Pick the one task that moves the needle most and execute.`;
    case 'consistent':
      return `${customLabels.consistent} is your weakest pillar. Every day you show up builds the identity. Start the streak now.`;
    default:
      return 'Focus on your weakest pillar to bring your alignment score up.';
  }
}

export function IdentityAlignment({
  fundamentals,
  completions,
  streakDays,
  todayTasks,
}: IdentityAlignmentProps) {
  const [customising, setCustomising] = useState(false);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({ ...DEFAULT_LABELS });
  const [customIcons, setCustomIcons] = useState<Record<string, string>>({ ...DEFAULT_ICONS });

  const analysis = useMemo(() => {
    // Pillar 1: Builder - task completion rate
    const totalTasks = todayTasks.length;
    const completedTasks = todayTasks.filter(t => t.status === 'completed').length;
    const builderScore = totalTasks > 0 ? Math.min(100, Math.round((completedTasks / totalTasks) * 100)) : 0;

    // Pillar 2: Disciplined - fundamentals completion > 70% = 100
    const totalFundamentals = fundamentals.length;
    const completedFundamentals = fundamentals.filter((f) => completions[f.id]).length;
    const fundamentalRate = totalFundamentals > 0 ? completedFundamentals / totalFundamentals : 0;
    const disciplinedScore =
      totalFundamentals > 0
        ? Math.min(100, Math.round((fundamentalRate / 0.7) * 100))
        : 0;

    // Pillar 3: Focused - completed high-weight tasks > 0
    const completedHighTasks = todayTasks.filter(
      (t) => t.weight === 'high' && t.status === 'completed'
    ).length;
    const focusedScore =
      completedHighTasks >= 2
        ? 100
        : completedHighTasks === 1
        ? 75
        : todayTasks.some((t) => t.weight === 'high')
        ? 15
        : 0;

    // Pillar 4: Consistent - streak > 3 days = 100, scaled
    const consistentScore = Math.min(100, Math.round((streakDays / 3) * 100));

    const pillars: Pillar[] = [
      {
        id: 'builder',
        label: customLabels.builder,
        score: builderScore,
        icon: customIcons.builder,
        detail: `${completedTasks}/${totalTasks} tasks done`,
      },
      {
        id: 'disciplined',
        label: customLabels.disciplined,
        score: disciplinedScore,
        icon: customIcons.disciplined,
        detail: `${completedFundamentals}/${totalFundamentals} fundamentals`,
      },
      {
        id: 'focused',
        label: customLabels.focused,
        score: focusedScore,
        icon: customIcons.focused,
        detail: `${completedHighTasks} high-impact done`,
      },
      {
        id: 'consistent',
        label: customLabels.consistent,
        score: consistentScore,
        icon: customIcons.consistent,
        detail: `${streakDays}d streak`,
      },
    ];

    // Weighted average: Builder 30%, Disciplined 25%, Focused 25%, Consistent 20%
    const overallAlignment = Math.round(
      builderScore * 0.3 +
        disciplinedScore * 0.25 +
        focusedScore * 0.25 +
        consistentScore * 0.2
    );

    const weakest = pillars.reduce((min, p) => (p.score < min.score ? p : min), pillars[0]);

    return { pillars, overallAlignment, weakest };
  }, [fundamentals, completions, streakDays, todayTasks, customLabels, customIcons]);

  function getAlignmentColor(score: number): string {
    if (score >= 70) return 'text-accent';
    if (score >= 40) return 'text-amber-400';
    return 'text-red-400';
  }

  function handleLabelChange(pillarId: string, value: string) {
    setCustomLabels((prev) => ({ ...prev, [pillarId]: value }));
  }

  function handleIconSelect(pillarId: string, icon: string) {
    setCustomIcons((prev) => ({ ...prev, [pillarId]: icon }));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-medium text-accent uppercase tracking-widest">
          Identity Alignment
        </p>
        <InfoBox title="Identity Alignment">
          <p>
            Measures alignment between your daily actions and the identity you want to build.
            Each pillar tracks a core trait. Customise labels to match your personal values.
          </p>
        </InfoBox>
        <span
          className={cn(
            'text-[9px] px-2 py-0.5 rounded-md font-medium',
            analysis.overallAlignment >= 70
              ? 'bg-accent/15 text-accent'
              : analysis.overallAlignment >= 40
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-red-500/15 text-red-400'
          )}
        >
          {analysis.overallAlignment}% aligned
        </span>
        <button
          type="button"
          onClick={() => setCustomising(!customising)}
          className={cn(
            'ml-auto text-[9px] px-2 py-0.5 rounded-md font-medium transition-colors',
            customising
              ? 'bg-accent/15 text-accent'
              : 'bg-surface-tertiary text-text-tertiary hover:text-text-secondary'
          )}
        >
          {customising ? 'Done' : 'Customise'}
        </button>
      </div>

      {/* Customisation panel */}
      {customising && (
        <div className="rounded-xl bg-surface-tertiary/40 border border-accent/20 p-4 space-y-3 animate-fade-in">
          <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
            Customise Pillars
          </p>
          {(['builder', 'disciplined', 'focused', 'consistent'] as const).map((pillarId) => (
            <div key={pillarId} className="flex items-center gap-3">
              {/* Icon selector */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {ICON_PRESETS[pillarId].map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => handleIconSelect(pillarId, icon)}
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all',
                      customIcons[pillarId] === icon
                        ? 'bg-accent/20 border border-accent/40 scale-110'
                        : 'bg-surface-tertiary/60 border border-border/30 hover:border-border/60'
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              {/* Label input */}
              <input
                type="text"
                value={customLabels[pillarId]}
                onChange={(e) => handleLabelChange(pillarId, e.target.value)}
                maxLength={20}
                className="flex-1 text-xs bg-surface-secondary/60 border border-border/40 rounded-xl px-2.5 py-1.5 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 transition-colors"
                placeholder={DEFAULT_LABELS[pillarId]}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setCustomLabels({ ...DEFAULT_LABELS });
              setCustomIcons({ ...DEFAULT_ICONS });
            }}
            className="text-[9px] text-text-tertiary hover:text-text-secondary transition-colors"
          >
            Reset to defaults
          </button>
        </div>
      )}

      {/* Overall Alignment */}
      <div className="rounded-xl bg-surface-tertiary/40 border border-border/50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Overall Alignment</span>
          <span
            className={cn(
              'text-xl font-mono font-bold',
              getAlignmentColor(analysis.overallAlignment)
            )}
          >
            {analysis.overallAlignment}%
          </span>
        </div>

        {/* Pillar Bars */}
        <div className="space-y-3">
          {analysis.pillars.map((pillar) => (
            <div key={pillar.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs">{pillar.icon}</span>
                  <span className="text-[11px] text-text-primary font-medium">
                    {pillar.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-tertiary">{pillar.detail}</span>
                  <span
                    className={cn(
                      'text-[10px] font-mono font-medium w-8 text-right',
                      getPillarTextColor(pillar.score)
                    )}
                  >
                    {pillar.score}
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-surface-tertiary overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500 ease-out',
                    getPillarColor(pillar.score)
                  )}
                  style={{ width: `${pillar.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weakest Pillar Insight */}
      {analysis.overallAlignment < 100 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-xs bg-surface-tertiary/50 border border-border/50">
          <span className="text-base flex-shrink-0 mt-0.5">{analysis.weakest.icon}</span>
          <div>
            <p className="text-text-tertiary text-[10px] font-medium uppercase tracking-wider mb-1">
              Weakest: {analysis.weakest.label}
            </p>
            <p className="text-text-secondary leading-relaxed">
              {getInsight(analysis.weakest, customLabels)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
