#!/usr/bin/env bash
# Install generated card art into assets/cards/.
#
#     install-cards.sh back.png joker-victoria.png joker-simon.png
#
# Each argument is a downloaded PNG. It is downscaled to 728 tall and written into
# assets/cards/ under the BASENAME it already carries — so the file you pass must already be
# named for the card it is (back, joker-victoria, joker-simon). That is deliberate: naming the
# destination here as well would give two places to get it wrong, and the loader in
# js/ui/card-art.js keys off the name.
#
# 728 tall because the card renders at roughly one tile on the board. Anything larger is bytes
# nobody sees, and these live in git.
#
# Resizing prefers sips (every Mac has it), then Pillow, and if neither is available it copies
# the file through and says so — a large card is a working card, and refusing to install would
# be worse than installing an oversized one.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
dest="$repo/assets/cards"
height=728

[ $# -gt 0 ] || { sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 2; }
mkdir -p "$dest"

for src in "$@"; do
  [ -f "$src" ] || { echo "missing: $src" >&2; exit 1; }
  name="$(basename "$src")"
  out="$dest/$name"

  if command -v sips >/dev/null 2>&1; then
    sips -Z "$height" "$src" --out "$out" >/dev/null
  elif python3 -c "import PIL" >/dev/null 2>&1; then
    python3 - "$src" "$out" "$height" <<'PY'
import sys
from PIL import Image
src, out, h = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src)
im.resize((round(im.width * h / im.height), h), Image.LANCZOS).save(out)
PY
  else
    cp "$src" "$out"
    echo "note    no sips and no Pillow — installed $name at full size" >&2
  fi

  printf 'installed %-24s %s\n' "$name" "$(du -h "$out" | cut -f1)"
done

echo
echo "Now look at them in the game — on a WHITE background, which is the only way a"
echo "transparent hole shows up. See SKILL.md, \"Installing\"."
