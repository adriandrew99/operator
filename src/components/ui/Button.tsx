import { cn } from '@/lib/utils/cn';
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent-ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium font-sans transition-all duration-200 ease-[cubic-bezier(0.165,0.85,0.45,1)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-light focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          'rounded-lg active:scale-[0.98]',
          {
            'bg-accent text-white font-medium hover:opacity-90': variant === 'primary',
            'bg-surface-tertiary text-text-primary hover:bg-surface-hover border border-border': variant === 'secondary',
            'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary': variant === 'ghost',
            'bg-surface-tertiary text-danger hover:bg-surface-hover border border-border': variant === 'danger',
            'text-accent hover:bg-accent-muted': variant === 'accent-ghost',
          },
          {
            'h-9 sm:h-8 px-3.5 sm:px-3 text-xs': size === 'sm',
            'h-11 sm:h-10 px-5 text-sm': size === 'md',
            'h-12 px-6 text-base': size === 'lg',
            'h-9 w-9 p-0': size === 'icon',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export { Button };
