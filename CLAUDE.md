# Harbour Heights — predictive-narrative economy simulator

A Monopoly-GO-style board game used to model a short-drama app's economy: roll dice around a
40-tile board, spend the coins on builders, completing a builder unlocks a story episode, and
watching an episode means betting on what happens next.

## Running it

Open `index.html` — **double-clicking it from `file://` must keep working**. There is no build
step, no bundler, and no dependencies. All scripts are classic `<script>` tags sharing globals;
`import`/`export` and `fetch()` of local files are off-limits (browsers block `fetch` on
`file://`, which is why episode content is `.js` wrapping a JSON payload rather than `.json`).

Script order in `index.html` **is** the dependency order. A file may only use globals defined in
files above it. Adding a file means adding a tag.

For local testing over http, note the browser caches aggressively — serve with `Cache-Control:
no-store`. Video seeking needs a server that supports **HTTP Range**; Python's
`SimpleHTTPRequestHandler` does not, and without it seeks restart the file from zero.

## Layout

```
index.html          markup + ordered <link>/<script> tags
assets/tiles/       optional per-tile artwork: N.png skins tile N-1  → assets/tiles/README.md
css/                base · board · panels · drawer · overlay
episodes/           episode content: NNN.js (prediction) + NNN.mp4 (video)   → episodes/README.md
js/
  util.js           $, fmt, sleep, rand, chance, weighted, shuffle
  config.js         cfg defaults + the tuning-drawer schema
  content.js        login reward ladder (story content lives in episodes/)
  board-model.js    tile index → type and → grid cell, pathToStart
  state.js          the run state object
  storage.js        localStorage persistence for config and progress
  episodes.js       episode registry
  board-actor.js    shared base: reward helpers + presentation event builders
  builders/         builder/series system                                    → js/builders/README.md
  tiles/            one file per tile type                                   → js/tiles/README.md
  overlays/         things that sit on top of tiles (mystery box)            → js/overlays/README.md
  game.js           rolling, landing dispatch, prediction, session time
  ui/               everything that touches the DOM                          → js/ui/README.md
    fx.js           floats, log, toasts, confetti, dice, blocking overlays
    render.js       state → DOM; renderAll() is the entry point
    player.js       episode video player (markup + behaviour)
    prediction.js   predict & watch: bet → playback → result
    store.js        coin/energy top-up modal
    finale.js       series-complete celebration
    drawer.js       tuning drawer + the two reset buttons
    main.js         roll(), playEvents(), auto modes, wiring, boot
```

Note the naming: `js/overlays/` are **board overlays** (things sitting on a tile, like the
mystery box). Modal dialogs live in `js/ui/` — there is no `ui/overlays.js`.

## The one architectural rule

**Logic never touches the DOM.** Landing resolution mutates `state` synchronously and returns an
ordered *event list*; `playEvents()` in `js/ui/main.js` renders it with animation. This is what
makes pacing data-driven and lets auto-play block correctly on popups.

```
roll()  →  resolveLandingEvents()  →  [{float}, {log}, {move}, {card}, {reveal}, {collect}, …]
                                   →  playEvents() animates them
```

Event vocabulary and the tile/overlay contracts are documented in
[js/tiles/README.md](js/tiles/README.md) and [js/overlays/README.md](js/overlays/README.md).
`Tile` and `Overlay` both extend `BoardActor` (`js/board-actor.js`), which owns the reward
helpers (`gainCoins`/`gainEnergy`/`gainClues`) and the blocking presentation builders
(`reveal`/`collect`/`card`) so neither side duplicates them.

## Systems

