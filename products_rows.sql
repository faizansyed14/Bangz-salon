-- ============================================================================
-- Real salon products — aligned with BangzSalon `services` table
-- ============================================================================
-- Products are stored in `services` with category = 'product' (see New Entry).
-- 1) Deletes ONLY the demo product row from database.sql (exact name + price
--    + category). Same row is also removed if you run services_rows.sql first.
-- 2) Upserts your 9 real products (UUIDs from your export; was product_name/cost).
--
-- Schema: id, name, price, category, created_at, updated_at
-- Category is `product` so items appear under "Products" in New Entry.
--
-- Run in Supabase SQL Editor. Safe to re-run.
-- If `transaction_items` referenced the demo product, service_id becomes NULL
--   (ON DELETE SET NULL).
-- ============================================================================

-- Step 1: remove demo seed product (from database.sql — lives in `services`)
DELETE FROM public.services
WHERE (name, price, category) IN (
  ('Hair Product', 25.00, 'product')
);

-- Step 2: insert / update real products
INSERT INTO public.services (id, name, price, category, created_at, updated_at)
VALUES
  ('00566b0c-e50f-4333-ba9b-a315f64a7f53', 'Face Cream', 50.00, 'product', '2026-01-03 12:36:14.228358+00', '2026-01-03 12:36:14.228358+00'),
  ('111623db-2dc1-4410-b8c8-ad684c25a98a', 'Hair Spray Butterfly', 40.00, 'product', '2026-01-03 12:34:59.551184+00', '2026-01-03 12:34:59.551184+00'),
  ('666b5be5-86ba-4e65-85c2-f7b3857d8af5', 'Johnny Hair Cream', 20.00, 'product', '2026-01-03 12:35:58.869376+00', '2026-01-03 12:35:58.869376+00'),
  ('74c794ec-cef8-4ca4-899c-de5ec3851bc6', 'Hair Powder', 20.00, 'product', '2026-01-03 12:33:24.97277+00', '2026-01-03 12:33:38.459965+00'),
  ('7958fa55-17fb-4c92-abeb-919511761f3a', 'Face Wash ', 10.00, 'product', '2026-01-03 12:35:25.134854+00', '2026-01-03 12:35:25.134854+00'),
  ('a8f9510e-0f81-485c-85d5-e9f94ee52a7b', 'Protein Hair Serum-10', 30.00, 'product', '2026-01-03 12:34:33.369676+00', '2026-01-03 12:34:33.369676+00'),
  ('cf1fa937-5f53-497d-8c15-056208d4bcad', 'Face Wash Advance', 15.00, 'product', '2026-01-03 12:35:40.428577+00', '2026-01-03 12:35:40.428577+00'),
  ('f19dc4e4-0411-4d3b-92b9-384eb3f8769b', 'hair wax', 15.00, 'product', '2025-11-04 12:35:29.826198+00', '2025-11-04 12:35:29.826198+00'),
  ('f663566c-c51f-4530-89e4-3f00dcbd6729', 'Advance Hair Powder', 25.00, 'product', '2026-01-03 12:34:00.07662+00', '2026-01-03 12:34:00.07662+00')
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  price      = EXCLUDED.price,
  category   = EXCLUDED.category,
  updated_at = NOW() AT TIME ZONE 'Asia/Dubai';
