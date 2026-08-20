# Harbour Heights — predictive-narrative economy simulator

A Monopoly-GO-style board game used to model a short-drama app's economy: pull a card from a
54-card deck to move around a 40-tile board, the two JOKERS are tickets, five tickets
unlock a story episode, and watching an episode means betting on what happens next. Coins earned
on the board buy the next deck.

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
TILES.md            the 40-tile roster: index, file number, type, name, printed value, art
vendor/             three.module.js (r169), vendored; no npm, no build step
assets/tiles/       optional per-tile art: models/N.glb (3D) or N.png (flat, legacy CSS board)
assets/env/         the world around the board: scene.js manifest + models/  → assets/env/README.md
assets/cards/       painted card art: back.png + the two jokers        → claude-skills/card-deck-art
assets/props/       objects that sit ON a tile (the mystery box)        → assets/props/README.md
minigames/          full-frame bonus games, one per train bonus        → minigames/README.md
tools/              normalize-env.py — conforms an environment GLB to the asset contract
claude-skills/      the Claude Code skills this repo owns: board-tile-art (the 40 tiles),
                    board-env-art (the world around them) and card-deck-art (the deck's
                    back and jokers). Run link-skills.sh once after
                    cloning — it runs each skill's setup.sh, then symlinks them into
                    .claude/skills, which is git-ignored. Both need the Scenario MCP server
css/                base · board · panels · drawer · overlay · ftue · mobile (loaded last)
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
  shoe.js           the card shoe: minting a pack, dealing, pulling, buying
  state.js          the run state object
  storage.js        localStorage persistence for config and progress
  episodes.js       episode registry
  clues.js          the clue album: its content, and which slots are owned
  tickets.js        the ticket row: placeholders, the row rule, episode unlocks
  board-actor.js    shared base: reward helpers + presentation event builders
  tiles/            one file per tile type                                   → js/tiles/README.md
  overlays/         things that sit on top of tiles (mystery box)            → js/overlays/README.md
  game.js           landing dispatch, prediction, session time and card regen
  ui/               everything that touches the DOM                          → js/ui/README.md
    card-art.js     the deck's look: card faces and the back, drawn to canvas
    fx.js           floats, log, toasts, confetti, the flat card, blocking overlays
    minigame.js     opens a bonus game over the board; falls back to fx.js's Collect popup
    board3d.js      the WebGL board (three.js) — the module entry point; calls boot()
    env3d.js        the island, sea and props around the board (imported by board3d.js)
    shoe3d.js       the deck and the ticket placeholders (imported by board3d.js)
    npc3d.js        the cast walking the ring — scenery only, and ships OFF (cfg.npcs)
    render.js       state → DOM; renderAll() is the entry point
    player.js       episode video player (markup + behaviour)
    prediction.js   predict & watch: bet → playback → result; the unlock popup
    library.js      every unlocked episode, rewatchable
    album.js        the clue album screen
    store.js        deck / coin / ticket store modal
    finale.js       series-complete celebration
    economy-panel.js  the drawer's Economy section: provenance, curve, series, .xlsx import
    drawer.js       tuning drawer + the two reset buttons
    ftue.js         the scripted first-time flow, and the ?ftue switch that gets past it
    main.js         pull(), playEvents(), auto modes, wiring, boot
```

Note the naming: `js/overlays/` are **board overlays** (things sitting on a tile, like the
mystery box). Modal dialogs live in `js/ui/` — there is no `ui/overlays.js`.

**And note "deck", which means three unrelated things.** The one that matters is the 54-card
pack the player pulls from (`js/shoe.js`, `state.shoe`) — that one is never called `deck` in
code. The global `twistDeck` is the *Plot Twist* card table behind the six board tiles at
indices 3/8/13/18/23/28, whose tile type is still spelled `"deck"` in `js/board-model.js`
because renaming it would reach the 3D palette and the CSS for no gain. And `ENV_Y.deck` in
`js/env-model.js` is the ground slab the board stands on. Vocabulary for the pull deck is
**pack** (a unit of 50), **shoe** (what you hold) and **pull** (one card); it never borrows the
other word.

## The one architectural rule

**Logic never touches the DOM.** Landing resolution mutates `state` synchronously and returns an
ordered *event list*; `playEvents()` in `js/ui/main.js` renders it with animation. This is what
makes pacing data-driven and lets auto-play block correctly on popups.

```
pull()  →  resolveLandingEvents()  →  [{float}, {log}, {move}, {card}, {reveal}, {collect}, …]
                                   →  playEvents() animates them
