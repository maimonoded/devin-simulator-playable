# The Status Estate

Six tiers of one building, from a bedsit over a chip shop to a clifftop villa with a helipad.

GDD §3.5 puts an **estate at the centre of the board** that upgrades visually with Status level —
the passive-progress anchor that makes Status visible while you roll, the way builder landmarks
used to be. `estate.js` is the manifest; the engine is
[`js/ui/estate3d.js`](../../js/ui/estate3d.js).

## One tier per band

There are six tiers and six named status bands (`STATUS_RANKS` in
[`../status/status.js`](../status/README.md)), five levels apart. That pairing is deliberate:
reaching a new band is the moment your **title** changes *and* the moment the **house** changes,
which is one beat instead of two. The engine derives the tier from the level rather than storing
it, so re-cutting the bands re-cuts the estate for free — and `Estate3D.validate()` refuses a
tier that opens where no band does.

## How it is drawn

An **upright plane standing on the board**, not a sprite. A sprite (or any camera-facing quad)
has one depth for the whole quad, so a die landing in front of the estate's feet would be
measured against its middle and vanish behind the whole building. See CLAUDE.md, "Nothing on the
board fades or hides".

The face is a canvas painted once per level change: the art inside a rounded frame with a
vignette, then a plaque carrying the band icon, the tier's name, the level and the level bar. The
art is a painted scene on its own ground rather than a cut-out, so it is *framed* rather than
pasted — a hard rectangular edge floating over the ring reads as a mistake, a framed one reads as
a portrait of the place.

Tapping it opens the profile, which is what the estate is a picture of.

## The files

`items/tier1.webp` … `items/tier6.webp`, portrait, 384px wide, ~30 KB each. Generated with
Scenario. A missing file is not fatal — the plaque alone still says where you are.
