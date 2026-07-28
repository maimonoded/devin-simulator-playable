# Environment art brief — the world around the board

Hand this to whoever produces the environment assets. It is self-contained.

The 40-tile board is a ring of 1×1 tiles rendered in three.js under an **orthographic camera at
45° azimuth, 38° elevation**. This brief covers everything that is not a tile: the island the
board stands on, the water around it, and the props in between.

> Authoring a **tile** — one of the 40 pieces on the board itself? Different brief, tighter
> rules: [../tiles/ART-BRIEF.md](../tiles/ART-BRIEF.md).

The camera never moves and never rotates. Everything here is authored for one fixed viewpoint,
which is a gift — you only have to make it work from a single angle.

---

## 1. The world in one picture

One unit = one tile. The board ring is centred on the origin and occupies `x, z ∈ [−5.5, 5.5]`.

```
                      far (VIP corner)
                            ·
                    ╱               ╲            screen-up is this way ↑
            ╱                               ╲
    ·   ← left            RING              right →   ·
            ╲                               ╱
                    ╲               ╱
                            ·
                    near (Start corner)  ← camera is over here, looking down 38°
```

Screen axes, in world coordinates:

| Axis | Formula | Meaning |
|---|---|---|
| `u` | `(x − z) / √2` | across the screen (left ↔ right) |
| `v` | `(x + z) / √2` | toward the camera — **`v` up = nearer the viewer** |

The board's silhouette in these axes is the diamond `|u| + |v| ≤ 7.78`. **Start is the near
point**, at `v = +7.78`.

## 2. Heights: one datum, and the board never moves

**`y = 0` is the board deck** — the underside of the tiles, which top out at `y = 0.16`. Adding
the environment must not shift the board, so everything is built downward and outward from there.

| Datum | y | What it is |
|---|---|---|
| `deck` | **0** | the surface the board stands on. On the modelled island, this is its plaza |
| `water` | **−1.85** | the sea |

Two more, `quay` (−1.2) and `keel` (−3.6), exist only for the procedural stand-in terrain that
shows when no island model is present. Author against `deck` and `water`.

## 3. What is actually on screen

With the framing margin `cfg.envMargin` (default **1.7**), the region visible at **every**
window shape is exactly:

```
|x − z| ≤ 11·M          |x + z| ≤ 11·M          → at M = 1.7:  ≤ 18.7 on both
```

That is a **5.4-tile collar** around the ring. Some window shapes show more, none show less.

The margin is the one real cost of this whole feature: at 1.12 the board fills the frame and
there is nowhere to put a world; every step above that trades board size for visible ground.
1.7 is what it takes to see water around an island big enough to hold the board.

| Band | Where | Treat it as |
|---|---|---|
| **The island** | out to ~8 tiles | the deck and its rim — always in frame |
| **Water** | 8 → 13 tiles | boats, buoys, rocks. Always visible |
| **Fringe** | 13 → 19 tiles | visible on some window shapes only; the water fades out here |
| **Beyond 19** | — | never seen. Don't build it |

## 4. The height rule

The camera looks down at 38°, so a sight line toward the viewer keeps `u` and gains height at
`tan 38° = 0.781` per unit of `v`. A piece therefore hides board that shares its screen column
and sits behind it.

What matters is the distance to the board's **near edge in that column**, which is at
`v = 7.78 − |u|` — not the distance to the board's near corner. For a piece at `(x, z)`:

```
d  =  v − (7.78 − |u|)                    ... how far it stands in front of the board
max top  =  0.16 + 0.781 · d              ... highest world y it may reach
```

| `d` — tiles in front of the board | Highest point allowed (world y) |
|---|---|
| 0.0 | 0.16 |
| 0.5 | 0.55 |
| 1.0 | 0.94 |
| 2.0 | 1.72 |
| 3.0 | 2.50 |
| ≥ 3.6 | 3.0 — the top of the frame takes over |

`d ≤ 0` means the piece is behind the board in its column and cannot occlude it; the only limit
is then the frame, **3.0**.

**The trap this replaces:** measuring to the board's near *corner* says anything level with the
board's left or right point is unconstrained. It isn't — out at `u = 5.3` the board's near edge
is only 2.5 deep, so a tall piece there covers the tiles behind it. The engine checks the rule
above on load and logs any piece that breaks it, naming the piece, its height and its budget.

## 5. Technical spec

