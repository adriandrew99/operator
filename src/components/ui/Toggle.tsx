'use client';

import { cn } from '@/lib/utils/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, label, disabled, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex items-center gap-3 w-full py-2.5 px-3 transition-colors group',
        'hover:bg-surface-secondary',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      <div
        className={cn(
          'w-5 h-5 border-2 flex items-center justify-center transition-all',
          checked
            ? 'bg-accent border-accent'
            : 'border-border-light bg-transparent group-hover:border-text-secondary'
        )}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="black" strokeWidth="2" strokeLinecap="square" />
          </svg>
        )}
      </div>
      {label && (
        <span className={cn(
          'text-sm transition-colors',
          checked ? 'text-text-primary' : 'text-text-secondary'
        )}>
          {label}
        </span>
      )}
    </button>
  );
}
