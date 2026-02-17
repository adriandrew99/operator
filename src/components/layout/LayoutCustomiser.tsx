'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { saveDashboardLayout } from '@/actions/settings';
import type { DashboardLayoutPreferences } from '@/lib/types/dashboard-layout';
import { TODAY_SECTION_LABELS, ANALYTICS_SECTION_LABELS } from '@/lib/types/dashboard-layout';

type PageKey = 'today' | 'analytics';

interface LayoutCustomiserProps {
  page: PageKey;
  layout: DashboardLayoutPreferences;
  onLayoutChange: (layout: DashboardLayoutPreferences) => void;
}

export function LayoutCustomiser({ page, layout, onLayoutChange }: LayoutCustomiserProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const labels = page === 'today' ? TODAY_SECTION_LABELS : ANALYTICS_SECTION_LABELS;
  const keys = Object.keys(labels) as Array<string>;
  const section = layout[page] as Record<string, boolean>;

  const onCount = keys.filter(k => section[k] ?? true).length;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleToggle(key: string) {
    const updated = {
      ...layout,
      [page]: { ...layout[page], [key]: !(section[key] ?? true) },
    };
    onLayoutChange(updated);
    setSaved(false);
  }

  function handleSave() {
    setSaving(true);
    saveDashboardLayout(layout)
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .catch(e => console.error('Failed to save layout:', e))
      .finally(() => setSaving(false));
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 text-[10px] font-medium transition-all cursor-pointer rounded-lg px-2.5 py-1.5 active:scale-95',
          open
            ? 'text-accent bg-accent/10'
            : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary/50'
        )}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Customise
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 card-surface border border-border rounded-xl shadow-lg shadow-black/30 animate-fade-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <div>
              <p className="text-xs font-medium text-text-primary">
                {page === 'today' ? 'Today' : 'Analytics'} Sections
              </p>
              <p className="text-[9px] text-text-tertiary mt-0.5">{onCount}/{keys.length} visible</p>
            </div>
            <div className="flex items-center gap-1.5">
              {saved && <span className="text-[9px] text-accent animate-fade-in">Saved</span>}
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-[10px] font-medium text-accent bg-accent/10 hover:bg-accent/15 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? '...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Toggle list */}
          <div className="max-h-72 overflow-y-auto py-1">
            {keys.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => handleToggle(key)}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-surface-tertiary/30 transition-colors cursor-pointer"
              >
                <span className={cn(
                  'text-[11px] transition-colors',
                  (section[key] ?? true) ? 'text-text-primary' : 'text-text-tertiary'
                )}>
                  {(labels as Record<string, string>)[key]}
                </span>
                <div className={cn(
                  'relative w-8 h-[18px] rounded-full transition-colors duration-200 flex-shrink-0',
                  (section[key] ?? true) ? 'bg-accent' : 'bg-surface-tertiary border border-border'
                )}>
                  <span className={cn(
                    'absolute top-[3px] left-[3px] w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200',
                    (section[key] ?? true) && 'translate-x-[14px]'
                  )} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
