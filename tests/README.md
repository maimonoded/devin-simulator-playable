# Tests

```bash
node tests/run.js            # all suites
node tests/run.js tiles      # only suite files matching "tiles"
```

Exit code is non-zero on failure. **130 assertions, no dependencies, no framework.**

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
`withRandom`, `withQuietConsole`, `freshRun()`, `resetCfg()`, `forceBox()`, `forcePool()`.

`forcePool(key, match, fn)` pins a pool to one row and always restores it. Every landing is a
weighted draw now, so a test that wants "a clue off an NPC tile" has to say so — rolling for it
and hoping would test the random number generator, not the tile.

## What's covered

| Suite | Covers |
|---|---|
| [01-core](suites/01-core.js) | `util` (fmt, rand, chance, weighted, shuffle), config invariants (every tuning key has a default, train EV normalises to 1), `board-model` — the shipped Season validating clean, GDD §3.1's tile budget, corners one per side, arrivals at the side midpoints, `validateBoard` reporting every problem at once, and geometry (grid uniqueness/adjacency, Start at the bottom vertex, `pathToStart`) asserted against `boardSize()` rather than a hardcoded 40 |
| [02-episodes](suites/02-episodes.js) | Every shipped episode file validated against the schema; registry lookups; id→video derivation; cycling past the last episode; the full `difficulty` normalisation matrix |
| [03-collection](suites/03-collection.js) | The board's shape and that the shipped one validates clean; the pool derived from the requirements; card ids; owning and duplicating; **a new clue card feeds both clue counters and a duplicate feeds neither**; per-board albums; unlocking; **watching in strict story order**; a set finishing on the last watch rather than the last card; board advance; box drops per tier, duplicate consolation, the status slot and its coin fallback; status points, ranks, buying and the milestone sweep |
| [04-game](suites/04-game.js) | Dice bounds, `spendRoll`, lap bonus, prediction resolution (correct/wrong, streaks, queue consumption, zero-wager, manual vs auto accuracy), session/time (refill, day rollover, login rewards, multi-day skips, over-cap energy) |
| [05-tiles](suites/05-tiles.js) | `BoardActor` reward + presentation builders; the registry (the four pooled types being **one class**, only the corners flagged as corners, nothing printing a value); the draw — a tile reaching its own pool and no other, a loss feeding the Gala pot and never digging below zero, a duplicate paying instead of blocking, a bonus row banking before the game opens and a ladder row's amount being a ceiling; and the four corners, including the Scoop teleporting in **one step** so no lap bonus is paid, and every NPC tile being reachable from it |
| [10-pools](suites/10-pools.js) | `pools`: the shipped tables validating clean, weights summing to 100, every board type pointing at a table that exists, **no pool being pure**, only the Mixed pool taking money away, 20,000 draws matching the authored weights, board share vs pool share, the card/clue rates landing near GDD §4.6 and §6.6, and `validate()` catching a zero-weight table, a nameless row, an unknown kind, a payload-less kind and a tile pointing at a pool that does not exist |
| [06-storage](suites/06-storage.js) | Landing dispatch — including a board type nobody registered being a quiet nothing rather than a throw that would leave `state.animating` stuck — and storage: serialize/restore round-trip including the albums and the shelf, a finished set surviving a reload, **a card this build no longer defines is kept while a status item that no longer exists is dropped**, corrupt albums degrading rather than poisoning, over-cap energy, legacy-queue migration, the box tables round-tripping and a wrong-shaped one being refused, config merge onto `DEFAULTS` |
| [08-economy](suites/08-economy.js) | `economy`: the solved exponent, the shipped curve reproducing the workbook's builder-1 prices, segment selection, `bIndex`/`baseMode` boundary behaviour, explicit segments, series planning and clamping to available episodes, global builder numbering, the clue→accuracy arc and its spend-and-reset, and the projection onto `cfg`. `economy-import`: the structural gate — missing sheets, an empty or already-loaded version, a moved label, a non-numeric value, an unpayable box outcome, a deck without exactly one advance card, and the all-errors-at-once contract |
| [07-env](suites/07-env.js) | `env-model`: the screen-space axes, the region visible at every window aspect, the sight-line height budget (including the case a corner-based budget gets wrong), and the placement manifest — datum resolution, deck scaling from the board plus its border, quarter-turn-only deck yaw, the problem list, `repeat` expansion, and a check that the shipped `assets/env/scene.js` places every piece legally |

The suite is regression-checked: reintroducing the energy-cap clamp, unlocking episodes per level
instead of per completion, rotating the board back, bringing back `stdWeights`, or walking the
Scoop's teleport instead of jumping it all produce failures.

