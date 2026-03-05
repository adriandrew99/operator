'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface DebriefPopupProps {
  debriefReady: boolean;
}

function getWeekId(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay() + 1); // Monday of this week
  return d.toISOString().split('T')[0];
}

export function DebriefPopup({ debriefReady }: DebriefPopupProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!debriefReady || dismissed) return;
    // Already on analytics — don't show
    if (pathname.startsWith('/analytics')) return;

    // Check if it's Friday 4pm+ (or weekend) and hasn't been dismissed this week
    function checkTime() {
      const now = new Date();
      const day = now.getDay(); // 0=Sun, 5=Fri, 6=Sat
      const hour = now.getHours();
      const isFriAfternoon = day === 5 && hour >= 16;
      const isWeekend = day === 0 || day === 6;

      if (isFriAfternoon || isWeekend) {
        // Check localStorage for weekly dismiss
        const weekId = getWeekId(now);
        const dismissedWeek = localStorage.getItem('debrief-popup-dismissed');
        if (dismissedWeek === weekId) return;
        setVisible(true);
      }
    }

    checkTime();
    const interval = setInterval(checkTime, 60000); // re-check every minute
    return () => clearInterval(interval);
  }, [debriefReady, dismissed, pathname]);

  function handleDismiss() {
    const weekId = getWeekId(new Date());
    localStorage.setItem('debrief-popup-dismissed', weekId);
    localStorage.setItem('debrief-viewed', weekId);
    setDismissed(true);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-slide-up">
      <div className="bg-surface-secondary border border-border rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-tertiary flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-primary">
              <path d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">Weekly Debrief Ready</p>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              Your week is wrapping up — see where your energy went and how much each client cost you.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <Link
                href="/analytics"
                onClick={handleDismiss}
                className="text-xs font-medium text-text-primary hover:text-text-secondary transition-colors"
              >
                View Debrief &rarr;
              </Link>
              <button
                onClick={handleDismiss}
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-text-tertiary hover:text-text-secondary transition-colors shrink-0 cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
