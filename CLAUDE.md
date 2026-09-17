# Harbour Heights — predictive-narrative economy simulator

A Monopoly-GO-style board game used to model a short-drama app's economy: roll dice around a
40-tile board, collect coins from the tiles you land on, pay the studio's two standing bills when
you land on those, and draw a card from the deck on the four bonus tiles. Coins and the collectible **items** those cards drop are what pay to unlock
episodes, which you then watch.

**This is the `simpler-version` branch, and it is a subtraction.** Three whole systems that the
rest of this document used to be about are gone: **builders** (the coin sink, and what unlocked
episodes), **clues** (the album and the clue→accuracy edge) and **predictions** (wagers, odds,
betting on an episode). What is left is the board loop. The deck's contents are being rewritten
next; the shipped card table is a placeholder.

What replaced them is the **catalog**: a Series › Season › Episode spine declared in `content/`,
priced in coins and items, unlocked a step at a time, and browsed in a full-screen library.

Two things from the old world are kept rather than deleted:

- **`js/ui/prediction.js` and `js/ui/finale.js`** are on disk and not loaded. The prediction
  system is gone and has not come back. (`player.js` and `library.js` HAVE come back — unlocking
  an episode is also how you watch it.)
- **The economy model** — `js/economy.js` and its importer are kept whole even though the cost
  curve, the series list, the accuracy edge and the wager tiers now price nothing.

> **Note on "session".** It means the energy-refill play session (`advanceSession`,
> `cfg.sessionsPerDay`, the "Session today" stat) and nothing else. A group of episodes is a
> **season**. Do not let the two words swap.

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
assets/tiles/       models/standard.glb for the ring, one model per corner and per bill,
                    faces/ for the card tiles
assets/env/         the world around the board: scene.js manifest + models/  → assets/env/README.md
assets/ui/          interface art that is not part of the board: the coin icon → assets/ui/README.md
assets/dice/        the die: models/die.glb, built not reconstructed    → assets/dice/README.md
assets/cards/       the pull deck's paintings: one per card face, per item, and the back
                    → assets/cards/README.md
assets/props/       objects that sit ON a tile (the mystery box)        → assets/props/README.md
assets/npcs/        the series' characters, to stand on tiles           → assets/npcs/README.md
minigames/          full-frame bonus games, opened by two deck cards    → minigames/README.md
tools/              normalize-env.py — conforms an environment GLB to the asset contract
                    make-dice.py    — builds assets/dice/models/die.glb from one blank face
claude-skills/      the Claude Code skills this repo owns: board-tile-art (the 40 tiles) and
                    board-env-art (the world around them). Run link-skills.sh once after
                    cloning — it runs each skill's setup.sh, then symlinks them into
                    .claude/skills, which is git-ignored. Both need the Scenario MCP server
css/                base · board · panels · drawer · overlay · mobile (loaded last)
content/            the catalog as data: series/NNN.js + seasons/NNN-N.js
episodes/           the videos (NNN.mp4, gitignored). NNN.js is parked → episodes/README.md
assets/library/     poster art: episodes/NNN.jpg (2:3) + series/NNN.jpg (16:9)
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
  catalog.js        the content spine: series › season › episode, and what each costs
  unlock.js         the item inventory + the stepped unlock transaction
  board-actor.js    shared base: reward helpers + presentation event builders
  tiles/            one file per tile type                                   → js/tiles/README.md
  overlays/         things that sit on top of tiles (mystery box)            → js/overlays/README.md
  game.js           rolling, landing dispatch, session time
  ui/               everything that touches the DOM                          → js/ui/README.md
    card-art.js     a card's face, composed on a canvas: the painting on top, the live
                    number underneath. Used by BOTH fx.js and shoe3d.js
    fx.js           floats, log, toasts, confetti, dice, blocking overlays
    minigame.js     opens a bonus game over the board; falls back to fx.js's Collect popup
    board3d.js      the WebGL board (three.js) — the module entry point; calls boot()
    env3d.js        the island, sea and props around the board (imported by board3d.js)
    dice3d.js       the dice, thrown onto the board (imported by board3d.js)
    npc3d.js        the series' characters, walking the ring (imported by board3d.js)
    shoe3d.js       the pull deck standing inside the ring, and the card that lifts off it
                    (imported by board3d.js)
    render.js       state → DOM; renderAll() is the entry point
    store.js        coin/energy top-up modal
    profile.js      the player sheet
    library.js      the shelf AND the title page — billboard, season rails, poster cards,
                    and the "complete to unlock" page each target routes to
    player.js       episode video player (markup + behaviour)
    economy-panel.js  the drawer's Economy section: provenance, curve, series, .xlsx import
    drawer.js       tuning drawer + the two reset buttons
    debug.js        the debug jumps and the HUD's 🐞 button — a dev tool, droppable by
                    deleting its one <script> tag
    main.js         roll(), playEvents(), auto-roll, wiring, boot
    ── parked: on disk, NOT in index.html's script tags ──
    prediction.js   predict & watch: bet → playback → result; the unlock popup
    finale.js       series-complete celebration
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
helpers (`gainCoins`/`gainEnergy`) and the blocking presentation builders
(`reveal`/`collect`/`card`) so neither side duplicates them.

