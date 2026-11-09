import { runRemovals } from '@swavely-lol/kit/removals';
import { getExchange, type Exchange } from './data';

/**
 * Removed People (swavely-lol ADR-0003). The Hub keeps a list of everyone it has
 * removed; on a schedule (src/worker.ts) this Tool reads what is new on it and deletes
 * everything it holds of each: their Wish list and its Claims, the Claims they made,
 * their Exclusions both ways, their place in every Group, and their place in every
 * Exchange, Pairings included.
 *
 * A drawn Exchange that is not yet done is left to its Organizers (ADR-0002): the purge
 * never Re-pairs and never emails. Dropping the removed Person's Pairings leaves their
 * Giver with nobody, so the Giver's page says their name was withdrawn and the
 * Organizers' page offers "Re-pair now" (`unpairedGivers` in data.ts), which runs the
 * usual Re-pairing and its emails only when pressed.
 *
 * Safe to run twice: someone already gone matches no rows.
 */

/** Ask the Hub who is newly removed and purge each (the kit keeps the cursor). */
export function purgeRemoved(env: ToolEnv): Promise<{ removed: number }> {
  return runRemovals(env, purgePerson);
}

/** Delete everything this Tool holds of one Person. Returns the drawn Exchanges now waiting on an Organizer. */
export async function purgePerson(db: D1Database, personId: string): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT exchange_id FROM pairings WHERE giver_id = ?1 OR recipient_id = ?1 UNION SELECT exchange_id FROM participants WHERE person_id = ?1')
    .bind(personId)
    .all<{ exchange_id: string }>();
  const exchanges = (await Promise.all(results.map((r) => getExchange(db, r.exchange_id)))).filter((x): x is Exchange => !!x);

  await db.batch([
    db.prepare('DELETE FROM claims WHERE claimer_id = ?1 OR item_id IN (SELECT id FROM items WHERE person_id = ?1)').bind(personId),
    db.prepare('DELETE FROM items WHERE person_id = ?1').bind(personId),
    db.prepare('DELETE FROM exclusions WHERE giver_id = ?1 OR recipient_id = ?1').bind(personId),
    db.prepare('DELETE FROM group_people WHERE person_id = ?1').bind(personId),
    db.prepare('DELETE FROM participants WHERE person_id = ?1').bind(personId),
    db.prepare('DELETE FROM fixed_pairings WHERE giver_id = ?1 OR recipient_id = ?1').bind(personId),
    db.prepare('DELETE FROM pairings WHERE giver_id = ?1 OR recipient_id = ?1').bind(personId),
  ]);

  const waiting = exchanges.filter((x) => x.state === 'drawn').map((x) => x.id);
  console.log(`purge ${personId}: ${exchanges.length} exchanges, ${waiting.length} drawn and waiting for an Organizer to re-pair`);
  return waiting;
}