| System | Where | Notes |
|---|---|---|
| Board layout | `js/board-model.js` | Fixed 40 tiles. Start sits at the **bottom** point of the diamond; indices run clockwise on screen (Start → Spa → VIP → Premiere). |
| Tile behavior | `js/tiles/` | One file per type, self-registering. → [README](js/tiles/README.md) |
| Tile artwork | `assets/tiles/` | Drop `N.png` (1-based, so `1.png` is Start) to skin that tile; absent files change nothing. Author at 144×144. → [README](assets/tiles/README.md) |
| Overlays | `js/overlays/` | Resolve *before* the tile they sit on. → [README](js/overlays/README.md) |
| Builders / series | `js/builders/` | Coin sink; completing a builder unlocks one episode. → [README](js/builders/README.md) |
| Episodes & video | `episodes/` | Prediction data, the video player, betting rules. → [README](episodes/README.md) |
| Session & time | `js/game.js` `advanceSession()` | Rolls cost energy (`mult` per roll), never coins. "Next session" advances the clock by the greater of a full refill (`regenMin` minutes per energy point) and one session slot (`1440 / sessionsPerDay` minutes), refills energy and pays a login reward on each day rollover. |
| Persistence | `js/storage.js` | Two independent localStorage slots — config and progress — with separate **Reset config** and **Reset user** buttons in the tuning drawer. Everything is guarded, so blocked storage degrades to "don't persist". |
| Store | `js/ui/overlays.js` `openStore()` | Button top-right of the board. Instant grants: coins 10k/100k/1M, energy 100/1k/10k. |

### Energy may exceed the cap

Store energy packs are far larger than `cfg.energyCap`. **Overflow is legitimate**, so nothing
may clamp energy downward. Anything that adds energy must top up *toward* the cap without
reducing a balance already above it:

```js
state.energy = Math.max(state.energy, Math.min(cfg.energyCap, state.energy + n));
```

This applies to `BoardActor.gainEnergy` and the `advanceSession` regen. `onCfgChange` and
`loadState` deliberately do **not** clamp. Adding a new clamp will silently delete purchases.

### The two auto modes

`autoMode` in `js/ui/main.js` is `null | "roll" | "session"`; both drive one shared loop and only
one can own it. Either stops on a second click or when energy can't cover the multiplier.

|  | **Auto roll** | **Auto-play session** |
|---|---|---|
| Buys upgrades | no | yes (cheapest first) |
| Intent | simulates a real player | internal balancing tool |
| Train Collect popup | full 10–20s player window | self-collects after `cfg.autoCollectMs` |
| Episode video | plays in full | skipped, but logged with its length |
| Prediction outcome | pick decides | modelled via `cfg.accuracy` |
| Builder buttons | stay clickable (clicking stops the loop) | disabled |

Neither mode opens the prediction modal on its own — episodes are only watched when the player
clicks **Predict & watch**.

## Tests

```bash
node tests/run.js
```

Zero-dependency runner that loads the real scripts into a `vm` context — no framework, no build,
no mocked app modules. Covers the DOM-free layers: util, config invariants, board model,
episodes, builders, game (prediction/session), tiles, overlays and storage. **Run it after
changing any of those.** See [tests/README.md](tests/README.md), which also carries two lists we
have not acted on yet: functionality that would need heavy mocking, and logic currently trapped
inside DOM-building functions.

## Conventions

- **Everything timed is tunable.** Presentation timings live in `cfg` and appear in the tuning
  drawer, which edits `cfg` live. Don't hardcode a duration; add a config key.
- **New config keys are safe to add** — `loadConfig()` merges saved values onto `DEFAULTS`, so
  existing saves pick up new defaults. Removing a key leaves a harmless stray in old saves.
- **New persisted state** must be added to `serializeState()` in `js/storage.js`; unlisted fields
  are treated as transient. `loadState` also drops queue entries that aren't known episode ids.
- **`roll()` and `autoPlay()` use try/finally.** `state.animating` must always clear — if it
  doesn't, the board soft-locks with Roll permanently disabled.
- **The skyline renders behind the board.** It's a sibling of `.board`, not a child: inside the
  board's `preserve-3d` context the towers legitimately stand above the board plane and occlude
  tiles, and `z-index` is ignored there.
- The activity log keeps the last 60 entries; older lines are trimmed.

## Known dead config

`secPerRoll` and `avgOdds` are in the tuning drawer but read by nothing — leftovers from the
original spreadsheet model. `clues` are earned and displayed but never spent.
