'use client';

import { useState, useEffect, useRef } from 'react';

interface CelebrationBurstProps {
  trigger: boolean;
  message?: string;
}

/**
 * Simplified completion indicator — brief subtle toast, no particles or sound.
 */
export function CelebrationBurst({ trigger, message = 'All done!' }: CelebrationBurstProps) {
  const [show, setShow] = useState(false);
  const [prevTrigger, setPrevTrigger] = useState(trigger);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    // Only trigger on false→true transition
    if (trigger && !prevTrigger) {
      setShow(true);
      hasPlayedRef.current = true;
      const timer = setTimeout(() => {
        setShow(false);
        hasPlayedRef.current = false;
      }, 2000);
      return () => clearTimeout(timer);
    }
    setPrevTrigger(trigger);
  }, [trigger, prevTrigger]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div className="px-5 py-2.5 rounded-lg bg-surface-secondary border border-border animate-fade-in">
        <p className="text-sm text-text-primary">{message}</p>
      </div>
    </div>
  );
}
