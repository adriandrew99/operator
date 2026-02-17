'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { DAY_THEME_PRESETS } from '@/lib/constants';

interface DayThemePickerProps {
  currentTheme: string | null;
  onSelect: (theme: string) => void;
  onClear: () => void;
}

const THEME_COLORS: Record<string, string> = {
  'deep work': 'bg-purple-500/15 text-purple-400',
  'client day': 'bg-blue-500/15 text-blue-400',
  'admin & catch-up': 'bg-surface-tertiary text-text-secondary',
  'strategy & planning': 'bg-accent/15 text-accent',
  'content day': 'bg-amber-500/15 text-amber-400',
  'light day': 'bg-accent/10 text-accent',
  'off / recovery': 'bg-surface-tertiary text-text-tertiary',
};

function getThemeStyle(theme: string): string {
  return THEME_COLORS[theme.toLowerCase()] || 'bg-surface-tertiary text-text-secondary';
}

export function DayThemePicker({ currentTheme, onSelect, onClear }: DayThemePickerProps) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(theme: string) {
    onSelect(theme);
    setOpen(false);
  }

  function handleCustomSubmit() {
    if (customValue.trim()) {
      onSelect(customValue.trim());
      setCustomValue('');
      setOpen(false);
    }
  }

  if (currentTheme) {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'text-[9px] px-2 py-0.5 rounded-full font-medium transition-all cursor-pointer',
            getThemeStyle(currentTheme)
          )}
        >
          {currentTheme}
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 p-2 rounded-xl bg-surface-secondary border border-border shadow-lg shadow-black/30 animate-fade-in space-y-1 min-w-[160px]" style={{ zIndex: 40 }}>
            {DAY_THEME_PRESETS.map(theme => (
              <button
                key={theme}
                onClick={() => handleSelect(theme)}
                className={cn(
                  'block w-full text-left text-[10px] px-2 py-1 rounded-lg transition-colors cursor-pointer',
                  currentTheme === theme ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-surface-tertiary'
                )}
              >
                {theme}
              </button>
            ))}
            <div className="border-t border-border/40 pt-1 mt-1">
              <button
                onClick={() => { onClear(); setOpen(false); }}
                className="block w-full text-left text-[10px] px-2 py-1 rounded-lg text-text-tertiary hover:text-danger transition-colors cursor-pointer"
              >
                Clear theme
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-[9px] text-text-tertiary/50 hover:text-text-tertiary transition-colors cursor-pointer"
        title="Set day theme"
      >
        + theme
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 p-2 rounded-xl bg-surface-secondary border border-border shadow-lg shadow-black/30 animate-fade-in space-y-1 min-w-[160px]" style={{ zIndex: 40 }}>
          {DAY_THEME_PRESETS.map(theme => (
            <button
              key={theme}
              onClick={() => handleSelect(theme)}
              className="block w-full text-left text-[10px] px-2 py-1 rounded-lg text-text-secondary hover:bg-surface-tertiary transition-colors cursor-pointer"
            >
              {theme}
            </button>
          ))}
          <div className="border-t border-border/40 pt-1 mt-1">
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                placeholder="Custom..."
                className="flex-1 text-[10px] bg-transparent text-text-secondary outline-none px-2 py-1"
                autoFocus
              />
              {customValue.trim() && (
                <button
                  onClick={handleCustomSubmit}
                  className="text-[10px] text-accent cursor-pointer"
                >
                  Add
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
