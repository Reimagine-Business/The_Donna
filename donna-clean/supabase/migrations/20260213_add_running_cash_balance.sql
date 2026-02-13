-- Add running cash balance to profiles table
-- This stores the pre-calculated balance so alert generation
-- doesn't need to scan the entire entries table on every entry creation.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS running_cash_balance NUMERIC DEFAULT 0;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS balance_last_updated TIMESTAMPTZ DEFAULT NOW();

-- Backfill: calculate and store balance for all existing users
-- This runs once during migration to seed the balance from existing entries.
UPDATE profiles p
SET
  running_cash_balance = COALESCE(balances.balance, 0),
  balance_last_updated = NOW()
FROM (
  SELECT
    e.user_id,
    SUM(
      CASE
        WHEN e.entry_type = 'Cash IN' THEN e.amount
        WHEN e.entry_type = 'Cash OUT' THEN -e.amount
        WHEN e.entry_type = 'Advance' AND e.category = 'Sales' THEN e.amount
        WHEN e.entry_type = 'Advance' AND e.category IN ('COGS', 'Opex', 'Assets') THEN -e.amount
        ELSE 0
      END
    ) AS balance
  FROM entries e
  GROUP BY e.user_id
) balances
WHERE p.user_id = balances.user_id;
