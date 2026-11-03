CREATE TABLE IF NOT EXISTS stock_reorder_points (
  location_id TEXT NOT NULL REFERENCES stock_locations(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  reorder_point NUMERIC(18,6) NOT NULL CHECK (reorder_point >= 0),
  unit TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_reorder_points_location ON stock_reorder_points(location_id, ingredient_id);