```

Event vocabulary and the tile/overlay contracts are documented in
[js/tiles/README.md](js/tiles/README.md) and [js/overlays/README.md](js/overlays/README.md).
`Tile` and `Overlay` both extend `BoardActor` (`js/board-actor.js`), which owns the reward
helpers (`gainCoins`/`gainCards`/`gainTickets`/`gainClues`) and the blocking presentation builders
(`reveal`/`collect`/`card`) so neither side duplicates them.

## Systems

| System | Where | Notes |
|---|---|---|
| Board layout | `js/board-model.js` | Fixed 40 tiles. Start sits at the **bottom** point of the diamond; indices run clockwise on screen (Start → Spa → VIP → Premiere). Per-tile roster — every index, its type, what it prints and which model it has — is [TILES.md](TILES.md). |
| Board rendering | `js/ui/board3d.js` | three.js scene: orthographic camera at 45° azimuth / 38° elevation, which reproduces the old CSS projection exactly (`sin 38° = cos 52°`). Tile labels stay DOM over the canvas so text is crisp. `cfg.board3d = 0` falls back to the legacy CSS-3D board, as does a missing WebGL context. |
| Tile behavior | `js/tiles/` | One file per type, self-registering. `onLand(ctx)` carries **the card that produced the landing** (`ctx.card`, threaded from `pull()` through `resolveLandingEvents`) — the Spa's grant is that card's rank, and any future tile that cares how it was reached reads the same field. Null is legitimate and means "resolved without a pull". → [README](js/tiles/README.md) |
| Environment | `js/env-model.js` `js/ui/env3d.js` | The island the board stands on, the sea, and the props in it. Several worlds live in `assets/env/scene.js` and `cfg.envScene` picks one live from the tuning drawer. Placement is data and the engine measures nothing: assets are conformed to a stated contract by `tools/normalize-env.py`, so a new environment needs no code change. `cfg.envMargin` sets how much ground is in frame — it costs board size. → [README](assets/env/README.md) |
| Tile artwork | `assets/tiles/` | Drop `models/N.glb` to skin tile N-1 in 3D (1-based, so `1.glb` is Start); `N.png` does the same on the legacy CSS board. Absent files change nothing. Models are normalized **on load** — any scale/origin/up-axis drops in. → [README](assets/tiles/README.md) |
| The deck | `js/shoe.js` `js/ui/shoe3d.js` `js/ui/card-art.js` | A **pack** is a real deck: four suits of 1–13 plus the jokers, shuffled. A card is a short string — `"s7"` is the 7 of Stars, `"J1"` is Victoria — and its RANK is how many tiles it moves. The four suits are the show: ⭐ Stars (the Walk of Fame), ❤️ Hearts (romance), 💎 Diamonds (the real stone, cut as a brilliant rather than the flat playing-card rhombus) and 🎭 Masks (the drama). The **jokers are the tickets**, and they are the two leads — so `cfg.ticketsPerPack` is the joker count, one number for both, and there is deliberately no second key. It ships at **10**, not the natural 2, dealt round-robin so there are five of each lead. **The 52 numbered cards are fixed and jokers are added on top**, which makes `packSize` **derived, never set**: 52 + jokers, so ten jokers is a pack of **62**. `Shoe.packSize()` is the truth and `Economy.apply()` caches it onto `cfg.packSize` for everything that reads a cap; `ECONOMY_DEFAULT.cards` carries no pack size and the tuning drawer has no box for one, because a second number saying the same thing is free to drift — and when it did, raising the joker count silently ate the 12s and 13s off the top of the deck and changed how far the token moves. Note the knock-on: pack size is also the free-card cap, so a bigger pack is a slightly longer leash on the clock. `ticketsPerPack` is **economy-owned**: change it in `ECONOMY_DEFAULT.cards` and bump the model version, or a returning player's save pins the old value. `state.shoe` is an array of **concrete cards** in pull order, never a count and never a seed: a seed only re-derives under an identical RNG, and a count cannot express how many tickets are still in there, which is the invariant the economy rests on. The card flies off the deck to the middle of the screen; `cfg.pullRevealMs` is the flight and the promise resolves at exactly that mark on a **timer, not a frame**, `cfg.pullToMoveMs` gates the token. **A joker is celebrated, a number is not**: it presents at `cfg.jokerScale` times the usual size with a late overshoot that settles back, turns once in its own plane, holds for `cfg.jokerHoldMs` and takes confetti with it — all of it after the reveal has resolved or inside the same flight, so the turn is not one frame slower. **The deck on the board is the count**, as **one stack, always**: full whenever the shoe holds a pack or more (one pack or twenty is the same picture — the exact number is on the HUD, and the deck's job is the feeling of running low), then falling on a curve through the last pack, the steps bunched near empty where they carry information rather than one step every N cards. Fourteen heights, ending at a single card lying flat. Pulled from `Shoe.count()` every frame, never pushed. Drawing extra packs as separate piles was tried and reverted: two similar stacks a step apart reads as a half-finished riffle, and got reported as a stuck shuffle. Falls back to a flat DOM card when `cfg.shoe3d` is off or the deck failed to build. |
| Bonus mini-games | `minigames/` `js/ui/minigame.js` | The four train tiles — **an airplane in the art and "Flight bonus" in the copy; the type, the CSS class, the palette key and the game ids are all still spelled `train`**, the same split the `deck` tile type lives under — pay one of **two** bonuses (small / large) and each opens its own full-frame game over the board — Steal the Spotlight and the Premiere match-3. Each game is a standalone page in an iframe, driven by `postMessage` — the app is classic scripts sharing one global namespace, and these files bring their own `$`, `fmt`, `renderer` and a `*` reset. **The engine owns the money**: the tile banks the coins, picks the winning prize rung, and hands the game finished numbers to present — which is why the match-3 deck is resolved as cells are opened rather than shuffled. A missing or broken game degrades to the Collect popup, so it can never cost coins. Note the large bonus's ladder currently pays 2/3 of the model's number; see [TODO.md](TODO.md). → [README](minigames/README.md) |
| The cast | `assets/npcs/` `js/ui/npc3d.js` | Figures walking the ring, on the inner edge of each tile because the centre is taken (art detail, the mystery box, the token). **Scenery and nothing else** — no state, not persisted, nothing to land on, and the pull loop never waits for them; a figure that moved coins from outside the event list is the one thing that could desync the economy from what the player was shown. **`cfg.npcs` ships at 0**, and off means the models are never fetched: `NPC3D.init()` deliberately does not load, `tick()` does on the first frame it runs enabled, so the drawer toggle still works with no reload. Switching back off hides them rather than dropping them. |
| Overlays | `js/overlays/` | Resolve *before* the tile they sit on. Mystery boxes are dropped one per ticket earned (`cfg.boxesPerTicketCard`), straight onto the board — state first, animation on top. **They are thrown FROM the card that earned them**: `Board3D.throwOverlays(all, fresh, from)` takes an optional world-space origin and `dropBoxes` passes `Board3D.cardWorldPos()`, so on the joker path — the only one where a card is on the stage, since the boxes go while it is still held up — the reward is seen coming out of the ticket instead of dropping from nowhere. A null origin keeps the original fall-from-above, which is what every other path gets. A thrown box leaves the card at `cfg.boxThrowScale` times its size and shrinks to normal as it travels, on the same ease as the distance — the camera is orthographic, so nothing gets smaller with distance on its own and faking it is the only thing selling the depth of the trip. **The scale is a MULTIPLIER on the box's own resting size** (`userData.restScale`, stamped in `_addBox`), because a gold box already rests at `cfg.boxGoldScale` and an absolute scale would silently shrink every gold box it threw; `cancelBoxFx()` restores that same value, or a throw killed mid-flight strands a 4× box on the board for the rest of the run. A box is hidden behind the presented card for the first part of the trip and emerges past its edge; that is the effect, not a defect. A box's contents are drawn when it is **placed**, so one holding clues shows up **gold** from across the board; the draw moving earlier changes no expectation. → [README](js/overlays/README.md) |
| Board props | `assets/props/` | 3D objects the board places rather than being part of it: the mystery box on a tile, and the **VIP treasure chest** standing outside the ring past the VIP corner. Normalized like a tile, scaled in code, and optional: a missing file falls back to a plain cube. The chest is a **view of `state.vip`** that owns nothing — it opens, lights the coins inside and shuts whenever the pool changes, ambient and non-blocking because the pool is seeded about ten times a pack. It is **two models, not an animation**: image-to-3D returns one fused mesh with no lid node, so shut and open are two files and opening is a swap, the same "the file is the state" idiom as the plum/gold box. Its distance from the ring is measured, not chosen — far enough to clear the plinth, near enough to stand *in front of* the town instead of behind it. → [README](assets/props/README.md) |
| Economy model | `js/economy.js` `js/economy-import.js` | The numbers the game is balanced to, loaded from a spreadsheet. Segmented cost curve, ordered series, the clue→accuracy edge. `Economy.apply()` projects it onto `cfg`. See below. |
| Tickets / series | `js/tickets.js` | `cfg.ticketsPerEpisode` tickets fill one episode placeholder and unlock one episode. The board shows a **row** of `cfg.episodeRowSize` placeholders, and the row only advances once every episode on it is full **and watched** — which is the game's only stop condition. |
| Episodes & video | `episodes/` | Prediction data, the video player, betting rules. → [README](episodes/README.md) |
| Session & time | `js/game.js` `advanceSession()` | A pull costs one card, never coins. "Next session" advances the clock by the greater of a full deal (`cardRegenMin` minutes per card) and one session slot (`1440 / sessionsPerDay` minutes), deals free cards toward the cap and pays a login reward on each day rollover. **This is the game's clock** — see the note under the economy model. |
| Persistence | `js/storage.js` | Two independent localStorage slots — config and progress — with separate **Reset config** and **Reset user** buttons in the tuning drawer. Everything is guarded, so blocked storage degrades to "don't persist". |
| First-time flow | `js/ui/ftue.js` `css/ftue.css` `assets/host/` | Zara's scripted opening, built from "FTUE Wireframe v2": splash → she introduces herself → **episode 1 plays clean** → she reacts → **one guess** → episode 2 → **the win** → "Let's unlock more episodes". Content-first: the player watches two episodes before being asked for anything. No Builder and no wager — both were cut from the storyboard. → see below |
| Store | `js/ui/store.js` `openStore()` | Button top-right of the board. A **deck** is bought here and ONLY here — the play row used to carry a duplicate `#buyDeckBtn`, removed because two buttons doing one purchase is two places for it to drift. Coins 10k/100k/1M and tickets 5/25/100 are real-money grants — **coins can never buy a ticket**, which is the wall the free player walks up to. |

