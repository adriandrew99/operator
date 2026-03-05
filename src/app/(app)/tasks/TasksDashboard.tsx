'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { AnimatedCheckbox } from '@/components/ui/AnimatedCheckbox';
import { TASK_CATEGORIES, ENERGY_TYPES, TASK_WEIGHTS } from '@/lib/constants';
import { formatDate, isOverdue, isDueToday } from '@/lib/utils/date';
import { createTask, completeTask, deleteTask, updateTask, reactivateTask, flagTaskForToday, archiveTask, permanentlyDeleteTask, bulkDeleteTasks, bulkArchiveTasks } from '@/actions/tasks';
import type { Task, Client } from '@/lib/types/database';

interface TasksDashboardProps {
  tasks: Task[];
  completedTasks: Task[];
  archivedTasks: Task[];
  clients: Client[];
  hadGoodSleep: boolean;
}

type ViewTab = 'active' | 'completed' | 'archived';
type FilterCategory = 'all' | 'strategy' | 'clients' | 'content' | 'personal' | 'admin';
type QuickFilter = 'none' | 'high' | 'medium' | 'low';
type SortOption = 'default' | 'deadline' | 'weight' | 'category' | 'client' | 'newest';

const WEIGHT_DOT: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-text-tertiary',
};

const _WEIGHT_BADGE: Record<string, string> = {
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-surface-tertiary text-text-secondary border-border',
};

const _ENERGY_BADGE: Record<string, string> = {
  creative: 'bg-purple-500/10 text-purple-400',
  admin: 'bg-surface-tertiary text-text-tertiary',
  deep: 'bg-blue-500/10 text-blue-400',
};

