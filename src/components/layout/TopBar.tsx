'use client';

import { ThemeToggle } from './ThemeToggle';
import { NexusLogo } from '@/components/ui/NexusLogo';
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
      className="sticky top-0 z-30 bg-background border-b border-border safe-area-inset-top"
      onMouseDown={handleDrag}
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-6 h-12 sm:h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2">
            <NexusLogo size="sm" />
            <span className="text-sm font-bold text-text-primary">{title}</span>
          </div>
          {/* Desktop date */}
          <span className="hidden md:block text-xs text-text-tertiary">{formatShortDate()}</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
