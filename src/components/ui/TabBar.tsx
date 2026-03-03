'use client';

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
  return (
    <div
      className={cn(
        'flex gap-1 overflow-x-auto scrollbar-none p-1 rounded-lg bg-surface-inset',
        className
      )}
    >
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          title={tab.label}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 text-sm whitespace-nowrap transition-all duration-200 rounded-md',
            active === tab.key
              ? 'bg-surface-tertiary text-text-primary font-medium shadow-sm'
              : 'text-text-tertiary hover:text-text-secondary'
          )}
        >
          {tab.icon && <span className="text-sm">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
