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
      {/* Header */}
      <button
        onClick={() => collapsible && setExpanded(prev => !prev)}
        className={cn(
          'flex items-center justify-between w-full text-left',
          collapsible && 'cursor-pointer hover:opacity-80 transition-opacity'
        )}
        disabled={!collapsible}
      >
        <div>
          <p className="text-sm font-semibold text-text-primary">Weekly Debrief</p>
          <p className="text-xs text-text-secondary mt-0.5">{debrief.weekLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          {!expanded && topClient && (
            <div className="flex items-center gap-3 text-xs text-text-tertiary">
              <span>{debrief.totalTasks} tasks</span>
              <span>&middot;</span>
              <span>{debrief.totalMLU} MLU</span>
              <span>&middot;</span>
              <span className="text-text-primary font-medium">{topClient.name} ({topClient.energyShare}%)</span>
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
        <div className="space-y-5">
          {/* Headlines */}
          {debrief.headlines.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {debrief.headlines.map((h) => (
                <div key={h.label}>
                  <p className="text-xs text-text-tertiary">{h.label}</p>
                  <p className="text-sm font-semibold text-text-primary">{h.client}</p>
                </div>
              ))}
            </div>
          )}

          {/* Top stats */}
          <div className="flex items-baseline gap-6 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Hours</p>
              <p className="display-number-medium text-text-primary">{hours}h</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Tasks</p>
              <p className="display-number-medium text-text-primary">{debrief.totalTasks}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">MLU</p>
              <p className="display-number-medium text-text-primary">{debrief.totalMLU}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Top Client</p>
              <p className="text-lg font-semibold text-text-primary">{topClient?.name || '\u2014'}</p>
              <p className="text-xs text-text-tertiary">{debrief.topClientShare}% of energy</p>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Energy breakdown */}
          <div>
            <button
              onClick={() => toggleSection('energy')}
              className="w-full text-left cursor-pointer flex items-center justify-between mb-3"
            >
              <p className="text-sm font-semibold text-text-primary">Where Your Energy Went</p>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={cn('text-text-tertiary transition-transform duration-200', activeSection === 'energy' && 'rotate-180')}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div className="space-y-2.5">
              {debrief.clients.map((client) => (
                <div key={client.clientId} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-text-primary truncate">
                        {client.name}
                      </span>
                      <span className="text-xs text-text-tertiary font-mono ml-2">{client.energyShare}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          client.clientId === topClient?.clientId ? 'bg-accent' : 'bg-text-secondary'
                        )}
                        style={{ width: `${client.energyShare}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-text-tertiary font-mono w-12 text-right">{client.totalMLU}</span>
                </div>
              ))}
              {debrief.internalTasks > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-secondary font-medium">Internal / Unassigned</span>
                      <span className="text-xs text-text-tertiary font-mono ml-2">{internalShare}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-text-tertiary transition-all duration-500"
                        style={{ width: `${internalShare}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-text-tertiary font-mono w-12 text-right">{debrief.internalMLU}</span>
                </div>
              )}
            </div>
          </div>

          {/* Client Value Snapshot */}
          {debrief.clients.length > 0 && (
            <>
              <div className="border-t border-border" />
              <div>
                <button
                  onClick={() => toggleSection('value')}
                  className="w-full text-left cursor-pointer flex items-center justify-between"
                >
                  <p className="text-sm font-semibold text-text-primary">Client Value Snapshot</p>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={cn('text-text-tertiary transition-transform duration-200', activeSection === 'value' && 'rotate-180')}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {activeSection === 'value' && (
                  <div className="mt-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-text-tertiary font-medium">Client</th>
                          <th className="text-right py-2 text-text-tertiary font-medium">Tasks</th>
                          <th className="text-right py-2 text-text-tertiary font-medium">MLU</th>
                          <th className="text-right py-2 text-text-tertiary font-medium">Hours</th>
                          <th className="text-right py-2 text-text-tertiary font-medium">Weekly Pay</th>
                          <th className="text-right py-2 text-text-tertiary font-medium">/hour</th>
                          <th className="text-right py-2 text-text-tertiary font-medium">/MLU</th>
                        </tr>
                      </thead>
                      <tbody>
                        {debrief.clients.map((client) => {
                          const estHours = Math.round((client.estimatedMinutes / 60) * 10) / 10;
                          const allPerMLU = debrief.clients.filter(c => c.perMLU > 0).map(c => c.perMLU);
                          const isBest = allPerMLU.length > 1 && client.perMLU === Math.max(...allPerMLU);
                          const isWorst = allPerMLU.length > 1 && client.perMLU === Math.min(...allPerMLU) && client.perMLU > 0;

                          return (
                            <tr key={client.clientId} className="border-b border-border">
                              <td className="py-2.5 font-medium text-text-primary">
                                {client.name}
                              </td>
                              <td className="py-2.5 text-right text-text-secondary">{client.taskCount}</td>
                              <td className="py-2.5 text-right text-text-secondary font-mono">{client.totalMLU}</td>
                              <td className="py-2.5 text-right text-text-secondary">{estHours}h</td>
                              <td className="py-2.5 text-right text-text-secondary font-mono">{client.weeklyPay > 0 ? `\u00A3${client.weeklyPay}` : '\u2014'}</td>
                              <td className="py-2.5 text-right text-text-secondary font-mono">{client.perHour > 0 ? `\u00A3${client.perHour}` : '\u2014'}</td>
                              <td className={cn(
                                'py-2.5 text-right font-mono',
                                isBest ? 'text-text-primary font-medium' : isWorst ? 'text-text-tertiary' : 'text-text-secondary'
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
              </div>
            </>
          )}

          {/* Comparisons */}
          {debrief.comparisons.length > 0 && (
            <>
              <div className="border-t border-border" />
              <div className="space-y-2">
                {debrief.comparisons.map((comp, i) => (
                  <p key={i} className="text-xs text-text-secondary leading-relaxed">
                    {comp.text}
                  </p>
                ))}
              </div>
            </>
          )}

          {/* Suggestions */}
          {debrief.suggestions.length > 0 && (
            <>
              <div className="border-t border-border" />
              <div>
                <p className="text-sm font-semibold text-text-primary mb-3">Smart Nudges</p>
                <div className="space-y-0">
                  {debrief.suggestions.map((sug, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-start gap-2.5 py-2.5',
                        i < debrief.suggestions.length - 1 && 'border-b border-border'
                      )}
                    >
                      <span className="text-xs text-text-tertiary mt-px shrink-0">{i + 1}.</span>
                      <p className="text-xs text-text-secondary leading-relaxed">{sug.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