| | Island | Props |
|---|---|---|
| Format | `.glb`, single file, texture embedded | same |
| Triangles | ≤ 4000 | ≤ 2000 |
| Materials | **one baked texture**, not a PBR map set | same |
| Texture | ≤ 1024 square | ≤ 1024 square |
| Up axis | +Y (glTF standard) | +Y |
| Scale / origin | anything — normalized on load | anything |

**Budget for the whole environment: ≤ 80,000 triangles and ≤ 30 draw calls.** The 40 tiles
already cost about 77k. The current environment — island, three boats and the sea — adds about
9k triangles and 4 draw calls.

Style must match the tiles: **low-poly toy diorama**, chunky primitives, flat baked colour,
strong value contrast, no fine detail and no text.

## 6. Generating these with Scenario

The tile pipeline (the `board-tile-art` skill) applies, with four differences that each cost a
regeneration to learn. Keep the skill's style block **verbatim** except where noted.

### 6.1 Replace the composition clause

The locked style block ends with *"open ground across the front half, the tall mass set against
the back edge."* That is right for a tile and wrong for anything the board stands on — it puts a
rock tower in the middle of the plaza. Substitute:

> …the whole square base is visible, **the top surface completely flat, level and empty, every
> detail confined to the outer rim.**

### 6.2 Isolate the object — no water, no ground plane

Ask explicitly for *"the island alone in empty space — no water, no sea, no ground plane, nothing
underneath or around it."* Without it the reference comes back sitting on a slab of water,
background removal keeps that slab, and reconstruction turns it into geometry that ends on a hard
edge a few tiles out. It also inflates the bounding box, which is what used to set the scale.

### 6.3 Nothing may stick out past the square

The first island came back with a staircase jutting off one side. It owned half the bounding box,
so fitting that box to 15 tiles left a plaza of 7 — and a board of 11 sat outside its own walls.

The engine now has `fit: "surface"`, which sizes a piece by its flat top rather than its
silhouette, so this no longer breaks placement. Ask for it anyway: a protruding element scaled up
along with the plaza becomes enormous.

### 6.4 The reconstruction arrives rotated 45°

`orientation: "align_image"` aligns the model to the reference's camera, and the reference is a
three-quarter view — so the piece comes back at 45° to the world axes. The board's ring is axis
aligned, so a square piece needs **`yaw: 45`** in the manifest. Check any square piece against the
board and expect to correct it.

### 6.5 Proportions to ask for

- the flat top fills **at least four fifths** of the width
- the rim is a **low kerb**, not a parapet — one or two blocks
- the underside is **shallow**

Set `faceLimit` at generation. Do **not** run the offline `normalize_tile.py` over the result: it
round-trips through trimesh and drops the baked texture, and the engine normalizes on load
anyway. Same reasoning as [../tiles/README.md](../tiles/README.md).

## 7. How pieces get placed

Placement is data, not code, and never baked into the model. Each piece is an entry in
[scene.js](scene.js):

```js
{ model: "island", at: [0, 0], y: "deck", yaw: 45, anchor: "surface", fit: "surface", size: 11.9 }
{ model: "boat",   at: [11.5, 1.5], y: -2.15, yaw: 60, size: 2.6 }
```

| Field | Meaning |
|---|---|
| `model` | `assets/env/models/<name>.glb` |
| `at` | world `[x, z]` |
| `y` | a datum name from §2, or a plain number for a world height |
| `yaw` | degrees; 0 leaves the model's authored **+Z** facing +Z |
| `size` | the piece's width **on the board**, in tiles, measured after the yaw |
| `fit` | what `size` measures: `bbox` (default) or `surface` — the flat top only |
| `anchor` | what lands on `y`: `base` (default), `top`, or `surface` |
| `repeat` | optional `{count, step:[dx,dz]}` for a row of the same piece |

`anchor: "surface"` casts a ray down through the piece's centre and puts whatever it hits on the
datum. That is what the island needs: the thing that has to line up with the board is the plaza,
which is neither the model's highest point (its kerb) nor its lowest (a keel of whatever depth
the generator felt like).

Because `size` is declared per piece, **you do not have to export at any particular scale.**

## 8. Check before delivering

- [ ] Up axis +Y, and the piece stands on `y = 0` in its own file — no built-in ground plane
- [ ] Nothing sticks out past the footprint
- [ ] Height within §4 for where it stands
- [ ] ≤ 4000 triangles (island) or ≤ 2000 (prop), one baked texture, ≤ 1024 square
- [ ] Silhouette and palette sit with the tiles, not against them

**Fastest sanity test:** add it to the manifest, load the board and watch the console — the engine
reports anything off screen, over budget or missing. Then look at it with the token on the
**Start** tile, which is the one a near-side piece will hide.
