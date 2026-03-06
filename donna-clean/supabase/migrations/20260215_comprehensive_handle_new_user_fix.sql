-- ═══════════════════════════════════════════════════════════════════
-- COMPREHENSIVE FIX: handle_new_user trigger + profiles table
-- ═══════════════════════════════════════════════════════════════════
-- Date: 2026-02-15
--
-- ROOT CAUSE ANALYSIS:
-- The "Failed to create user: Database error creating new user" error
-- persists because of MULTIPLE compounding issues:
--
-- 1. TWO conflicting definitions of handle_new_user():
--    - supabase-setup.sql: INSERTs into profiles (username, business_name)
--    - business-tables.sql: ONLY calls create_default_categories() —
--      does NOT insert into profiles at all
--    Whichever was run last in the Supabase SQL Editor wins. If
--    business-tables.sql was run last, the trigger no longer creates
--    profile rows, causing "profile not found" errors on login.
--
-- 2. Missing columns: The app code (create-actions.ts, sign-up/actions.ts)
--    tries to insert 'email', 'phone', 'role' columns into profiles,
--    but these columns may not exist on the table.
--
-- 3. Duplicate insert: The trigger creates a profile row, then the app
--    code ALSO tries to INSERT a row → unique constraint violation on
--    user_id. The app code uses .insert() instead of .upsert().
--
-- 4. Wrong column name: App code uses { id: user.id } but the profiles
--    table PK is auto-generated; the FK column is 'user_id'. This is
--    an app-side bug but we can make the DB resilient to it.
--
-- FIX: This migration makes the trigger handle EVERYTHING needed for
-- new user setup (profile + default categories), and makes it
-- resilient to edge cases. The trigger uses ON CONFLICT so it's safe
-- even if the app also tries to create the profile.
--
-- SAFE TO RUN MULTIPLE TIMES: Uses CREATE OR REPLACE, IF NOT EXISTS,
-- and IF EXISTS throughout.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- STEP 1: Ensure profiles table has all columns the app expects
-- ─────────────────────────────────────────────────────────────────

-- Add 'email' column (app code references it but original schema lacks it)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add 'phone' column (migration 20251218 may not have been applied)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add 'role' column (URGENT-FIX-PROFILES.sql references it)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner';

-- Add 'username' column (should exist from migration 20251218)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username TEXT;

-- Ensure cash balance columns exist (migration 20260213)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS running_cash_balance NUMERIC DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS balance_last_updated TIMESTAMPTZ DEFAULT NOW();

-- Ensure insights cache columns exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cached_insights TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS insights_cached_at TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS insights_cache_date DATE;

-- ─────────────────────────────────────────────────────────────────
-- STEP 2: Ensure constraints exist (idempotent)
-- ─────────────────────────────────────────────────────────────────

-- Add username CHECK constraint if not already present
-- (We use a DO block because ADD CONSTRAINT IF NOT EXISTS is PG15+)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'username_format'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT username_format CHECK (
      username IS NULL OR (char_length(username) BETWEEN 1 AND 30)
    );
  END IF;
END $$;

-- Ensure username UNIQUE index exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username
ON public.profiles(username)
WHERE username IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- STEP 3: Create/replace the SINGLE authoritative handle_new_user()
-- ─────────────────────────────────────────────────────────────────
-- This function does BOTH:
--   A) Creates the profile row (with safe username handling)
--   B) Creates default categories
-- It uses ON CONFLICT to gracefully handle the case where the
-- profile already exists (e.g., if admin code already created it).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _username TEXT;
  _email    TEXT;
  _biz_name TEXT;
  _phone    TEXT;
BEGIN
  -- Extract values from the new auth.users row
  _email    := NEW.email;
  _biz_name := COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Business');
  _phone    := NEW.raw_user_meta_data->>'phone';

  -- Try metadata first, then email prefix for username
  _username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );

  -- Validate username against CHECK constraint (1-30 chars, any format)
  IF _username IS NOT NULL AND (char_length(_username) < 1 OR char_length(_username) > 30) THEN
    _username := NULL;
  END IF;

  -- Check UNIQUE constraint — if username already taken, set NULL
  IF _username IS NOT NULL THEN
    PERFORM 1 FROM public.profiles WHERE username = _username;
    IF FOUND THEN
      _username := NULL;
    END IF;
  END IF;

  -- A) Insert profile row (ON CONFLICT = safe if already exists)
  INSERT INTO public.profiles (user_id, email, username, business_name, phone, role)
  VALUES (
    NEW.id,
    _email,
    _username,
    _biz_name,
    _phone,
    'owner'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email         = COALESCE(EXCLUDED.email, public.profiles.email),
    username      = COALESCE(EXCLUDED.username, public.profiles.username),
    business_name = COALESCE(EXCLUDED.business_name, public.profiles.business_name),
    phone         = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at    = NOW();

  -- B) Create default categories for the new user
  PERFORM public.create_default_categories(NEW.id);

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but do NOT fail the user creation.
    -- A missing profile is recoverable; a failed signup is not.
    RAISE WARNING 'handle_new_user() failed for user %: % (SQLSTATE %)',
      NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS
  'Creates profile + default categories when a new user signs up. '
  'Uses ON CONFLICT to safely handle duplicate inserts. '
  'Catches all exceptions so user creation never fails due to profile issues.';

