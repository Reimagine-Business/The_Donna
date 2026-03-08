-- ============================================================
-- Migration: 20260307_add_feedback_tables.sql
-- 1. Adds business_slug to business_profiles (auto-generated)
-- 2. Creates feedback_responses table with RLS
-- ============================================================

-- ── 1. Slugify helper ────────────────────────────────────────
CREATE OR REPLACE FUNCTION slugify(value TEXT)
RETURNS TEXT
LANGUAGE plpgsql STRICT IMMUTABLE AS $$
DECLARE
  result TEXT;
BEGIN
  result := lower(trim(value));
  -- Transliterate common accented chars
  result := translate(
    result,
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
    'aaaaaaceeeeiiiinooooouuuuyy'
  );
  -- Strip anything that isn't alphanumeric or whitespace
  result := regexp_replace(result, '[^a-z0-9\s]', '', 'g');
  -- Collapse whitespace → hyphens
  result := regexp_replace(result, '\s+', '-', 'g');
  -- Trim edge hyphens
  result := trim(both '-' from result);
  -- Fallback to 'business' if result is empty
  IF result IS NULL OR result = '' THEN
    result := 'business';
  END IF;
  RETURN result;
END;
$$;

-- ── 2. Add business_slug column ──────────────────────────────
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS business_slug TEXT UNIQUE;

-- ── 3. Trigger: auto-populate slug on INSERT / UPDATE ────────
CREATE OR REPLACE FUNCTION set_business_slug()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter   INT := 1;
BEGIN
  IF NEW.business_slug IS NULL OR NEW.business_slug = '' THEN
    base_slug := slugify(COALESCE(NEW.business_name, 'business'));
    candidate := base_slug;
    WHILE EXISTS (
      SELECT 1 FROM business_profiles
      WHERE business_slug = candidate
        AND id IS DISTINCT FROM NEW.id
    ) LOOP
      candidate := base_slug || '-' || counter;
      counter   := counter + 1;
    END LOOP;
    NEW.business_slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_business_slug ON business_profiles;
CREATE TRIGGER trg_set_business_slug
  BEFORE INSERT OR UPDATE OF business_name, business_slug
  ON business_profiles
  FOR EACH ROW EXECUTE FUNCTION set_business_slug();

-- ── 4. Backfill slugs for existing rows ──────────────────────
DO $$
DECLARE
  rec  RECORD;
  base TEXT;
  cand TEXT;
  ctr  INT;
BEGIN
  FOR rec IN
    SELECT id, business_name
    FROM   business_profiles
    WHERE  business_slug IS NULL OR business_slug = ''
    ORDER  BY created_at
  LOOP
    base := slugify(COALESCE(rec.business_name, 'business'));
    cand := base;
    ctr  := 1;
    WHILE EXISTS (
      SELECT 1 FROM business_profiles
      WHERE business_slug = cand AND id != rec.id
    ) LOOP
      cand := base || '-' || ctr;
      ctr  := ctr + 1;
    END LOOP;
    UPDATE business_profiles SET business_slug = cand WHERE id = rec.id;
  END LOOP;
END;
$$;

-- ── 5. Public lookup function for business_profiles (for customer page) ──
-- Anon users need only 4 safe columns (id, business_name, business_slug,
-- feedback_categories) to render the customer feedback form.  A direct anon
-- SELECT policy would expose ALL columns including the sensitive
-- business_context JSONB (monthly sales, team size, goals, etc.).
-- A SECURITY DEFINER function is used instead: it runs as its owner and
-- returns only the safe columns, so anon never has direct table access.
DROP POLICY IF EXISTS "Public can read business name by slug" ON business_profiles;

-- Revoke any residual direct anon SELECT on the table
REVOKE SELECT ON business_profiles FROM anon;

CREATE OR REPLACE FUNCTION public.get_business_public_profile(p_slug TEXT)
RETURNS TABLE (
  id                  UUID,
  business_name       TEXT,
  business_slug       TEXT,
  feedback_categories TEXT[]
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    id,
    business_name,
    business_slug,
    feedback_categories
  FROM business_profiles
  WHERE business_slug = p_slug
    AND business_slug IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_public_profile(TEXT) TO anon, authenticated;

-- ── 6. feedback_responses table ──────────────────────────────
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

-- Performance index
CREATE INDEX IF NOT EXISTS idx_feedback_business_created
  ON feedback_responses (business_id, created_at DESC);

-- Enable RLS
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

-- ── 7. RLS policies on feedback_responses ────────────────────

-- Anon can INSERT (customers submit without logging in)
DROP POLICY IF EXISTS "Anon can insert feedback" ON feedback_responses;
CREATE POLICY "Anon can insert feedback"
  ON feedback_responses
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated owners can SELECT their own business's feedback
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
