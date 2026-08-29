#!/usr/bin/env bash
#
# One generated image → the file the game loads.
#
#   tools/card-art/finish-card.sh <card-id> <signed-url>
#
# Scenario returns something around 864x1152 and a megabyte. A card is drawn at
# roughly 200px across and there are 150 of them, so it is downscaled to 420px
# and re-encoded: ~35 KB each, ~5 MB for the Season. Run from the repo root.
set -euo pipefail

id="${1:?card id}"; url="${2:?signed url}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -fsSL -o "$tmp/raw" "$url"
sips -s format png "$tmp/raw" --out "$tmp/x.png" >/dev/null 2>&1
sips --resampleWidth 420 "$tmp/x.png"            >/dev/null 2>&1
cwebp -quiet -q 82 "$tmp/x.png" -o "assets/cards/s1/$id.webp"

echo "$id  $(wc -c < "assets/cards/s1/$id.webp") bytes"
