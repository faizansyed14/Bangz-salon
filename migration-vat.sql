-- ============================================================================
-- BangzSalon - VAT Migration
-- ============================================================================
-- Adds nullable VAT columns to the transactions table.
-- Run this in your Supabase SQL Editor BEFORE deploying the updated frontend.
--
-- SAFE: Uses ADD COLUMN IF NOT EXISTS with no default — existing rows will
-- have NULL in these columns. Old data is NOT modified.
-- New transactions created after this migration will have values populated
-- by the updated frontend.
-- ============================================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS subtotal_excl_vat DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2);

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name IN ('subtotal_excl_vat', 'vat_amount')
ORDER BY column_name;
