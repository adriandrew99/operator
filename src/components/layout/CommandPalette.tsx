'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

// ━━━ Command types ━━━
interface Command {
  id: string;
  label: string;
  category: 'navigation' | 'action' | 'quick';
  icon?: string;
  shortcut?: string;
  action: () => void;
}

/**
 * Cmd+K command palette.
 * Provides keyboard-first navigation and quick actions.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setOpen(false);
    setQuery('');
  }, [pathname]);

  // ━━━ Command definitions ━━━
  const commands: Command[] = useMemo(() => [
    // Navigation
    { id: 'nav-today', label: 'Go to Today', category: 'navigation', icon: '🏠', shortcut: undefined, action: () => router.push('/today') },
    { id: 'nav-score', label: 'Go to Score', category: 'navigation', icon: '⚡', action: () => router.push('/score') },
    { id: 'nav-tasks', label: 'Go to Tasks', category: 'navigation', icon: '📋', action: () => router.push('/tasks') },
    { id: 'nav-planner', label: 'Go to Planner', category: 'navigation', icon: '📅', action: () => router.push('/planner') },
    { id: 'nav-finance', label: 'Go to Finance', category: 'navigation', icon: '💰', action: () => router.push('/finance') },
    { id: 'nav-pipeline', label: 'Go to Pipeline', category: 'navigation', icon: '🔄', action: () => router.push('/pipeline') },
    { id: 'nav-outbound', label: 'Go to Outbound', category: 'navigation', icon: '✈️', action: () => router.push('/outbound') },
    { id: 'nav-knowledge', label: 'Go to Knowledge', category: 'navigation', icon: '📖', action: () => router.push('/knowledge') },
    { id: 'nav-analytics', label: 'Go to Analytics', category: 'navigation', icon: '📊', action: () => router.push('/analytics') },
    { id: 'nav-settings', label: 'Go to Settings', category: 'navigation', icon: '⚙️', action: () => router.push('/settings') },

    // Quick actions
    { id: 'action-add-task', label: 'Add new task', category: 'action', icon: '➕', action: () => { router.push('/today'); setTimeout(() => document.querySelector<HTMLButtonElement>('[data-add-task]')?.click(), 300); } },
    { id: 'action-add-lead', label: 'Add new lead', category: 'action', icon: '🎯', action: () => router.push('/pipeline') },

    // Scroll shortcuts
    { id: 'action-fundamentals', label: 'Jump to Fundamentals', category: 'quick', icon: '🎯', action: () => { router.push('/today'); setTimeout(() => document.getElementById('fundamentals-section')?.scrollIntoView({ behavior: 'smooth' }), 300); } },
    { id: 'action-theme', label: 'Toggle dark/light mode', category: 'quick', icon: '🌓', action: () => { document.querySelector<HTMLButtonElement>('[data-theme-toggle]')?.click(); } },
  ], [router]);

  // ━━━ Filtered results ━━━
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.category.includes(q)
    );
  }, [commands, query]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  // ━━━ Keyboard handler ━━━
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Open: Cmd+K or Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen(prev => !prev);
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    // Escape to close
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
      return;
    }
  }, [open]);

  const handleInternalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      setOpen(false);
    }
  }, [filtered, selectedIndex]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[selectedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!open) return null;

  // Group by category
  const grouped = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  const CATEGORY_LABELS: Record<string, string> = {
    navigation: 'Navigation',
    action: 'Actions',
    quick: 'Quick Actions',
  };

  let flatIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 animate-fade-in"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
        <div
          className="w-full max-w-lg bg-surface-secondary border border-border rounded-lg overflow-hidden animate-scale-in"
          onKeyDown={handleInternalKeyDown}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-tertiary shrink-0">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-lg text-xs text-text-tertiary bg-surface-tertiary border border-border font-mono">
              esc
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="empty-state py-8">
                <div className="empty-state-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
                <p className="text-xs text-text-tertiary">No results found</p>
              </div>
            ) : (
              Object.entries(grouped).map(([category, cmds]) => (
                <div key={category}>
                  <p className="section-label px-5 py-1.5 mt-1">
                    {CATEGORY_LABELS[category] || category}
                  </p>
                  {cmds.map(cmd => {
                    const idx = flatIndex++;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => { cmd.action(); setOpen(false); }}
                        className={cn(
                          'w-full flex items-center gap-3 px-5 py-2.5 text-left transition-all duration-150 cursor-pointer rounded-lg mx-1',
                          idx === selectedIndex
                            ? 'bg-surface-tertiary text-text-primary'
                            : 'text-text-secondary hover:bg-surface-tertiary'
                        )}
                        style={{ width: 'calc(100% - 0.5rem)' }}
                      >
                        <span className="text-sm w-5 text-center">{cmd.icon}</span>
                        <span className="text-sm flex-1">{cmd.label}</span>
                        {cmd.shortcut && (
                          <kbd className="text-xs text-text-tertiary font-mono">{cmd.shortcut}</kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-border text-xs text-text-tertiary">
            <div className="flex items-center gap-3">
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span>esc close</span>
            </div>
            <span className="font-mono">⌘K</span>
          </div>
        </div>
      </div>
    </>
  );
}
