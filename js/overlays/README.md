# Overlay system

An **overlay** is something that sits *on top of* a board tile rather than being the tile itself.
A board index has exactly one tile type, but it can also carry overlays — so overlays can't be
modelled as tile types. They resolve **before** the tile's own `onLand()` and are consumed when
collected.

Today there's one: the **mystery box**.

| Overlay | File | Marker | Placed on | Behavior |
|---|---|---|---|---|
| `mysteryBox` | [mystery-box.js](mystery-box.js) | 🎁 (pulsing) | standard tiles only | Earned by builder upgrades (`cfg.boxesPerUpgrade` per level) but **banked, not placed** — see below. Landing on one draws from the editable `boxTable` — coins, energy, or clues — then the tile pays out normally. Energy drops also fire the dice shower. On the 3D board it is a real model ([assets/props/](../../assets/props/README.md)); the emoji is the legacy CSS board's version. |

## Opening one

Landing on a box no longer just floats two numbers past. The box lifts off its tile, floats to
the middle of the view swelling as it goes, strains, and **pops** — and what was inside rains
down. The `boxOpen` event leads the box's event list and blocks, so the numbers appear out of the
burst rather than over a box still sitting on its tile.

| On the pop | |
|---|---|
| always | confetti + a **coin** shower — item 1 is always coins, so every box rains money |
| item 2 = energy | an **energy** shower on top |
| item 2 = clues | the clue sheet, on its own timer |

The clue sheet is timed from the **start** of the opening (`cfg.boxCluePopupMs`, default 1000ms),
not from the pop, so it can be tuned to slide in while the confetti is still falling. That is why
`showBoxOpen` owns it rather than leaving it to the payout event.

`boxOpen` carries what to *show*, never what to pay — the coins, energy and clues were already
banked by the `gain*` helpers before it was built. Same split the bonus mini-games use.

The three knobs live in the drawer's "Mystery box opening" group: `boxRiseMs` (the trip to the
centre), `boxSwellMs` (the last inflate), `boxOpenScale` (how big it gets), plus
`boxCluePopupMs`. Auto-play session skips the whole thing and just takes the reward.

**A box in flight is cancellable.** `Board3D.cancelBoxFx()` — called from `clearOverlayFx()` on a
mid-roll error — removes a stranded box, puts every other box back on its tile, restores the
camera, and **settles the promise**. That last part is the one that matters: `roll()`'s `finally`
is what clears `state.animating`, and it only runs once the await returns.

## Boxes are banked, then thrown

An upgrade does **not** put a box on the board. It adds to `state.pendingBoxes`, because the
player is looking at the builders screen when they buy — a box appearing on a board they cannot
see is a reward nobody witnesses. The counter in the corner of the builders view acknowledges the
purchase instead, and the boxes are thrown on together when the player goes back to the board.

```
Builders.upgrade()      state.pendingBoxes += cfg.boxesPerUpgrade   (nothing on the board yet)
  └─ renderBoxCounter()  the chip pops                              (js/ui/render.js)

setBuildersView(false)
  └─ deliverBoxes()      spawn() picks the tiles, pendingBoxes cleared   (js/ui/main.js)
       └─ Board3D.throwOverlays()   zoom out → rain them down → zoom back
```

**The state moves first and the animation is decoration on top.** `spawn()` places the boxes and
clears the count synchronously, so a reload, a view switch or a missing WebGL context mid-throw
all leave the boxes correctly on the board — the only thing that can be interrupted is the
picture. `state.pendingBoxes` persists, so boxes bought and never delivered are not lost.

If the board has fewer free tiles than there are boxes, the remainder **stays banked** rather than
being silently dropped: they were paid for.

The throw's three phases each have their own config key (`boxZoomOutMs`, `boxThrowMs`,
`boxZoomInMs`, plus `boxZoomOut` for how far the camera pulls back) in the drawer's
"Mystery box throw" group. `boxThrowMs` is the total for the throw rather than per box, so a big
purchase overlaps more instead of stranding the player watching a downpour. Auto-play session
skips the animation entirely and just takes the boxes.

## How it fits together

```
Builders.upgrade()  (js/builders/builders.js)
  └─ OVERLAY_TYPES.mysteryBox.spawn(cfg.boxesPerUpgrade)   → picks free eligible tiles

resolveLandingEvents()  (js/game.js)
  ├─ OVERLAYS.forEach(o => o.has(pos) && o.consume(pos))   → overlay events first
  └─ TILE_TYPES[tileType(pos)].onLand(...)                 → then the tile itself

renderOverlays()  (js/ui/render.js)
  └─ draws each overlay's icon/cssClass on its tiles
```

`consume(i)` removes the marker from the board and calls `onLand(i)`, which returns a playback
event, **an array of them**, or null (same event vocabulary as tiles — see
[../tiles/README.md](../tiles/README.md)). An event carries at most one `float` and one `log`,
so an overlay that pays out twice — the two-item mystery box — has to return two events rather
than cram both rewards into one. `resolveLandingEvents` spreads whatever comes back.

`Overlay` extends **`BoardActor`** ([../board-actor.js](../board-actor.js)), the shared base that
also backs `Tile`. That's where `gainCoins` / `gainEnergy` / `gainClues` and the
`reveal` / `collect` / `card` presentation builders live, so tiles and overlays never duplicate
reward maths.

## The base class contract ([overlay.js](overlay.js))

Subclasses override:

| Member | Purpose |
|---|---|
| `get stateKey()` | **required** — name of the `Set` on `state` holding occupied tile indices |
| `get icon()` | emoji drawn on the tile |
| `get cssClass()` | extra class on the marker element (style it in [../../css/board.css](../../css/board.css)) |
| `eligible(i)` | may an overlay be placed on tile `i`? (default: any tile) |
| `onLand(i)` | resolve it — mutate state, return one playback event or `null` |

Provided by the base (don't reimplement):
`positions()`, `has(i)`, `all()`, `clear()`, `spawn(n)` (random free eligible tiles),
`consume(i)`.

## Adding a new overlay

Example: a "trap" that costs coins when you land on it.

1. **Create** `js/overlays/trap.js`:

   ```js
   "use strict";
   class TrapOverlay extends Overlay {
     get stateKey(){ return "traps"; }
     get icon(){ return "💥"; }
     get cssClass(){ return "trap"; }
     onLand(){
       const c=-200*cfg.boardScale;
       const ev=this.gainCoins(c,"💥 "+fmt(c),"var(--bad)");
       ev.log={icon:"💥",msg:`Trap · lost <b>${fmt(-c)}</b>`};
       return ev;
     }
   }
   registerOverlay("trap",TrapOverlay);
   ```

2. **Add its state Set** in two places, or it won't exist / won't persist:
   - `initState()` in [../state.js](../state.js) → `traps:new Set(),`
   - `serializeState()` + the restore block in [../storage.js](../storage.js) → save as an array,
     rehydrate with `new Set(...)` (follow how `boxes` is handled).

3. **Load it** in [../../index.html](../../index.html) after `js/overlays/overlay.js`.

4. Optionally style `.ovl.trap` in [../../css/board.css](../../css/board.css).

Nothing in `game.js`, `render.js` or the tiles needs to change — the registry picks it up.
