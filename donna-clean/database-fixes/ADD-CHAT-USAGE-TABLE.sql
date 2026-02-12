-- Track daily and monthly chat usage per user
CREATE TABLE IF NOT EXISTS chat_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id)
    ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  month_year TEXT NOT NULL
    DEFAULT TO_CHAR(NOW(), 'YYYY-MM'),
  daily_count INTEGER DEFAULT 0,
  monthly_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Index for fast lookups
CREATE INDEX idx_chat_usage_user_date
  ON chat_usage(user_id, date);
CREATE INDEX idx_chat_usage_user_month
  ON chat_usage(user_id, month_year);

-- RLS
ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON chat_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON chat_usage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON chat_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);
