'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { WeeklyDebrief as WeeklyDebriefData } from '@/actions/insights';

interface WeeklyDebriefProps {
  debrief: WeeklyDebriefData;
  collapsible?: boolean;
}

export function WeeklyDebrief({ debrief, collapsible }: WeeklyDebriefProps) {
  const [expanded, setExpanded] = useState(!collapsible);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const hours = Math.round((debrief.totalMinutes / 60) * 10) / 10;
  const internalShare = debrief.totalMLU > 0 ? Math.round((debrief.internalMLU / debrief.totalMLU) * 100) : 0;
  const topClient = debrief.clients[0];

  function toggleSection(section: string) {
    setActiveSection(prev => prev === section ? null : section);
  }

  return (
    <div className="space-y-4">
      {/* Header — clickable when collapsible */}
      <button
        onClick={() => collapsible && setExpanded(prev => !prev)}
        className={cn(
          'flex items-center justify-between w-full text-left',
          collapsible && 'cursor-pointer hover:opacity-80 transition-opacity'
        )}
        disabled={!collapsible}
      >
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
              Weekly Debrief
            </p>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">{debrief.weekLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Always-visible summary even when collapsed */}
          {!expanded && topClient && (
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-text-tertiary">{debrief.totalTasks} tasks</span>
              <span className="text-text-tertiary">&middot;</span>
              <span className="text-text-tertiary">{debrief.totalMLU} MLU</span>
              <span className="text-text-tertiary">&middot;</span>
              <span className="text-accent font-medium">{topClient.name} ({topClient.energyShare}%)</span>
            </div>
          )}
          {collapsible && (
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={cn('text-text-tertiary transition-transform duration-200', expanded && 'rotate-180')}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-5 animate-fade-in">
          {/* Headlines */}
          {debrief.headlines.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {debrief.headlines.map((h) => (
                <div key={h.label} className="rounded-xl bg-surface-tertiary/60 border border-border/50 px-3 py-2">
                  <p className="text-[9px] text-text-tertiary uppercase tracking-wider">{h.label}</p>
                  <p className="text-sm font-semibold text-text-primary">{h.client}</p>
                </div>
              ))}
            </div>
          )}

          {/* Top stats — with top client name prominently displayed */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-surface-tertiary/40 border border-border/50 p-3 text-center">
              <p className="text-[10px] text-text-tertiary">Hours Worked</p>
              <p className="text-xl font-bold font-mono text-text-primary">{hours}h</p>
              <p className="text-[10px] text-text-tertiary">{debrief.totalTasks} tasks</p>
            </div>
            <div className="rounded-xl bg-surface-tertiary/40 border border-border/50 p-3 text-center">
              <p className="text-[10px] text-text-tertiary">Mental Units</p>
              <p className="text-xl font-bold font-mono text-accent">{debrief.totalMLU}</p>
              <p className="text-[10px] text-text-tertiary">MLU spent</p>
            </div>
            <div className="rounded-xl bg-accent/8 border border-accent/20 p-3 text-center">
              <p className="text-[10px] text-accent/70">Top Client</p>
              <p className="text-lg font-bold text-accent truncate">{topClient?.name || '\u2014'}</p>
              <p className="text-[10px] text-accent/70">{debrief.topClientShare}% of your brain</p>
            </div>
          </div>

          {/* Where Your Energy Went — clickable to expand */}
          <button
            onClick={() => toggleSection('energy')}
            className="w-full text-left cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
                Where Your Energy Went
              </p>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={cn('text-text-tertiary transition-transform duration-200', activeSection === 'energy' && 'rotate-180')}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </button>
          {/* Always show energy bars, but full detail is toggleable */}
          <div className="space-y-2">
            {debrief.clients.map((client) => (
              <div key={client.clientId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      'text-xs font-medium truncate',
                      client.clientId === topClient?.clientId ? 'text-accent' : 'text-text-primary'
                    )}>
                      {client.name}
                      {client.clientId === topClient?.clientId && (
                        <span className="text-[9px] ml-1.5 px-1.5 py-0.5 rounded-md bg-accent/15 text-accent font-medium">TOP</span>
                      )}
                    </span>
                    <span className="text-[10px] text-text-tertiary font-mono ml-2">{client.energyShare}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        client.clientId === topClient?.clientId ? 'bg-accent' : 'bg-accent/60'
                      )}
                      style={{ width: `${client.energyShare}%`, opacity: 0.5 + (client.energyShare / 200) }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-text-tertiary font-mono w-12 text-right">{client.totalMLU} MLU</span>
              </div>
            ))}
            {/* Internal work */}
            {debrief.internalTasks > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary font-medium">Internal / Unassigned</span>
                    <span className="text-[10px] text-text-tertiary font-mono ml-2">{internalShare}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-text-tertiary/40 transition-all duration-500"
                      style={{ width: `${internalShare}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-text-tertiary font-mono w-12 text-right">{debrief.internalMLU} MLU</span>
              </div>
            )}
          </div>

          {/* Client Value Snapshot — expandable section */}
          {debrief.clients.length > 0 && (
            <>
              <button
                onClick={() => toggleSection('value')}
                className="w-full text-left cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
                    Client Value Snapshot
                  </p>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={cn('text-text-tertiary transition-transform duration-200', activeSection === 'value' && 'rotate-180')}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </button>
              {activeSection === 'value' && (
                <div className="overflow-x-auto -mx-1 animate-fade-in">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 text-text-tertiary font-medium pl-1">Client</th>
                        <th className="text-right py-1.5 text-text-tertiary font-medium">Tasks</th>
                        <th className="text-right py-1.5 text-text-tertiary font-medium">MLU</th>
                        <th className="text-right py-1.5 text-text-tertiary font-medium">Est. Hours</th>
                        <th className="text-right py-1.5 text-text-tertiary font-medium">Weekly Pay</th>
                        <th className="text-right py-1.5 text-text-tertiary font-medium">/hour</th>
                        <th className="text-right py-1.5 text-text-tertiary font-medium pr-1">/MLU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debrief.clients.map((client) => {
                        const estHours = Math.round((client.estimatedMinutes / 60) * 10) / 10;
                        const allPerMLU = debrief.clients.filter(c => c.perMLU > 0).map(c => c.perMLU);
                        const isBest = allPerMLU.length > 1 && client.perMLU === Math.max(...allPerMLU);
                        const isWorst = allPerMLU.length > 1 && client.perMLU === Math.min(...allPerMLU) && client.perMLU > 0;

                        return (
                          <tr key={client.clientId} className="border-b border-border/30 hover:bg-surface-tertiary/20 transition-colors">
                            <td className={cn('py-2 font-medium pl-1', client.clientId === topClient?.clientId ? 'text-accent' : 'text-text-primary')}>
                              {client.name}
                            </td>
                            <td className="py-2 text-right text-text-secondary">{client.taskCount}</td>
                            <td className="py-2 text-right text-text-secondary font-mono">{client.totalMLU}</td>
                            <td className="py-2 text-right text-text-secondary">{estHours}h</td>
                            <td className="py-2 text-right text-text-secondary font-mono">{client.weeklyPay > 0 ? `\u00A3${client.weeklyPay}` : '\u2014'}</td>
                            <td className="py-2 text-right text-text-secondary font-mono">{client.perHour > 0 ? `\u00A3${client.perHour}` : '\u2014'}</td>
                            <td className={cn(
                              'py-2 text-right font-mono pr-1',
                              isBest ? 'text-emerald-400 font-medium' : isWorst ? 'text-red-400 font-medium' : 'text-text-secondary'
                            )}>
                              {client.perMLU > 0 ? `\u00A3${client.perMLU.toFixed(0)}` : '\u2014'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Comparisons */}
          {debrief.comparisons.length > 0 && (
            <div className="space-y-2">
              {debrief.comparisons.map((comp, i) => (
                <p key={i} className="text-[11px] text-text-secondary leading-relaxed pl-3 border-l-2 border-accent/30">
                  {comp.text}
                </p>
              ))}
            </div>
          )}

          {/* Suggestions — clickable to dismiss */}
          {debrief.suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
                Smart Nudges
              </p>
              <div className="space-y-1.5">
                {debrief.suggestions.map((sug, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-surface-tertiary/40 border border-border/50">
                    <span className="text-accent text-[10px] mt-px shrink-0">{i + 1}.</span>
                    <p className="text-[11px] text-text-secondary leading-relaxed">{sug.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
