'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { NexusLogo } from '@/components/ui/NexusLogo';

const NAV_ITEMS = [
  { href: '/today', label: 'Today', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/tasks', label: 'Tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { href: '/planner', label: 'Planner', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/finance', label: 'Finance', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/pipeline', label: 'Pipeline', icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' },
  { href: '/knowledge', label: 'Knowledge', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { href: '/analytics', label: 'Analytics', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

function getWeekId(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().split('T')[0];
}

interface SidebarProps {
  debriefReady?: boolean;
}

export function Sidebar({ debriefReady }: SidebarProps) {
  const pathname = usePathname();
  const [debriefViewed, setDebriefViewed] = useState(false);

  useEffect(() => {
    const weekId = getWeekId();
    const viewed = localStorage.getItem('debrief-viewed') === weekId;
    setDebriefViewed(viewed);

    if (pathname.startsWith('/analytics') && debriefReady && !viewed) {
      localStorage.setItem('debrief-viewed', weekId);
      setDebriefViewed(true);
    }
  }, [pathname, debriefReady]);

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
    <aside className="hidden md:flex flex-col w-[240px] h-screen sticky top-0 bg-surface-primary border-r border-border overflow-y-auto">
      {/* Logo — drag region for Tauri */}
      <div className="px-6 pt-7 pb-6" onMouseDown={handleDrag}>
        <div className="flex items-center gap-3">
          <NexusLogo size="md" />
          <div>
            <h1 className="text-sm font-bold text-text-primary tracking-tight">
              Nexus
            </h1>
            <p className="text-[10px] text-text-tertiary mt-0.5 font-medium">Command Centre</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const showDot = item.href === '/analytics' && debriefReady && !debriefViewed;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 text-sm rounded-xl transition-colors duration-150 relative',
                isActive
                  ? 'text-text-primary bg-surface-tertiary font-medium'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary/60'
              )}
            >
              {/* Active indicator — solid accent left bar */}
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-accent" />
              )}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={isActive ? '2' : '1.5'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isActive ? 'text-text-primary' : ''}
              >
                <path d={item.icon} />
              </svg>
              <span className="flex-1">{item.label}</span>
              {showDot && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border">
        <p className="text-[9px] text-text-tertiary/40 uppercase tracking-widest font-medium">v3.0</p>
      </div>
    </aside>
  );
}
