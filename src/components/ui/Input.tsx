import { cn } from '@/lib/utils/cn';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium font-sans text-text-primary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-surface-primary border border-border rounded-xl px-4 py-3 text-[15px] text-text-primary',
            'placeholder:text-text-tertiary',
            'focus:border-accent focus:ring-2 focus:ring-accent/15 focus:outline-none',
            'transition-all duration-200 [box-shadow:var(--input-shadow)]',
            error && 'border-danger focus:ring-danger/15 focus:border-danger',
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-danger font-medium">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export { Input };
