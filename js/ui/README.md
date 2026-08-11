# UI layer

Everything that touches the DOM. Game logic lives outside this folder and never renders —
it mutates `state` and returns *event lists* that `playEvents()` here plays back.

| File | Owns |
|---|---|
| [card-art.js](card-art.js) | The deck's look — every card face and the back, drawn to `<canvas>`. ONE place, two consumers: `shoe3d.js` wraps these canvases in a `CanvasTexture` for the board and `fx.js` drops the same canvas into the DOM for the flat fallback, so the two presentations can never drift into being two different decks. The four suit pips and every rank are vector paths — a pip has to be the same shape at 92px in the middle of a card and at 34px in its corner. `assets/cards/*.png` overrides the back and the jokers when present; **a missing file is not an error**, the drawing simply stays. |
| [fx.js](fx.js) | Generic effects and small DOM outputs: floating rewards, the activity log, toasts, confetti, the coin/card/ticket showers, the number tween, and `pullCardAnim()` — the pulled card held face up, which is what paces a turn. Also the blocking board popups — `showReveal`, `showCard`, `showCollect`, `showClue`, `showBoxOpen` — and `clearOverlayFx()` for error recovery. |
| [render.js](render.js) | Pure state → DOM rendering: the board (or, on the WebGL board, the label layer over the canvas), token position, overlay markers, `renderBoardChrome()`, HUD, stats, story card, button enable/disable. `renderAll()` is the single entry point. Nothing here mutates game state. |
| [player.js](player.js) | The episode video player — both `playerMarkup(id)` and the `playVideo(id)` behaviour that drives it (autoplay, no-seek, pause, 2×, progress, session skip, missing-video fallback). |
| [prediction.js](prediction.js) | Predict & watch: the betting modal, playback, and the result screen — plus the unlock popup a newly filled placeholder raises. |
| [store.js](store.js) | The store: a deck for coins, and coins or tickets for real money. |
| [finale.js](finale.js) | The series-complete celebration. |
| [drawer.js](drawer.js) | The tuning drawer: builds inputs from the `TUNING` schema, live-binds edits, and owns **Reset config** / **Reset user**. |
| [main.js](main.js) | Orchestration and boot: `pull()`, `playEvents()`, the two auto modes, `ticketPullEvents()` / `announceTickets()`, `dropBoxes()`, buying a deck, session advance, all button wiring, and the boot sequence. |

`renderBoardChrome()` exists because the buttons that ride on the board — binge, library, the
album dot, buy-a-deck — used to hang off the builders view's renderer and outlived it. One named
function is what stops the next person wondering why the binge button is rendered from three
different places.

## The 3D layer

[board3d.js](board3d.js) is the project's only `<script type="module">`, which is why the classic
load order in `index.html` is still the dependency order. It imports [env3d.js](env3d.js) (the
world around the board), [shoe3d.js](shoe3d.js) (the deck and the ticket placeholders, which
sit *inside* the board ring) and [npc3d.js](npc3d.js) (the cast walking it) — siblings, not extra
tags. **One scene, one camera:** there is no second scene to swap to any more, so `Board3D` has
no view switch.

Because these are modules, **nothing in `tests/` loads them** — the runner builds a `vm` context
from the classic scripts only. A syntax error in one of these files does not fail a single test;
it degrades the board to the legacy CSS renderer, silently. Worth a `node --input-type=module`
parse check after editing one, since the symptom looks like a WebGL problem rather than a typo.

npc3d.js is **off by default** (`cfg.npcs = 0`) and, more to the point, does not *fetch* when off:
the cast is about a megabyte of GLB, so `init()` deliberately loads nothing and `tick()` does it
on the first frame it runs enabled. That is what keeps the drawer's toggle working without a
reload — deciding it in `init()` would make the switch look broken for anyone who flipped it on.

shoe3d.js draws both its objects as geometry with canvas textures, so the row of placeholders and
the card faces need no art asset to work. Two rules it inherits, both learned the hard way:

- **The pull promise resolves on a `setTimeout`, never from the frame loop.** `requestAnimationFrame`
  is suspended in a background tab, and the pull is the core loop — a frame-driven resolve means
  tabbing away mid-pull leaves `pull()` awaiting forever with `state.animating` stuck true.
  `Shoe3D.cancel()`, reached through `Board3D.cancelBoxFx()`, settles anything still in flight.
- **"Failed" is not "not loaded yet."** `fx.js` keys its flat-DOM-card fallback off
  `Board3D.shoeFailed()`; conflating the two is what used to make the fallback flash on every
  page load.

