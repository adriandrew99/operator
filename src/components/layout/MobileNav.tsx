'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const MOBILE_ITEMS = [
  { href: '/today', label: 'Today', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/tasks', label: 'Tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { href: '/planner', label: 'Plan', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/finance', label: 'Finance', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/analytics', label: 'Insights', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
];

const MORE_ITEMS = [
  { href: '/score', label: 'Score', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { href: '/pipeline', label: 'Pipeline', icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' },
  { href: '/outbound', label: 'Outbound', icon: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5' },
  { href: '/knowledge', label: 'Knowledge', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

function getWeekId(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().split('T')[0];
}

interface MobileNavProps {
  debriefReady?: boolean;
}

export function MobileNav({ debriefReady }: MobileNavProps) {
  const pathname = usePathname();
  const [debriefViewed, setDebriefViewed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const weekId = getWeekId();
    const viewed = localStorage.getItem('debrief-viewed') === weekId;
    setDebriefViewed(viewed);

    if (pathname.startsWith('/analytics') && debriefReady && !viewed) {
      localStorage.setItem('debrief-viewed', weekId);
      setDebriefViewed(true);
    }
  }, [pathname, debriefReady]);

  // Close "more" menu on navigate
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const isMoreActive = MORE_ITEMS.some(item => pathname.startsWith(item.href));

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-3 right-3 animate-slide-up">
            <div
              className="rounded-2xl p-1.5 tooltip-glass"
            >
              {MORE_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150',
                      isActive ? 'text-text-primary' : 'text-text-secondary active:bg-surface-tertiary'
                    )}
                    style={isActive ? {
                      background: 'linear-gradient(90deg, rgba(216, 136, 91, 0.12), rgba(216, 136, 91, 0.03))',
                    } : undefined}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={isActive ? '2' : '1.5'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={isActive ? 'text-accent' : ''}
                    >
                      <path d={item.icon} />
                    </svg>
                    <span className={cn('text-sm', isActive && 'font-medium')}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '1px solid var(--border-color)',
          boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div className="flex items-stretch justify-around safe-area-inset-bottom">
          {MOBILE_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const showDot = item.href === '/analytics' && debriefReady && !debriefViewed;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2.5 pt-3 flex-1 min-h-[64px] transition-all duration-200 relative',
                  isActive ? 'text-accent' : 'text-text-tertiary active:text-text-secondary'
                )}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-accent rounded-full" />
                )}
                <div className="relative flex items-center justify-center w-8 h-6">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={isActive ? '2' : '1.5'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={item.icon} />
                  </svg>
                  {showDot && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
                    </span>
                  )}
                </div>
                <span className={cn(
                  'text-[10px] leading-none',
                  isActive ? 'font-medium' : 'font-normal'
                )}>{item.label}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(prev => !prev)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-2.5 pt-3 flex-1 min-h-[64px] transition-all duration-200 relative',
              moreOpen || isMoreActive ? 'text-accent' : 'text-text-tertiary'
            )}
          >
            {(moreOpen || isMoreActive) && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-accent rounded-full" />
            )}
            <div className="flex items-center justify-center w-8 h-6">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
              </svg>
            </div>
            <span className={cn(
              'text-[10px] leading-none',
              (moreOpen || isMoreActive) ? 'font-medium' : 'font-normal'
            )}>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
