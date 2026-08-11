# Tile system

Every board tile has a **type**, every type has its own logic file in this folder, and all types
inherit from the `Tile` base class in [tile.js](tile.js). Shared behavior (paying coins, dealing
cards, awarding tickets, advancing to Start, …) lives once in the base class and is *called* by
subclasses — never copy-pasted.

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

**`deck` is a name collision, and a deliberate one.** The `deck` *tile type* is the Plot Twist
card — six board squares with their own weighted table. The *deck* everywhere else in the game is
the 50-card pack the player pulls from ([`js/shoe.js`](../shoe.js)). The two are unrelated. The
table global was renamed `twistDeck` to get the word back; the tile type keeps it because renaming
it would reach into the 3D palette and the CSS for no gain.

## Tile types and what they do

All coin amounts scale with the `boardScale` tuning value (`bs` in the landing context). The
tuning-drawer values each type reads are noted per type.

| Type | File | Icon | Behavior on landing | Tuning values used |
|---|---|---|---|---|
| **standard** | [standard-tile.js](standard-tile.js) | — | Pays the tile's printed coin value: `stdBase × stdWeights[i]`. Weights rise around the board (mean 1), so late tiles pay more. Also renders the printed value via `valueLabel(i)`. No interruption — just a floating number. | `stdBase` |
| **train** | [train-tile.js](train-tile.js) | 🚗 | The board's **two-bonus** tile. Pays one of exactly two outcomes from the economy model — the small bonus, or the large one at `trainLargeChance` — and opens **that bonus's own mini-game** ([minigames/](../../minigames/README.md)). The coins are banked before the game opens; the game only presents them. The large bonus's three-rung ladder and its winning rung are also picked here (`Economy.trainLadder`) — the game reveals that result, it never rolls it. Falls back to the **Collect popup** when `bonusGames` is off or a game is missing. | `trainSmall`, `trainLarge`, `trainLargeChance`, `bonusGames`, `bonusLoadMs`, `bonusMaxMs`, `collectMinSec`, `collectMaxSec` |
| **deck** | [deck-tile.js](deck-tile.js) | 🃏 | The **Plot Twist** card (not the pull deck — see above). Draws a weighted card from the `twistDeck` table (editable in tuning) and **shows the card** for `deckCardMs`: coins (can be a negative fine), a ticket (the Backstage pass), clues, VIP-pool seed, or **Advance to Start** (walks the token to Start and pays the full Start landing bonus). A ticket card rains tickets over the card face. | the Plot Twist table, `deckCardMs`, `startPass`, `startLand`, `vipSeed`, `tokenStepMs` |
| **spa** | [spa-tile.js](spa-tile.js) | 💆 | Deals `spaCards` free cards into the shoe, topped up toward `packSize`, and reveals it with the **card shower**. The grant is 1, and that is not `spaEnergy` renamed: energy was spent up to ten per roll so five was a small top-up, whereas a pull costs exactly one card and this corner comes round about every six pulls — a five-card grant would hand back most of the pull cost forever and the deck would stop being a budget. | `spaCards`, `packSize`, `revealMs` |
| **vip** | [vip-tile.js](vip-tile.js) | 🌟 | Collects the entire VIP pool as coins — or shows the sad "Empty" reveal if the pool is dry. The pool is seeded by laps past Start, Start landings, and the Fine/Paparazzi card. | `vipRevealMs` |
| **premiere** | [premiere-tile.js](premiere-tile.js) | 🎭 | Sweeps the token to Start at `premiereStepMs` per tile and pays the full Start landing bonus. | `premiereStepMs`, `startPass`, `startLand`, `vipSeed`, `startRevealMs` |
| **start** | [start-tile.js](start-tile.js) | ⭐ | Landing here pays `startPass + startLand`, seeds the VIP pool with `vipSeed`, and dwells `startRevealMs`. (Merely *passing* Start pays only `startPass` — that lap logic is in `applyPassStart()` in [`js/game.js`](../game.js), because it isn't a landing.) | `startPass`, `startLand`, `vipSeed`, `startRevealMs` |

The four single-index types (`start`, `spa`, `vip`, `premiere`) are **corner tiles**
(`get corner(){ return true; }`) and get the highlighted corner styling.

**Mystery boxes** are not a tile type — they're an **overlay** that sits on top of a tile. Overlays
live in [`js/overlays/`](../overlays/README.md) and resolve before the tile's own `onLand()`.

## How a landing flows

```
ui/main.js pull()                  card off the shoe, card animation, token walk
  └─ game.js resolveLandingEvents(mult)
       ├─ OVERLAYS — resolves any overlay on the tile first (js/overlays/)
       └─ TILE_TYPES[tileType(pos)].onLand({pos, mult, bs})
            └─ mutates state synchronously, returns an event list
  └─ ui/main.js playEvents(events)  plays the list back with animation
```

**Not every pull reaches a tile.** A **ticket card** moves nothing, so `pull()` fills a placeholder
and *returns* before `resolveLandingEvents` is ever called. Skipping the move loop would not have
been enough: the landing would re-resolve the tile the token is already standing on and consume any
mystery box sitting there, handing out a free re-collect on every ticket. Tile code sees only
number cards.

**Logic never touches the DOM.** `onLand()` mutates `state` immediately and returns *events*
describing what the UI should show. An event is an object with any subset of these fields,
played in this fixed order by `playEvents()`:

| Field | Meaning |
|---|---|
| `boxOpen: {tile, coins, tickets, clue}` | **blocking** mystery-box opening, and first in the order so the box pops before its numbers come out of the burst: it flies to the centre of the view, swells and pops, then confetti and a shower of whatever was inside. Carries what to *show* — the rewards were already banked. → [js/overlays/README.md](../overlays/README.md) |
| `float: {text, color}` | floating reward text over the token's tile |
| `log: {icon, msg}` | one line in the Activity panel (msg is HTML) |
| `move: {path, stepMs}` | walk the token along `path` (tile indices), one step per `stepMs` |
| `confetti: true` | fire the confetti burst |
| `ticketAward: {filled, episodeIds, titles, seriesDone, banked}` | what `Tickets.award()` just did, riding along with the float that announced it. `playEvents()` hands it to `announceTickets()`, which toasts every episode unlocked, logs any tickets **banked** because the row was already full, and offers the unlock popup to a human. `gainTickets` builds this for you — never assemble one by hand, or the three award paths start disagreeing about when an episode unlocks |
| `card: {name, big, positive, shower}` | **blocking** drawn Plot Twist card, flipped onto the board centre and held `cfg.deckCardMs` (default 2000) |
| `reveal: {big, sub, positive, shower, ms}` | **blocking** center-of-board reveal, held `ms` or `cfg.revealMs` (default 1500). `positive` → confetti + pop animation; otherwise the 😢 sad droop |
| `collect: {big, sub}` | **blocking** popup with a Collect button; waits for the click, or auto-closes after a random `cfg.collectMinSec`–`cfg.collectMaxSec` (default 10–20s). Clicking the backdrop also collects |
| `clue: {names, count}` | **blocking** clue sheet, naming what was found. Mounted inside the board scene rather than over the page, and auto-closes after `cfg.clueCollectMs`. The mystery box is its only source today |
| `minigame: {game, amount, outcome, label, big, sub}` | **blocking** full-frame bonus game, opened over the board in an iframe and resolved when the player collects. `amount` is coins **already paid** — the game presents it and never decides it. Degrades to `collect` when `cfg.bonusGames` is 0 or `game` is unregistered. → [minigames/README.md](../../minigames/README.md) |
| `pause: ms` | wait before the next event |

`shower` is a **string**, not a flag: `"cards"`, `"tickets"`, or null. There are two kinds of thing
to rain now, and the shower should be made of what was actually won — `playShower()` in
[`js/ui/fx.js`](../ui/fx.js) is the one place that turns the string into rain. (The falling
keyframe is `fxfall`. It was named for the dice once, but the coin shower always used it too.)

`card`, `reveal`, `collect`, `clue`, `minigame` and `boxOpen` block the pull loop, so **auto-pull
waits for them too** — that's why every timing is tunable rather than hardcoded. Presentation
convention: standard tiles show only a float (no interruption), train tiles use `minigame`, the
Plot Twist tile uses `card`, and the remaining non-standard tiles use `reveal`.

A blocking event's promise **must always resolve**. `pull()`'s `finally` is the only thing that
clears `state.animating`, so one that never settles leaves the board soft-locked with Pull
disabled. `showCollect` and `showMinigame` both use the same belt-and-braces shape: a `done` flag
so it resolves exactly once, and an unconditional timer so it resolves even if nothing is clicked.

### Presentation timing

All in the drawer's "Presentation timing" group, except `tokenStepMs`, which sits with the deck
because it paces the board rather than a popup.

| Config | Default | Applies to |
|---|---|---|
| `pullRevealMs` | 500 | Pull tap → card face up. Also the length of the 3D card's flight, so one knob still means "click to the number being readable" |
| `pullToMoveMs` | 30 | card face up → token starts moving |
| `revealMs` | 1500 | generic center-reveal hold (spa, and any tile that doesn't override it) |
| `deckCardMs` | 2000 | how long a drawn Plot Twist card stays on screen |
| `vipRevealMs` | 1500 | VIP dwell before play continues (win *and* empty-pool) |
| `startRevealMs` | 800 | dwell when landing on Start — also the arrival dwell after any advance-to-Start |
| `premiereStepMs` | 90 | Premiere sweep speed, ms per tile |
| `collectMinSec` / `collectMaxSec` | 10 / 20 | random auto-close window for the train Collect popup |
| `autoCollectMs` | 600 | how fast the Collect popup self-collects **during auto-play session only** — auto-pull gets the full player window above |
| `tokenStepMs` | 135 | normal pull walk; also paces the Plot Twist Advance-to-Start dash (⅔ of it) |

## The base class contract (tile.js)

`Tile` extends **`BoardActor`** ([../board-actor.js](../board-actor.js)) — the shared base that
also backs overlays. Reward helpers and presentation builders live there; tile-specific board
movement (`startLandingBonus`, `advanceToStart`) lives on `Tile`.

Subclasses may override:

| Member | Default | Purpose |
|---|---|---|
| `get icon()` | `""` | emoji shown on the board tile |
| `get corner()` | `false` | `true` → corner styling |
| `valueLabel(i)` | `""` | small per-tile label (standard tiles print their coin value) |
| `onLand(ctx)` | `[]` | the landing behavior; `ctx = {pos, mult, bs}` |

`pos` is the tile index landed on and `bs` is `cfg.boardScale`. **`mult` is always 1.** The roll
stake multiplier is gone — every pull is worth one — but the parameter is still threaded through
`resolveLandingEvents` and every `onLand`, deliberately: removing it would touch eight tile files
and the whole reward chain to delete a `× 1`. Keep multiplying by it, the way the shipped tiles do.

Shared helpers subclasses should call instead of reimplementing:

| Helper | Does |
|---|---|
| `gainCoins(amount, text?, color?)` | adds coins, returns the float event |
| `gainCards(n, text?)` | deals `n` free cards into the shoe via `Shoe.dealFree`, returns the float event. Tops up **toward** `cfg.packSize` and never reduces a shoe already above it — a bought pack merges onto whatever was left, so being over the cap is the ordinary state of affairs and a plain `Math.min` clamp would delete purchases. The float reports what was actually dealt, which can be fewer than asked for |
| `gainTickets(n, text?)` | awards tickets through `Tickets.award`, returns the float event **with `ticketAward` attached**. Always go through this: the Plot Twist card, the mystery box and the store all fill placeholders by exactly one rule, and three paths that priced their own would eventually disagree about when an episode unlocks |
| `gainClues(n, text?)` | adds clues to both counters — the lifetime album total and the per-prediction flow that buys accuracy — and returns the float event |
| `reveal(big, sub, opts)` | builds the blocking center-reveal event. `opts = {positive, shower, ms}` |
| `collect(big, sub)` | builds the blocking Collect-popup event |
| `card(name, big, opts)` | builds the blocking Plot Twist card event. `opts = {positive, shower}` |
| `minigame(game, amount, opts)` | builds the blocking bonus-game event. Call it **after** `gainCoins` — `amount` is what was paid, not what might be. Anything else in `opts` (a prize ladder, a tier index) is forwarded to the game verbatim |
| `startLandingBonus(mult)` | pays `startPass + startLand`, seeds VIP pool, returns the amount |
| `advanceToStart(fromPos, mult, stepMs, sub)` | moves token to Start, pays the bonus, **and reveals it**. `stepMs` is the sweep speed in ms per tile, absolute — the Plot Twist card passes `cfg.tokenStepMs*2/3`, Premiere passes `cfg.premiereStepMs` |

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
         return [ev,this.reveal("+"+fmt(stake*2),"Casino — doubled",{positive:true})];
       }
       const ev=this.gainCoins(-stake,"🎰 −"+fmt(stake),"var(--bad)");
       ev.log={icon:"🎰",msg:`Casino · lost <b>${fmt(stake)}</b>`};
       return [ev,this.reveal("−"+fmt(stake),"Casino — the house won",{positive:false})];
     }
   }
   registerTile("casino",CasinoTile);
   ```

   Pay first, present second — the reveal describes what the `gain*` call already banked. A tile
   that paid in cards or tickets would add `{shower:"cards"}` / `{shower:"tickets"}` to those opts
   so the rain is made of what was won.

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
[`js/storage.js`](../storage.js) (slots `pmdrama.cfg.v2` / `pmdrama.state.v2`), so a tile type's
tuning changes survive a reload. Each slot also refuses a payload whose own `v` isn't 2 — a new
slot name alone is not enough, because `loadState`'s copy loop would happily half-restore an older
save's overlapping fields and throw nothing while doing it. If you add a tile type that needs
**new tuning values**, add them to `DEFAULTS` in [`js/config.js`](../config.js) — `loadConfig()`
merges saved values onto `DEFAULTS`, so existing saves pick up the new key's default automatically
instead of breaking. If a tile needs to persist **new player state**, add the field to
`serializeState()` in storage.js; unlisted fields are treated as transient and reset each load.

## Rules of the folder

- **No DOM access** in tile files — return events, let `ui/` render them.
- **No duplicated math** — if two types share behavior, promote it to a helper on `Tile`.
- Files are classic scripts (no `import`/`export`) sharing one global namespace, so load order in
  index.html is the dependency order: a tile may only use globals defined above it. The board is
  the one ES module in the project, and it loads last.