-- ─────────────────────────────────────────────────────────────────
-- STEP 4: Ensure create_default_categories() exists
-- ─────────────────────────────────────────────────────────────────
-- (In case business-tables.sql was never run)

CREATE OR REPLACE FUNCTION public.create_default_categories(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert default income categories
    INSERT INTO public.categories (user_id, name, type, color, icon)
    VALUES
        (p_user_id, 'Sales', 'income', '#10b981', '💰'),
        (p_user_id, 'Services', 'income', '#3b82f6', '🛠️'),
        (p_user_id, 'Other Income', 'income', '#8b5cf6', '💵')
    ON CONFLICT (user_id, name, type) DO NOTHING;

    -- Insert default expense categories
    INSERT INTO public.categories (user_id, name, type, color, icon)
    VALUES
        (p_user_id, 'COGS', 'expense', '#ef4444', '📦'),
        (p_user_id, 'Rent', 'expense', '#f59e0b', '🏠'),
        (p_user_id, 'Salaries', 'expense', '#ec4899', '👥'),
        (p_user_id, 'Utilities', 'expense', '#06b6d4', '⚡'),
        (p_user_id, 'Marketing', 'expense', '#8b5cf6', '📢'),
        (p_user_id, 'Other Expenses', 'expense', '#6b7280', '📝')
    ON CONFLICT (user_id, name, type) DO NOTHING;

EXCEPTION
    WHEN undefined_table THEN
        -- categories table might not exist yet; skip silently
        RAISE WARNING 'categories table not found, skipping default categories for user %', p_user_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- STEP 5: Re-create the trigger (drop + create for clean state)
-- ─────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────
-- STEP 6: Backfill — create profiles for any existing users who
-- don't have one yet (handles users created while trigger was broken)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO public.profiles (user_id, email, username, business_name, role)
SELECT
  au.id,
  au.email,
  CASE
    WHEN char_length(split_part(au.email, '@', 1)) BETWEEN 1 AND 30
     AND NOT EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.username = split_part(au.email, '@', 1))
    THEN split_part(au.email, '@', 1)
    ELSE NULL
  END,
  COALESCE(au.raw_user_meta_data->>'business_name', 'My Business'),
  'owner'
FROM auth.users au
LEFT JOIN public.profiles p ON p.user_id = au.id
WHERE p.user_id IS NULL;

-- Also backfill default categories for users who have profiles but no categories
INSERT INTO public.categories (user_id, name, type, color, icon)
SELECT p.user_id, v.name, v.type, v.color, v.icon
FROM public.profiles p
CROSS JOIN (
  VALUES
    ('Sales', 'income', '#10b981', '💰'),
    ('Services', 'income', '#3b82f6', '🛠️'),
    ('Other Income', 'income', '#8b5cf6', '💵'),
    ('COGS', 'expense', '#ef4444', '📦'),
    ('Rent', 'expense', '#f59e0b', '🏠'),
    ('Salaries', 'expense', '#ec4899', '👥'),
    ('Utilities', 'expense', '#06b6d4', '⚡'),
    ('Marketing', 'expense', '#8b5cf6', '📢'),
    ('Other Expenses', 'expense', '#6b7280', '📝')
) AS v(name, type, color, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c
  WHERE c.user_id = p.user_id AND c.name = v.name AND c.type = v.type
);

-- ─────────────────────────────────────────────────────────────────
-- STEP 7: Verify
-- ─────────────────────────────────────────────────────────────────

-- Show the trigger function source (should be our new version)
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';

-- Show all triggers on auth.users
SELECT tgname, tgtype, tgenabled
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;

-- Show user vs profile counts
SELECT
  (SELECT COUNT(*) FROM auth.users) AS total_users,
  (SELECT COUNT(*) FROM public.profiles) AS total_profiles,
  CASE
    WHEN (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM public.profiles)
    THEN 'MATCH - All users have profiles'
    ELSE 'MISMATCH - Run backfill again'
  END AS status;

-- Show profiles table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ═══════════════════════════════════════════════════════════════════
-- DONE! After running this:
--
-- 1. The trigger now handles BOTH profile creation AND default
--    categories in a SINGLE function
-- 2. ON CONFLICT means the trigger won't fail even if the app
--    code also tries to insert a profile
-- 3. EXCEPTION handler means user creation NEVER fails due to
--    profile issues — worst case, profile is missing but user
--    exists and can still log in
-- 4. All missing columns (email, phone, role) are added
-- 5. Existing users without profiles are backfilled
--
-- TEST: Create a new user with email "alfred@thedonnaapp.co"
-- from the admin panel or via signup — it should work now.
-- ═══════════════════════════════════════════════════════════════════
