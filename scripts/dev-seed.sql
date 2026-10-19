-- A made-up Group for local development (`npm run db:seed:local`), using the Hub's seed
-- People (swavely-lol/scripts/dev-seed.sql). Never real people: the repo is public.
-- Last year's Exchange is drawn and done, so this year's draw has a "last year" to avoid.
DELETE FROM claims; DELETE FROM items; DELETE FROM pairings; DELETE FROM fixed_pairings;
DELETE FROM participants; DELETE FROM exchanges; DELETE FROM exclusions; DELETE FROM group_people; DELETE FROM groups;

INSERT INTO groups (id, name, created_by, created_at) VALUES ('g_simpsons', 'Simpson Christmas', 'p_homer', 0);
INSERT INTO group_people (group_id, person_id, organizer, added_at) VALUES
  ('g_simpsons', 'p_homer', 1, 0), ('g_simpsons', 'p_marge', 0, 0), ('g_simpsons', 'p_lisa', 0, 0),
  ('g_simpsons', 'p_bart', 0, 0), ('g_simpsons', 'p_maggie', 0, 0), ('g_simpsons', 'p_abe', 0, 0),
  ('g_simpsons', 'p_patty', 0, 0), ('g_simpsons', 'p_selma', 0, 0);
INSERT INTO exclusions (group_id, giver_id, recipient_id) VALUES
  ('g_simpsons', 'p_homer', 'p_marge'), ('g_simpsons', 'p_marge', 'p_homer'),
  ('g_simpsons', 'p_patty', 'p_homer');

INSERT INTO exchanges (id, group_id, name, gift_date, budget, drawn_at, created_by, created_at) VALUES
  ('x_2025', 'g_simpsons', 'Simpson Christmas 2025', '2025-12-25', 'about $40', 1, 'p_homer', 0),
  ('x_2026', 'g_simpsons', 'Simpson Christmas 2026', '2026-12-25', 'about $50', NULL, 'p_homer', 0);
INSERT INTO participants (exchange_id, person_id)
  SELECT 'x_2025', person_id FROM group_people WHERE group_id = 'g_simpsons';
INSERT INTO participants (exchange_id, person_id)
  SELECT 'x_2026', person_id FROM group_people WHERE group_id = 'g_simpsons';
INSERT INTO pairings (exchange_id, giver_id, recipient_id, made_at) VALUES
  ('x_2025', 'p_homer', 'p_bart', 1), ('x_2025', 'p_bart', 'p_lisa', 1), ('x_2025', 'p_lisa', 'p_marge', 1),
  ('x_2025', 'p_marge', 'p_abe', 1), ('x_2025', 'p_abe', 'p_maggie', 1), ('x_2025', 'p_maggie', 'p_patty', 1),
  ('x_2025', 'p_patty', 'p_selma', 1), ('x_2025', 'p_selma', 'p_homer', 1);

INSERT INTO items (id, person_id, name, url, note, price, created_at) VALUES
  ('i_1', 'p_homer', 'Donut maker', 'https://example.com/donut-maker', 'the big one', '$60', 1),
  ('i_2', 'p_homer', 'Bowling ball', NULL, '16 lb, engraved "Homer"', '$80', 2),
  ('i_3', 'p_bart', 'Skateboard wheels', NULL, NULL, '$25', 1),
  ('i_4', 'p_lisa', 'Saxophone reeds', NULL, 'strength 2.5', '$20', 1),
  ('i_5', 'p_lisa', 'Book on jazz history', NULL, NULL, '$30', 2);
INSERT INTO claims (item_id, claimer_id, claimed_at) VALUES ('i_1', 'p_marge', 1);
