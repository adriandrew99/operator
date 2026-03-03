'use client';

import { useState, useEffect, useRef } from 'react';
import { playCompletionFanfare } from '@/lib/utils/sounds';

interface CompletionCelebrationProps {
  trigger: boolean;
  onComplete: () => void;
}

const CELEBRATION_KEY = 'completion-celebration-date';
const CONFETTI_COUNT = 60;

const COLORS = [
  '#D8885B', '#E4A07A', '#ffffff', '#f59e0b',
  '#fbbf24', '#4ade80', '#a78bfa', '#fb923c',
];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

/**
 * Full-screen celebration when all tasks are done.
 * Pure CSS confetti + text overlay. No canvas, no RAF — just DOM elements with CSS animations.
 * Plays once per day (localStorage guard).
 */
export function CompletionCelebration({ trigger, onComplete }: CompletionCelebrationProps) {
  const [phase, setPhase] = useState<'idle' | 'celebrating' | 'done'>('idle');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const hasTriggeredRef = useRef(false);
  const wasEverFalseRef = useRef(!trigger);

  useEffect(() => {
    if (!trigger) {
      wasEverFalseRef.current = true;
      hasTriggeredRef.current = false;
      return;
    }

    if (hasTriggeredRef.current || !wasEverFalseRef.current) return;
    hasTriggeredRef.current = true;

    const today = new Date().toISOString().split('T')[0];
    const alreadyCelebrated = localStorage.getItem(CELEBRATION_KEY) === today;
    if (alreadyCelebrated) { onCompleteRef.current(); return; }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setPhase('celebrating');

    // Sound (slight delay for user to register the visual)
    const t1 = setTimeout(() => playCompletionFanfare(), 150);

    // Total duration before cleanup
    const duration = prefersReduced ? 2000 : 3500;

    const t2 = setTimeout(() => {
      setPhase('done');
    }, duration - 500);

    const t3 = setTimeout(() => {
      setPhase('idle');
      localStorage.setItem(CELEBRATION_KEY, today);
      onCompleteRef.current();
    }, duration);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [trigger]);

  if (phase === 'idle') return null;

  return (
    <div
      className="fixed inset-0 z-50"
      style={{
        pointerEvents: 'none',
        opacity: phase === 'done' ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
      }}
    >
      {/* Dark scrim */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 45%, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.75) 100%)',
          animation: 'celebration-scrim-in 0.6s ease-out',
        }}
      />

      {/* CSS Confetti pieces */}
      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => {
        const color = COLORS[i % COLORS.length];
        const left = randomBetween(10, 90);
        const delay = randomBetween(0, 0.8);
        const duration = randomBetween(2, 3.5);
        const size = randomBetween(6, 12);
        const drift = randomBetween(-60, 60);
        const rotation = randomBetween(0, 720);
        const isCircle = Math.random() > 0.6;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: '-2%',
              width: isCircle ? size : size * 1.5,
              height: isCircle ? size : size * 0.6,
              backgroundColor: color,
              borderRadius: isCircle ? '50%' : '2px',
              opacity: 0,
              animation: `celebration-confetti-fall ${duration}s ${delay}s ease-in forwards`,
              ['--drift' as string]: `${drift}px`,
              ['--rotation' as string]: `${rotation}deg`,
            }}
          />
        );
      })}

      {/* "Day complete." text */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: 0,
          animation: 'celebration-text-in 0.7s 0.6s ease-out forwards',
        }}
      >
        <h2
          style={{
            fontSize: 'clamp(1.75rem, 5vw, 2.75rem)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 400,
            fontStyle: 'italic',
            letterSpacing: '0.02em',
            color: '#ffffff',
            textShadow: '0 0 60px rgba(216, 136, 91, 0.6), 0 0 120px rgba(216, 136, 91, 0.2), 0 2px 8px rgba(0,0,0,0.6)',
          }}
        >
          Day complete.
        </h2>
      </div>
    </div>
  );
}
