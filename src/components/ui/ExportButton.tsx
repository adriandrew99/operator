'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface ExportOption {
  label: string;
  description?: string;
  action: () => void;
}

interface ExportButtonProps {
  options: ExportOption[];
  className?: string;
}

/**
 * A dropdown button for exporting data in various formats.
 * Renders a small download icon button that expands into a menu.
 */
export function ExportButton({ options, className }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (options.length === 0) return null;

  // Single option — just a button, no dropdown
  if (options.length === 1) {
    return (
      <button
        onClick={options[0].action}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium',
          'text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors cursor-pointer',
          className
        )}
        title={options[0].label}
      >
        <DownloadIcon />
        <span className="hidden sm:inline">Export</span>
      </button>
    );
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium',
          'text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-colors cursor-pointer',
          open && 'text-text-primary bg-surface-tertiary'
        )}
      >
        <DownloadIcon />
        <span className="hidden sm:inline">Export</span>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-surface-secondary border border-border rounded-xl py-1 animate-scale-in">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => { opt.action(); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-surface-tertiary transition-colors cursor-pointer"
            >
              <p className="text-xs text-text-primary">{opt.label}</p>
              {opt.description && (
                <p className="text-xs text-text-tertiary mt-0.5">{opt.description}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