export function TasksDashboard({ tasks, completedTasks, archivedTasks, clients, hadGoodSleep }: TasksDashboardProps) {
  const [viewTab, setViewTab] = useState<ViewTab>('active');
  const [category, setCategory] = useState<FilterCategory>('all');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('none');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [selectedArchived, setSelectedArchived] = useState<Set<string>>(new Set());
  const [isPending, _setIsPending] = useState(false);

  // Stats
  const stats = useMemo(() => {
    const overdue = tasks.filter(t => t.deadline && isOverdue(t.deadline)).length;
    const dueToday = tasks.filter(t => t.deadline && isDueToday(t.deadline)).length;
    const flaggedToday = tasks.filter(t => t.flagged_for_today).length;
    const urgent = tasks.filter(t => t.is_urgent).length;
    return { overdue, dueToday, flaggedToday, urgent };
  }, [tasks]);

  const filtered = useMemo(() => {
    let result = tasks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.project?.toLowerCase().includes(q)
      );
    }
    if (category !== 'all') {
      result = result.filter((t) => t.category === category);
    }
    if (quickFilter !== 'none') {
      result = result.filter((t) => t.weight === quickFilter);
    }
    if (sortBy !== 'default') {
      result = [...result].sort((a, b) => {
        switch (sortBy) {
          case 'deadline':
            if (!a.deadline && !b.deadline) return 0;
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return a.deadline.localeCompare(b.deadline);
          case 'weight': {
            const order = { high: 0, medium: 1, low: 2 };
            return (order[a.weight as keyof typeof order] ?? 2) - (order[b.weight as keyof typeof order] ?? 2);
          }
          case 'category':
            return (a.category || '').localeCompare(b.category || '');
          case 'client':
            return (a.client_id || 'zzz').localeCompare(b.client_id || 'zzz');
          case 'newest':
            return (b.created_at || '').localeCompare(a.created_at || '');
          default:
            return 0;
        }
      });
    }
    return result;
  }, [tasks, category, quickFilter, searchQuery, sortBy]);

  const grouped = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    filtered.forEach((t) => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, [filtered]);

  const clientMap = useMemo(() => {
    const map: Record<string, Client> = {};
    clients.forEach((c) => { map[c.id] = c; });
    return map;
  }, [clients]);

  function handleComplete(taskId: string) {
    setCompletingIds(prev => new Set(prev).add(taskId));
    completeTask(taskId).catch(e => console.error(e));
  }

  function handleReactivate(taskId: string) {
    reactivateTask(taskId).catch(e => console.error(e));
  }

  function handleFlagForToday(taskId: string, flagged: boolean) {
    flagTaskForToday(taskId, flagged).catch(e => console.error(e));
  }

  function handleArchive(taskId: string) {
    archiveTask(taskId).catch(e => console.error(e));
  }

  function handlePermanentDelete(taskId: string) {
    permanentlyDeleteTask(taskId).catch(e => console.error(e));
  }

  function handleBulkDeleteArchived() {
    if (selectedArchived.size === 0) return;
    const ids = Array.from(selectedArchived);
    setSelectedArchived(new Set());
    bulkDeleteTasks(ids).catch(e => console.error(e));
  }

  function handleBulkArchiveCompleted(ids: string[]) {
    bulkArchiveTasks(ids).catch(e => console.error(e));
  }

  function toggleArchivedSelection(id: string) {
    setSelectedArchived(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllArchived() {
    if (selectedArchived.size === archivedTasks.length) {
      setSelectedArchived(new Set());
    } else {
      setSelectedArchived(new Set(archivedTasks.map(t => t.id)));
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* ━━━ PAGE HEADER ━━━ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Tasks</h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            {tasks.length} active · {completedTasks.length} completed
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditingTask(null); setShowForm(true); }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="mr-1.5">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Task
        </Button>
      </div>

      {/* ━━━ STATUS PILLS ━━━ */}
      <div className="flex flex-wrap items-center gap-2">
        {stats.urgent > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs font-medium text-red-400">{stats.urgent} urgent</span>
          </div>
        )}
        {stats.overdue > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-danger/10 border border-danger/20">
            <span className="text-xs font-medium text-danger">{stats.overdue} overdue</span>
          </div>
        )}
        {stats.flaggedToday > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
            <span className="text-xs font-medium text-accent">{stats.flaggedToday} flagged today</span>
          </div>
        )}
        {stats.dueToday > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20">
            <span className="text-xs font-medium text-warning">{stats.dueToday} due today</span>
          </div>
        )}
        {!hadGoodSleep && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/5 border border-amber-500/10">
            <span className="text-xs text-amber-400">💤 Low sleep — consider lighter tasks</span>
          </div>
        )}
      </div>

      {/* ━━━ VIEW TABS + TOOLBAR ━━━ */}
      <div className="bg-surface-secondary border border-border rounded-lg overflow-hidden">

        {/* Tab header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-1">
            {([
              { key: 'active' as const, label: 'Active', count: tasks.length },
              { key: 'completed' as const, label: 'Completed', count: completedTasks.length },
              { key: 'archived' as const, label: 'Archive', count: archivedTasks.length },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewTab(tab.key)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                  viewTab === tab.key
                    ? 'bg-surface-tertiary text-text-primary'
                    : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                {tab.label}
                <span className={cn(
                  'ml-1.5 tabular-nums',
                  viewTab === tab.key ? 'text-text-secondary' : 'text-text-tertiary/60'
                )}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        {viewTab === 'active' && (
          <>
            {/* Search + Filter bar */}
            <div className="px-4 py-3 border-b border-border/50 space-y-3">
              {/* Search row */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className="w-full text-sm bg-surface-inset border border-border rounded-lg pl-9 pr-3 py-2 text-text-primary placeholder:text-text-tertiary/60 outline-none focus:border-accent/30 focus:ring-1 focus:ring-accent/10 transition-all"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    </button>
                  )}
                </div>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  className="text-xs bg-surface-inset border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent/30 transition-colors cursor-pointer"
                >
                  <option value="default">Default</option>
                  <option value="deadline">Deadline</option>
                  <option value="weight">Energy ↓</option>
                  <option value="category">Category</option>
                  <option value="client">Client</option>
                  <option value="newest">Newest</option>
                </select>
              </div>

              {/* Filter chips */}
              <div className="flex flex-wrap gap-1.5">
                {/* Category filters */}
                {[{ value: 'all' as const, label: 'All' }, ...TASK_CATEGORIES.map(c => ({ value: c.value as FilterCategory, label: c.label }))].map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={cn(
                      'px-2.5 py-1 text-[11px] font-medium rounded-full transition-all border',
                      category === cat.value
                        ? 'bg-accent/10 text-accent border-accent/20'
                        : 'bg-transparent text-text-tertiary border-border hover:text-text-secondary hover:border-border-light'
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
                <div className="w-px bg-border mx-1" />
                {/* Weight filters */}
                {[
                  { value: 'high' as const, label: 'High', dot: 'bg-red-400' },
                  { value: 'medium' as const, label: 'Med', dot: 'bg-amber-400' },
                  { value: 'low' as const, label: 'Low', dot: 'bg-text-tertiary' },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setQuickFilter(f.value === quickFilter ? 'none' : f.value)}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full transition-all border',
                      quickFilter === f.value
                        ? 'bg-surface-tertiary text-text-primary border-border-light'
                        : 'text-text-tertiary border-transparent hover:text-text-secondary'
                    )}
                  >
                    <div className={cn('w-1.5 h-1.5 rounded-full', f.dot)} />
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Task list */}
            <div className="divide-y divide-border/50">
              {filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-text-tertiary">
                    {searchQuery ? `No tasks matching "${searchQuery}"` : 'No tasks. Add one to get started.'}
                  </p>
                </div>
              ) : (
                Object.entries(grouped).map(([cat, catTasks]) => {
                  const catInfo = TASK_CATEGORIES.find((c) => c.value === cat);
                  return (
                    <div key={cat}>
                      <div className="px-4 py-2 bg-surface-tertiary/30">
                        <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-[0.08em]">
                          {catInfo?.label || cat}
                          <span className="ml-1.5 text-text-tertiary/60">{catTasks.length}</span>
                        </p>
                      </div>
                      {catTasks.map((task) => {
                        const isCompleting = completingIds.has(task.id);
                        return (
                          <div
                            key={task.id}
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 group hover:bg-surface-tertiary/30 transition-colors',
                              isCompleting && 'animate-task-complete'
                            )}
                          >
                            {/* Checkbox */}
                            <AnimatedCheckbox
                              checked={isCompleting}
                              onChange={() => handleComplete(task.id)}
                              disabled={isPending}
                              size="sm"
                            />

                            {/* Weight indicator dot */}
                            <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', WEIGHT_DOT[task.weight] || 'bg-text-tertiary')} />

                            {/* Task content */}
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => { setEditingTask(task); setShowForm(true); }}
                            >
                              <div className="flex items-center gap-2">
                                <p className={cn(
                                  'text-sm truncate',
                                  isCompleting ? 'text-text-tertiary line-through' : 'text-text-primary'
                                )}>
                                  {task.title}
                                </p>
                                {task.is_urgent && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold border border-red-500/20">
                                    URGENT
                                  </span>
                                )}
                                {task.flagged_for_today && (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                  </svg>
                                )}
                              </div>
                            </div>

                            {/* Metadata chips */}
                            <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                              {task.deadline && (
                                <span className={cn(
                                  'text-[10px] px-2 py-0.5 rounded-full border',
                                  isOverdue(task.deadline)
                                    ? 'bg-danger/10 text-danger border-danger/20'
                                    : isDueToday(task.deadline)
                                    ? 'bg-warning/10 text-warning border-warning/20'
                                    : 'bg-surface-tertiary text-text-tertiary border-border'
                                )}>
                                  {isOverdue(task.deadline) ? 'Overdue' : formatDate(task.deadline)}
                                </span>
                              )}
                              {task.client_id && clientMap[task.client_id] && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/5 text-text-tertiary border border-accent/10">
                                  {clientMap[task.client_id].name}
                                </span>
                              )}
                              {task.estimated_minutes && (
                                <span className="text-[10px] text-text-tertiary tabular-nums">{task.estimated_minutes}m</span>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button
                                onClick={() => handleFlagForToday(task.id, !task.flagged_for_today)}
                                className={cn(
                                  'p-1.5 rounded-lg transition-all',
                                  task.flagged_for_today ? 'text-accent bg-accent/10' : 'text-text-tertiary hover:text-accent hover:bg-accent/10'
                                )}
                                title={task.flagged_for_today ? 'Remove from today' : 'Flag for today'}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill={task.flagged_for_today ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => updateTask(task.id, { is_urgent: !task.is_urgent }).catch(e => console.error(e))}
                                className={cn(
                                  'p-1.5 rounded-lg transition-all',
                                  task.is_urgent ? 'text-red-400 bg-red-400/10' : 'text-text-tertiary hover:text-red-400 hover:bg-red-400/10'
                                )}
                                title={task.is_urgent ? 'Remove urgent' : 'Mark urgent'}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill={task.is_urgent ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                              </button>
                              <button
                                onClick={() => { setEditingTask(task); setShowForm(true); }}
                                className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-all"
                                title="Edit"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleArchive(task.id)}
                                className="p-1.5 rounded-lg text-text-tertiary hover:text-amber-400 hover:bg-amber-400/10 transition-all"
                                title="Archive"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteTask(task.id).catch(e => console.error(e))}
                                className="p-1.5 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger/10 transition-all"
                                title="Delete"
                              >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {viewTab === 'completed' && (
          <div>
            {completedTasks.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                <span className="text-xs text-text-tertiary">{completedTasks.length} completed task{completedTasks.length !== 1 ? 's' : ''}</span>
                <button
                  onClick={() => handleBulkArchiveCompleted(completedTasks.map(t => t.id))}
                  disabled={isPending}
                  className="text-xs text-text-tertiary hover:text-amber-400 transition-colors font-medium disabled:opacity-40"
                >
                  Archive all →
                </button>
              </div>
            )}
            {completedTasks.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-text-tertiary">No completed tasks yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-surface-tertiary/20 transition-colors">
                    <div className="w-5 h-5 rounded-full bg-accent-green/10 flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 opacity-30', WEIGHT_DOT[task.weight] || 'bg-text-tertiary')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-tertiary line-through truncate">{task.title}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                      {task.completed_at && (
                        <span className="text-[10px] text-text-tertiary/60">
                          {new Date(task.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      {task.client_id && clientMap[task.client_id] && (
                        <span className="text-[10px] text-text-tertiary/50">{clientMap[task.client_id].name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => handleReactivate(task.id)} className="text-[11px] text-text-tertiary hover:text-text-primary transition-all px-2 py-1 rounded-lg hover:bg-surface-tertiary">
                        Reactivate
                      </button>
                      <button onClick={() => handleArchive(task.id)} className="text-[11px] text-text-tertiary hover:text-amber-400 transition-all px-2 py-1 rounded-lg hover:bg-amber-400/10">
                        Archive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewTab === 'archived' && (
          <div>
            {archivedTasks.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                <button
                  onClick={selectAllArchived}
                  className="text-xs text-text-tertiary hover:text-text-secondary transition-colors font-medium"
                >
                  {selectedArchived.size === archivedTasks.length ? 'Deselect all' : 'Select all'}
                </button>
                {selectedArchived.size > 0 && (
                  <button
                    onClick={handleBulkDeleteArchived}
                    disabled={isPending}
                    className="text-xs text-danger hover:text-red-300 transition-colors font-medium disabled:opacity-40"
                  >
                    Delete {selectedArchived.size} selected
                  </button>
                )}
              </div>
            )}
            {archivedTasks.length === 0 ? (
              <div className="py-16 text-center space-y-1">
                <p className="text-sm text-text-tertiary">Archive is empty.</p>
                <p className="text-xs text-text-tertiary/60">Archive tasks to remove from scores without deleting data.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {archivedTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 group transition-colors',
                      selectedArchived.has(task.id) ? 'bg-danger/5' : 'hover:bg-surface-tertiary/20'
                    )}
                  >
                    <button
                      onClick={() => toggleArchivedSelection(task.id)}
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                        selectedArchived.has(task.id)
                          ? 'bg-danger/20 border-danger/40'
                          : 'border-border hover:border-text-tertiary'
                      )}
                    >
                      {selectedArchived.has(task.id) && (
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-tertiary truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.updated_at && (
                          <span className="text-[10px] text-text-tertiary/50">
                            {new Date(task.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {task.category && (
                          <span className="text-[10px] text-text-tertiary/40">
                            {TASK_CATEGORIES.find(c => c.value === task.category)?.label || task.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => handleReactivate(task.id)} className="text-[11px] text-text-tertiary hover:text-text-primary transition-all px-2 py-1 rounded-lg hover:bg-surface-tertiary">
                        Restore
                      </button>
                      <button onClick={() => handlePermanentDelete(task.id)} className="text-[11px] text-text-tertiary hover:text-danger transition-all px-2 py-1 rounded-lg hover:bg-danger/10">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Form Modal */}
      <TaskFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingTask(null); }}
        task={editingTask}
        clients={clients}
      />
    </div>
  );
}

function TaskFormModal({ open, onClose, task, clients }: { open: boolean; onClose: () => void; task: Task | null; clients: Client[] }) {
  const [loading, setLoading] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [_localClients, _setLocalClients] = useState(clients);
  void _localClients;
  void _setLocalClients;

  function handleAddClient() {
    if (!newClientName.trim()) return;
    const clientName = newClientName.trim();
    setLoading(true);
    setNewClientName('');
    setShowNewClient(false);
    import('@/actions/finance')
      .then(({ createClientAction }) => createClientAction({ name: clientName }))
      .catch(err => console.error('Failed to create client:', err))
      .finally(() => setLoading(false));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const data = {
      title: form.get('title') as string,
      description: (form.get('description') as string) || undefined,
      category: form.get('category') as string,
      energy: form.get('energy') as string,
      weight: form.get('weight') as string,
      project: (form.get('project') as string) || undefined,
      client_id: (form.get('client_id') as string) || undefined,
      deadline: (form.get('deadline') as string) || undefined,
      estimated_minutes: Number(form.get('estimated_minutes')) || undefined,
      is_urgent: form.get('is_urgent') === 'on',
    };

    const action = task ? updateTask(task.id, data) : createTask(data);
    action
      .then(() => onClose())
      .catch(err => console.error('Failed to save task:', err))
      .finally(() => setLoading(false));
  }

  return (
    <Modal open={open} onClose={onClose} title={task ? 'Edit Task' : 'Add Task'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input name="title" label="Title" required defaultValue={task?.title || ''} />
        <Textarea name="description" label="Description" defaultValue={task?.description || ''} rows={3} />
        <div className="grid grid-cols-2 gap-4">
          <Select
            name="category"
            label="Category"
            options={TASK_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            defaultValue={task?.category || 'strategy'}
          />
          <Select
            name="energy"
            label="Energy Type"
            options={ENERGY_TYPES.map((e) => ({ value: e.value, label: e.label }))}
            defaultValue={task?.energy || 'admin'}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            name="weight"
            label="Mental Energy"
            options={TASK_WEIGHTS.map((w) => ({ value: w.value, label: w.label }))}
            defaultValue={task?.weight || 'medium'}
          />
          <Input name="project" label="Project" defaultValue={task?.project || ''} placeholder="e.g., Website Redesign" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input name="deadline" label="Deadline" type="date" defaultValue={task?.deadline || ''} />
          <Input name="estimated_minutes" label="Focus Time (min)" type="number" defaultValue={task?.estimated_minutes ?? ''} />
        </div>
        <label className="flex items-center gap-2 py-1">
          <input type="checkbox" name="is_urgent" defaultChecked={task?.is_urgent || false} className="w-4 h-4 rounded border-border accent-red-500" />
          <span className="text-xs text-text-secondary">Mark as urgent</span>
          <span className="text-xs text-red-400/60 ml-1">Auto-prioritised in daily planner</span>
        </label>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-text-secondary">Client (optional)</label>
            <button
              type="button"
              onClick={() => setShowNewClient(!showNewClient)}
              className="text-xs text-text-secondary hover:text-text-primary transition-colors font-medium"
            >
              {showNewClient ? 'Cancel' : '+ New Client'}
            </button>
          </div>
          {showNewClient && (
            <div className="flex items-center gap-2 mb-2 animate-fade-in">
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddClient())}
                placeholder="Client name..."
                className="flex-1 text-sm bg-surface-inset border border-border rounded-lg px-2.5 py-1.5 text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/30 transition-colors"
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddClient}
                disabled={loading || !newClientName.trim()}
                className="text-xs text-text-primary font-medium disabled:opacity-40 px-2 py-1.5"
              >
                Add
              </button>
            </div>
          )}
          <Select
            name="client_id"
            label=""
            options={[{ value: '', label: 'None' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
            defaultValue={task?.client_id || ''}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Saving...' : task ? 'Update' : 'Add Task'}</Button>
        </div>
      </form>
    </Modal>
  );
}
