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
            'w-full bg-surface-primary border border-border rounded-md px-3.5 py-2.5 text-sm text-text-primary',
            'placeholder:text-text-tertiary',
            'focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none',
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