### The first-time flow

`Ftue.STEPS` is an ordered list of `{id, run(ctx)}` and a step is over when `run` resolves —
deliberately the whole contract, since a beat can be a line of copy, a video, a branching question
or all three, and a narrower shape would need widening for the first one that did not fit. Nothing
indexes into the list, so **a new beat is an entry in the right place and nothing else** — which
matters, because more are coming.

A step must **always resolve**. Anything it waits on goes through `ctx.until()` — which `screen()`,
`tap()`, `tapOne()`, `wait()` and `playEpisode()` all do — or Skip tears the UI down and leaves the
run loop parked on a promise nobody will settle. `finish()` is the one exit however the run ends,
and it is idempotent because `start()`'s loop calls it after a skip already has.

**Screen 5a is a loop, not a screen.** A wrong tap greys that option out, Zara points at the other
one, and the `for(;;)` only breaks on the correct answer. Splitting it into its own step would mean
two places that have to agree about which answer is right. Nothing about the intro decides that:
the question, the answers and `correct` all come off `episodes/002.js`.

**Rewards land when they are earned, not in a lump at the end** — episode 1 when it has played, the
coins on Collect, episode 2 when it has played. So a player who walks out halfway keeps exactly
what they did, and Skip needs no unwind logic. `_bankEpisode()` says "this one's on me" in the
*row's* language, because that is where `isWatched()` reads from: fill the placeholder, queue it
the way `award()` does, then take it straight back out of the queue. The board is handed over with
two collections done and the player collecting toward episode 3.

