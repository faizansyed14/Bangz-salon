-- ============================================================================
-- BangzSalon - WhatsApp Receipt "Sent" Flag Migration
-- ============================================================================
-- Adds a nullable timestamp that records WHEN a receipt was sent on WhatsApp
-- from the manager-only WhatsApp Receipts page. Used to permanently disable
-- the "Send Receipt" button once a receipt has been sent.
--
-- SAFE: Single nullable column, no default, no backfill.
--   - Existing rows get NULL  => treated as "not sent yet".
--   - Zero impact on existing data or any other column.
-- Run AFTER migration-whatsapp-customers.sql.
-- ============================================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name = 'receipt_sent_at';

-- ============================================================================
-- ROLLBACK (run this to completely revert this feature's DB change):
--   ALTER TABLE transactions DROP COLUMN IF EXISTS receipt_sent_at;
-- This only removes the new column; all transaction rows remain untouched.
-- ============================================================================
