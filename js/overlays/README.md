# Overlay system

An **overlay** is something that sits *on top of* a board tile rather than being the tile itself.
A board index has exactly one tile type, but it can also carry overlays — so overlays can't be
modelled as tile types. They resolve **before** the tile's own `onLand()` and are consumed when
collected.

Today there's one: the **mystery box**.

| Overlay | File | Marker | Placed on | Behavior |
|---|---|---|---|---|
| `mysteryBox` | [mystery-box.js](mystery-box.js) | 🎁 (pulsing) | standard tiles only | Dropped on the board when a ticket card is pulled (`cfg.boxesPerTicketCard` each) — see below. Landing on one draws from the editable `boxTable` — coins, a ticket, or clues — then the tile pays out normally. A ticket drop also fires the ticket shower. On the 3D board it is a real model ([assets/props/](../../assets/props/README.md)); the emoji is the legacy CSS board's version. |

## The gold box holds clues

A box's **item 2 is drawn when the box is placed**, not when it is landed on — and a box holding
clues is rendered in gold. That one change turns a box from an invisible bonus into somewhere
worth crossing the board for: you can see the good one from four tiles away.

Being *actually* visible took more than a colour swap — a tile is a few dozen pixels and the deck
is pale cream. The gold box is bigger, self-lit, haloed and moving, and its art deliberately
breaks the board's muted palette. → [assets/props/README.md](../../assets/props/README.md)

**It costs the economy nothing.** It is the same `weighted(boxTable)` call on the same table, made
earlier. The payout distribution is identical and the clue rate — which sets prediction accuracy —
does not move at all. That was the deciding argument for doing it this way rather than adding
rarity tiers, which *would* have moved it.

Two consequences worth knowing:

- **`state.boxes` is a `Map`**, tile → contents, not a `Set`. `Overlay` supports this generally:
  `roll(i)` decides what to remember when placing, `dataAt(i)` reads it back, and `consume(i)`
  hands it to `onLand(i, data)`. An overlay that carries nothing stores `null` and behaves
  exactly as before.
- **A box carries the table as it was when it spawned.** Editing the weights in the drawer
  changes boxes placed after that, not the ones already on the board — which is right, since the
  player has already been shown what those contain.

A box can still restore with nothing known about it — a saved entry that is a bare tile index
rather than a `[tile, contents]` pair. `onLand` draws for those on landing instead, which is why
the draw moving earlier needed no migration.

## Opening one

Landing on a box does not simply float two numbers past. The box lifts off its tile, floats to
the middle of the view swelling as it goes, strains, and **pops** — and what was inside rains
down. The `boxOpen` event leads the box's event list and blocks, so the numbers appear out of the
burst rather than over a box still sitting on its tile.

| On the pop | |
|---|---|
| always | confetti + a **coin** shower — item 1 is always coins, so every box rains money |
| item 2 = a ticket | a **ticket** shower on top |
| item 2 = clues | the clue sheet, after the winnings |

Then the **spoils**: what was just won, held in the middle of the screen where the box popped. A
float over the token is too small and too far from where the player is looking after a burst in
the centre of the board.

The clue sheet is counted from the moment the spoils appear (`cfg.boxCluePopupMs`, 2000ms), so it
follows the numbers rather than racing them — and on a clue box the spoils stay up until the sheet
arrives, so the two never leave a blank gap between them. That is why `showBoxOpen` owns the sheet
rather than leaving it to the payout event.

`boxOpen` carries what to *show*, never what to pay — the coins, tickets and clues were already
banked by the `gain*` helpers before it was built. Same split the bonus mini-games use.

The three knobs live in the drawer's "Mystery box opening" group: `boxRiseMs` (the trip to the
centre), `boxSwellMs` (the last inflate), `boxOpenScale` (how big it gets), plus
`boxCluePopupMs`. Auto-play session skips the whole thing and just takes the reward.

**A box in flight is cancellable.** `Board3D.cancelBoxFx()` — called from `clearOverlayFx()` on a
mid-pull error — removes a stranded box, puts every other box back on its tile, restores the
camera, and **settles the promise**. That last part is the one that matters: `pull()`'s `finally`
is what clears `state.animating`, and it only runs once the await returns.

## A ticket card throws boxes onto the board

Boxes are not scattered at the start of a run and they cannot be bought: pulling a ticket card off
the shoe is what puts them there. `ticketPullEvents()` in [../ui/main.js](../ui/main.js) fills the
placeholder and calls `dropBoxes(cfg.boxesPerTicketCard)`, which is the only way a box ever reaches
a tile — one place to look when the board holds more or fewer than expected.

