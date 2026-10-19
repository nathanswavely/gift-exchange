# A Removed Person leaves everything; a drawn Exchange waits for its Organizer

## Status

accepted (2026-10-19). Nathan chose to leave drawn Exchanges to their Organizers "for
now". Follows swavely-lol ADR-0003, which has the Hub list who was Removed and each
Tool delete what it holds.

## Decision

Within the hour of someone being **Removed** from swavely.lol, the hourly purge
(`src/lib/purge.ts`) deletes, for that Person:

- their **Wish list**, with every **Claim** on it, and every Claim they made on anyone
  else's, so the Item is free to claim again;
- every **Exclusion** they are either end of, and their place in every **Group**, as an
  Organizer or not;
- their place in every **Exchange**: as a **Participant**, in any **Fixed pairing**, and
  in every **Pairing**, open, drawn or done.

The purge never Re-pairs and never emails. In an Exchange that is **drawn** and not yet
done, dropping their Pairings leaves their **Giver** with nobody to buy for (and the
person they bought for with no Giver). Until an Organizer acts:

- that Giver, and whoever manages them, sees that their name was withdrawn and that an
  email will come with a new one;
- the Exchange's Organizers see how many people have nobody to buy for, never who, and a
  "Re-pair now" button. Pressing it runs the usual **Re-pairing**: only the Givers who
  must change get a new name and the usual email, and a **Repeat** still needs the
  Organizer's yes.

Groups and Exchanges they created stay; they belong to everyone in them.

## Considered Options

**Re-pair automatically, falling back to the Organizer.** Built first: a Removal usually
reaches Nathan rather than the Group's Organizer, who might not notice someone left. But
it has a cron emailing family members at a moment nobody chose, about a change nobody
in the Group made. Not for now; the code for it was `runDraw(env, ex, 'repair', false)`
in the purge, and could come back.

**Allow Repeats to get a Re-pairing through.** Never: Repeats need an Organizer's yes
(CONTEXT.md, "Repeat").

**Redraw.** Every Giver emailed and every Pairing changed, for one person leaving. No.

## Consequences

- An Organizer has to look at the Exchange to notice. Nothing tells them by email; if
  that proves a problem, a notice to the Group's Organizers is the next step.
- The Organizer learns only a count (ADR-0001 holds).
- `npm run test:removal` proves it end to end against the seed family, including the
  Organizer pressing Re-pair.
