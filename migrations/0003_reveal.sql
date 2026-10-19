-- Givers draw their own name (ADR-0003). A Pairing is made at the Draw; its Giver sees it
-- only once they Reveal it. NULL means the name is still in the stocking. Any write that
-- changes a Giver's Recipient sets it back to NULL.
ALTER TABLE pairings ADD COLUMN revealed_at INTEGER;
