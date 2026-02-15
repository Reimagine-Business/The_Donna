-- ============================================================
-- FIX: "permission denied for table users" error
--
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- Root cause: An admin RLS policy on the entries table references
-- auth.users, which regular authenticated users cannot access.
-- When Postgres evaluates ALL policies (OR logic for permissive),
-- it tries the admin policy too, hits auth.users, and fails.
-- ============================================================

-- STEP 1: Check current policies on entries table
-- (Run this first to see what exists)
SELECT policyname, cmd, qual::text, with_check::text
FROM pg_policies
WHERE tablename = 'entries';

-- STEP 2: Drop any admin policies that reference auth.users
-- These cause "permission denied" for regular users
DROP POLICY IF EXISTS "Admins can view all entries" ON entries;
DROP POLICY IF EXISTS "Admin full access" ON entries;
DROP POLICY IF EXISTS "admin_read_all_entries" ON entries;

-- STEP 3: Recreate clean user policies
-- (Drop and recreate to ensure clean state)
DROP POLICY IF EXISTS "Users can view own entries" ON entries;
DROP POLICY IF EXISTS "Users can insert own entries" ON entries;
DROP POLICY IF EXISTS "Users can update own entries" ON entries;
DROP POLICY IF EXISTS "Users can delete own entries" ON entries;

CREATE POLICY "Users can view own entries"
  ON entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON entries FOR DELETE
  USING (auth.uid() = user_id);

-- STEP 4: If you need an admin policy, use profiles table (NOT auth.users)
-- This is safe because regular users CAN read the profiles table
CREATE POLICY "Admins can view all entries"
  ON entries FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = 'alfred@thedonnaapp.co'
    )
  );

-- STEP 5: Fix reminders table policies if affected
DROP POLICY IF EXISTS "Users can view own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can insert own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can update own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can delete own reminders" ON reminders;

CREATE POLICY "Users can view own reminders"
  ON reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders"
  ON reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders"
  ON reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders"
  ON reminders FOR DELETE
  USING (auth.uid() = user_id);

-- STEP 6: Fix parties table policies if affected
DROP POLICY IF EXISTS "Users can view own parties" ON parties;
DROP POLICY IF EXISTS "Users can insert own parties" ON parties;
DROP POLICY IF EXISTS "Users can update own parties" ON parties;
DROP POLICY IF EXISTS "Users can delete own parties" ON parties;

CREATE POLICY "Users can view own parties"
  ON parties FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own parties"
  ON parties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own parties"
  ON parties FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own parties"
  ON parties FOR DELETE
  USING (auth.uid() = user_id);

-- STEP 7: Verify fix — this should return a count (not an error)
SELECT COUNT(*) as my_entries FROM entries WHERE user_id = auth.uid();

-- STEP 8: Verify all policies are clean
SELECT tablename, policyname, cmd, qual::text
FROM pg_policies
WHERE tablename IN ('entries', 'reminders', 'parties')
ORDER BY tablename, policyname;
