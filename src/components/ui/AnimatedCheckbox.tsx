'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
interface AnimatedCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

interface Particle {
  id: number;
  tx: number;
  ty: number;
  color: string;
}

const PARTICLE_COLORS = ['#c2653a', '#ae5630', '#d4956e', '#da7756', '#e8a87c', '#b87333'];

// Punchy "level up" completion sound — Xbox-achievement inspired
function playCompletionSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const t = ctx.currentTime;

    // Layer 1: Punchy low "thump" for satisfying weight
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(180, t);
    thump.frequency.exponentialRampToValueAtTime(80, t + 0.15);
    thumpGain.gain.setValueAtTime(0.2, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(t);
    thump.stop(t + 0.2);

    // Layer 2: Quick two-note chime — G5 → B5 (major third, bright & positive)
    const chimeNotes = [783.99, 987.77]; // G5, B5
    chimeNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + 0.03 + i * 0.08);
      gain.gain.setValueAtTime(0, t + 0.03 + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.03 + i * 0.08 + 0.015);
      gain.gain.setValueAtTime(0.18, t + 0.03 + i * 0.08 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03 + i * 0.08 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + 0.03 + i * 0.08);
      osc.stop(t + 0.03 + i * 0.08 + 0.45);
    });

    // Layer 3: Shimmer — high harmonic for sparkle
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(1975.53, t + 0.12); // B6
    shimmerGain.gain.setValueAtTime(0, t + 0.12);
    shimmerGain.gain.linearRampToValueAtTime(0.04, t + 0.14);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmer.start(t + 0.12);
    shimmer.stop(t + 0.6);

    setTimeout(() => ctx.close(), 800);
  } catch {
    // Audio not available — silently fail
  }
}

export function AnimatedCheckbox({ checked, onChange, disabled, size = 'md' }: AnimatedCheckboxProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
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
      // Completion sound
      playCompletionSound();

      // Generate confetti particles
      const newParticles: Particle[] = Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const distance = 20 + Math.random() * 15;
        return {
          id: i,
          tx: Math.cos(angle) * distance,
          ty: Math.sin(angle) * distance,
          color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
        };
      });

      setParticles(newParticles);
      setAnimating(true);

      timeoutRef.current = setTimeout(() => {
        setParticles([]);
        setAnimating(false);
      }, 600);
    } else {
      // Uncheck animation — springy reverse pop, no confetti or sound
      setUnchecking(true);
      uncheckTimeoutRef.current = setTimeout(() => {
        setUnchecking(false);
      }, 300);
    }
  }, [checked, onChange, disabled]);

  const dim = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  const svgSize = size === 'sm' ? 12 : 14;

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          dim,
          'rounded-lg border flex items-center justify-center transition-all duration-200 cursor-pointer',
          checked
            ? 'bg-accent border-accent shadow-sm shadow-accent/30'
            : 'border-border-light hover:border-accent/50',
          animating && !unchecking && 'animate-checkbox-pop',
          unchecking && 'animate-checkbox-unpop',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {checked && (
          <svg
            width={svgSize}
            height={svgSize}
            viewBox="0 0 14 14"
            fill="none"
            className="text-white"
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

      {/* Confetti particles */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
          style={{
            backgroundColor: p.color,
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
            animation: 'confetti-particle 0.5s ease-out forwards',
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