## Systems

| System | Where | Notes |
|---|---|---|
| Board layout | `js/board-model.js` | Fixed 40 tiles. Start sits at the **bottom** point of the diamond; indices run clockwise on screen (Start → Spa → VIP → Reshoot). Reshoot (index 30) is the board's **jail** — it used to sweep the token back to Start, which was a reward wearing a corner's clothes. The deck is drawn on the four bonus tiles (5/15/25/35); the six chance tiles that used to draw it are plain tiles again, so a card is rarer and bigger and there is one bonus per edge. Two of those six are now the board's only **costs**: **Payroll** (3) and **Studio Overheads** (23), 20 apart and each three tiles after a tile that pays out — Start, and the VIP Lounge that empties its pool. Revenue in, costs out; `BILLS` in board-model.js is that placement and it is load-bearing. |
| Board rendering | `js/ui/board3d.js` | three.js scene: orthographic camera at 45° azimuth / 38° elevation, which reproduces the old CSS projection exactly (`sin 38° = cos 52°`). Tile labels stay DOM over the canvas so text is crisp. `cfg.board3d = 0` falls back to the legacy CSS-3D board, as does a missing WebGL context. |
| Tile behavior | `js/tiles/` | One file per type, self-registering. → [README](js/tiles/README.md) |
| Environment | `js/env-model.js` `js/ui/env3d.js` | The island the board stands on, the sea, and the props in it. Several worlds live in `assets/env/scene.js` and `cfg.envScene` picks one live from the tuning drawer. Placement is data and the engine measures nothing: assets are conformed to a stated contract by `tools/normalize-env.py`, so a new environment needs no code change. `cfg.envMargin` sets how much ground is in frame — it costs board size. → [README](assets/env/README.md) |
| Tile artwork | `assets/tiles/` | **One model for the whole ring** (`models/standard.glb`) — the 40 numbered GLBs are on disk and unused, since 35 of them were byte-identical and the ring read as clutter. The **four corners and the two bills** are the exception and take one each (`start.glb`, `spa.glb`, `vip.glb`, `reshoot.glb`, `payroll.glb`, `overheads.glb`): a named tile's file is named after its *type*, so `CORNERS` and `BILLS` are the whole mapping and a missing one simply leaves the plain slab. The four **card tiles** take no model and wear a **face** instead: a character portrait textured onto the slab's top, turned by `ENV_CAM.az` so it is upright rather than a lozenge. `TILE_FACES` in `js/board-model.js` says who is where. Models are normalized **on load** — any scale/origin/up-axis drops in. → [README](assets/tiles/README.md) |
| Dice | `js/dice-model.js` `js/ui/dice3d.js` | Thrown in from the bottom-left of the view and landing wherever the camera is aimed — the middle of the board is off-screen much of the time with `camFollow` on. `cfg.diceRevealMs` is the throw's length and the promise resolves at exactly that mark, `cfg.diceToMoveMs` still gates the token. Falls back to the DOM pair in `js/ui/fx.js` when `cfg.dice3d` is off or `die.glb` never loaded. A throw may be **tinted** by name (`Board3D.throwDice(values, "reshoot")`): the palette stays in `board3d.js` and the caller says what it is throwing. Tinting **clones the material first** — clones share the prototype's, so recolouring one in place would recolour the normal pair too. |
| Bonus mini-games | `minigames/` `js/ui/minigame.js` | Opened by **two deck cards**, one per game. The contract is unchanged from when the train tile opened them: **the engine owns the money** — the card banks the coins, picks the winning rung **and grants the items** *before* the game opens, and the game is handed finished numbers purely to present. On the gala that now covers the **whole prize ladder**: which prop sits on each rung, how many, and which rung won are all settled in `deck-tile.js`, so the items are shown *per rung* beside the coin amounts and the page is handed a finished ladder to reveal. Two things hold that up. Only the winning rung is granted — `drawItem()` picks *and* banks in one call, so the losing rungs are drawn with `pickItem()`, which banks nothing; drawing three rungs the easy way would pay for all three. And the counts are `[1,2,3] × stake` against a uniform `winIndex`, whose mean is exactly the flat `2 × stake` it replaced, so the run's clock did not move (measured — see below). A missing or broken game degrades to the Collect popup, so it can never cost coins. → [README](minigames/README.md) |
| Die artwork | `assets/dice/` | The one asset built rather than reconstructed: image-to-3D invents the three faces it can't see, and knows nothing of opposite-faces-sum-to-7. Scenario supplies the surface, `tools/make-dice.py` supplies the counts and the geometry. Unit cube **centred on the origin**, unlike tiles. → [README](assets/dice/README.md) |
| Overlays | `js/overlays/` | Resolve *before* the tile they sit on. **Nothing spawns a mystery box yet** — builder upgrades used to bank them, and a deck card is what will. The whole mechanism (banking, placement, the throw, the two-item open) is kept intact and unspawned so that card only has to call `spawn()`; `deliverBoxes()` runs from `boot()` so boxes banked in a save still land. A box's contents are still drawn when it is **placed**, which used to make a clue box visibly gold and now marks nothing — kept because it is the honest place for the draw and changes no expectation. → [README](js/overlays/README.md) |
| Pull deck | `js/ui/shoe3d.js` `js/ui/card-art.js` `assets/cards/` | The stack the four bonus tiles draw from, standing inside the ring, and the card that lifts off it: up, square to the camera to be read, then back down onto the deck it came from. Nothing is left lying on the board. **The pull reveals; it never decides** — `deck-tile.js` banked every coin before a frame of it runs. A card's face is **composed at draw time** rather than baked: a painting from `assets/cards/` fills the top 60%, and the bottom 40% is the name and *the live number*, so a Windfall at ×5 reads +1,500 and not the table's 300. Three rules make it safe to await: the promise resolves on a **`setTimeout`**, never from the frame loop (rAF stops in a background tab and `roll()`'s finally is what clears `state.animating`); `whenClear(maxMs)` always resolves; and `failed()` means *broken*, never *not built yet*. A fourth follows from the first: **the tweens are advanced by the wall clock too**, not by a counted `1000/60` per frame, because every deadline in the beat is a `setTimeout` and a tween on a different clock drifts away from its own contract — at 30 fps the lift took 1,332 ms against a 620 ms deadline, so `settle()` forced the presented pose and the stale tween immediately dragged the card back and re-flew the pull. Hence also `_retire(mesh)`: **anything that forces a pose drops that card's tweens first**, or the force lasts exactly one frame. The presented **size is capped to the frame** (`PRESENT_FIT`) rather than being purely `PRESENT_SCALE` — the card is drawn into the scene, so the canvas edge clips it and there is nothing to scroll, and `?view=mobile` in a wide window projected it to 143% of the frame height with the live number off the bottom. The cap can only reduce, so the size judged on a phone is the size that ships. **The DOM layers above the canvas come down for the beat** (`body.carding`): no renderOrder inside the GL context can beat a DOM sibling, so the tile numbers were painted across the card's face. The playbar stays — Roll is auto-roll's only stop. Where the deck stands is a **constant**, not `cfg` — `cfg` is persisted, so a saved config would shadow any change to it. Timings are `cfg` (`cardPullMs`, `deckCardMs`, `cardToTableMs`). `cfg.deck3d = 0`, a missing WebGL board or a deck that failed to build all fall back to the same flat DOM card wearing the same canvas. |
| Board props | `assets/props/` | 3D objects that sit *on* a tile rather than being one (the mystery box). Normalized like a tile, scaled in code, and optional: a missing file falls back to a plain cube. → [README](assets/props/README.md) |
| NPCs | `assets/npcs/` `js/ui/npc3d.js` | Simon, Victoria and Carl, walking the ring clockwise on the tiles' **inner** edge — the tile centre is taken by art, boxes and the token. **Scenery, deliberately**: they own no state, are not persisted, and pay nothing, so they stay outside the event list that everything else reaches the player through. Scaled by **height** like the player piece and held under `cfg.tokenHeight`, so a figure walking in front of the token can never bury it. Who walks and which way each faces is data in `assets/npcs/npcs.js` — facing is not a convention here, since one of the three fronts −X. **`cfg.npcs` ships at 0**, and off means the models are never fetched: `NPC3D.init()` deliberately does not load, `tick()` does on the first frame it runs enabled, so the drawer toggle still works with no reload. Switching back off hides them rather than dropping them. → [README](assets/npcs/README.md) |
| Economy model | `js/economy.js` `js/economy-import.js` | The numbers the game is balanced to, loaded from a spreadsheet. **Kept whole, but most of it now prices nothing**: the segmented cost curve and the ordered series described builders, and the clue→accuracy edge and the wager tiers described predictions. `Economy.apply()` still projects it onto `cfg`, and the drawer still shows it. See below. |
| Catalog | `js/catalog.js` `content/` | The content spine: Series › Season › Episode, declared as one data file per series and one per season. Pure data — no state, no cfg, no DOM. `Catalog.spine()` flattens it to one ordered list of unlock targets, and video and art paths are **derived from the id**, never declared. Bad content warns and is dropped rather than thrown: a typo in a data file must not white-screen the app. |
| Unlocking | `js/unlock.js` `js/ui/library.js` | `Items` is the inventory; `Unlock` reads the spine and pays **steps**. A price is an ordered list of `{coins, items}`; `[]` is free. `Unlock.current()` is the first unpaid target and **the only thing that can be paid**, because the drama is serialised. `payStep()` is all-or-nothing — it cannot take coins and then fail on items. Paying happens on the target's **title page** inside the library, not in a dialog over it. → see below |
| Library & player | `js/ui/library.js` `js/ui/player.js` | A streaming shelf — billboard, season rails, poster cards — full screen inside the board window, so `?view=mobile` shows it as the phone screen. **Two screens, one file and one route variable**: the shelf, and a title page for whatever you tapped. An unlocked episode plays on the tap; anything still owed routes to its page, which is where the step bar and the price live. A modal over a full-bleed page always looks like a modal over a full-bleed page, which is why there isn't one. Unlocking an episode is what makes it playable. The videos are gitignored, so a fresh clone plays the player's placeholder path. → [README](episodes/README.md) |
| Reshoot (the jail) | `js/tiles/reshoot-tile.js` `js/ui/fx.js` | Landing on tile 30 puts the board into a **mode**, not a popup. A delay slate holds for `reshootDelayMs`, `body.reshooting` hides the playbar's controls, and the player clicks a pink button to throw each of up to `reshootThrows` free pairs; the first double pays `(d1+d2) × stake` in energy, three misses take a share of the balance. **The outcome is decided in the tile before any of it runs** — the clicks reveal, they never decide. Three rules the mode depends on: a throw nobody clicks throws itself (`reshootIdleMs`, floored so a 0 in the drawer cannot hang the board), auto-roll uses the shorter `reshootAutoMs` **and keeps Roll visible** because Roll is its only stop control, and the hide is a body class rather than `style.display` so `renderAll()` has nothing to fight. |
| Session & time | `js/game.js` `advanceSession()` | Rolls cost energy (`mult` per roll), never coins. "Next session" advances the clock by the greater of a full refill (`regenMin` minutes per energy point) and one session slot (`1440 / sessionsPerDay` minutes), refills energy and pays a login reward on each day rollover. |
| Persistence | `js/storage.js` | Two independent localStorage slots — config and progress — with separate **Reset config** and **Reset user** buttons in the tuning drawer. Everything is guarded, so blocked storage degrades to "don't persist". |
| Debug menu | `js/ui/debug.js` | The 🐞 button in the HUD, and the "Jump to a tile" sheet behind it. **In the HUD, not the drawer**: the drawer is hidden in `?view=mobile`, which is exactly where this gets used — which is also why it is not *in* drawer.js. The button is **built from JS** rather than declared in index.html, so removing the tool really is removing one file: drop the one `<script>` tag and the guarded call in `boot()` finds nothing to call. Each action WALKS the token there and resolves the landing as a roll would — the lap bonus, the tile, any overlay — so it tests the real path rather than a shortcut the game does not have. No energy is spent; the stake still applies. Adding one is an entry in `DEBUG_ACTIONS`. |
| Store | `js/ui/store.js` `openStore()` | Button top-right of the board. Instant grants: coins 10k/100k/1M, energy 100/1k/10k. |

### The economy model vs `cfg`

Two layers, deliberately separate:

- **`economy`** (`js/economy.js`) is the *loaded model*. It comes from an .xlsx, carries a
  version string, and holds things `cfg` cannot express: a segmented cost curve, an ordered
  series list, a two-item mystery box.
- **`cfg`** is the *live tuning surface* — flat scalars the drawer edits by hand.

They meet in `Economy.apply()`, which projects the model's flat values onto `cfg` and rebuilds
`deck`/`boxTable`. So tile code still just reads `cfg.stdBase` and nothing downstream had to
learn about the model. `Economy.OWNED_CFG_KEYS` is the list `apply()` writes.

**Most of the model now prices nothing, and that is on purpose.** The cost curve and the series
list existed to price builders; the accuracy edge and the wager tiers existed to price
predictions. All of it is kept — the user's explicit call — so the balancing work survives for
whenever coins start paying for episodes. Two consequences to know before touching it:

- `Economy.apply()` **filters clue rows out of `boxTable`** as it rebuilds it. The model still
  records a three-way box because that is what the workbook says; the game pays two ways because
  clues no longer exist. The model is the record, `boxTable` is what the box draws from.
- `Economy.currentSeries()` reads `state.series`, which no longer exists, so it always answers
  the first series and `globalOf()` is the identity plus one. The *declared* shape is still
  correct and is what the drawer's Economy panel renders.

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

### What actually paces the run

**Items and coins now bind at almost the same moment, and that is the thing to check before
adding any cost.** Items were the pacing constraint with room to spare; **Payroll** and **Studio
Overheads** spent most of that room. Measured over 80 seeded runs of the real
`spendRoll → resolveLandingEvents → Unlock.payStep` loop, with each constraint waived in turn:

| rolls to all 18 episodes | coins alone | items alone | the run |
|---|---|---|---|
| before the bills | 1,544 | 1,845 | 1,877 |
| **as shipped** | **1,774** | **1,845** | **1,953** |

Items led coins by 19.5%; they lead by **4.3%** against a 34-roll standard error — so which one
actually binds varies by seed. The bills cost 230 rolls of coin pace, 77% of all the slack there
ever was. **Adding any further coin sink makes coins the binding constraint**, and the prices in
`content/` would have to be reworked to suit. Each bill is landed on 0.142 times a lap (5.7
landings spread over 40 tiles), so a bill of C costs 0.142 × C a lap.

Two figures previously documented here were wrong and are corrected above. The item baseline was
never 2,290: the deck table sums to **115, not 100**, so 22.6% of draws grant an item and 42
items take ~1,845 rolls. And the coin figure came from a harness that had zeroed the Reshoot fee
and pinned the balance at 1e9 — the Reshoot fee is a *share* of the balance, so a free-running
balance changes it. Re-measure with an unmocked run, never with a pinned one.

**The gala's item ladder did not move any of this, and that is measured rather than argued.** The
large bonus now pays `[1,2,3] × stake` props by rung instead of a flat `2 × stake`, and
`Economy.trainLadder()` picks the rung with `Math.floor(Math.random()*3)` — uniform — so the mean
is the 2 it replaced. Two arms of the same harness (one file swapped, nothing else; free-running
balance; two independent 500-seed families that agree) finish within 1.3σ and 0.3% of each other:
the run 1,748.6 → 1,747.1, coins alone 1,747.4 → 1,745.4, items alone 869.4 → 871.9, against a
~34-roll standard deviation for a single run. Item rate over 16M rolls per arm, 20.13 → 20.10
rolls per item. Nothing needed retuning and the prices in `content/` did not move.

**The table above, though, is older than this tree, and both arms of that run disagree with it.**
It was measured before the deck merge that made the four bonus tiles draw a card; the same harness
now reads roughly **1,745 / 870 / 1,747** where the table says 1,774 / 1,845 / 1,953 — which puts
the run *on* coins-alone and has items finishing in half the rolls. **Coins bind now, not items**,
so the warning above has already happened and "adding a coin sink" is no longer the hypothetical it
is written as. That is the deck merge's doing and not the ladder's; re-measuring this table is a
job of its own and it is still owed. Until it is done, read the three rows as the shape of the
argument — each constraint waived in turn, on an unmocked run — and not as current figures.

**Nothing on the board may push coins below zero.** There are four sinks — the two bills, the
Reshoot fee and the deck's Fine card — and each floors at the balance rather than clamping
afterwards (`Math.min(Math.max(0, state.coins), due)`), so a broke player pays nothing and an
overdrawn one is never charged twice. The Fine card was the last one without a floor; at ×10 on
an empty balance it reached −800, which every tile charging after it then had to have an opinion
about. One rule, pinned by a test over all four.

Two consequences that were both bugs before they were rules:

- **The stake has to scale items the way it scales coins.** A ×5 roll costs five energy and pays
  five times the coins; if it granted the same one prop, every stake above ×1 would buy the same
  coins per session and a fifth of the items — a trap on a run gated by items. `DeckTile` grants
  `card.items × mult` for exactly this reason.
- **The item draw is weighted by what is still owed** (`Unlock.demand`), not spread evenly over
  the series' set. Series 001 asks for its five props 11/11/9/7/4 times; an even draw spends
  about a quarter of the grind on props already finished with, and can leave the last one owed
  as the one that never comes. Weighted, an item stops appearing once it is covered — which is
  also what makes an item price impossible to deadlock on.

If you change the deck weights, re-measure rather than reasoning about it. The numbers above
came from a 200,000-roll trace, not from the table.

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

### Auto-roll

`autoMode` in `js/ui/main.js` is `null | "roll"`. There used to be a second mode —
"Auto-play session", a batch tool that also bought the cheapest builder upgrades — and with
builders gone the two were the same loop, so it went with them.

**A popup PAUSES the loop rather than stopping it.** `roll()` awaits the ready-to-unlock offer in
its tail, and `runAuto`'s loop is `while(autoMode==="roll"){ await roll(); … }` — so while the
offer is up the loop is parked mid-iteration and resumes by itself when it closes. `autoMode` is
never touched. The obvious alternative (null it, call `autoRoll()` again afterwards) is broken:
the resumed call starts a SECOND loop racing the first, and the first one's `finally{ autoMode=
null }` kills the second as it unwinds — auto-roll would stop one roll after the player pressed
Unlock, looking like the popup had broken it.

**Auto roll has no button of its own — it is a state of Roll.** Tap Roll to roll once, hold it
for `cfg.autoRollHoldMs` to hand the loop over, tap again to stop. That is why `renderAll()`
keeps `#rollBtn` enabled while `autoMode === "roll"`: it is the only way out, so disabling it
mid-loop would strand the player. The handler uses pointer events, not click, because the tap
and the hold have to be told apart before a click would fire; sliding off the button cancels
the hold without rolling. The loop stops on a second tap or when energy can't cover the
multiplier.

