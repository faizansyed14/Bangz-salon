-- ============================================================================
-- Fix Service Deletion Constraint
-- ============================================================================
-- This script updates the foreign key constraint to allow service deletion
-- by setting service_id to NULL in transaction_items (preserves history)
-- ============================================================================

-- Drop the existing foreign key constraint
ALTER TABLE transaction_items 
DROP CONSTRAINT IF EXISTS transaction_items_service_id_fkey;

-- Recreate it with ON DELETE SET NULL
ALTER TABLE transaction_items 
ADD CONSTRAINT transaction_items_service_id_fkey 
FOREIGN KEY (service_id) 
REFERENCES services(id) 
ON DELETE SET NULL;

-- ============================================================================
-- Verification
-- ============================================================================
-- After running this, you should be able to delete services even if they
-- have been used in transactions. The transaction_items will keep the
-- service_name and price (denormalized data), but service_id will be NULL.
-- ============================================================================

