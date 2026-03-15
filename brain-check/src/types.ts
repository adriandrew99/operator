export type RuleKey =
  | 'noSnus'
  | 'noAlcohol'
  | 'noFap'
  | 'noJunkFood'
  | 'gymDone'
  | 'minimalScreens';

export interface RuleInfo {
  key: RuleKey;
  label: string;
  emoji: string;
  positive: boolean; // true = doing it is good (gym), false = avoiding it is good
}

export interface DayLog {
  date: string; // YYYY-MM-DD
  rules: Record<RuleKey, boolean>;
  journal: string;
  healthScore: number;
  aiMessage?: string;
}

export interface AppData {
  startDate: string; // YYYY-MM-DD
  logs: Record<string, DayLog>;
  notificationTime: string; // HH:MM
  apiKey: string;
}

export interface ScienceMilestone {
  day: number;
  title: string;
  description: string;
  icon: string;
}
