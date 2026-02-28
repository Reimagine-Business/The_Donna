-- ============================================================
-- Enhanced Admin Stats Function
-- ============================================================
-- Returns per-user behavior metrics for the admin dashboard.
-- Uses SECURITY DEFINER so it can read auth.users.
-- Must be run by a Supabase admin / service-role connection.
--
-- Tables used:
--   auth.users          — user identity, signup, last sign-in
--   profiles            — username, business_name, role
--   entries             — all ledger entries (Cash IN/OUT, Credit, Advance)
--   parties             — customer/vendor contacts
--   ai_usage_logs       — Donna AI chat & insight usage
--   settlement_history  — credit/advance settlement records
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_enhanced_user_stats()
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  business_name TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in TIMESTAMPTZ,
  total_entries BIGINT,
  cash_in_count BIGINT,
  cash_out_count BIGINT,
  credit_count BIGINT,
  advance_count BIGINT,
  last_entry_date TIMESTAMPTZ,
  total_settlements BIGINT,
  total_parties BIGINT,
  total_ai_chats BIGINT,
  last_ai_chat TIMESTAMPTZ,
  active_days_30d BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id AS user_id,
    COALESCE(p.username, split_part(u.email, '@', 1)) AS username,
    p.business_name,
    COALESCE(p.role, 'user') AS role,
    u.created_at,
    u.last_sign_in_at AS last_sign_in,

    -- Entry counts by type
    COUNT(e.id) AS total_entries,
    COUNT(e.id) FILTER (WHERE e.entry_type = 'Cash IN')  AS cash_in_count,
    COUNT(e.id) FILTER (WHERE e.entry_type = 'Cash OUT') AS cash_out_count,
    COUNT(e.id) FILTER (WHERE e.entry_type = 'Credit')   AS credit_count,
    COUNT(e.id) FILTER (WHERE e.entry_type = 'Advance')  AS advance_count,
    MAX(e.created_at) AS last_entry_date,

    -- Settlement count (from settlement_history table)
    (SELECT COUNT(*) FROM settlement_history sh WHERE sh.user_id = u.id) AS total_settlements,

    -- Party count
    (SELECT COUNT(*) FROM parties pt WHERE pt.user_id = u.id) AS total_parties,

    -- AI chat usage
    (SELECT COUNT(*) FROM ai_usage_logs a WHERE a.user_id = u.id) AS total_ai_chats,
    (SELECT MAX(a.created_at) FROM ai_usage_logs a WHERE a.user_id = u.id) AS last_ai_chat,

    -- Active days in last 30 days (days with at least one entry)
    (SELECT COUNT(DISTINCT DATE(e2.created_at))
      FROM entries e2
      WHERE e2.user_id = u.id
      AND e2.created_at >= NOW() - INTERVAL '30 days') AS active_days_30d

  FROM auth.users u
  LEFT JOIN profiles p ON p.user_id = u.id
  LEFT JOIN entries e ON e.user_id = u.id
  GROUP BY u.id, u.email, u.created_at, u.last_sign_in_at, p.username, p.business_name, p.role
  ORDER BY u.last_sign_in_at DESC NULLS LAST;
$$;
