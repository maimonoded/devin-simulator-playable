# The Status Estate

Six tiers of one building, from a bedsit over a chip shop to a clifftop villa with a helipad.

GDD §3.5 puts an **estate at the centre of the board** that upgrades visually with Status level —
the passive-progress anchor that makes Status visible while you roll, the way builder landmarks
used to be. These are the art for it, generated with Scenario and sized down to ~30 KB each.

`items/tier1.webp` … `items/tier6.webp`, portrait, painted at 384px wide. They are drawn onto an
upright plane standing on the board — **not** a sprite, and not a DOM layer. See CLAUDE.md,
"Nothing on the board fades or hides": a camera-facing quad has one depth for the whole quad, so a
die landing in front of its feet would vanish behind the whole thing.

No code reads these yet — the estate lands in the Status phase, and the manifest that maps a
Status level to a tier comes with it.
