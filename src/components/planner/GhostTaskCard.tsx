'use client';

import { cn } from '@/lib/utils/cn';
import type { SuggestionResult } from '@/actions/planner';

interface GhostTaskCardProps {
  suggestion: SuggestionResult;
  onAccept: () => void;
  onReject: () => void;
}

export function GhostTaskCard({ suggestion, onAccept, onReject }: GhostTaskCardProps) {
  return (
    <div className="relative border border-dashed border-border-light rounded-lg px-2.5 py-1.5 bg-surface-tertiary text-xs animate-fade-in">
      <div className="flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <span className="text-text-secondary truncate block">{suggestion.taskTitle}</span>
          <span className="text-xs text-text-tertiary mt-0.5 block">{suggestion.reasoning}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAccept();
            }}
            className="w-5 h-5 rounded-md text-text-primary hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer"
            title="Accept suggestion"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4.5 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReject();
            }}
            className="w-5 h-5 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer"
            title="Reject suggestion"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
