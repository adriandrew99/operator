'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
interface AnimatedCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function AnimatedCheckbox({ checked, onChange, disabled, size = 'md' }: AnimatedCheckboxProps) {
  const [animating, setAnimating] = useState(false);
  const [unchecking, setUnchecking] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>(null);
  const uncheckTimeoutRef = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (uncheckTimeoutRef.current) clearTimeout(uncheckTimeoutRef.current);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (disabled) return;

    const newChecked = !checked;
    onChange(newChecked);

    if (newChecked) {
      setAnimating(true);
      timeoutRef.current = setTimeout(() => {
        setAnimating(false);
      }, 250);
    } else {
      setUnchecking(true);
      uncheckTimeoutRef.current = setTimeout(() => {
        setUnchecking(false);
      }, 200);
    }
  }, [checked, onChange, disabled]);

  const dim = size === 'sm' ? 'w-4.5 h-4.5' : 'w-5 h-5';
  const svgSize = size === 'sm' ? 10 : 12;

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          dim,
          'rounded-md border flex items-center justify-center transition-all duration-150 cursor-pointer',
          checked
            ? 'bg-text-primary border-text-primary'
            : 'border-border-light hover:border-text-tertiary',
          animating && !unchecking && 'animate-checkbox-pop',
          unchecking && 'animate-checkbox-unpop',
          disabled && 'opacity-40 cursor-not-allowed'
        )}
      >
        {checked && (
          <svg
            width={svgSize}
            height={svgSize}
            viewBox="0 0 14 14"
            fill="none"
            className="text-background"
          >
            <path
              d="M2.5 7L5.5 10L11.5 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={animating ? 'animate-checkmark-draw' : ''}
            />
          </svg>
        )}
      </button>
    </div>
  );
}
