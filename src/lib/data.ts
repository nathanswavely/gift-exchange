import type { Person, Viewer } from './hub-contract';
import { draw } from './draw';
import { u } from './env';

/**
 * The gift exchange's reads and writes (CONTEXT.md for the words). People are the
 * Hub's; names come from it per request.
 *
 * Sealed (ADR-0001): the only query on `pairings` that pages may use is
 * `pairingsFor`, which returns a Giver's own rows. Nothing returns a whole draw.
 */

const now = () => Math.floor(Date.now() / 1000);
const today = () => new Date().toISOString().slice(0, 10);

export function newId(prefix: string): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  return prefix + [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

const marks = (n: number, from = 1) => Array.from({ length: n }, (_, i) => `?${i + from}`).join(',');

/** The People a Viewer acts as: themselves and whoever they manage. */
export function identities(viewer: Viewer): string[] {
  return [viewer.id, ...viewer.manages];
}

/** People by id, from the Hub. Anyone the Hub no longer knows is "Someone". */
export async function peopleMap(env: ToolEnv, ids: string[]): Promise<Map<string, Person>> {
  const unique = [...new Set(ids)];
  const found = unique.length ? await env.HUB.people(unique) : [];
  const map = new Map(found.map((p) => [p.id, p]));
  for (const id of unique) if (!map.has(id)) map.set(id, { id, name: 'Someone', email: null, managerIds: [] });
  return map;
}

// --------------------------------------------------------------- groups ----

export interface Group { id: string; name: string }
export interface Member { personId: string; organizer: boolean }

export async function getGroup(db: D1Database, id: string): Promise<Group | null> {
  return db.prepare('SELECT id, name FROM groups WHERE id = ?1').bind(id).first<Group>();
}

export async function allGroups(db: D1Database): Promise<Group[]> {
  return (await db.prepare('SELECT id, name FROM groups ORDER BY name COLLATE NOCASE').all<Group>()).results;
}

/** Groups any of these People are in. */
export async function groupsOf(db: D1Database, personIds: string[]): Promise<Group[]> {
  if (!personIds.length) return [];
  const { results } = await db
    .prepare(`SELECT DISTINCT g.id, g.name FROM groups g JOIN group_people gp ON gp.group_id = g.id WHERE gp.person_id IN (${marks(personIds.length)}) ORDER BY g.name COLLATE NOCASE`)
    .bind(...personIds)
    .all<Group>();
  return results;
}

export async function members(db: D1Database, groupId: string): Promise<Member[]> {
  const { results } = await db.prepare('SELECT person_id, organizer FROM group_people WHERE group_id = ?1').bind(groupId).all<{ person_id: string; organizer: number }>();
  return results.map((r) => ({ personId: r.person_id, organizer: !!r.organizer }));
}

/** May this Viewer run this Group? Its Organizers, and the Hub Admin. */
export async function canOrganize(db: D1Database, viewer: Viewer, groupId: string): Promise<boolean> {
  if (viewer.isHubAdmin) return true;
  const row = await db.prepare('SELECT 1 FROM group_people WHERE group_id = ?1 AND person_id = ?2 AND organizer = 1').bind(groupId, viewer.id).first();
  return !!row;
}

/** Is this Viewer, or someone they manage, in this Group? (The Hub Admin sees all.) */
export async function canView(db: D1Database, viewer: Viewer, groupId: string): Promise<boolean> {
  if (viewer.isHubAdmin) return true;
  const ids = identities(viewer);
  const row = await db.prepare(`SELECT 1 FROM group_people WHERE group_id = ?1 AND person_id IN (${marks(ids.length, 2)}) LIMIT 1`).bind(groupId, ...ids).first();
  return !!row;
}

/** May this Viewer see this Person's Wish list? They share a Group, or it is their own. */
export async function canSeeList(db: D1Database, viewer: Viewer, personId: string): Promise<boolean> {
  const ids = identities(viewer);
  if (ids.includes(personId) || viewer.isHubAdmin) return true;
  const row = await db
    .prepare(`SELECT 1 FROM group_people a JOIN group_people b ON a.group_id = b.group_id WHERE a.person_id = ?1 AND b.person_id IN (${marks(ids.length, 2)}) LIMIT 1`)
    .bind(personId, ...ids)
    .first();
  return !!row;
}

export async function createGroup(db: D1Database, name: string, organizerId: string, createdBy: string): Promise<string> {
  const id = newId('g_');
  const t = now();
  await db.batch([
    db.prepare('INSERT INTO groups (id, name, created_by, created_at) VALUES (?1, ?2, ?3, ?4)').bind(id, name, createdBy, t),
    db.prepare('INSERT INTO group_people (group_id, person_id, organizer, added_at) VALUES (?1, ?2, 1, ?3)').bind(id, organizerId, t),
  ]);
  return id;
}

export async function addMember(db: D1Database, groupId: string, personId: string): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO group_people (group_id, person_id, organizer, added_at) VALUES (?1, ?2, 0, ?3)').bind(groupId, personId, now()).run();
}

