/**
 * The Draw, Redraw and Re-pairing, as one problem: give every Participant exactly one
 * Recipient, as a minimum-cost assignment (CONTEXT.md, "The draw").
 *
 *   - never bent: nobody draws themselves; Exclusions; Fixed pairings;
 *   - a Repeat (last year's Recipient again) costs REPEAT, so the solver avoids it and,
 *     when it cannot, uses the fewest;
 *   - in a Re-pairing, keeping a Giver's current Recipient is free and changing it
 *     costs CHANGE, so only those who must are re-paired; REPEAT outweighs any number
 *     of changes, so a Re-pairing never trades a Repeat for fewer emails;
 *   - a little noise on every cost picks at random among the equally good answers.
 *
 * Nothing here reads the database or knows a name; it takes ids and returns ids, so it
 * can be tested on its own (scripts/test-draw.ts).
 */

const FORBIDDEN = 1e9;
const REPEAT = 1e6;
const CHANGE = 1e3;
const NOISE = 1; // below CHANGE / n for any group this Tool will see

export interface DrawInput {
  participants: string[];
  /** One way: [giver, recipient] that must not happen. */
  exclusions: [string, string][];
  /** [giver, recipient] that must happen. */
  fixed: [string, string][];
  /** Last year's Pairings in this Group, giver -> recipient. */
  previous: Map<string, string>;
  /** Re-pairing only: the Pairings as they stand, giver -> recipient. */
  current?: Map<string, string>;
  allowRepeats: boolean;
  random?: () => number;
}

export type DrawResult =
  | { ok: true; pairs: Map<string, string>; repeats: number; changed: string[] }
  | { ok: false; reason: 'too_few' | 'impossible' | 'needs_repeats'; repeats?: number };

export function draw(input: DrawInput): DrawResult {
  const people = [...new Set(input.participants)];
  const n = people.length;
  if (n < 2) return { ok: false, reason: 'too_few' };
  const rand = input.random ?? Math.random;

  const excluded = new Set(input.exclusions.map(([g, r]) => `${g}>${r}`));
  const fixedFor = new Map<string, string>();
  const fixedTo = new Map<string, string>();
  for (const [g, r] of input.fixed) {
    if (!people.includes(g) || !people.includes(r)) continue; // a Fixed pairing with someone sitting out does not apply
    fixedFor.set(g, r);
    fixedTo.set(r, g);
  }

  const cost: number[][] = people.map((g) =>
    people.map((r) => {
      if (g === r) return FORBIDDEN;
      if (excluded.has(`${g}>${r}`)) return FORBIDDEN;
      if (fixedFor.has(g) && fixedFor.get(g) !== r) return FORBIDDEN;
      if (fixedTo.has(r) && fixedTo.get(r) !== g) return FORBIDDEN;
      let c = rand() * NOISE;
      if (input.previous.get(g) === r) c += REPEAT;
      if (input.current && input.current.get(g) !== r) c += CHANGE;
      return c;
    }),
  );

  const assignment = hungarian(cost);
  const pairs = new Map<string, string>();
  let repeats = 0;
  for (let i = 0; i < n; i++) {
    const j = assignment[i];
    if (cost[i][j] >= FORBIDDEN) return { ok: false, reason: 'impossible' };
    pairs.set(people[i], people[j]);
    if (input.previous.get(people[i]) === people[j]) repeats++;
  }
  if (repeats > 0 && !input.allowRepeats) return { ok: false, reason: 'needs_repeats', repeats };

  const changed = people.filter((g) => input.current?.get(g) !== pairs.get(g));
  return { ok: true, pairs, repeats, changed };
}

/**
 * Minimum-cost perfect assignment on a square matrix (the Hungarian method with
 * potentials, O(n^3)). Returns, for each row, the column it is assigned.
 */
export function hungarian(a: number[][]): number[] {
  const n = a.length;
  const INF = Number.POSITIVE_INFINITY;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0); // p[j]: row matched to column j (1-based)
  const way = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(INF);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const result = new Array<number>(n).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j] > 0) result[p[j] - 1] = j - 1;
  return result;
}