## Tests

```bash
node tests/run.js
```

Zero-dependency runner that loads the real scripts into a `vm` context — no framework, no build,
no mocked app modules. Covers the DOM-free layers: util, config invariants, board model,
episodes, game (session/time), tiles, overlays, storage, env, dice and the economy model.
**Run it after changing any of those.** The builder and clue suites are deleted along with what
they tested; the storage suite now asserts that a **v1 save** — one carrying builders, clues, an
episode queue and a sealed bet — still loads, keeping the run and silently dropping the rest. See [tests/README.md](tests/README.md), which also carries two lists we
have not acted on yet: functionality that would need heavy mocking, and logic currently trapped
inside DOM-building functions.

## Conventions

- **Everything timed is tunable.** Presentation timings live in `cfg` and appear in the tuning
  drawer, which edits `cfg` live. Don't hardcode a duration; add a config key.
- **New config keys are safe to add** — `loadConfig()` merges saved values onto `DEFAULTS`, so
  existing saves pick up new defaults. Removing a key leaves a harmless stray in old saves.
- **New persisted state** must be added to `serializeState()` in `js/storage.js`; unlisted fields
  are treated as transient. That list is also the *migration*: `loadState()` only copies keys
  `serializeState()` still names, so a field removed from the game is dropped from an old save
  rather than resurrected onto `state`.
