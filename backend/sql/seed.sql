-- backend/sql/seed.sql
-- Demo seed data for local/staging setup

-- Demo users (password for all: Demo#123)
INSERT INTO users (id, full_name, email, phone, password_hash, role, operator, status)
VALUES
  (gen_random_uuid(), 'MyCiTi Admin', 'myciti-admin@capeconnect.demo', '+27210000001', crypt('Demo#123', gen_salt('bf')), 'operator_admin', 'myciti', 'ACTIVE'),
  (gen_random_uuid(), 'Golden Arrow Admin', 'ga-admin@capeconnect.demo', '+27210000002', crypt('Demo#123', gen_salt('bf')), 'operator_admin', 'ga', 'ACTIVE'),
  (gen_random_uuid(), 'William User', 'william@capeconnect.demo', '+27210000003', crypt('Demo#123', gen_salt('bf')), 'passenger', 'myciti', 'ACTIVE'),
  (gen_random_uuid(), 'Sihle User', 'sihle@capeconnect.demo', '+27210000004', crypt('Demo#123', gen_salt('bf')), 'passenger', 'ga', 'ACTIVE')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_services (user_id, service_key)
SELECT id, operator
FROM users
WHERE operator IS NOT NULL AND btrim(operator) <> ''
ON CONFLICT (user_id, service_key) DO NOTHING;

-- Wallet bootstrap
INSERT INTO wallets (user_id, balance_cents, currency)
SELECT id, 25000, 'ZAR' FROM users WHERE role = 'passenger'
ON CONFLICT (user_id) DO NOTHING;

-- Stops (MyCiTi)
INSERT INTO stops (operator, name, code, lat, lon)
VALUES
  ('MyCiTi', 'Cape Town Station', 'MCT-CTS', -33.9250, 18.4241),
  ('MyCiTi', 'Table View Station', 'MCT-TVS', -33.8269, 18.4909),
  ('MyCiTi', 'Civic Centre', 'MCT-CC', -33.9249, 18.4241)
ON CONFLICT DO NOTHING;

-- Stops (Golden Arrow)
INSERT INTO stops (operator, name, code, lat, lon)
VALUES
  ('Golden Arrow', 'Cape Town', 'GA-CT', -33.9250, 18.4241),
  ('Golden Arrow', 'Khayelitsha', 'GA-KH', -34.0380, 18.6750),
  ('Golden Arrow', 'Bellville', 'GA-BV', -33.9000, 18.6290)
ON CONFLICT DO NOTHING;

-- Basic routes
WITH m_from AS (
  SELECT id FROM stops WHERE operator='MyCiTi' AND name='Cape Town Station' LIMIT 1
),
m_to AS (
  SELECT id FROM stops WHERE operator='MyCiTi' AND name='Table View Station' LIMIT 1
),
ga_from AS (
  SELECT id FROM stops WHERE operator='Golden Arrow' AND name='Cape Town' LIMIT 1
),
ga_to AS (
  SELECT id FROM stops WHERE operator='Golden Arrow' AND name='Khayelitsha' LIMIT 1
)
INSERT INTO routes (operator, route_code, route_name, from_stop_id, to_stop_id)
SELECT 'MyCiTi', 'MCT-101', 'Cape Town Station - Table View Station', (SELECT id FROM m_from), (SELECT id FROM m_to)
UNION ALL
SELECT 'Golden Arrow', 'GA-201', 'Cape Town - Khayelitsha', (SELECT id FROM ga_from), (SELECT id FROM ga_to)
ON CONFLICT DO NOTHING;

-- Timetable samples
INSERT INTO timetables (route_id, direction, day_type, stops_json, times_json, status, effective_from, version)
SELECT r.id, 'Outbound', 'Weekday',
       '[{"name":"Cape Town Station"},{"name":"Table View Station"}]'::jsonb,
       '["06:30","07:00","07:30","08:00"]'::jsonb,
       'PUBLISHED', CURRENT_DATE, 1
FROM routes r
WHERE r.route_code='MCT-101'
ON CONFLICT DO NOTHING;

INSERT INTO timetables (route_id, direction, day_type, stops_json, times_json, status, effective_from, version)
SELECT r.id, 'Outbound', 'Weekday',
       '[{"name":"Cape Town"},{"name":"Khayelitsha"}]'::jsonb,
       '["06:15","06:45","07:15","07:45"]'::jsonb,
       'PUBLISHED', CURRENT_DATE, 1
FROM routes r
WHERE r.route_code='GA-201'
ON CONFLICT DO NOTHING;

-- Global fare products
INSERT INTO fare_products (operator, product_key, label, journeys, price_cents)
VALUES
  ('MyCiTi', 'day1', '1 Day Pass', NULL, 9000),
  ('MyCiTi', 'day3', '3 Day Pass', NULL, 21000),
  ('MyCiTi', 'day7', '7 Day Pass', NULL, 30000),
  ('MyCiTi', 'monthly', 'Monthly Pass', NULL, 100000),
  ('Golden Arrow', 'five_ride', '5 Ride (5 journeys)', 5, 12650),
  ('Golden Arrow', 'weekly', 'Weekly (10 journeys)', 10, 23400),
  ('Golden Arrow', 'monthly', 'Monthly (48 journeys)', 48, 103000)
ON CONFLICT (operator, product_key) DO UPDATE SET
  label = EXCLUDED.label,
  journeys = EXCLUDED.journeys,
  price_cents = EXCLUDED.price_cents,
  updated_at = NOW();
