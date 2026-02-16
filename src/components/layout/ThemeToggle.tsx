'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

export function ThemeToggle({ size = 'default' }: { size?: 'default' | 'compact' }) {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={cn(size === 'compact' ? 'w-8 h-8' : 'w-10 h-10')} />;
  }

  // Cycle: system (auto) → light → dark → system
  function cycleTheme() {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  }

  const isAuto = theme === 'system';
  const isDark = theme === 'dark';

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        'rounded-xl flex items-center justify-center transition-all duration-300 btn-press',
        'border border-border/60 hover:border-accent/40',
        'hover:bg-accent/10 hover:shadow-[0_0_12px_var(--glow-accent)]',
        size === 'compact' ? 'w-8 h-8' : 'w-10 h-10',
        isAuto
          ? 'text-accent bg-surface-tertiary/60'
          : isDark
            ? 'text-amber-400 bg-surface-tertiary/60'
            : 'text-indigo-500 bg-surface-tertiary/60'
      )}
      title={isAuto ? 'Auto mode (7am–6pm light)' : isDark ? 'Dark mode — click for Auto' : 'Light mode — click for Dark'}
    >
      {isAuto ? (
        /* Auto/clock icon */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ) : isDark ? (
        /* Sun icon */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Moon icon */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}
