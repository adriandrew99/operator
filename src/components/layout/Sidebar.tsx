'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { NexusLogo } from '@/components/ui/NexusLogo';
import { useSidebar } from '@/providers/SidebarProvider';

/** Tooltip that portals to document.body so it escapes overflow:hidden */
function SidebarTooltip({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const show = useCallback(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    parent.addEventListener('mouseenter', show);
    parent.addEventListener('mouseleave', hide);
    return () => {
      parent.removeEventListener('mouseenter', show);
      parent.removeEventListener('mouseleave', hide);
    };
  }, [show, hide]);

  return (
    <>
      <div ref={ref} className="hidden" />
      {mounted && pos && createPortal(
        <div
          className="fixed tooltip-glass px-3 py-1.5 text-xs font-medium text-text-primary pointer-events-none whitespace-nowrap z-[9999]"
          style={{
            top: pos.top,
            left: pos.left,
            transform: 'translateY(-50%)',
          }}
        >
          {label}
          {/* Arrow */}
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              left: -4,
              width: 0,
              height: 0,
              borderTop: '4px solid transparent',
              borderBottom: '4px solid transparent',
              borderRight: '4px solid var(--tooltip-bg)',
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Work',
    items: [
      { href: '/today', label: 'Today', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
      { href: '/tasks', label: 'Tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
      { href: '/planner', label: 'Planner', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    ],
  },
  {
    title: 'Business',
    items: [
      { href: '/finance', label: 'Finance', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { href: '/pipeline', label: 'Pipeline', icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' },
      { href: '/outbound', label: 'Outbound', icon: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/knowledge', label: 'Knowledge', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
      { href: '/analytics', label: 'Analytics', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { href: '/score', label: 'Score', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
      { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    ],
  },
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
  const { collapsed, toggle } = useSidebar();
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
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen border-r border-border overflow-y-auto overflow-x-hidden',
        'transition-[width] duration-300 ease-out',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
      style={{ background: 'var(--surface-primary)' }}
    >
      {/* Logo — drag region for Tauri */}
      <div
        className={cn(
          'pt-12 pb-8 transition-all duration-300 relative',
          collapsed ? 'px-0 flex justify-center' : 'px-5'
        )}
        onMouseDown={handleDrag}
      >
        <div className="absolute inset-0 z-0" data-tauri-drag-region="" />
        <div className={cn('flex items-center pointer-events-none relative z-10', collapsed ? 'justify-center' : 'gap-3')}>
          <NexusLogo size={collapsed ? 'sm' : 'md'} />
          <div className={cn(
            'transition-all duration-300 overflow-hidden whitespace-nowrap',
            collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
          )}>
            <h1 className="text-section-heading text-text-primary">
              Nexus
            </h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className={cn(
        'flex-1 py-1',
        collapsed ? 'px-1.5' : 'px-3'
      )}>
        {NAV_SECTIONS.map((section, sectionIdx) => (
          <div key={section.title} className={sectionIdx > 0 ? 'mt-3' : ''}>
            {/* Section divider (replaces uppercase labels) */}
            {sectionIdx > 0 && (
              <div className={cn(
                'mb-3',
                collapsed ? 'mx-2 border-t border-border' : 'mx-2 border-t border-border'
              )} />
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const showDot = item.href === '/analytics' && debriefReady && !debriefViewed;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center text-[14px] rounded-xl transition-all duration-200 relative group',
                      collapsed ? 'justify-center px-0 py-2.5 h-10' : 'gap-3 px-3 py-2.5 h-10',
                      isActive
                        ? 'text-text-primary'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary'
                    )}
                    style={isActive ? {
                      background: 'linear-gradient(90deg, rgba(216, 136, 91, 0.12), rgba(216, 136, 91, 0.03))',
                    } : undefined}
                    title={item.label}
                  >
                    {/* Active indicator — accent left bar */}
                    {isActive && (
                      <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-accent" />
                    )}

                    {/* Icon */}
                    <div className={cn(
                      'flex items-center justify-center w-7 h-7 flex-shrink-0 transition-colors duration-200',
                      isActive ? 'text-accent' : 'text-text-tertiary group-hover:text-text-secondary'
                    )}>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={isActive ? '2' : '1.5'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={item.icon} />
                      </svg>
                    </div>

                    {/* Label */}
                    <span className={cn(
                      'transition-all duration-300 overflow-hidden whitespace-nowrap',
                      collapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100 flex-1',
                      isActive && 'font-medium'
                    )}>
                      {item.label}
                    </span>

                    {/* Debrief dot */}
                    {showDot && !collapsed && (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
                      </span>
                    )}
                    {showDot && collapsed && (
                      <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
                      </span>
                    )}

                    {/* Tooltip on hover — only when collapsed */}
                    {collapsed && (
                      <SidebarTooltip label={item.label} />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className={cn(
        'py-3 border-t border-border',
        collapsed ? 'px-1.5' : 'px-3'
      )}>
        <button
          onClick={toggle}
          className={cn(
            'flex items-center w-full rounded-xl py-2.5 text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-all duration-200',
            collapsed ? 'justify-center px-0' : 'gap-3 px-3'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              'transition-transform duration-300 flex-shrink-0',
              collapsed ? 'rotate-180' : ''
            )}
          >
            <path d="M11 17l-5-5 5-5" />
            <path d="M18 17l-5-5 5-5" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
