-- ============================================================================
-- How to Create Employee Login Details
-- ============================================================================
-- This file shows you how to create employee accounts with login credentials
-- ============================================================================

-- METHOD 1: Create Employee and Login in One Step (Recommended)
-- ============================================================================
-- This automatically links the employee to the user account

DO $$
DECLARE
    employee_uuid UUID;
BEGIN
    -- Step 1: Create the employee record
    INSERT INTO employees (name, phone) 
    VALUES ('Employee Name', '+971501234567')  -- Replace with actual name and phone
    RETURNING id INTO employee_uuid;
    
    -- Step 2: Create the user account linked to the employee
    INSERT INTO users (email, password_hash, role, employee_id) 
    VALUES ('employee@example.com', 'password123', 'employee', employee_uuid)  -- Replace with actual email and password
    ON CONFLICT (email) DO NOTHING;
    
    RAISE NOTICE 'Employee created with ID: %', employee_uuid;
    RAISE NOTICE 'Login email: employee@example.com';
    RAISE NOTICE 'Login password: password123';
END $$;

-- ============================================================================
-- METHOD 2: Create Employee First, Then Login Separately
-- ============================================================================

-- Step 1: Create the employee
INSERT INTO employees (name, phone) 
VALUES ('Employee Name', '+971501234567')
RETURNING id;  -- Copy the returned UUID

-- Step 2: Use the UUID from Step 1 to create the login
-- Replace 'EMPLOYEE_UUID_HERE' with the actual UUID from Step 1
INSERT INTO users (email, password_hash, role, employee_id) 
VALUES ('employee@example.com', 'password123', 'employee', 'EMPLOYEE_UUID_HERE')
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- EXAMPLE: Create Multiple Employees
-- ============================================================================

DO $$
DECLARE
    emp1_uuid UUID;
    emp2_uuid UUID;
BEGIN
    -- Employee 1
    INSERT INTO employees (name, phone) 
    VALUES ('John Doe', '+971501111111')
    RETURNING id INTO emp1_uuid;
    
    INSERT INTO users (email, password_hash, role, employee_id) 
    VALUES ('john@bangzsalon.com', 'John@123', 'employee', emp1_uuid)
    ON CONFLICT (email) DO NOTHING;
    
    -- Employee 2
    INSERT INTO employees (name, phone) 
    VALUES ('Jane Smith', '+971502222222')
    RETURNING id INTO emp2_uuid;
    
    INSERT INTO users (email, password_hash, role, employee_id) 
    VALUES ('jane@bangzsalon.com', 'Jane@123', 'employee', emp2_uuid)
    ON CONFLICT (email) DO NOTHING;
    
    RAISE NOTICE 'Employees created successfully';
END $$;

-- ============================================================================
-- VERIFY: Check Created Employees and Their Login Details
-- ============================================================================

SELECT 
    e.id as employee_id,
    e.name as employee_name,
    e.phone,
    e.is_active,
    u.email,
    u.role,
    u.created_at as account_created
FROM employees e
LEFT JOIN users u ON u.employee_id = e.id
ORDER BY e.created_at DESC;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- 1. Employee must be created FIRST before creating the user account
-- 2. The employee_id in the users table must reference a valid employee
-- 3. Email must be unique (no duplicates)
-- 4. Password is stored as plain text (for demo purposes)
-- 5. Role must be 'employee' for employee accounts
-- 6. Use METHOD 1 (DO block) to ensure the employee and user are linked correctly
--
-- ============================================================================

