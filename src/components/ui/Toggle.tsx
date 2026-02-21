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
        'flex items-center gap-3 w-full py-2.5 px-3 transition-all group rounded-xl',
        'hover:bg-surface-tertiary',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      <div
        className={cn(
          'relative w-10 h-6 rounded-full transition-all duration-150 flex-shrink-0',
          checked
            ? 'bg-text-primary'
            : 'bg-surface-tertiary border border-border'
        )}
      >
        <div
          className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full bg-background transition-all duration-150',
            checked ? 'left-[18px]' : 'left-0.5'
          )}
        />
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
