import type { RuleInfo, ScienceMilestone } from './types';

export const RULES: RuleInfo[] = [
  { key: 'noSnus', label: 'No Snus', emoji: '🚭', positive: false },
  { key: 'noAlcohol', label: 'No Alcohol', emoji: '🍷', positive: false },
  { key: 'noFap', label: 'NoFap', emoji: '🛡️', positive: false },
  { key: 'noJunkFood', label: 'No Junk Food', emoji: '🍔', positive: false },
  { key: 'gymDone', label: 'Gym Done', emoji: '💪', positive: true },
  { key: 'minimalScreens', label: 'Minimal Screens', emoji: '📵', positive: true },
];

export const SCIENCE_MILESTONES: ScienceMilestone[] = [
  {
    day: 1,
    title: 'The Reset Begins',
    icon: '🧬',
    description:
      'Your brain starts recognising the absence of artificial dopamine spikes. Dopamine receptor sensitivity begins its slow recalibration. The hardest cravings hit now — your nucleus accumbens is screaming for its usual fix.',
  },
  {
    day: 3,
    title: 'Withdrawal Peak',
    icon: '⚡',
    description:
      'Dopamine levels drop to their lowest. Your prefrontal cortex (willpower centre) is working overtime to override limbic urges. Irritability, brain fog, and restlessness are normal — this is your brain physically rewiring.',
  },
  {
    day: 5,
    title: 'Neuroplasticity Kicks In',
    icon: '🔄',
    description:
      'Your brain is actively pruning overused reward pathways and strengthening new ones. BDNF (brain-derived neurotrophic factor) levels are rising from exercise and clean living, accelerating neural repair.',
  },
  {
    day: 7,
    title: 'First Week Victory',
    icon: '🏆',
    description:
      'Dopamine D2 receptors are measurably upregulating. You may notice small things feel more pleasurable — music sounds better, food tastes richer. Your baseline dopamine is starting to normalise.',
  },
  {
    day: 10,
    title: 'Clarity Emerges',
    icon: '💡',
    description:
      'The prefrontal cortex regains executive control. Decision-making sharpens, impulse control improves. Your anterior cingulate cortex (conflict monitor) is less hyperactive — fewer internal battles.',
  },
  {
    day: 14,
    title: 'Two Weeks Strong',
    icon: '🧠',
    description:
      'Significant D2 receptor recovery. Natural reward sensitivity is restoring — you can feel motivation from genuine accomplishment again. Sleep quality improves as melatonin and cortisol rhythms stabilise.',
  },
  {
    day: 21,
    title: 'Habit Circuits Rewired',
    icon: '⚙️',
    description:
      'The basal ganglia (habit centre) has largely encoded your new patterns. The old cue→craving→response loops are weakening. You\'ve built genuine neural pathways for your new lifestyle.',
  },
  {
    day: 30,
    title: 'Brain Reborn',
    icon: '👑',
    description:
      'Full month of neurological recovery. Grey matter density in the prefrontal cortex is measurably increased. Dopamine homeostasis is largely restored. Your brain\'s reward system now responds properly to natural stimuli. You\'ve fundamentally changed your neurobiology.',
  },
];

export const BRAIN_INTEL: Record<number, { fact: string; warning: string }> = {
  1: {
    fact: 'Dopamine isn\'t about pleasure — it\'s about anticipation. Your brain releases it before the reward, not during.',
    warning: 'Day 1 is when 80% of people quit. Your amygdala is firing hard right now. Breathe through it.',
  },
  2: {
    fact: 'Every time you resist a craving, you physically strengthen your prefrontal cortex — the willpower muscle of your brain.',
    warning: 'Your brain will try to rationalise "just one" — this is the striatum overriding logic. Don\'t negotiate.',
  },
  3: {
    fact: 'Dopamine fasting causes a temporary dip in baseline dopamine, which is why everything feels grey. This is the reset working.',
    warning: 'Peak withdrawal. Your brain is loudest when it\'s losing control. Stay busy.',
  },
  4: {
    fact: 'Exercise releases BDNF, which acts like fertiliser for new neural connections. The gym is literally building your brain.',
    warning: 'Boredom is the #1 relapse trigger. It\'s not real boredom — it\'s your dopamine-starved brain seeking stimulation.',
  },
  5: {
    fact: 'Your D2 dopamine receptors are already beginning to upregulate — meaning natural rewards will feel more rewarding.',
    warning: 'Stress cravings spike around day 5. Your cortisol is elevated. Use it as fuel for the gym.',
  },
  6: {
    fact: 'The gut-brain axis means junk food literally affects your mood. Clean eating supports serotonin production (95% made in the gut).',
    warning: 'Social pressure peaks on weekends. Have your "no thanks" ready before someone offers.',
  },
  7: {
    fact: 'After 7 days, your brain\'s reward prediction error has recalibrated. Small wins feel genuinely satisfying again.',
    warning: 'Week 1 complete doesn\'t mean the war is won. The next test is complacency.',
  },
};

export const DEFAULT_BRAIN_INTEL = {
  fact: 'Every day of discipline adds another layer of myelin to your neural pathways, making good habits faster and more automatic.',
  warning: 'Complacency is the silent killer of streaks. Stay vigilant — your brain is always looking for an excuse.',
};
