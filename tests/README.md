# Tests

```bash
node tests/run.js            # all suites
node tests/run.js tiles      # only suite files matching "tiles"
```

Exit code is non-zero on failure. **220 assertions, no dependencies, no framework.**

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
(`forceCard`, `forceDrop`) rather than by stubbing `weighted()`. The shoe needs neither: it holds
concrete cards, so a suite that wants a known pull writes `state.shoe = [7, "T", 3]` and reads
back exactly that. This is one of the reasons `js/shoe.js` stores cards rather than a seed — a
seeded shoe would re-deal itself the moment `withRandom` touched the generator.

Helpers available in suites: `suite`, `test`, `ok`, `eq`, `near`, `deepEq`, `throws`,
`withRandom`, `withQuietConsole`, `freshRun()`, `resetCfg()`.

## What's covered

| Suite | Covers |
|---|---|
| [01-core](suites/01-core.js) | `util` (fmt, fmtShort's four-character promise, rand, chance, weighted, shuffle), config invariants (every tuning key has a default and appears once, the Plot Twist and box tables keep untouched default copies, the train's two bonuses are a well-formed pair whose EV matches the model) and the rework's deletions asserted as *absent globals* — `MULTIPLIERS`, `rollDice`, `Builders`, `TRAIN_MULT`, the bare `deck`; a global that still exists somewhere is a global something can still accidentally read. `board-model` (tile types, grid uniqueness/ring/adjacency, Start at the bottom vertex, stdWeights mean, 1-based tile art paths, pathToStart) |
| [02-episodes](suites/02-episodes.js) | Every shipped episode file validated against the schema; ids contiguous from 001; registry lookups; id→number and video path derivation; the index cycling past the last shipped file; the full `difficulty` normalisation matrix |
| [03-tickets](suites/03-tickets.js) | Placeholder shape and reshape, awarding (lowest unfilled first, one award spilling across placeholders, and a ticket earned **mid-animation** still landing — the old upgrade guard must not be inherited), and the row: derived rather than stored, unskippable when later placeholders fill first, held open until every episode on it has been **watched** (a sealed-but-unwatched bet counts as unwatched), `rowFull` as the pull-stop, tickets banked while it is full, a short final row. Then the unlock rules it inherited — episodes off the **front** of the story whatever order slots filled, the derived library, `firstUnwatchedId`, series end — and pricing from the **global** episode number |
| [04-game](suites/04-game.js) | Pulling (every card a 1–12 step or a ticket, taken off the front and counted, `null` rather than `undefined` on an empty shoe), lap bonus, prediction resolution (correct/wrong, streaks, consuming a queued episode *by id*, zero-wager, manual vs auto accuracy), session/time (dealing back to the cap, an over-cap shoe left alone, day rollover, login rewards, multi-day skips, and the gap being the greater of a full deal and one session slot) |
| [05-tiles](suites/05-tiles.js) | `BoardActor`'s reward helpers (`gainCoins`/`gainCards`/`gainTickets`/`gainClues`) and its presentation builders — including `shower` as a **string**, since there are two kinds of thing to rain — the tile registry, and every tile's landing behaviour asserted on returned event lists: train EV over 8,000 draws against `Economy.trainRealEV()`, the large bonus's three-rung ladder and the mini-game handed exactly what was banked, Spa dealing off the pack tail rather than minting loose cards, and every Plot Twist branch (coins, the fine recycled into the VIP pool, the ticket, the teleport, and the check that none of them pay clues) |
| [06-overlays-storage](suites/06-overlays-storage.js) | Mystery-box eligibility/spawn/consume, contents decided when the box is **placed** so a gold box pays what it advertised, the three drop kinds and the clue popup, overlay-before-tile dispatch order, and storage: serialize/restore round-trip with the shoe as concrete cards, banked boxes, an over-cap shoe surviving restore, a sealed reveal surviving a reload, legacy-queue migration, corrupt data, config merge onto `DEFAULTS` |
| [07-env](suites/07-env.js) | `env-model`: the screen-space axes, the region visible at every window aspect, the sight-line height budget (including the case a corner-based budget gets wrong), and the placement manifest — datum resolution, deck scaling from the board plus its border, quarter-turn-only deck yaw, the problem list, `repeat` expansion, and a check that the shipped `assets/env/scene.js` places every piece legally |
| [08-economy](suites/08-economy.js) | `economy`: the solved exponent, the six shipped segments reproducing the workbook's prices to within 1% *and* its days-to-finish pacing, segment selection, `bIndex`/`baseMode` boundary behaviour, series planning and clamping to available episodes, global episode numbering, the wager tiers with `minWager` as a floor and the balance as a ceiling, the clue→accuracy arc and its spend-and-reset, and the projection onto `cfg`. `economy-import`: the structural gate — missing sheets, an empty or already-loaded version, a moved label, a non-numeric value, an unpayable box outcome, a Plot Twist deck without exactly one advance card, and the all-errors-at-once contract |
| [09-shoe](suites/09-shoe.js) | A pack's exact composition — the natural 54-card deck (joker count pinned to 2, so the shape is asserted whatever the economy ships), **what is actually dealt today** (52 numbered + 10 jokers = 62), and the derivation itself across 0/2/10/40 jokers: the 52 are never traded away to make room, which is what stops a ticket-rate change from silently cutting the token's longest moves. And the invariant the economy rests on: **exactly `ticketsPerPack` tickets per `packSize` cards, however they were obtained** — asserted over a *mixed* sequence of buys and small free deals, since per-pack counting passes trivially. Free cards coming off the pack tail, dealing that tops up toward the cap and never trims a shoe already over it, and buying as **merge-and-reshuffle** so a ticket left in the remainder is never destroyed. Then pricing: the next rungs of the same cost curve, the episode-boundary straddle, the saw-tooth within an episode against the monotone cost of a whole one, and a pack that stays finite far past the last authored episode |
| [10-clues](suites/10-clues.js) | The album as a pure view of `state.clues`: ownership is the first N slots, its size comes from the model rather than from how much content exists, a negative or fractional counter cannot break it, set progress and completion, a name for every slot (authored where content exists, numbered where it does not), and a save/load that persists nothing of its own |

