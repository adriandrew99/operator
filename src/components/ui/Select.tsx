import { cn } from '@/lib/utils/cn';
import { forwardRef } from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'w-full bg-surface-primary border border-border rounded-xl px-4 py-3 text-[15px] text-text-primary [box-shadow:var(--input-shadow)]',
            'focus:border-accent focus:ring-2 focus:ring-accent/15 focus:outline-none',
            'transition-all duration-200 appearance-none',
            error && 'border-danger focus:ring-danger/15',
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
export { Select };
