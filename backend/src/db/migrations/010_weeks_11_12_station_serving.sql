ALTER TABLE ticket_snapshots DROP CONSTRAINT IF EXISTS ticket_snapshots_status_check;
ALTER TABLE ticket_snapshots ADD CONSTRAINT ticket_snapshots_status_check
  CHECK (status IN ('NEW', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'SERVED', 'DELAYED', 'REJECTED', 'CANCELLED'));

ALTER TABLE ticket_snapshots ADD COLUMN IF NOT EXISTS accepted_by TEXT REFERENCES users(id);
ALTER TABLE ticket_snapshots ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE ticket_snapshots ADD COLUMN IF NOT EXISTS prepared_by TEXT REFERENCES users(id);
ALTER TABLE ticket_snapshots ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ;
ALTER TABLE ticket_snapshots ADD COLUMN IF NOT EXISTS picked_up_by TEXT REFERENCES users(id);
ALTER TABLE ticket_snapshots ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;
ALTER TABLE ticket_snapshots ADD COLUMN IF NOT EXISTS served_by TEXT REFERENCES users(id);
ALTER TABLE ticket_snapshots ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ;
ALTER TABLE ticket_snapshots ADD COLUMN IF NOT EXISTS delayed_at TIMESTAMPTZ;
ALTER TABLE ticket_snapshots ADD COLUMN IF NOT EXISTS delay_reason TEXT;
ALTER TABLE ticket_snapshots ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE ticket_snapshots ADD COLUMN IF NOT EXISTS reject_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_ticket_snapshots_status_created ON ticket_snapshots(branch_id, status, created_at DESC);
