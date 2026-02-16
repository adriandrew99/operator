export const TASK_CATEGORIES = [
  { value: 'strategy', label: 'Strategy', icon: '🧠' },
  { value: 'clients', label: 'Client Work', icon: '🤝' },
  { value: 'content', label: 'Content', icon: '🎥' },
  { value: 'personal', label: 'Personal', icon: '🏠' },
  { value: 'admin', label: 'Admin', icon: '📋' },
] as const;

export const TASK_WEIGHTS = [
  { value: 'low', label: 'Low', color: 'text-success' },
  { value: 'medium', label: 'Medium', color: 'text-warning' },
  { value: 'high', label: 'High', color: 'text-danger' },
] as const;

export const ENERGY_TYPES = [
  { value: 'admin', label: 'Admin' },
  { value: 'creative', label: 'Creative' },
] as const;

export const LEAD_STAGES = [
  { value: 'lead', label: 'Lead' },
  { value: 'conversation', label: 'Conversation' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'closed', label: 'Closed' },
  { value: 'lost', label: 'Lost' },
] as const;

export const KNOWLEDGE_TYPES = [
  { value: 'reading', label: 'Reading' },
  { value: 'idea', label: 'Idea' },
  { value: 'lesson', label: 'Lesson' },
  { value: 'quote', label: 'Quote' },
  { value: 'mental_model', label: 'Mental Model' },
  { value: 'content_hook', label: 'Content Hook' },
] as const;

export const DEFAULT_FUNDAMENTALS = [
  { label: 'Gym / Training', icon: '💪' },
  { label: 'Deep Work 90m+', icon: '🧠' },
  { label: '8k+ Steps', icon: '🚶' },
  { label: 'No Alcohol / Vices', icon: '🚫' },
  { label: 'Sleep 7h+', icon: '😴' },
  { label: 'Meaningful Social', icon: '🤝' },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: 'software', label: 'Software' },
  { value: 'hosting', label: 'Hosting' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'office', label: 'Office' },
  { value: 'travel', label: 'Travel' },
  { value: 'professional', label: 'Professional Services' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'other', label: 'Other' },
] as const;

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const MONKEY_BRAIN_RESET_SECONDS = 180;
export const MICRO_FOCUS_MINUTES = 10;
export const MAX_SECONDARY_TASKS = 3;
export const UK_CORP_TAX_RATE = 0.19;
export const UK_DIVIDEND_TAX_RATE = 0.0875; // Basic rate 8.75%
export const UK_DIVIDEND_ALLOWANCE = 1000; // £1,000 tax-free allowance
// UK 2024/25 income tax & NI thresholds
export const UK_PERSONAL_ALLOWANCE = 12570; // Annual tax-free personal allowance
export const UK_NI_PRIMARY_THRESHOLD = 12570; // Annual NI primary threshold (employee)
export const UK_NI_SECONDARY_THRESHOLD = 9100; // Annual NI secondary threshold (employer pays above this)
export const UK_NI_EMPLOYEE_RATE = 0.08; // Employee NI rate (8% from Jan 2024)
export const UK_NI_EMPLOYER_RATE = 0.138; // Employer NI rate (13.8%)
export const UK_EMPLOYMENT_ALLOWANCE = 10500; // Annual Employment Allowance (offsets employer NI)
export const UK_NI_RATE = 0.08; // Alias — employee NI rate
export const UK_BASIC_RATE = 0.20; // 20% income tax on £12,571-£50,270
export const UK_BASIC_RATE_LIMIT = 50270; // Upper limit of basic rate band (total income)
export const UK_HIGHER_RATE = 0.40; // 40% income tax above £50,270
export const UK_HIGHER_DIVIDEND_RATE = 0.3375; // 33.75% dividend tax in higher rate band

export const STAGE_PROBABILITY_DEFAULTS: Record<string, number> = {
  lead: 20,
  conversation: 40,
  proposal_sent: 70,
  closed: 100,
  lost: 0,
};

export type TaskCategory = typeof TASK_CATEGORIES[number]['value'];
export type EnergyType = typeof ENERGY_TYPES[number]['value'];
export type LeadStage = typeof LEAD_STAGES[number]['value'];
export type KnowledgeType = typeof KNOWLEDGE_TYPES[number]['value'];
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]['value'];
export type TaskWeight = typeof TASK_WEIGHTS[number]['value'];