- **`roll()` and `runAuto()` use try/finally.** `state.animating` and `autoMode` must always
  clear — if they don't, the board soft-locks with Roll permanently disabled.
- **One WebGL scene, one renderer.** The buildings used to live in a second scene swapped in by
  `Board3D.setView()`; that scene is gone with the builders. A second `WebGLRenderer` would take
  a second GL context and browsers cap those, so if anything else ever needs its own scene it
  swaps into this renderer rather than making a new one.
- The activity log keeps the last 60 entries; older lines are trimmed.

## Known dead config

This branch has a lot of it, and the reason is deliberate: the economy model was kept whole while
the systems it priced were deleted. Nothing here is an oversight — but nothing here is load
bearing either, so don't reason from it.

`Economy.OWNED_CFG_KEYS` still writes the builder, clue, accuracy and wager keys onto `cfg`, so
those keys must **stay in `DEFAULTS`** even though nothing reads them: `apply()` writing a key
that does not exist is how a projection starts silently doing nothing. Most of them no longer
appear in the tuning drawer, because a knob that changes nothing is worse than no knob.

Read by nothing, kept anyway:

| Key(s) | Was |
|---|---|
| `buildings`, `tiers`, `boxesPerUpgrade` | the builder system |
| `accuracy`, `accuracyPerClue`, `accuracyMax`, `clueAlbumSize` | the clue→accuracy edge |
| `minWager`, `wagerSafe`, `wagerConfident`, `wagerMax`, `avgOdds` | the wager tiers |
| `secPerRoll` | never wired; the spreadsheet derives "active minutes per session" from it |
| `autoCollectMs` | the Collect popup's fast auto-close, taken only by "auto-play session". Auto-roll takes the player-facing 10–20s window, and it is the only auto mode left |

`trainSmall`, `trainLarge` and `trainLargeChance` are **live again** — they price the two
bonus-game cards, which is what the train tile used to do. So are `bonusGames`, `bonusLoadMs`,
`bonusMaxMs` and `collectMinSec`/`collectMaxSec`. The names still say "train" because that is
what the economy workbook calls the column; the tile is gone, the numbers are not.

Four of the model's five relative knobs are imported and ignored; only `builderCost` is read,
and it now scales a curve nothing prices. `participation` stays unprojected on purpose.
