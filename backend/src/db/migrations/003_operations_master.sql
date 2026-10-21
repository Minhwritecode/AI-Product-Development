CREATE TABLE IF NOT EXISTS staff_profiles (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  station_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, email)
);

CREATE TABLE IF NOT EXISTS staff_roles (
  staff_id TEXT NOT NULL REFERENCES staff_profiles(id),
  role_code TEXT NOT NULL REFERENCES roles(code),
  PRIMARY KEY (staff_id, role_code)
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  label TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'OPEN', 'CLOSED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS shift_assignments (
  id TEXT PRIMARY KEY,
  shift_id TEXT NOT NULL REFERENCES shifts(id),
  staff_id TEXT NOT NULL REFERENCES staff_profiles(id),
  role_code TEXT NOT NULL REFERENCES roles(code),
  station_code TEXT,
  status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED', 'ACCEPTED', 'DECLINED', 'COMPLETED')),
  UNIQUE (shift_id, staff_id)
);

CREATE TABLE IF NOT EXISTS operational_tasks (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('SHIFT', 'QR_REQUEST', 'QUEUE', 'EXCEPTION', 'MANUAL')),
  source_id TEXT,
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  required_role TEXT REFERENCES roles(code),
  station_code TEXT,
  owner_id TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLAIMED', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CANCELLED')),
  resolution_note TEXT,
  escalation_level INTEGER NOT NULL DEFAULT 0 CHECK (escalation_level >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'EXPIRED')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  purchase_unit TEXT NOT NULL,
  stock_unit TEXT NOT NULL,
  purchase_to_stock NUMERIC(18,6) NOT NULL CHECK (purchase_to_stock > 0),
  standard_cost NUMERIC(18,2) NOT NULL CHECK (standard_cost >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, code)
);

CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1 CHECK (sort_order > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  category_id TEXT NOT NULL REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(18,2) NOT NULL CHECK (price >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'VND',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'UNAVAILABLE', 'INACTIVE')),
  allergen_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  station_code TEXT NOT NULL CHECK (station_code IN ('KITCHEN', 'BAR')),
  published_version_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_versions (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  version INTEGER NOT NULL CHECK (version > 0),
  price NUMERIC(18,2) NOT NULL CHECK (price >= 0),
  effective_from TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  UNIQUE (menu_item_id, version)
);

CREATE TABLE IF NOT EXISTS modifier_groups (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  name TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS modifier_options (
  id TEXT PRIMARY KEY,
  modifier_group_id TEXT NOT NULL REFERENCES modifier_groups(id),
  label TEXT NOT NULL,
  price_delta NUMERIC(18,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipe_versions (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  station_code TEXT NOT NULL CHECK (station_code IN ('KITCHEN', 'BAR')),
  published_at TIMESTAMPTZ,
  UNIQUE (menu_item_id, version)
);

CREATE TABLE IF NOT EXISTS recipe_lines (
  recipe_version_id TEXT NOT NULL REFERENCES recipe_versions(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  quantity NUMERIC(18,6) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  PRIMARY KEY (recipe_version_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_branch ON staff_profiles(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_branch_time ON shifts(branch_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_tasks_branch_status ON operational_tasks(branch_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_notification_events_delivery ON notification_events(status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_ingredients_restaurant ON ingredients(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_suppliers_restaurant ON suppliers(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_menu_versions_item ON menu_versions(menu_item_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_recipe_versions_item ON recipe_versions(menu_item_id, version DESC);
