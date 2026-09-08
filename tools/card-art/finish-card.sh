#!/usr/bin/env bash
#
# One generated image → the file the game loads.
#
#   tools/card-art/finish-card.sh <card-id> <signed-url>
#   OUT_DIR=assets/cards/clues tools/card-art/finish-card.sh keys <signed-url>
#
# Scenario returns around 864x1152 and about a megabyte. A card is drawn at
# roughly 200px across and there are 150 of them, so it is downscaled to 420px
# and re-encoded: ~35 KB each, ~5 MB for the Season.
#
# ---- ONE COMMAND, AND IT IS NOT macOS-ONLY ----
#
# cwebp reads WebP as well as writing it, and resizes on the way through, so the
# whole job is a single call. This script used to spend two steps in `sips`
# getting a PNG for it -- which pinned the pipeline to macOS for no gain, and is
# exactly the kind of thing that turns handing work to another machine into an
# afternoon. The two produce byte-identical output; the detour was never doing
# anything.
#
# ImageMagick is the fallback, and a cwebp too old to read WebP input drops back
# to decoding first. Run from the repo root.
set -euo pipefail

id="${1:?usage: finish-card.sh <card-id> <signed-url>}"
url="${2:?usage: finish-card.sh <card-id> <signed-url>}"
out_dir="${OUT_DIR:-assets/cards/s1}"
width="${WIDTH:-420}"
quality="${QUALITY:-82}"

[ -d "$out_dir" ] || { echo "finish-card.sh: no such directory: $out_dir" >&2; exit 1; }
out="$out_dir/$id.webp"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -fsSL -o "$tmp/raw" "$url"
[ -s "$tmp/raw" ] || { echo "finish-card.sh: downloaded nothing for $id" >&2; exit 1; }

encode() {           # encode <source-file>
  cwebp -quiet -resize "$width" 0 -q "$quality" "$1" -o "$out"
}

if command -v cwebp >/dev/null 2>&1 && encode "$tmp/raw" 2>/dev/null; then
  :                                             # one call, and done
elif command -v magick >/dev/null 2>&1; then
  magick "$tmp/raw" -resize "${width}x" -quality "$quality" "$out"
elif command -v convert >/dev/null 2>&1; then
  convert "$tmp/raw" -resize "${width}x" -quality "$quality" "$out"
elif command -v cwebp >/dev/null 2>&1 && { command -v dwebp >/dev/null 2>&1 || command -v sips >/dev/null 2>&1; }; then
  # A cwebp older than 1.0 cannot open a WebP, so decode to PNG and re-enter.
  if command -v dwebp >/dev/null 2>&1; then dwebp -quiet "$tmp/raw" -o "$tmp/x.png"
  else sips -s format png "$tmp/raw" --out "$tmp/x.png" >/dev/null 2>&1; fi
  encode "$tmp/x.png"
else
  echo "finish-card.sh: need cwebp (libwebp-tools) or ImageMagick with WebP support." >&2
  exit 1
fi

[ -s "$out" ] || { echo "finish-card.sh: $out was not written" >&2; exit 1; }
echo "$id  $(wc -c < "$out" | tr -d ' ') bytes  ->  $out"
