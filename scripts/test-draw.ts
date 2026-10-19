/**
 * The Draw's rules, checked many times over at random. Run with `npm test`
 * (node --experimental-strip-types). Exits non-zero on the first broken rule.
 */
import { draw, hungarian } from '../src/lib/draw.ts';

let failures = 0;
const check = (ok: boolean, what: string) => { if (!ok) { failures++; console.error('FAIL', what); } };

// The solver itself: a known optimum.
const h = hungarian([[4, 1, 3], [2, 0, 5], [3, 2, 2]]);
check(h.join() === '1,0,2', `hungarian picks the cheapest assignment (got ${h})`);

const fam = ['homer', 'marge', 'bart', 'lisa', 'maggie', 'abe', 'patty', 'selma'];
const spouses: [string, string][] = [['homer', 'marge'], ['marge', 'homer']];

for (let run = 0; run < 2000; run++) {
  const r = draw({ participants: fam, exclusions: spouses, fixed: [['abe', 'maggie']], previous: new Map(), allowRepeats: false });
  if (!r.ok) { check(false, `a roomy draw succeeds (${r.reason})`); break; }
  const recipients = new Set(r.pairs.values());
  check(r.pairs.size === fam.length && recipients.size === fam.length, 'everyone gives once and receives once');
  for (const [g, rec] of r.pairs) check(g !== rec, 'nobody draws themselves');
  check(r.pairs.get('homer') !== 'marge' && r.pairs.get('marge') !== 'homer', 'Exclusions hold');
  check(r.pairs.get('abe') === 'maggie', 'Fixed pairings hold');
}

// Randomness: over many draws Homer gets more than one Recipient.
const seen = new Set<string>();
for (let run = 0; run < 200; run++) {
  const r = draw({ participants: fam, exclusions: [], fixed: [], previous: new Map(), allowRepeats: false });
  if (r.ok) seen.add(r.pairs.get('homer')!);
}
check(seen.size >= 5, `the draw is random (Homer drew ${seen.size} different people)`);

// No Repeats when there is room.
const lastYear = draw({ participants: fam, exclusions: spouses, fixed: [], previous: new Map(), allowRepeats: false });
if (lastYear.ok) {
  for (let run = 0; run < 500; run++) {
    const r = draw({ participants: fam, exclusions: spouses, fixed: [], previous: lastYear.pairs, allowRepeats: false });
    check(r.ok && r.repeats === 0, 'no Repeats when a draw without them exists');
    if (r.ok) for (const [g, rec] of r.pairs) check(lastYear.pairs.get(g) !== rec, 'nobody has last year\'s Recipient');
  }
}

// Two people who had each other: no draw without a Repeat, and asking says so.
const pair = ['a', 'b'];
const prev = new Map([['a', 'b'], ['b', 'a']]);
const tight = draw({ participants: pair, exclusions: [], fixed: [], previous: prev, allowRepeats: false });
check(!tight.ok && tight.reason === 'needs_repeats' && tight.repeats === 2, 'too tight a Group asks before repeating');
const allowed = draw({ participants: pair, exclusions: [], fixed: [], previous: prev, allowRepeats: true });
check(allowed.ok && allowed.repeats === 2, 'allowing Repeats then draws');

// Fewest Repeats: three people, last year a cycle; the reverse cycle has none.
const tri = ['a', 'b', 'c'];
const triPrev = new Map([['a', 'b'], ['b', 'c'], ['c', 'a']]);
const triR = draw({ participants: tri, exclusions: [], fixed: [], previous: triPrev, allowRepeats: false });
check(triR.ok && triR.pairs.get('a') === 'c' && triR.pairs.get('b') === 'a' && triR.pairs.get('c') === 'b', 'three people avoid last year by reversing');

// Impossible: two spouses excluded both ways and nobody else.
const imp = draw({ participants: ['homer', 'marge'], exclusions: spouses, fixed: [], previous: new Map(), allowRepeats: true });
check(!imp.ok && imp.reason === 'impossible', 'Exclusions that leave no draw are reported, never bent');
check(!draw({ participants: ['solo'], exclusions: [], fixed: [], previous: new Map(), allowRepeats: true }).ok, 'one person cannot draw');

// Re-pairing: Bart leaves. Only his Giver changes (they take Bart's Recipient), if the rules allow.
for (let run = 0; run < 300; run++) {
  const first = draw({ participants: fam, exclusions: [], fixed: [], previous: new Map(), allowRepeats: false });
  if (!first.ok) continue;
  const without = fam.filter((p) => p !== 'bart');
  const current = new Map([...first.pairs].filter(([g]) => g !== 'bart'));
  const r = draw({ participants: without, exclusions: [], fixed: [], previous: new Map(), current, allowRepeats: false });
  if (!r.ok) { check(false, 're-pairing after someone leaves succeeds'); break; }
  const bartsGiver = [...first.pairs].find(([, rec]) => rec === 'bart')![0];
  const bartsRecipient = first.pairs.get('bart')!;
  if (bartsGiver !== bartsRecipient) {
    check(r.changed.length === 1 && r.changed[0] === bartsGiver, `only Bart's Giver is re-paired (changed: ${r.changed})`);
    check(r.pairs.get(bartsGiver) === bartsRecipient, 'they take Bart\'s Recipient');
  }
}

// Re-pairing: someone joins. Two Givers change at most: the newcomer and one other.
{
  const first = draw({ participants: fam, exclusions: [], fixed: [], previous: new Map(), allowRepeats: false });
  if (first.ok) {
    const r = draw({ participants: [...fam, 'ned'], exclusions: [], fixed: [], previous: new Map(), current: first.pairs, allowRepeats: false });
    check(r.ok && r.changed.length === 2 && r.changed.includes('ned'), `a newcomer re-pairs one other Giver (changed: ${r.ok ? r.changed : r.reason})`);
  }
}

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('draw: all rules hold');
