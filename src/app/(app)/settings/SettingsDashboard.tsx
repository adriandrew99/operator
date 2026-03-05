'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { createClient } from '@/lib/supabase/client';
import { createCustomFundamental, deleteCustomFundamental } from '@/actions/fundamentals';
import { updateMLUCapacity, updateWorkSchedule, updateFinanceSettings, saveDashboardLayout } from '@/actions/settings';
import { saveCalendarSources, testCalendarUrl } from '@/actions/external-calendar';
import type { DashboardLayoutPreferences } from '@/lib/types/dashboard-layout';
import { DEFAULT_DASHBOARD_LAYOUT, TODAY_SECTION_LABELS, ANALYTICS_SECTION_LABELS } from '@/lib/types/dashboard-layout';
import type { CalendarSource } from '@/actions/external-calendar';
import { DAILY_CAPACITY, deriveCapacityFromQuiz, suggestCapacityFromHistory } from '@/lib/utils/mental-load';
import { INTEGRATIONS } from '@/lib/integrations';
import { useRouter } from 'next/navigation';
import type { Profile, IdentityGoal, CustomFundamental } from '@/lib/types/database';
import { saveSlackWebhookUrl, testSlackWebhook, sendSlackDailySummary } from '@/actions/slack';
import { generateCalendarToken, getCalendarFeedUrl, revokeCalendarToken } from '@/actions/calendar-feed';
import { savePushSubscription, removePushSubscription, sendTestPush, createReminder, updateReminder, deleteReminder } from '@/actions/notifications';
import { subscribeToPush } from '@/lib/utils/notifications';
import type { PushSubscriptionRecord, Reminder } from '@/lib/types/database';

/* ━━━ Emoji Picker ━━━ */
const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: 'Fitness', emojis: ['💪', '🏋️', '🏃', '🧘', '🚴', '🏊', '🥊', '⚽', '🎯', '🏆'] },
  { label: 'Health', emojis: ['💧', '🥗', '🍎', '🥦', '😴', '🛌', '💊', '🧠', '❤️', '🫁'] },
  { label: 'Productivity', emojis: ['📚', '✍️', '💻', '📝', '⏰', '📈', '🎓', '🔬', '📊', '🗂️'] },
  { label: 'Mindfulness', emojis: ['🧘', '🙏', '☀️', '🌿', '🌸', '🕊️', '✨', '🌊', '🔮', '🎵'] },
  { label: 'Social', emojis: ['👥', '🤝', '💬', '📞', '🎉', '🍽️', '☕', '🫂', '👋', '💝'] },
  { label: 'General', emojis: ['✅', '⭐', '🔥', '💡', '🚀', '🎨', '📱', '🏠', '🌍', '♻️'] },
];

function EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">Emoji Icon</label>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left w-full',
            'bg-surface-secondary border-border hover:border-text-primary/20',
            open && 'border-text-primary/20 ring-1 ring-text-primary/10'
          )}
        >
          <span className="text-xl">{value || '✓'}</span>
          <span className="text-xs text-text-tertiary flex-1">Click to pick emoji</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-tertiary">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-2 left-0 w-72 max-w-[calc(100vw-2rem)] p-3 tooltip-glass rounded-xl animate-fade-in max-h-64 overflow-y-auto">
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.label} className="mb-3 last:mb-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary mb-1.5">{cat.label}</p>
              <div className="grid grid-cols-10 gap-0.5">
                {cat.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => { onChange(emoji); setOpen(false); }}
                    className={cn(
                      'w-6 h-6 flex items-center justify-center rounded-md text-base hover:bg-surface-tertiary transition-all cursor-pointer',
                      value === emoji && 'bg-surface-tertiary ring-1 ring-text-primary/20'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SettingsDashboardProps {
  profile: Profile | null;
  goals: IdentityGoal[];
  fundamentals: CustomFundamental[];
  userEmail: string;
  completionHistory?: { date: string; totalMLU: number }[];
  calendarSources?: CalendarSource[];
  dashboardLayout?: DashboardLayoutPreferences;
  slackWebhookUrl?: string | null;
  calendarFeedUrl?: string | null;
  pushSubscriptions?: import('@/lib/types/database').PushSubscriptionRecord[];
  reminders?: import('@/lib/types/database').Reminder[];
  clients?: { id: string; name: string }[];
}

export function SettingsDashboard({ profile, goals, fundamentals, userEmail, completionHistory = [], calendarSources: initialCalendarSources, dashboardLayout, slackWebhookUrl: initialSlackUrl, calendarFeedUrl: initialFeedUrl, pushSubscriptions: initialPushSubs = [], reminders: initialReminders = [], clients: initialClients = [] }: SettingsDashboardProps) {
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<IdentityGoal | null>(null);
  const [showFundamentalForm, setShowFundamentalForm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function handleSignOut() {
    supabase.auth.signOut()
      .then(() => router.push('/login'))
      .catch(e => console.error('Sign out failed:', e));
  }

  function handleGoalSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      label: form.get('label') as string,
      target_value: Number(form.get('target_value')),
      current_value: Number(form.get('current_value')) || 0,
      unit: form.get('unit') as string,
      direction: form.get('direction') as string,
    };

    setShowGoalForm(false);
    setEditingGoal(null);

    if (editingGoal) {
      Promise.resolve(
        supabase
          .from('identity_goals')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', editingGoal.id)
      ).catch(e => console.error('Failed to update goal:', e));
    } else {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          Promise.resolve(
            supabase.from('identity_goals').insert({ user_id: user.id, ...data })
          ).catch(e => console.error('Failed to create goal:', e));
        }
      });
    }
  }

  function handleDeleteGoal(id: string) {
    Promise.resolve(
      supabase.from('identity_goals').delete().eq('id', id)
    ).catch(e => console.error('Failed to delete goal:', e));
  }

  function handleUpdateCurrent(id: string, value: number) {
    Promise.resolve(
      supabase
        .from('identity_goals')
        .update({ current_value: value, updated_at: new Date().toISOString() })
        .eq('id', id)
    ).catch(e => console.error('Failed to update goal:', e));
  }

  const [fundamentalIcon, setFundamentalIcon] = useState('✓');

  function handleAddFundamental(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const label = form.get('label') as string;
    setIsPending(true);
    setShowFundamentalForm(false);
    createCustomFundamental(label, fundamentalIcon)
      .then(() => setFundamentalIcon('✓'))
      .catch(e => console.error(e))
      .finally(() => setIsPending(false));
  }

  function handleDeleteFundamental(id: string) {
    deleteCustomFundamental(id).catch(e => console.error(e));
  }

  const [activeTab, setActiveTab] = useState<'profile' | 'dashboard' | 'finance' | 'integrations'>('profile');

  const settingsTabs = [
    { key: 'profile' as const, label: 'Profile', icon: '👤' },
    { key: 'dashboard' as const, label: 'Dashboard', icon: '📊' },
    { key: 'finance' as const, label: 'Finance', icon: '💰' },
    { key: 'integrations' as const, label: 'Integrations', icon: '🔗' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Settings</h1>
        <p className="text-sm text-text-tertiary mt-0.5">Configure your workspace, integrations, and preferences</p>
      </div>

      {/* ━━━ Desktop: Vertical sidebar tabs + content ━━━ */}
      <div className="hidden md:flex gap-6">
        {/* Sidebar nav */}
        <nav className="w-[200px] flex-shrink-0 space-y-1">
          {settingsTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-left cursor-pointer',
                activeTab === tab.key
                  ? 'bg-surface-tertiary text-text-primary'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary/50'
              )}
            >
              <span className="text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content panel */}
        <div className="flex-1 min-w-0 space-y-8">
          {activeTab === 'profile' && (
            <>
              {/* Account */}
              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Account</p>
                <Card>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-surface-tertiary flex items-center justify-center">
                        <span className="text-text-primary text-sm font-bold">
                          {(profile?.full_name || 'O').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-text-primary font-medium">{profile?.full_name || 'Operator'}</p>
                        <p className="text-xs text-text-tertiary">{userEmail}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={handleSignOut}>
                      Sign Out
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Identity Goals */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                    I Am Building Toward
                  </p>
                  <Button size="sm" onClick={() => { setEditingGoal(null); setShowGoalForm(true); }}>
                    Add Goal
                  </Button>
                </div>

                {goals.length === 0 ? (
                  <p className="text-center text-sm text-text-tertiary py-8">
                    Define your identity goals. Data, not fluff.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {goals.map((goal) => {
                      const progress = goal.direction === 'up'
                        ? (Number(goal.current_value) / Number(goal.target_value)) * 100
                        : ((Number(goal.target_value) - Number(goal.current_value)) / Number(goal.target_value)) * 100;
                      const distance = goal.direction === 'up'
                        ? Number(goal.target_value) - Number(goal.current_value)
                        : Number(goal.current_value) - Number(goal.target_value);

                      return (
                        <div
                          key={goal.id}
                          className="bg-surface-secondary border border-border rounded-2xl p-5 group hover:border-border-light transition-colors"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-text-primary">{goal.label}</p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setEditingGoal(goal); setShowGoalForm(true); }}
                                className="opacity-0 group-hover:opacity-100 text-xs text-text-tertiary hover:text-text-primary transition-all"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteGoal(goal.id)}
                                className="opacity-0 group-hover:opacity-100 text-xs text-text-tertiary hover:text-danger transition-all"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <ProgressBar
                            value={Math.max(0, Math.min(100, progress))}
                            max={100}
                            showPercentage={false}
                            size="sm"
                          />
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-text-secondary">
                              {Number(goal.current_value)} / {Number(goal.target_value)} {goal.unit}
                            </span>
                            <span className={cn(
                              'text-xs font-medium',
                              distance <= 0 ? 'text-success' : 'text-text-tertiary'
                            )}>
                              {distance <= 0 ? 'Achieved' : `${Math.abs(distance).toLocaleString()} ${goal.unit} to go`}
                            </span>
                          </div>
                          <div className="mt-3">
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={Number(goal.current_value)}
                              onBlur={(e) => handleUpdateCurrent(goal.id, Number(e.target.value))}
                              className="w-28 bg-surface-tertiary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-text-primary/20 transition-colors"
                              placeholder="Current"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'dashboard' && (
            <>
              {/* Daily Fundamentals */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                    Daily Fundamentals
                  </p>
                  <Button size="sm" onClick={() => setShowFundamentalForm(true)}>
                    Add
                  </Button>
                </div>
                <p className="text-xs text-text-secondary">
                  These are the daily habits you track on your Today page. Add, remove, or rename them.
                </p>

                {fundamentals.length === 0 ? (
                  <p className="text-center text-sm text-text-tertiary py-6">
                    No fundamentals defined. Add your daily non-negotiables.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {fundamentals.map((f) => (
                      <div
                        key={f.id}
                        className="bg-surface-secondary border border-border rounded-2xl px-4 py-3 hover:border-border-light transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base">{f.icon}</span>
                          <span className="text-sm text-text-primary">{f.label}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteFundamental(f.id)}
                          className="opacity-0 group-hover:opacity-100 text-xs text-text-tertiary hover:text-danger transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mental Load Capacity */}
              <MentalLoadSection
                currentCapacity={profile?.daily_mlu_capacity ?? null}
                completionHistory={completionHistory}
              />

              {/* Dashboard Layout */}
              <DashboardLayoutSection initialLayout={dashboardLayout || DEFAULT_DASHBOARD_LAYOUT} />
            </>
          )}

          {activeTab === 'finance' && (
            <>
              {/* Finance Settings */}
              <FinanceSettingsSection profile={profile} />

              {/* Work Schedule */}
              <WorkScheduleSection profile={profile} />
            </>
          )}

          {activeTab === 'integrations' && (
            <>
              {/* Calendar Integration */}
              <CalendarSection initialSources={initialCalendarSources || []} />

              {/* Slack Integration */}
              <SlackSection initialWebhookUrl={initialSlackUrl || null} />

              {/* Calendar Feed (Outgoing) */}
              <CalendarFeedSection initialFeedUrl={initialFeedUrl || null} />

              {/* Integrations */}
              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                  Integrations
                </p>
                <p className="text-xs text-text-secondary">
                  Connect external tools to auto-import tasks and financial data.
                </p>
                <div className="space-y-2">
                  {INTEGRATIONS.map((integration) => (
                    <div
                      key={integration.id}
                      className="bg-surface-secondary border border-border rounded-2xl px-4 py-3 hover:border-border-light transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{integration.icon}</span>
                        <div>
                          <p className="text-sm text-text-primary font-medium">{integration.name}</p>
                          <p className="text-xs text-text-tertiary">{integration.description}</p>
                        </div>
                      </div>
                      {integration.status === 'available' ? (
                        <Button size="sm" variant="secondary" onClick={() => alert(`${integration.name} setup coming soon. Add your API key in .env.local.`)}>
                          Connect
                        </Button>
                      ) : (
                        <span className="text-xs text-text-tertiary ">Coming Soon</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ━━━ Mobile: Horizontal TabBar + content ━━━ */}
      <div className="md:hidden space-y-6">
        <div className="flex overflow-x-auto scrollbar-none gap-1 bg-surface-secondary border border-border rounded-xl p-1">
          {settingsTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              title={tab.label}
              className={cn(
                'flex items-center gap-1 px-3 py-2 text-xs font-medium whitespace-nowrap transition-all rounded-lg flex-shrink-0',
                activeTab === tab.key
                  ? 'bg-surface-tertiary text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              <span className="text-xs">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-8">
          {activeTab === 'profile' && (
            <>
              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Account</p>
                <Card>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-surface-tertiary flex items-center justify-center">
                        <span className="text-text-primary text-sm font-bold">
                          {(profile?.full_name || 'O').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-text-primary font-medium">{profile?.full_name || 'Operator'}</p>
                        <p className="text-xs text-text-tertiary">{userEmail}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={handleSignOut}>
                      Sign Out
                    </Button>
                  </div>
                </Card>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">I Am Building Toward</p>
                  <Button size="sm" onClick={() => { setEditingGoal(null); setShowGoalForm(true); }}>Add Goal</Button>
                </div>
                {goals.length === 0 ? (
                  <p className="text-center text-sm text-text-tertiary py-8">Define your identity goals. Data, not fluff.</p>
                ) : (
                  <div className="space-y-2">
                    {goals.map((goal) => {
                      const progress = goal.direction === 'up'
                        ? (Number(goal.current_value) / Number(goal.target_value)) * 100
                        : ((Number(goal.target_value) - Number(goal.current_value)) / Number(goal.target_value)) * 100;
                      const distance = goal.direction === 'up'
                        ? Number(goal.target_value) - Number(goal.current_value)
                        : Number(goal.current_value) - Number(goal.target_value);
                      return (
                        <div key={goal.id} className="bg-surface-secondary border border-border rounded-2xl p-5 group hover:border-border-light transition-colors">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-text-primary">{goal.label}</p>
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setEditingGoal(goal); setShowGoalForm(true); }} className="opacity-0 group-hover:opacity-100 text-xs text-text-tertiary hover:text-text-primary transition-all">Edit</button>
                              <button onClick={() => handleDeleteGoal(goal.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-tertiary hover:text-danger transition-all">Delete</button>
                            </div>
                          </div>
                          <ProgressBar value={Math.max(0, Math.min(100, progress))} max={100} showPercentage={false} size="sm" />
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-text-secondary">{Number(goal.current_value)} / {Number(goal.target_value)} {goal.unit}</span>
                            <span className={cn('text-xs font-medium', distance <= 0 ? 'text-success' : 'text-text-tertiary')}>
                              {distance <= 0 ? 'Achieved' : `${Math.abs(distance).toLocaleString()} ${goal.unit} to go`}
                            </span>
                          </div>
                          <div className="mt-3">
                            <input type="number" step="0.01" defaultValue={Number(goal.current_value)} onBlur={(e) => handleUpdateCurrent(goal.id, Number(e.target.value))} className="w-28 bg-surface-tertiary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-text-primary/20 transition-colors" placeholder="Current" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'dashboard' && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Daily Fundamentals</p>
                  <Button size="sm" onClick={() => setShowFundamentalForm(true)}>Add</Button>
                </div>
                <p className="text-xs text-text-secondary">These are the daily habits you track on your Today page.</p>
                {fundamentals.length === 0 ? (
                  <p className="text-center text-sm text-text-tertiary py-6">No fundamentals defined. Add your daily non-negotiables.</p>
                ) : (
                  <div className="space-y-2">
                    {fundamentals.map((f) => (
                      <div key={f.id} className="bg-surface-secondary border border-border rounded-2xl px-4 py-3 hover:border-border-light transition-colors flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <span className="text-base">{f.icon}</span>
                          <span className="text-sm text-text-primary">{f.label}</span>
                        </div>
                        <button onClick={() => handleDeleteFundamental(f.id)} className="opacity-0 group-hover:opacity-100 text-xs text-text-tertiary hover:text-danger transition-all">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <MentalLoadSection currentCapacity={profile?.daily_mlu_capacity ?? null} completionHistory={completionHistory} />
              <DashboardLayoutSection initialLayout={dashboardLayout || DEFAULT_DASHBOARD_LAYOUT} />
            </>
          )}

          {activeTab === 'finance' && (
            <>
              <FinanceSettingsSection profile={profile} />
              <WorkScheduleSection profile={profile} />
            </>
          )}

          {activeTab === 'integrations' && (
            <>
              <NotificationsSection initialPushSubs={initialPushSubs} initialReminders={initialReminders} clients={initialClients} />
              <CalendarSection initialSources={initialCalendarSources || []} />
              <SlackSection initialWebhookUrl={initialSlackUrl || null} />
              <CalendarFeedSection initialFeedUrl={initialFeedUrl || null} />
              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Integrations</p>
                <p className="text-xs text-text-secondary">Connect external tools to auto-import tasks and financial data.</p>
                <div className="space-y-2">
                  {INTEGRATIONS.map((integration) => (
                    <div key={integration.id} className="bg-surface-secondary border border-border rounded-2xl px-4 py-3 hover:border-border-light transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{integration.icon}</span>
                        <div>
                          <p className="text-sm text-text-primary font-medium">{integration.name}</p>
                          <p className="text-xs text-text-tertiary">{integration.description}</p>
                        </div>
                      </div>
                      {integration.status === 'available' ? (
                        <Button size="sm" variant="secondary" onClick={() => alert(`${integration.name} setup coming soon.`)}>Connect</Button>
                      ) : (
                        <span className="text-xs text-text-tertiary ">Coming Soon</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Goal Form Modal */}
      <Modal open={showGoalForm} onClose={() => { setShowGoalForm(false); setEditingGoal(null); }} title={editingGoal ? 'Edit Goal' : 'Add Identity Goal'}>
        <form onSubmit={handleGoalSubmit} className="space-y-4">
          <Input name="label" label="Goal Label" required defaultValue={editingGoal?.label || ''} placeholder="e.g., Monthly Revenue, Body Weight" />
          <Input name="target_value" label="Target Value" type="number" step="0.01" required defaultValue={editingGoal?.target_value ?? ''} />
          <Input name="current_value" label="Current Value" type="number" step="0.01" defaultValue={editingGoal?.current_value ?? 0} />
          <Input name="unit" label="Unit" required defaultValue={editingGoal?.unit || ''} placeholder="GBP, lbs, subs, %" />
          <Select
            name="direction"
            label="Direction"
            options={[
              { value: 'up', label: 'Higher is better' },
              { value: 'down', label: 'Lower is better' },
            ]}
            defaultValue={editingGoal?.direction || 'up'}
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => { setShowGoalForm(false); setEditingGoal(null); }}>Cancel</Button>
            <Button type="submit">{editingGoal ? 'Update' : 'Add Goal'}</Button>
          </div>
        </form>
      </Modal>

      {/* Fundamental Form Modal */}
      <Modal open={showFundamentalForm} onClose={() => { setShowFundamentalForm(false); setFundamentalIcon('✓'); }} title="Add Fundamental">
        <form onSubmit={handleAddFundamental} className="space-y-4">
          <Input name="label" label="Habit Name" required placeholder="e.g., Meditate 10 min, Read 30 min" />
          <EmojiPicker value={fundamentalIcon} onChange={setFundamentalIcon} />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => { setShowFundamentalForm(false); setFundamentalIcon('✓'); }}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Adding...' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ━━━ Mental Load Capacity Section ━━━ */
function MentalLoadSection({
  currentCapacity,
  completionHistory,
}: {
  currentCapacity: number | null;
  completionHistory: { date: string; totalMLU: number }[];
}) {
  const effectiveCapacity = currentCapacity ?? DAILY_CAPACITY;
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizHigh, setQuizHigh] = useState(2);
  const [quizMed, setQuizMed] = useState(4);
  const [quizLow, setQuizLow] = useState(10);
  const [saving, setSaving] = useState(false);

  const derivedCapacity = deriveCapacityFromQuiz(quizHigh, quizMed, quizLow);
  const suggestedCapacity = suggestCapacityFromHistory(completionHistory);

  // Only show history nudge if suggestion differs by ±3 from current
  const showHistoryNudge = suggestedCapacity !== null && Math.abs(suggestedCapacity - effectiveCapacity) >= 3;

  function handleSaveCapacity(capacity: number) {
    setSaving(true);
    updateMLUCapacity(capacity)
      .catch(e => console.error('Failed to save MLU capacity:', e))
      .finally(() => {
        setSaving(false);
        setShowQuiz(false);
      });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
          Mental Load
        </p>
        <Button size="sm" onClick={() => setShowQuiz(!showQuiz)}>
          {showQuiz ? 'Cancel' : currentCapacity ? 'Recalibrate' : 'Calibrate'}
        </Button>
      </div>
      <p className="text-xs text-text-secondary">
        Your daily Mental Load Unit (MLU) capacity determines when the overload warning appears on your Today page.
      </p>

      {/* Current capacity display */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-primary font-medium">Daily Capacity</p>
            <p className="text-xs text-text-tertiary mt-0.5">
              {currentCapacity ? 'Calibrated' : 'Using default'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-text-primary font-mono">{effectiveCapacity}</p>
            <p className="text-xs text-text-tertiary">MLU / day</p>
          </div>
        </div>
      </Card>

      {/* History-based suggestion nudge */}
      {showHistoryNudge && !showQuiz && (
        <div className="px-4 py-3 rounded-xl bg-surface-tertiary border border-border animate-fade-in space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-primary font-medium">
                Your natural capacity looks like ~{suggestedCapacity} MLU/day.
              </p>
              <p className="text-xs text-text-tertiary mt-0.5">
                Based on your typical working day load (tasks + dailies) over the last 30 days.
                {' '}{suggestedCapacity! > effectiveCapacity ? 'You might be able to handle more.' : 'You might be pushing too hard.'}
              </p>
            </div>
            <button
              onClick={() => handleSaveCapacity(suggestedCapacity!)}
              disabled={saving}
              className="text-xs text-text-primary font-medium hover:text-text-secondary transition-colors px-3 py-1.5 rounded-lg bg-surface-tertiary hover:bg-surface-tertiary flex-shrink-0 cursor-pointer disabled:opacity-50"
            >
              {saving ? '...' : 'Apply'}
            </button>
          </div>
          {/* Breakdown for transparency */}
          <div className="flex items-center gap-3 text-xs text-text-tertiary pt-1 border-t border-border/50">
            <span>{completionHistory.filter(d => d.totalMLU >= 5).length} working days sampled</span>
            <span>·</span>
            <span>75th percentile of daily load</span>
          </div>
        </div>
      )}

      {/* Calibration quiz */}
      {showQuiz && (
        <div className="p-4 rounded-xl bg-surface-tertiary border border-border space-y-4 animate-fade-in">
          <p className="text-xs text-text-secondary leading-relaxed">
            Answer these 3 questions to calculate your personal daily capacity. Think about a realistic productive day, not your absolute max.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-tertiary font-medium ">
                High-weight tasks per day
              </label>
              <p className="text-xs text-text-tertiary/70 mb-1.5">Complex, demanding work that needs deep focus</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setQuizHigh(n)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
                      quizHigh === n
                        ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
                        : 'bg-surface-secondary text-text-tertiary hover:text-text-secondary'
                    )}
                  >
                    {n}{n === 4 ? '+' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-text-tertiary font-medium ">
                Medium tasks on top of that
              </label>
              <p className="text-xs text-text-tertiary/70 mb-1.5">Regular work — emails, calls, standard deliverables</p>
              <div className="flex gap-1.5">
                {[2, 4, 6, 8].map(n => (
                  <button
                    key={n}
                    onClick={() => setQuizMed(n)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
                      quizMed === n
                        ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
                        : 'bg-surface-secondary text-text-tertiary hover:text-text-secondary'
                    )}
                  >
                    {n}{n === 8 ? '+' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-text-tertiary font-medium ">
                Small admin tasks
              </label>
              <p className="text-xs text-text-tertiary/70 mb-1.5">Quick tasks — Slack replies, invoice checks, scheduling</p>
              <div className="flex gap-1.5">
                {[5, 10, 15, 20].map(n => (
                  <button
                    key={n}
                    onClick={() => setQuizLow(n)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
                      quizLow === n
                        ? 'bg-surface-tertiary text-text-primary ring-1 ring-text-primary/20'
                        : 'bg-surface-secondary text-text-tertiary hover:text-text-secondary'
                    )}
                  >
                    {n}{n === 20 ? '+' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-text-primary font-medium">Your capacity: <span className="text-text-primary font-mono">{derivedCapacity} MLU</span></p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {quizHigh} high ({quizHigh * 4} MLU) + {quizMed} medium ({quizMed * 2} MLU) + {quizLow} low ({quizLow * 0.5} MLU)
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => handleSaveCapacity(derivedCapacity)}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ━━━ Work Schedule Section ━━━ */
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function WorkScheduleSection({ profile }: { profile: Profile | null }) {
  const [startHour, setStartHour] = useState(String(profile?.work_start_hour ?? 9));
  const [endHour, setEndHour] = useState(String(profile?.work_end_hour ?? 17));
  const [workDays, setWorkDays] = useState<number[]>(profile?.work_days ?? [1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);

  function toggleDay(day: number) {
    setWorkDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
  }

  function handleSave() {
    setSaving(true);
    updateWorkSchedule({
      work_start_hour: Number(startHour),
      work_end_hour: Number(endHour),
      work_days: workDays,
    })
      .catch(e => console.error('Failed to save work schedule:', e))
      .finally(() => setSaving(false));
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Work Schedule</p>
      <div className="bg-surface-secondary border border-border rounded-2xl p-5 space-y-4">
        <p className="text-xs text-text-tertiary">Auto-schedule will only place tasks within these hours and days.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Start hour</label>
            <select value={startHour} onChange={e => setStartHour(e.target.value)}
              className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary cursor-pointer">
              {Array.from({ length: 16 }, (_, i) => i + 5).map(h => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">End hour</label>
            <select value={endHour} onChange={e => setEndHour(e.target.value)}
              className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary cursor-pointer">
              {Array.from({ length: 16 }, (_, i) => i + 8).map(h => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-text-secondary mb-2 block">Work days</label>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((label, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                className={cn(
                  'px-2.5 py-1.5 text-xs rounded-lg transition-all cursor-pointer',
                  workDays.includes(i) ? 'bg-surface-tertiary text-text-primary border border-text-primary/20' : 'bg-surface-secondary text-text-tertiary hover:text-text-secondary'
                )}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Schedule'}</Button>
        </div>
      </div>
    </div>
  );
}

/* ━━━ Calendar Section (multi-calendar) ━━━ */
const CAL_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];

function CalendarSection({ initialSources }: { initialSources: CalendarSource[] }) {
  const [sources, setSources] = useState<CalendarSource[]>(initialSources);
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

  function addCalendar() {
    const nextColor = CAL_COLORS[sources.length % CAL_COLORS.length];
    setSources(prev => [...prev, {
      id: `cal-${Date.now()}`,
      label: '',
      url: '',
      color: nextColor,
      enabled: true,
    }]);
  }

  function updateSource(id: string, updates: Partial<CalendarSource>) {
    setSources(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    setTestResults(prev => { const copy = { ...prev }; delete copy[id]; return copy; });
  }

  function removeSource(id: string) {
    setSources(prev => prev.filter(s => s.id !== id));
    setTestResults(prev => { const copy = { ...prev }; delete copy[id]; return copy; });
  }

  async function handleSave() {
    // Filter out empty entries
    const valid = sources.filter(s => s.url.trim());
    // Default labels
    const labelled = valid.map((s, i) => ({
      ...s,
      label: s.label.trim() || `Calendar ${i + 1}`,
      url: s.url.trim(),
    }));

    setSaving(true);
    try {
      await saveCalendarSources(labelled);
      setSources(labelled);
      // Auto-test all
      for (const s of labelled) {
        handleTest(s.id, s.url);
      }
    } catch (e) {
      console.error('Failed to save calendars:', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(id: string, url: string) {
    setTestingIds(prev => new Set(prev).add(id));
    try {
      const result = await testCalendarUrl(url);
      setTestResults(prev => ({ ...prev, [id]: result }));
    } catch {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, message: 'Test failed' } }));
    } finally {
      setTestingIds(prev => { const copy = new Set(prev); copy.delete(id); return copy; });
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Calendars</p>
      <div className="bg-surface-secondary border border-border rounded-2xl p-5 space-y-4">
        <div>
          <p className="text-xs text-text-secondary mb-1">
            Add your calendars&apos; iCal/ICS URLs to see events on your Today page.
          </p>
          <p className="text-xs text-text-tertiary leading-relaxed">
            <strong>Google:</strong> Settings → Settings for my calendar → Secret address in iCal format.{' '}
            <strong>Outlook:</strong> Calendar Settings → Shared calendars → Publish a calendar → ICS.{' '}
            <strong>Apple:</strong> Calendar → Share → Public Calendar → Copy Link.
          </p>
        </div>

        {/* Calendar list */}
        <div className="space-y-3">
          {sources.map((source) => (
            <div key={source.id} className="space-y-2">
              <div className="flex items-center gap-2">
                {/* Colour dot (click to cycle) */}
                <button
                  type="button"
                  onClick={() => {
                    const idx = CAL_COLORS.indexOf(source.color);
                    updateSource(source.id, { color: CAL_COLORS[(idx + 1) % CAL_COLORS.length] });
                  }}
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/10 transition-transform hover:scale-125"
                  style={{ backgroundColor: source.color }}
                  title="Click to change colour"
                />
                {/* Label */}
                <input
                  type="text"
                  value={source.label}
                  onChange={(e) => updateSource(source.id, { label: e.target.value })}
                  placeholder="Label (e.g. Work)"
                  className="w-28 bg-surface-tertiary border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary/40 outline-none focus:border-text-primary/20 transition-all"
                />
                {/* URL */}
                <input
                  type="url"
                  value={source.url}
                  onChange={(e) => updateSource(source.id, { url: e.target.value })}
                  placeholder="https://calendar.google.com/calendar/ical/..."
                  className="flex-1 bg-surface-tertiary border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary/40 outline-none focus:border-text-primary/20 transition-all font-mono"
                />
                {/* Toggle enabled */}
                <button
                  type="button"
                  onClick={() => updateSource(source.id, { enabled: !source.enabled })}
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded transition-colors flex-shrink-0',
                    source.enabled ? 'text-text-primary bg-surface-tertiary' : 'text-text-tertiary bg-surface-tertiary'
                  )}
                  title={source.enabled ? 'Disable calendar' : 'Enable calendar'}
                >
                  {source.enabled ? 'ON' : 'OFF'}
                </button>
                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeSource(source.id)}
                  className="text-text-tertiary hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove calendar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
              {/* Test result for this calendar */}
              {(testingIds.has(source.id) || testResults[source.id]) && (
                <div className="ml-5 flex items-center gap-1">
                  {testingIds.has(source.id) ? (
                    <p className="text-xs text-text-tertiary flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 border border-text-tertiary/30 border-t-accent rounded-full animate-spin" />
                      Testing...
                    </p>
                  ) : testResults[source.id] ? (
                    <p className={`text-xs flex items-center gap-1 ${testResults[source.id].ok ? 'text-text-primary' : 'text-red-400'}`}>
                      {testResults[source.id].ok ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                      )}
                      {testResults[source.id].message}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addCalendar}
            className="text-xs text-text-secondary hover:text-text-primary font-medium flex items-center gap-1 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add calendar
          </button>
          <div className="flex-1" />
          {sources.length > 0 && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ━━━ Dashboard Layout Section ━━━ */
function DashboardLayoutSection({ initialLayout }: { initialLayout: DashboardLayoutPreferences }) {
  const [layout, setLayout] = useState<DashboardLayoutPreferences>(initialLayout);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  function toggleToday(key: keyof DashboardLayoutPreferences['today']) {
    setLayout(prev => ({
      ...prev,
      today: { ...prev.today, [key]: !prev.today[key] },
    }));
    setSaved(false);
  }

  function toggleAnalytics(key: string) {
    setLayout(prev => ({
      ...prev,
      analytics: { ...prev.analytics, [key]: !(prev.analytics as Record<string, boolean>)[key] },
    }));
    setSaved(false);
  }

  function handleSave() {
    setSaving(true);
    saveDashboardLayout(layout)
      .then(() => setSaved(true))
      .catch(e => console.error('Failed to save dashboard layout:', e))
      .finally(() => setSaving(false));
  }

  const todayKeys = Object.keys(TODAY_SECTION_LABELS) as Array<keyof DashboardLayoutPreferences['today']>;
  const analyticsKeys = Object.keys(ANALYTICS_SECTION_LABELS) as Array<string>;

  const todayOnCount = todayKeys.filter(k => layout.today[k]).length;
  const analyticsOnCount = analyticsKeys.filter(k => (layout.analytics as Record<string, boolean>)[k]).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
          Dashboard Layout
        </p>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-text-primary animate-fade-in">Saved</span>}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Layout'}
          </Button>
        </div>
      </div>
      <div className="bg-surface-secondary border border-border rounded-2xl overflow-hidden">
        <p className="text-xs text-text-tertiary px-5 pt-4 pb-2">
          Show or hide sections on your dashboard pages. Today&apos;s Plan is always visible.
        </p>

        {/* Today Page — collapsible */}
        <button
          type="button"
          onClick={() => setTodayOpen(!todayOpen)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-tertiary transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={cn('text-text-tertiary transition-transform', todayOpen && 'rotate-90')}>
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span className="text-xs font-medium text-text-secondary">Today</span>
          </div>
          <span className="text-xs text-text-tertiary">{todayOnCount}/{todayKeys.length} visible</span>
        </button>
        {todayOpen && (
          <div className="px-3 pb-3 space-y-1.5 animate-fade-in">
            {todayKeys.map(key => (
              <ToggleRow
                key={key}
                label={TODAY_SECTION_LABELS[key]}
                enabled={layout.today[key]}
                onToggle={() => toggleToday(key)}
              />
            ))}
          </div>
        )}

        {/* Analytics Page — collapsible */}
        <button
          type="button"
          onClick={() => setAnalyticsOpen(!analyticsOpen)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-tertiary transition-colors cursor-pointer border-t border-border"
        >
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={cn('text-text-tertiary transition-transform', analyticsOpen && 'rotate-90')}>
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span className="text-xs font-medium text-text-secondary">Analytics</span>
          </div>
          <span className="text-xs text-text-tertiary">{analyticsOnCount}/{analyticsKeys.length} visible</span>
        </button>
        {analyticsOpen && (
          <div className="px-3 pb-3 space-y-1.5 animate-fade-in">
            {analyticsKeys.map(key => (
              <ToggleRow
                key={key}
                label={ANALYTICS_SECTION_LABELS[key]}
                enabled={(layout.analytics as Record<string, boolean>)[key] ?? true}
                onToggle={() => toggleAnalytics(key)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-tertiary transition-colors">
      <span className="text-xs text-text-primary">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 cursor-pointer',
          enabled ? 'bg-text-primary' : 'bg-surface-tertiary border border-border'
        )}
      >
        <span className={cn(
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200',
          enabled && 'translate-x-4'
        )} />
      </button>
    </div>
  );
}

/* ━━━ Finance Settings Section ━━━ */
function FinanceSettingsSection({ profile }: { profile: Profile | null }) {
  const [salary, setSalary] = useState(String(profile?.monthly_salary ?? 0));
  const [staff, setStaff] = useState(String(profile?.staff_cost ?? 0));
  const [saving, setSaving] = useState(false);

  function handleSave() {
    setSaving(true);
    updateFinanceSettings({
      monthly_salary: Number(salary) || 0,
      staff_cost: Number(staff) || 0,
    })
      .catch(e => console.error('Failed to save finance settings:', e))
      .finally(() => setSaving(false));
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Finance</p>
      <div className="bg-surface-secondary border border-border rounded-2xl p-5 space-y-4">
        <p className="text-xs text-text-tertiary">Monthly salary and staff costs are factored into your Finance dashboard P&L calculations.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Your Monthly Salary (GBP)" type="number" step="0.01" value={salary} onChange={e => setSalary(e.target.value)} />
          <Input label="Staff / Contractor Cost (GBP)" type="number" step="0.01" value={staff} onChange={e => setStaff(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}

/* ━━━ Slack Integration Section ━━━ */
function SlackSection({ initialWebhookUrl }: { initialWebhookUrl: string | null }) {
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const isConnected = !!initialWebhookUrl;

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      await saveSlackWebhookUrl(webhookUrl.trim());
      setStatus({ ok: true, message: webhookUrl.trim() ? 'Webhook URL saved.' : 'Webhook URL removed.' });
    } catch (e) {
      setStatus({ ok: false, message: e instanceof Error ? e.message : 'Failed to save.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!webhookUrl.trim()) {
      setStatus({ ok: false, message: 'Enter a webhook URL first.' });
      return;
    }
    setTesting(true);
    setStatus(null);
    try {
      const result = await testSlackWebhook(webhookUrl.trim());
      setStatus(result);
    } catch {
      setStatus({ ok: false, message: 'Test failed.' });
    } finally {
      setTesting(false);
    }
  }

  async function handleSendNow() {
    setSending(true);
    setStatus(null);
    try {
      await sendSlackDailySummary();
      setStatus({ ok: true, message: 'Daily summary sent to Slack.' });
    } catch (e) {
      setStatus({ ok: false, message: e instanceof Error ? e.message : 'Failed to send summary.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
          Slack Daily Summary
        </p>
        {isConnected && (
          <span className="flex items-center gap-1.5 text-xs text-text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-text-primary" />
            Connected
          </span>
        )}
      </div>
      <div className="bg-surface-secondary border border-border rounded-2xl p-5 space-y-4">
        <p className="text-xs text-text-secondary">
          Receive a daily task summary in Slack. Create an{' '}
          <a
            href="https://api.slack.com/messaging/webhooks"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text-primary underline underline-offset-2"
          >
            Incoming Webhook
          </a>
          {' '}in your Slack workspace and paste the URL below.
        </p>

        <div className="flex gap-2">
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => { setWebhookUrl(e.target.value); setStatus(null); }}
            placeholder="https://hooks.slack.com/services/..."
            className="flex-1 bg-surface-tertiary border border-border rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary/40 outline-none focus:border-text-primary/20 transition-all font-mono"
          />
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={handleTest} disabled={testing || !webhookUrl.trim()}>
            {testing ? 'Testing...' : 'Test Webhook'}
          </Button>
          {isConnected && (
            <Button size="sm" variant="secondary" onClick={handleSendNow} disabled={sending}>
              {sending ? 'Sending...' : 'Send Summary Now'}
            </Button>
          )}
        </div>

        {status && (
          <p className={cn(
            'text-xs flex items-center gap-1.5',
            status.ok ? 'text-text-primary' : 'text-red-400'
          )}>
            {status.ok ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            )}
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}

/* ━━━ Calendar Feed (Outgoing) Section ━━━ */
function CalendarFeedSection({ initialFeedUrl }: { initialFeedUrl: string | null }) {
  const [feedUrl, setFeedUrl] = useState(initialFeedUrl || '');
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasToken = !!feedUrl;

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      await generateCalendarToken();
      const url = await getCalendarFeedUrl();
      setFeedUrl(url || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate feed URL.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    setError(null);
    try {
      await revokeCalendarToken();
      setFeedUrl('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke token.');
    } finally {
      setRevoking(false);
    }
  }

  function handleCopy() {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback: select text in a temporary input
      const input = document.createElement('input');
      input.value = feedUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
          Calendar Feed
        </p>
        {hasToken && (
          <span className="flex items-center gap-1.5 text-xs text-text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-text-primary" />
            Active
          </span>
        )}
      </div>
      <div className="bg-surface-secondary border border-border rounded-2xl p-5 space-y-4">
        <p className="text-xs text-text-secondary">
          Subscribe to your Nexus tasks from any calendar app. This feed includes today&apos;s flagged tasks, upcoming deadlines (14 days), and recurring tasks.
        </p>

        {hasToken ? (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={feedUrl}
                readOnly
                className="flex-1 bg-surface-tertiary border border-border rounded-xl px-3 py-2 text-xs text-text-primary font-mono select-all outline-none"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button size="sm" variant="secondary" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Regenerating...' : 'Regenerate URL'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleRevoke} disabled={revoking}>
                {revoking ? 'Revoking...' : 'Revoke Access'}
              </Button>
            </div>

            <p className="text-xs text-text-tertiary leading-relaxed">
              Add this URL to Google Calendar, Apple Calendar, or any calendar app that supports iCal subscriptions. Regenerating will invalidate the previous URL.
            </p>
          </>
        ) : (
          <>
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating...' : 'Generate Feed URL'}
            </Button>
            <p className="text-xs text-text-tertiary leading-relaxed">
              Generate a unique URL to subscribe to your Nexus tasks from Google Calendar, Apple Calendar, or any app that supports iCal subscriptions.
            </p>
          </>
        )}

        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/* ━━━ Notifications & Reminders Section ━━━ */
const REMINDER_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REMINDER_HOUR_OPTIONS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am-10pm

function NotificationsSection({ initialPushSubs, initialReminders, clients = [] }: { initialPushSubs: PushSubscriptionRecord[]; initialReminders: Reminder[]; clients?: { id: string; name: string }[] }) {
  const [pushSubs, setPushSubs] = useState(initialPushSubs);
  const [reminders, setReminders] = useState(initialReminders);
  const [enabling, setEnabling] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [showAddReminder, setShowAddReminder] = useState(false);

  // Add reminder form state
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(13);
  const [newDays, setNewDays] = useState([1, 2, 3, 4, 5]); // weekdays
  const [addingReminder, setAddingReminder] = useState(false);

  async function handleEnablePush() {
    setEnabling(true);
    setStatus(null);
    try {
      const sub = await subscribeToPush();
      if (!sub || !sub.endpoint || !sub.keys) {
        setStatus({ ok: false, message: 'Push subscription failed. Check browser permissions.' });
        return;
      }
      const result = await savePushSubscription({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh!, auth: sub.keys.auth! },
        userAgent: navigator.userAgent,
      });
      if (result.success) {
        setPushSubs(prev => [...prev, { id: '', user_id: '', endpoint: sub.endpoint!, keys_p256dh: sub.keys!.p256dh!, keys_auth: sub.keys!.auth!, user_agent: navigator.userAgent, created_at: '', updated_at: '' }]);
        setStatus({ ok: true, message: 'Push notifications enabled on this device.' });
      } else {
        setStatus({ ok: false, message: result.error || 'Failed to save subscription.' });
      }
    } catch {
      setStatus({ ok: false, message: 'Failed to enable push notifications.' });
    } finally {
      setEnabling(false);
    }
  }

  async function handleTestPush() {
    setTesting(true);
    setStatus(null);
    const result = await sendTestPush();
    setStatus({ ok: result.success, message: result.success ? 'Test notification sent!' : (result.error || 'Failed.') });
    setTesting(false);
  }

  async function handleRemoveDevice(endpoint: string) {
    await removePushSubscription(endpoint);
    setPushSubs(prev => prev.filter(s => s.endpoint !== endpoint));
  }

  async function handleAddReminder() {
    if (!newTitle.trim()) return;
    setAddingReminder(true);
    // Build hours array from start→end range
    const hours: number[] = [];
    for (let h = startHour; h <= endHour; h++) hours.push(h);

    const result = await createReminder({
      title: newTitle.trim(),
      body: newBody.trim() || undefined,
      hours,
      days_of_week: newDays,
      client_id: newClientId || undefined,
    });
    if (result.success) {
      const clientName = newClientId ? clients.find(c => c.id === newClientId)?.name : undefined;
      setReminders(prev => [...prev, { id: crypto.randomUUID(), user_id: '', client_id: newClientId || null, title: newTitle.trim(), body: newBody.trim() || null, url: '/today', tag: 'reminder', hours, days_of_week: newDays, timezone: 'Europe/London', is_active: true, created_at: '', updated_at: '', client_name: clientName }]);
      setNewTitle('');
      setNewBody('');
      setNewClientId('');
      setShowAddReminder(false);
    }
    setAddingReminder(false);
  }

  async function handleToggleReminder(id: string, isActive: boolean) {
    await updateReminder(id, { is_active: !isActive });
    setReminders(prev => prev.map(r => r.id === id ? { ...r, is_active: !isActive } : r));
  }

  async function handleDeleteReminder(id: string) {
    await deleteReminder(id);
    setReminders(prev => prev.filter(r => r.id !== id));
  }

  function toggleDay(day: number) {
    setNewDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
  }

  const deviceCount = pushSubs.length;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-text-tertiary">Push Notifications</p>
      <p className="text-xs text-text-secondary">Get reminders on your phone and desktop, even when the app is closed.</p>

      {/* Push status */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {deviceCount > 0 && <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />}
            <div>
              <p className="text-sm text-text-primary font-medium">
                {deviceCount > 0 ? `Enabled on ${deviceCount} device${deviceCount > 1 ? 's' : ''}` : 'Not enabled'}
              </p>
              <p className="text-xs text-text-tertiary mt-0.5">
                {deviceCount > 0 ? 'Receiving push notifications' : 'Enable to receive reminders on this device'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {deviceCount > 0 && (
              <Button size="sm" onClick={handleTestPush} disabled={testing}>
                {testing ? '...' : 'Test'}
              </Button>
            )}
            <Button size="sm" onClick={handleEnablePush} disabled={enabling}>
              {enabling ? '...' : deviceCount > 0 ? 'Add Device' : 'Enable Push'}
            </Button>
          </div>
        </div>

        {/* Device list */}
        {deviceCount > 0 && (
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            {pushSubs.map((sub, i) => {
              const isMobile = /Mobile|iPhone|Android/i.test(sub.user_agent || '');
              const label = isMobile ? 'Mobile' : 'Desktop';
              return (
                <div key={sub.endpoint} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">{label} {deviceCount > 1 ? `(${i + 1})` : ''}</span>
                  <button onClick={() => handleRemoveDevice(sub.endpoint)} className="text-text-tertiary hover:text-red-400 transition-colors cursor-pointer">Remove</button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {status && (
        <p className={cn('text-xs', status.ok ? 'text-green-400' : 'text-red-400')}>
          {status.message}
        </p>
      )}

      {/* Reminders */}
      <div className="flex items-center justify-between mt-6">
        <p className="text-xs font-medium text-text-tertiary">Reminders</p>
        <Button size="sm" onClick={() => setShowAddReminder(!showAddReminder)}>
          {showAddReminder ? 'Cancel' : 'Add Reminder'}
        </Button>
      </div>

      {reminders.length === 0 && !showAddReminder && (
        <p className="text-xs text-text-tertiary">No reminders set up yet.</p>
      )}

      {/* Existing reminders */}
      {reminders.map(reminder => {
        const hoursStr = reminder.hours.length > 0
          ? `${reminder.hours[0]}:00–${reminder.hours[reminder.hours.length - 1]}:00`
          : 'No hours set';
        const daysStr = reminder.days_of_week.map(d => REMINDER_DAY_LABELS[d]).join(', ');
        return (
          <Card key={reminder.id}>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn('text-sm font-medium', reminder.is_active ? 'text-text-primary' : 'text-text-tertiary line-through')}>
                    {reminder.title}
                  </p>
                  {reminder.client_name && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium flex-shrink-0">
                      {reminder.client_name}
                    </span>
                  )}
                </div>
                {reminder.body && (
                  <p className="text-xs text-text-tertiary mt-0.5 truncate">{reminder.body}</p>
                )}
                <p className="text-xs text-text-tertiary mt-1">{hoursStr} · {daysStr}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <button
                  onClick={() => handleToggleReminder(reminder.id, reminder.is_active)}
                  className={cn(
                    'w-8 h-4.5 rounded-full transition-colors relative cursor-pointer',
                    reminder.is_active ? 'bg-accent' : 'bg-surface-tertiary'
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all',
                    reminder.is_active ? 'left-4' : 'left-0.5'
                  )} />
                </button>
                <button
                  onClick={() => handleDeleteReminder(reminder.id)}
                  className="text-text-tertiary hover:text-red-400 transition-colors p-1 cursor-pointer"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </div>
            </div>
          </Card>
        );
      })}

      {/* Add reminder form */}
      {showAddReminder && (
        <Card>
          <div className="space-y-3">
            <Input
              label="Title"
              placeholder="e.g. Check posts for @person"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
            />
            <Input
              label="Body (optional)"
              placeholder="e.g. LinkedIn + Twitter"
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
            />

            {/* Client (optional) */}
            {clients.length > 0 && (
              <div>
                <p className="text-xs text-text-tertiary font-medium mb-1.5">Client (optional)</p>
                <select
                  value={newClientId}
                  onChange={e => setNewClientId(e.target.value)}
                  className="w-full text-xs bg-surface-tertiary border border-border rounded-lg px-2 py-1.5 text-text-primary"
                >
                  <option value="">No client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Hour range */}
            <div>
              <p className="text-xs text-text-tertiary font-medium mb-1.5">Time range</p>
              <div className="flex items-center gap-2">
                <select
                  value={startHour}
                  onChange={e => setStartHour(Number(e.target.value))}
                  className="text-xs bg-surface-tertiary border border-border rounded-lg px-2 py-1.5 text-text-primary"
                >
                  {REMINDER_HOUR_OPTIONS.map(h => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
                <span className="text-xs text-text-tertiary">to</span>
                <select
                  value={endHour}
                  onChange={e => setEndHour(Number(e.target.value))}
                  className="text-xs bg-surface-tertiary border border-border rounded-lg px-2 py-1.5 text-text-primary"
                >
                  {REMINDER_HOUR_OPTIONS.filter(h => h >= startHour).map(h => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
                <span className="text-xs text-text-tertiary ml-1">({endHour - startHour + 1} notifications)</span>
              </div>
            </div>

            {/* Days of week */}
            <div>
              <p className="text-xs text-text-tertiary font-medium mb-1.5">Days</p>
              <div className="flex gap-1">
                {REMINDER_DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={cn(
                      'text-xs px-2 py-1 rounded-md transition-colors cursor-pointer',
                      newDays.includes(i) ? 'bg-accent text-white' : 'bg-surface-tertiary text-text-tertiary hover:text-text-secondary'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Button size="sm" onClick={handleAddReminder} disabled={addingReminder || !newTitle.trim()}>
              {addingReminder ? '...' : 'Add Reminder'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
