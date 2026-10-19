import { getExchange, runDraw, type Exchange } from './data';

/**
 * Removed People (swavely-lol ADR-0003). The Hub keeps a list of everyone it has
 * removed; on a schedule (src/worker.ts) this Tool reads what is new on it and deletes
 * everything it holds of each: their Wish list and its Claims, the Claims they made,
 * their Exclusions both ways, their place in every Group, and their place in every
 * Exchange.
 *
 * An Exchange that is drawn and not yet done is the one that needs care: its Pairings
 * are Sealed and someone is now missing from them. It is Re-paired the way an Organizer
 * would after unticking them, so only their Giver gets a new name (and the usual email,
 * which never carries one). When the rules allow no Re-pairing without a Repeat, or at
 * all, their Pairings are simply dropped, and the Exchange asks its Organizers to
 * Re-pair (`unpairedGivers` in data.ts).
 *
 * Safe to run twice: someone already gone matches no rows.
 */

const CURSOR = 'removed';

export async function purgeRemoved(env: ToolEnv): Promise<{ removed: number }> {
  const db = env.DB;
  const since = (await db.prepare('SELECT value FROM hub_cursor WHERE name = ?1').bind(CURSOR).first<{ value: number }>())?.value ?? 0;
  const removed = await env.HUB.removedSince(since);
  for (const r of removed) await purgePerson(env, r.id);
  if (removed.length) {
    await db
      .prepare('INSERT INTO hub_cursor (name, value) VALUES (?1, ?2) ON CONFLICT (name) DO UPDATE SET value = excluded.value')
      .bind(CURSOR, removed[removed.length - 1].removedAt)
      .run();
  }
  return { removed: removed.length };
}

export interface PurgeResult {
  /** Drawn Exchanges Re-paired without them. */
  repaired: string[];
  /** Drawn Exchanges left for an Organizer to Re-pair. */
  waiting: string[];
}

export async function purgePerson(env: ToolEnv, personId: string): Promise<PurgeResult> {
  const db = env.DB;
  const { results } = await db
    .prepare(
      `SELECT exchange_id FROM participants WHERE person_id = ?1
       UNION SELECT exchange_id FROM fixed_pairings WHERE giver_id = ?1 OR recipient_id = ?1
       UNION SELECT exchange_id FROM pairings WHERE giver_id = ?1 OR recipient_id = ?1`,
    )
    .bind(personId)
    .all<{ exchange_id: string }>();
  const exchanges = (await Promise.all(results.map((r) => getExchange(db, r.exchange_id)))).filter((x): x is Exchange => !!x);
  const drawn = exchanges.filter((x) => x.state === 'drawn');
  const settled = exchanges.filter((x) => x.state !== 'drawn'); // open: no Pairings yet; done: history

  await db.batch([
    db.prepare('DELETE FROM claims WHERE claimer_id = ?1 OR item_id IN (SELECT id FROM items WHERE person_id = ?1)').bind(personId),
    db.prepare('DELETE FROM items WHERE person_id = ?1').bind(personId),
    db.prepare('DELETE FROM exclusions WHERE giver_id = ?1 OR recipient_id = ?1').bind(personId),
    db.prepare('DELETE FROM group_people WHERE person_id = ?1').bind(personId),
    db.prepare('DELETE FROM participants WHERE person_id = ?1').bind(personId),
    db.prepare('DELETE FROM fixed_pairings WHERE giver_id = ?1 OR recipient_id = ?1').bind(personId),
    ...settled.map((x) => db.prepare('DELETE FROM pairings WHERE exchange_id = ?1 AND (giver_id = ?2 OR recipient_id = ?2)').bind(x.id, personId)),
  ]);

  const result: PurgeResult = { repaired: [], waiting: [] };
  for (const ex of drawn) {
    // They are no longer a Participant, so the Re-pairing leaves them out and keeps
    // every Pairing it can; it rewrites the whole draw, theirs included.
    const outcome = await runDraw(env, ex, 'repair', false);
    if (outcome.ok) {
      result.repaired.push(ex.id);
    } else {
      await db.prepare('DELETE FROM pairings WHERE exchange_id = ?1 AND (giver_id = ?2 OR recipient_id = ?2)').bind(ex.id, personId).run();
      result.waiting.push(ex.id);
    }
  }
  console.log(`purge ${personId}: ${exchanges.length} exchanges, ${result.repaired.length} re-paired, ${result.waiting.length} waiting for an Organizer`);
  return result;
}
