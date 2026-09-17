# Tests

```bash
node tests/run.js            # all suites
node tests/run.js tiles      # only suite files matching "tiles"
```

Exit code is non-zero on failure. **230 assertions, no dependencies, no framework.**

## How it works

The app is plain classic scripts sharing globals, so [run.js](run.js) loads the real files into
one `vm` context and the suites assert against them directly. Nothing is stubbed except two
browser built-ins that `storage.js` touches at load time:

```js
localStorage  // a Map-backed stand-in
window        // { addEventListener(){} } for the beforeunload flush
```

Those are stand-ins for platform APIs, not mocks of app behaviour. No app module is faked.

Randomness is made deterministic with `withRandom([...], fn)`, which feeds `Math.random` a fixed
sequence and always restores it. Weighted tables are steered by temporarily zeroing weights
(`forceCard`, `forceDrop`) rather than by stubbing `weighted()`.

Helpers available in suites: `suite`, `test`, `ok`, `eq`, `near`, `deepEq`, `throws`,
`withRandom`, `withQuietConsole`, `freshRun()`, `resetCfg()`.

## What's covered

| Suite | Covers |
|---|---|
| [01-core](suites/01-core.js) | `util` (fmt, rand, chance, weighted, shuffle), config invariants (every tuning key has a default), `board-model` (tile types, the deck on the four bonus tiles, the two bills and where they are placed, grid uniqueness/adjacency, Start at the bottom vertex, stdWeights mean, pathToStart) |
| [02-episodes](suites/02-episodes.js) | Every shipped episode file validated against the schema; registry lookups; id→number/video derivation; cycling past the last episode; the full `difficulty` normalisation matrix. The episodes themselves are parked — nothing in the game reads them — but the content is still checked so it stays valid for whenever coins start unlocking it |
| [04-game](suites/04-game.js) | Dice bounds, `spendRoll`, lap bonus, session/time (refill, day rollover, login rewards, multi-day skips, over-cap energy) |
| [05-tiles](suites/05-tiles.js) | `BoardActor` reward + presentation builders, the tile registry, and every tile's landing behaviour asserted on returned event lists — including all the deck-card branches and both bills (what they charge, that they scale with the stake, and that neither can take a balance below zero) |
| [06-overlays-storage](suites/06-overlays-storage.js) | Mystery-box eligibility/spawn/consume and drop kinds, overlay-before-tile dispatch order, and storage: serialize/restore round-trip, over-cap energy, corrupt data, config merge onto `DEFAULTS`, and the two migrations this branch created — a **v1 save** keeping the run while its builders/clues/bets are dropped, and a **config saved before clues were removed** losing its clue row |
| [08-economy](suites/08-economy.js) | `economy`: the solved exponent, the shipped curve reproducing the workbook's builder-1 prices, segment selection, `bIndex`/`baseMode` boundary behaviour, explicit segments, series planning and clamping to available episodes, global builder numbering, the clue→accuracy arc (model-only now — nothing reads it), and the projection onto `cfg`, including the clue rows it filters out on the way to `boxTable`. `economy-import`: the structural gate — missing sheets, an empty or already-loaded version, a moved label, a non-numeric value, an unpayable box outcome, a deck without exactly one advance card, and the all-errors-at-once contract |
| [11-catalog](suites/11-catalog.js) | `Catalog`: registration and what it refuses (a duplicate id, a season with no parent, a season its series does not list — each warns and is dropped rather than thrown), price normalisation, the spine's order and shape, and the derived video/art paths |
| [12-unlock](suites/12-unlock.js) | `Items` and `Unlock`: an empty price unlocking at once, walking a multi-step price, `current()` being the only payable target, **payStep deducting nothing at all when it refuses**, `Items.spend` being all-or-nothing, demand-weighted item draws (including that an item the run no longer needs is never drawn), and the stake scaling items the way it scales coins |
| [07-env](suites/07-env.js) | `env-model`: the screen-space axes, the region visible at every window aspect, the sight-line height budget (including the case a corner-based budget gets wrong), and the placement manifest — datum resolution, deck scaling from the board plus its border, quarter-turn-only deck yaw, the problem list, `repeat` expansion, and a check that the shipped `assets/env/scene.js` places every piece legally |

The suite is regression-checked: reintroducing the energy-cap clamp, moving the deck off the four
bonus tiles, or rotating the board back all produce failures.

---

# For discussion

Two lists, as requested. Nothing below is tested yet.

## A. Would need complicated mocking

| # | Functionality | What it would take |
|---|---|---|
| A1 | `playVideo()` — [js/ui/player.js](../js/ui/player.js) | **Parked with the file** — it is no longer loaded, so this is dormant rather than outstanding. It would take a fake `HTMLMediaElement`: `play()` returning a rejectable promise, `duration`/`currentTime`/`playbackRate`/`buffered`, and dispatched `loadedmetadata` / `timeupdate` / `seeking` / `ended` / `error` events, then pointer-event sequences with fake timers for the long-press. Still the biggest untested unit (~120 lines), and it still holds real logic: the seek guard, the muted fallback, the 2× state machine, the session-skip branch. |
| A2 | `showCollect()` — [js/ui/fx.js](../js/ui/fx.js) | Timer control plus DOM. Its logic worth testing is the auto-close window (one `rand(collectMinSec, collectMaxSec)` since the auto-play-session fast path went), the countdown, and three resolve paths (button, backdrop, timeout). |
| A3 | `rollDiceAnim()` — [js/ui/fx.js](../js/ui/fx.js) | Fake timers + `performance.now`. The scramble-until-`diceRevealMs` loop with the clipped final wait is genuine logic that a test would pin down. |
| A4 | `roll()` and `runAuto()` — [js/ui/main.js](../js/ui/main.js) | Async orchestration over the whole render stack. Worth testing: the try/finally that clears `state.animating` (a past soft-lock bug), the auto-roll stop conditions, and `playEvents` ordering. Needs a DOM and fake timers, or a seam. |
| A5 | `beforeunload` flush — [js/storage.js](../js/storage.js) | Needs event simulation on `window`. Low value; the save/load path it protects is already covered. |
| A6 | `applyFxTiming()` — [js/ui/render.js](../js/ui/render.js) | Trivial logic, but it writes CSS custom properties, so it needs a document. |

## B. Tight UI coupling that blocks clean unit tests

These contain **logic worth testing that is currently unreachable** because it lives inside
DOM-building functions. Each could be tested cheaply if the decision were extracted from the
rendering.

| # | Where | The logic that's trapped |
|---|---|---|
| B3 | `openStore()` — [js/ui/store.js](../js/ui/store.js) | The actual grant (`state.coins += amt` / `state.energy += amt`) lives in a click handler. A `grantPack(kind, amt)` function would be a two-line unit test — and it's the code path the energy-overflow invariant depends on. |
| B6 | `renderAll()` button gating — [js/ui/render.js](../js/ui/render.js) | The enable/disable matrix for Roll / multiplier / store across `animating` × `autoMode` × energy — including the rule that Roll stays *enabled* while auto-roll owns the loop, because it is the only way to stop it. Real state-machine logic, and it regressed twice during development. |
| B7 | `resetUser()` / `resetDefaults()` — [js/ui/drawer.js](../js/ui/drawer.js) | State reset is correct and testable, but it's fused to `buildTuning()`, `buildBoard()` and toasts. Also `armUserReset()`'s two-click confirm window is pure timer logic wrapped around a button element. |

**Suggested priority if we act on this:** B3 is the cheapest win (a pure extraction, no
behaviour change). B6 is the highest value given it has regressed before. A1 is the largest gap
but also the most expensive.
