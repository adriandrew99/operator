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
          'inline-flex items-center justify-center font-sans transition-all duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          'rounded-xl active:scale-[0.98]',
          {
            'bg-accent text-white font-semibold shadow-[var(--button-shadow)] hover:bg-accent-bright hover:shadow-[0_2px_8px_rgba(37,99,235,0.25)]': variant === 'primary',
            'bg-surface-primary text-text-primary font-medium border border-border shadow-[var(--button-shadow)] hover:bg-surface-hover hover:border-border-light': variant === 'secondary',
            'text-text-secondary font-medium hover:text-text-primary hover:bg-surface-hover': variant === 'ghost',
            'bg-surface-primary text-danger font-medium border border-border shadow-[var(--button-shadow)] hover:bg-surface-hover': variant === 'danger',
            'text-accent font-semibold hover:bg-accent-muted': variant === 'accent-ghost',
          },
          {
            'h-9 px-4 text-sm': size === 'sm',
            'h-11 px-6 text-sm': size === 'md',
            'h-12 px-8 text-base': size === 'lg',
            'h-10 w-10 p-0 rounded-xl': size === 'icon',
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
