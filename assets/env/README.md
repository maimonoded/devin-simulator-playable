# The environment

Everything around the board: the island it stands on, the sea, and the props in the water.

```
assets/env/
  ART-BRIEF-ENV.md   the spec — hand this to whoever makes the art
  scene.js           the placement manifest (a classic script, so: a global)
  models/*.glb       the pieces, exactly as the generator returned them
js/env-model.js      geometry and the manifest contract — pure, no DOM, no three.js
js/ui/env3d.js       the renderer. An ES module, imported by js/ui/board3d.js
```

The split mirrors `js/board-model.js` / `js/ui/board3d.js`, for the same reason: the numbers that
define where the world sits are quoted by the art brief and covered by `tests/run.js`, so they
live somewhere a test can load without a canvas.

`env3d.js` is imported by `board3d.js` rather than added as a second `<script type="module">`, so
there is still exactly one module entry point and the script order in `index.html` is still the
dependency order.

## Turning it on and off

| Config key | Default | Effect |
|---|---|---|
| `env3d` | 1 | the whole environment. Live — toggling it in the tuning drawer rebuilds |
| `envMargin` | 1.7 | how much wider than the ring the camera frames. Live |
| `envShadows` | 1 | shadow map. Needs a reload — lights are set up once in `init()` |

`envMargin` is the one to understand. It replaces a hardcoded 1.12 in `board3d.js`, and with the
environment off it goes back to exactly that, so the bare board looks like it always did. Every
step above 1.12 trades board size for visible ground; 1.7 is what it takes to see water around an
island wide enough to hold the board. See ART-BRIEF-ENV.md §3.

## The terrain is procedural; the island is not

`env3d.js` can build the whole world out of boxes — sea, island, plinth. That is the fallback,
and it is what you see with no models present.

A manifest that ships a modelled island turns off the parts it replaces:

```js
terrain: { sea: true, shelf: false, island: false, plinth: false },
```

The **sea stays procedural** on purpose. It has to reach the frame edge at every window shape and
fade out before it gets there, which is not something to ask a generated mesh for. It is one
plane with a canvas-drawn radial gradient: solid around the island, transparent by the frame edge,
so the stage's own background comes back at the rim instead of the water ending on a hard line.

## Sizing and anchoring, and why they are not just "scale the bounding box"

Both of these exist because of a specific failure, documented in ART-BRIEF-ENV.md §6:

- **`fit: "surface"`** sizes a piece by the width of its flat top rather than its bounding box.
  The first generated island had a staircase off one side that owned half the box; fitting the box
  to 15 tiles left a plaza of 7, and the 11-tile board sat outside its own walls.
- **`anchor: "surface"`** puts the height of the mesh above the piece's own centre onto the datum,
  found by casting a ray down. For a walled plaza that is the plaza — not the kerb (its highest
  point) and not the keel (its lowest).

Both are implemented with raycasts in `env3d.js`, on load, once per piece.

## What the console tells you

`env3d.js` never silently drops a piece. On load it logs, by name:

- a missing `.glb`
- a placement outside the visible region
- a bad datum or a missing `size`
- **a piece taller than the sight line allows at its position** — with the height delivered and
  the budget it broke

The last one is the rule that actually gets broken, and it can only be checked once the mesh has
loaded, so it is reported against what was really delivered rather than what was asked for.

## Regenerating a piece

The Scenario pipeline, the prompt changes that environment pieces need, and the four traps that
cost a regeneration each are in [ART-BRIEF-ENV.md](ART-BRIEF-ENV.md) §6. `models/` holds the exact
GLB that came back, unmodified — there is no offline normalization step to keep a "raw" copy
apart from, because running one would drop the baked texture.
