# Gift exchange

A family gift exchange at `swavely.lol/gifts`, built to replace Drawnames: draw names,
keep a wish list, and see what everyone else would like, without anyone, the organizer
included, being able to peek at who drew whom.

A Tool of the [swavely.lol hub](https://github.com/nathanswavely/swavely-lol), which
signs people in and sends the email. Start with [CONTEXT.md](CONTEXT.md) for the words.

## What it does

- **Groups and Exchanges.** A Group is a family circle that exchanges every year; an
  Exchange is one year of it, with a gift date and an optional budget.
- **The draw follows the rules:** nobody draws themselves; *Exclusions* (one way, so
  spouses are two); *Fixed pairings* ("Mom always has Grandpa"); and no *Repeat* of last
  year's Recipient unless the Organizer agrees there is no other way, and then as few as
  possible.
- **Sealed.** Each person sees only their own Recipient
  ([ADR-0001](docs/adr/0001-sealed-means-sealed-from-everyone.md)). When someone drops
  out or joins, a *Re-pairing* changes only the Givers who must change and emails just
  them; a *Redraw* starts over.
- **Wish lists** carry over year to year. Anyone who shares a Group can see yours and
  mark "I'm getting this", which you never see.
- **Managed people.** Kids and grandparents without email are drawn like anyone else;
  the people who look after them keep their list and see who they drew.

## How the draw works

[src/lib/draw.ts](src/lib/draw.ts) treats every draw as a minimum-cost assignment
(the Hungarian method). Forbidden pairs cost effectively infinity, a Repeat costs a
million, changing someone's current Recipient during a Re-pairing costs a thousand, and
a little random noise picks among equally good answers. One solver gives the draw, the
fewest-repeats fallback and the minimal Re-pairing. `npm test` checks the rules over
thousands of random draws.

## Running it

Run the [Hub](https://github.com/nathanswavely/swavely-lol) first (port 4331), then:

```
cp .dev.vars.example .dev.vars
npm install
npm run db:migrate:local && npm run db:seed:local
npm run dev                      # http://localhost:4332/gifts
```

The seed is the Hub's made-up family with last year's exchange already drawn.

## Deploying

After the Hub (the D1 database `gift-exchange` already exists), run
`npm run deploy`. No secrets: mail goes through the Hub.
