import { cn } from '@/lib/utils/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'danger' | 'warning' | 'success';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md transition-colors',
        {
          'bg-surface-tertiary text-text-secondary': variant === 'default',
          'bg-surface-tertiary text-text-primary': variant === 'accent',
          'bg-surface-tertiary text-danger/80': variant === 'danger',
          'bg-surface-tertiary text-warning/80': variant === 'warning',
          'bg-surface-tertiary text-success/80': variant === 'success',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
