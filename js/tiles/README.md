# Tile system

Every board tile has a **type**, every type has its own logic file in this folder, and all types
inherit from the `Tile` base class in [tile.js](tile.js). Shared behavior (paying coins, granting
energy, advancing to Start, …) lives once in the base class and is *called* by subclasses — never
copy-pasted.

## The board

The board is a fixed 40-tile loop (indices 0–39, clockwise). Which index gets which type is
declared in [`js/board-model.js`](../board-model.js):

| Type | Tile indices | Count |
|---|---|---|
| `start` | 0 | 1 |
| `spa` | 10 | 1 |
| `vip` | 20 | 1 |
| `premiere` | 30 | 1 |
| `train` | 5, 15, 25, 35 | 4 |
| `deck` | 3, 8, 13, 18, 23, 28 | 6 |
| `standard` | everything else | 26 |

`tileType(i)` (in board-model.js) maps an index to its type name; `TILE_TYPES[name]` (registry in
[tile.js](tile.js)) maps the name to its singleton tile object.

## Tile types and what they do

All coin amounts scale with the roll **multiplier** (×1…×10) and the `boardScale` tuning value.
The tuning-drawer values each type reads are noted per type.

| Type | File | Icon | Behavior on landing | Tuning values used |
|---|---|---|---|---|
| **standard** | [standard-tile.js](standard-tile.js) | — | Pays the tile's printed coin value: `stdBase × stdWeights[i]`. Weights rise around the board (mean 1), so late tiles pay more. Also renders the printed value via `valueLabel(i)`. No interruption — just a floating number. | `stdBase` |
| **train** | [train-tile.js](train-tile.js) | 🚗 | The board's **two-bonus** tile. Pays one of exactly two outcomes from the economy model — the small bonus, or the large one at `trainLargeChance` — and opens **that bonus's own mini-game** ([minigames/](../../minigames/README.md)). The coins are banked before the game opens; the game only presents them. Falls back to the **Collect popup** when `bonusGames` is off or a game is missing. | `trainSmall`, `trainLarge`, `trainLargeChance`, `bonusGames`, `bonusLoadMs`, `bonusMaxMs`, `collectMinSec`, `collectMaxSec` |
| **deck** | [deck-tile.js](deck-tile.js) | 🎁 | Hands over a **box**, opened on the spot. Which tier is a weighted draw from `deckBoxes` — mostly Silver, so a Gold off a tile is a good turn and a Diamond is a story. The tile decides nothing about what is inside: `openBoxEvents()` opens it, banks it and returns the events. → [assets/boxes/README.md](../../assets/boxes/README.md) | `boxTiers`, `deckBoxes`, the pack timings |
| **spa** | [spa-tile.js](spa-tile.js) | 💆 | Grants `spaEnergy` energy, topped up to `energyCap`. Energy win → confetti **plus the dice shower**. | `spaEnergy`, `energyCap`, `revealMs` |
| **vip** | [vip-tile.js](vip-tile.js) | 🌟 | Collects the entire VIP pool as coins — or shows the sad "Empty" reveal if the pool is dry. The pool is seeded by laps past Start, Start landings, and the Fine/Paparazzi card. | `vipRevealMs` |
| **premiere** | [premiere-tile.js](premiere-tile.js) | 🎭 | Sweeps the token to Start at `premiereStepMs` per tile and pays the full Start landing bonus. | `premiereStepMs`, `startPass`, `startLand`, `vipSeed`, `startRevealMs` |
| **start** | [start-tile.js](start-tile.js) | ⭐ | Landing here pays `startPass + startLand`, seeds the VIP pool with `vipSeed`, and dwells `startRevealMs`. (Merely *passing* Start pays only `startPass` — that lap logic is in `applyPassStart()` in [`js/game.js`](../game.js), because it isn't a landing.) | `startPass`, `startLand`, `vipSeed`, `startRevealMs` |

The four single-index types (`start`, `spa`, `vip`, `premiere`) are **corner tiles**
(`get corner(){ return true; }`) and get the highlighted corner styling.

There is no overlay layer: **a board index has exactly one thing on it**. Mystery boxes used to
sit on a tile and resolve before it; a box is now handed over and opened immediately, wherever it
came from.

## How a landing flows

```
ui/main.js roll()                  animates the dice + token walk
  └─ game.js resolveLandingEvents(mult)
       └─ TILE_TYPES[tileType(pos)].onLand({pos, mult, bs})
            └─ mutates state synchronously, returns an event list
  └─ ui/main.js playEvents(events)  plays the list back with animation
```

**Logic never touches the DOM.** `onLand()` mutates `state` immediately and returns *events*
describing what the UI should show. An event is an object with any subset of these fields,
played in this fixed order by `playEvents()`:

| Field | Meaning |
|---|---|
| `float: {text, color}` | floating reward text over the token's tile |
| `log: {icon, msg}` | one line in the Activity panel (msg is HTML) |
| `move: {path, stepMs}` | walk the token along `path` (tile indices), one step per `stepMs` |
| `confetti: true` | fire the confetti burst |
| `dice: true` | fire the tumbling-dice shower (used for energy wins) |
| `reveal: {big, sub, positive, energy, ms}` | **blocking** center-of-board reveal, held `ms` or `cfg.revealMs` (default 1500). `positive` → confetti + pop animation; otherwise the 😢 sad droop. `energy` → adds the dice shower |
| `collect: {big, sub}` | **blocking** popup with a Collect button; waits for the click, or auto-closes after a random `cfg.collectMinSec`–`cfg.collectMaxSec` (default 10–20s). Clicking the backdrop also collects |
| `card: {name, big, positive, energy}` | **blocking** card flipped onto the board centre and held `cfg.deckCardMs` (default 2000). Nothing ships that uses it since the deck tile became a box; kept because it is the cheapest way to put a named beat on screen |
| `minigame: {game, amount, outcome, label, big, sub}` | **blocking** full-frame bonus game, opened over the board in an iframe and resolved when the player collects. `amount` is coins **already paid** — the game presents it and never decides it. Degrades to `collect` when `cfg.bonusGames` is 0 or `game` is unregistered. → [minigames/README.md](../../minigames/README.md) |
| `pack: {tier, drops}` | **blocking** box opening: the closed box, which the player may tap and which opens itself after `cfg.packAutoOpenMs`, then its cards one at a time. Carries what to *show* — everything in it was banked before the event was built. → [assets/boxes/README.md](../../assets/boxes/README.md) |
| `unlock: {ids}` | **blocking** for a human, and a toast for an auto run: the episodes the cards just completed. The ids are already on `state.epQueue`, so declining costs nothing |
| `boardDone: {board}` | **blocking** set-complete celebration, and the tap that opens the next set. An auto-play session advances silently instead |
| `pause: ms` | wait before the next event |

`reveal`, `collect`, `card`, `pack`, `unlock`, `boardDone` and `minigame` block the roll loop, so
**auto-play waits for them too** — that's why every timing is tunable rather than hardcoded.
Presentation convention: standard tiles show only a float (no interruption), train tiles use
`minigame`, deck tiles use `pack`, and the remaining non-standard tiles use `reveal`.

A blocking event's promise **must always resolve**. `roll()`'s `finally` is the only thing that
clears `state.animating`, so one that never settles leaves the board soft-locked with Roll
disabled. `showCollect` and `showMinigame` both use the same belt-and-braces shape: a `done` flag
so it resolves exactly once, and an unconditional timer so it resolves even if nothing is clicked.

### Presentation timing (all in the drawer's "Presentation timing" group)

| Config | Default | Applies to |
|---|---|---|
| `diceRevealMs` | 500 | Roll click → dice reveal (faces scramble during this window) |
| `diceToMoveMs` | 30 | dice reveal → token starts moving |
| `revealMs` | 1500 | generic center-reveal hold (spa, and any tile that doesn't override it) |
| `deckCardMs` | 2000 | how long a drawn deck card stays on screen |
| `vipRevealMs` | 1500 | VIP dwell before play continues (win *and* empty-pool) |
| `startRevealMs` | 800 | dwell when landing on Start — also the arrival dwell after any advance-to-Start |
| `premiereStepMs` | 90 | Premiere sweep speed, ms per tile |
| `collectMinSec` / `collectMaxSec` | 10 / 20 | random auto-close window for the train Collect popup |
| `autoCollectMs` | 600 | how fast the Collect popup self-collects **during auto-play session only** — auto-roll gets the full player window above |
| `tokenStepMs` | 135 | normal roll walk; also paces the deck Advance-to-Start dash (⅔ of it) |

## The base class contract (tile.js)

`Tile` extends **`BoardActor`** ([../board-actor.js](../board-actor.js)). Reward helpers and
presentation builders live there; tile-specific board movement (`startLandingBonus`,
`advanceToStart`) lives on `Tile`. That file also defines the free function `grantEnergy()`,
which is the one place the never-clamp-a-purchased-overflow rule is written down —
`js/boxes.js` and `advanceSession()` both call it.

Subclasses may override:

| Member | Default | Purpose |
|---|---|---|
| `get icon()` | `""` | emoji shown on the board tile |
| `get corner()` | `false` | `true` → corner styling |
| `valueLabel(i)` | `""` | small per-tile label (standard tiles print their coin value) |
| `onLand(ctx)` | `[]` | the landing behavior; `ctx = {pos, mult, bs}` |

Shared helpers subclasses should call instead of reimplementing:

| Helper | Does |
|---|---|
| `gainCoins(amount, text?, color?)` | adds coins, returns the float event |
| `gainEnergy(n, text?)` | tops up toward `energyCap`, returns the float event. Never *reduces* a balance already above the cap — store purchases are allowed to overflow it, so don't reintroduce a plain `Math.min` clamp |
| `gainClues(n, text?)` | adds to both clue counters, returns the float event. Nothing ships that calls it: a clue is a card now, and `Collection.add()` feeds the counters when a **new** clue card lands |
| `reveal(big, sub, positive, energy)` | builds the blocking center-reveal event |
| `collect(big, sub)` | builds the blocking Collect-popup event |
| `minigame(game, amount, opts)` | builds the blocking bonus-game event. Call it **after** `gainCoins` — `amount` is what was paid, not what might be |
| `startLandingBonus(mult)` | pays `startPass + startLand`, seeds VIP pool, returns the amount |
| `advanceToStart(fromPos, mult, pace, sub)` | moves token to Start, pays the bonus, **and reveals it**; `pace` scales `tokenStepMs` (deck uses ⅔, premiere 0.52) |

## Adding a new tile type

Example: a "casino" tile that doubles-or-nothing a small stake.

1. **Create the logic file** `js/tiles/casino-tile.js`:

   ```js
   "use strict";
   class CasinoTile extends Tile {
     get icon(){ return "🎰"; }
     onLand({mult,bs}){
       const stake=100*bs*mult;
       if(chance(0.5)){
         const ev=this.gainCoins(stake*2,"🎰 +"+fmt(stake*2));
         ev.log={icon:"🎰",msg:`Casino · doubled to <b>${fmt(stake*2)}</b>`};
         return [ev];
       }
       const ev=this.gainCoins(-stake,"🎰 −"+fmt(stake),"var(--bad)");
       ev.log={icon:"🎰",msg:`Casino · lost <b>${fmt(stake)}</b>`};
       return [ev];
     }
   }
   registerTile("casino",CasinoTile);
   ```

2. **Assign it board positions** in [`js/board-model.js`](../board-model.js): add a position set
   (e.g. `const CASINOS=new Set([7,27]);`) and a branch in `tileType(i)`. If the chosen indices
   were previously `standard`, nothing else needs re-balancing (the `stdWeights` mean shifts
   microscopically — recomputed automatically).

3. **Load it** in [`index.html`](../../index.html): add
   `<script src="js/tiles/casino-tile.js"></script>` anywhere **after** `js/tiles/tile.js` and
   **before** `js/game.js`.

4. Optionally add a CSS look in [`css/board.css`](../../css/board.css)
   (`.tile.casino{border-color:...}`) — otherwise it renders like a standard tile with your icon.

That's the whole surface: rendering (icon, corner style, label) and behavior both come from the
one class file; no dispatch code anywhere else needs editing.

## Artwork

A tile's look can be replaced with an image by dropping `assets/tiles/<index+1>.png` — `1.png`
skins Start, `40.png` the last tile. Absent files change nothing, so partial sets are fine.
Sizes and what changes when art is present are documented in
[../../assets/tiles/README.md](../../assets/tiles/README.md). The path comes from
`tileImagePath(i)` in [../board-model.js](../board-model.js); the loading/caching lives in
`applyTileArt()` in [../ui/render.js](../ui/render.js).

## Note on persistence

Tuning values and player progress are saved to `localStorage` by
[`js/storage.js`](../storage.js) (slots `pmdrama.cfg.v1` / `pmdrama.state.v1`), so a tile type's
tuning changes survive a reload. If you add a tile type that needs **new tuning values**, add them
to `DEFAULTS` in [`js/config.js`](../config.js) — `loadConfig()` merges saved values onto
`DEFAULTS`, so existing saves pick up the new key's default automatically instead of breaking.
If a tile needs to persist **new player state**, add the field to `serializeState()` in
storage.js; unlisted fields are treated as transient and reset each load.

## Rules of the folder

- **No DOM access** in tile files — return events, let `ui/` render them.
- **No duplicated math** — if two types share behavior, promote it to a helper on `Tile`.
- Files are classic scripts (no `import`/`export`) so the game keeps working from a plain
  `file://` double-click; load order in index.html is the dependency order.
