-- ============================================================
-- Create ai_usage_logs table for tracking AI API costs
--
-- Run this in Supabase SQL Editor if the table doesn't exist yet
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,  -- 'chat' or 'insights'
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10, 6) DEFAULT 0,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Service role (used by donna-chat and donna-insights API routes) bypasses RLS
-- by default — no INSERT policy needed for it.
-- Authenticated users can only SELECT their own rows.
-- No authenticated INSERT policy: only service role writes to this table.
DROP POLICY IF EXISTS "Service role full access" ON ai_usage_logs;

CREATE POLICY "Users can view own usage logs"
  ON ai_usage_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature ON ai_usage_logs(feature);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
