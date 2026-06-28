-- ============================================================================
-- Real salon services — aligned with BangzSalon `services` table
-- ============================================================================
-- 1) Deletes ONLY the six demo rows from database.sql (matched by exact
--    name + price + category so your real services are not removed).
-- 2) Upserts your 28 real services (same UUIDs as your export).
--
-- Schema: id, name, price, category, created_at, updated_at
-- Category is `service` so items appear under "Services" in New Entry.
--
-- Run in Supabase SQL Editor. Safe to re-run.
-- If `transaction_items` referenced a demo service, service_id becomes NULL
--   (ON DELETE SET NULL) — historical lines stay, link to service is cleared.
-- ============================================================================

-- Step 1: remove demo seed services (from database.sql)
DELETE FROM public.services
WHERE (name, price, category) IN (
  ('Haircut', 50.00, 'service'),
  ('Hair Color', 150.00, 'service'),
  ('Hair Styling', 80.00, 'service'),
  ('Beard Trim', 30.00, 'service'),
  ('Shampoo', 20.00, 'service'),
  ('Hair Product', 25.00, 'product')
);

-- Step 2: insert / update real services
INSERT INTO public.services (id, name, price, category, created_at, updated_at)
VALUES
  ('03ca1625-746f-479d-9be7-5eaf4f7d7e86', 'Hair SPA', 30.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00'),
  ('080da276-8efd-4a1e-8bc8-305d51791c93', 'Shave', 10.00, 'service', '2025-09-30 13:55:36.994747+00', '2025-09-30 13:55:36.994747+00'),
  ('15c41fa4-cc7e-48de-ba28-48002e7c29ac', 'Hair Wash', 5.00, 'service', '2025-11-03 11:14:40.1603+00', '2025-11-03 11:14:40.1603+00'),
  ('181cf131-3938-4560-8d05-714b0b817a25', 'Menicure', 30.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00'),
  ('28c4f97d-b1d9-4750-a222-506e72815ee6', 'Whiting Facial', 70.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00'),
  ('2efcdb07-c092-4467-b6ea-8cc665178832', 'White Color - Large', 150.00, 'service', '2025-10-06 20:03:40.891917+00', '2025-10-06 20:03:40.891917+00'),
  ('2f94e360-6163-4b80-a06a-b6a3a7d9f721', 'White Color - Medium', 100.00, 'service', '2025-10-06 20:03:02.206529+00', '2025-10-06 20:03:02.206529+00'),
  ('3b6caa0e-2e06-470c-9999-47970760da0c', 'Hair color Black', 25.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00'),
  ('4acde22d-4611-4984-a762-88d7e783b948', 'Highlights Color', 40.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00'),
  ('4dad7928-0d4e-474a-bf58-a3e4de6cf10d', 'Basic Hair Cut', 15.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00'),
  ('548a26d0-4350-4835-b763-2b109d986ac7', 'Pedicure', 50.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00'),
  ('57b4c37e-8ba9-451b-bde5-e751e73b28b0', 'Hair Styling', 15.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00'),
  ('5ba31714-8ea8-418f-b1ad-faa173184f5d', 'D - Tan', 20.00, 'service', '2025-11-03 11:21:02.570898+00', '2025-11-03 11:21:02.570898+00'),
  ('5db2d373-1c0e-40b2-b880-089704dbbf8e', 'Beard Color', 10.00, 'service', '2025-11-03 11:15:48.524069+00', '2025-11-03 11:15:48.524069+00'),
  ('5ebf0066-c9e6-407c-abea-745df1bec85a', 'Gold Facial', 50.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00'),
  ('768a205b-d9d5-4abb-bab7-764701ea99fc', 'Dimond Facial', 100.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00'),
  ('7b35f288-de58-4300-b89f-1d4e69ed1c8a', 'Keratin - Medium', 120.00, 'service', '2025-10-19 17:05:56.044756+00', '2025-10-19 17:05:56.044756+00'),
  ('9d041177-98bd-4a90-b0bf-6d7d56acf3d8', 'Beard Trim', 15.00, 'service', '2025-09-30 13:55:37.345717+00', '2025-09-30 13:55:37.345717+00'),
  ('9dd33411-2948-480d-8ac5-d0252571ff31', 'Stylish Color', 30.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00'),
  ('a62d3a0d-a8ca-4b88-89ce-5436628f60d6', 'Keratin - small', 100.00, 'service', '2025-10-19 17:05:37.01855+00', '2025-10-19 17:05:37.01855+00'),
  ('a926103f-2bf6-436b-a6b7-305155ded9e1', 'head massage', 15.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00'),
  ('c036bedf-a23e-49e7-98a4-34cff47325da', 'Advance Beard Color', 15.00, 'service', '2025-11-03 11:20:36.433283+00', '2025-11-03 11:20:36.433283+00'),
  ('dee2aaad-01fa-4a3d-801f-f53720a3c92b', 'Normal Scrub', 20.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00'),
  ('e41cbca9-0358-466c-806f-dc0a62ca9ec7', 'Normal Facial', 30.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00'),
  ('ea12a8bd-7563-4f36-983c-66b11f48f2b6', 'Offer -5', 55.00, 'service', '2025-09-30 13:55:34.997695+00', '2025-09-30 13:55:34.997695+00'),
  ('eb2d1990-65ab-41d6-8f33-2963887a2e85', 'Keratin - Big', 150.00, 'service', '2025-10-19 17:06:24.323185+00', '2025-10-19 17:06:24.323185+00'),
  ('fc25bf7e-27fd-4e76-92d2-3614a58cfa73', 'White Color - Small', 70.00, 'service', '2025-10-06 20:02:26.027419+00', '2025-10-06 20:02:26.027419+00'),
  ('fda2f907-f823-40f2-bcff-79c9a381aa28', 'Premium Hair Cut', 10.00, 'service', '2025-09-30 13:16:52.851199+00', '2025-09-30 13:16:52.851199+00')
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  price      = EXCLUDED.price,
  category   = EXCLUDED.category,
  updated_at = NOW() AT TIME ZONE 'Asia/Dubai';
