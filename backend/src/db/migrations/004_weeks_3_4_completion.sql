CREATE TABLE IF NOT EXISTS station_assignments (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  staff_id TEXT NOT NULL REFERENCES staff_profiles(id),
  role_code TEXT NOT NULL REFERENCES roles(code),
  station_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_station_assignment_active
  ON station_assignments (staff_id, station_code)
  WHERE status = 'ACTIVE' AND effective_to IS NULL;

CREATE TABLE IF NOT EXISTS unit_catalog (
  code TEXT PRIMARY KEY,
  dimension TEXT NOT NULL CHECK (dimension IN ('MASS', 'VOLUME', 'COUNT')),
  to_base NUMERIC(18,6) NOT NULL CHECK (to_base > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE IF NOT EXISTS allergens (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE IF NOT EXISTS menu_item_allergens (
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  allergen_code TEXT NOT NULL REFERENCES allergens(code),
  PRIMARY KEY (menu_item_id, allergen_code)
);

ALTER TABLE recipe_lines ADD COLUMN IF NOT EXISTS canonical_quantity NUMERIC(18,6);
CREATE INDEX IF NOT EXISTS idx_station_assignments_branch ON station_assignments(branch_id, status, effective_from);
CREATE INDEX IF NOT EXISTS idx_menu_item_allergens_item ON menu_item_allergens(menu_item_id);
