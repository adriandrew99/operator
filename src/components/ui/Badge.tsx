import { cn } from '@/lib/utils/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'danger' | 'warning' | 'success';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-md',
        {
          'bg-surface-tertiary text-text-secondary': variant === 'default',
          'bg-accent/15 text-accent': variant === 'accent',
          'bg-danger/15 text-danger': variant === 'danger',
          'bg-warning/15 text-warning': variant === 'warning',
          'bg-success/15 text-success': variant === 'success',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