**A joker does not arrive like a 7 of Stars.** It is the prize the board exists to hand out, so
it presents at `cfg.jokerScale` times an ordinary card's size, blooms *late* in the flight with an
`easeOutBack` overshoot that settles back into that size, turns once about its own face normal
(in-plane, so the face stays square to the camera — a tumble would spend half the reveal showing
the back), and hangs for `cfg.jokerHoldMs` before the row collects it. `main.js` fires the DOM
half — confetti — on the same beat, skipped under `autoMode === "session"`.

**None of it costs pacing.** The flight is still `cfg.pullRevealMs` and the promise still resolves
at that exact mark; the longer hold sits *after* `resolve()` next to the one it replaces, where
the token is already walking. The bloom's start is a fraction (`JOKER_BLOOM_AT`), not a duration,
so it stays in proportion whatever the flight is retuned to.

**The deck's height is the card count**, so the player can watch the thing they are spending run
out. It is **one stack, always**, and two rules shape it:

- **Full until you are into your last pack.** One pack or twenty is the same picture. A shoe over
  `cfg.packSize` is ordinary (`Shoe.buyPack()` merges), the exact number is already on the HUD,
  and the deck's job is the feeling of running low — so height only starts falling once falling
  means something.
- **Below a pack, the height is the fraction on a curve**, not a linear step, because the steps
  are worth spending near empty and worth nothing near full. Fourteen distinct heights: about
  every fourth card near full, every single card over the last few, ending at one card flat.

An earlier version drew the extra packs as separate piles behind the open one. It was more
precise and it was a mistake — **two stacks of similar height a short step apart is exactly what
a riffle looks like frozen half-way**, and it was reported as a stuck shuffle the first time
somebody bought a deck. Worth remembering before reaching for it again: that is precision nobody
asked for, bought with ambiguity in the one picture that had to stay legible.

It is a **readout, pulled every frame** from `Shoe.count()` rather than pushed by the five places
the shoe changes — a signature compare in `tick()`, so it cannot go stale and a sixth path needs
no wiring. And note `TABLE_Y`: a card seated at the board's own `ENV_Y.deck = 0` is swallowed by
the floor and does not render at all, which only shows once a stack is allowed to shrink to one.

## The event-playback contract

Logic returns an ordered list; `playEvents()` in [main.js](main.js) renders it. An event is an
object with any subset of these fields, played in this fixed order:

`boxOpen` → `float` → `log` → `move` → `confetti` → `ticketAward` → `card` → `reveal` →
`collect` → `clue` → `minigame` → `pause`

`boxOpen`, `card`, `reveal`, `collect`, `clue` and `minigame` **block** — they return promises, so
the pull loop and auto-play wait for them. That's why their durations are config values rather
than hardcoded. `ticketAward` rides along with whatever event awarded the ticket (the ticket card,
the mystery box) rather than being fired by a button, and hands it to `announceTickets()` — the one
place that names an unlock, so the card, the box and the store can never say it three ways. The
full vocabulary is documented in [../tiles/README.md](../tiles/README.md).

## Conventions

- **Two modal hosts, not one.** Page-level `#scrim` is `position:fixed` and dims the whole browser;
  `#sheetHost` sits *inside* the board scene, so the clue popup, the album and the player sheet are
  framed by the game window instead. Either way only one can be open, which is why the store button
  and Pull are disabled while a pull or an auto mode is running.
- **`pull()` and `runAuto()` use try/finally** so `state.animating` / `autoMode` always clear.
  If `state.animating` sticks, the board soft-locks with Pull permanently disabled.
- **Three places decide whether a pull is possible and all three must agree**: `pull()`'s own guard,
  `runAuto()`'s per-pass re-check, and `cantRoll` in `renderAll()`. Teach one and not the others and
  either the button lies about a loop that is still going, or auto-pull spins against a stopped board.
- **A full ticket row is not a dead end.** Pull reads *Watch to continue* and opens the prediction
  instead of greying out — with nothing else left to run out of, this is the only stop condition in
  the game, and a disabled button with no explanation reads as a soft-lock.
- **State first, animation on top.** `dropBoxes()` places the boxes and clears the pending count
  synchronously, so a reload or a lost WebGL context mid-throw still leaves them correctly on the
  board. Only the picture can be interrupted.
- **Don't hardcode durations** — add a key to `cfg` so it appears in the tuning drawer.
- CSS timings that must track config are pushed into custom properties: token glide and hop by
  `applyFxTiming()` in [render.js](render.js), and the hold-to-auto fill on Pull by `--holdMs`,
  set from `cfg.autoRollHoldMs` in [main.js](main.js) so retuning the delay retimes the animation.
