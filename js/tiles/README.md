# Tile system

**Every landing draws one row from a weighted pool.** That single rule is the tile system now,
and it is GDD §3.2's "one draw system, many pools". Four of the board's eight types are one class
([pool-tile.js](pool-tile.js)) told apart only by which table they read; the four corners are the
only tiles left that do something a table cannot describe (§3.4).

The payoff is not tidiness. **A new tile type, a seasonal board or a live-ops variant is content,
not code** — a row in [`assets/pools/pools.js`](../../assets/pools/pools.js) and an entry in
[`assets/board/board.js`](../../assets/board/board.js).

## The board is data

[`assets/board/board.js`](../../assets/board/board.js) declares each Season's ring, read clockwise
from Start at the bottom of the diamond. An entry is `type` or `type:argument`.
[`js/board-model.js`](../board-model.js) is the engine that reads it, and nothing in it assumes 40
tiles: a ring of N is drawn on a grid of side `N/4 + 1`.

Season 1 is §3.1's illustrative budget exactly:

| Type | Where | Count | Draws from |
|---|---|---|---|
| `premiere` | 0 | 1 | — corner |
| `spa` | 10 | 1 | — corner |
| `gala` | 20 | 1 | — corner |
| `scoop` | 30 | 1 | — corner |
| `arrival` | 5, 15, 25, 35 | 4 | `bonus` |
| `npc:<who>` | 3, 6, 13, 23, 26, 33 | 6 | `clue` |
| `twist` | 2, 7, 17, 22, 27, 37 | 6 | `mixed` |
| `std` | everything else | 20 | `money` |

`tileType(i)` maps an index to its type, `tileArg(i)` to its argument (`npc:simon` → `"simon"`),
`tilePool(i)` to the pool it draws from, and `tilesOfType(t)` finds every index of a type — which
is how the Scoop knows where the NPC tiles are. `TILE_TYPES[name]` is the registry in
[tile.js](tile.js).

`validateBoard()` reports **every** problem at once — a corner off its side, an unknown type, an
NPC tile with nobody on it — and is printed in the tuning drawer and logged at boot, because a
mis-authored board is invisible in play.

## The pooled tiles

[pool-tile.js](pool-tile.js) is `std`, `npc`, `arrival` and `twist`. It draws, and the row's
`kind` says what happens:

| Kind | What it does | Blocks the roll? |
|---|---|---|
| `money` | coins, scaled by `boardScale` and the multiplier. **Negative amounts are legitimate**: what a twist takes goes into the Gala pot, and never digs below zero | no |
| `card` | one collectible, banked before anything is shown. A card you did not have holds the screen; a duplicate pays coins and the board keeps moving | only when new |
| `clue` | a clue | no |
| `energy` | energy, topped up toward the cap and never reducing an overflow | no |
| `move` | `to:"start"` walks to Start and pays the landing bonus; `to:"npc"` is the Scoop's teleport | yes |
| `event` | flavour, and pays nothing **on purpose** — without somewhere for "nothing happened" to live, every landing has to hand something over and the economy inflates (§3.2) | no |

A `money` row may also name a **bonus mini-game** ([minigames/](../../minigames/README.md)); with
`ladder: true` its amount becomes a ceiling and the game reveals which of three rungs won. The
coins are banked *here*, before the game opens — the engine owns the money, the game owns the
drama. A missing game degrades to the Collect popup, so it can never cost a player anything.

**No pool is pure.** The money pool carries cards and the odd clue; the clue pool pays money. It
is the rule most worth defending while tuning: a pure pool would make twenty of the forty tiles
dead air, and `Pools.validate()` is not the thing that would catch it — the tests in
[10-pools.js](../../tests/suites/10-pools.js) are.

## The four corners

