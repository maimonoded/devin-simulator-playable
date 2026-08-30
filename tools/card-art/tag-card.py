#!/usr/bin/env python3
"""Point catalogue rows at the art files that now exist.

    python3 tools/card-art/tag-card.py <card-id> [<card-id> ...]

Appends `art: "<id>.webp"` to each named card in assets/cards/cards.js -- but
only once the file is actually on disk, because a row tagged with art that is
missing renders as a broken card with nothing in the console to explain it.

The regex tolerates a missing space after a comma. Three catalogue rows are
written that way, and requiring the space made one card silently skip tagging:
the art was on disk, unreferenced, and looked exactly like a card that had never
been generated. Run from the repo root.
"""
import io, os, re, sys

CAT = "assets/cards/cards.js"
ART = "assets/cards/s1"

s = io.open(CAT, encoding="utf-8").read()
tagged, missing, miss = [], [], []

for cid in sys.argv[1:]:
    if not os.path.exists(os.path.join(ART, cid + ".webp")):
        missing.append(cid); continue
    # Insert `art` immediately after `rarity`, whatever else the row carries.
    #
    # This used to anchor on the row ENDING at " }" right after the rarity, which quietly made
    # the catalogue's field list part of the tool's contract: the day a row grew a second field
    # — `kind: "status"` did it — every untagged card of that kind reported NO CATALOGUE ROW
    # MATCHED, with the art sitting on disk and nothing saying why. The negative lookahead is
    # what makes re-tagging a no-op instead, which is the only thing the old anchor was doing.
    pat = re.compile(r'(\{ id: "%s",\s*name: "[^"]*",\s*rarity: [CREL])(?!\s*,\s*art:)'
                     % re.escape(cid))
    s, n = pat.subn(r'\1, art: "%s.webp"' % cid, s)
    (tagged if n == 1 else miss).append(cid)

io.open(CAT, "w", encoding="utf-8").write(s)

print("tagged %d" % len(tagged))
if missing: print("NO FILE ON DISK:", " ".join(missing))
if miss:    print("NO CATALOGUE ROW MATCHED:", " ".join(miss))
sys.exit(1 if (missing or miss) else 0)