export async function removeMember(db: D1Database, groupId: string, personId: string): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM group_people WHERE group_id = ?1 AND person_id = ?2').bind(groupId, personId),
    db.prepare('DELETE FROM exclusions WHERE group_id = ?1 AND (giver_id = ?2 OR recipient_id = ?2)').bind(groupId, personId),
  ]);
}

export async function setOrganizer(db: D1Database, groupId: string, personId: string, on: boolean): Promise<void> {
  await db.prepare('UPDATE group_people SET organizer = ?3 WHERE group_id = ?1 AND person_id = ?2').bind(groupId, personId, on ? 1 : 0).run();
}

// ----------------------------------------------------------- exclusions ----

export async function exclusions(db: D1Database, groupId: string): Promise<[string, string][]> {
  const { results } = await db.prepare('SELECT giver_id, recipient_id FROM exclusions WHERE group_id = ?1').bind(groupId).all<{ giver_id: string; recipient_id: string }>();
  return results.map((r) => [r.giver_id, r.recipient_id]);
}

/** Replace who this Giver never draws; `mirror` adds each the other way too. */
export async function setExclusions(db: D1Database, groupId: string, giverId: string, recipientIds: string[], mirror: string[]): Promise<void> {
  const clean = recipientIds.filter((r) => r !== giverId);
  await db.batch([
    db.prepare('DELETE FROM exclusions WHERE group_id = ?1 AND giver_id = ?2').bind(groupId, giverId),
    ...clean.map((r) => db.prepare('INSERT OR IGNORE INTO exclusions (group_id, giver_id, recipient_id) VALUES (?1, ?2, ?3)').bind(groupId, giverId, r)),
    ...mirror.filter((r) => clean.includes(r)).map((r) => db.prepare('INSERT OR IGNORE INTO exclusions (group_id, giver_id, recipient_id) VALUES (?1, ?2, ?3)').bind(groupId, r, giverId)),
  ]);
}

// ------------------------------------------------------------ exchanges ----

export interface Exchange {
  id: string;
  groupId: string;
  name: string;
  giftDate: string;
  budget: string | null;
  drawnAt: number | null;
  state: 'open' | 'drawn' | 'done';
}

function toExchange(r: { id: string; group_id: string; name: string; gift_date: string; budget: string | null; drawn_at: number | null }): Exchange {
  const state = r.gift_date < today() ? 'done' : r.drawn_at ? 'drawn' : 'open';
  return { id: r.id, groupId: r.group_id, name: r.name, giftDate: r.gift_date, budget: r.budget, drawnAt: r.drawn_at, state };
}

export async function getExchange(db: D1Database, id: string): Promise<Exchange | null> {
  const r = await db.prepare('SELECT id, group_id, name, gift_date, budget, drawn_at FROM exchanges WHERE id = ?1').bind(id).first<Parameters<typeof toExchange>[0]>();
  return r ? toExchange(r) : null;
}

export async function exchangesOf(db: D1Database, groupId: string): Promise<Exchange[]> {
  const { results } = await db.prepare('SELECT id, group_id, name, gift_date, budget, drawn_at FROM exchanges WHERE group_id = ?1 ORDER BY gift_date DESC').bind(groupId).all<Parameters<typeof toExchange>[0]>();
  return results.map(toExchange);
}

export async function createExchange(db: D1Database, input: { groupId: string; name: string; giftDate: string; budget: string | null; participants: string[]; createdBy: string }): Promise<string> {
  const id = newId('x_');
  await db.batch([
    db.prepare('INSERT INTO exchanges (id, group_id, name, gift_date, budget, drawn_at, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7)').bind(id, input.groupId, input.name, input.giftDate, input.budget, input.createdBy, now()),
    ...input.participants.map((p) => db.prepare('INSERT INTO participants (exchange_id, person_id) VALUES (?1, ?2)').bind(id, p)),
  ]);
  return id;
}

export async function updateExchange(db: D1Database, id: string, input: { name: string; giftDate: string; budget: string | null }): Promise<void> {
  await db.prepare('UPDATE exchanges SET name = ?2, gift_date = ?3, budget = ?4 WHERE id = ?1').bind(id, input.name, input.giftDate, input.budget).run();
}

