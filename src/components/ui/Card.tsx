import { cn } from '@/lib/utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: boolean;
}

export function Card({ className, hover, glow, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'card-surface border border-border rounded-2xl p-5',
        hover && 'hover:bg-surface-tertiary hover:border-border-light transition-all cursor-pointer',
        glow && 'glow-hover',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-sm font-medium text-text-primary', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardValue({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-2xl font-semibold text-text-primary mt-1', className)} {...props}>
      {children}
    </p>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-xs text-text-secondary mt-1', className)} {...props}>
      {children}
    </p>
  );
}
