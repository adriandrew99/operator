'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function DebriefBanner() {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    const weekId = getWeekId(new Date());
    const bannerDismissed = localStorage.getItem('debrief-banner-dismissed');
    const viewed = localStorage.getItem('debrief-viewed');
    // Hide if explicitly dismissed OR already viewed the debrief this week
    setDismissed(bannerDismissed === weekId || viewed === weekId);
  }, []);

  function getWeekId(date: Date): string {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay() + 1);
    return d.toISOString().split('T')[0];
  }

  function handleView() {
    const weekId = getWeekId(new Date());
    localStorage.setItem('debrief-banner-dismissed', weekId);
    localStorage.setItem('debrief-viewed', weekId);
    setDismissed(true);
  }

  function handleClose(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const weekId = getWeekId(new Date());
    localStorage.setItem('debrief-banner-dismissed', weekId);
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/8 border border-accent/20 animate-fade-in">
      <Link
        href="/analytics"
        onClick={handleView}
        className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
        </span>
        <span className="text-xs text-text-secondary">
          Your <span className="text-accent font-medium">Weekly Debrief</span> is ready — see where your energy went this week
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent/60 ml-auto shrink-0">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Link>
      <button
        onClick={handleClose}
        className="text-text-tertiary hover:text-text-secondary transition-colors shrink-0 p-1 -mr-1 cursor-pointer"
        title="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
