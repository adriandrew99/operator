import { cn } from '@/lib/utils/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'danger' | 'warning' | 'success';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded transition-colors',
        {
          'bg-surface-tertiary text-text-secondary': variant === 'default',
          'bg-accent-muted text-accent': variant === 'accent',
          'bg-danger/10 text-danger': variant === 'danger',
          'bg-warning/10 text-warning': variant === 'warning',
          'bg-success/10 text-accent-green': variant === 'success',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
