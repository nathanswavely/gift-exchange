# Givers draw their own name

## Status

accepted (2026-10-19)

## Decision

The Organizer's **Draw** still makes every **Pairing** at once, sealed (ADR-0001), and emails
everyone. What changes is what a Giver sees: not their Recipient's name, but a stocking with
a name in it, and they draw it themselves. That moment is the **Reveal**.

- **To the Giver it is the draw.** The email says there is a name waiting; the page says
  "draw your name"; one tap and a woven name label slides up out of a knit stocking. Nothing
  on the page says the Pairing was made earlier, because to the person drawing there is no
  difference: the slip they pull was shuffled into the stocking at random either way.
- **Before a Reveal, nothing shows.** Not on the home page, not on the Exchange page, and
  the email never carries a name (as before). After it, the label stays, with the way to
  their Recipient's Wish list.
- **A Managed Person's name is drawn by whoever manages them**, each separately.
- **A change puts the slip back.** A **Re-pairing** or **Redraw** that changes a Giver's
  Recipient clears their Reveal and emails them to draw again. Givers whose Recipient did
  not change keep theirs.
- **The Organizer sees progress, not Pairings.** "6 of 8 have drawn", and the names of who
  has not yet. Never what anyone drew.
- **Stocking and woven label**, in the textile finish's own materials (its tag is already a
  woven label). With reduced motion, the label simply appears.

## Considered Options

**A live draw.** Nothing decided until each person clicks; each click picks from the names
still in the stocking, limited to those that leave everyone else a valid draw. Truly drawn
at that moment, but two people drawing in the same second, keeping Repeats to a minimum
without knowing the order, and Re-pairing a half-drawn stocking are each real work, and to
the person drawing it looks exactly the same. Rejected.

**Telling Givers the draw was already made.** Accurate and pointless: it changes nothing
about fairness and takes the moment away. Drawnames does the same thing we do.

**A hat of paper slips** (the classic), or **a gift to unwrap**. Paper belongs to the print
finish, not the textile one; unwrapping is the wrong metaphor for drawing a person.

## Consequences

- `pairings` gains `revealed_at`. Every write that changes a Giver's Recipient clears it.
- The Draw's email becomes "a name is waiting for you"; the Re-pairing email becomes "your
  name changed, come draw again".
- The Organizer's Exchange page gains the progress line. It reads only `revealed_at IS
  NULL` per Giver, which says nothing about who has whom.
- A reminder to those who have not drawn is left for later; Organizers will text family.
