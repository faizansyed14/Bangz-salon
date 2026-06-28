-- ============================================================================
-- EXPENSES ONLY — safe add-on for existing BangzSalon / Supabase databases
-- ============================================================================
-- Run this once in Supabase → SQL Editor.
-- Does NOT alter employees, users, transactions, services, or any seed data.
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS where needed.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Table: expenses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL CHECK (category IN ('tea', 'tea_cups', 'other')),
  custom_name TEXT,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  expense_date TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai'),
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai'),
  CONSTRAINT expenses_other_requires_name CHECK (
    category <> 'other'
    OR (custom_name IS NOT NULL AND length(trim(custom_name)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- ---------------------------------------------------------------------------
-- Row Level Security (matches your app’s anon client pattern)
-- ---------------------------------------------------------------------------
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view expenses" ON expenses;
DROP POLICY IF EXISTS "Anyone can insert expenses" ON expenses;

CREATE POLICY "Anyone can view expenses"
ON expenses FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert expenses"
ON expenses FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- Done. Optional: verify
-- ============================================================================
-- SELECT COUNT(*) FROM expenses;
-- SELECT * FROM expenses ORDER BY expense_date DESC LIMIT 5;