The video is the **real player** (`playerMarkup`/`playVideo`), restyled full-bleed — a second
implementation would be a second set of controls, seek-blocking and resolve-on-close to keep
working. Closing the video early still advances: refusing to continue would trap the player on a
video they have said they are done with.

**`?ftue=false` and the Skip button are not the same switch.** The parameter is a bypass for *this
load* and writes nothing, so dropping it brings the intro back; Skip is a dismissal and sets the
persisted `state.ftueDone`. `?ftue=true` (or a bare `?ftue`) forces a replay for a save that has
seen it, and the debug menu does the same with no reload. The flag lives in the **progress** slot,
so Reset user hands the intro back and Reset config does not.

**A host screen is two bands, and the split is load-bearing.** `.ftueScene` is where Zara stands,
lit and bottom-anchored, with her speech bubble above her and a tail pointing back at her;
`.ftuePanel` is what the player reads and touches. Her line used to sit in the same column as the
answer buttons, at the same width, in the same box — and it read as a fourth option you could tap.
So speech is light-on-dark with a tail and never full width, and everything pressable is a dark
chip or a filled CTA down in the panel. Nothing in the panel may be styled like the bubble.

The bubble sits **above** her, not beside her, and lives in the scene's **flow** rather than hung
off her block. Both were learned the hard way: the art is a full-length figure at 0.70 aspect, so
tall enough to fill the scene is wide enough to fill the column and there is no "beside"; and
anchoring the bubble to her meant it inherited the offset that deliberately pushes her off the
right edge, which ran her lines off the screen.

