'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface CelebrationBurstProps {
  trigger: boolean;
  message?: string;
}

const EMOJIS = ['🎉', '🔥', '⚡', '🚀', '✨', '💪', '🏆', '🎯'];

interface Particle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  delay: number;
}

function playCelebrationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const t = ctx.currentTime;

    // Grand fanfare — ascending power chord arpeggio with harmonics
    // C4 → E4 → G4 → C5 → E5 → G5 → C6 (full octave climb)
    const fanfare = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    const stagger = 0.07;

    fanfare.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i < 3 ? 'triangle' : 'sine'; // warm base, bright top
      osc.frequency.setValueAtTime(freq, t + i * stagger);
      gain.gain.setValueAtTime(0, t + i * stagger);
      gain.gain.linearRampToValueAtTime(0.12, t + i * stagger + 0.02);
      gain.gain.setValueAtTime(0.12, t + i * stagger + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * stagger + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + i * stagger);
      osc.stop(t + i * stagger + 0.65);
    });

    // Victorious sustained chord — C5 + E5 + G5 together
    const chordFreqs = [523.25, 659.25, 783.99];
    chordFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + 0.5);
      gain.gain.setValueAtTime(0, t + 0.5);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.55);
      gain.gain.setValueAtTime(0.08, t + 0.9);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + 0.5);
      osc.stop(t + 1.7);
    });

    // High shimmer trail
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(2093.0, t + 0.55); // C7
    shimmerGain.gain.setValueAtTime(0, t + 0.55);
    shimmerGain.gain.linearRampToValueAtTime(0.03, t + 0.6);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmer.start(t + 0.55);
    shimmer.stop(t + 1.5);

    setTimeout(() => ctx.close(), 2500);
  } catch {
    // Audio not available — silently ignore
  }
}

export function CelebrationBurst({ trigger, message = 'All done!' }: CelebrationBurstProps) {
  const [show, setShow] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  // Initialize prevTrigger to current trigger value so we don't fire on mount
  const [prevTrigger, setPrevTrigger] = useState(trigger);
  const hasPlayedRef = useRef(false);

  const generateParticles = useCallback(() => {
    return Array.from({ length: 16 }, (_, i) => ({
      id: i,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      x: Math.random() * 100,
      y: Math.random() * 100,
      rotation: Math.random() * 360,
      scale: 0.6 + Math.random() * 0.8,
      delay: Math.random() * 0.3,
    }));
  }, []);

  useEffect(() => {
    // Only trigger on false→true transition
    if (trigger && !prevTrigger) {
      setParticles(generateParticles());
      setShow(true);
      if (!hasPlayedRef.current) {
        playCelebrationSound();
        hasPlayedRef.current = true;
      }
      const timer = setTimeout(() => {
        setShow(false);
        hasPlayedRef.current = false;
      }, 2800);
      return () => clearTimeout(timer);
    }
    setPrevTrigger(trigger);
  }, [trigger, prevTrigger, generateParticles]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Emoji particles */}
      {particles.map(p => (
        <span
          key={p.id}
          className="absolute animate-celebration-particle text-xl"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
            animationDelay: `${p.delay}s`,
          }}
        >
          {p.emoji}
        </span>
      ))}

      {/* Center message */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={cn(
          'px-6 py-3 rounded-2xl bg-accent/90 backdrop-blur-md shadow-lg shadow-accent/30',
          'animate-celebration-message'
        )}>
          <p className="text-base font-bold text-black tracking-tight">{message}</p>
        </div>
      </div>
    </div>
  );
}
