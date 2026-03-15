import type { AppData, DayLog, RuleKey } from './types';
import { RULES } from './constants';

const STORAGE_KEY = 'brain-check-data';

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function createEmptyRules(): Record<RuleKey, boolean> {
  return Object.fromEntries(RULES.map((r) => [r.key, false])) as Record<RuleKey, boolean>;
}

export function calculateHealthScore(rules: Record<RuleKey, boolean>, streakDays: number): number {
  const rulesHeld = Object.values(rules).filter(Boolean).length;
  const ruleScore = (rulesHeld / RULES.length) * 70; // 0-70 from today's rules
  const streakBonus = Math.min(streakDays * 1.5, 30); // 0-30 from streak
  return Math.round(ruleScore + streakBonus);
}

export function getScoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Thriving';
  if (score >= 60) return 'Healing';
  if (score >= 40) return 'Rebuilding';
  if (score >= 20) return 'Struggling';
  return 'Depleted';
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupted data, reset
  }
  const initial: AppData = {
    startDate: getToday(),
    logs: {},
    notificationTime: '20:00',
    apiKey: '',
  };
  saveData(initial);
  return initial;
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getTodayLog(data: AppData): DayLog {
  const today = getToday();
  if (data.logs[today]) return data.logs[today];
  return {
    date: today,
    rules: createEmptyRules(),
    journal: '',
    healthScore: 0,
  };
}

export function saveTodayLog(data: AppData, log: DayLog): AppData {
  const updated = {
    ...data,
    logs: { ...data.logs, [log.date]: log },
  };
  saveData(updated);
  return updated;
}

export function getCurrentStreak(data: AppData): number {
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const log = data.logs[key];

    if (!log) {
      // If it's today and no log yet, skip (don't break streak)
      if (i === 0) continue;
      break;
    }

    const allHeld = Object.values(log.rules).every(Boolean);
    if (allHeld) {
      streak++;
    } else if (i === 0) {
      // Today not all held — streak for today is 0 but check if yesterday was
      continue;
    } else {
      break;
    }
  }
  return streak;
}

export function getDayNumber(data: AppData): number {
  const start = new Date(data.startDate);
  const now = new Date(getToday());
  const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

export function getRuleStreak(data: AppData, ruleKey: RuleKey): number {
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const log = data.logs[key];

    if (!log) {
      if (i === 0) continue;
      break;
    }

    if (log.rules[ruleKey]) {
      streak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

export function getLast7Days(data: AppData): DayLog[] {
  const days: DayLog[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    days.push(
      data.logs[key] || {
        date: key,
        rules: createEmptyRules(),
        journal: '',
        healthScore: 0,
      }
    );
  }
  return days;
}

export function getAllDaysSorted(data: AppData): DayLog[] {
  return Object.values(data.logs).sort((a, b) => b.date.localeCompare(a.date));
}

export { getToday };
