'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface InfoTipProps {
  text: string;
  className?: string;
  iconClassName?: string;
  position?: 'top' | 'bottom';
}

/**
 * Hover/tap tooltip with a small ⓘ icon.
 * Works on desktop (hover) and mobile (tap to toggle).
 */
export function InfoTip({ text, className, iconClassName, position = 'top' }: InfoTipProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close on outside tap (mobile)
  useEffect(() => {
    if (!show) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShow(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [show]);

  return (
    <span
      ref={ref}
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); setShow(prev => !prev); }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        className={cn('text-text-tertiary/60 hover:text-text-tertiary cursor-help transition-colors flex-shrink-0', iconClassName)}
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="5" r="0.75" fill="currentColor" />
      </svg>
      {show && (
        <span
          className={cn(
            'absolute z-50 left-1/2 -translate-x-1/2 w-max max-w-[220px] px-2.5 py-1.5 rounded-lg text-xs leading-relaxed font-normal normal-case tracking-normal',
            'bg-surface-secondary border border-border text-text-secondary',
            'pointer-events-none animate-fade-in',
            position === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          )}
        >
          {text}
        </span>
      )}
    </span>
  );
}

/**
 * Inline label with built-in tooltip — wraps a label string and adds ⓘ.
 * Use in place of plain <p> or <span> labels.
 */
export function LabelWithTip({
  label,
  tip,
  className,
  tipPosition,
}: {
  label: string;
  tip: string;
  className?: string;
  tipPosition?: 'top' | 'bottom';
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {label}
      <InfoTip text={tip} position={tipPosition} />
    </span>
  );
}
