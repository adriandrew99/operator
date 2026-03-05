import { cn } from '@/lib/utils/cn';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-xs font-medium font-sans text-text-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-surface-inset border border-border rounded-lg px-3.5 py-2.5 sm:py-2 text-base sm:text-sm text-text-primary',
            'placeholder:text-text-tertiary',
            'focus:border-border-light focus:ring-1 focus:ring-border-light/50 focus:bg-surface-secondary',
            'transition-all duration-150',
            error && 'border-danger focus:ring-danger/10',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export { Input };
