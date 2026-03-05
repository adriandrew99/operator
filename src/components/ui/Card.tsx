import { cn } from '@/lib/utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: boolean;
  variant?: 'default' | 'elevated' | 'inset' | 'glass' | 'accent' | 'flat' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  className,
  hover,
  glow,
  variant = 'default',
  padding = 'lg',
  children,
  ...props
}: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-5',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={cn(
        'rounded-[14px] transition-all duration-200 ease-out',
        {
          'card-elevated': variant === 'default' || variant === 'elevated',
          'card-inset': variant === 'inset',
          'card-glass': variant === 'glass',
          'card-accent': variant === 'accent',
          'bg-surface-secondary rounded-[14px] border border-border shadow-[var(--card-shadow)]': variant === 'flat',
          'card-gradient': variant === 'gradient',
        },
        paddingClasses[padding],
        hover && 'cursor-pointer hover:bg-surface-hover hover:shadow-[var(--card-shadow-lg)]',
        glow && 'card-hover-glow',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-6', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-card-title text-text-primary', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardValue({
  className,
  size = 'default',
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { size?: 'sm' | 'default' | 'lg' | 'hero' }) {
  const sizeClasses = {
    sm: 'display-number text-lg',
    default: 'display-number text-2xl',
    lg: 'display-number-large',
    hero: 'display-number-hero',
  };

  return (
    <p className={cn(sizeClasses[size], 'text-text-primary mt-2', className)} {...props}>
      {children}
    </p>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-small text-text-secondary mt-2 leading-relaxed', className)} {...props}>
      {children}
    </p>
  );
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mt-6 pt-6 border-t border-border', className)} {...props}>
      {children}
    </div>
  );
}
