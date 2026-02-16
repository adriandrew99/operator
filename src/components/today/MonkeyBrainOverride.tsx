'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { MONKEY_BRAIN_RESET_SECONDS, MICRO_FOCUS_MINUTES } from '@/lib/constants';

interface MonkeyBrainOverrideProps {
  primaryObjective?: string | null;
}

type Phase = 'idle' | 'reset' | 'micro';

export function MonkeyBrainOverride({ primaryObjective }: MonkeyBrainOverrideProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(MONKEY_BRAIN_RESET_SECONDS);

  useEffect(() => {
    if (phase === 'idle') return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          if (phase === 'reset') {
            setPhase('idle');
          } else if (phase === 'micro') {
            setPhase('idle');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  const startReset = useCallback(() => {
    setPhase('reset');
    setSeconds(MONKEY_BRAIN_RESET_SECONDS);
  }, []);

  const startMicroFocus = useCallback(() => {
    setPhase('micro');
    setSeconds(MICRO_FOCUS_MINUTES * 60);
  }, []);

  const dismiss = useCallback(() => {
    setPhase('idle');
    setSeconds(MONKEY_BRAIN_RESET_SECONDS);
  }, []);

  if (phase === 'idle') {
    return (
      <button
        onClick={startReset}
        className={cn(
          'w-full py-3 px-4 border border-dashed border-border rounded-2xl',
          'text-xs text-text-tertiary hover:text-text-secondary hover:border-border-light',
          'transition-all duration-200 text-center uppercase tracking-wider'
        )}
      >
        Monkey Brain Override
      </button>
    );
  }

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg flex items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-8 text-center animate-fade-in">
        {phase === 'reset' && (
          <>
            <p className="text-[10px] text-text-tertiary uppercase tracking-widest">
              Reset Timer
            </p>
            <p className="font-mono text-5xl font-bold text-text-primary">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </p>
            <p className="text-sm text-text-secondary">
              Breathe. Reset. Refocus.
            </p>
            {primaryObjective && (
              <div className="card-surface border border-border rounded-2xl p-5">
                <p className="text-[10px] text-text-tertiary uppercase tracking-widest mb-2">
                  Your Objective
                </p>
                <p className="text-sm text-text-primary font-medium">
                  {primaryObjective}
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Button size="sm" onClick={startMicroFocus}>
                10-min Micro Focus
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Dismiss
              </Button>
            </div>
          </>
        )}

        {phase === 'micro' && (
          <>
            <p className="text-[10px] text-accent uppercase tracking-widest animate-pulse-accent">
              Micro Focus Active
            </p>
            <p className="font-mono text-5xl font-bold text-text-primary">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </p>
            <p className="text-sm text-text-secondary">
              Just 10 minutes. You can do anything for 10 minutes.
            </p>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Done
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
