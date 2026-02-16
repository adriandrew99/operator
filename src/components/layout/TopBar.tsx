'use client';

import { ThemeToggle } from './ThemeToggle';
import { usePathname } from 'next/navigation';
import { useCallback } from 'react';

const PAGE_TITLES: Record<string, string> = {
  '/today': 'Today',
  '/tasks': 'Tasks',
  '/finance': 'Finance',
  '/pipeline': 'Pipeline',
  '/knowledge': 'Knowledge',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
};

export function TopBar() {
  const pathname = usePathname();
  const title = Object.entries(PAGE_TITLES).find(([path]) => pathname.startsWith(path))?.[1] || '';

  const handleDrag = useCallback((e: React.MouseEvent) => {
    // Only start drag if clicking directly on the bar, not on buttons/links
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
    e.preventDefault();
    // Use Tauri's window drag API if available
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        getCurrentWindow().startDragging();
      }).catch(() => {});
    }
  }, []);

  return (
    <div
      className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 safe-area-inset-top"
      onMouseDown={handleDrag}
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-6 h-12 sm:h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-accent flex items-center justify-center shadow-md shadow-accent/20">
              <span className="text-black text-[10px] sm:text-xs font-black">O</span>
            </div>
            <span className="text-sm font-bold text-text-primary">{title}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
