# UI layer

Everything that touches the DOM. Game logic lives outside this folder and never renders —
it mutates `state` and returns *event lists* that `playEvents()` here plays back.

| File | Owns |
|---|---|
| [fx.js](fx.js) | Generic effects and small DOM outputs: floating rewards, the activity log, toasts, confetti + the dice shower, dice-face drawing and the roll shake, the number tween. Also the three blocking board overlays — `showReveal`, `showCard`, `showCollect` — and `clearOverlayFx()` for error recovery. |
| [render.js](render.js) | Pure state → DOM rendering: the board, token position, overlay markers, builder skyline and list, HUD, stats, story card, button enable/disable. `renderAll()` is the single entry point. Nothing here mutates game state. |
| [player.js](player.js) | The episode video player — both `playerMarkup(id)` and the `playVideo(id)` behaviour that drives it (autoplay, no-seek, pause, 2×, progress, session skip, missing-video fallback). |
| [prediction.js](prediction.js) | Predict & watch: the betting modal, playback, and the result screen. |
| [store.js](store.js) | The coin/energy top-up modal. |
| [finale.js](finale.js) | The series-complete celebration. |
| [drawer.js](drawer.js) | The tuning drawer: builds inputs from the `TUNING` schema, live-binds edits, and owns **Reset config** / **Reset user**. |
| [main.js](main.js) | Orchestration and boot: `roll()`, `playEvents()`, the two auto modes, upgrade clicks, session advance, all button wiring, and the boot sequence. |

## The event-playback contract

Logic returns an ordered list; `playEvents()` in [main.js](main.js) renders it. An event is an
object with any subset of these fields, played in this fixed order:

`float` → `log` → `move` → `confetti` → `dice` → `card` → `reveal` → `collect` → `pause`

`card`, `reveal` and `collect` **block** — they return promises, so the roll loop and auto-play
wait for them. That's why their durations are config values rather than hardcoded. The full
vocabulary is documented in [../tiles/README.md](../tiles/README.md).

## Conventions

- **Modals share one `#scrim`.** Only one can be open at a time, which is why the store button
  and Roll are disabled while a roll or an auto mode is running.
- **`roll()` and `runAuto()` use try/finally** so `state.animating` / `autoMode` always clear.
  If `state.animating` sticks, the board soft-locks with Roll permanently disabled.
- **Don't hardcode durations** — add a key to `cfg` so it appears in the tuning drawer.
- CSS timings that must track config (token step, dice shake) are pushed into custom properties
  by `applyFxTiming()` in [render.js](render.js).
