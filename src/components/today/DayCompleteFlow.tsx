'use client';

import { useState, useEffect, useRef } from 'react';
import { playCompletionFanfare } from '@/lib/utils/sounds';
import { DayInReview } from './DayInReview';
import type { Task, Client, CheckInRatings, OperatorScore } from '@/lib/types/database';

const CELEBRATION_KEY = 'completion-celebration-date';
const CONFETTI_COUNT = 48;

const COLORS = [
  '#34D399', '#6EE7B7', '#FBBF24', '#FCD34D',
  '#94A3B8', '#CBD5E1', '#C4B5FD', '#D8B4FE',
];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export interface DayCompleteFlowProps {
  trigger: boolean;
  onComplete: () => void;
  todayTasks: Task[];
  completedTodayTasks: Task[];
  clients: Client[];
  fundamentalsHit: number;
  fundamentalsTotal: number;
  dailyCapacity?: number;
  existingCheckIn: CheckInRatings | null;
  existingNotes: string | null;
  onCheckInSaved: (score: OperatorScore) => void;
}

/**
 * Unified day-complete experience: satisfying celebration that transitions
 * smoothly into the Day in Review card. One overlay, two phases.
 */
export function DayCompleteFlow({
  trigger,
  onComplete,
  todayTasks,
  completedTodayTasks,
  clients,
  fundamentalsHit,
  fundamentalsTotal,
  dailyCapacity = 20,
  existingCheckIn,
  existingNotes,
  onCheckInSaved,
}: DayCompleteFlowProps) {
  const [phase, setPhase] = useState<'idle' | 'celebrate' | 'review' | 'out'>('idle');
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
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (alreadyCelebrated) {
      setPhase('review');
      return;
    }

    setPhase('celebrate');
    const tSound = setTimeout(() => playCompletionFanfare(), 200);
    const celebrateDuration = prefersReduced ? 2200 : 2800;
    const tReview = setTimeout(() => {
      setPhase('review');
    }, celebrateDuration);

    return () => {
      clearTimeout(tSound);
      clearTimeout(tReview);
    };
  }, [trigger]);

  const handleDismiss = () => {
    setPhase('out');
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(CELEBRATION_KEY, today);
    setTimeout(() => {
      setPhase('idle');
      onCompleteRef.current();
    }, 320);
  };

  if (phase === 'idle') return null;

  const showCelebration = phase === 'celebrate';
  const isExiting = phase === 'out';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{
        pointerEvents: phase === 'idle' ? 'none' : 'auto',
        opacity: isExiting ? 0 : 1,
        transition: 'opacity 0.32s ease-out',
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        style={{
          animation: showCelebration ? 'day-complete-scrim-in 0.5s ease-out' : 'none',
        }}
      />

      {/* Phase 1: Celebration */}
      {showCelebration && (
        <>
          {/* Confetti */}
          {Array.from({ length: CONFETTI_COUNT }).map((_, i) => {
            const color = COLORS[i % COLORS.length];
            const left = randomBetween(5, 95);
            const delay = randomBetween(0, 0.6);
            const duration = randomBetween(2.2, 3.2);
            const size = randomBetween(5, 11);
            const drift = randomBetween(-40, 40);
            const rotation = randomBetween(0, 540);
            const isCircle = Math.random() > 0.55;
            return (
              <div
                key={i}
                className="absolute rounded-sm"
                style={{
                  left: `${left}%`,
                  top: '-3%',
                  width: isCircle ? size : size * 1.4,
                  height: isCircle ? size : size * 0.5,
                  backgroundColor: color,
                  borderRadius: isCircle ? '50%' : '2px',
                  opacity: 0,
                  animation: `day-complete-confetti ${duration}s ${delay}s ease-in forwards`,
                  ['--drift' as string]: `${drift}px`,
                  ['--rotation' as string]: `${rotation}deg`,
                }}
              />
            );
          })}

          {/* Hero text */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center"
            style={{
              opacity: 0,
              animation: 'day-complete-hero-in 0.9s 0.35s ease-out forwards',
            }}
          >
            <div className="relative">
              <p
                className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white"
                style={{
                  fontFamily: 'var(--font-sans)',
                  textShadow: '0 0 80px rgba(52, 211, 153, 0.35), 0 2px 20px rgba(0,0,0,0.5)',
                }}
              >
                Day complete
              </p>
              <p
                className="mt-2 text-base sm:text-lg text-white/80 font-medium tracking-wide"
                style={{
                  fontFamily: 'var(--font-sans)',
                  textShadow: '0 2px 12px rgba(0,0,0,0.4)',
                }}
              >
                You showed up.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Phase 2: Day in Review card — scales in from center */}
      {(phase === 'review' || phase === 'out') && (
        <div
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto day-complete-card-enter"
          style={{
            opacity: phase === 'out' ? 0 : 1,
            transform: phase === 'out' ? 'scale(0.96)' : 'scale(1)',
            transition: 'opacity 0.32s ease-out, transform 0.32s ease-out',
          }}
        >
          {phase === 'review' && (
            <DayInReview
              todayTasks={todayTasks}
              completedTodayTasks={completedTodayTasks}
              clients={clients}
              fundamentalsHit={fundamentalsHit}
              fundamentalsTotal={fundamentalsTotal}
              allTasksDone={true}
              dailyCapacity={dailyCapacity}
              existingCheckIn={existingCheckIn}
              existingNotes={existingNotes}
              onCheckInSaved={onCheckInSaved}
              celebrationPlayed={true}
              embeddedInFlow
              onDismiss={handleDismiss}
            />
          )}
        </div>
      )}
    </div>
  );
}