Zara's art is optional the way tile and prop models are — a missing pose falls back to a
silhouette, so the flow is playable before any of it lands. It must be **transparent PNG**: she is
composited onto a lit navy stage, and art drawn on a white ground forces the whole intro white to
hide the plate. See `assets/host/README.md` for the locked style block that keeps the poses looking
like one character.

### The economy model vs `cfg`

Two layers, deliberately separate:

- **`economy`** (`js/economy.js`) is the *loaded model*. It comes from an .xlsx, carries a
  version string, and holds things `cfg` cannot express: a segmented cost curve, an ordered
  series list, a two-item mystery box.
- **`cfg`** is the *live tuning surface* — flat scalars the drawer edits by hand.

They meet in `Economy.apply()`, which projects the model's flat values onto `cfg` and rebuilds
`twistDeck`/`boxTable`. So tile code still just reads `cfg.stdBase` and nothing downstream had
to learn about the model. `Economy.OWNED_CFG_KEYS` is the list `apply()` writes, and a key
`apply()` sets but the list omits produces **no error at all** — a returning player simply keeps
their old value forever and an imported workbook appears to do nothing for them.

`apply()` may only rebuild **templates and scalars, never the live shoe.** It runs on every
drawer edit, every series change, every `loadState` and at boot, so building `state.shoe` there
would reshuffle a player's remaining cards each time a designer nudged a slider.

