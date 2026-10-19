#!/usr/bin/env bash
# Copy Liquid Textile from a git ref of a checkout on disk into src/styles/liquid-textile/
# and record which commit was copied. Usage:
#
#   scripts/sync-liquid-textile.sh [path-to-liquid-textile] [ref]
#   (defaults: ../liquid-textile, origin/main)
#
# Reads the ref, not the working tree: the checkout is often behind its origin, so the
# script fetches first. The package is private, so this stands in for `npm install`
# until it is published.
set -euo pipefail

src="${1:-../liquid-textile}"
ref="${2:-origin/main}"
dest="$(dirname "$0")/../src/styles/liquid-textile"

git -C "$src" fetch -q origin
files=(index.css foundation.css base.css liquid-textile.css patterns.css textures.css raw.css liquid-textile.js behaviors.js skins/lol.css LICENSE)
mkdir -p "$dest/skins"
for f in "${files[@]}"; do
  git -C "$src" show "$ref:$f" > "$dest/$f"
done

sha="$(git -C "$src" rev-parse --short "$ref")"
date="$(git -C "$src" log -1 --format=%cs "$ref")"
subject="$(git -C "$src" log -1 --format=%s "$ref")"
today="$(date +%F)"

node - "$dest/VENDORED.md" "$sha" "$date" "$subject" "$today" <<'EOF'
const fs = require('fs');
const [path, sha, date, subject, today] = process.argv.slice(2);
let s = fs.readFileSync(path, 'utf8');
s = s.replace(/^- Source commit: .*$/m, `- Source commit: \`${sha}\` (${date}, "${subject}")`);
s = s.replace(/^- Copied: .*$/m, `- Copied: ${today} by \`scripts/sync-liquid-textile.sh\``);
fs.writeFileSync(path, s);
EOF

echo "liquid-textile synced at $sha"
