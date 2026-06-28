-- ============================================================================
-- BangzSalon - WhatsApp Customers Migration
-- ============================================================================
-- Creates a separate customers table for storing customer contact info
-- for WhatsApp receipts and future promotional use.
-- Also links transactions to customers via a nullable customer_id column.
--
-- SAFE: All changes are additive / nullable. Zero impact on existing data.
-- Run AFTER migration-vat.sql.
-- ============================================================================

-- 1. Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai'),
  last_visited_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai'),
  CONSTRAINT customers_whatsapp_unique UNIQUE (whatsapp_number)
);

-- 2. Link transactions → customers (nullable; ON DELETE SET NULL keeps
--    transaction history even if a customer record is later removed)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- 3. Index for fast phone-number lookups (upsert / promotional queries)
CREATE INDEX IF NOT EXISTS idx_customers_whatsapp ON customers(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);

-- 4. RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view customers" ON customers;
DROP POLICY IF EXISTS "Anyone can insert customers" ON customers;
DROP POLICY IF EXISTS "Anyone can update customers" ON customers;

CREATE POLICY "Anyone can view customers"   ON customers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert customers" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update customers" ON customers FOR UPDATE USING (true);

-- 5. Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name = 'customer_id';

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;
