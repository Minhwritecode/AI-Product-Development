CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  default_currency CHAR(3) NOT NULL DEFAULT 'VND',
  default_locale TEXT NOT NULL DEFAULT 'vi-VN',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  currency CHAR(3) NOT NULL DEFAULT 'VND',
  locale TEXT NOT NULL DEFAULT 'vi-VN',
  service_hours JSONB NOT NULL DEFAULT '{"daily":{"open":"08:00","close":"23:00"}}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id),
  role_code TEXT NOT NULL REFERENCES roles(code),
  PRIMARY KEY (user_id, role_code)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_code TEXT NOT NULL REFERENCES roles(code),
  permission_code TEXT NOT NULL REFERENCES permissions(code),
  PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE IF NOT EXISTS branch_memberships (
  user_id TEXT NOT NULL REFERENCES users(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  PRIMARY KEY (user_id, branch_id)
);

CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  UNIQUE (branch_id, name)
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id TEXT PRIMARY KEY,
  area_id TEXT NOT NULL REFERENCES areas(id),
  label TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0 AND capacity <= 30),
  accessibility_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'READY' CHECK (status IN ('READY', 'BLOCKED', 'MAINTENANCE', 'INACTIVE')),
  UNIQUE (area_id, label)
);

CREATE TABLE IF NOT EXISTS session_revocations (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  branch_id TEXT REFERENCES branches(id),
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  reason TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branches_restaurant_id ON branches (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_areas_branch_id ON areas (branch_id);
CREATE INDEX IF NOT EXISTS idx_tables_area_id ON restaurant_tables (area_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_occurred ON audit_logs (branch_id, occurred_at DESC);
