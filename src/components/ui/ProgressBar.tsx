import { cn } from '@/lib/utils/cn';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showPercentage?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function ProgressBar({ value, max, label, showPercentage = true, className, size = 'md' }: ProgressBarProps) {
  const percentage = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-xs text-text-secondary">{label}</span>}
          {showPercentage && <span className="text-xs font-medium text-text-primary">{percentage}%</span>}
        </div>
      )}
      <div className={cn('w-full bg-surface-tertiary overflow-hidden rounded-full', size === 'sm' ? 'h-1.5' : 'h-2.5')}>
        <div
          className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
