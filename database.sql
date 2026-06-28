-- ============================================================================
-- BangzSalon - Complete Database Setup
-- ============================================================================
-- This file contains everything needed to set up the BangzSalon database
-- Run this in your Supabase SQL Editor after deleting all existing tables
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  per_person_target_aed DECIMAL(10,2) NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai'),
  is_active BOOLEAN DEFAULT true
);

-- If employees already existed without this column, add it (safe to re-run)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS per_person_target_aed DECIMAL(10,2) NOT NULL DEFAULT 30;

-- Services table
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category TEXT DEFAULT 'service',
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai'),
  updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai')
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card')),
  subtotal DECIMAL(10,2) NOT NULL,
  tips DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  transaction_date TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai'),
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai')
);

-- Transaction items (services in each transaction)
CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INTEGER DEFAULT 1
);

-- Operational expenses (admin & manager entry; no employee attribution)
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

-- Users table (for authentication)
-- Note: In production, use Supabase Auth instead
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai')
);

-- Existing databases were created with role IN ('admin','employee') only.
-- CREATE TABLE IF NOT EXISTS does not update constraints, so fix the check before seed data.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'manager', 'employee'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_employee ON transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean setup)
DROP POLICY IF EXISTS "Anyone can view active employees" ON employees;
DROP POLICY IF EXISTS "Admins can manage employees" ON employees;
DROP POLICY IF EXISTS "Anyone can view services" ON services;
DROP POLICY IF EXISTS "Admins can manage services" ON services;
DROP POLICY IF EXISTS "Employees can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can create transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view transaction items" ON transaction_items;
DROP POLICY IF EXISTS "Authenticated users can create transaction items" ON transaction_items;
DROP POLICY IF EXISTS "Allow user authentication queries" ON users;
DROP POLICY IF EXISTS "Allow user creation" ON users;
DROP POLICY IF EXISTS "Anyone can view expenses" ON expenses;
DROP POLICY IF EXISTS "Anyone can insert expenses" ON expenses;

-- Policies for employees table
CREATE POLICY "Anyone can view active employees"
ON employees FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage employees"
ON employees FOR ALL
USING (true); -- In production, check user role

-- Policies for services table
CREATE POLICY "Anyone can view services"
ON services FOR SELECT
USING (true);

CREATE POLICY "Admins can manage services"
ON services FOR ALL
USING (true); -- In production, check user role

-- Policies for transactions table
CREATE POLICY "Employees can view own transactions"
ON transactions FOR SELECT
USING (true); -- In production, check employee_id matches user's employee_id

CREATE POLICY "Admins can view all transactions"
ON transactions FOR SELECT
USING (true); -- In production, check user role

CREATE POLICY "Authenticated users can create transactions"
ON transactions FOR INSERT
WITH CHECK (true); -- In production, validate employee_id

-- Policies for transaction_items table
CREATE POLICY "Users can view transaction items"
ON transaction_items FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create transaction items"
ON transaction_items FOR INSERT
WITH CHECK (true);

-- Policies for users table (needed for authentication)
CREATE POLICY "Allow user authentication queries"
ON users FOR SELECT
USING (true);

CREATE POLICY "Allow user creation"
ON users FOR INSERT
WITH CHECK (true);

-- Policies for expenses (tighten in production with real auth)
CREATE POLICY "Anyone can view expenses"
ON expenses FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert expenses"
ON expenses FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- TEST DATA
-- ============================================================================

-- Demo stylist (employee role: own sales only) and desk manager (transaction entry + full salon views)
DO $$
DECLARE
    stylist_id UUID;
    manager_emp_id UUID;
BEGIN
    INSERT INTO employees (name, phone)
    VALUES ('Demo Stylist', '+971501111111')
    RETURNING id INTO stylist_id;

    INSERT INTO users (email, password_hash, role, employee_id)
    VALUES ('stylist@bangzsalon.com', 'stylist123', 'employee', stylist_id)
    ON CONFLICT (email) DO NOTHING;

    INSERT INTO employees (name, phone)
    VALUES ('Demo Manager', '+971502222222')
    RETURNING id INTO manager_emp_id;

    INSERT INTO users (email, password_hash, role, employee_id)
    VALUES ('manager@bangzsalon.com', 'manager123', 'manager', manager_emp_id)
    ON CONFLICT (email) DO NOTHING;
END $$;

-- Create an admin user (no employee_id needed)
INSERT INTO users (email, password_hash, role) 
VALUES ('admin@bangzsalon.com', 'Admin@123', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Create sample services
INSERT INTO services (name, price, category) VALUES
    ('Haircut', 50.00, 'service'),
    ('Hair Color', 150.00, 'service'),
    ('Hair Styling', 80.00, 'service'),
    ('Beard Trim', 30.00, 'service'),
    ('Shampoo', 20.00, 'service'),
    ('Hair Product', 25.00, 'product')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Display created users
SELECT 
    u.id,
    u.email,
    u.role,
    e.name as employee_name,
    e.phone as employee_phone
FROM users u
LEFT JOIN employees e ON u.employee_id = e.id
ORDER BY u.role, u.email;

-- Display created employees
SELECT id, name, phone, is_active, created_at
FROM employees
ORDER BY created_at;

-- Display created services
SELECT id, name, price, category, created_at
FROM services
ORDER BY category, name;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- Login Credentials (demo):
--   Admin:    admin@bangzsalon.com / Admin@123
--   Manager:  manager@bangzsalon.com / manager123  (new entries + full salon dashboard/calendar)
--   Stylist:  stylist@bangzsalon.com / stylist123  (own transactions only)
--
-- Existing database migration (run once if upgrading from older schema):
--   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
--   ALTER TABLE users ADD CONSTRAINT users_role_check
--     CHECK (role IN ('admin', 'manager', 'employee'));
--   UPDATE users SET role = 'manager' WHERE role = 'employee';
--   (Then change any account back to 'employee' in Supabase or admin UI if they should be stylists only.)
--
-- Stylist dashboard target (per customer, service subtotal):
--   employees.per_person_target_aed (default 30). If the column is missing on an old DB, run:
--   ALTER TABLE employees ADD COLUMN IF NOT EXISTS per_person_target_aed DECIMAL(10,2) NOT NULL DEFAULT 30;
--
-- Expenses table (admin/manager): copy the CREATE TABLE expenses ... block and indexes/policies from
--   this file if your database was created before expenses existed.
--
-- For production:
--   1. Use Supabase Auth instead of custom users table
--   2. Implement proper password hashing (bcrypt)
--   3. Update RLS policies to check auth.uid() and user roles properly
--   4. Restrict policies based on actual authentication
--
-- ============================================================================

