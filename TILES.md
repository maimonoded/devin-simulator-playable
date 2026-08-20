# The 40 tiles

The board's inventory: what every index **is**, what it is **called**, what it **prints**, and
what **art** it has. What each type *does* when you land on it is in
[js/tiles/README.md](js/tiles/README.md) and is deliberately not repeated here — that file is the
behaviour contract, this one is the roster.

## A tile has an index and a type. It does not have a name.

`tileType(i)` in [js/board-model.js](js/board-model.js) is the whole of a tile's identity: four
corner indices, two index sets, and everything else is `standard`. **Nothing anywhere stores a
per-tile name**, and nothing reads one — the label layer in
[js/ui/render.js](js/ui/render.js:88) builds exactly two spans per tile, `.ico` (the type's emoji)
and `.val` (the printed coin value).

So the "name" in the roster below is the **type's** name, lifted from the strings the type's own
file writes into the activity log and its reveal captions. All six Plot Twist tiles are called
Plot Twist; the 26 standard tiles are called nothing at all and identify themselves by their coin
value and their art. Giving them individual names is new data plus a decision about where it would
render — [there is a proposal in the appendix](#appendix--proposed-names-for-the-26-standard-tiles),
and it is only a proposal.

**Two numbering systems, both correct.** Code counts from 0; artwork counts from 1.

| | Range | Used by |
|---|---|---|
| **Index** | 0–39, clockwise from Start | `state.pos`, `tileType(i)`, `gridPos(i)`, the event list — all of `js/` |
| **File number** | 1–40 (`index + 1`) | `assets/tiles/models/N.glb`, `N.png` — so `1.glb` is Start |

The file number exists because the filename is the one part of the system a human hands to an
artist; `tileImagePath()` / `tileModelPath()` are the two lines that convert.

## The roster

Split by board edge, because that is how the board reads on screen: Start sits at the **bottom**
vertex of the diamond and indices run **clockwise** — Start → Spa (left) → VIP (top) → Premiere
(right). "Prints" is the number on the tile at the shipped `stdBase` of 40; see
[what the standard tiles print](#what-the-standard-tiles-print). "Art" is what is in
`assets/tiles/models/` today, not what is planned — see [Artwork status](#artwork-status).

### Bottom-left edge — Start → Spa

| # | File | Type | Name shown | Prints | Art |
|---|---|---|---|---|---|
| 0 | `1.glb` | `start` | Start | ⭐ | own model |
| 1 | `2.glb` | `standard` | — | 22 | own model |
| 2 | `3.glb` | `standard` | — | 23 | placeholder copy |
| 3 | `4.glb` | `deck` | Plot Twist | 🃏 | own model |
| 4 | `5.glb` | `standard` | — | 25 | own model |
| 5 | `6.glb` | `train` | Flight bonus | ✈️ | airplane (shared by all four) |
| 6 | `7.glb` | `standard` | — | 26 | own model |
| 7 | `8.glb` | `standard` | — | 27 | placeholder copy |
| 8 | `9.glb` | `deck` | Plot Twist | 🃏 | placeholder copy |
| 9 | `10.glb` | `standard` | — | 29 | placeholder copy |

### Left edge — Spa → VIP

| # | File | Type | Name shown | Prints | Art |
|---|---|---|---|---|---|
| 10 | `11.glb` | `spa` | Spa Day | 💆 | own model |
| 11 | `12.glb` | `standard` | — | 31 | placeholder copy |
| 12 | `13.glb` | `standard` | — | 32 | placeholder copy |
| 13 | `14.glb` | `deck` | Plot Twist | 🃏 | placeholder copy |
| 14 | `15.glb` | `standard` | — | 34 | placeholder copy |
| 15 | `16.glb` | `train` | Flight bonus | ✈️ | airplane (shared by all four) |
| 16 | `17.glb` | `standard` | — | 35 | placeholder copy |
| 17 | `18.glb` | `standard` | — | 36 | placeholder copy |
| 18 | `19.glb` | `deck` | Plot Twist | 🃏 | placeholder copy |
| 19 | `20.glb` | `standard` | — | 38 | placeholder copy |

### Top edge — VIP → Premiere

| # | File | Type | Name shown | Prints | Art |
|---|---|---|---|---|---|
| 20 | `21.glb` | `vip` | VIP Lounge | 🌟 | own model |
| 21 | `22.glb` | `standard` | — | 40 | placeholder copy |
| 22 | `23.glb` | `standard` | — | 41 | placeholder copy |
| 23 | `24.glb` | `deck` | Plot Twist | 🃏 | placeholder copy |
| 24 | `25.glb` | `standard` | — | 43 | placeholder copy |
| 25 | `26.glb` | `train` | Flight bonus | ✈️ | airplane (shared by all four) |
| 26 | `27.glb` | `standard` | — | 44 | placeholder copy |
| 27 | `28.glb` | `standard` | — | 45 | placeholder copy |
| 28 | `29.glb` | `deck` | Plot Twist | 🃏 | placeholder copy |
| 29 | `30.glb` | `standard` | — | 47 | placeholder copy |

### Right edge — Premiere → Start

| # | File | Type | Name shown | Prints | Art |
|---|---|---|---|---|---|
| 30 | `31.glb` | `premiere` | The Premiere | 🎭 | own model |
| 31 | `32.glb` | `standard` | — | 49 | placeholder copy |
| 32 | `33.glb` | `standard` | — | 50 | placeholder copy |
| 33 | `34.glb` | `standard` | — | 51 | placeholder copy |
| 34 | `35.glb` | `standard` | — | 52 | placeholder copy |
| 35 | `36.glb` | `train` | Flight bonus | ✈️ | airplane (shared by all four) |
| 36 | `37.glb` | `standard` | — | 53 | placeholder copy |
| 37 | `38.glb` | `standard` | — | 54 | placeholder copy |
| 38 | `39.glb` | `standard` | — | 55 | placeholder copy |
| 39 | `40.glb` | `standard` | — | 56 | placeholder copy |

A tile with a 3D model **loses its emoji** — the icon is a flat DOM sticker over a lit model, so it
covers the art it is meant to caption (`showIcon()` in [js/ui/render.js](js/ui/render.js:78)). The
printed coin value stays, because the art cannot carry it. So the emoji column above is what the
type *would* show, and today only the standard tiles' numbers actually appear.

## By type

The type name links to the file that implements it; the fuller behaviour table — including which
tuning values each type reads — is in [js/tiles/README.md](js/tiles/README.md).

| Type | Indices | Count | Name in play | Icon | On landing |
|---|---|---|---|---|---|
| [`start`](js/tiles/start-tile.js) | 0 | 1 | Start | ⭐ | Pays `startPass + startLand` (200 at ship) and seeds the VIP pool. Merely *passing* Start pays only the pass half, and that lives in `applyPassStart()` in [js/game.js](js/game.js) because it isn't a landing. |
| [`spa`](js/tiles/spa-tile.js) | 10 | 1 | Spa Day | 💆 | **The card that landed on it is the grant**: arrive with a 7 and you get 7 cards (a joker pays `spaJokerCards`, no card at all pays `spaCards`). Deals through `Shoe.dealExtra`, so unlike every other card grant it is **uncapped and always pays** — `dealFree` tops up only *toward* `packSize` and would hand a full shoe nothing. Averages 7.1 cards on ~1 landing in 40, which is what makes a pack worth about 75 pulls instead of 64. |
| [`vip`](js/tiles/vip-tile.js) | 20 | 1 | VIP Lounge | 🌟 | Empties the whole VIP pool into coins and resets it to zero, or shows the sad "Empty" reveal if it is dry. It pays nothing of its own — every coin it hands over was put there by something else on the board. See [how the pool fills](#how-the-vip-pool-fills). |
| [`premiere`](js/tiles/premiere-tile.js) | 30 | 1 | The Premiere | 🎭 | Sweeps the token all the way round to Start at `premiereStepMs` per tile, then pays the full Start landing bonus. |
| [`train`](js/tiles/train-tile.js) | 5, 15, 25, 35 | 4 | Flight bonus / **Big** flight bonus | ✈️ | Pays one of exactly two outcomes from the economy model — the small bonus, or the large one at `trainLargeChance` — and opens that bonus's own mini-game. The coins and the large bonus's winning rung are decided and banked **before** the game opens; the game only presents them. |
| [`deck`](js/tiles/deck-tile.js) | 3, 8, 13, 18, 23, 28 | 6 | Plot Twist | 🃏 | Draws one card from the weighted `twistDeck` table and holds it on screen for `deckCardMs`: coins, a fine that seeds VIP, a ticket, or Advance to Start. Seven weighted entries, declared in [js/config.js](js/config.js:220) and owned by the economy model. |
| [`standard`](js/tiles/standard-tile.js) | everything else | 26 | *(unnamed)* | — | Pays its printed value, `stdBase × stdWeights[i]`, and nothing else — no popup, no dwell, just a floating number over the token. The only type that never interrupts the pull loop. |

The four single-index types are **corners** (`get corner(){ return true; }`) and take the
highlighted corner styling. They are also the four vertices of the diamond, one per screen
direction: Start bottom, Spa left, VIP top, Premiere right.

### How the VIP pool fills

`state.vip` is a running pot with **one drain and five taps**. The drain is the VIP Lounge, which
takes all of it; the taps are spread across three other tiles and a card, so the corner that pays
it out is the only one that never puts anything in.

| Source | Adds | Where |
|---|---|---|
| **Passing** Start without landing on it | `vipSeed` (60) | `applyPassStart()` — [js/game.js:16](js/game.js:16) |
| **Landing** on Start | `vipSeed` (60) | `Tile.startLandingBonus()` — [js/tiles/tile.js:24](js/tiles/tile.js:24) |
| The Premiere sweeping you to Start | `vipSeed` (60) | the same helper, via `advanceToStart()` |
| Plot Twist · **Advance to Start** | `vipSeed` (60) | the same helper again |
| Plot Twist · **Fine / Paparazzi** | **80** | [js/tiles/deck-tile.js:31](js/tiles/deck-tile.js:31) |

Read down the first four and the rule is really **one seed per arrival at Start, however you got
there** — three of them are the same line of code, reached by three different routes. Only the
fine is its own thing, and what it is doing is **recycling**: the 80 coins it takes off the player
are not destroyed, they are moved into the pool for whoever reaches the Lounge next.

Two details that are deliberate rather than incidental:

- **The seed is per lap, not per landing multiplier.** Both call sites multiply `vipSeed` by
  `boardScale` but *not* by `mult`, unlike every coin payout around them. The tests pin it
  (`"vip seed is per lap, not per multiplier"`, [tests/suites/04-game.js:50](tests/suites/04-game.js:50)).
- **The Lounge is the only reader.** Nothing else spends, decays or caps the pool, so it grows
  monotonically between visits and a long run without landing on tile 20 is worth real money.

**Scale**, measured over 200k packs at ship values: about **645 coins per pack** flow into the
pool — 63% from passing Start, 23% from the three arrival routes, 10% from fines — and the Lounge
is landed on **1.35 times per pack**, paying an average of **479 coins**. The pool refills fast
enough that the "Empty" reveal essentially never fires outside the opening laps of a fresh run.

Two names worth knowing are misleading on purpose:

- **`deck` is not the deck.** The tile type is the *Plot Twist* card and its own weighted table
  (`twistDeck`). The deck the player pulls from is the shoe in [js/shoe.js](js/shoe.js), and a
  third `deck` — `ENV_Y.deck` — is the ground slab the board stands on. The tile type keeps the
  word because renaming it would reach the 3D palette and the CSS for no gain.
- **The train tile's icon is a car.** 🚗, not 🚂. It is the tile's look, not a bug to fix; the name
  in the log is still "Train bonus".

## What the standard tiles print

```js
stdWeights[i] = (0.6 + (i/39) × 1.0) / mean      // over standard indices only, so mean = 1
label        = Math.round(cfg.stdBase × stdWeights[i])
payout       = cfg.stdBase × stdWeights[i] × cfg.boardScale × mult
```

The weight rises with the index, so a lap gets richer the further round it goes: at the shipped
`stdBase` of 40 the first standard tile prints **22** and the last prints **56**, averaging 40.
Three consequences:

- **The label rounds, the payout does not.** A tile printing 32 pays 31.79 × `boardScale`. Nothing
  reconciles them, and nothing should — the label is a price tag, not a receipt.
- **`stdBase` is live.** The tuning drawer rewrites the labels as you drag it, which is why they
  are DOM text over the canvas rather than baked into the models.
- **The weights re-derive themselves.** They are computed at load over whatever indices are
  `standard`, so converting a standard tile to a new type re-normalizes the rest automatically —
  the mean stays 1 and the board's total payout per lap barely moves.

## Where a tile sits

`gridPos(i)` maps the index to a cell in an 11 × 11 grid, which the 3D board (and the legacy CSS
board before it) turns into the diamond:

| Indices | Cells | Edge |
|---|---|---|
| 0–10 | row 10, column `10 − i` | bottom-right → bottom-left |
| 10–20 | column 0, row `10 − (i − 10)` | up the left side |
| 20–30 | row 0, column `i − 20` | across the top |
| 30–39 | column 10, row `i − 30` | down the right side |

Start is `(10,10)` — the cell nearest the camera — which is what puts it at the bottom vertex and
makes the indices run clockwise **on screen**. Each corner index appears in two ranges above
because it is the shared end of two edges.

## Artwork status

All 40 model files exist. Nine are real assets; the rest are still copies of one placeholder:

| Files | Tiles | |
|---|---|---|
| `1`, `2`, `4`, `5`, `7` | indices 0, 1, 3, 4, 6 | the first five generated models |
| `11`, `21`, `31` | Spa, VIP, Premiere | the three named corners |
| `6` = `16` = `26` = `36` | the four train tiles | **one airplane, copied to four names** — there is no sharing mechanism, `tileModelPath(i)` is per index. Regenerating means re-copying all four; check with `md5 -q assets/tiles/models/{6,16,26,36}.glb \| sort -u` |
| `3`, `8`–`10`, `12`–`15`, … | the remaining 28 | one model, copied |

Verify with:

```bash
md5 -q assets/tiles/models/*.glb | sort | uniq -c | sort -rn
```

The generated originals are kept in `assets/tiles/raw/` (`1`, `2`, `4`, `5`, `7` plus `.bak`
variants of tile 1). There are **no flat `N.png` tiles** — the legacy CSS board (`cfg.board3d = 0`)
currently renders styled slabs with emoji for every index.

Commissioning replacements is the [board-tile-art](claude-skills/board-tile-art) skill's job; the
per-tile subject list it consumes is `board.json` (see
[board.example.json](claude-skills/board-tile-art/board.example.json)), keyed by **file number**
with a `role` and a `subject`. That file is where a per-tile name would first become real, which is
the appendix below. The rules any model must obey — front faces +Z, floor flush and full-bleed,
tall mass at the back edge, height budget — are in
[assets/tiles/ART-BRIEF.md](assets/tiles/ART-BRIEF.md), and the load-time normalization that makes
scale, origin and up-axis irrelevant is in [assets/tiles/README.md](assets/tiles/README.md).

## What is *not* a tile

Easy to file under "tiles" and all wrong:

| Thing | What it actually is |
|---|---|
| Mystery box | An **overlay** — it sits *on* a tile, is dropped one per ticket earned, and resolves *before* the tile it stands on. → [js/overlays/README.md](js/overlays/README.md) |
| Ticket placeholders | The row of episode slots beside the board, drawn by [js/ui/shoe3d.js](js/ui/shoe3d.js). They are tappable buttons, not board squares. |
| The deck / the shoe | The 62-card pack the player pulls from ([js/shoe.js](js/shoe.js)). Unrelated to the `deck` tile type. |
| Props | 3D objects placed on a tile rather than being one. → [assets/props/README.md](assets/props/README.md) |
| The island, sea, boats | The environment around the board. → [assets/env/README.md](assets/env/README.md) |

## Appendix — proposed names for the 26 standard tiles

**Not in the code. Nothing reads these.** They are a starting point for the day the board wants
names, and they exist because the roster above has a column that is 26 dashes long.

The order climbs deliberately with the coin value: the cheap tiles after Start are the working
harbour, and the expensive run into Premiere is the production itself — so a lap reads as a walk
from the quayside to the red carpet, and the printed numbers rise with the glamour rather than
against it.

| # | Prints | Proposed name |
|---|---|---|
| 1 | 22 | Quayside Kiosk |
| 2 | 23 | Ferry Steps |
| 4 | 25 | The Net Loft |
| 6 | 26 | Harbour Café |
| 7 | 27 | Fishmonger's Row |
| 9 | 29 | Lighthouse Path |
| 11 | 31 | Bathhouse Lane |
| 12 | 32 | The Laundry |
| 14 | 34 | Rehearsal Room |
| 16 | 35 | Costume Store |
| 17 | 36 | The Old Cinema |
| 19 | 38 | Casting Office |
| 21 | 40 | Roof Terrace |
| 22 | 41 | The Newsroom |
| 24 | 43 | Gallery Row |
| 26 | 44 | Radio Tower |
| 27 | 45 | The Grand Hotel |
| 29 | 47 | Press Gate |
| 31 | 49 | Studio Backlot |
| 32 | 50 | Sound Stage |
| 33 | 51 | The Green Room |
| 34 | 52 | Wardrobe Wing |
| 36 | 53 | Editing Suite |
| 37 | 54 | Producer's Office |
| 38 | 55 | Red Carpet Approach |
| 39 | 56 | Paparazzi Corner |

Adopting them is three separate decisions, in this order:

1. **As art direction only** — put them in `board.json` as the `subject` line each model is
   generated from, and the board gains 26 distinguishable places with no code change at all. This
   is the cheap version, and it is most of the value.
2. **As data** — a `TILE_NAMES` table beside `tileType()` in
   [js/board-model.js](js/board-model.js). Costs nothing until something reads it.
3. **As UI** — the label layer would need a third span, and the activity log would say
   *"Ferry Steps · +23 coins"* instead of a bare float. That is the one that needs a designer:
   a name on a 47px tile competes with the coin value, and the log line is the cheaper place to
   spend the name.
