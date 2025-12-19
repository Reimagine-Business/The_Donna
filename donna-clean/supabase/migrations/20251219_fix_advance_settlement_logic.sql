-- Migration: Fix Advance Settlement Logic
-- Date: 2025-12-19
--
-- Problem: Advance settlements were affecting Cash Pulse, causing double-counting
-- - Advance created: Cash IN/OUT ✅
-- - Advance settled: Cash IN/OUT AGAIN ❌ (WRONG!)
--
-- Solution: Advance settlements should:
-- - Use payment_method = 'None' (so they don't affect Cash Pulse)
-- - Only affect Profit Lens (revenue/expense recognition)
--
-- Correct Logic:
-- Advance Sales:
--   Create → Cash IN ✅, Profit ❌
--   Settle → Cash unchanged ✅, Revenue ✅
--
-- Advance COGS/Opex:
--   Create → Cash OUT ✅, Profit ❌
--   Settle → Cash unchanged ✅, Expense ✅
--
-- Advance Assets:
--   Create → Cash OUT ✅, Profit ❌
--   Settle → Just mark as settled ✅ (no new entry needed)

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 1: Update settle_entry function - Advance settlements use payment_method = None
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION settle_entry(
  p_entry_id UUID,
  p_user_id UUID,
  p_settlement_amount NUMERIC,
  p_settlement_date DATE
) RETURNS JSON AS $$
DECLARE
  v_entry RECORD;
  v_remaining_amount NUMERIC;
  v_next_remaining NUMERIC;
  v_is_fully_settled BOOLEAN;
  v_settlement_payment_method TEXT;
  v_settlement_entry_type TEXT;
  v_new_entry_id UUID;
BEGIN
  -- 1. Load and lock the entry
  SELECT * INTO v_entry
  FROM entries
  WHERE id = p_entry_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Entry not found');
  END IF;

  -- 2. Validate entry type
  IF v_entry.entry_type NOT IN ('Credit', 'Advance') THEN
    RETURN json_build_object('success', false, 'error', 'Only Credit and Advance entries can be settled');
  END IF;

  -- 3. Validate amount
  v_remaining_amount := COALESCE(v_entry.remaining_amount, v_entry.amount);

  IF p_settlement_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Settlement amount must be greater than zero');
  END IF;

  IF p_settlement_amount > v_remaining_amount THEN
    RETURN json_build_object('success', false, 'error', 'Settlement amount exceeds remaining balance');
  END IF;

  -- 4. Create settlement entry with correct logic
  IF v_entry.entry_type = 'Credit' THEN
    -- Credit settlements: Use same payment method (affects Cash Pulse)
    v_settlement_payment_method := CASE
      WHEN v_entry.payment_method IN ('Cash', 'Bank') THEN v_entry.payment_method
      ELSE 'Cash'
    END;

    -- Use descriptive settlement names for Credit
    IF v_entry.category = 'Sales' THEN
      v_settlement_entry_type := 'Credit Settlement (Collections)';
    ELSIF v_entry.category IN ('COGS', 'Opex', 'Assets') THEN
      v_settlement_entry_type := 'Credit Settlement (Bills)';
    ELSE
      v_settlement_entry_type := 'Credit Settlement (Other)';
    END IF;

    -- Create the settlement entry (affects Cash Pulse)
    INSERT INTO entries (
      user_id,
      entry_type,
      category,
      payment_method,
      amount,
      remaining_amount,
      entry_date,
      notes,
      is_settlement,
      settlement_type,
      original_entry_id,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      v_settlement_entry_type,
      v_entry.category,
      v_settlement_payment_method,  -- Cash or Bank (affects Cash Pulse)
      p_settlement_amount,
      p_settlement_amount,
      p_settlement_date,
      'Settlement of Credit ' || v_entry.category,
      true,
      'credit',
      v_entry.id,
      NOW(),
      NOW()
    ) RETURNING id INTO v_new_entry_id;

  ELSIF v_entry.entry_type = 'Advance' THEN
    -- ✅ FIX: Advance settlements use payment_method = 'None'
    -- This prevents them from affecting Cash Pulse (cash already counted!)
    v_settlement_payment_method := 'None';

    -- Determine settlement type based on category
    IF v_entry.category = 'Sales' THEN
      v_settlement_entry_type := 'Advance Settlement (Received)';
    ELSIF v_entry.category = 'COGS' THEN
      v_settlement_entry_type := 'Advance Settlement (Paid)';
    ELSIF v_entry.category = 'Opex' THEN
      v_settlement_entry_type := 'Advance Settlement (Paid)';
    ELSIF v_entry.category = 'Assets' THEN
      -- Assets: Just mark as settled, no settlement entry needed
      v_settlement_entry_type := NULL;
    END IF;

    -- Only create settlement entry for Sales, COGS, and Opex
    -- (These affect Profit Lens, not Cash Pulse)
    IF v_settlement_entry_type IS NOT NULL THEN
      INSERT INTO entries (
        user_id,
        entry_type,
        category,
        payment_method,
        amount,
        remaining_amount,
        entry_date,
        notes,
        is_settlement,
        settlement_type,
        original_entry_id,
        created_at,
        updated_at
      ) VALUES (
        p_user_id,
        v_settlement_entry_type,
        v_entry.category,
        v_settlement_payment_method,  -- ✅ 'None' - does NOT affect Cash Pulse
        p_settlement_amount,
        p_settlement_amount,
        p_settlement_date,
        'Settlement of Advance ' || v_entry.category || ' - Revenue/Expense recognition only',
        true,
        'advance',
        v_entry.id,
        NOW(),
        NOW()
      ) RETURNING id INTO v_new_entry_id;
    ELSE
      -- Assets: Just mark as settled, no new entry
      RAISE NOTICE 'Advance Assets settlement - marking as settled without new entry';
    END IF;
  END IF;

  -- 5. Update original entry (for both Credit and Advance)
  v_next_remaining := GREATEST(v_remaining_amount - p_settlement_amount, 0);
  v_is_fully_settled := (v_next_remaining <= 0);

  UPDATE entries
  SET
    remaining_amount = v_next_remaining,
    settled = v_is_fully_settled,
    settled_at = CASE WHEN v_is_fully_settled THEN p_settlement_date::TIMESTAMPTZ ELSE settled_at END,
    updated_at = NOW()
  WHERE id = p_entry_id AND user_id = p_user_id;

  -- 6. Return success
  RETURN json_build_object(
    'success', true,
    'entry_type', v_entry.entry_type,
    'category', v_entry.category,
    'settlement_entry_id', v_new_entry_id,
    'settlement_entry_type', v_settlement_entry_type
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION settle_entry IS
'Settles entries with correct cash flow logic:
- Credit settlements: Create entry with Cash/Bank payment (affects Cash Pulse)
- Advance Sales/COGS/Opex settlements: Create entry with None payment (affects Profit only)
- Advance Assets settlements: Just mark as settled (no new entry)

This prevents double-counting cash while properly recognizing revenue/expenses.';

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 2: Fix existing Advance settlements that have wrong payment method
-- ═══════════════════════════════════════════════════════════════════════

-- Update existing Advance settlements to use payment_method = 'None'
UPDATE entries
SET
  payment_method = 'None',
  updated_at = NOW()
WHERE is_settlement = true
  AND settlement_type = 'advance'
  AND payment_method != 'None';

-- Log migration results
DO $$
DECLARE
  v_fixed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_fixed_count
  FROM entries
  WHERE is_settlement = true
    AND settlement_type = 'advance'
    AND payment_method = 'None';

  RAISE NOTICE '✅ Fixed Advance Settlement Logic:';
  RAISE NOTICE '   - Advance settlements using payment_method = None: %', v_fixed_count;
  RAISE NOTICE '   - These settlements now affect Profit only (not Cash Pulse)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Correct Flow:';
  RAISE NOTICE '   Advance created: Cash IN/OUT ✅';
  RAISE NOTICE '   Advance settled: Revenue/Expense ✅ (no cash change)';
END $$;
