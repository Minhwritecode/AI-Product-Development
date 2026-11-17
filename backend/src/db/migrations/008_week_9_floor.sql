CREATE TABLE IF NOT EXISTS service_sessions (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  table_id TEXT NOT NULL REFERENCES restaurant_tables(id),
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
  source_type TEXT NOT NULL CHECK (source_type IN ('WALK_IN', 'QUEUE', 'RESERVATION')),
  source_id TEXT,
  opened_by TEXT NOT NULL REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS table_holds (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  table_id TEXT NOT NULL REFERENCES restaurant_tables(id),
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_table_hold
  ON table_holds(table_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_service_session_table
  ON service_sessions(table_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_service_sessions_branch_opened
  ON service_sessions(branch_id, opened_at DESC);

CREATE TABLE IF NOT EXISTS cleaning_tasks (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  table_id TEXT NOT NULL REFERENCES restaurant_tables(id),
  session_id TEXT REFERENCES service_sessions(id),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLAIMED', 'COMPLETE')),
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL', 'HIGH')),
  claimed_by TEXT REFERENCES users(id),
  completed_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_open_cleaning_table
  ON cleaning_tasks(table_id) WHERE status IN ('OPEN', 'CLAIMED');
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_branch_status
  ON cleaning_tasks(branch_id, status, created_at);

ALTER TABLE restaurant_tables DROP CONSTRAINT IF EXISTS restaurant_tables_status_check;
ALTER TABLE restaurant_tables ADD CONSTRAINT restaurant_tables_status_check
  CHECK (status IN ('READY', 'HELD', 'BLOCKED', 'MAINTENANCE', 'INACTIVE', 'IN_USE', 'WAITING_CLEANING', 'CLEANING'));
