# Boxes — the only way anything is collected

Three tiers, defined in [`js/config.js`](../../js/config.js) as `boxTiers` and opened by
[`js/boxes.js`](../../js/boxes.js). The art here is what the player taps.

```
assets/boxes/
  silver.webp  gold.webp  diamond.webp    the store's shelf art
  models/box.glb  models/box-gold.glb     the thing you actually tap
```

## A tier is two things at once

`items` (how many draws it makes) **and** how its `table` is weighted. A Diamond Box is not a
Silver Box with better odds — it is three draws against a table weighted at the rare end, which
is what makes the tiers feel different rather than merely priced differently.

A table row's `kind` is resolved by `Boxes.drawDrop()`:

| kind | pays |
|---|---|
| `card` | a character card at `tier`, drawn uniformly from that tier's slice of the pool |
| `clue` | a clue card, drawn uniformly from the board's clues |
| `status` | a status item nobody owns yet, by its own `box` weight |
| `coins` | `amount`, scaled by `cfg.boardScale` |
| `energy` | `amount`, topped up toward the cap and never reducing a purchased overflow |

**Every empty case falls forward rather than paying nothing**: a tier with no cards left in the
pool falls to any card, a card outcome on a board with no cards falls to a clue, and a status
outcome with the shelf full falls to coins. A box always pays.

## Where boxes come from

- **A deck tile.** Landing on 🎁 hands one over, its tier drawn from `deckBoxes` — mostly Silver,
  so a Gold off a tile is a good turn and a Diamond is a story, and the paid tiers stay worth
  paying for.
- **The store.** All three, for coins or for a dollar price.
- More later. Every source ends in `openBoxEvents()`, so a box bought is exactly a box landed on.

## Opening one

Immediately, wherever it came from, and **in the scene rather than in a dialog**. The box arrives
over the middle of the board as a real object — the same GLB that used to stand on a tile — turns
and bobs, and the player taps the mesh. If they do not, it opens **itself** after
`cfg.packAutoOpenMs` (five seconds). It swells and bursts where it stood, and the cards fly out
and hang in the air to be read.

[`js/ui/box3d.js`](../../js/ui/box3d.js) owns the objects;
[`js/ui/pack.js`](../../js/ui/pack.js) drives the beat, owns the caption and countdown (the two
things a mesh cannot say) and carries the modal fallback for when there is no WebGL. Pacing knobs
are in the "Opening a box" group of the tuning drawer.

Three tiers, two models: silver is the plain box, gold is the gold one, and diamond is the gold
mesh lit cold. One asset doing two jobs beats a third GLB that differs only in hue.

**The money is banked before the popup opens.** `Boxes.open()` adds the cards, pays the coins and
shelves the status item; the popup is told what to show, never what to pay. That is the same
split the bonus mini-games use, and it is why skipping the animation — an auto-play session, a
mid-roll error, a closed tab — can never change what the player got.

## The art

Scenario at 992 × 992, resized to 384 and encoded to WebP. Each tier is the same closed cube with
its lid slightly proud and a glow escaping the seam: silver foil with platinum ribbon, gold foil
with plum ribbon, and a crystal-faceted one lit from inside.
