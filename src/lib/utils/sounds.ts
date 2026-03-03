/**
 * Task completion sounds using Web Audio API
 * No external files needed — generates tones programmatically
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioContext;
}

/**
 * Play a satisfying "ding" completion sound
 * Two-tone ascending chime — short, pleasant, non-intrusive
 */
export function playCompleteSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;

  // First tone — base note
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(800, now);
  gain1.gain.setValueAtTime(0.15, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.15);

  // Second tone — higher, slightly delayed
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1200, now + 0.08);
  gain2.gain.setValueAtTime(0, now);
  gain2.gain.setValueAtTime(0.12, now + 0.08);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.08);
  osc2.stop(now + 0.3);
}

/**
 * Play a subtle "undo" sound — descending tone
 */
/**
 * Play a triumphant completion fanfare — 4-note ascending arpeggio
 * with warm pad underneath. Used when ALL tasks for the day are done.
 * Richer and longer than the single-task chime (~1.2s total).
 */
export function playCompletionFanfare() {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;

  // Notes: C major arpeggio ascending to resolution
  const notes = [
    { freq: 523.25, time: 0, decay: 0.25 },     // C5
    { freq: 659.25, time: 0.15, decay: 0.25 },   // E5
    { freq: 783.99, time: 0.30, decay: 0.25 },   // G5
    { freq: 1046.50, time: 0.50, decay: 0.45 },   // C6 — longer sustain for resolution
  ];

  // Warm pad underneath (C3) for body
  const pad = ctx.createOscillator();
  const padGain = ctx.createGain();
  pad.type = 'sine';
  pad.frequency.setValueAtTime(130.81, now);
  padGain.gain.setValueAtTime(0.04, now);
  padGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  pad.connect(padGain);
  padGain.connect(ctx.destination);
  pad.start(now);
  pad.stop(now + 1.3);

  for (const note of notes) {
    // Sine layer — warmth
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(note.freq, now + note.time);
    gain1.gain.setValueAtTime(0, now + note.time);
    gain1.gain.linearRampToValueAtTime(0.12, now + note.time + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.decay);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now + note.time);
    osc1.stop(now + note.time + note.decay + 0.05);

    // Triangle layer — shimmer/presence
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(note.freq, now + note.time);
    gain2.gain.setValueAtTime(0, now + note.time);
    gain2.gain.linearRampToValueAtTime(0.06, now + note.time + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.decay);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + note.time);
    osc2.stop(now + note.time + note.decay + 0.05);
  }
}

/**
 * Play a subtle "undo" sound — descending tone
 */
export function playUndoSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(350, now + 0.15);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}
