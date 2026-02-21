'use client';

import { cn } from '@/lib/utils/cn';

// ━━━ BentoGrid ━━━
interface BentoGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  gap?: 'tight' | 'default' | 'loose';
  className?: string;
}

export function BentoGrid({ children, columns = 4, gap = 'default', className }: BentoGridProps) {
  const gridClass =
    columns === 2 ? 'bento-grid-2' :
    columns === 3 ? 'bento-grid-3' :
    'bento-grid';

  const gapClasses = {
    tight: 'gap-3',
    default: '',  // Uses CSS default (20px)
    loose: 'gap-8',
  };

  return (
    <div className={cn(gridClass, gapClasses[gap], className)}>
      {children}
    </div>
  );
}

// ━━━ BentoItem ━━━
interface BentoItemProps {
  children: React.ReactNode;
  span?: 'default' | 'wide' | 'full' | 'tall' | 'hero';
  delay?: number;
  className?: string;
}

const SPAN_CLASSES: Record<string, string> = {
  default: '',
  wide: 'bento-wide',
  full: 'bento-full',
  tall: 'bento-tall',
  hero: 'bento-hero',
};

export function BentoItem({ children, span = 'default', delay = 0, className }: BentoItemProps) {
  return (
    <div
      className={cn(SPAN_CLASSES[span], 'card-enter', className)}
      style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
