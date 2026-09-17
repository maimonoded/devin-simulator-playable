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
| `reshoot` | 30 | 1 |
| `deck` | 5, 15, 25, 35 | 4 |
| `payroll` | 3 | 1 |
| `overheads` | 23 | 1 |
| `standard` | everything else | 30 |

**The two bills are placed, not scattered.** `payroll` and `overheads` are the only tiles that
*take* coins, they are 20 apart so the player meets one about every half lap, and each sits three
tiles after a tile that pays out — Start at 0, and the VIP Lounge at 20, which dumps the whole
accumulated pool. Revenue in, costs out. They also clear the card tiles and Reshoot, so nothing
can charge a player twice within three tiles. Moving either index gives that rhythm up.

The four bonus tiles used to be `train` tiles paying a two-outcome bonus into a mini-game, and the
deck was drawn on six separate chance tiles. The simpler version has one bonus, not two kinds of
one: the deck moved onto the bonus tiles and the chance tiles went back to being plain (two of
the six, 3 and 23, are the bills above; the other four are standard). A card
is therefore rarer and bigger, and there is one bonus per edge of the board. The train's two
bonuses were not lost with its tile — they are two cards in that deck now, so how often a
mini-game opens is the deck's weights rather than a chance of its own.

`tileType(i)` (in board-model.js) maps an index to its type name; `TILE_TYPES[name]` (registry in
[tile.js](tile.js)) maps the name to its singleton tile object.

## Tile types and what they do

All coin amounts scale with the roll **multiplier** (×1…×10) and the `boardScale` tuning value.
The tuning-drawer values each type reads are noted per type.

