# Harbour Heights — predictive-narrative economy simulator

A Monopoly-GO-style board game used to model a short-drama app's economy: roll dice around a
40-tile board, spend the coins on builders, completing a builder unlocks a story episode, and
watching an episode means betting on what happens next.

## Running it

```bash
python3 serve.py          # → http://localhost:8125/index.html
```

**A server is required — `file://` no longer works.** The board renders with three.js, loaded as
an ES module, and browsers block module scripts on file URLs. `serve.py` ships with the repo
because two things matter: **HTTP Range** (episode videos are 30–60 MB and the player seeks;
`python3 -m http.server` doesn't support Range and seeks restart the file) and **no-store**
(the browser otherwise serves stale files after an edit).

There is still no build step and no npm. three.js is vendored at `vendor/three.module.js`.

Everything except the board is classic `<script>` tags sharing globals — `import`/`export` and
`fetch()` of local files stay off-limits there, which is why episode content is `.js` wrapping a
JSON payload rather than `.json`. Script order in `index.html` **is** the dependency order; a file
may only use globals defined above it, and adding a file means adding a tag.

`js/ui/board3d.js` is the one ES module *entry point* — it imports `js/ui/env3d.js`, which is
therefore also a module, but there is still only one `<script type="module">` tag so the classic
load order stays the dependency order. Modules are deferred, so it runs *after* every classic
script — which is why `boot()` in `js/ui/main.js` doesn't self-invoke: the board module calls it
once the scene exists.

## Layout

```
index.html          markup + ordered <link>/<script> tags
                    ?view=mobile → the player's-eye view (see css/mobile.css)
serve.py            dev server (Range + no-store) — the way to run the project
vendor/             three.module.js (r169), vendored; no npm, no build step
assets/tiles/       optional per-tile art: models/N.glb (3D) or N.png (flat, legacy CSS board)
assets/env/         the world around the board: scene.js manifest + models/  → assets/env/README.md
assets/dice/        the die: models/die.glb, built not reconstructed    → assets/dice/README.md
minigames/          full-frame bonus games, one per train bonus        → minigames/README.md
tools/              normalize-env.py — conforms an environment GLB to the asset contract
                    make-dice.py    — builds assets/dice/models/die.glb from one blank face
claude-skills/      the Claude Code skills this repo owns: board-tile-art (the 40 tiles) and
                    board-env-art (the world around them). Run link-skills.sh once after
                    cloning — it runs each skill's setup.sh, then symlinks them into
                    .claude/skills, which is git-ignored. Both need the Scenario MCP server
css/                base · board · panels · drawer · overlay · mobile (loaded last)
episodes/           episode content: NNN.js (prediction) + NNN.mp4 (video)   → episodes/README.md
js/
  util.js           $, fmt, sleep, rand, chance, weighted, shuffle
  config.js         cfg defaults + the tuning-drawer schema
  content.js        login reward ladder (story content lives in episodes/)
  xlsx.js           dependency-free .xlsx reader (ZIP + SpreadsheetML), browser-only
  economy.js        the loaded economy model: segmented cost curve, series, the clue edge
  economy-import.js workbook → model, and the structural check that gates it
  board-model.js    tile index → type and → grid cell, pathToStart
  env-model.js      environment geometry: datums, what's on screen, the height budget
  dice-model.js     which turn puts a rolled number on top, and where a throw lands
  state.js          the run state object
  storage.js        localStorage persistence for config and progress
  episodes.js       episode registry
  clues.js          the clue album: its content, and which slots are owned
  board-actor.js    shared base: reward helpers + presentation event builders
  builders/         builder/series system                                    → js/builders/README.md
  tiles/            one file per tile type                                   → js/tiles/README.md
  overlays/         things that sit on top of tiles (mystery box)            → js/overlays/README.md
  game.js           rolling, landing dispatch, prediction, session time
  ui/               everything that touches the DOM                          → js/ui/README.md
    fx.js           floats, log, toasts, confetti, dice, blocking overlays
    minigame.js     opens a bonus game over the board; falls back to fx.js's Collect popup
    board3d.js      the WebGL board (three.js) — the module entry point; calls boot()
    env3d.js        the island, sea and props around the board (imported by board3d.js)
    dice3d.js       the dice, thrown onto the board (imported by board3d.js)
    builders3d.js   the buildings, in their own scene (imported by board3d.js)
    render.js       state → DOM; renderAll() is the entry point
    player.js       episode video player (markup + behaviour)
    prediction.js   predict & watch: bet → playback → result; the unlock popup
    library.js      every unlocked episode, rewatchable
    album.js        the clue album screen
    store.js        coin/energy top-up modal
    finale.js       series-complete celebration
    economy-panel.js  the drawer's Economy section: provenance, curve, series, .xlsx import
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
| Board rendering | `js/ui/board3d.js` | three.js scene: orthographic camera at 45° azimuth / 38° elevation, which reproduces the old CSS projection exactly (`sin 38° = cos 52°`). Tile labels stay DOM over the canvas so text is crisp. `cfg.board3d = 0` falls back to the legacy CSS-3D board, as does a missing WebGL context. |
| Tile behavior | `js/tiles/` | One file per type, self-registering. → [README](js/tiles/README.md) |
| Environment | `js/env-model.js` `js/ui/env3d.js` | The island the board stands on, the sea, and the props in it. Several worlds live in `assets/env/scene.js` and `cfg.envScene` picks one live from the tuning drawer. Placement is data and the engine measures nothing: assets are conformed to a stated contract by `tools/normalize-env.py`, so a new environment needs no code change. `cfg.envMargin` sets how much ground is in frame — it costs board size. → [README](assets/env/README.md) |
| Tile artwork | `assets/tiles/` | Drop `models/N.glb` to skin tile N-1 in 3D (1-based, so `1.glb` is Start); `N.png` does the same on the legacy CSS board. Absent files change nothing. Models are normalized **on load** — any scale/origin/up-axis drops in. → [README](assets/tiles/README.md) |
| Dice | `js/dice-model.js` `js/ui/dice3d.js` | Thrown in from the bottom-left of the view and landing wherever the camera is aimed — the middle of the board is off-screen much of the time with `camFollow` on. `cfg.diceRevealMs` is the throw's length and the promise resolves at exactly that mark, `cfg.diceToMoveMs` still gates the token. Falls back to the DOM pair in `js/ui/fx.js` when `cfg.dice3d` is off or `die.glb` never loaded. |
| Bonus mini-games | `minigames/` `js/ui/minigame.js` | The four train tiles pay one of **two** bonuses (small / large) and each opens its own full-frame game over the board — Steal the Spotlight and the Premiere match-3. Each game is a standalone page in an iframe, driven by `postMessage` — the app is classic scripts sharing one global namespace, and these files bring their own `$`, `fmt`, `renderer` and a `*` reset. **The engine owns the money**: the tile banks the coins, picks the winning prize rung, and hands the game finished numbers to present — which is why the match-3 deck is resolved as cells are opened rather than shuffled. A missing or broken game degrades to the Collect popup, so it can never cost coins. Note the large bonus's ladder currently pays 2/3 of the model's number; see [TODO.md](TODO.md). → [README](minigames/README.md) |
| Die artwork | `assets/dice/` | The one asset built rather than reconstructed: image-to-3D invents the three faces it can't see, and knows nothing of opposite-faces-sum-to-7. Scenario supplies the surface, `tools/make-dice.py` supplies the counts and the geometry. Unit cube **centred on the origin**, unlike tiles. → [README](assets/dice/README.md) |
| Overlays | `js/overlays/` | Resolve *before* the tile they sit on. → [README](js/overlays/README.md) |
| Economy model | `js/economy.js` `js/economy-import.js` | The numbers the game is balanced to, loaded from a spreadsheet. Segmented cost curve, ordered series, the clue→accuracy edge. `Economy.apply()` projects it onto `cfg`. See below. |
| Builders / series | `js/builders/` | Coin sink; completing a builder unlocks one episode. → [README](js/builders/README.md) |
| Episodes & video | `episodes/` | Prediction data, the video player, betting rules. → [README](episodes/README.md) |
| Session & time | `js/game.js` `advanceSession()` | Rolls cost energy (`mult` per roll), never coins. "Next session" advances the clock by the greater of a full refill (`regenMin` minutes per energy point) and one session slot (`1440 / sessionsPerDay` minutes), refills energy and pays a login reward on each day rollover. |
| Persistence | `js/storage.js` | Two independent localStorage slots — config and progress — with separate **Reset config** and **Reset user** buttons in the tuning drawer. Everything is guarded, so blocked storage degrades to "don't persist". |
| Store | `js/ui/overlays.js` `openStore()` | Button top-right of the board. Instant grants: coins 10k/100k/1M, energy 100/1k/10k. |

### The economy model vs `cfg`

Two layers, deliberately separate:

- **`economy`** (`js/economy.js`) is the *loaded model*. It comes from an .xlsx, carries a
  version string, and holds things `cfg` cannot express: a segmented cost curve, an ordered
  series list, a two-item mystery box.
- **`cfg`** is the *live tuning surface* — flat scalars the drawer edits by hand.

They meet in `Economy.apply()`, which projects the model's flat values onto `cfg` and rebuilds
`deck`/`boxTable`. So tile code still just reads `cfg.stdBase` and nothing downstream had to
learn about the model. `Economy.OWNED_CFG_KEYS` is the list `apply()` writes.

**The cost curve is a list of segments and the last one must have no `to`.** A bounded final
rule would leave builders past it unpriced and deadlock the game; `Economy.validateCurve()`
refuses it. One formula never holds for a whole run — a new rule from builder 500 is an
appended segment, not a code change.

**The shipped curve is six segments**, fitted to economy model v3.12, whose pacing is phased
rather than steady: 6 episodes/day, stepping to 5 at day 5 and 4 at day 15, easing to 3.5 by
day 60. Builders 29 and 74 are where those steps land. The fit preserves the cumulative cost
over each segment rather than any single price, because days-to-finish is a running total —
it reproduces the model's full run exactly and series 1 to within 12 minutes, with no builder
more than 1% off the spreadsheet. **`EconomyImport` cannot yet produce this shape** — it still
builds one segment from the v3 layout, so importing any workbook today flattens the pacing.
See [TODO.md](TODO.md).

**Boot order is economy → config → state** (`boot()` in `js/ui/main.js`). The model is applied
first and the saved tuning is overlaid on top, and the config slot is stamped with the economy
version it was edited against. On a version change the economy-owned keys are dropped from the
save while camera and presentation settings carry over — without that gate, importing a new
workbook would silently do nothing for anyone who had played before.

**Importing is all-or-nothing.** `EconomyImport.fromWorkbook()` validates the whole file and
returns every problem at once; nothing is installed unless that list is empty. Layout is checked
by asserting the *label* next to each value still reads what it read in v3 — an inserted row
shifts values but not labels, so a bare "is this a number" test would happily import the wrong
one. `Guide!B2` is the model's identity, and re-importing a version already imported is refused.

There is no server yet, so the browser is the database: an imported model lives in
`localStorage` under `pmdrama.econ.v1`, with its source filename kept for reference.

### Clues are two different things

`state.clues` is the **album** — a lifetime total, never spent, and it IS the album's
progress: the clues you own are the first `state.clues` slots (`js/clues.js`), so the album
stores nothing of its own. Content lives in `CLUE_SETS`; `cfg.clueAlbumSize` is the album's real
size, so slots past the authored sets are numbered placeholders rather than missing entries. `state.cycleClues` is
the **flow** — banked since the last prediction, it raises the modelled accuracy
(`Economy.accuracyFor`: 0.55 + 0.04/clue, capped at 0.70) and is spent and reset by
`resolvePrediction`. Mystery Box item 2 is the only source; the deck pays no clues, so one table
sets the rate.

Accuracy only decides the outcome in **auto** runs — a manual pick still wins on its merits.
That gap is open design, tracked in [TODO.md](TODO.md).

### Energy may exceed the cap

Store energy packs are far larger than `cfg.energyCap`. **Overflow is legitimate**, so nothing
may clamp energy downward. Anything that adds energy must top up *toward* the cap without
reducing a balance already above it:

```js
state.energy = Math.max(state.energy, Math.min(cfg.energyCap, state.energy + n));
```

This applies to `BoardActor.gainEnergy` and the `advanceSession` regen. `onCfgChange` and
`loadState` deliberately do **not** clamp. Adding a new clamp will silently delete purchases.

### `index.html?view=mobile` — the player's-eye view

Everything that exists for development is hidden — side panels, action bar, tuning drawer and
its button, and the second controls row — and `.wrap` becomes a 9:16 frame filling the
viewport. What is left is what a player sees: the board, the play controls already riding on
it, the store, and the HUD, which moves *inside* the frame as an overlay rather than being
hidden with the rest (a board with no coin or energy balance is not the game).

Two things worth knowing before changing it:

- The `viewMobile` class is set by an **inline `<head>` script**, deliberately. Every other
  script is at the end of `<body>` and the board is a deferred module, which is at least one
  paint too late for a layout switch — the desktop view would flash first.
- It must **not** write `cfg.phoneView`. That key is persisted, so one visit to the mobile URL
  would leave the desktop view stuck in 9:16 forever. `js/ui/board3d.js` reads the global
  `VIEW_MOBILE` alongside `cfg.phoneView` when picking the camera zoom instead.

All overrides live in `css/mobile.css`, loaded last so it wins on order rather than by
inflating selectors.

### The two auto modes

`autoMode` in `js/ui/main.js` is `null | "roll" | "session"`; both drive one shared loop and only
one can own it. Either stops on a second click or when energy can't cover the multiplier.

**Auto roll has no button of its own — it is a state of Roll.** Tap Roll to roll once, hold it
for `cfg.autoRollHoldMs` to hand the loop over, tap again to stop. That is why `renderAll()`
keeps `#rollBtn` enabled while `autoMode === "roll"`: it is the only way out, so disabling it
mid-loop would strand the player. The handler uses pointer events, not click, because the tap
and the hold have to be told apart before a click would fire; sliding off the button cancels
the hold without rolling.

|  | **Auto roll** (hold Roll) | **Auto-play session** |
|---|---|---|
| Buys upgrades | no | yes (cheapest first) |
| Intent | simulates a real player | internal balancing tool |
| Train bonus game | plays it, and picks for itself after the 10–20s window (nobody is at the keyboard) | skipped — takes the Collect popup's fast path, so no WebGL page is opened per roll |
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
- **The buildings are not on the board.** They have their own 3D scene (`js/ui/builders3d.js`),
  reached by the 🏗 button. One renderer draws both scenes — a second `WebGLRenderer` would take
  a second GL context, and browsers cap those. `Board3D.setView()` swaps the scene and
  `.boardScene.showBuilders` swaps the DOM overlay; both happen in `setBuildersView()` so they
  cannot disagree.
- **The builders view shows `cfg.builderPageSize` buildings and the page is derived, not
  stored.** `Builders.page()` is the first page still holding an unmaxed builder, so finishing
  them out of order can never skip one and nothing needs persisting.
- **Prices in that row use `fmtShort`** (`2.5k`, `1.2m`, `14b`), capped at four characters, so
  five buttons fit one phone line whatever the economy charges.
- The activity log keeps the last 60 entries; older lines are trimmed.

## Known dead config

`secPerRoll` and `avgOdds` are in the tuning drawer but read by nothing. Both are still used by
the economy spreadsheet (seconds-per-roll derives its "active minutes per session"; average odds
derives the prediction edge), so wiring them up is defensible — see [TODO.md](TODO.md).
`avgOdds` is a *reference* number: real odds are per-answer in the episode files, so the model's
single average has no honest call site until something needs to check the library against it.

Four of the model's five relative knobs are imported and ignored; only `builderCost` is read.
`clues` are now spent — see "Clues are two different things" above.

The **wager tiers are wired**: `wagerSafe/wagerConfident/wagerMax` project onto `cfg` and
`Economy.wagerTiers(balance)` prices them, with `minWager` as a floor under all three.
`clueAlbumSize` drives the HUD's `137/300` album readout. `participation` stays unprojected on
purpose — it is the share of predictions the model expects a stake on, which in a game a human
plays is an *outcome*, not an input; what the game owes it is the choice, so **Skip & watch is
always offered**.
