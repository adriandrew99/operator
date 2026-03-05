'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

// ━━━ Icon SVGs (no emoji as UI icons) ━━━
const iconClass = 'w-5 h-5 text-text-tertiary shrink-0';
const CommandIcons = {
  home: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  score: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>,
  tasks: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4" /></svg>,
  planner: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  finance: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="6" x2="12" y2="18" /><line x1="16" y1="10" x2="8" y2="14" /><line x1="16" y1="14" x2="8" y2="10" /></svg>,
  pipeline: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.586a1 1 0 0 1-.293.707l-6.414 6.414a1 1 0 0 0-.293.707V17l-4 4v-6.586a1 1 0 0 0-.293-.707L3.293 7.293A1 1 0 0 1 3 6.586V4z" /></svg>,
  outbound: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>,
  knowledge: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="16" y2="10" /></svg>,
  analytics: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
  settings: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  add: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  target: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  theme: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>,
} as const;

// ━━━ Command types ━━━
interface Command {
  id: string;
  label: string;
  category: 'navigation' | 'action' | 'quick';
  icon?: keyof typeof CommandIcons;
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
    { id: 'nav-today', label: 'Go to Today', category: 'navigation', icon: 'home', action: () => router.push('/today') },
    { id: 'nav-score', label: 'Go to Score', category: 'navigation', icon: 'score', action: () => router.push('/score') },
    { id: 'nav-tasks', label: 'Go to Tasks', category: 'navigation', icon: 'tasks', action: () => router.push('/tasks') },
    { id: 'nav-planner', label: 'Go to Planner', category: 'navigation', icon: 'planner', action: () => router.push('/planner') },
    { id: 'nav-finance', label: 'Go to Finance', category: 'navigation', icon: 'finance', action: () => router.push('/finance') },
    { id: 'nav-pipeline', label: 'Go to Pipeline', category: 'navigation', icon: 'pipeline', action: () => router.push('/pipeline') },
    { id: 'nav-outbound', label: 'Go to Outbound', category: 'navigation', icon: 'outbound', action: () => router.push('/outbound') },
    { id: 'nav-knowledge', label: 'Go to Knowledge', category: 'navigation', icon: 'knowledge', action: () => router.push('/knowledge') },
    { id: 'nav-analytics', label: 'Go to Analytics', category: 'navigation', icon: 'analytics', action: () => router.push('/analytics') },
    { id: 'nav-settings', label: 'Go to Settings', category: 'navigation', icon: 'settings', action: () => router.push('/settings') },

    // Quick actions
    { id: 'action-add-task', label: 'Add new task', category: 'action', icon: 'add', action: () => { router.push('/today'); setTimeout(() => document.querySelector<HTMLButtonElement>('[data-add-task]')?.click(), 300); } },
    { id: 'action-add-lead', label: 'Add new lead', category: 'action', icon: 'target', action: () => router.push('/pipeline') },

    // Scroll shortcuts
    { id: 'action-fundamentals', label: 'Jump to Fundamentals', category: 'quick', icon: 'target', action: () => { router.push('/today'); setTimeout(() => document.getElementById('fundamentals-section')?.scrollIntoView({ behavior: 'smooth' }), 300); } },
    { id: 'action-theme', label: 'Toggle dark/light mode', category: 'quick', icon: 'theme', action: () => { document.querySelector<HTMLButtonElement>('[data-theme-toggle]')?.click(); } },
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

  // Open from TopBar or other triggers
  useEffect(() => {
    function onOpen() {
      setOpen(true);
      setQuery('');
      setSelectedIndex(0);
    }
    window.addEventListener('open-command-palette', onOpen);
    return () => window.removeEventListener('open-command-palette', onOpen);
  }, []);

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
                        <span className="flex items-center justify-center w-5">{cmd.icon ? CommandIcons[cmd.icon] : null}</span>
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
