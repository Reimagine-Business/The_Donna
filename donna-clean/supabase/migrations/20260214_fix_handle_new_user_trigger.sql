-- Fix handle_new_user() trigger to avoid constraint violations
--
-- ROOT CAUSE: The trigger blindly set username = split_part(email, '@', 1),
-- which fails when:
--   1. Email prefix contains dots (e.g. john.doe@gmail.com) → violates
--      CHECK constraint (username ~ '^[a-zA-Z0-9_-]{3,20}$')
--   2. Email prefix is < 3 or > 20 chars → violates CHECK constraint
--   3. Another user has the same email prefix → violates UNIQUE constraint
--   4. Admin creates user from dashboard with no metadata → same issues
--
-- FIX: Validate the derived username before inserting. If it fails either
-- constraint, set username to NULL. The app already handles NULL usernames
-- gracefully (falls back to email prefix for display).

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