The suite is regression-checked: reintroducing a cap clamp on the shoe, unlocking episodes per
ticket instead of per filled placeholder, advancing the row before its episodes have been
watched, or rotating the board back all produce failures.

---

# For discussion

Two lists, as requested. Nothing below is tested yet.

## A. Would need complicated mocking

| # | Functionality | What it would take |
|---|---|---|
| A1 | `playVideo()` — [js/ui/player.js](../js/ui/player.js) | A fake `HTMLMediaElement`: `play()` returning a rejectable promise, `duration`/`currentTime`/`playbackRate`/`buffered`, and dispatched `loadedmetadata` / `timeupdate` / `seeking` / `ended` / `error` events. Then pointer-event sequences with fake timers for the long-press. This is the single biggest untested unit (~110 lines) and it holds real logic: the seek guard, the muted fallback, the 2× state machine, the session-skip branch, and the `{completed}` distinction the sealed reveal depends on. |
| A2 | `showCollect()` — [js/ui/fx.js](../js/ui/fx.js) | Timer control plus DOM. Its logic worth testing is the auto-close window: random 10–20s vs `autoCollectMs` when `autoMode === "session"`, the countdown, and three resolve paths (button, backdrop, timeout). It reads the `autoMode` global directly rather than being handed it, which is the hidden dependency a test would have to reach around; `showClue()` and `showBoxOpen()` do the same. |
| A3 | `pullCardAnim()` — [js/ui/fx.js](../js/ui/fx.js) | Fake timers plus a stand-in `Board3D`. Two things here are genuine logic and both have bitten: the promise settles on a `setTimeout` at `cfg.pullRevealMs` rather than from the frame loop (a frame-driven resolve soft-locks the board in a background tab), and the flat-card fallback keys off `shoeFailed()` — "definitively broken" — rather than "not loaded yet". |
| A4 | `pull()` and `runAuto()` — [js/ui/main.js](../js/ui/main.js) | Async orchestration over the whole render stack. Worth testing: the try/finally that clears `state.animating` (a past soft-lock bug), the **early return** on a ticket card (falling through would re-resolve the tile the token is standing on and eat any mystery box on it), the auto-mode stop conditions, and `playEvents` ordering. Needs a DOM and fake timers, or a seam. |
| A5 | `beforeunload` flush — [js/storage.js](../js/storage.js) | Needs event simulation on `window`. Low value; the save/load path it protects is already covered. |
| A6 | `applyFxTiming()` — [js/ui/render.js](../js/ui/render.js) | Trivial logic, but it writes CSS custom properties, so it needs a document. |

