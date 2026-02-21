'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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

const ENERGY_COLORS: Record<string, string> = {
  deep: 'bg-surface-tertiary text-text-secondary',
  admin: 'bg-surface-tertiary text-text-secondary',
  creative: 'bg-surface-tertiary text-text-secondary',
};

const WEIGHT_COLORS: Record<string, string> = {
  low: 'bg-surface-tertiary text-text-secondary',
  medium: 'bg-surface-tertiary text-text-secondary',
  high: 'bg-surface-tertiary text-text-secondary',
};

/* ━━━ Hover Tooltip for Tags ━━━ */
function TagWithTooltip({ label, colorClass, tasks }: { label: string; colorClass: string; tasks: Task[] }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function handleEnter() {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShow(true), 300);
  }
  function handleLeave() {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShow(false), 150);
  }

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <span
      ref={ref}
      className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium relative cursor-default', colorClass)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {label}
      {show && tasks.length > 0 && (
        <div className="absolute z-50 left-0 top-full mt-1.5 bg-surface-secondary border border-border rounded-2xl p-3 min-w-[200px] max-w-[280px] animate-fade-in"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <p className="text-xs text-text-tertiary  mb-2">{label} tasks ({tasks.length})</p>
          <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
            {tasks.slice(0, 8).map(t => (
              <div key={t.id} className="flex items-center gap-2">
                <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', WEIGHT_COLORS[t.weight]?.replace(/text-\S+/, '') || 'bg-text-tertiary')} />
                <span className="text-xs text-text-primary truncate">{t.title}</span>
              </div>
            ))}
            {tasks.length > 8 && <p className="text-xs text-text-tertiary">+{tasks.length - 8} more</p>}
          </div>
        </div>
      )}
    </span>
  );
}