**The curve prices tickets.** `Economy.costFor(episode, ticket)` is exactly what
`costFor(builder, level)` used to be — the mapping is 1:1, one builder of five levels became one
episode of five tickets, so the six fitted segments and every number in them survived the rework
untouched. `Economy.packPrice(state.ticketsPriced)` sums the next `cfg.ticketsPerPack` rungs, and
`state.ticketsPriced` advances when a pack is **minted**, not when a ticket is spent: buying a
pack immediately raises the price of the next one, so stockpiling cheap packs is not a strategy.

**The cost curve is a list of segments and the last one must have no `to`.** A bounded final
rule leaves every later episode unpriced, and since a pack's price is the sum of two rungs that
does not disable one button — it makes every future pack cost `Infinity` and removes the game's
only coin sink. `Economy.validateCurve()` refuses it. One formula never holds for a whole run —
a new rule from episode 500 is an appended segment, not a code change.

**The shipped curve is six segments**, fitted to economy model v3.12, whose pacing is phased
rather than steady: 6 episodes/day, stepping to 5 at day 5 and 4 at day 15, easing to 3.5 by
day 60. Episodes 29 and 74 are where those steps land. The fit preserves the cumulative cost
over each segment rather than any single price, because days-to-finish is a running total —
it reproduces the model's full run exactly and series 1 to within 12 minutes, with no episode
more than 1% off the spreadsheet. A consequence worth knowing before "fixing" it: the price
**steps down slightly** at each segment boundary, and a pack's price saw-tooths within an
episode because the ramp resets at every episode. Both are the shape that was fitted. **`EconomyImport` cannot yet produce this shape** — it still
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
`localStorage` under `pmdrama.econ.v3`, with its source filename kept for reference.

**All three storage slots are v3 and each also refuses a payload whose own `v` is not 3.** Belt
and braces, because the failure mode is not a refusal but a *partial* restore: `loadState()`'s
copy loop walks `Object.keys(serializeState())` and silently ignores saved keys that no longer
exist, so a pre-rework save would restore coins, day, clock, clues, position and every streak
counter and leave a run with an empty shoe, no tickets and a board position inherited from a
dice game — with nothing thrown and nothing logged.

### The deck is the whole clock

Worth stating plainly, because it is the one thing the rework changed about *pacing* rather than
about mechanics. Fifty pulls earn far more coins than the next pack costs — roughly 4,000
against 400 early on — so **coins never gate anything**. If a player could buy packs freely the
game would have no pacing at all. The rate free cards arrive at (`cfg.cardRegenMin`, dealt by
`advanceSession`) is therefore the entire clock, exactly where the energy allowance used to be,
and bought packs are the accelerator on top of it.

### Clues are two different things

`state.clues` is the **album** — a lifetime total, never spent, and it IS the album's
progress: the clues you own are the first `state.clues` slots (`js/clues.js`), so the album
stores nothing of its own. Content lives in `CLUE_SETS`; `cfg.clueAlbumSize` is the album's real
size, so slots past the authored sets are numbered placeholders rather than missing entries. `state.cycleClues` is
the **flow** — banked since the last prediction, it raises the modelled accuracy
(`Economy.accuracyFor`: 0.55 + 0.04/clue, capped at 0.70) and is spent and reset by
`resolvePrediction`. Mystery Box item 2 is the only source; no card pays clues, so one table
sets the rate.

Accuracy only decides the outcome in **auto** runs — a manual pick still wins on its merits.
That gap is open design, tracked in [TODO.md](TODO.md).

### The shoe may exceed the cap