## B. Tight UI coupling that blocks clean unit tests

These contain **logic worth testing that is currently unreachable** because it lives inside
DOM-building functions. Each could be tested cheaply if the decision were extracted from the
rendering.

| # | Where | The logic that's trapped |
|---|---|---|
| B1 | `openPrediction()` — [js/ui/prediction.js](../js/ui/prediction.js) | The `canBet` decision, which button set to show, the shuffled display order, the display-index→file-index mapping, and the "all three tiers are at the minimum" case that decides whether the hint explains itself. All computed inline while building an HTML string. Extracting a `buildPrediction(ep, coins, cfg)` → `{order, canBet, tiers, allFloored}` would make the whole thing testable with no DOM. |
| B2 | `runReveal()` / `showEpisodeResult()` — same file | Result classification: win/loss text, the payout line, and *when the true answer is revealed*. Interleaved with `innerHTML` writes and an `await playVideo()`, along with the resume loop that keeps `state.pendingReveal` sealed until the episode actually finishes. |
| B3 | `openStore()` — [js/ui/store.js](../js/ui/store.js) | The coin top-up (`state.coins += amt`) lives in a click handler. It is the last grant still trapped there: the ticket packs already delegate to `Tickets.award()` and the deck to `Shoe.buyPack()`, both covered above. A `grantPack(kind, amt)` would be a two-line unit test and would close the set. |
| B4 | `announceTickets()` / `onBuyDeck()` / `nextSession()` — [js/ui/main.js](../js/ui/main.js) | Which log lines and toasts fire for a given award. `announceTickets` also decides whether to *offer* the unlocked episode — only to a human, and never over the series finale — which is a real predicate fused to `toast()`/`log()`/`renderAll()`. |
| B5 | `Shoe3D.syncSlots()` — [js/ui/shoe3d.js](../js/ui/shoe3d.js) | The redraw signature: which changes to the row are visible and therefore worth rebuilding five canvas textures for. Getting it wrong is silent either way — too broad and the pull loop stalls, too narrow and a filled placeholder never repaints. Pure string arithmetic over `pageSlots`/`held`/`isWatched`, embedded in geometry construction. |
| B6 | `renderAll()` button gating — [js/ui/render.js](../js/ui/render.js) | The enable/disable matrix for Pull / auto-play / buy-deck / store across `animating` × `autoMode` × an empty shoe × `rowFull` × `seriesDone`, plus which of Pull's four labels it wears. This is real state-machine logic, it has regressed twice, and the same three "can't pull" conditions are now written out in three places — here, `pull()`'s own guard, and `runAuto()`'s per-pass re-check. Teach one and not the others and the button lies about a loop that is still running. |
| B7 | `resetUser()` / `resetDefaults()` — [js/ui/drawer.js](../js/ui/drawer.js) | State reset is correct and testable, but it's fused to `buildTuning()`, `buildBoard()` and toasts. Also `armUserReset()`'s two-click confirm window is pure timer logic wrapped around a button element. |

**Suggested priority if we act on this:** B3 and B1 are the cheapest wins (pure extractions, no
behaviour change). B6 is the highest value given it has regressed before and now has three copies
of the same predicate to keep in step. A1 is the largest gap but also the most expensive.
