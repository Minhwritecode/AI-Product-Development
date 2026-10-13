CREATE TABLE IF NOT EXISTS restaurant_memberships (
  user_id TEXT NOT NULL REFERENCES users(id),
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  PRIMARY KEY (user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_memberships_user ON restaurant_memberships (user_id);
