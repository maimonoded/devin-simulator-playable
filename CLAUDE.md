# Harbour Heights — predictive-narrative economy simulator

*(branch `collectible_version` — the collectible loop. `main` runs the builder loop instead; the
two are alternatives being compared, and this branch is not to be merged until one is chosen.)*

A Monopoly-GO-style board game used to model a short-drama app's economy: roll dice around a
40-tile board, land on a 🎁 tile to win a **box**, open it for a **collectible card**, and
completing a page of five cards unlocks a story episode — which you watch by betting on what
happens next. Coins buy more boxes and the **status** items that mark you out as a fan.

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
assets/board/       WHAT THE RING IS MADE OF: board.js, one entry per Season → assets/board/README.md
assets/pools/       WHAT A LANDING CAN TURN UP: pools.js, one weighted table per pool
                                                        → assets/pools/README.md
assets/tiles/       optional per-tile art: models/N.glb (3D) or N.png (flat, legacy CSS board)
assets/env/         the world around the board: scene.js manifest + models/  → assets/env/README.md
assets/dice/        the die: models/die.glb, built not reconstructed    → assets/dice/README.md
assets/npcs/        the series' characters, to stand on tiles           → assets/npcs/README.md
assets/cards/       WHAT THERE IS TO COLLECT: cards.js + the card art   → assets/cards/README.md
assets/status/      the status track and its ten items                  → assets/status/README.md
assets/estate/      the Status Estate, six tiers of one building         → assets/estate/README.md
assets/boxes/       the three box tiers' art                            → assets/boxes/README.md
minigames/          full-frame bonus games, one per train bonus        → minigames/README.md
tools/              normalize-env.py — conforms an environment GLB to the asset contract
                    make-dice.py    — builds assets/dice/models/die.glb from one blank face
claude-skills/      the Claude Code skills this repo owns: board-tile-art (the 40 tiles) and
                    board-env-art (the world around them). Run link-skills.sh once after
                    cloning — it runs each skill's setup.sh, then symlinks them into
                    .claude/skills, which is git-ignored. Both need the Scenario MCP server
css/                base · board · panels · drawer · overlay · collection · mobile (loaded last)
episodes/           episode content: NNN.js (prediction) + NNN.mp4 (video)   → episodes/README.md
js/
  util.js           $, fmt, sleep, rand, chance, weighted, shuffle
  config.js         cfg defaults + the tuning-drawer schema
  content.js        login reward ladder (story content lives in episodes/)
  xlsx.js           dependency-free .xlsx reader (ZIP + SpreadsheetML), browser-only
  economy.js        the loaded economy model: segmented cost curve, series, the clue edge
  economy-import.js workbook → model, and the structural check that gates it
  board-model.js    the board ENGINE: reads assets/board/board.js. Type, argument, pool and grid
                    cell per index; generalises to any ring whose size divides by 4
  pools.js          the draw ENGINE: reads assets/pools/pools.js. One row, weighted, per landing
  env-model.js      environment geometry: datums, what's on screen, the height budget
  dice-model.js     which turn puts a rolled number on top, and where a throw lands
  state.js          the run state object
  storage.js        localStorage persistence for config and progress
  episodes.js       episode registry
  board-actor.js    shared base: reward helpers, grantEnergy, presentation event builders
  clues.js          WHAT UNLOCKS AN EPISODE: per-episode evidence, and the edge it buys
  cards.js          THE COLLECTION: the Season catalogue, copies, conversion, sets
  collection.js     the ARC and the library — which episodes, unlocked, watched, turned over
  status.js         the status track: points, ranks, buying, milestone sweep
  boxes.js          the three box tiers, the drop tables, and openBoxEvents()
  tiles/            ONE class for the four pooled types, plus the four corners → js/tiles/README.md
  game.js           rolling, landing dispatch, prediction, session time
  ui/               everything that touches the DOM                          → js/ui/README.md
    fx.js           floats, log, toasts, confetti, dice, blocking overlays
    minigame.js     opens a bonus game over the board; falls back to fx.js's Collect popup
    board3d.js      the WebGL board (three.js) — the module entry point; calls boot()
    env3d.js        the island, sea and props around the board (imported by board3d.js)
    dice3d.js       the dice, thrown onto the board (imported by board3d.js)
    npc3d.js        the series' characters, walking the ring (imported by board3d.js)
    case3d.js       THE CURRENT SET, standing inside the ring (imported by board3d.js)
    box3d.js        THE BOX you tap to open, and the cards out of it (imported by board3d.js)
    artcache.js     card/item images, decoded once and shared by both of those
    cardface.js     ONE CARD, DRAWN — shared by the album and the box popup
    render.js       state → DOM; renderAll() is the entry point
    player.js       episode video player (markup + behaviour)
    prediction.js   predict & watch: bet → playback → result; the unlock popup
    library.js      every unlocked episode, rewatchable
    album.js        the album: one page per episode, empty slots and all
    pack.js         opening a box — tap it, or it opens itself after five seconds
    statusup.js     "your status went up" — the track moving, and the rank turning over
    profile.js      the status track and the shelf of things that prove it
    store.js        boxes, coins and energy
    finale.js       set-complete and collection-complete celebrations
    economy-panel.js  the drawer's Economy section: provenance, curve, series, .xlsx import
    drawer.js       tuning drawer + the two reset buttons
    main.js         roll(), playEvents(), auto modes, wiring, boot
