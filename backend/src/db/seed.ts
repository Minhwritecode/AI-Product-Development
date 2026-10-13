import 'dotenv/config';
import { createPool } from './pool.js';
import { hashPassword } from '../security/password.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error('DATABASE_URL is required for db:seed');

const pool = createPool(databaseUrl);

const passwordHash = hashPassword('luminex-demo', 'luminex-demo-salt');

try {
  await pool.query('BEGIN');
  await pool.query(`INSERT INTO roles (code, display_name) VALUES ('OWNER', 'Owner'), ('ADMIN', 'Admin'), ('MANAGER', 'Manager'), ('HOST', 'Host'), ('SERVER', 'Server'), ('KITCHEN', 'Kitchen'), ('BAR', 'Bar'), ('CASHIER', 'Cashier') ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO permissions (code, description) VALUES
    ('restaurant:write', 'Configure restaurant settings'),
    ('branch:write', 'Configure branch settings'),
    ('area:write', 'Configure floor areas'),
    ('table:write', 'Configure restaurant tables'),
    ('setup:read', 'Read restaurant setup')
    ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO role_permissions (role_code, permission_code)
    SELECT 'OWNER', code FROM permissions ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO restaurants (id, name) VALUES ('rest_luminex', 'Luminex Demo Restaurant') ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO branches (id, restaurant_id, name, code) VALUES ('branch_central', 'rest_luminex', 'Phố đi bộ Central', 'CENTRAL') ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO users (id, email, display_name, password_hash) VALUES ('usr_owner', 'admin@luminex.local', 'Linh Nguyễn', $1) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`, [passwordHash]);
  await pool.query(`INSERT INTO user_roles (user_id, role_code) VALUES ('usr_owner', 'OWNER') ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO restaurant_memberships (user_id, restaurant_id) VALUES ('usr_owner', 'rest_luminex') ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO branch_memberships (user_id, branch_id) VALUES ('usr_owner', 'branch_central') ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO areas (id, branch_id, name, sort_order) VALUES ('area_main', 'branch_central', 'Main floor', 1), ('area_rooftop', 'branch_central', 'Rooftop', 2) ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO restaurant_tables (id, area_id, label, capacity, accessibility_tags, status) VALUES
    ('table_01', 'area_main', 'T01', 2, '[]'::jsonb, 'READY'),
    ('table_02', 'area_main', 'T02', 4, '["window"]'::jsonb, 'READY'),
    ('table_03', 'area_main', 'T03', 6, '["family"]'::jsonb, 'READY'),
    ('table_04', 'area_rooftop', 'R01', 4, '["outdoor"]'::jsonb, 'BLOCKED')
    ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO audit_logs (action, entity_type, entity_id, request_id, reason) VALUES ('SEED', 'SYSTEM', 'platform', 'seed', 'Initial local platform fixture')`);
  await pool.query('COMMIT');
  console.log('Seeded Luminex platform fixture. Demo login: admin@luminex.local / luminex-demo');
} catch (error) {
  await pool.query('ROLLBACK');
  throw error;
} finally {
  await pool.end();
}
