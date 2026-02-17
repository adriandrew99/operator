'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import type { Task, Client } from '@/lib/types/database';

interface TaskEditorProps {
  task: Task;
  clients: Client[];
  onSave: (updates: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete?: () => void;
}

const WEIGHT_BADGE: Record<string, string> = {
  high: 'bg-red-500/15 text-red-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low: 'bg-accent/15 text-accent',
};

const ENERGY_BADGE: Record<string, string> = {
  admin: 'bg-surface-tertiary text-text-secondary',
  creative: 'bg-purple-500/15 text-purple-400',
};

export function TaskEditor({ task, clients, onSave, onClose, onDelete }: TaskEditorProps) {
  const [title, setTitle] = useState(task.title);
  const [weight, setWeight] = useState(task.weight || 'medium');
  const [energy, setEnergy] = useState(task.energy || 'admin');
  const [estimatedMinutes, setEstimatedMinutes] = useState(String(task.estimated_minutes || ''));
  const [clientId, setClientId] = useState(task.client_id || '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  function handleSave() {
    const updates: Record<string, unknown> = {};
    if (title !== task.title) updates.title = title;
    if (weight !== task.weight) updates.weight = weight;
    if (energy !== task.energy) updates.energy = energy;
    if (clientId !== (task.client_id || '')) updates.client_id = clientId || null;
    const mins = estimatedMinutes ? Number(estimatedMinutes) : null;
    if (mins !== task.estimated_minutes) updates.estimated_minutes = mins;
    if (Object.keys(updates).length > 0) {
      onSave(updates);
    } else {
      onClose();
    }
  }

  return (
    <div
      ref={ref}
      className="p-3 rounded-xl bg-surface-secondary border border-border shadow-lg shadow-black/30 animate-fade-in space-y-3 w-[280px]"
      style={{ zIndex: 50 }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        className="w-full text-sm bg-transparent text-text-primary outline-none border-b border-border/40 pb-2"
        autoFocus
      />
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-text-tertiary mr-1">Weight:</span>
          {(['low', 'medium', 'high'] as const).map(w => (
            <button
              key={w}
              onClick={() => setWeight(w)}
              className={cn(
                'text-[9px] px-1.5 py-0.5 rounded-md font-medium uppercase transition-all cursor-pointer',
                weight === w ? WEIGHT_BADGE[w] : 'text-text-tertiary/50 hover:text-text-tertiary'
              )}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-text-tertiary mr-1">Energy:</span>
          {(['creative', 'admin'] as const).map(e => (
            <button
              key={e}
              onClick={() => setEnergy(e)}
              className={cn(
                'text-[9px] px-1.5 py-0.5 rounded-md font-medium transition-all cursor-pointer',
                energy === e ? ENERGY_BADGE[e] : 'text-text-tertiary/50 hover:text-text-tertiary'
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        {clients.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-text-tertiary">Client:</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="text-[10px] bg-surface-tertiary/60 border border-border/40 rounded-xl px-2 py-1 text-text-secondary outline-none focus:border-accent/40 transition-colors"
            >
              <option value="">None</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-text-tertiary">Time:</span>
          <input
            type="number"
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value)}
            placeholder="mins"
            min="0"
            className="w-16 text-[10px] bg-surface-tertiary/60 border border-border/40 rounded-xl px-2 py-1 text-text-secondary outline-none focus:border-accent/40 transition-colors"
          />
          <span className="text-[9px] text-text-tertiary">min</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        {onDelete ? (
          <button onClick={onDelete} className="text-[10px] text-text-tertiary hover:text-danger transition-colors px-2 py-1 cursor-pointer">Delete</button>
        ) : <div />}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors px-2 py-1 cursor-pointer">Cancel</button>
          <button onClick={handleSave} className="text-[10px] text-accent font-medium hover:text-accent/80 transition-colors px-2 py-1 cursor-pointer">Save</button>
        </div>
      </div>
    </div>
  );
}