Buying a deck **merges** the new pack into whatever is left of the old one and reshuffles the
lot, so a shoe over `cfg.packSize` is the ordinary state of affairs rather than an edge case.
**Overflow is legitimate**, and nothing may trim the shoe downward. Anything that adds free
cards tops up *toward* the cap without reducing a shoe already above it:

```js
const room = Math.max(0, cfg.packSize - state.shoe.length);
Shoe.dealFree(Math.min(n, room));        // and dealFree applies the same rule internally
```

Four enforcement sites, and **two of them are "do nothing" comments** — which is why a rewrite
that adds a plain `Math.min` passes every test by luck: `BoardActor.gainCards` and
`Shoe.dealFree`, the `advanceSession` deal, and then `onCfgChange` and `loadState`, which
deliberately do **not** clamp. Adding a new clamp will silently delete cards the player bought.

**And there is now one deliberate exception, `Shoe.dealExtra`.** The cap is the *free allowance*,
which is the right rule for a regen tick and the wrong one for a reward the player just landed
on: because `dealFree` deals nothing to a shoe already at the cap — the ordinary state right
after buying a pack — the Spa corner paid **nothing** roughly two thirds of the time while still
announcing a card. `dealExtra` is the same deal without the ceiling, and it is a separate method
rather than a flag so the cap rule stays stated at each site. It still deals off `state.packTail`
like everything else: nothing may mint a loose card outside a pack, or the tickets-per-pack
invariant leaks away one grant at a time.

This rule was inherited from energy, and it matters *more* now: energy only ever overflowed via
the store, where the shoe overflows on the ordinary buy-a-deck path.

### `index.html?view=mobile` — the player's-eye view

Everything that exists for development is hidden — side panels, action bar, tuning drawer and
its button, and the second controls row — and `.wrap` becomes a 9:16 frame filling the
viewport. What is left is what a player sees: the board, the play controls already riding on
it, the store, and the HUD, which moves *inside* the frame as an overlay rather than being
hidden with the rest (a board with no coin or card balance is not the game).

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
one can own it. (The string is still `"roll"` — it is also `#rollBtn`'s id and the class the CSS
keys off, and renaming it buys nothing.) Either stops on a second click, when the shoe runs dry,
or when the ticket row fills. **Both conditions are re-checked every pass**, because both can
become true mid-run, and they must agree with `pull()`'s own guard and `cantRoll` in
`js/ui/render.js` — teach one and not the others and the buttons lie about a loop that is still
going.

**Auto pull has no button of its own — it is a state of Pull.** Tap Pull to pull once, hold it
for `cfg.autoRollHoldMs` to hand the loop over, tap again to stop. That is why `renderAll()`
keeps `#rollBtn` enabled while `autoMode === "roll"`: it is the only way out, so disabling it
mid-loop would strand the player. The handler uses pointer events, not click, because the tap
and the hold have to be told apart before a click would fire; sliding off the button cancels
the hold without pulling.

|  | **Auto pull** (hold Pull) | **Auto-play session** |
|---|---|---|
| Buys decks | no — it stops and says the deck is empty | yes, whenever coins cover the next pack |
| Intent | simulates a real player | internal balancing tool |
| Train bonus game | plays it, and picks for itself after the 10–20s window (nobody is at the keyboard) | skipped — takes the Collect popup's fast path, so no WebGL page is opened per pull |
| Episode video | plays in full | skipped, but logged with its length |
| Prediction outcome | pick decides | modelled via `cfg.accuracy` |

Neither mode opens the prediction modal on its own — episodes are only watched when the player
clicks **Predict & watch**.

## Tests

```bash
node tests/run.js
```

Zero-dependency runner that loads the real scripts into a `vm` context — no framework, no build,
no mocked app modules. Covers the DOM-free layers: util, config invariants, board model,
episodes, tickets, the card shoe, game (prediction/session), tiles, overlays and storage. **Run it after
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
- **`pull()` and `autoPlay()` use try/finally.** `state.animating` must always clear — if it
  doesn't, the board soft-locks with Pull permanently disabled.
