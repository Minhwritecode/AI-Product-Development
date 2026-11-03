CREATE TABLE IF NOT EXISTS branch_operating_states (
  branch_id TEXT PRIMARY KEY REFERENCES branches(id),
  state TEXT NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN', 'PAUSED', 'FULL', 'CLOSED')),
  reason TEXT,
  updated_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS queue_policies (
  branch_id TEXT PRIMARY KEY REFERENCES branches(id),
  capacity INTEGER NOT NULL DEFAULT 40 CHECK (capacity > 0),
  min_party_size INTEGER NOT NULL DEFAULT 1 CHECK (min_party_size > 0),
  max_party_size INTEGER NOT NULL DEFAULT 20 CHECK (max_party_size >= min_party_size),
  base_wait_minutes INTEGER NOT NULL DEFAULT 15 CHECK (base_wait_minutes >= 0),
  wait_step_minutes INTEGER NOT NULL DEFAULT 10 CHECK (wait_step_minutes > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS queue_entries (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  queue_code TEXT NOT NULL,
  access_token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'CALLED', 'SEATED', 'LEFT', 'CANCELLED', 'EXPIRED')),
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  time_budget_minutes INTEGER NOT NULL CHECK (time_budget_minutes > 0),
  language TEXT NOT NULL CHECK (language IN ('vi', 'en')),
  nickname TEXT,
  notification_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (branch_id, queue_code)
);

CREATE TABLE IF NOT EXISTS guest_idempotency_records (
  idempotency_key TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  status TEXT NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'CONFIRMED', 'ARRIVED', 'CANCELLED', 'NO_SHOW', 'EXPIRED')),
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  reserved_for TIMESTAMPTZ NOT NULL,
  hold_until TIMESTAMPTZ,
  language TEXT NOT NULL CHECK (language IN ('vi', 'en')),
  nickname TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_entries_branch_status ON queue_entries(branch_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_reservations_branch_time ON reservations(branch_id, reserved_for, status);
