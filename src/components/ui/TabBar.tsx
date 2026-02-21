'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';

interface Tab<T extends string> {
  key: T;
  label: string;
  icon?: React.ReactNode;
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (tab: T) => void;
  className?: string;
}

export function TabBar<T extends string>({ tabs, active, onChange, className }: TabBarProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const activeEl = tabRefs.current.get(active);
    const container = containerRef.current;
    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeEl.getBoundingClientRect();
      setIndicator({
        left: tabRect.left - containerRect.left + container.scrollLeft,
        width: tabRect.width,
      });
    }
  }, [active]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // Also update on resize
  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex overflow-x-auto scrollbar-none border-b border-border',
        className
      )}
    >
      {tabs.map(tab => (
        <button
          key={tab.key}
          ref={el => { if (el) tabRefs.current.set(tab.key, el); }}
          onClick={() => onChange(tab.key)}
          title={tab.label}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap transition-colors duration-150 relative',
            active === tab.key
              ? 'text-accent font-medium'
              : 'text-text-tertiary hover:text-text-secondary'
          )}
        >
          {tab.icon && <span className="text-sm">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}

      {/* Sliding indicator */}
      <div
        className="tab-indicator"
        style={{ left: indicator.left, width: indicator.width }}
      />
    </div>
  );
}