| Type | File | Icon | Behavior on landing | Tuning values used |
|---|---|---|---|---|
| **standard** | [standard-tile.js](standard-tile.js) | — | Pays the tile's printed coin value: `stdBase × stdWeights[i]`. Weights rise around the board (mean 1), so late tiles pay more. Also renders the printed value via `valueLabel(i)`. No interruption — just a floating number. | `stdBase` |
| **deck** | [deck-tile.js](deck-tile.js) | 🃏 | The board's **bonus** tile, and the only tile that draws a card. Takes a weighted card from the `deck` table (editable in tuning) and **shows the card** — pulled off the deck on the board, or flat over its centre if there is no deck to pull from. A card pays coins (can be a negative fine), **energy** (a random 1…roll multiplier, so the stake bounds what comes back), a **story item** drawn from the series being unlocked (`Items.add`, never a write to `state.items`), a VIP-pool seed, **Advance to Start** (walks the token to Start and pays the full Start landing bonus), or one of the two **bonus mini-games** — banking `trainSmall`/`trainLarge` and picking the large one's winning rung *before* the game opens. An item card with nothing left on the spine to unlock pays coins instead of nothing. | deck table, `deckCardMs`, `cardPullMs`, `cardToTableMs`, `deck3d`, `startPass`, `startLand`, `vipSeed`, `trainSmall`, `trainLarge` |
| **spa** | [spa-tile.js](spa-tile.js) | 💆 | Grants `spaEnergy` energy, topped up to `energyCap`. Energy win → confetti **plus the dice shower**. | `spaEnergy`, `energyCap`, `revealMs` |
| **vip** | [vip-tile.js](vip-tile.js) | 🌟 | Collects the entire VIP pool as coins — or shows the sad "Empty" reveal if the pool is dry. The pool is seeded by laps past Start, Start landings, and the Fine/Paparazzi card. | `vipRevealMs` |
| **reshoot** | [reshoot-tile.js](reshoot-tile.js) | 🎬 | The board's **jail**. Landing here delays you: up to `reshootThrows` throws of a second, differently-coloured pair, which **cost no energy** — that is what the colour says. Throwing stops at the first **double**, which pays energy back equal to the **sum of the two dice × the roll multiplier**. No double in any throw is a **fine**: a share of the *current coin balance*, drawn triangularly between `reshootFineMin` and `reshootFineMax` and **never scaled by the stake** — it is the price of the delay, not of the roll. It can never take a player below zero. One throw is a double with p = 1/6, so all three fail 57.9% of the time; the tile is a net drain, which is the point. | `reshootThrows`, `reshootFineMin`, `reshootFineMax`, `reshootThrowGapMs`, `reshootRevealMs`, `energyCap` |
| **payroll** | [payroll-tile.js](payroll-tile.js) | 👷 | **A bill** — the crew gets paid whether the week's footage was any good or not. Charges `payrollCost × boardScale × mult`, so a ×5 roll earns five times as much and pays five times the bill. The **balance is the guard**: it takes the bill or the balance, whichever is smaller, measured against a balance floored at zero, so it can never push a player below it and never charges an overdrawn one again (the same shape as the Reshoot fee). Prints its price on the tile via `valueLabel`. **Does not block** — a float and a log line, for the reason below the table. | `payrollCost` |
| **overheads** | [overheads-tile.js](overheads-tile.js) | 🏢 | **A bill** — the lot, the power, the insurance. Identical in mechanic to Payroll and deliberately **larger** (property costs more than people at this scale, and it lands three tiles after the VIP Lounge has just paid the player out). | `overheadsCost` |
| **start** | [start-tile.js](start-tile.js) | ⭐ | Landing here pays `startPass + startLand`, seeds the VIP pool with `vipSeed`, and dwells `startRevealMs`. (Merely *passing* Start pays only `startPass` — that lap logic is in `applyPassStart()` in [`js/game.js`](../game.js), because it isn't a landing.) | `startPass`, `startLand`, `vipSeed`, `startRevealMs` |

The four single-index types (`start`, `spa`, `vip`, `reshoot`) are **corner tiles**
(`get corner(){ return true; }`) and get the highlighted corner styling.

**Mystery boxes** are not a tile type — they're an **overlay** that sits on top of a tile. Overlays
live in [`js/overlays/`](../overlays/README.md) and resolve before the tile's own `onLand()`.

## How a landing flows

```
ui/main.js roll()                  animates the dice + token walk
  └─ game.js resolveLandingEvents(mult)
       ├─ OVERLAYS — resolves any overlay on the tile first (js/overlays/)
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
| `card: {name, big, positive, energy, item}` | **blocking** drawn deck card. On the 3D board it is PULLED: it lifts off the deck standing inside the ring (`cardPullMs`), is held square to the camera to be read (`deckCardMs`), and travels back down onto the deck (`cardToTableMs`). Without that board — `cfg.deck3d` off, no WebGL, or a deck that failed to build — the same composed face is shown flat over the board centre for `deckCardMs`. `big` is what the card just did, **already formatted with the live number** (a Windfall at ×5 says +1,500), and empty on the two bonus-game cards because the number is the game's to reveal. `item` is the Catalog id of a prop the card granted, or null — presentation only, so the face can show WHICH prop was found; the item was added to the inventory by the tile. |
| `minigame: {game, amount, outcome, label, items, big, sub}` | **blocking** full-frame bonus game, opened over the board in an iframe and resolved when the player collects. `amount` is coins **already paid** and `items` are items **already granted** — the game presents both and decides neither. Anything else on the event (the large bonus's `tiers`/`winIndex`) rides along to the game untouched. Degrades to `collect` when `cfg.bonusGames` is 0 or `game` is unregistered. → [minigames/README.md](../../minigames/README.md) |
| `reshoot: {throws, won, energy, finePct, fine}` | **blocking** Reshoot attempt. Puts the board into a MODE: a delay slate holds for `reshootDelayMs`, the playbar's controls are hidden (`body.reshooting`), and the player clicks a pink button to throw each pair. Carries only what the tile already decided and paid — the clicks reveal, they never decide. A throw nobody clicks throws itself after `reshootIdleMs`; auto-roll uses `reshootAutoMs` and keeps Roll visible as its stop control. |
| `boxOpen: {tile, coins, energy}` | **blocking** mystery-box opening: the box flies to the centre of the view, swells and pops, then confetti and a shower of whatever was inside. Carries what to *show* — the rewards were already banked. → [js/overlays/README.md](../overlays/README.md) |
| `pause: ms` | wait before the next event |

`reveal`, `collect`, `card`, `minigame`, `boxOpen` and `reshoot` block the roll loop, so
**auto-play waits for them too** — that's why every timing is tunable rather than hardcoded. Presentation convention:
standard tiles show only a float (no interruption), deck tiles use
`card` — plus `minigame` for the two cards that open one, where the card names the game and
leaves the number for it to reveal — and the corners use `reveal`.

**The two bills do not block, and that is a rule rather than an oversight.** Measured on the real
board, they are landed on 0.28 times a lap between them — one roll in twenty, about as often as
the Spa — and every blocking beat is paid for again by auto-roll on every run. The corners stop
the board to show the player something they *won*; stopping it to say they have lost money they
had no say in is a punishment on top of a punishment. What tells the two bills apart is the icon,
the wording and the size of the number, not a pause.

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
| `cardPullMs` | 620 | deck: the card lifting off the deck and coming square to the camera |
| `deckCardMs` | 1600 | deck: the card held still and readable — and the WHOLE of the flat card, which neither flies nor lands. It came down from 2000 when the pull arrived: the card is legible through the last of its flight and all of its landing now |
| `cardToTableMs` | 480 | deck: the card travelling back down onto the deck it came off |
| `vipRevealMs` | 1500 | VIP dwell before play continues (win *and* empty-pool) |
| `startRevealMs` | 800 | dwell when landing on Start — also the arrival dwell after any advance-to-Start |
| `reshootDelayMs` | 1900 | the delay slate, before any die is thrown |
| `reshootIdleMs` | 12000 | a throw nobody clicks throws itself after this |
| `reshootAutoMs` | 700 | auto-roll's much shorter gap between throws |
| `reshootThrowGapMs` | 450 | Reshoot: the beat after an escape throw lands, before the next is thrown. The three throws have to read as three |
| `reshootRevealMs` | 1600 | Reshoot: how long the outcome (energy back, or the fine) is held |
| `collectMinSec` / `collectMaxSec` | 10 / 20 | random auto-close window for the Collect popup |
| `tokenStepMs` | 135 | normal roll walk; also paces the deck Advance-to-Start dash (⅔ of it) |

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

Shared helpers subclasses should call instead of reimplementing:

| Helper | Does |
|---|---|
| `gainCoins(amount, text?, color?)` | adds coins, returns the float event |
| `gainEnergy(n, text?)` | tops up toward `energyCap`, returns the float event. Never *reduces* a balance already above the cap — store purchases are allowed to overflow it, so don't reintroduce a plain `Math.min` clamp |
| `reveal(big, sub, positive, energy)` | builds the blocking center-reveal event |
| `collect(big, sub)` | builds the blocking Collect-popup event |
| `minigame(game, amount, opts)` | builds the blocking bonus-game event. Call it **after** `gainCoins` — `amount` is what was paid, not what might be |
| `startLandingBonus(mult)` | pays `startPass + startLand`, seeds VIP pool, returns the amount |
| `advanceToStart(fromPos, mult, pace, sub)` | moves token to Start, pays the bonus, **and reveals it**; `pace` scales `tokenStepMs` (the deck's Advance-to-Start card, its only caller, uses ⅔) |

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
   (e.g. `const CASINOS=new Set([7,27]);`) and a branch in `tileType(i)`. Use a *map* of index →
   type name instead, the way `CORNERS` and `BILLS` do, when the indices are different tiles
   rather than several of the same one — `tileModelPath()` then resolves each to
   `assets/tiles/models/<type>.glb` with no second list to keep in step. If the chosen indices
   were previously `standard`, nothing else needs re-balancing (`stdWeights` is derived from
   `tileType`, so it re-normalises itself — but the **coins those tiles used to pay are gone
   from the board**, which is a real change to income: measure it, don't reason about it).

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