```
ticketPullEvents()   Tickets.award(1) fills a placeholder             (js/ui/main.js)
  └─ dropBoxes(cfg.boxesPerTicketCard)
       ├─ OVERLAY_TYPES.mysteryBox.spawn(n)   picks free eligible tiles — the state is now done
       └─ Board3D.throwOverlays()             zoom out → rain them down → zoom back
```

The key is named for the **card**, not for the ticket, and that is the whole rule: a ticket won
from a mystery box or bought in the store fills its placeholder without dropping anything. Hang the
drop off `Tickets.award` instead and a box holding a ticket drops a box that can hold a ticket —
the board would seed itself from one lucky landing.

**The state moves first and the animation is decoration on top.** `spawn()` places the boxes and
clears the pending count synchronously, so a reload or a missing WebGL context mid-throw both
leave the boxes correctly on the board — the only thing that can be interrupted is the picture.
Nothing awaits `dropBoxes()` for the same reason: `pull()` blocks on `state.animating`, not on the
throw.

If the board has fewer free tiles than there are boxes, the remainder **stays banked** in
`state.pendingBoxes` rather than being silently dropped: they were earned. That count persists and
is added to the next drop, so a full board delays a reward but never eats one.

The throw's three phases each have their own config key (`boxZoomOutMs`, `boxThrowMs`,
`boxZoomInMs`, plus `boxZoomOut` for how far the camera pulls back) in the drawer's
"Mystery box throw" group. `boxThrowMs` is the total for the throw rather than per box, so a
backlog of banked boxes overlaps more instead of stranding the player watching a downpour.
Auto-play session skips the animation entirely and just takes the boxes.

## How it fits together

```
dropBoxes()  (js/ui/main.js)
  └─ OVERLAY_TYPES.mysteryBox.spawn(cfg.boxesPerTicketCard)   → picks free eligible tiles

resolveLandingEvents()  (js/game.js)
  ├─ OVERLAYS.forEach(o => o.has(pos) && o.consume(pos))   → overlay events first
  └─ TILE_TYPES[tileType(pos)].onLand(...)                 → then the tile itself

renderOverlays()  (js/ui/render.js)
  └─ draws each overlay's icon/classAt(i) on its tiles
```

`consume(i)` removes the marker from the board and calls `onLand(i, data)`, which returns a playback
event, **an array of them**, or null (same event vocabulary as tiles — see
[../tiles/README.md](../tiles/README.md)). An event carries at most one `float` and one `log`,
so an overlay that pays out twice — the two-item mystery box — has to return two events rather
than cram both rewards into one. `resolveLandingEvents` spreads whatever comes back.

`Overlay` extends **`BoardActor`** ([../board-actor.js](../board-actor.js)), the shared base that
also backs `Tile`. That's where `gainCoins` / `gainCards` / `gainTickets` / `gainClues` and the
`reveal` / `collect` / `card` presentation builders live, so tiles and overlays never duplicate
reward maths. `gainTickets` goes through `Tickets.award`, the same call the ticket card and the
store make — three paths that could otherwise disagree about when an episode unlocks.

## The base class contract ([overlay.js](overlay.js))

Subclasses override:

| Member | Purpose |
|---|---|
| `get stateKey()` | **required** — name of the `Map` on `state` holding tile index → contents |
| `get icon()` | emoji drawn on the tile |
| `get cssClass()` | extra class on the marker element (style it in [../../css/board.css](../../css/board.css)) |
| `eligible(i)` | may an overlay be placed on tile `i`? (default: any tile) |
| `roll(i)` | what to remember about a tile when placing on it — called once, at spawn (default: `null`) |
| `classAt(i)` | per-tile marker class, so one overlay can have variants (default: `cssClass`) |
| `onLand(i, data)` | resolve it — mutate state, return one playback event or `null` |

Provided by the base (don't reimplement):
`positions()`, `has(i)`, `all()`, `dataAt(i)`, `clear()`, `spawn(n)` (random free eligible tiles),
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

2. **Add its state Map** in two places, or it won't exist / won't persist:
   - `initState()` in [../state.js](../state.js) → `traps:new Map(),`
   - `serializeState()` + the restore block in [../storage.js](../storage.js) → save as an array
     of `[tile, contents]` pairs, rehydrate with `new Map(...)` (follow how `boxes` is handled).
     A `Set` will not do even for an overlay that carries nothing: `spawn()` writes with
     `.set(tile, …)` and reads back with `.get(tile)`.

3. **Load it** in [../../index.html](../../index.html) after `js/overlays/overlay.js`.

4. Optionally style `.ovl.trap` in [../../css/board.css](../../css/board.css).

Nothing in `game.js`, `render.js` or the tiles needs to change — the registry picks it up.
