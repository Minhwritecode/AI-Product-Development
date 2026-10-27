import 'dotenv/config';
import { createPool } from './pool.js';
import { hashPassword } from '../security/password.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error('DATABASE_URL is required for db:seed');

const pool = createPool(databaseUrl, {
  ssl: process.env.DATABASE_SSL !== 'false',
  rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
});

const passwordHash = hashPassword('luminex-demo', 'luminex-demo-salt');

try {
  await pool.query('BEGIN');
  await pool.query(`INSERT INTO roles (code, display_name) VALUES ('OWNER', 'Owner'), ('ADMIN', 'Admin'), ('MANAGER', 'Manager'), ('HOST', 'Host'), ('SERVER', 'Server'), ('KITCHEN', 'Kitchen'), ('BAR', 'Bar'), ('CASHIER', 'Cashier') ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO permissions (code, description) VALUES
    ('restaurant:write', 'Configure restaurant settings'),
    ('branch:write', 'Configure branch settings'),
    ('area:write', 'Configure floor areas'),
    ('table:write', 'Configure restaurant tables'),
    ('setup:read', 'Read restaurant setup'),
    ('staff:write', 'Manage branch staff'),
    ('shift:write', 'Manage shifts and assignments'),
    ('task:write', 'Manage operational tasks'),
    ('master-data:write', 'Manage restaurant master data')
    ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO role_permissions (role_code, permission_code)
    SELECT 'OWNER', code FROM permissions ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO restaurants (id, name) VALUES ('rest_luminex', 'Luminex Demo Restaurant') ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO branches (id, restaurant_id, name, code) VALUES ('branch_central', 'rest_luminex', 'Phố đi bộ Central', 'CENTRAL') ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO suppliers (id, restaurant_id, code, name) VALUES ('supplier_fresh', 'rest_luminex', 'FRESH-01', 'Fresh Farm Central') ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO ingredients (id, restaurant_id, name, purchase_unit, stock_unit, purchase_to_stock, standard_cost) VALUES
    ('ingredient_chicken', 'rest_luminex', 'Ức gà', 'kg', 'g', 1000, 125000),
    ('ingredient_coffee', 'rest_luminex', 'Cà phê hạt Arabica', 'kg', 'g', 1000, 420000),
    ('ingredient_lettuce', 'rest_luminex', 'Xà lách', 'kg', 'g', 1000, 85000)
    ON CONFLICT (id) DO NOTHING`);
  await pool.query(`INSERT INTO users (id, email, display_name, password_hash) VALUES ('usr_owner', 'admin@luminex.local', 'Linh Nguyễn', $1) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`, [passwordHash]);
  await pool.query(`INSERT INTO user_roles (user_id, role_code) VALUES ('usr_owner', 'OWNER') ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO restaurant_memberships (user_id, restaurant_id) VALUES ('usr_owner', 'rest_luminex') ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO branch_memberships (user_id, branch_id) VALUES ('usr_owner', 'branch_central') ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO unit_catalog (code, dimension, to_base) VALUES
    ('g', 'MASS', 1), ('kg', 'MASS', 1000), ('ml', 'VOLUME', 1), ('l', 'VOLUME', 1000), ('pcs', 'COUNT', 1), ('portion', 'COUNT', 1)
    ON CONFLICT (code) DO UPDATE SET dimension = EXCLUDED.dimension, to_base = EXCLUDED.to_base, status = 'ACTIVE'`);
  await pool.query(`INSERT INTO allergens (code, label) VALUES
    ('MILK', 'Sữa'), ('GLUTEN', 'Gluten'), ('EGG', 'Trứng'), ('PEANUT', 'Đậu phộng'), ('TREE_NUT', 'Hạt cây'), ('SOY', 'Đậu nành'), ('FISH', 'Cá'), ('SHELLFISH', 'Giáp xác'), ('SESAME', 'Mè')
    ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, status = 'ACTIVE'`);
  await pool.query(`INSERT INTO staff_profiles (id, branch_id, display_name, email, station_codes) VALUES
    ('staff_host', 'branch_central', 'Mai Anh', 'mai@luminex.local', '["FRONT_DESK"]'::jsonb),
    ('staff_server', 'branch_central', 'Minh Quân', 'minh@luminex.local', '["FLOOR"]'::jsonb),
    ('staff_kitchen', 'branch_central', 'Trang Bếp', 'trang@luminex.local', '["KITCHEN"]'::jsonb),
    ('staff_bar', 'branch_central', 'Huy Bar', 'huy@luminex.local', '["BAR"]'::jsonb)
    ON CONFLICT (id) DO NOTHING`);
  await pool.query(`INSERT INTO staff_roles (staff_id, role_code) VALUES
    ('staff_host', 'HOST'), ('staff_server', 'SERVER'), ('staff_kitchen', 'KITCHEN'), ('staff_bar', 'BAR')
    ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO station_assignments (id, branch_id, staff_id, role_code, station_code, effective_from) VALUES
    ('station_assign_host', 'branch_central', 'staff_host', 'HOST', 'FRONT_DESK', '2026-10-01T00:00:00+07:00'),
    ('station_assign_server', 'branch_central', 'staff_server', 'SERVER', 'FLOOR', '2026-10-01T00:00:00+07:00'),
    ('station_assign_kitchen', 'branch_central', 'staff_kitchen', 'KITCHEN', 'KITCHEN', '2026-10-01T00:00:00+07:00'),
    ('station_assign_bar', 'branch_central', 'staff_bar', 'BAR', 'BAR', '2026-10-01T00:00:00+07:00')
    ON CONFLICT (id) DO NOTHING`);
  await pool.query(`INSERT INTO areas (id, branch_id, name, sort_order) VALUES ('area_main', 'branch_central', 'Main floor', 1), ('area_rooftop', 'branch_central', 'Rooftop', 2) ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO restaurant_tables (id, area_id, label, capacity, accessibility_tags, status) VALUES
    ('table_01', 'area_main', 'T01', 2, '[]'::jsonb, 'READY'),
    ('table_02', 'area_main', 'T02', 4, '["window"]'::jsonb, 'READY'),
    ('table_03', 'area_main', 'T03', 6, '["family"]'::jsonb, 'READY'),
    ('table_04', 'area_rooftop', 'R01', 4, '["outdoor"]'::jsonb, 'BLOCKED')
    ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO stock_locations (id, branch_id, kind, label) VALUES
    ('location_warehouse', NULL, 'WAREHOUSE', 'Central warehouse'),
    ('location_branch_central', 'branch_central', 'BRANCH', 'Central branch store')
    ON CONFLICT (id) DO NOTHING`);
  await pool.query(`INSERT INTO stock_balances (location_id, ingredient_id, quantity, unit) VALUES
    ('location_warehouse', 'ingredient_chicken', 42, 'kg'),
    ('location_branch_central', 'ingredient_chicken', 8, 'kg')
    ON CONFLICT (location_id, ingredient_id) DO NOTHING`);
  await pool.query(`INSERT INTO audit_logs (action, entity_type, entity_id, request_id, reason) SELECT 'SEED', 'SYSTEM', 'platform', 'seed', 'Initial local platform fixture' WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE action = 'SEED' AND entity_type = 'SYSTEM' AND entity_id = 'platform')`);
  await pool.query('COMMIT');
  console.log('Seeded Luminex platform fixture. Demo login: admin@luminex.local / luminex-demo');
} catch (error) {
  await pool.query('ROLLBACK');
  throw error;
} finally {
  await pool.end();
}
