import { cn } from '@/lib/utils/cn';

interface NexusLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'w-7 h-7 sm:w-8 sm:h-8',
  md: 'w-8 h-8',
  lg: 'w-14 h-14',
} as const;

/**
 * Nexus mountain-peak logo mark.
 * Renders inline SVG at three preset sizes (sm, md, lg).
 */
export function NexusLogo({ size = 'md', className }: NexusLogoProps) {
  return (
    <div className={cn('rounded-xl bg-accent flex items-center justify-center shadow-[var(--button-shadow)]', SIZES[size], size === 'lg' && 'rounded-2xl', className)}>
      <svg
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[60%] h-[60%]"
      >
        <path
          d="M256 50 L440 390 L348 390 L256 210 L164 390 L72 390 Z"
          fill="white"
        />
      </svg>
    </div>
  );
}
