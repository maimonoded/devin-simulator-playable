# UI layer

Everything that touches the DOM. Game logic lives outside this folder and never renders —
it mutates `state` and returns *event lists* that `playEvents()` here plays back.

| File | Owns |
|---|---|
| [card-art.js](card-art.js) | The face of a drawn card, composed on a `<canvas>`: a painting from `assets/cards/` across the top 60%, the card's name and **what it just did** drawn over the bottom 40%. The number is the LIVE one, which is the whole reason a card is composed and not shipped as a picture. Two consumers and one answer to "what does a card look like": [shoe3d.js](shoe3d.js) wraps the canvas in a texture, [fx.js](fx.js) drops the same canvas into the DOM. A missing or slow PNG draws a plain field instead and repaints itself when the file lands — it never throws, because a card is drawn mid-turn. |
| [shoe3d.js](shoe3d.js) | The pull deck inside the board ring and the card that lifts off it (imported by [board3d.js](board3d.js)). Presentation only: `deck-tile.js` paid everything before a frame of it runs. |
| [fx.js](fx.js) | Generic effects and small DOM outputs: floating rewards, the activity log, toasts, confetti + the dice shower, dice-face drawing and the roll shake, the number tween. Also the blocking board overlays — `showReveal`, `showCard`, `showCollect`, `showBoxOpen` and `showReshoot` — and `clearOverlayFx()` for error recovery. `showCard` picks between the deck's pull and the flat card, and neither one waits for a click, which is what makes auto-roll safe through a card tile. `showReshoot` is a MODE rather than a popup: it fills the static `#reshootUI` host and puts `body.reshooting` on, which is what hides the playbar's controls. |
| [render.js](render.js) | Pure state → DOM rendering: the board, token position, overlay markers, HUD, stats, button enable/disable. `renderAll()` is the single entry point. Nothing here mutates game state. |
| [store.js](store.js) | The coin/energy top-up modal. |
| [drawer.js](drawer.js) | The tuning drawer: builds inputs from the `TUNING` schema, live-binds edits, and owns **Reset config** / **Reset user**. |
| [npc3d.js](npc3d.js) | The series' characters walking the board (imported by [board3d.js](board3d.js)). Scenery only — no state, no persistence, no payout, and the roll loop never waits for it. |
| [main.js](main.js) | Orchestration and boot: `roll()`, `playEvents()`, auto-roll, session advance, all button wiring, and the boot sequence. |
| [library.js](library.js) | The library, which is two screens out of one file: the **shelf** (billboard, season rails, poster cards) and a **title page** for one target (art, blurb, step bar, this step's price, UNLOCK or PLAY). `_libRoute` is the navigation — null is the shelf. It owns paying; it hands off to [player.js](player.js) to watch. |
| [player.js](player.js) | The episode video player — `playerMarkup(id)` plus the `playVideo(id)` behaviour (autoplay, no-seek, pause, 2×, progress, missing-video fallback). |

### Parked — on disk, not loaded

These two are **not** in `index.html`'s script tags, and nothing loaded may call into them. The
prediction system they belong to was removed and has not come back; `library.js` and `player.js`
have, which is why they are in the table above rather than here.

| File | Owns |
|---|---|
| [prediction.js](prediction.js) | Predict & watch: the betting modal, playback, and the result screen. |
| [finale.js](finale.js) | The series-complete celebration. |

## The event-playback contract

Logic returns an ordered list; `playEvents()` in [main.js](main.js) renders it. An event is an
object with any subset of these fields, played in this fixed order:

`boxOpen` → `float` → `log` → `move` → `confetti` → `dice` → `card` → `reshoot` → `reveal` → `collect` → `minigame` → `pause`

`boxOpen`, `card`, `reshoot`, `reveal`, `collect` and `minigame` **block** — they return promises, so the roll loop and auto-play
wait for them. That's why their durations are config values rather than hardcoded. The full
vocabulary is documented in [../tiles/README.md](../tiles/README.md).

## Conventions

- **Modals share one `#scrim`.** Only one can be open at a time, which is why the store button
  and Roll are disabled while a roll or an auto mode is running.
- **`roll()` and `runAuto()` use try/finally** so `state.animating` / `autoMode` always clear.
  If `state.animating` sticks, the board soft-locks with Roll permanently disabled.
- **Don't hardcode durations** — add a key to `cfg` so it appears in the tuning drawer.
- **But LAYOUT is a constant, not `cfg`.** Where the deck stands, and how big a card gets, lives in
  [shoe3d.js](shoe3d.js), not in `cfg`, and deliberately: `cfg` is persisted and `loadConfig()`
  merges a save over the shipped defaults, so a position in there would keep whatever value was
  current the first time a returning player loaded the game. Timings are a tuning surface;
  where the furniture sits is not.
- **A promise the roll loop awaits must resolve on a `setTimeout`, never from the frame loop.**
  `requestAnimationFrame` is suspended in a background tab, and `roll()`'s finally is the only
  thing that clears `state.animating` — so a frame-driven resolve soft-locks the board with Roll
  disabled for anyone who tabs away mid-beat. Anything that waits on an animation finishing
  (`Board3D.shoeWhenClear`) takes a mandatory timeout for the same reason: resolving twice is
  harmless, never resolving is fatal.
- CSS timings that must track config (token step, dice shake) are pushed into custom properties
  by `applyFxTiming()` in [render.js](render.js).
