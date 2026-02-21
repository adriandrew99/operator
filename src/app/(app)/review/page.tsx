import { createClient } from '@/lib/supabase/server';
import { getWeekStart } from '@/lib/utils/date';
import { formatDateLong } from '@/lib/utils/date';
import { ReviewDashboard } from './ReviewDashboard';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const weekStart = getWeekStart();

  const [reviewRes, scoresRes, reviewsHistoryRes] = await Promise.all([
    Promise.resolve(supabase
      .from('weekly_reviews')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .single()).catch(() => ({ data: null })),
    Promise.resolve(supabase
      .from('operator_scores')
      .select('date, score')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .limit(56)).catch(() => ({ data: [] })),
    Promise.resolve(supabase
      .from('weekly_reviews')
      .select('*')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(12)).catch(() => ({ data: [] })),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-page-title text-text-primary">Weekly Review</h1>
        <p className="text-xs text-text-tertiary mt-0.5">
          Week of {formatDateLong(weekStart)}
        </p>
      </div>
      <ReviewDashboard
        review={reviewRes.data}
        scores={scoresRes.data || []}
        history={reviewsHistoryRes.data || []}
      />
    </div>
  );
}
