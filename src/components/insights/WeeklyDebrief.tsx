'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { WeeklyDebrief as WeeklyDebriefData } from '@/actions/insights';

interface DebriefHistoryEntry {
  week_start: string;
  week_label: string;
  data: WeeklyDebriefData;
}

interface WeeklyDebriefProps {
  debrief: WeeklyDebriefData;
  history?: DebriefHistoryEntry[];
  collapsible?: boolean;
}

function formatDelta(current: number, previous: number): { text: string; color: string } {
  if (previous === 0) return { text: '', color: '' };
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  if (pct === 0) return { text: '—', color: 'text-text-tertiary' };
  return {
    text: `${pct > 0 ? '+' : ''}${pct}%`,
    color: pct > 0 ? 'text-accent-green' : 'text-danger',
  };
}

export function WeeklyDebrief({ debrief, history = [], collapsible }: WeeklyDebriefProps) {
  const [expanded, setExpanded] = useState(!collapsible);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [viewingHistoryIdx, setViewingHistoryIdx] = useState<number | null>(null);
  const hours = Math.round((debrief.totalMinutes / 60) * 10) / 10;
  const internalShare = debrief.totalMLU > 0 ? Math.round((debrief.internalMLU / debrief.totalMLU) * 100) : 0;
  const topClient = debrief.clients[0];

  // Get previous week for comparison (first history entry that isn't the current week)
  const previousDebrief = history.length > 0 ? history[0]?.data : null;

  // Currently viewed debrief (current or historical)
  const viewedDebrief = viewingHistoryIdx !== null && history[viewingHistoryIdx]
    ? history[viewingHistoryIdx].data
    : debrief;
  const viewedLabel = viewingHistoryIdx !== null && history[viewingHistoryIdx]
    ? history[viewingHistoryIdx].week_label
    : debrief.weekLabel;
  const isViewingHistory = viewingHistoryIdx !== null;

  // Comparison debrief (the week before the one being viewed)
  const comparisonDebrief = isViewingHistory
    ? (viewingHistoryIdx !== null && viewingHistoryIdx + 1 < history.length ? history[viewingHistoryIdx + 1].data : null)
    : previousDebrief;

  const viewedHours = Math.round((viewedDebrief.totalMinutes / 60) * 10) / 10;
  const viewedInternalShare = viewedDebrief.totalMLU > 0 ? Math.round((viewedDebrief.internalMLU / viewedDebrief.totalMLU) * 100) : 0;
  const viewedTopClient = viewedDebrief.clients[0];

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
          <p className="text-xs text-text-secondary mt-0.5">{viewedLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          {!expanded && viewedTopClient && (
            <div className="flex items-center gap-3 text-xs text-text-tertiary">
              <span>{viewedDebrief.totalTasks} tasks</span>
              <span>&middot;</span>
              <span>{viewedDebrief.totalMLU} MLU</span>
              <span>&middot;</span>
              <span className="text-text-primary font-medium">{viewedTopClient.name} ({viewedTopClient.energyShare}%)</span>
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

          {/* Week selector — if history available */}
          {history.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
              <button
                onClick={() => setViewingHistoryIdx(null)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer',
                  viewingHistoryIdx === null
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'bg-surface-tertiary text-text-secondary hover:text-text-primary'
                )}
              >
                This Week
              </button>
              {history.map((entry, idx) => (
                <button
                  key={entry.week_start}
                  onClick={() => setViewingHistoryIdx(idx)}
                  className={cn(
                    'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer',
                    viewingHistoryIdx === idx
                      ? 'bg-accent/15 text-accent font-medium'
                      : 'bg-surface-tertiary text-text-secondary hover:text-text-primary'
                  )}
                >
                  {entry.data.weekLabel || entry.week_label}
                </button>
              ))}
            </div>
          )}

          {/* Headlines */}
          {viewedDebrief.headlines.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {viewedDebrief.headlines.map((h) => (
                <div key={h.label}>
                  <p className="text-xs text-text-tertiary">{h.label}</p>
                  <p className="text-sm font-semibold text-text-primary">{h.client}</p>
                </div>
              ))}
            </div>
          )}

          {/* Top stats with week-over-week comparison */}
          <div className="flex items-baseline gap-6 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Hours</p>
              <div className="flex items-baseline gap-1.5">
                <p className="display-number-medium text-text-primary">{viewedHours}h</p>
                {comparisonDebrief && (
                  <span className={cn('text-[10px] font-mono', formatDelta(viewedDebrief.totalMinutes, comparisonDebrief.totalMinutes).color)}>
                    {formatDelta(viewedDebrief.totalMinutes, comparisonDebrief.totalMinutes).text}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Tasks</p>
              <div className="flex items-baseline gap-1.5">
                <p className="display-number-medium text-text-primary">{viewedDebrief.totalTasks}</p>
                {comparisonDebrief && (
                  <span className={cn('text-[10px] font-mono', formatDelta(viewedDebrief.totalTasks, comparisonDebrief.totalTasks).color)}>
                    {formatDelta(viewedDebrief.totalTasks, comparisonDebrief.totalTasks).text}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">MLU</p>
              <div className="flex items-baseline gap-1.5">
                <p className="display-number-medium text-text-primary">{viewedDebrief.totalMLU}</p>
                {comparisonDebrief && (
                  <span className={cn('text-[10px] font-mono', formatDelta(viewedDebrief.totalMLU, comparisonDebrief.totalMLU).color)}>
                    {formatDelta(viewedDebrief.totalMLU, comparisonDebrief.totalMLU).text}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Top Client</p>
              <p className="text-lg font-semibold text-text-primary">{viewedTopClient?.name || '\u2014'}</p>
              <p className="text-xs text-text-tertiary">{viewedDebrief.topClientShare}% of energy</p>
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
              {viewedDebrief.clients.map((client) => (
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
                          client.clientId === viewedTopClient?.clientId ? 'bg-accent' : 'bg-text-secondary'
                        )}
                        style={{ width: `${client.energyShare}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-text-tertiary font-mono w-12 text-right">{client.totalMLU}</span>
                </div>
              ))}
              {viewedDebrief.internalTasks > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-secondary font-medium">Internal / Unassigned</span>
                      <span className="text-xs text-text-tertiary font-mono ml-2">{viewedInternalShare}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-text-tertiary transition-all duration-500"
                        style={{ width: `${viewedInternalShare}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-text-tertiary font-mono w-12 text-right">{viewedDebrief.internalMLU}</span>
                </div>
              )}
            </div>
          </div>

          {/* Client Value Snapshot */}
          {viewedDebrief.clients.length > 0 && (
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
                  <div className="mt-3 overflow-x-auto">
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
                        {viewedDebrief.clients.map((client) => {
                          const estHours = Math.round((client.estimatedMinutes / 60) * 10) / 10;
                          const allPerMLU = viewedDebrief.clients.filter(c => c.perMLU > 0).map(c => c.perMLU);
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

          {/* Week-over-Week Comparison */}
          {comparisonDebrief && (
            <>
              <div className="border-t border-border" />
              <div>
                <button
                  onClick={() => toggleSection('comparison')}
                  className="w-full text-left cursor-pointer flex items-center justify-between"
                >
                  <p className="text-sm font-semibold text-text-primary">Week-over-Week</p>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={cn('text-text-tertiary transition-transform duration-200', activeSection === 'comparison' && 'rotate-180')}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {activeSection === 'comparison' && (
                  <div className="mt-3 space-y-3">
                    {/* Key metric deltas */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Tasks', current: viewedDebrief.totalTasks, prev: comparisonDebrief.totalTasks, suffix: '' },
                        { label: 'MLU', current: viewedDebrief.totalMLU, prev: comparisonDebrief.totalMLU, suffix: '' },
                        { label: 'Hours', current: Math.round(viewedDebrief.totalMinutes / 60 * 10) / 10, prev: Math.round(comparisonDebrief.totalMinutes / 60 * 10) / 10, suffix: 'h' },
                        { label: 'Internal %', current: viewedDebrief.totalMLU > 0 ? Math.round((viewedDebrief.internalMLU / viewedDebrief.totalMLU) * 100) : 0, prev: comparisonDebrief.totalMLU > 0 ? Math.round((comparisonDebrief.internalMLU / comparisonDebrief.totalMLU) * 100) : 0, suffix: '%' },
                      ].map((m) => {
                        const diff = m.current - m.prev;
                        const isUp = diff > 0;
                        const isDown = diff < 0;
                        return (
                          <div key={m.label} className="card-inset rounded-xl p-3">
                            <p className="text-[10px] text-text-tertiary uppercase tracking-wide">{m.label}</p>
                            <div className="flex items-baseline gap-1.5 mt-1">
                              <span className="text-sm font-semibold text-text-primary">{m.current}{m.suffix}</span>
                              {diff !== 0 && (
                                <span className={cn('text-[10px] font-mono', isUp ? 'text-accent-green' : 'text-danger')}>
                                  {isUp ? '+' : ''}{m.suffix === '%' ? diff : diff}{m.suffix}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-text-tertiary mt-0.5">prev: {m.prev}{m.suffix}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Client-level changes */}
                    {viewedDebrief.clients.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs text-text-tertiary font-medium">Client Energy Changes</p>
                        {viewedDebrief.clients.map((client) => {
                          const prevClient = comparisonDebrief.clients.find(c => c.clientId === client.clientId);
                          const prevShare = prevClient?.energyShare || 0;
                          const shareDiff = client.energyShare - prevShare;
                          return (
                            <div key={client.clientId} className="flex items-center justify-between text-xs">
                              <span className="text-text-primary">{client.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-text-tertiary font-mono">{client.energyShare}%</span>
                                {shareDiff !== 0 && (
                                  <span className={cn('font-mono text-[10px]', shareDiff > 0 ? 'text-warning' : 'text-accent-green')}>
                                    {shareDiff > 0 ? '+' : ''}{shareDiff}%
                                  </span>
                                )}
                                {!prevClient && (
                                  <span className="text-[10px] text-accent">new</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {/* Clients that disappeared this week */}
                        {comparisonDebrief.clients
                          .filter(pc => !viewedDebrief.clients.find(c => c.clientId === pc.clientId))
                          .map((gone) => (
                            <div key={gone.clientId} className="flex items-center justify-between text-xs opacity-50">
                              <span className="text-text-tertiary">{gone.name}</span>
                              <span className="text-[10px] text-text-tertiary">dropped off</span>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Comparisons (auto-generated text) */}
          {viewedDebrief.comparisons.length > 0 && (
            <>
              <div className="border-t border-border" />
              <div className="space-y-2">
                {viewedDebrief.comparisons.map((comp, i) => (
                  <p key={i} className="text-xs text-text-secondary leading-relaxed">
                    {comp.text}
                  </p>
                ))}
              </div>
            </>
          )}

          {/* Suggestions */}
          {viewedDebrief.suggestions.length > 0 && (
            <>
              <div className="border-t border-border" />
              <div>
                <p className="text-sm font-semibold text-text-primary mb-3">Smart Nudges</p>
                <div className="space-y-0">
                  {viewedDebrief.suggestions.map((sug, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-start gap-2.5 py-2.5',
                        i < viewedDebrief.suggestions.length - 1 && 'border-b border-border'
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
