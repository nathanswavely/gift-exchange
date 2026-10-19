-- How far this Tool has read the Hub's list of Removed People (swavely-lol ADR-0003):
-- the latest removed_at it has acted on. One row; the purge in src/lib/purge.ts moves it.
CREATE TABLE IF NOT EXISTS hub_cursor (
  name   TEXT PRIMARY KEY,                   -- 'removed'
  value  INTEGER NOT NULL                    -- unix seconds
);
