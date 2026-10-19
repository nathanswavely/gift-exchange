# A Removed Person leaves everything, and a drawn Exchange re-pairs itself

## Status

proposed (2026-10-19), waiting on Nathan for the drawn Exchange. Follows swavely-lol
ADR-0003, which has the Hub list who was Removed and each Tool delete what it holds.

## Decision

Within the hour of someone being **Removed** from swavely.lol, the hourly purge
(`src/lib/purge.ts`) deletes, for that Person:

- their **Wish list**, with every **Claim** on it, and every Claim they made on anyone
  else's, so the Item is free to claim again;
- every **Exclusion** they are either end of, and their place in every **Group**, as an
  Organizer or not;
- their place in every **Exchange**: as a **Participant**, in any **Fixed pairing**, and
  in the **Pairings** of an Exchange that is open (there are none yet) or done (history,
  which only ever served as "last year" for them).

An Exchange that is **drawn** and not yet done is **Re-paired** without them, exactly as
if an Organizer had unticked them: only the **Givers** who must change get a new name, and
each gets the usual email, which never carries one. If no Re-pairing exists without a
**Repeat**, or at all, the purge does not decide for the Organizer: it drops the
Pairings they were in, the Exchange's Organizers see "Re-pair now" with a count and no
names, and the Giver left without a Recipient is told a new name is on its way.

Groups and Exchanges they created stay; they belong to everyone in them.

## Considered Options

**Never touch a drawn Exchange automatically.** Drop their Pairings and wait for an
Organizer every time. Safer in that nobody is emailed by a cron, but a Removal usually
comes to Nathan, not to the Group's Organizer, who may not know anyone left; a Giver
could sit for weeks with nobody to buy for. Kept only as the fallback.

**Allow Repeats to get a Re-pairing through.** Never: Repeats need an Organizer's yes
(CONTEXT.md, "Repeat").

**Redraw.** Every Giver emailed and every Pairing changed, for one person leaving. No.

## Consequences

- Removing someone can send email: their Giver, and at most one other, are told to look
  again. That is the same email an Organizer's Re-pairing sends.
- Organizers learn that a Giver has nobody only when the automatic Re-pairing could not
  happen, and only as a count (ADR-0001 holds).
- `npm run test:removal` proves all of it end to end against the seed family.
