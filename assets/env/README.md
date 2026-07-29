# The environment

Everything around the board: the island it stands on, the sea, and the props in the water.

```
assets/env/
  ART-BRIEF-ENV.md   the spec — hand this to whoever makes the art
  scene.js           the placement manifest (a classic script, so: a global)
  models/*.glb       the pieces, conformed to the asset contract
  raw/*.glb          what the generator returned, kept so a piece can be re-conformed
tools/normalize-env.py   conforms a raw GLB to the contract; --check verifies one
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
| `envScene` | `texas-town` | **which world to show.** A picker in the drawer, listing whatever `scene.js` defines. Live |
| `env3d` | 1 | the whole environment. Live — toggling it in the tuning drawer rebuilds |
| `envMargin` | 1.7 | how much wider than the ring the camera frames. Live |
| `envDeckMargin` | 0.6 | how much deck shows beyond the board, in tiles. Live |
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
terrain: { ground: true, groundColor: 0x8a4a2c, shelf: false, island: false, plinth: false },
```

The **ground stays procedural** on purpose. It has to reach the frame edge at every window shape
and fade out before it gets there, which is not something to ask a generated mesh for. Only its
colour changes per environment, and that is manifest data — harbour blue or Texas dirt is not a
code change. It is one
plane with a canvas-drawn radial gradient: solid around the island, transparent by the frame edge,
so the stage's own background comes back at the rim instead of the water ending on a hard line.

## The engine measures nothing

This is the design decision the rest follows from. `env3d.js` scales a piece, turns it if the
manifest says so, and drops it at its datum. There is no bounding-box fitting, no surface
probing, no rotation inference.

It used to do all three, and each one failed on the first real asset:

- it inferred the island's rotation as 45°; the true figure was **50°**, so every board edge
  ran at 5° to the deck and the board overhanged the paving by a third of a tile at one end
- it sized the deck by walking outward until the height changed by 2% of the bounding box — a
  tolerance that stepped straight over the deck's shallow verge, over-measuring the surface
  and under-scaling the model by **6%**
- an earlier version sized by the bounding box outright, which a staircase on one side owned
  half of

None of those are fixable by better heuristics, because the engine cannot know what it is
looking at. They are fixable by *stating* what an asset must be, which is the contract in
ART-BRIEF-ENV.md §5, and conforming files to it once with `tools/normalize-env.py`.

The measuring still exists — it just runs offline, once per asset, where the result is a file
you can open, diff and re-check, instead of a heuristic re-deciding in every browser.

## Adding a new environment

No code changes. Ever, if the contract holds:

```bash
python3 tools/normalize-env.py assets/env/raw/atoll.glb --deck -o assets/env/models/atoll.glb
python3 tools/normalize-env.py assets/env/models/atoll.glb --deck --check
```

then an entry in `scene.js`:

```js
atoll: {
  label: "Atoll",
  terrain: { ground: true, groundColor: 0x1d7f8f, shelf: false, island: false, plinth: false },
  pieces: [ { model: "atoll", at: [0, 0], y: "deck", deck: true } ],
},
```

It appears in the drawer's **World** picker straight away — the picker is built from
`envSceneNames()`, so the manifest is the only list. Switching is live: `onCfgChange` calls
`Board3D.applyEnv()`, which rebuilds the environment group from the newly selected scene.

`label` is what the picker shows; without one it falls back to the key. A saved config naming
a world that has since been renamed falls back to the first rather than rendering nothing.

## What the console tells you

`env3d.js` never silently drops a piece. On load it logs, by name:

- a missing `.glb`
- a placement outside the visible region
- a bad datum or a missing `size`
- **a deck that does not carry the board** — checked by raying down at the ring's four corners
  and four edge midpoints, reporting which ones missed and by how much
- **a piece taller than the sight line allows at its position** — with the height delivered and
  the budget it broke

The last one is the rule that actually gets broken, and it can only be checked once the mesh has
loaded, so it is reported against what was really delivered rather than what was asked for.

## Regenerating a piece

There is a skill for this: **`board-env-art`**, in `claude-skills/` — run
`./claude-skills/link-skills.sh` once after cloning and it loads for anyone working here. It walks the whole path — reference, cutout,
image-to-3D, conform, place, verify — and carries the prompt rules that took three attempts to
learn. Ask for a new world in plain words and it should pick it up.

The Scenario pipeline and the prompt changes environment pieces need are in
[ART-BRIEF-ENV.md](ART-BRIEF-ENV.md) §6. Conform the result with `tools/normalize-env.py`, which
writes the correction as a node transform and leaves geometry, materials and the BIN chunk
untouched — so unlike the tile skill's `normalize_tile.py`, it cannot cost you the baked texture.