- **A ticket card must `return` before the landing is resolved**, not merely skip the move loop.
  `resolveLandingEvents()` runs unconditionally after the loop and resolves overlays *before* the
  tile, so falling through on a card that moved the token zero tiles re-collects whatever mystery
  box the player is standing on — a free box on every ticket, with nothing in the logs.
- **The ticket row shows `cfg.episodeRowSize` placeholders and the row is derived, not stored.**
  `Tickets.page()` is the first row still holding an episode that is not *(full and watched)*, so
  filling them out of order can never skip a row and nothing extra needs persisting. Watchedness
  is read off `state.epQueue` and `state.pendingReveal`, both already saved — and a sealed but
  unwatched bet counts as **not** watched, or ducking out mid-episode would advance the row.
- **A full row is not a dead end.** It is the only stop condition in the game, so Pull stays
  enabled, says "Watch to continue", and opens the prediction. A disabled primary button with no
  explanation reads as a soft-lock.
- **The 🎬 badge counts episodes you OWN, not episodes still waiting.** `bingeCount()` in
  `js/ui/render.js` is `Tickets.unlockedEpisodeIds().length` — the size of the library the button
  opens. It was the unwatched queue while the button jumped straight into the next prediction;
  once it became the library's door, that left the intro's two free episodes reading `0` on a
  dimmed button. It is **pinned** while a completed collection flies into it (`holdBingeCount`),
  and the pin goes on in `pull()` **before** `ticketPullEvents()` — that function both awards the
  ticket and renders, so pinning any later flashes the new number before the card that delivers
  it has moved. `pull()`'s `finally` always releases.
- **The ticket placeholders are buttons.** A completed one draws a play triangle, so it has to
  actually be tappable — `Board3D.slotAt()` raycasts the row's sprites and `window.onSlotTap`
  in `js/ui/main.js` opens the prediction. Two traps: the row is rebuilt whenever a ticket
  lands and a fresh sprite's world matrix is stale until the next render, so `slotAt` updates
  the matrices before testing; and **slot 0 is a legitimate hit and is falsy**, so callers must
  test `!= null`. The tap also has to be told apart from a camera pan, which is why the pick
  runs on pointerup only when the pointer travelled under a few pixels.
- **A pulled card lands at a FIXED spot on the board, not on the screen.** Every card flies to
  `Shoe3D._discardPos()` (the board centre by default) and the next one lands on top of it, so
  only the last card pulled is ever visible and the scene holds exactly one. Deliberately unlike
  the mystery box, which flies to the camera's aim: a box is a momentary burst that must be
  centre-screen wherever the camera is looking, where a card is the board's memory of the last
  turn and belongs somewhere the player learns.
- **Prices use `fmtShort`** (`2.5k`, `1.2m`, `14b`), capped at four characters, so the play row
  fits one phone line whatever the economy charges.
- The activity log keeps the last 60 entries; older lines are trimmed.

## Known dead config

`secPerPull` and `avgOdds` are in the tuning drawer but read by nothing. Both are still used by
the economy spreadsheet (seconds-per-pull derives its "active minutes per session"; average odds
derives the prediction edge), so wiring them up is defensible — see [TODO.md](TODO.md).
`avgOdds` is a *reference* number: real odds are per-answer in the episode files, so the model's
single average has no honest call site until something needs to check the library against it.

Four of the model's five relative knobs are imported and ignored; only `ticketCost` is read.
`clues` are now spent — see "Clues are two different things" above.

The **wager tiers are wired**: `wagerSafe/wagerConfident/wagerMax` project onto `cfg` and
`Economy.wagerTiers(balance)` prices them, with `minWager` as a floor under all three.
`clueAlbumSize` drives the HUD's `137/300` album readout. `participation` stays unprojected on
purpose — it is the share of predictions the model expects a stake on, which in a game a human
plays is an *outcome*, not an input; what the game owes it is the choice, so **Skip & watch is
always offered**.
