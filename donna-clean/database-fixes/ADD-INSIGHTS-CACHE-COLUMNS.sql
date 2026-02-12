-- Add caching columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS
  cached_insights TEXT,
ADD COLUMN IF NOT EXISTS
  insights_cached_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS
  insights_cache_date DATE;
