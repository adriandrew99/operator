'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TASK_CATEGORIES, ENERGY_TYPES, TASK_WEIGHTS, DAY_NAMES } from '@/lib/constants';
import { toggleRecurringTaskCompletion, createRecurringTask, updateRecurringTask, deleteRecurringTask, skipRecurringTask } from '@/actions/recurring';
import { getTaskMLU } from '@/lib/utils/mental-load';
import type { RecurringTaskWithStatus } from '@/lib/types/recurring';
import type { Client } from '@/lib/types/database';

interface DailyTasksProps {
  tasks: RecurringTaskWithStatus[];
  allTasks?: RecurringTaskWithStatus[];
  clients: Client[];
  streaks?: Record<string, number>;
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays Only' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom Days' },
];

const WEIGHT_COLORS: Record<string, string> = {
  low: 'bg-accent/15 text-accent',
  medium: 'bg-amber-500/10 text-amber-400/70',
  high: 'bg-red-500/15 text-red-400',
};

const ENERGY_COLORS: Record<string, string> = {
  deep: 'bg-blue-500/15 text-blue-400',
  admin: 'bg-surface-tertiary text-text-secondary',
  creative: 'bg-purple-500/15 text-purple-400',
};

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export function DailyTasks({ tasks, allTasks, clients, streaks = {} }: DailyTasksProps) {
  const [todayItems, setTodayItems] = useState(tasks);
  const [allItems, setAllItems] = useState(allTasks || tasks);
  const [activeTab, setActiveTab] = useState<'today' | 'all'>('today');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<RecurringTaskWithStatus | null>(null);
  const [selectedFrequency, setSelectedFrequency] = useState('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync local state when server-rendered props change (after revalidation)
  useEffect(() => { setTodayItems(tasks); }, [tasks]);
  useEffect(() => { setAllItems(allTasks || tasks); }, [allTasks, tasks]);

  const items = activeTab === 'today' ? todayItems : allItems;
  const completedCount = todayItems.filter((t) => t.completedToday).length;
  const clientMap = new Map(clients.map(c => [c.id, c.name]));
  const hasAllTasks = allTasks && allTasks.length !== tasks.length;

  function handleToggle(task: RecurringTaskWithStatus) {
    const newCompleted = !task.completedToday;
    const updater = (prev: RecurringTaskWithStatus[]) =>
      prev.map((t) => t.id === task.id ? { ...t, completedToday: newCompleted } : t);
    setTodayItems(updater);
    setAllItems(updater);
    // Fire-and-forget: don't block transitions (prevents nav freeze)
    toggleRecurringTaskCompletion(task.id, newCompleted).catch(e => {
      console.error('Failed to toggle:', e);
      const revert = (prev: RecurringTaskWithStatus[]) =>
        prev.map((t) => t.id === task.id ? { ...t, completedToday: !newCompleted } : t);
      setTodayItems(revert);
      setAllItems(revert);
    });
  }

  function handleSkip(task: RecurringTaskWithStatus) {
    const updater = (prev: RecurringTaskWithStatus[]) =>
      prev.map((t) => t.id === task.id ? { ...t, completedToday: true } : t);
    setTodayItems(updater);
    setAllItems(updater);
    skipRecurringTask(task.id).catch(e => {
      console.error('Failed to skip:', e);
      const revert = (prev: RecurringTaskWithStatus[]) =>
        prev.map((t) => t.id === task.id ? { ...t, completedToday: false } : t);
      setTodayItems(revert);
      setAllItems(revert);
    });
  }

  function handleDayToggle(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function closeForm() {
    setShowForm(false);
    setEditingTask(null);
    setSelectedFrequency('daily');
    setSelectedDays([]);
    setFormError(null);
  }

  function openEdit(task: RecurringTaskWithStatus) {
    setEditingTask(task);
    setSelectedFrequency(task.frequency || 'daily');
    setSelectedDays(task.days_of_week || []);
    setShowForm(true);
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const frequency = form.get('frequency') as string;

    const taskData: Record<string, unknown> = {
      title: form.get('title') as string,
      description: (form.get('description') as string) || undefined,
      category: form.get('category') as string,
      frequency,
    };

    const scheduledTime = form.get('scheduled_time') as string;
    if (scheduledTime) taskData.scheduled_time = scheduledTime;

    const clientId = form.get('client_id') as string;
    if (clientId) taskData.client_id = clientId;

    const weight = form.get('weight') as string;
    if (weight) taskData.weight = weight;
    const energy = form.get('energy') as string;
    if (energy) taskData.energy = energy;

    const estimatedMinutes = form.get('estimated_minutes') as string;
    if (estimatedMinutes) taskData.estimated_minutes = Number(estimatedMinutes);

    // Capture selectedDays at time of submission (not stale closure)
    const daysSnapshot = [...selectedDays];
    if (frequency === 'custom' && daysSnapshot.length > 0) {
      taskData.days_of_week = daysSnapshot;
    }

    if (frequency === 'weekly') {
      const dayOfWeek = form.get('day_of_week') as string;
      if (dayOfWeek) taskData.day_of_week = Number(dayOfWeek);
    }

    taskData.is_active = true;

    setFormError(null);
    setLoading(true);
    closeForm();
    // Fire-and-forget to avoid blocking navigation
    createRecurringTask(taskData as Parameters<typeof createRecurringTask>[0])
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Failed to create task';
        console.error('Failed to create recurring task:', e);
        setFormError(msg.includes('category') ? 'Category not supported. Please run migration 00012 or choose a different category.' : msg);
      })
      .finally(() => setLoading(false));
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingTask) return;
    const form = new FormData(e.currentTarget);
    const frequency = form.get('frequency') as string;

    const updates: Record<string, unknown> = {
      title: form.get('title') as string,
      description: (form.get('description') as string) || null,
      category: form.get('category') as string,
      frequency,
      weight: form.get('weight') as string || 'medium',
      energy: form.get('energy') as string || 'admin',
    };

    const scheduledTime = form.get('scheduled_time') as string;
    updates.scheduled_time = scheduledTime || null;

    const clientId = form.get('client_id') as string;
    updates.client_id = clientId || null;

    const estimatedMinutes = form.get('estimated_minutes') as string;
    updates.estimated_minutes = estimatedMinutes ? Number(estimatedMinutes) : null;

    // Capture selectedDays at time of submission
    const daysSnapshot = [...selectedDays];
    if (frequency === 'custom') {
      updates.days_of_week = daysSnapshot.length > 0 ? daysSnapshot : null;
      updates.day_of_week = null;
    } else if (frequency === 'weekly') {
      const dayOfWeek = form.get('day_of_week') as string;
      updates.day_of_week = dayOfWeek ? Number(dayOfWeek) : null;
      updates.days_of_week = null;
    } else {
      updates.day_of_week = null;
      updates.days_of_week = null;
    }

    const taskId = editingTask.id;
    setFormError(null);
    setLoading(true);
    closeForm();
    // Fire-and-forget to avoid blocking navigation
    updateRecurringTask(taskId, updates)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Failed to update task';
        console.error('Failed to update recurring task:', e);
        setFormError(msg.includes('category') ? 'Category not supported. Please run migration 00012 or choose a different category.' : msg);
      })
      .finally(() => setLoading(false));
  }

  function handleDelete(id: string) {
    setTodayItems((prev) => prev.filter((t) => t.id !== id));
    setAllItems((prev) => prev.filter((t) => t.id !== id));
    // Fire-and-forget: don't block transitions
    deleteRecurringTask(id).catch(e => console.error('Failed to delete recurring task:', e));
  }

  function renderFormModal() {
    const isEditing = !!editingTask;
    const task = editingTask;

    return (
      <Modal open={showForm} onClose={closeForm} title={isEditing ? 'Edit Recurring Task' : 'Add Recurring Task'}>
        <form onSubmit={isEditing ? handleUpdate : handleCreate} className="space-y-4">
          <Input name="title" label="Task" required placeholder="e.g., Check comments on accounts" defaultValue={task?.title || ''} />
          <Input name="description" label="Notes (optional)" placeholder="Any extra detail..." defaultValue={task?.description || ''} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Select
              name="category"
              label="Category"
              options={TASK_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
              defaultValue={task?.category || 'admin'}
            />
            <Select
              name="frequency"
              label="Frequency"
              options={FREQUENCY_OPTIONS}
              defaultValue={task?.frequency || 'daily'}
              onChange={(e) => setSelectedFrequency(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Select
              name="weight"
              label="Mental Weight"
              options={TASK_WEIGHTS.map(w => ({ value: w.value, label: w.label }))}
              defaultValue={task?.weight || 'medium'}
            />
            <Select
              name="energy"
              label="Energy Type"
              options={ENERGY_TYPES.map(e => ({ value: e.value, label: e.label }))}
              defaultValue={task?.energy || 'admin'}
            />
          </div>

          {/* Client */}
          {clients.length > 0 && (
            <Select
              name="client_id"
              label="Client (optional)"
              options={[{ value: '', label: 'None' }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
              defaultValue={task?.client_id || ''}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Scheduled Time */}
            <Input name="scheduled_time" label="Scheduled Time (optional)" type="time" defaultValue={task?.scheduled_time || ''} />
            <Input name="estimated_minutes" label="Focus Time (min)" type="number" placeholder="e.g., 15" defaultValue={task?.estimated_minutes ? String(task.estimated_minutes) : ''} />
          </div>

          {/* Weekly: pick day */}
          {selectedFrequency === 'weekly' && (
            <Select
              name="day_of_week"
              label="Day of Week"
              options={DAY_NAMES.map((d, i) => ({ value: String(i), label: d }))}
              defaultValue={task?.day_of_week != null ? String(task.day_of_week) : '0'}
            />
          )}

          {/* Custom: pick multiple days */}
          {selectedFrequency === 'custom' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">Select Days</label>
              <div className="flex gap-1 flex-wrap">
                {DAY_NAMES.map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleDayToggle(i)}
                    className={cn(
                      'w-9 h-9 sm:w-10 sm:h-8 text-[10px] font-medium border transition-colors rounded-md',
                      selectedDays.includes(i)
                        ? 'bg-accent text-black border-accent'
                        : 'bg-surface-secondary text-text-secondary border-border hover:border-text-tertiary'
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {formError && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-[11px] text-red-400">{formError}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Task')}
            </Button>
          </div>
        </form>
      </Modal>
    );
  }

  if (todayItems.length === 0 && allItems.length === 0 && !showForm) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
            Recurring Tasks
          </p>
          <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
            Add
          </Button>
        </div>
        <p className="text-xs text-text-tertiary py-3">
          Add recurring daily reminders like checking comments, scheduling posts, etc.
        </p>
        {renderFormModal()}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasAllTasks ? (
            <>
              <button
                onClick={() => setActiveTab('today')}
                className={cn(
                  'text-[10px] font-medium uppercase tracking-widest transition-colors cursor-pointer',
                  activeTab === 'today' ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                Today
              </button>
              <span className="text-text-tertiary/30 text-[10px]">|</span>
              <button
                onClick={() => setActiveTab('all')}
                className={cn(
                  'text-[10px] font-medium uppercase tracking-widest transition-colors cursor-pointer',
                  activeTab === 'all' ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
                )}
              >
                All
              </button>
            </>
          ) : (
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
              Recurring Tasks
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-text-tertiary">{completedCount}/{todayItems.length}</span>
          <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
            Add
          </Button>
        </div>
      </div>

      <div className="space-y-0.5">
        {items.map((task) => {
          const isDueToday = todayItems.some(t => t.id === task.id);
          return (
          <div
            key={task.id}
            className="flex items-center gap-3 py-2 px-3 hover:bg-surface-secondary transition-colors group"
          >
            {isDueToday ? (
              <button
                onClick={() => handleToggle(task)}
                className={cn(
                  'w-4 h-4 border flex-shrink-0 flex items-center justify-center transition-all cursor-pointer',
                  task.completedToday
                    ? 'bg-accent border-accent'
                    : 'border-border-light hover:border-text-secondary'
                )}
              >
                {task.completedToday && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="black" strokeWidth="2" strokeLinecap="square" />
                  </svg>
                )}
              </button>
            ) : (
              <div className="w-4 h-4 border border-border/30 flex-shrink-0" title="Not due today" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  'text-sm transition-colors',
                  task.completedToday ? 'text-text-tertiary line-through' : 'text-text-secondary'
                )}>
                  {task.title}
                </span>
                {(streaks[task.id] ?? 0) >= 2 && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded-md" title={`${streaks[task.id]}-day streak`}>
                    🔥 {streaks[task.id]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                {task.energy && (
                  <span className={cn('text-[9px] px-1.5 py-0.5 rounded-md font-medium', ENERGY_COLORS[task.energy] || '')}>
                    {task.energy}
                  </span>
                )}
                {task.weight && (
                  <span className={cn('text-[9px] px-1.5 py-0.5 rounded-md font-medium', WEIGHT_COLORS[task.weight] || 'bg-amber-500/15 text-amber-400')}>
                    {task.weight}
                  </span>
                )}
                {(task.weight || task.energy) && (
                  <span className="text-[9px] text-text-tertiary/60">
                    {getTaskMLU({ weight: task.weight as 'low' | 'medium' | 'high', energy: task.energy as 'admin' | 'creative' })} MLU
                  </span>
                )}
                {task.client_id && clientMap.has(task.client_id) && (
                  <span className="text-[10px] text-accent/70">
                    {clientMap.get(task.client_id)}
                  </span>
                )}
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              {task.scheduled_time && (
                <span className="text-[10px] text-accent/70 font-medium">
                  {formatTime12h(task.scheduled_time)}
                </span>
              )}
              {task.frequency === 'custom' && task.days_of_week && (
                <span className="text-[10px] text-text-tertiary">
                  {task.days_of_week.map(d => DAY_NAMES[d]).join(', ')}
                </span>
              )}
              {task.frequency !== 'custom' && (
                <span className="text-[10px] text-text-tertiary">{task.frequency}</span>
              )}
            </div>
            <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              {isDueToday && !task.completedToday && (
                <button
                  onClick={() => handleSkip(task)}
                  className="text-text-tertiary hover:text-amber-400 transition-all p-1 rounded-lg hover:bg-amber-500/10"
                  title="Skip for today"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 4 15 12 5 20 5 4" />
                    <line x1="19" y1="5" x2="19" y2="19" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => openEdit(task)}
                className="text-text-tertiary hover:text-accent transition-all p-1 rounded-lg hover:bg-accent/10"
                title="Edit task"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(task.id)}
                className="text-text-tertiary hover:text-danger transition-all p-1 rounded-lg hover:bg-danger/10"
                title="Delete task"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                </svg>
              </button>
            </div>
          </div>
          );
        })}
      </div>

      {renderFormModal()}
    </div>
  );
}
