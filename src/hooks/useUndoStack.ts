'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { updateTask, completeTask, reactivateTask } from '@/actions/tasks';
import { toggleRecurringTaskCompletion } from '@/actions/recurring';

export type UndoEntry =
  | { type: 'move'; taskId: string; previous: { deadline: string | null; scheduled_date?: string | null; flagged_for_today: boolean } }
  | { type: 'complete'; taskId: string; isRecurring: boolean; recurringId?: string }
  | { type: 'uncomplete'; taskId: string; isRecurring: boolean; recurringId?: string };

const MAX_UNDO = 20;

export function useUndoStack(onUndo?: (entry: UndoEntry) => void) {
  const [stack, setStack] = useState<UndoEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUndoRef = useRef(onUndo);
  onUndoRef.current = onUndo;

  const pushUndo = useCallback((entry: UndoEntry) => {
    setStack(prev => [...prev.slice(-(MAX_UNDO - 1)), entry]);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const undo = useCallback(() => {
    // Read current stack and pop last entry
    setStack(prev => {
      if (prev.length === 0) return prev;
      const entry = prev[prev.length - 1];
      const newStack = prev.slice(0, -1);

      // Execute the undo action OUTSIDE the state updater via microtask
      queueMicrotask(() => {
        // Notify parent so it can update optimistic UI state
        onUndoRef.current?.(entry);

        switch (entry.type) {
          case 'move':
            updateTask(entry.taskId, {
              deadline: entry.previous.deadline,
              scheduled_date: entry.previous.scheduled_date ?? entry.previous.deadline,
              flagged_for_today: entry.previous.flagged_for_today,
            }).catch(e => console.error('Undo move failed:', e));
            showToast('Move undone');
            break;

          case 'complete':
            if (entry.isRecurring && entry.recurringId) {
              toggleRecurringTaskCompletion(entry.recurringId, false).catch(e => console.error('Undo complete failed:', e));
            } else {
              reactivateTask(entry.taskId).catch(e => console.error('Undo complete failed:', e));
            }
            showToast('Completion undone');
            break;

          case 'uncomplete':
            if (entry.isRecurring && entry.recurringId) {
              toggleRecurringTaskCompletion(entry.recurringId, true).catch(e => console.error('Undo uncomplete failed:', e));
            } else {
              completeTask(entry.taskId).catch(e => console.error('Undo uncomplete failed:', e));
            }
            showToast('Reactivation undone');
            break;
        }
      });

      return newStack;
    });
  }, [showToast]);

  // Global Cmd+Z listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        // Don't intercept if user is typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  return { pushUndo, undo, canUndo: stack.length > 0, toast };
}