export function TasksDashboard({ tasks, completedTasks, archivedTasks, clients, hadGoodSleep }: TasksDashboardProps) {
  const [viewTab, setViewTab] = useState<ViewTab>('active');
  const [category, setCategory] = useState<FilterCategory>('all');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('none');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [selectedArchived, setSelectedArchived] = useState<Set<string>>(new Set());
  const [isPending, setIsPending] = useState(false);

  // Group tasks by energy/weight for tooltips
  const tasksByWeight = useMemo(() => ({
    high: tasks.filter(t => t.weight === 'high'),
    medium: tasks.filter(t => t.weight === 'medium'),
    low: tasks.filter(t => t.weight === 'low'),
  }), [tasks]);

  const tasksByEnergy = useMemo(() => ({
    creative: tasks.filter(t => t.energy === 'creative'),
    admin: tasks.filter(t => t.energy === 'admin'),
  }), [tasks]);

  const filtered = useMemo(() => {
    let result = tasks;
    if (category !== 'all') {
      result = result.filter((t) => t.category === category);
    }
    if (quickFilter !== 'none') {
      result = result.filter((t) => t.weight === quickFilter);
    }
    return result;
  }, [tasks, category, quickFilter]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    filtered.forEach((t) => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, [filtered]);

  // Create client lookup
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* View Tabs */}
      <div className="flex items-center gap-1 bg-surface-tertiary p-1 rounded-xl w-fit">
        {([
          { key: 'active' as const, label: `Active (${tasks.length})` },
          { key: 'completed' as const, label: `Completed (${completedTasks.length})` },
          { key: 'archived' as const, label: `Archive (${archivedTasks.length})` },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setViewTab(tab.key)}
            className={cn(
              'px-4 py-1.5 text-xs font-medium rounded-lg transition-all',
              viewTab === tab.key
                ? 'bg-surface-secondary text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {viewTab === 'active' ? (
        <>
          {/* Energy Suggestion */}
          {!hadGoodSleep && (
            <div className="bg-warning/5 border border-warning/20 rounded-xl px-4 py-3 text-xs text-warning">
              Low sleep detected. Consider admin tasks today.
            </div>
          )}

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2">
            {[{ value: 'all' as const, label: 'All' }, ...TASK_CATEGORIES.map(c => ({ value: c.value as FilterCategory, label: c.label }))].map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  category === cat.value
                    ? 'bg-surface-tertiary text-text-primary border border-text-primary/20'
                    : 'bg-surface-secondary text-text-secondary hover:text-text-primary border border-border'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Mental Energy Filters */}
          <div className="flex gap-2">
            {[
              { value: 'none' as const, label: 'All Energy' },
              { value: 'high' as const, label: 'High', color: 'text-red-400' },
              { value: 'medium' as const, label: 'Medium', color: 'text-amber-400' },
              { value: 'low' as const, label: 'Low', color: 'text-text-secondary' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setQuickFilter(f.value === quickFilter ? 'none' : f.value)}
                className={cn(
                  'px-2.5 py-1 text-xs  font-medium rounded-lg transition-colors',
                  quickFilter === f.value
                    ? 'bg-surface-tertiary text-text-primary'
                    : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Add Task */}
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEditingTask(null); setShowForm(true); }}>
              Add Task
            </Button>
          </div>

          {/* Task Groups */}
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-text-tertiary py-12">
              No tasks. Add one to get started.
            </p>
          ) : (
            Object.entries(grouped).map(([cat, catTasks]) => {
              const catInfo = TASK_CATEGORIES.find((c) => c.value === cat);
              return (
                <div key={cat} className="space-y-2">
                  <p className="text-xs font-medium text-text-tertiary ">
                    {catInfo?.label || cat} ({catTasks.length})
                  </p>
                  <div className="space-y-2">
                    {catTasks.map((task) => {
                      const isCompleting = completingIds.has(task.id);
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            'bg-surface-secondary border border-border rounded-xl p-3 flex items-start gap-3 task-row group',
                            isCompleting && 'animate-task-complete'
                          )}
                        >
                          <div className="mt-0.5">
                            <AnimatedCheckbox
                              checked={isCompleting}
                              onChange={() => handleComplete(task.id)}
                              disabled={isPending}
                              size="sm"
                            />
                          </div>
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => { setEditingTask(task); setShowForm(true); }}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={cn(
                                'text-sm font-medium truncate',
                                isCompleting ? 'text-text-tertiary line-through' : 'text-text-primary'
                              )}>
                                {task.title}
                              </p>
                              {task.is_urgent && (
                                <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold bg-surface-tertiary text-text-secondary">
                                  URGENT
                                </span>
                              )}
                              <TagWithTooltip
                                label={task.energy}
                                colorClass={ENERGY_COLORS[task.energy]}
                                tasks={tasksByEnergy[task.energy as keyof typeof tasksByEnergy] || []}
                              />
                              {task.weight && (
                                <TagWithTooltip
                                  label={task.weight}
                                  colorClass={WEIGHT_COLORS[task.weight]}
                                  tasks={tasksByWeight[task.weight as keyof typeof tasksByWeight] || []}
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              {task.deadline && (
                                <span className={cn(
                                  'text-xs',
                                  isOverdue(task.deadline) ? 'text-danger' :
                                  isDueToday(task.deadline) ? 'text-warning' :
                                  'text-text-tertiary'
                                )}>
                                  {isOverdue(task.deadline) ? 'Overdue' : formatDate(task.deadline)}
                                </span>
                              )}
                              {task.estimated_minutes && (
                                <span className="text-xs text-text-tertiary">
                                  {task.estimated_minutes}m
                                </span>
                              )}
                              {task.project && (
                                <span className="text-xs text-text-tertiary">
                                  {task.project}
                                </span>
                              )}
                              {task.client_id && clientMap[task.client_id] && (
                                <span className="text-xs text-text-tertiary">
                                  {clientMap[task.client_id].name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditingTask(task); setShowForm(true); }}
                              className="text-text-tertiary hover:text-text-primary transition-all p-1 rounded-lg hover:bg-surface-tertiary"
                              title="Edit task"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => updateTask(task.id, { is_urgent: !task.is_urgent }).catch(e => console.error(e))}
                              className={cn(
                                'transition-all p-1 rounded-lg',
                                task.is_urgent
                                  ? 'text-red-400 bg-red-400/10'
                                  : 'text-text-tertiary hover:text-red-400 hover:bg-red-400/10'
                              )}
                              title={task.is_urgent ? 'Remove urgent' : 'Mark as urgent'}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill={task.is_urgent ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleFlagForToday(task.id, !task.flagged_for_today)}
                              className={cn(
                                'transition-all p-1 rounded-lg',
                                task.flagged_for_today
                                  ? 'text-text-primary bg-surface-tertiary'
                                  : 'text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary'
                              )}
                              title={task.flagged_for_today ? 'Remove from today' : 'Add to today'}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill={task.flagged_for_today ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleArchive(task.id)}
                              className="text-text-tertiary hover:text-amber-400 transition-all p-1 rounded-lg hover:bg-amber-400/10"
                              title="Archive task"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteTask(task.id).catch(e => console.error(e))}
                              className="text-text-tertiary hover:text-danger transition-all p-1 rounded-lg hover:bg-danger/10"
                              title="Delete task"
                            >
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </>
      ) : viewTab === 'completed' ? (
        /* Completed Tasks View */
        <div className="space-y-3">
          {completedTasks.length > 0 && (
            <div className="flex items-center justify-end">
              <button
                onClick={() => handleBulkArchiveCompleted(completedTasks.map(t => t.id))}
                disabled={isPending}
                className="text-xs text-text-tertiary hover:text-amber-400 transition-colors font-medium disabled:opacity-40"
              >
                Archive all completed →
              </button>
            </div>
          )}
          {completedTasks.length === 0 ? (
            <div className="empty-state py-10">
              <div className="empty-state-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <p className="text-sm text-text-tertiary">No completed tasks yet.</p>
            </div>
          ) : (
            completedTasks.map((task) => (
              <div
                key={task.id}
                className="bg-surface-secondary/50 border border-border rounded-xl p-3 flex items-start gap-3 group"
              >
                <div className="mt-0.5 w-5 h-5 rounded-lg bg-surface-tertiary flex items-center justify-center flex-shrink-0">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-secondary line-through">{task.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {task.completed_at && (
                      <span className="text-xs text-text-tertiary">
                        {new Date(task.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    {task.weight && (
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium', WEIGHT_COLORS[task.weight])}>
                        {task.weight}
                      </span>
                    )}
                    {task.project && (
                      <span className="text-xs text-text-tertiary">{task.project}</span>
                    )}
                    {task.client_id && clientMap[task.client_id] && (
                      <span className="text-xs text-text-tertiary">{clientMap[task.client_id].name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleReactivate(task.id)}
                    className="text-xs text-text-tertiary hover:text-text-primary transition-all px-2 py-1"
                  >
                    Reactivate
                  </button>
                  <button
                    onClick={() => handleArchive(task.id)}
                    className="text-xs text-text-tertiary hover:text-amber-400 transition-all px-2 py-1"
                    title="Move to archive"
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Archived Tasks View */
        <div className="space-y-3">
          {archivedTasks.length > 0 && (
            <div className="flex items-center justify-between">
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
                  Permanently delete {selectedArchived.size} task{selectedArchived.size !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}
          {archivedTasks.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm text-text-tertiary">Archive is empty.</p>
              <p className="text-xs text-text-tertiary/60">Move tasks here to remove them from scores without deleting data.</p>
            </div>
          ) : (
            archivedTasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  'border rounded-xl p-3 flex items-start gap-3 group transition-colors',
                  selectedArchived.has(task.id)
                    ? 'bg-danger/5 border-danger/20'
                    : 'bg-surface-secondary/30 border-border'
                )}
              >
                <button
                  onClick={() => toggleArchivedSelection(task.id)}
                  className={cn(
                    'mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors',
                    selectedArchived.has(task.id)
                      ? 'bg-danger/20 border-danger/40'
                      : 'border-border hover:border-text-tertiary'
                  )}
                >
                  {selectedArchived.has(task.id) && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-tertiary">{task.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {task.updated_at && (
                      <span className="text-xs text-text-tertiary/60">
                        Archived {new Date(task.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {task.weight && (
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium opacity-50', WEIGHT_COLORS[task.weight])}>
                        {task.weight}
                      </span>
                    )}
                    {task.category && (
                      <span className="text-xs text-text-tertiary/50">
                        {TASK_CATEGORIES.find(c => c.value === task.category)?.label || task.category}
                      </span>
                    )}
                    {task.client_id && clientMap[task.client_id] && (
                      <span className="text-xs text-text-tertiary/50">{clientMap[task.client_id].name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleReactivate(task.id)}
                    className="text-xs text-text-tertiary hover:text-text-primary transition-all px-2 py-1"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(task.id)}
                    disabled={isPending}
                    className="text-xs text-text-tertiary hover:text-danger transition-all px-2 py-1 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

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
  const [localClients, setLocalClients] = useState(clients);

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
                className="flex-1 text-sm bg-surface-tertiary border border-border rounded-xl px-2.5 py-1.5 text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-light transition-colors"
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
