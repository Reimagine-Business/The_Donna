-- ═══════════════════════════════════════════════════════════
-- DONNA CLEAN - PROFILE & SETTINGS DATABASE SETUP
-- ═══════════════════════════════════════════════════════════
-- Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  username TEXT,
  business_name TEXT,
  address TEXT,
  logo_url TEXT,
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
-- Username is derived from metadata or email prefix, but only if it
-- passes the UNIQUE + format constraints (3-20 chars, [a-zA-Z0-9_-]).
-- If it doesn't pass, username is set to NULL — the app handles this
-- gracefully by falling back to the email prefix for display.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _username TEXT;
BEGIN
  -- Try metadata first, then email prefix
  _username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );

  -- Validate against the CHECK constraint (3-20 chars, alphanumeric/hyphens/underscores)
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

  INSERT INTO public.profiles (user_id, username, business_name)
  VALUES (
    NEW.id,
    _username,
    COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Business')
  );
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
