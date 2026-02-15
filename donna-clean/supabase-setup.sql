-- ═══════════════════════════════════════════════════════════
-- DONNA CLEAN - PROFILE & SETTINGS DATABASE SETUP
-- ═══════════════════════════════════════════════════════════
-- Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email TEXT,
  username TEXT,
  business_name TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  role TEXT DEFAULT 'owner',
  running_cash_balance NUMERIC DEFAULT 0,
  balance_last_updated TIMESTAMPTZ DEFAULT NOW(),
  cached_insights TEXT,
  insights_cached_at TIMESTAMPTZ,
  insights_cache_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
-- This trigger handles BOTH profile creation AND default categories.
-- Uses ON CONFLICT so it's safe even if app code also inserts a profile.
-- Uses EXCEPTION handler so user creation NEVER fails due to profile issues.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _username TEXT;
  _email    TEXT;
  _biz_name TEXT;
  _phone    TEXT;
BEGIN
  _email    := NEW.email;
  _biz_name := COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Business');
  _phone    := NEW.raw_user_meta_data->>'phone';

  -- Try metadata first, then email prefix for username
  _username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );

  -- Validate against CHECK constraint (3-20 chars, alphanumeric/hyphens/underscores)
  IF _username IS NOT NULL AND _username !~ '^[a-zA-Z0-9_-]{3,20}$' THEN
    _username := NULL;
  END IF;

  -- Check UNIQUE constraint — if username already taken, set NULL
  IF _username IS NOT NULL THEN
    PERFORM 1 FROM public.profiles WHERE username = _username;
    IF FOUND THEN
      _username := NULL;
    END IF;
  END IF;

  -- Insert profile (ON CONFLICT = safe if already exists)
  INSERT INTO public.profiles (user_id, email, username, business_name, phone, role)
  VALUES (NEW.id, _email, _username, _biz_name, _phone, 'owner')
  ON CONFLICT (user_id) DO UPDATE SET
    email         = COALESCE(EXCLUDED.email, public.profiles.email),
    username      = COALESCE(EXCLUDED.username, public.profiles.username),
    business_name = COALESCE(EXCLUDED.business_name, public.profiles.business_name),
    phone         = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at    = NOW();

  -- Create default categories
  PERFORM public.create_default_categories(NEW.id);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user() failed for user %: % (SQLSTATE %)',
      NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ═══════════════════════════════════════════════════════════
-- STORAGE SETUP (Manual steps in Supabase Dashboard)
-- ═══════════════════════════════════════════════════════════
--
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "Create a new bucket"
-- 3. Name: "logos"
-- 4. Public: YES (toggle on)
-- 5. Click "Create bucket"
--
-- Then add these storage policies in SQL Editor:
-- ═══════════════════════════════════════════════════════════

-- Storage Policy 1: Upload
CREATE POLICY "Users can upload own logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

-- Storage Policy 2: View
CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');

-- Storage Policy 3: Update
CREATE POLICY "Users can update own logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'logos');

-- ═══════════════════════════════════════════════════════════
-- SETUP COMPLETE!
-- ═══════════════════════════════════════════════════════════