---

# For discussion

Two lists, as requested. Nothing below is tested yet.

## A. Would need complicated mocking

| # | Functionality | What it would take |
|---|---|---|
| A1 | `playVideo()` — [js/ui/player.js](../js/ui/player.js) | A fake `HTMLMediaElement`: `play()` returning a rejectable promise, `duration`/`currentTime`/`playbackRate`/`buffered`, and dispatched `loadedmetadata` / `timeupdate` / `seeking` / `ended` / `error` events. Then pointer-event sequences with fake timers for the long-press. This is the single biggest untested unit (~120 lines) and it holds real logic: the seek guard, the muted fallback, the 2× state machine, the session-skip branch. |
| A2 | `showCollect()` — [js/ui/fx.js](../js/ui/fx.js) | Timer control plus DOM. Its logic worth testing is the auto-close window: random 10–20s vs `autoCollectMs` when `autoMode === "session"`, the countdown, and three resolve paths (button, backdrop, timeout). |
| A3 | `rollDiceAnim()` — [js/ui/fx.js](../js/ui/fx.js) | Fake timers + `performance.now`. The scramble-until-`diceRevealMs` loop with the clipped final wait is genuine logic that a test would pin down. |
| A4 | `roll()` and `runAuto()` — [js/ui/main.js](../js/ui/main.js) | Async orchestration over the whole render stack. Worth testing: the try/finally that clears `state.animating` (a past soft-lock bug), the auto-mode stop conditions, and `playEvents` ordering. Needs a DOM and fake timers, or a seam. |
| A5 | `beforeunload` flush — [js/storage.js](../js/storage.js) | Needs event simulation on `window`. Low value; the save/load path it protects is already covered. |
| A6 | `applyFxTiming()` — [js/ui/render.js](../js/ui/render.js) | Trivial logic, but it writes CSS custom properties, so it needs a document. |

## B. Tight UI coupling that blocks clean unit tests

These contain **logic worth testing that is currently unreachable** because it lives inside
DOM-building functions. Each could be tested cheaply if the decision were extracted from the
rendering.

| # | Where | The logic that's trapped |
|---|---|---|
| B1 | `openPrediction()` — [js/ui/prediction.js](../js/ui/prediction.js) | The `canBet` decision (`coins >= minWager`), which button set to show, the shuffled display order, and the display-index→file-index mapping. All computed inline while building an HTML string. Extracting a `buildPrediction(ep, coins, cfg)` → `{order, canBet, minW, maxW}` would make the whole thing testable with no DOM. |
| B2 | `playEpisode()` — same file | Result classification: win/loss text, the payout line, and *when the true answer is revealed*. Interleaved with `innerHTML` writes and an `await playVideo()`. |
| B3 | `openStore()` — [js/ui/store.js](../js/ui/store.js) | The actual grant (`state.coins += amt` / `state.energy += amt`) lives in a click handler. A `grantPack(kind, amt)` function would be a two-line unit test — and it's the code path the energy-overflow invariant depends on. |
| B4 | `uiUpgrade()` / `nextSession()` — [js/ui/main.js](../js/ui/main.js) | Which log lines and toasts fire for a given upgrade result. The decisions are simple; they're just fused to `log()`/`toast()`/`renderAll()`. |
| B5 | `Case3D.sync()` / `_panelTexture()` — [js/ui/case3d.js](../js/ui/case3d.js) | The four panel states (seen / next / held / collecting) are decided in the middle of a canvas-painting function, and the signature that decides whether to repaint is string concatenation. Both are pure predicates over the collection and would test cleanly if they returned data instead of pixels. |
| B6 | `renderAll()` button gating — same file | The enable/disable matrix for Roll / auto buttons / multiplier / store across `animating` × `autoMode` × energy × `seriesDone`. This is real state-machine logic and exactly the sort of thing that regressed twice during development. |
| B7 | `resetUser()` / `resetDefaults()` — [js/ui/drawer.js](../js/ui/drawer.js) | State reset is correct and testable, but it's fused to `buildTuning()`, `buildBoard()` and toasts. Also `armUserReset()`'s two-click confirm window is pure timer logic wrapped around a button element. |
| B8 | Globals as coupling | `showCollect()`, `showPack()` and `playVideo()` read the `autoMode` global directly instead of receiving it. `openStore()` and `buyBox()` check `state.animating`, a UI concern, from the logic they wrap. Passing these in would remove the hidden dependency. |

**Suggested priority if we act on this:** B3 and B1 are the cheapest wins (pure extractions, no
behaviour change). B6 is the highest value given it has regressed before. A1 is the largest gap
but also the most expensive.
