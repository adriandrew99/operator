-- Weekly debrief history — stores completed debrief snapshots
CREATE TABLE IF NOT EXISTS weekly_debrief_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  week_label TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one debrief per user per week
CREATE UNIQUE INDEX IF NOT EXISTS weekly_debrief_history_user_week
  ON weekly_debrief_history(user_id, week_start);

-- RLS
ALTER TABLE weekly_debrief_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own debriefs" ON weekly_debrief_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own debriefs" ON weekly_debrief_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own debriefs" ON weekly_debrief_history
  FOR UPDATE USING (auth.uid() = user_id);
