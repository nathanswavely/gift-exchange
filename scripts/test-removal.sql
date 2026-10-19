-- For scripts/test-removal.mjs, on top of scripts/dev-seed.sql. Never real people.
--
-- A tight Group: this year Patty, Selma and Abe are drawn, and last year Patty and Selma
-- had each other. Once Abe is Removed, the only draw left repeats last year, so the
-- Organizer's Re-pairing must ask before allowing a Repeat.
INSERT INTO groups (id, name, created_by, created_at) VALUES ('g_tight', 'Tight three', 'p_homer', 0);
INSERT INTO group_people (group_id, person_id, organizer, added_at) VALUES
  ('g_tight', 'p_homer', 1, 0), ('g_tight', 'p_patty', 0, 0), ('g_tight', 'p_selma', 0, 0), ('g_tight', 'p_abe', 0, 0);
INSERT INTO exchanges (id, group_id, name, gift_date, budget, drawn_at, created_by, created_at) VALUES
  ('x_tprev', 'g_tight', 'Tight 2025', '2025-12-25', NULL, 1, 'p_homer', 0),
  ('x_tnow',  'g_tight', 'Tight 2026', '2099-12-25', NULL, 1, 'p_homer', 0);
INSERT INTO participants (exchange_id, person_id) VALUES
  ('x_tprev', 'p_patty'), ('x_tprev', 'p_selma'), ('x_tnow', 'p_patty'), ('x_tnow', 'p_selma'), ('x_tnow', 'p_abe');
INSERT INTO pairings (exchange_id, giver_id, recipient_id, made_at) VALUES
  ('x_tprev', 'p_patty', 'p_selma', 1), ('x_tprev', 'p_selma', 'p_patty', 1),
  ('x_tnow', 'p_patty', 'p_abe', 1), ('x_tnow', 'p_abe', 'p_selma', 1), ('x_tnow', 'p_selma', 'p_patty', 1);

-- Two Simpson Exchanges far enough ahead never to be done: x_draw, which the test
-- draws, and x_open, never drawn. Lisa has a Fixed pairing in x_open and an Exclusion
-- to lose, Abe has a Wish list with Selma's Claim on it and has claimed one of Lisa's.
INSERT INTO exchanges (id, group_id, name, gift_date, budget, drawn_at, created_by, created_at) VALUES
  ('x_draw', 'g_simpsons', 'Simpson Christmas 2098', '2098-12-25', NULL, NULL, 'p_homer', 0),
  ('x_open', 'g_simpsons', 'Simpson Christmas 2099', '2099-12-25', NULL, NULL, 'p_homer', 0);
INSERT INTO participants (exchange_id, person_id) SELECT 'x_draw', person_id FROM group_people WHERE group_id = 'g_simpsons';
INSERT INTO participants (exchange_id, person_id) SELECT 'x_open', person_id FROM group_people WHERE group_id = 'g_simpsons';
INSERT INTO fixed_pairings (exchange_id, giver_id, recipient_id) VALUES ('x_open', 'p_lisa', 'p_abe');
INSERT INTO exclusions (group_id, giver_id, recipient_id) VALUES ('g_simpsons', 'p_bart', 'p_lisa');
INSERT INTO items (id, person_id, name, url, note, price, created_at) VALUES ('i_abe', 'p_abe', 'Hearing aid batteries', NULL, NULL, NULL, 1);
INSERT INTO claims (item_id, claimer_id, claimed_at) VALUES ('i_abe', 'p_selma', 1), ('i_4', 'p_abe', 1);
