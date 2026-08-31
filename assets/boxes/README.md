# Packs — the only way anything is collected

Three of them (GDD §4.5), defined in [`js/config.js`](../../js/config.js) as `boxTiers` and opened
by [`js/boxes.js`](../../js/boxes.js). The art here is what the player taps.

```
assets/boxes/
  silver.webp  gold.webp  insider.webp    the store's shelf art
  models/box.glb  models/box-gold.glb     the thing you actually tap
```

## REAL MONEY BUYS MONEY, AND ONLY MONEY BUYS PACKS

§8.4, and it is a standing constraint rather than a preference. A pack has **no dollar price** —
the store's only dollar prices are on coins. A paid loot box sitting beside a wagering mechanic
draws regulatory attention well beyond either alone, and the separation costs the design nothing
because coins still buy everything.

## A pack is two things at once

`items` (how many draws it makes) **and** how its `table` is weighted. Premium is not Standard
with better odds — it is three draws against a table with rarity floors on some rows, which is
what makes the tiers feel different rather than merely priced differently.

A table row's `kind` is resolved by `Boxes.drawDrop()`:

| kind | pays |
|---|---|
| `card` | one card from the Season catalogue, at or above `floor` — a **guarantee, not a target** |
| `clue` | one clue for the episode being worked on |
| `status` | a status item nobody owns yet, by its own `box` weight |
| `coins` | `amount`, scaled by `cfg.boardScale` |
| `energy` | `amount`, topped up toward the cap and never reducing a purchased overflow |

## The Insider

§6.5. Two fields on the tier make it what it is:

- **`clue: "fresh"`** — one clue you do **not** already hold, drawn off the top and *on top of*
  its three card draws. Paying for the guarantee with a card slot would make it a worse card pack
  rather than a story one. It is the pack you buy when the story has stalled.
- **`escalates: true`** — its price climbs by `cfg.insiderStep` for every Insider bought since
  the last episode unlocked, and resets the moment one does (`Collection.claimUnlocked`). That is
  what caps sprint speed **by design** rather than by a cooldown: a player can always buy the
  next clue, and can never buy ten of them cheaply. The store says so on the card, because a
  price that climbs without explaining itself reads as a bug.

`Boxes.buyEvents()` spends **and** opens, in one place — so the store, a Status milestone and the
auto-play session cannot disagree about what a pack costs or about the Insider's counter.

**Every empty case falls forward rather than paying nothing**: a rarity floor with nothing
authored above it falls DOWN to a commoner one, a clue with the whole story already unlocked
falls to coins, and a status outcome with the shelf full falls to coins. A pack always pays.

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
