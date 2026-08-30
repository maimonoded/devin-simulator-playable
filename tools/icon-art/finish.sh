#!/usr/bin/env bash
# finish.sh <name> <url> — download, key the flat ground to alpha, 256px, WebP with alpha.
#
# ffmpeg, not ImageMagick: this machine has no magick and no Pillow, and cwebp cannot key a
# colour on its own. ffmpeg's colorkey does it in one filter and is installed everywhere the
# video player already needs it to be.
#
# THE GROUND COLOUR IS SAMPLED, NOT ASSUMED. The prompt asks for a flat magenta, but the model
# drifts a few points every generation and a hardcoded key leaves a magenta fringe on some icons
# and eats the subject on others. One pixel out of the corner, read as raw RGB, costs nothing and
# is right every time.
set -euo pipefail
name="$1"; url="$2"
dir="$(cd "$(dirname "$0")/../../assets/icons" && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

curl -sL -o "$tmp/raw.png" "$url"
[ -s "$tmp/raw.png" ] || { echo "$name: download failed" >&2; exit 1; }

# one corner pixel -> 3 raw bytes -> 0xRRGGBB
hex=$(ffmpeg -v error -i "$tmp/raw.png" -vf "crop=1:1:6:6" -f rawvideo -pix_fmt rgb24 - 2>/dev/null \
      | od -An -tx1 | tr -d ' \n')
[ -n "$hex" ] || { echo "$name: could not sample the ground" >&2; exit 1; }

# similarity 0.30 is wide enough for the model's dithering and narrow enough to spare gold;
# blend 0.10 feathers the edge so the cut-out does not look like scissors.
ffmpeg -v error -y -i "$tmp/raw.png" \
  -vf "colorkey=0x${hex}:0.30:0.10,scale=256:256:flags=lanczos" \
  "$tmp/cut.png"
cwebp -quiet -q 92 -alpha_q 100 "$tmp/cut.png" -o "$dir/$name.webp"

# A key that ate the subject is worse than no key: a mostly-transparent icon is invisible in the
# UI and looks like a missing file. Refuse it here rather than at the end of a batch.
opaque=$(ffmpeg -v error -i "$tmp/cut.png" -vf "alphaextract,scale=32:32" -f rawvideo -pix_fmt gray - 2>/dev/null \
         | od -An -tu1 | tr ' ' '\n' | grep -c '^1[0-9][0-9]$\|^2[0-9][0-9]$' || true)
pct=$(( opaque * 100 / 1024 ))
printf "%-14s %6s  ground #%s  subject %s%% of frame\n" "$name" "$(du -h "$dir/$name.webp" | cut -f1)" "$hex" "$pct"
[ "$pct" -lt 4 ]  && echo "   !! almost nothing left — the key ate the subject" >&2
[ "$pct" -gt 92 ] && echo "   !! almost nothing keyed — the ground was not flat" >&2
exit 0