```

Nothing sits on a tile any more: a board index has exactly one thing on it, and the overlay
layer that used to hold mystery boxes is gone. Modal dialogs live in `js/ui/` — there is no
`ui/overlays.js`.

## The one architectural rule

**Logic never touches the DOM.** Landing resolution mutates `state` synchronously and returns an
ordered *event list*; `playEvents()` in `js/ui/main.js` renders it with animation. This is what
makes pacing data-driven and lets auto-play block correctly on popups.

```
roll()  →  resolveLandingEvents()  →  [{float}, {log}, {move}, {pack}, {unlock}, {boardDone}, …]
                                   →  playEvents() animates them
```

The collectible loop rides the same rail. Everything that banks cards goes through
`bankedEvents()` (`js/boxes.js`), which **banks first** and then returns `{unlock}` for any
episode the cards just completed, `{statusUp}` for a status item, and `{boardDone}` when that was
the last page of the set. Its two callers are `openBoxEvents()` (a whole box, with the popup) and
`drawCardEvents()` (one card off a pool row, or the Gala's guaranteed one). The store calls
`openBoxEvents()` too, so a box bought is exactly a box landed on — one code path, so the odds,
the unlock and the set-complete check cannot drift apart between them.

The unlock snapshot has to be taken **before** anything is banked, which is why `bankedEvents()`
takes a callback rather than a result: "unlocked" is derived from the albums, so the only way to
know what changed is to look before and compare after.

### One draw system, many pools

**Every landing draws one row from the weighted pool its tile points at.** That is the whole tile
system (GDD §3.2), and it replaced eight bespoke `onLand()` behaviours. Four of the board's eight
types are one class — `PoolTile` — told apart only by which table they read; the four corners are
the only tiles left that do something a table cannot describe (§3.4).

Two content files and two engines:

```
assets/board/board.js   the ring, per Season   →  js/board-model.js   type · argument · pool · cell
assets/pools/pools.js   the tables             →  js/pools.js         one row, weighted
```

The point is not tidiness. **A new tile type, a seasonal board or a live-ops variant is content,
not code** — a row in `pools.js` and an entry in `board.js`. Nothing assumes 40 tiles either: a
ring of N is drawn on a grid of side `N/4 + 1`, and N must divide by 4 so the four sides are equal.

Three rules hold it up:

1. **No pool is pure.** The money pool carries cards and the odd clue; the clue pool pays money.
   A pure pool would make twenty of the forty tiles dead air, and it is the first thing that gets
   quietly broken while tuning.
2. **A pool needs somewhere for "nothing happened" to live.** That is what the `event` kind is,
   and why it pays nothing on purpose. Without it every landing has to hand something over and
   the economy inflates to fill the space.
3. **Content fails loudly.** `validateBoard()` and `Pools.validate()` each report *every* problem
   at once, and both run at boot and in the tuning drawer — not only in the tests. A mis-authored
   pool does not throw; it looks exactly like bad luck, and it can survive a whole balancing run.

Event vocabulary and the tile contract are documented in
[js/tiles/README.md](js/tiles/README.md). `Tile` extends `BoardActor` (`js/board-actor.js`),
which owns the reward helpers (`gainCoins`/`gainEnergy`/`gainClues`) and the blocking
presentation builders (`reveal`/`collect`/`card`). `grantEnergy()` lives beside it as a free
function, because `js/boxes.js` needs the same rule and is not a `BoardActor`.

## Systems

| System | Where | Notes |
|---|---|---|
| Board layout | `assets/board/board.js` `js/board-model.js` | **Data, per Season.** Start sits at the **bottom** point of the diamond; indices run clockwise on screen (Premiere → Spa → Gala → Scoop). Season 1 is 40 tiles — 4 corners, 20 standard, 6 NPC, 4 arrivals, 6 twists — but nothing assumes 40. → [README](assets/board/README.md) |
| Board rendering | `js/ui/board3d.js` | three.js scene: orthographic camera at 45° azimuth / 38° elevation, which reproduces the old CSS projection exactly (`sin 38° = cos 52°`). Tile labels stay DOM over the canvas so text is crisp. `cfg.board3d = 0` falls back to the legacy CSS-3D board, as does a missing WebGL context. |
| The draw | `assets/pools/pools.js` `js/pools.js` | Four weighted tables — money, clue, bonus, mixed. Outcome kinds: `money` (negative allowed — it feeds the Gala) · `card` · `clue` · `move` · `energy` · `event`. → [README](assets/pools/README.md) |
| Tile behavior | `js/tiles/` | **One class for the four pooled types**, plus the four corners. → [README](js/tiles/README.md) |
| The corners | `js/tiles/{premiere,spa,gala,scoop}-tile.js` | The four behaviours a table cannot describe (GDD §3.4). The Premiere pays on pass and hands a free pack on landing; Spa Day is energy and **never** a penalty; the Gala collects everything the twists took, plus a guaranteed card; the Scoop teleports to a random NPC tile **and triggers it**. |
| Environment | `js/env-model.js` `js/ui/env3d.js` | The island the board stands on, the sea, and the props in it. Several worlds live in `assets/env/scene.js` and `cfg.envScene` picks one live from the tuning drawer. Placement is data and the engine measures nothing: assets are conformed to a stated contract by `tools/normalize-env.py`, so a new environment needs no code change. `cfg.envMargin` sets how much ground is in frame — it costs board size. → [README](assets/env/README.md) |
| Tile artwork | `assets/tiles/` | Drop `models/N.glb` to skin tile N-1 in 3D (1-based, so `1.glb` is Start); `N.png` does the same on the legacy CSS board. Absent files change nothing. Models are normalized **on load** — any scale/origin/up-axis drops in. → [README](assets/tiles/README.md) |
| Dice | `js/dice-model.js` `js/ui/dice3d.js` | Thrown in from the bottom-left of the view and landing wherever the camera is aimed — the middle of the board is off-screen much of the time with `camFollow` on. `cfg.diceRevealMs` is the throw's length and the promise resolves at exactly that mark, `cfg.diceToMoveMs` still gates the token. Falls back to the DOM pair in `js/ui/fx.js` when `cfg.dice3d` is off or `die.glb` never loaded. |
| Bonus mini-games | `minigames/` `js/ui/minigame.js` | A **pool row may name a game** — the two that do sit in the `bonus` table the arrivals draw from, so a mini-game is a property of the outcome rather than of the ground you are standing on. Each opens its own full-frame game over the board — Steal the Spotlight and the Premiere match-3. Each game is a standalone page in an iframe, driven by `postMessage` — the app is classic scripts sharing one global namespace, and these files bring their own `$`, `fmt`, `renderer` and a `*` reset. **The engine owns the money**: the tile banks the coins, picks the winning prize rung, and hands the game finished numbers to present — which is why the match-3 deck is resolved as cells are opened rather than shuffled. A missing or broken game degrades to the Collect popup, so it can never cost coins. Note the large bonus's ladder currently pays 2/3 of the model's number; see [TODO.md](TODO.md). → [README](minigames/README.md) |
| Die artwork | `assets/dice/` | The one asset built rather than reconstructed: image-to-3D invents the three faces it can't see, and knows nothing of opposite-faces-sum-to-7. Scenario supplies the surface, `tools/make-dice.py` supplies the counts and the geometry. Unit cube **centred on the origin**, unlike tiles. → [README](assets/dice/README.md) |
| **Clues** | `js/clues.js` `episodes/NNN.js` | **What unlocks an episode**, and the evidence you bet on — one object doing both jobs (GDD §6.1). Each episode authors eight; `cfg.cluesPerEpisode` of them unlocks it, so two players arrive at the same wager holding different evidence. A duplicate pays coins. The catch-up valve eases the requirement by one a day after `cfg.clueStuckDays`. |
| **The collection** | `js/cards.js` `assets/cards/` | 150 cards a Season — 90 Common, 38 Rare, 18 Epic, 4 Legendary — in **15 sets of ten** (GDD §4.6). Three copies **convert** a card into its Collectible, which is what pays Status; copies past that trickle. A set is a target and **never a gate**. Ownership is Season-wide and survives a Season reset. → [README](assets/cards/README.md) |
| **Boxes** | `js/boxes.js` `js/ui/box3d.js` `assets/boxes/` | The only way anything is collected. Three tiers, each `items` draws against its own weighted table. Opened the moment they are won — and **not in a dialog**: the box is the same GLB the board used to stand on a tile, it arrives over the middle of the board, and you tap the mesh. It bursts where it stood and the cards fly out and hang in the air. The only DOM is a caption and the countdown bar (`js/ui/pack.js`), which also holds the modal fallback for when there is no WebGL. Every empty case falls forward, so a box always pays. → [README](assets/boxes/README.md) |
| **The case board** | `js/ui/case3d.js` | The current set, standing **inside the ring**: five panels, one per episode, each holding that episode's five card slots with the collected cards' own art in them. Each panel is a canvas painted once and used as the texture of an **upright plane standing on the board** — see "Nothing on the board fades or hides" below. Tapping a panel opens the album there (`Board3D.caseAt()` raycasts them; the tap/pan split lives in `_initDrag`). |
| **Status** | `js/status.js` `js/ui/profile.js` `js/ui/statusup.js` `assets/status/` | The player's standing. Points come from owned items **plus** episodes watched **plus** cards collected, so play alone climbs and buying alone does not finish. Every one of the ten items has both a coin price and a play milestone. Rank shows beside the avatar in the HUD, and earning an item plays a beat that shows the track actually moving. A status item wears a **gold frame** everywhere it appears — see below. → [README](assets/status/README.md) |
| NPCs | `assets/npcs/` `js/ui/npc3d.js` | Simon, Victoria and Carl, walking the ring clockwise on the tiles' **inner** edge — the tile centre is taken by art and the token. **Scenery, deliberately**: they own no state, are not persisted, and pay nothing, so they stay outside the event list that everything else reaches the player through. Scaled by **height** like the player piece and held under `cfg.tokenHeight`, so a figure walking in front of the token can never bury it. Who walks and which way each faces is data in `assets/npcs/npcs.js` — facing is not a convention here, since one of the three fronts −X. **`cfg.npcs` ships at 0**, and off means the models are never fetched: `NPC3D.init()` deliberately does not load, `tick()` does on the first frame it runs enabled, so the drawer toggle still works with no reload. Switching back off hides them rather than dropping them. → [README](assets/npcs/README.md) |
| Economy model | `js/economy.js` `js/economy-import.js` | The numbers the game is balanced to, loaded from a spreadsheet. Segmented cost curve, ordered series, the clue→accuracy edge. `Economy.apply()` projects it onto `cfg`. See below. |
| Episodes & video | `episodes/` | Prediction data, the video player, betting rules. → [README](episodes/README.md) |
| Session & time | `js/game.js` `advanceSession()` | Rolls cost energy (`mult` per roll), never coins. "Next session" advances the clock by the greater of a full refill (`regenMin` minutes per energy point) and one session slot (`1440 / sessionsPerDay` minutes), refills energy and pays a login reward on each day rollover. |
| Persistence | `js/storage.js` | Two independent localStorage slots — config and progress — with separate **Reset config** and **Reset user** buttons in the tuning drawer. Everything is guarded, so blocked storage degrades to "don't persist". |
| Store | `js/ui/store.js` `openStore()` | Button top-right of the board. The three box tiers (for coins **or** a dollar price), plus instant grants: coins 10k/100k/1M, energy 100/1k/10k. Dollar prices are labels — nothing is charged, because it is the money side of the economy being modelled, not transacted. |

### The loop, in one pass

```
roll  →  land        →  DRAW one row from that tile's pool     (js/pools.js)
                     →  money · a CARD · a clue · energy · a move · flavour
      →  a clue      →  filed against the episode being worked on  (js/clues.js)
      →  a card      →  banked. New → held on screen. Third copy → CONVERTS, and says so.
                        Any other copy → coins, and the board keeps moving  (js/cards.js)
      →  a box       →  tap it, or it opens itself after 5s      (js/ui/pack.js)
                        (the Premiere's free pack, and the store)
   four of an episode's eight clues  →  it UNLOCKS  →  predict & watch, IN STORY ORDER
   the same clues are the EVIDENCE you read before betting
   all five WATCHED  →  the SET is done  →  a fresh 25 on the next five episodes
```

**Unlocking and watching are two different gates.** Which cards fall is luck, so pages fill in
whatever order they fill — page 2 can complete first. Watching cannot work that way: the drama is
serialised, and episode 2's prediction question gives away episode 1. So a page filling *unlocks*
its episode (it is in the library, the album shows it collected), but it only becomes *playable*
once every earlier episode has been watched. `Collection.firstUnwatchedId()` is the single answer
— null when the story is ahead of the collection — and `blockedBy()` says which episode is
holding things up so every surface can explain itself. `openPrediction()` enforces it in one
place, so the library, the 🎬 button, the album's Watch button and the result screen's
"next episode" cannot disagree.

**A set ends on the last WATCH, not the last card.** Collecting is the means; the episodes are the
point, so the set holds until they have all been seen (`Collection.boardFinished()`, which also
refuses while a reveal is still sealed). That is why the celebration lives at the end of the
prediction flow rather than in the box flow — and why the auto-play session has to watch
(`autoWatch()` in `js/ui/main.js`), or a batch run would fill set 1 and then roll forever.

Coins come out of boxes and out of duplicate cards, and go back into more boxes and into the
**status** shelf. Clue cards do double duty: they are a fifth of a page like any other card,
*and* a new one banks a clue that raises the next prediction's modelled accuracy.

Three rules hold the whole thing together and are worth knowing before changing any of it:

1. **The pool is derived from the requirements.** Nothing declares "25". A card that can drop
   but is never wanted is a `Collection.validate()` error, printed in the tuning drawer and
   logged at boot.
2. **"Unlocked" is derived from the albums.** There is no moment at which an episode is marked
   unlocked, so a caller that has just banked cards asks what changed by snapshotting before and
   comparing after (`unlockSnapshot` / `claimUnlocked`). No second source of truth to drift, and
   an episode already watched is never re-queued.
3. **The engine owns the money.** `Boxes.open()` banks everything before the popup is told what
   to show. Skipping the animation — auto-play, a mid-roll error, a closed tab — cannot change
   what the player got.

### Nothing on the board fades or hides

Three separate bugs turned out to be the same mistake, so it is worth stating once: **things in
the scene occlude each other; they do not take turns existing.**

- The case board first dimmed to 16% whenever the board was animating. It was chrome pretending
  to be scenery.
- It was then a DOM layer projected onto the board's centre each frame — which draws *after* the
  whole scene whatever its depth, so it floated over the dice and lagged the camera by a frame.
- As geometry it was a `THREE.Sprite`, and a sprite (or any camera-facing quad) has **one depth
  for the whole quad**. So a die that landed in front of a panel's feet was still measured
  against the panel's middle, and vanished behind the whole thing.
- And a box being opened switched the case board off for the duration.

What works is ordinary 3D. The panels are **upright planes standing on the board**, yawed to face
the camera — depth then varies down their height exactly as a standee's does, so a die nearer the
camera draws in front of them and a die behind is hidden, both correctly. The camera never
orbits (orthographic, fixed 45°/38°), so the yaw is a constant and never needs updating; standing
upright costs `cos 38°` of on-screen height, which the geometry is scaled up by so the `height`
constants keep meaning screen size.

A box and its cards are put **in front** rather than the board being taken away: `_packAnchor()`
moves the anchor along the view direction toward the camera, which under an orthographic camera
changes depth and *nothing else* — it does not move on screen and does not change size.

### Two axes: the FRAME is the family, the BADGE is the rarity

A card face reads two independent fields and never lets one decide both:

| axis | drives | values |
|---|---|---|
| **family** | the **frame** | `collection` · `clue` · `status` |
| **rarity** | a **named, coloured badge** | Common · Rare · Epic · Legendary |

The families come out of the same box seconds apart and are completely different things. A
collection card belongs to a set and is worth Status. A **clue** is a sentence you have to read —
so it is the one face built to be read: warm paper, sitting crooked, typewriter face, tape holding
it down. A **status item** goes on the player's shelf and stays there, and wears a gold double
frame with corner ticks that no collection card of any rarity ever wears.

The frame carries it, because a label can be missed and a frame cannot. And because the two axes
are independent, an Epic collection card and a status item can never be mistaken for one another
however good the art is.

Both halves have to move together in three places: the canvas path (`js/ui/box3d.js`,
`js/ui/case3d.js`), the DOM path (`js/ui/cardface.js`, `.fam-*` and `.rar-*` in
`css/collection.css`), and the profile shelf. That is the cost of a card looking the same
everywhere, and it is the point.

**A small slot abbreviates rather than clipping.** An album row is ten cards wide, and a clipped
"LEGENDAR" reads as a bug where "Leg" reads as an abbreviation — hence `short` in `CARD_RARITIES`.

**Most Commons have no art, on purpose.** Ninety pieces of generated art would cost more to make
than they would ever be looked at, so `cardFace()` falls back to a procedural face hashed off the
card id — same card, same colours, every time. Painted art earns its place at the top of the
ladder, where §4.2 says an Epic is "the pull that makes a pack memorable"; all 18 Epics and all
4 Legendaries have it.

**Earning a status item plays a beat** (`js/ui/statusup.js`): the item in its frame, the points
gained, and the track moving from where it was to where it is. When the points cross a rank
boundary the bar cannot simply animate to its new fraction — it would run *backwards*, because
the new rank starts near empty. So it fills to the top of the old rank, the rank flips, and it
fills again from the bottom of the new one: two moves, in the order the progress actually
happened.

Both routes go through it — a box's `{statusUp}` event and the milestone sweep in
`afterCollect()` — because an item earned by playing is the same kind of thing as one found in a
box. It blocks the roll loop like every other reward beat, and skips entirely in an auto-play
session.

**A completed card set gets its own, smaller beat** (`showSetComplete` in `js/ui/finale.js`). It
is a reward, not a chapter ending, and it never gated anything — so it says what it paid and gets
out of the way. Like every blocking beat it resolves on a timer as well as on a click.

### The scene's animations are driven by frames but ENDED by timers

`requestAnimationFrame` is suspended in a background tab. Every promise in `js/ui/box3d.js` has
always resolved on a `setTimeout` for that reason — but the *cleanup* originally lived in a
tween's last frame, so tabbing away mid-open left the box hanging over the board forever and the
next roll opened a second one behind it.

`Box3D._tween` is therefore backed by a timer: the frame loop draws the motion, and a
`setTimeout(dur + 20)` guarantees `settle()` runs, forcing the final pose and the end callback
exactly once whichever gets there first. **Anything that removes an object from the scene belongs
in the timer, not in the last frame.**

The same trap catches the DOM. A CSS transition needs its two values written in different style
recalcs, so the second write is deferred — and a bare `requestAnimationFrame` for that never runs
in a hidden tab. Anything staged *behind* that write then never happens either: the status
ribbon's rank flip lives there, so a throttled tab showed the old rank for the whole beat.
`nextPaint()` in `js/util.js` is the fix — rAF, plus a 32 ms timer, whichever arrives first.
**Use it instead of a bare rAF whenever something other than a style value depends on it.**

### The economy model vs `cfg`

Two layers, deliberately separate:

- **`economy`** (`js/economy.js`) is the *loaded model*. It comes from an .xlsx, carries a
  version string, and holds things `cfg` cannot express: a segmented cost curve, an ordered
  series list, a two-item mystery box.
- **`cfg`** is the *live tuning surface* — flat scalars the drawer edits by hand.

They meet in `Economy.apply()`, which projects the model's flat values onto `cfg` and rebuilds
`deck`/`boxTable`. So tile code still just reads the flat `cfg` scalars and nothing downstream
had to learn about the model. `Economy.OWNED_CFG_KEYS` is the list `apply()` writes.

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

### A clue is the gate AND the evidence

That is the design, not a coincidence, and it is GDD §6.1's whole argument: progress and
information are the same currency, so there is never a moment where you are grinding one and
ignoring the other.

`state.clues` is `{ "005": ["c3","c7"] }` — **which** clues, for **which** episode. Not a count.
The requirement (`cfg.cluesPerEpisode`, four) sits well below the pool each episode authors
(eight), so two players reach the same prediction holding *different* evidence. A counter could
not express that, and without it "Review the evidence" would show everyone the same screen.

Four consequences worth knowing before changing any of it:

1. **A draw can repeat.** It picks uniformly from the episode's eight, so four distinct ones take
   about five draws (`Clues.expectedDraws()`), and an unlucky run takes many more. That is what
   makes the pool-of-eight meaningful — and a duplicate still pays coins, because GDD §12's first
   rule about variance is that a duplicate must always convert to something.
2. **The catch-up valve** (§6.7): once an episode has been the current one for `cfg.clueStuckDays`,
   the requirement decays by one a day, never below one. It is invisible to anyone progressing
   normally — the clock only starts when a clue has actually landed for that episode, because a
   player who has just arrived has not been unlucky.
3. **A clue always goes to the first episode not yet unlocked**, so it can never arrive for
   something already bought and the story always moves forward.
4. **They are never cleared.** §6.4 calls them consumed at unlock, which they are in the sense
   that they buy that episode and nothing else — but the record has to survive or the evidence
   screen would be empty the moment it became reachable.

**The accuracy edge is per-episode now.** `resolvePrediction` prices the bet on
`Clues.countFor(id)` — what you know about *this* story beat — not on a running balance. Another
episode's clues are not evidence for this one. It still only decides the outcome in **auto** runs;
a human's pick wins on its merits.

**Cards gate nothing.** They are collectibles, and what they buy is Status. `Collection.pageReady`
and friends read through to `Clues`, so the album, the case board and the library all show the
clue gate; the cards still have their page, as a display of what the set contains.

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
| Spends coins | no | yes — the cheapest box first, then the cheapest status item |
| Intent | simulates a real player | internal balancing tool |
| Opening a box | tap it, or it opens itself after five seconds | skipped entirely; the cards are banked either way |
| Train bonus game | plays it, and picks for itself after the 10–20s window (nobody is at the keyboard) | skipped — takes the Collect popup's fast path, so no WebGL page is opened per roll |
| Episode video | plays in full | skipped, but logged with its length |
| Prediction outcome | pick decides | modelled via `cfg.accuracy` |
| Episode unlocked | the "watch now / binge later" popup | logged and toasted, never a modal |
| A set completed | the celebration, then a tap to open the next | advances silently and keeps rolling |

Neither mode opens the prediction modal on its own — episodes are only watched when the player
clicks **Predict & watch**.

## Tests

```bash
node tests/run.js
```

Zero-dependency runner that loads the real scripts into a `vm` context — no framework, no build,
no mocked app modules. Covers the DOM-free layers: util, config invariants, board model,
episodes, the collection (cards, boxes, status), game (prediction/session), tiles and storage.
**Run it after
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
- **There is one 3D scene now.** The builders view and its second scene are gone with the
  builders, so `Board3D` draws the board and nothing else. If a second full-screen view is ever
  wanted again, note why the old one shared a renderer: a second `WebGLRenderer` takes a second
  GL context and browsers cap those.
- **A card looks the same everywhere.** The album and the box popup both call `cardFace()`
  (`js/ui/cardface.js`); a card that looks like two different things in the two places it appears
  is not a collection. The class family is prefixed `cc` because `.card` is already the side
  panel's box in `css/panels.css`.
- **Interpolating a path into `style="..."` needs single quotes inside `url()`.** A double quote
  closes the attribute and the rule silently becomes `url("")` — a card with no picture, no
  console error and nothing in the network log. `cardArtCss()` is the one place that builds it.
- **Prices use `fmtShort`** (`2.5k`, `1.2m`, `14b`), capped at four characters, so a row of
  buttons fits one phone line whatever the economy charges.
- The activity log keeps the last 60 entries; older lines are trimmed.

## Known dead config

**`stdBase` and `stdWeights` are gone from the game.** A standard tile drew its printed value
from them; it draws from a pool now, and a number printed on a tile that draws would be a lie —
so `valueLabel()` returns `""` for every type and the position weights were deleted outright.
`cfg.stdBase` survives only because the economy model still projects it.

**`trainSmall` / `trainLarge` / `trainLargeChance` are half-live.** The train tile is gone; its
two mini-games moved into the `bonus` pool as rows carrying a `game` key, and their money is the
row's `amount` rather than the model's number. `Economy.trainLadder()` is still what builds the
three-rung reveal, so the ladder is live and the two payout scalars are not.

**`clueAlbumSize` is dead.** It was the cosmetic target for a lifetime clue count that no
longer exists — clues are per-episode now and `Clues.total()` derives the total. The key is
still imported from the workbook and still projected onto `cfg`, so it round-trips.

`secPerRoll` is in the tuning drawer but read by nothing. It is still used by the economy
spreadsheet (seconds-per-roll derives its "active minutes per session"), so wiring it up is
defensible — see [TODO.md](TODO.md).

**`avgOdds` is no longer dead.** It is what the auto-play session prices its payouts at
(`autoWatch()`): that mode is the model, nobody picks an answer, and "what a bettor gets" in a
projection is exactly an average. Real play still uses the per-answer odds from the episode file,
which is the only honest number when a human has actually chosen.

Four of the model's five relative knobs are imported and ignored; only `builderCost` is read.
`clues` are now spent — see "Clues are two different things" above.

**`deck` and `boxTable` are still projected by `Economy.apply()` and still saved, but nothing in
the game reads them.** They are what the MODEL says the deck tile and the mystery box pay; the
deck tile now hands over a box, and a box's contents come from `boxTiers`. They are kept rather
than deleted so an imported workbook still round-trips and so the numbers the collection loop
replaced can be compared against it. `cfg.buildings`, `cfg.tiers` and `cfg.boxesPerUpgrade` are
in the same position — the model counts a series in "builders", which is now simply its episode
count.

**`boxTiers` and `deckBoxes` are NOT economy-owned.** No workbook describes them yet, so they
survive a model change the way the camera settings do, and `loadConfig()` refuses a stored tier
list of the wrong shape rather than merging it — a save from a build with two tiers would leave
the store with a button that opens nothing.

The **wager tiers are wired**: `wagerSafe/wagerConfident/wagerMax` project onto `cfg` and
`Economy.wagerTiers(balance)` prices them, with `minWager` as a floor under all three.
`clueAlbumSize` drives the HUD's `137/300` album readout. `participation` stays unprojected on
purpose — it is the share of predictions the model expects a stake on, which in a game a human
plays is an *outcome*, not an input; what the game owes it is the choice, so **Skip & watch is
always offered**.
