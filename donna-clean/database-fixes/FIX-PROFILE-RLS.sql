-- ============================================================
-- FIX: Profile page "Unknown error" and data not showing
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- Problem: Users can't read or update their own profile.
-- Root cause: RLS policies may be missing or broken after
-- admin dashboard SQL changes.
-- ============================================================

-- Step 1: Make sure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing profile policies (clean slate)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_delete_own_profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to read own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to insert own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for users" ON profiles;
DROP POLICY IF EXISTS "Enable update access for users" ON profiles;
DROP POLICY IF EXISTS "Enable insert access for users" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

-- Step 3: Create clean policies using user_id column
-- SELECT: Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

-- UPDATE: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT: Users can create their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own profile
CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Step 4: Verify policies are created
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles';

-- Step 5: Verify data exists
SELECT user_id, username, business_name, address, updated_at
FROM profiles
ORDER BY updated_at DESC
LIMIT 10;
