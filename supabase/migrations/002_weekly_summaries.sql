-- Add weekly_summaries table (needed for dashboard)
CREATE TABLE weekly_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_summaries_select" ON weekly_summaries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "weekly_summaries_insert" ON weekly_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "weekly_summaries_delete" ON weekly_summaries
  FOR DELETE USING (auth.uid() = user_id);

-- RPC: resolutions with last log date and count
CREATE OR REPLACE FUNCTION get_resolutions_with_log_meta(p_user_id UUID)
RETURNS TABLE (
  id UUID, user_id UUID, title TEXT, description TEXT, category TEXT,
  ai_framing TEXT, target_date DATE, status TEXT, created_at TIMESTAMPTZ,
  last_log_at TIMESTAMPTZ, log_count BIGINT
) AS $$
  SELECT
    r.*,
    MAX(pl.created_at) AS last_log_at,
    COUNT(pl.id) AS log_count
  FROM resolutions r
  LEFT JOIN progress_logs pl ON pl.resolution_id = r.id
  WHERE r.user_id = p_user_id
    AND r.user_id = auth.uid()
  GROUP BY r.id
  ORDER BY r.created_at DESC
$$ LANGUAGE sql SECURITY DEFINER;
