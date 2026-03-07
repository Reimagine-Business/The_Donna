-- ============================================================
-- Migration: 20260307_ensure_feedback_responses_table.sql
-- Safe to run on production — fully idempotent.
-- Ensures feedback_responses table + correct RLS exist.
-- Run this via Supabase SQL Editor if the original migration
-- (20260307_add_feedback_tables.sql) was never applied.
-- ============================================================

-- ── 1. Create feedback_responses table (if not already there) ─
CREATE TABLE IF NOT EXISTS feedback_responses (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        UUID        NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  business_slug      TEXT        NOT NULL,
  rating             INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  liked_categories   TEXT[]      NULL,
  improve_categories TEXT[]      NULL,
  comment            TEXT        NULL,
  collection_mode    TEXT        NULL CHECK (collection_mode IN ('qr', 'direct')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Performance index ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_feedback_business_created
  ON feedback_responses (business_id, created_at DESC);

-- ── 3. Enable Row Level Security ─────────────────────────────
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

-- ── 4. Anon INSERT policy (customers submit without logging in)
--    Drop first so re-running this script is safe.
DROP POLICY IF EXISTS "Anon can insert feedback" ON feedback_responses;
CREATE POLICY "Anon can insert feedback"
  ON feedback_responses
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ── 5. Authenticated SELECT policy (owners see their own data)
DROP POLICY IF EXISTS "Owners can read own feedback" ON feedback_responses;
CREATE POLICY "Owners can read own feedback"
  ON feedback_responses
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM business_profiles WHERE user_id = auth.uid()
    )
  );

-- ── 6. Verify ────────────────────────────────────────────────
-- Uncomment to confirm after running:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'feedback_responses';
-- SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'feedback_responses';
