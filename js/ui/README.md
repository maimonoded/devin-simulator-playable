# UI layer

Everything that touches the DOM. Game logic lives outside this folder and never renders —
it mutates `state` and returns *event lists* that `playEvents()` here plays back.

| File | Owns |
|---|---|
| [fx.js](fx.js) | Generic effects and small DOM outputs: floating rewards, the activity log, toasts, confetti + the dice shower, dice-face drawing and the roll shake, the number tween. Also the three blocking board overlays — `showReveal`, `showCard`, `showCollect` — and `clearOverlayFx()` for error recovery. |
| [render.js](render.js) | Pure state → DOM rendering: the board, token position, the HUD (including the status rank beside the avatar), the play row's badges, stats, story card, button enable/disable. `renderAll()` is the single entry point. Nothing here mutates game state. |
| [cardface.js](cardface.js) | One card, drawn — owned, locked or unknown. Shared by the album and the box popup, because a card that looks like two different things in the two places it appears is not a collection. |
| [pack.js](pack.js) | Opening a box: drives the in-scene beat (box3d.js) and owns its caption and countdown, plus the modal fallback for when there is no WebGL. Blocking, and resolves on every path. |
| [album.js](album.js) | The album — one page per episode, with the empty slots named so the player knows what to chase. Paged, and past sets are still reachable. |
| [profile.js](profile.js) | The status track and the shelf of things that prove it. The only place status items are bought. |
| [statusup.js](statusup.js) | The beat an earned status item plays: the item in its gold frame, the points gained, and the track moving — filling to the top of the old rank and again from the bottom of the new one when it turns over. A ribbon over the board, not a dialog. |
| [estate3d.js](estate3d.js) | **The Status Estate**, standing inside the board ring (GDD §3.5) — one canvas-painted plane standing upright on the board, upgrading with Status level. A scene object, not an overlay. A module, imported by board3d.js. |
| [box3d.js](box3d.js) | The box you tap to open, and the cards that fly out of it. Both are in the scene; the only DOM in the beat is pack.js's caption and countdown. A module, imported by board3d.js. |
| [artcache.js](artcache.js) | Card and item images, decoded once and shared by estate3d and box3d, with a callback so a face painted before its art arrived repaints when it lands. |
| [player.js](player.js) | The episode video player — both `playerMarkup(id)` and the `playVideo(id)` behaviour that drives it (autoplay, no-seek, pause, 2×, progress, session skip, missing-video fallback). |
| [prediction.js](prediction.js) | Predict & watch: the betting modal, playback, and the result screen. |
| [store.js](store.js) | The coin/energy top-up modal. |
| [finale.js](finale.js) | The series-complete celebration. |
| [drawer.js](drawer.js) | The tuning drawer: builds inputs from the `TUNING` schema, live-binds edits, and owns **Reset config** / **Reset user**. |
| [npc3d.js](npc3d.js) | The series' characters walking the board (imported by [board3d.js](board3d.js)). Scenery only — no state, no persistence, no payout, and the roll loop never waits for it. |
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
