-- The gift exchange (CONTEXT.md). People are the Hub's: every *_id naming a person is
-- a Hub Person id, never an email or a name.

CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_by  TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

-- Who is in a Group, and who runs it.
CREATE TABLE IF NOT EXISTS group_people (
  group_id    TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  person_id   TEXT NOT NULL,
  organizer   INTEGER NOT NULL DEFAULT 0,
  added_at    INTEGER NOT NULL,
  PRIMARY KEY (group_id, person_id)
);
CREATE INDEX IF NOT EXISTS group_people_person ON group_people (person_id);

-- One way: giver never draws recipient, in this Group.
CREATE TABLE IF NOT EXISTS exclusions (
  group_id     TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  giver_id     TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  PRIMARY KEY (group_id, giver_id, recipient_id)
);

-- One year of a Group. Open until drawn_at is set; done once gift_date has passed.
CREATE TABLE IF NOT EXISTS exchanges (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  gift_date   TEXT NOT NULL,                 -- YYYY-MM-DD
  budget      TEXT,                          -- free text: "about $50"
  drawn_at    INTEGER,
  created_by  TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS exchanges_group_date ON exchanges (group_id, gift_date);

CREATE TABLE IF NOT EXISTS participants (
  exchange_id TEXT NOT NULL REFERENCES exchanges (id) ON DELETE CASCADE,
  person_id   TEXT NOT NULL,
  PRIMARY KEY (exchange_id, person_id)
);

-- Set by an Organizer before the Draw; the Draw keeps them.
CREATE TABLE IF NOT EXISTS fixed_pairings (
  exchange_id  TEXT NOT NULL REFERENCES exchanges (id) ON DELETE CASCADE,
  giver_id     TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  PRIMARY KEY (exchange_id, giver_id)
);

-- Sealed (ADR-0001): no page reads this table except for a Giver's own row.
CREATE TABLE IF NOT EXISTS pairings (
  exchange_id  TEXT NOT NULL REFERENCES exchanges (id) ON DELETE CASCADE,
  giver_id     TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  made_at      INTEGER NOT NULL,
  PRIMARY KEY (exchange_id, giver_id)
);

-- One Wish list per Person, whatever Groups they are in.
CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,
  person_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  url         TEXT,
  note        TEXT,
  price       TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS items_person ON items (person_id, created_at);

-- "I'm getting this." Hidden from the Item's own Person.
CREATE TABLE IF NOT EXISTS claims (
  item_id     TEXT PRIMARY KEY REFERENCES items (id) ON DELETE CASCADE,
  claimer_id  TEXT NOT NULL,
  claimed_at  INTEGER NOT NULL
);
