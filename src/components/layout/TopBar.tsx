'use client';

import { ThemeToggle } from './ThemeToggle';
import { usePathname } from 'next/navigation';
import { useCallback } from 'react';

const PAGE_TITLES: Record<string, string> = {
  '/today': 'Today',
  '/score': 'Score',
  '/tasks': 'Tasks',
  '/planner': 'Planner',
  '/finance': 'Finance',
  '/pipeline': 'Pipeline',
  '/outbound': 'Outbound',
  '/knowledge': 'Knowledge',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
};

function formatShortDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function TopBar() {
  const pathname = usePathname();
  const title = Object.entries(PAGE_TITLES).find(([path]) => pathname.startsWith(path))?.[1] || '';

  const handleDrag = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
    e.preventDefault();
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        getCurrentWindow().startDragging();
      }).catch(() => {});
    }
  }, []);

  return (
    <div
      className="sticky top-0 z-30 safe-area-inset-top bg-surface-primary border-b border-border"
      onMouseDown={handleDrag}
    >
      {/* Invisible drag region */}
      <div
        className="absolute inset-0 z-0"
        data-tauri-drag-region=""
      />
      <div className="w-full mx-auto px-5 sm:px-8 lg:px-10 h-12 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3 pointer-events-none">
          {/* Mobile: page title + date */}
          <div className="md:hidden flex items-baseline gap-2">
            <h1 className="text-[15px] font-semibold text-text-primary tracking-tight">{title}</h1>
            <span className="text-xs text-text-tertiary">{formatShortDate()}</span>
          </div>

          {/* Desktop: date on left */}
          <div className="hidden md:flex items-center">
            <span className="text-[13px] text-text-tertiary font-medium">{formatShortDate()}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          <ThemeToggle size="compact" />
        </div>
      </div>
    </div>
  );
}
