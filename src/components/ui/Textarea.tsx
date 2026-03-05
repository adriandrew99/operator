import { cn } from '@/lib/utils/cn';
import { forwardRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'w-full bg-surface-primary border border-border rounded-xl px-4 py-3 text-[15px] text-text-primary [box-shadow:var(--input-shadow)]',
            'placeholder:text-text-tertiary',
            'focus:border-accent focus:ring-2 focus:ring-accent/15 focus:outline-none',
            'transition-all duration-200 resize-none',
            error && 'border-danger focus:ring-danger/15',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
export { Textarea };
