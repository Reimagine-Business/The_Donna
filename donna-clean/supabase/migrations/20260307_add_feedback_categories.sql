-- Add feedback_categories column to business_profiles
-- Stores the owner's configured feedback chip categories
-- Falls back to 5 defaults when null/empty

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS feedback_categories text[]
    DEFAULT ARRAY['Food', 'Service', 'Ambience', 'Value for Money', 'Cleanliness'];
