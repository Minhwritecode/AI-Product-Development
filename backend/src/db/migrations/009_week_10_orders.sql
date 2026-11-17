CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  service_session_id TEXT NOT NULL REFERENCES service_sessions(id),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'CANCELLED')),
  round_number INTEGER NOT NULL CHECK (round_number > 0),
  course_policy TEXT NOT NULL DEFAULT 'AS_READY' CHECK (course_policy IN ('AS_READY', 'SERVE_TOGETHER')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orders_session_status ON orders(service_session_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS order_lines (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  item_name TEXT NOT NULL,
  unit_price NUMERIC(18,2) NOT NULL CHECK (unit_price >= 0),
  currency CHAR(3) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  modifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  allergen_note TEXT,
  guest_note TEXT,
  station_code TEXT NOT NULL CHECK (station_code IN ('KITCHEN', 'BAR'))
);

CREATE TABLE IF NOT EXISTS foh_requests (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  service_session_id TEXT NOT NULL REFERENCES service_sessions(id),
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'ACKNOWLEDGED', 'REJECTED', 'COMPLETED')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_by TEXT REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_foh_requests_branch_status ON foh_requests(branch_id, status, created_at DESC);

ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS qr_token_version INTEGER NOT NULL DEFAULT 1;