export async function participantsOf(db: D1Database, exchangeId: string): Promise<string[]> {
  return (await db.prepare('SELECT person_id FROM participants WHERE exchange_id = ?1').bind(exchangeId).all<{ person_id: string }>()).results.map((r) => r.person_id);
}

export async function setParticipants(db: D1Database, exchangeId: string, personIds: string[]): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM participants WHERE exchange_id = ?1').bind(exchangeId),
    ...[...new Set(personIds)].map((p) => db.prepare('INSERT INTO participants (exchange_id, person_id) VALUES (?1, ?2)').bind(exchangeId, p)),
  ]);
}

export async function fixedOf(db: D1Database, exchangeId: string): Promise<[string, string][]> {
  const { results } = await db.prepare('SELECT giver_id, recipient_id FROM fixed_pairings WHERE exchange_id = ?1').bind(exchangeId).all<{ giver_id: string; recipient_id: string }>();
  return results.map((r) => [r.giver_id, r.recipient_id]);
}

export async function setFixed(db: D1Database, exchangeId: string, giverId: string, recipientId: string | null): Promise<void> {
  const stmts = [db.prepare('DELETE FROM fixed_pairings WHERE exchange_id = ?1 AND (giver_id = ?2 OR recipient_id = ?3)').bind(exchangeId, giverId, recipientId ?? '')];
  if (recipientId && recipientId !== giverId) stmts.push(db.prepare('INSERT INTO fixed_pairings (exchange_id, giver_id, recipient_id) VALUES (?1, ?2, ?3)').bind(exchangeId, giverId, recipientId));
  await db.batch(stmts);
}

/** A Giver's own Pairings, for the People this Viewer acts as. The only window onto a draw. */
export async function pairingsFor(db: D1Database, exchangeId: string, giverIds: string[]): Promise<Map<string, string>> {
  if (!giverIds.length) return new Map();
  const { results } = await db
    .prepare(`SELECT giver_id, recipient_id FROM pairings WHERE exchange_id = ?1 AND giver_id IN (${marks(giverIds.length, 2)})`)
    .bind(exchangeId, ...giverIds)
    .all<{ giver_id: string; recipient_id: string }>();
  return new Map(results.map((r) => [r.giver_id, r.recipient_id]));
}

/**
 * How many Participants of a drawn Exchange have no Recipient: someone left after the
 * Draw (or was Removed from swavely.lol) and no Re-pairing has happened yet. A count,
 * never who.
 */
