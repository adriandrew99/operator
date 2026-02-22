'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface InfoBoxProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function InfoBox({ title, children, className }: InfoBoxProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  function handleEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function handleLeave() {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div
        className="w-4 h-4 rounded-full border border-border flex items-center justify-center text-xs text-text-tertiary hover:text-text-secondary hover:border-border-light transition-all cursor-help"
        aria-label={`Info: ${title}`}
      >
        ?
      </div>
      {open && (
        <div className="absolute z-50 top-6 left-0 w-64 p-3.5 rounded-xl tooltip-glass animate-fade-in">
          <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-[0.02em] mb-1.5">{title}</p>
          <div className="text-xs text-text-secondary leading-relaxed space-y-1">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
