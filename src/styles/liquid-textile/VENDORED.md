# Liquid Textile, vendored

These files are a copy of [nathanswavely/liquid-textile](https://github.com/nathanswavely/liquid-textile),
the Textilemorphism design system, MIT licensed (see `LICENSE` here).

- Source commit: `fb992a8` (2026-10-18, "Merge pull request #8 from nathanswavely/lol-skin")
- Copied: 2026-10-18 by `scripts/sync-liquid-textile.sh`

**Why a copy and not a dependency.** The package is `private: true`, so npm cannot fetch
it. When it is published, replace this directory with `npm install liquid-textile` and
change the `@import` lines in `src/styles/global.css`.

**Do not edit these files here.** Change them upstream, then re-run
`scripts/sync-liquid-textile.sh`, which updates the commit line above.