| Corner | File | Icon | Behaviour |
|---|---|---|---|
| **The Premiere** | [premiere-tile.js](premiere-tile.js) | 🎭 | Tile 0. Money on **pass** (`applyPassStart()` in [game.js](../game.js) — passing is not a landing); on **landing**, `startPass + startLand`, a seed into the Gala pot, and a **free pack** |
| **Spa Day** | [spa-tile.js](spa-tile.js) | 💆 | `spaEnergy` energy, and §3.4 is explicit that it is **never a penalty**. On a board where a twist can take money, the Spa is the tile you are pleased to land on when nothing else went right |
| **The Gala** | [gala-tile.js](gala-tile.js) | 🥂 | Collects the whole pot — everything the twists confiscated, plus a seed per lap — **and** pays a card of at least `cfg.galaTier`. The guaranteed card is what stops an empty pot from turning the board's biggest landmark into a shrug |
| **The Scoop** | [scoop-tile.js](scoop-tile.js) | 📰 | Teleports to a random NPC tile **and triggers it**. Where Go-To-Jail used to be, doing the opposite job: a shortcut into the story, and the second lever on clue pacing after the NPC tile count |

The pot is `state.vip` and its seed is `cfg.vipSeed`. Those are the **economy workbook's** names
for it and [`js/economy-import.js`](../economy-import.js) asserts on the label, so the field keeps
the old word while the tile carries the new one.

## How a landing flows

```
ui/main.js roll()                  animates the dice + token walk
  └─ game.js resolveLandingEvents(mult)      a dispatch, and nothing else
       └─ TILE_TYPES[tileType(pos)].onLand({pos, mult, bs})
            └─ Pools.drawAt(pos) → a row → mutate state → return an event list
  └─ ui/main.js playEvents(events)  plays the list back with animation
```

**Logic never touches the DOM.** `onLand()` mutates `state` immediately and returns *events*
describing what the UI should show. An event is an object with any subset of these fields,
played in this fixed order by `playEvents()`:

| Field | Meaning |
|---|---|
| `float: {text, color}` | floating reward text over the token's tile |
| `log: {icon, msg}` | one line in the Activity panel (msg is HTML) |
| `move: {path, stepMs}` | walk the token along `path` (tile indices), one step per `stepMs`. A **one-element path is a teleport** — the Scoop uses it so the jump cannot cross Start and pay a lap bonus nobody rolled |
| `confetti: true` | fire the confetti burst |
| `dice: true` | fire the tumbling-dice shower (used for energy wins) |
| `reveal: {big, sub, positive, energy, ms}` | **blocking** center-of-board reveal, held `ms` or `cfg.revealMs`. `positive` → confetti + pop; otherwise the sad droop. `energy` → adds the dice shower |
| `collect: {big, sub}` | **blocking** popup with a Collect button; waits for the click, or auto-closes after a random `cfg.collectMinSec`–`cfg.collectMaxSec` |
| `card: {name, collectible, count, converted, positive}` | **blocking** card held on the board centre for `cfg.cardHoldMs`, or `cfg.cardConvertMs` when this copy is the one that **converts** the card. With `collectible` it draws the card's **own face** via `cardFace()` — the same one the collection and the box popup use |
| `minigame: {game, amount, outcome, label, tiers?, winIndex?}` | **blocking** full-frame bonus game in an iframe. `amount` is coins **already paid**. Degrades to `collect` when `cfg.bonusGames` is 0 or `game` is unregistered |
| `pack: {tier, drops}` | **blocking** box opening: the closed box, tapped or opened by its own timer, then its cards one at a time. Everything in it was banked before the event was built |
| `statusUp: {items, from, to}` | **blocking** status beat: the item in its gold frame, and the track moving |
| `unlock: {ids}` | **blocking** for a human, a toast for an auto run: the episodes the cards just completed |
| `boardDone: {board}` | **blocking** set-complete celebration |
| `pause: ms` | wait before the next event |

Everything from `reveal` down blocks the roll loop, so **auto-play waits for them too** — which
is why every timing is tunable rather than hardcoded.

A blocking event's promise **must always resolve**. `roll()`'s `finally` is the only thing that
clears `state.animating`, so one that never settles leaves the board soft-locked with Roll
disabled. That is also why `resolveLandingEvents()` returns `[]` for an unregistered type rather
than throwing.

## The base class contract (tile.js)

