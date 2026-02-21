'use client';

import { cn } from '@/lib/utils/cn';

interface BentoSkeletonProps {
  /** Layout preset: 'today' for 2-col bento, 'score' for 2-col, 'default' for simple */
  layout?: 'today' | 'score' | 'default';
}

export function BentoSkeleton({ layout = 'default' }: BentoSkeletonProps) {
  if (layout === 'today') {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bento-grid-2 skeleton-stagger">
          <SkeletonCard className="bento-full h-48" />
          <SkeletonCard className="h-40" />
          <SkeletonCard className="h-40" />
          <SkeletonCard className="bento-full h-64" />
          <SkeletonCard className="h-56" />
          <SkeletonCard className="h-56" />
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-48" />
          <SkeletonCard className="bento-full h-48" />
        </div>
      </div>
    );
  }

  if (layout === 'score') {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bento-grid skeleton-stagger">
          <SkeletonCard className="bento-wide h-48" />
          <SkeletonCard className="bento-wide h-48" />
          <SkeletonCard className="bento-full h-64" />
          <SkeletonCard className="bento-wide h-48" />
          <SkeletonCard className="bento-wide h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 skeleton-stagger">
      <SkeletonCard className="h-16" />
      <SkeletonCard className="h-48" />
      <SkeletonCard className="h-64" />
      <SkeletonCard className="h-48" />
    </div>
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl bg-surface-tertiary border border-border animate-pulse',
        className
      )}
    />
  );
}
