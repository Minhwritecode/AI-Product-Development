CREATE TABLE IF NOT EXISTS idempotency_records (
  idempotency_key TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  command TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_locations (
  id TEXT PRIMARY KEY,
  branch_id TEXT REFERENCES branches(id),
  kind TEXT NOT NULL CHECK (kind IN ('WAREHOUSE', 'BRANCH')),
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  UNIQUE (branch_id, kind, label)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  ordered_quantity NUMERIC(18,6) NOT NULL CHECK (ordered_quantity > 0),
  received_quantity NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  unit TEXT NOT NULL,
  UNIQUE (purchase_order_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS goods_receipts (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, purchase_order_id)
);

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  goods_receipt_id TEXT NOT NULL REFERENCES goods_receipts(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  accepted_quantity NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (accepted_quantity >= 0),
  damaged_quantity NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (damaged_quantity >= 0),
  rejected_quantity NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (rejected_quantity >= 0),
  unit TEXT NOT NULL,
  note TEXT,
  PRIMARY KEY (goods_receipt_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS stock_balances (
  location_id TEXT NOT NULL REFERENCES stock_locations(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  quantity NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS inventory_ledger (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES stock_locations(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  quantity_delta NUMERIC(18,6) NOT NULL CHECK (quantity_delta <> 0),
  unit TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_requests (
  id TEXT PRIMARY KEY,
  from_location_id TEXT NOT NULL REFERENCES stock_locations(id),
  to_location_id TEXT NOT NULL REFERENCES stock_locations(id),
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'IN_TRANSIT', 'RECEIVED', 'CLOSED')),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_location_id <> to_location_id)
);

CREATE TABLE IF NOT EXISTS stock_request_lines (
  stock_request_id TEXT NOT NULL REFERENCES stock_requests(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  requested_quantity NUMERIC(18,6) NOT NULL CHECK (requested_quantity > 0),
  approved_quantity NUMERIC(18,6),
  shipped_quantity NUMERIC(18,6),
  received_quantity NUMERIC(18,6),
  unit TEXT NOT NULL,
  PRIMARY KEY (stock_request_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS daily_counts (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  business_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, business_date)
);

CREATE TABLE IF NOT EXISTS daily_count_lines (
  daily_count_id TEXT NOT NULL REFERENCES daily_counts(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  opening_quantity NUMERIC(18,6) NOT NULL CHECK (opening_quantity >= 0),
  received_quantity NUMERIC(18,6) NOT NULL CHECK (received_quantity >= 0),
  theoretical_sold_quantity NUMERIC(18,6),
  theoretical_sold_status TEXT NOT NULL CHECK (theoretical_sold_status IN ('AVAILABLE', 'NOT_AVAILABLE', 'INCOMPLETE_THEORY')),
  closing_quantity NUMERIC(18,6) NOT NULL CHECK (closing_quantity >= 0),
  variance_quantity NUMERIC(18,6) NOT NULL,
  unit TEXT NOT NULL,
  PRIMARY KEY (daily_count_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS wastage_records (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  quantity NUMERIC(18,6) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  reason TEXT NOT NULL,
  standard_price NUMERIC(18,2) NOT NULL CHECK (standard_price >= 0),
  value NUMERIC(18,2) NOT NULL CHECK (value >= 0),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch_status ON purchase_orders(branch_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_branch_status ON goods_receipts(branch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_balances_location ON stock_balances(location_id, ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_source ON inventory_ledger(source_type, source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_requests_location_status ON stock_requests(to_location_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_counts_branch_date ON daily_counts(branch_id, business_date DESC);
CREATE INDEX IF NOT EXISTS idx_wastage_branch_status ON wastage_records(branch_id, status, created_at DESC);