export async function unpairedGivers(db: D1Database, exchangeId: string): Promise<number> {
  const r = await db
    .prepare('SELECT COUNT(*) AS n FROM participants p WHERE p.exchange_id = ?1 AND NOT EXISTS (SELECT 1 FROM pairings q WHERE q.exchange_id = ?1 AND q.giver_id = p.person_id)')
    .bind(exchangeId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

/** Last year: the Group's most recent drawn Exchange before this one. Read by the Draw only. */
async function previousPairings(db: D1Database, ex: Exchange): Promise<Map<string, string>> {
  const prev = await db
    .prepare('SELECT id FROM exchanges WHERE group_id = ?1 AND gift_date < ?2 AND drawn_at IS NOT NULL ORDER BY gift_date DESC LIMIT 1')
    .bind(ex.groupId, ex.giftDate)
    .first<{ id: string }>();
  if (!prev) return new Map();
  const { results } = await db.prepare('SELECT giver_id, recipient_id FROM pairings WHERE exchange_id = ?1').bind(prev.id).all<{ giver_id: string; recipient_id: string }>();
  return new Map(results.map((r) => [r.giver_id, r.recipient_id]));
}

/** The whole current draw, for the solver only. Never returned to a page. */
async function currentPairings(db: D1Database, exchangeId: string): Promise<Map<string, string>> {
  const { results } = await db.prepare('SELECT giver_id, recipient_id FROM pairings WHERE exchange_id = ?1').bind(exchangeId).all<{ giver_id: string; recipient_id: string }>();
  return new Map(results.map((r) => [r.giver_id, r.recipient_id]));
}

export type DrawOutcome =
  | { ok: true; told: number; repeats: number }
  | { ok: false; reason: 'too_few' | 'impossible' | 'needs_repeats'; repeats?: number };

/**
 * Draw, Redraw or Re-pair an Exchange and tell each affected Giver to look. `mode`:
 * 'draw' and 'redraw' make every Pairing; 'repair' keeps all it can.
 */
export async function runDraw(env: ToolEnv, ex: Exchange, mode: 'draw' | 'redraw' | 'repair', allowRepeats: boolean): Promise<DrawOutcome> {
  const db = env.DB;
  const [participants, excl, fixed, previous] = await Promise.all([participantsOf(db, ex.id), exclusions(db, ex.groupId), fixedOf(db, ex.id), previousPairings(db, ex)]);
  const current = mode === 'repair' ? new Map([...(await currentPairings(db, ex.id))].filter(([g]) => participants.includes(g))) : undefined;

  const result = draw({ participants, exclusions: excl, fixed, previous, current, allowRepeats });
  if (!result.ok) return result;

  const t = now();
  await db.batch([
    db.prepare('DELETE FROM pairings WHERE exchange_id = ?1').bind(ex.id),
    ...[...result.pairs].map(([g, r]) => db.prepare('INSERT INTO pairings (exchange_id, giver_id, recipient_id, made_at) VALUES (?1, ?2, ?3, ?4)').bind(ex.id, g, r, t)),
    db.prepare('UPDATE exchanges SET drawn_at = ?2 WHERE id = ?1').bind(ex.id, t),
  ]);

  const tell = mode === 'repair' ? result.changed : participants;
  if (tell.length) {
    const again = mode !== 'draw';
    await env.HUB.notify(tell, {
      subject: again ? `You have a new name for ${ex.name}` : `Names are drawn for ${ex.name}`,
      lines: [
        again ? `The names for ${ex.name} changed, and yours with them.` : `Names are drawn for ${ex.name}.`,
        'Sign in to see who you are buying for. (We never put the name in an email.)',
      ],
      cta: { label: 'See who you have', path: u(`/exchange/${ex.id}`) },
    });
  }
  return { ok: true, told: tell.length, repeats: result.repeats };
}

// ----------------------------------------------------------- wish lists ----

export interface Item { id: string; name: string; url: string | null; note: string | null; price: string | null; claimerId: string | null }

/** A Wish list. Claims are left out when `withClaims` is false: for its own Person. */
export async function itemsOf(db: D1Database, personId: string, withClaims: boolean): Promise<Item[]> {
  const { results } = await db
    .prepare('SELECT i.id, i.name, i.url, i.note, i.price, c.claimer_id FROM items i LEFT JOIN claims c ON c.item_id = i.id WHERE i.person_id = ?1 ORDER BY i.created_at')
    .bind(personId)
    .all<{ id: string; name: string; url: string | null; note: string | null; price: string | null; claimer_id: string | null }>();
  return results.map((r) => ({ id: r.id, name: r.name, url: r.url, note: r.note, price: r.price, claimerId: withClaims ? r.claimer_id : null }));
}

export function cleanUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function saveItem(db: D1Database, personId: string, input: { id?: string; name: string; url: string | null; note: string | null; price: string | null }): Promise<void> {
  if (input.id) {
    await db.prepare('UPDATE items SET name = ?3, url = ?4, note = ?5, price = ?6 WHERE id = ?1 AND person_id = ?2').bind(input.id, personId, input.name, input.url, input.note, input.price).run();
  } else {
    await db.prepare('INSERT INTO items (id, person_id, name, url, note, price, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(newId('i_'), personId, input.name, input.url, input.note, input.price, now()).run();
  }
}

export async function deleteItem(db: D1Database, personId: string, itemId: string): Promise<void> {
  await db.prepare('DELETE FROM items WHERE id = ?1 AND person_id = ?2').bind(itemId, personId).run();
}

/** Claim an Item for someone, or let go of a Claim this Viewer (or someone they manage) made. */
export async function claim(db: D1Database, itemId: string, claimerId: string): Promise<boolean> {
  const r = await db.prepare('INSERT OR IGNORE INTO claims (item_id, claimer_id, claimed_at) VALUES (?1, ?2, ?3)').bind(itemId, claimerId, now()).run();
  return (r.meta.changes ?? 0) > 0;
}

export async function unclaim(db: D1Database, itemId: string, claimerIds: string[]): Promise<void> {
  await db.prepare(`DELETE FROM claims WHERE item_id = ?1 AND claimer_id IN (${marks(claimerIds.length, 2)})`).bind(itemId, ...claimerIds).run();
}

export async function itemOwner(db: D1Database, itemId: string): Promise<string | null> {
  return (await db.prepare('SELECT person_id FROM items WHERE id = ?1').bind(itemId).first<{ person_id: string }>())?.person_id ?? null;
}
