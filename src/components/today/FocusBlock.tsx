'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { getTaskMLU, calculateDailyLoad, DAILY_CAPACITY, getLoadLevel, type LoadLevel } from '@/lib/utils/mental-load';
import type { Task, Client, CalendarEvent, OperatorScore, PinnedNote } from '@/lib/types/database';
import { savePinnedNote, unpinNote } from '@/actions/pinned-notes';

interface FocusBlockProps {
  todayTasks: Task[];
  completedTodayTasks: Task[];
  todayScore: OperatorScore | null;
  streakDays: number;
  fundamentalsHit: number;
  fundamentalsTotal: number;
  dailyCapacity?: number;
  calendarEvents?: CalendarEvent[];
  clients: Client[];
  completedCount: number;
  totalCount: number;
  pinnedNote?: PinnedNote | null;
  confirmedMRR?: number;
  /** Computed daily load from TodayTasks — used instead of recalculating to stay in sync */
  computedDailyLoad?: number | null;
}

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

export function FocusBlock({
  todayTasks,
  completedTodayTasks,
  todayScore,
  streakDays,
  fundamentalsHit,
  fundamentalsTotal,
  dailyCapacity = DAILY_CAPACITY,
  calendarEvents = [],
  clients,
  completedCount,
  totalCount,
  pinnedNote,
  confirmedMRR = 0,
  computedDailyLoad,
}: FocusBlockProps) {
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

  const energyData = useMemo(() => {
    const allTasks = [...todayTasks, ...completedTodayTasks];
    // Use computedDailyLoad from TodayTasks when available (includes optimistic/local state)
    // Fall back to recalculating from server props only
    const serverMLU = calculateDailyLoad(allTasks);
    const totalMLU = computedDailyLoad ?? serverMLU;
    const completedMLU = calculateDailyLoad(completedTodayTasks);
    const remainingMLU = Math.max(0, totalMLU - completedMLU);
    const capacityPct = Math.min(100, (totalMLU / dailyCapacity) * 100);
    const usedPct = totalMLU > 0 ? Math.min(100, (completedMLU / dailyCapacity) * 100) : 0;
    const loadLevel = getLoadLevel(totalMLU, dailyCapacity);

    // Task breakdown (exclude personal)
    const nonPersonal = allTasks.filter(t => !('is_personal' in t && t.is_personal));
    const highTasks = nonPersonal.filter(t => (t.weight || 'medium') === 'high').length;
    const creativeTasks = nonPersonal.filter(t => (t.energy || 'admin') === 'creative').length;

    return { totalMLU, completedMLU, remainingMLU, capacityPct, usedPct, loadLevel, highTasks, creativeTasks, taskCount: nonPersonal.length };
  }, [todayTasks, completedTodayTasks, dailyCapacity, computedDailyLoad]);

  const quote = useMemo(() => getDailyQuote(), []);

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

  return (
    <div className="card-glass rounded-2xl p-8 sm:p-10">
      <div className="flex flex-col gap-6">
        {/* ━━━ TOP: Key metrics row ━━━ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
          {/* MLU Load — hero metric */}
          <div>
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-2">Daily Load</p>
            <div className="flex items-baseline gap-2">
              <span className={cn('display-number-large leading-none', getLoadAccent(energyData.loadLevel))}>
                {Math.round(energyData.totalMLU)}
              </span>
              <span className="text-sm text-text-tertiary font-mono">/ {dailyCapacity}</span>
            </div>
            <p className={cn('text-[11px] mt-1.5', getLoadAccent(energyData.loadLevel))}>
              {getLoadLabel(energyData.loadLevel)}
            </p>
          </div>

          {/* Tasks */}
          <div>
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-2">Tasks</p>
            <div className="flex items-baseline gap-1">
              <span className="display-number-large leading-none text-text-primary">{completedCount}</span>
              <span className="text-sm text-text-tertiary font-mono">/ {totalCount}</span>
            </div>
            {energyData.highTasks > 0 && (
              <p className="text-[11px] text-text-tertiary mt-1.5">
                {energyData.highTasks} heavy · {energyData.creativeTasks} creative
              </p>
            )}
          </div>

          {/* Confirmed MRR */}
          <div>
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-2">Confirmed MRR</p>
            <span className="display-number-large leading-none text-text-primary">
              £{confirmedMRR >= 1000 ? `${(confirmedMRR / 1000).toFixed(1)}k` : confirmedMRR.toLocaleString()}
            </span>
            <p className="text-[11px] text-text-tertiary mt-1.5">
              {clients.filter(c => {
                if (!c.is_active || !c.retainer_amount) return false;
                if (c.termination_date) {
                  const termDate = new Date(c.termination_date + 'T12:00:00');
                  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                  if (termDate < monthStart) return false;
                }
                return true;
              }).length} active clients
            </p>
          </div>

          {/* Habits + Streak */}
          <div>
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.08em] font-medium mb-2">Habits</p>
            <div className="flex items-baseline gap-1">
              <span className="display-number-large leading-none text-text-primary">{fundamentalsHit}</span>
              <span className="text-sm text-text-tertiary font-mono">/ {fundamentalsTotal}</span>
            </div>
            {streakDays > 0 && (
              <p className="text-[11px] text-accent mt-1.5">{streakDays}d streak</p>
            )}
          </div>
        </div>

        {/* ━━━ CAPACITY BAR ━━━ */}
        <div>
          <div className="h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
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

        {/* ━━━ BOTTOM: Pinned note + Quote ━━━ */}
        <div className="flex flex-col sm:flex-row items-start gap-4 pt-2 border-t border-border">
          {/* Pinned note */}
          <div className="flex-1 min-w-0">
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
                className="text-sm text-text-tertiary hover:text-text-secondary transition-colors"
              >
                + Pin a note for today
              </button>
            )}
          </div>

          {/* Daily quote */}
          <div className="sm:text-right sm:max-w-[280px] flex-shrink-0">
            <p className="text-xs text-text-tertiary italic leading-relaxed">
              &ldquo;{quote.text}&rdquo;
            </p>
            <p className="text-[11px] text-text-tertiary mt-1">— {quote.author}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
