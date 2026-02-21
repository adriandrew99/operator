import { createClient } from '@/lib/supabase/server';
import { getClients } from '@/actions/finance';
import { getCustomFundamentals, getTodayCompletions } from '@/actions/fundamentals';
import { getCompletedTasks, getArchivedTasks } from '@/actions/tasks';
import { TasksDashboard } from './TasksDashboard';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [tasksRes, clients, fundamentals, completions, completedTasks, archivedTasks] = await Promise.all([
    Promise.resolve(supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })).catch(() => ({ data: [] })),
    getClients().catch(() => []),
    getCustomFundamentals().catch(() => []),
    getTodayCompletions().catch(() => []),
    getCompletedTasks(50).catch(() => []),
    getArchivedTasks(100).catch(() => []),
  ]);

  // Check if sleep fundamental is completed
  const sleepFundamental = fundamentals.find(
    (f) => f.label.toLowerCase().includes('sleep')
  );
  const completionMap = new Map(completions.map((c) => [c.fundamental_id, c.completed]));
  const hadGoodSleep = sleepFundamental ? (completionMap.get(sleepFundamental.id) ?? false) : true;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-page-title text-text-primary">Tasks</h1>
        <p className="text-xs text-text-tertiary mt-0.5">Structured, not chaotic</p>
      </div>
      <TasksDashboard
        tasks={tasksRes.data || []}
        completedTasks={completedTasks || []}
        archivedTasks={archivedTasks || []}
        clients={clients || []}
        hadGoodSleep={hadGoodSleep}
      />
    </div>
  );
}