`Tile` extends **`BoardActor`** ([../board-actor.js](../board-actor.js)). Reward helpers and
presentation builders live there; tile-specific board movement (`startLandingBonus`,
`advanceToStart`) lives on `Tile`. That file also defines the free function `grantEnergy()`,
which is the one place the never-clamp-a-purchased-overflow rule is written down.

`registerTile(type, cls, ...args)` forwards extra arguments to the constructor — which is how
four board types share one `PoolTile` and still carry their own icon.

| Member | Default | Purpose |
|---|---|---|
| `get icon()` | `""` | emoji shown on the tile — a **fallback**, only visible where there is no artwork |
| `get corner()` | `false` | `true` → corner styling |
| `valueLabel(i)` | `""` | small per-tile label. Nothing prints one now: a tile that draws cannot advertise a number |
| `onLand(ctx)` | `[]` | the landing behaviour; `ctx = {pos, mult, bs}` |

| Helper | Does |
|---|---|
| `gainCoins(amount, text?, color?)` | adds coins, returns the float event |
| `gainEnergy(n, text?)` | tops up toward `energyCap`, returns the float event. Never *reduces* a balance already above the cap — don't reintroduce a plain `Math.min` clamp |
| `gainClues(n, text?)` | adds to both clue counters, returns the float event |
| `reveal` / `collect` / `card` / `minigame` | build the blocking presentation events. Call `minigame` **after** `gainCoins` — `amount` is what was paid, not what might be |
| `startLandingBonus(mult)` | pays `startPass + startLand`, seeds the Gala pot, returns the amount |
| `advanceToStart(from, mult, stepMs, sub)` | moves the token to Start, pays the bonus, **and reveals it** |

Two free functions round it out, both deliberately outside a class because more than one caller
is not a tile: `drawCardEvents()` in [../boxes.js](../boxes.js) (a `card` row, and the Gala) and
`teleportToNpc()` in [scoop-tile.js](scoop-tile.js) (the Scoop, and the Mixed pool's `move:"npc"`).

## Adding to the board

**A new outcome** is a row in `assets/pools/pools.js`. Nothing else. If it needs a `kind` that
does not exist yet, add it to `POOL_KINDS` in [../pools.js](../pools.js), a case in
`PoolTile.resolve()`, and a validation rule — `Pools.validate()` refuses a kind it does not know,
so a typo fails loudly instead of silently drawing nothing.

**A new pooled tile type** is a table in `POOLS`, an entry in `TILE_POOLS`, a `registerTile` line
in [pool-tile.js](pool-tile.js), a tint in [`css/board.css`](../../css/board.css), and its indices
in the Season's `tiles`. No new file.

**A new corner** is a file here, because a corner is by definition the thing a table cannot
describe. Add it to `BOARD_CORNERS` in [../board-model.js](../board-model.js) — corners are
asserted to sit one per side — and a `<script>` tag after `tile.js` and before `js/game.js`.

## Artwork

`assets/tiles/models/<index+1>.glb` skins tile *index* on the 3D board and
`assets/tiles/<index+1>.png` does the same on the legacy CSS board — 1-based, so `1.glb` is the
Premiere. Absent files change nothing, so partial sets are fine. Paths come from
`tileModelPath(i)` / `tileImagePath(i)` in [../board-model.js](../board-model.js).
→ [../../assets/tiles/README.md](../../assets/tiles/README.md)

## Note on persistence

New tuning values go in `DEFAULTS` in [`js/config.js`](../config.js) — `loadConfig()` merges saved
values onto `DEFAULTS`, so existing saves pick up a new key's default instead of breaking. New
player state goes in `serializeState()` in [storage.js](../storage.js); unlisted fields are
transient and reset each load. `state.season` is the cursor into `BOARD_SEASONS`, and `loadState`
clamps it to a Season that exists — a save from a build with more Seasons would otherwise leave
every tile undefined.

## Rules of the folder

- **No DOM access** in tile files — return events, let `ui/` render them.
- **No duplicated math** — if two types share behaviour, promote it to a helper on `Tile`.
- **Prefer a pool row to a new file.** A behaviour that could be a table should be one.
- Files are classic scripts (no `import`/`export`); load order in index.html is the dependency
  order.
