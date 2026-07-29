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
is then the frame, **3.0** (which the formula reaches at `d = 3.64`).

The engine checks this on load **for props**, at the piece's placement point — a fair proxy for
something one to three tiles wide. A deck spans too much ground for one point to mean anything,
so it gets the coverage check in §5 instead; the rule above still applies to its rim, and that
one is on you. For reference the shipped island's kerb tops out at y = 1.47 against a budget of
3.0 where it stands.

**The trap this replaces:** measuring to the board's near *corner* says anything level with the
board's left or right point is unconstrained. It isn't — out at `u = 5.3` the board's near edge
is only 2.5 deep, so a tall piece there covers the tiles behind it. The engine checks the rule
above on load and logs any piece that breaks it, naming the piece, its height and its budget.

## 5. The asset contract

**This is the part that makes new environments drop in.** The engine measures nothing. It
scales the piece, turns it if the manifest says so, and drops it at the datum — so everything
that decides whether the board sits square has to be true of the file itself.

### A deck piece — anything the board stands on

| | |
|---|---|
| Deck | contains a **1 × 1 axis-aligned square, centred on the origin, with nothing standing on it** |
| Deck surface | at **y = 0**. Rock and keel go negative, kerb and rim positive |
| Rotation | deck edges square to X and Z |
| Everything else | free — overhangs, piers, buildings and keels may be any size, they are never measured |

"Nothing standing on it" is the half that is easy to miss. A slab usually runs on *underneath*
the buildings around it, so the flat area and the usable area are different numbers — on the
Texas town the flat square was 0.83 wide and the clear square only 0.59. The conform tool
measures the clear one, and the board is sized to that.

The engine scales that 1 × 1 up to `11 + 2 × margin`, so the board lands centred with the
requested border on every side, whatever the asset's own proportions were.

### A prop — boats, rocks, buoys

| | |
|---|---|
| Footprint | longer horizontal axis along **X**, measuring **1** |
| Origin | centred in XZ, **base at y = 0** |

`size` in the manifest is then the piece's width in tiles, directly.

### File format, either kind

| | Deck piece | Prop |
|---|---|---|
| Format | `.glb`, single file, texture embedded | same |
| Triangles | ≤ 4000 | ≤ 2000 |
| Materials | **one baked texture**, not a PBR map set | same |
| Texture | ≤ 1024 square | ≤ 1024 square |
| Up axis | +Y (glTF standard) | +Y |
| Scale / origin / rotation | set by the conform tool below | same |

Shipped for comparison: the island is 3,668 triangles, each boat 1,783.

**Budget: the environment may add ≤ 20,000 triangles and ≤ 10 draw calls** on top of the board.
Measured on the shipped scene, the 40 tiles cost 74,952 triangles across 58 draw calls and the
environment — island, three boats and the sea — adds **9,019 triangles and 5 draw calls**, for
83,971 and 63 in total.

Style must match the tiles: **low-poly toy diorama**, chunky primitives, flat baked colour,
strong value contrast, no fine detail and no text. A piece fussier than the tiles reads as a
different game.

### Conforming a file

A generator satisfies none of this: it returns arbitrary scale and origin, and Tripo hands
the mesh back turned to the reference image's three-quarter camera — measured at 50° on the
island and 52.6° on the boat, so it is systematic rather than random. One tool fixes it:

```bash
python3 tools/normalize-env.py assets/env/raw/island.glb --deck -o assets/env/models/island.glb
python3 tools/normalize-env.py assets/env/raw/boat.glb          -o assets/env/models/boat.glb
python3 tools/normalize-env.py assets/env/models/island.glb --deck --check
```

It measures the raw mesh and writes the correction as a **transform on a new root node**.
Geometry, materials and the whole BIN chunk are copied byte for byte — which is the point:
round-tripping a mesh through a library is what drops the baked texture (see
[../tiles/README.md](../tiles/README.md)); editing one node transform cannot. Keep the raw
file in `raw/`, since conforming is not reversible from the output.

`--check` re-runs the measurements against a finished file and passes or fails. Use it — it
is what caught a rotation-sign bug that left the island 10° off while every other check was
green.

### What the engine does about a violation

`env3d.js` rays down at the ring's four corners and four edge midpoints. Every one has to
land on the deck at the datum. If not, it names the piece, the offending points and how far
off they were, and tells you to re-run the tool. **A bad environment announces itself rather
than looking subtly crooked** — which is what the whole contract is for.

## 6. Generating these with Scenario

The tile pipeline (the `board-tile-art` skill) applies. Keep its style block **verbatim**
except for the composition clause below.

Orientation, scale and origin are no longer your problem — the conform tool fixes those. What
it cannot fix is **proportion**: if the generated deck is only half the width of the piece,
conforming it just makes the whole island enormous next to the board. So these are prompt
requirements, not placement ones.

### 6.1 Replace the composition clause

The locked style block ends with *"open ground across the front half, the tall mass set
against the back edge."* That is right for a tile and wrong for anything the board stands
on — it puts a rock tower in the middle of the deck. Substitute:

> …the whole square base is visible, **the top surface completely flat, level and empty, every
> detail confined to the outer rim.**

### 6.2 Isolate the object

Ask for *"the island alone in empty space — no water, no sea, no ground plane, nothing
underneath or around it."* Otherwise the reference comes back sitting on a slab of water,
background removal keeps it, and reconstruction turns it into geometry that ends on a hard
edge a few tiles out.

### 6.3 Proportions to ask for

- the flat deck fills **at least four fifths** of the width
- the rim is a **low kerb**, not a parapet — one or two blocks
- the underside is **shallow**
- nothing sticks out past the square

Set `faceLimit` at generation. Do **not** run the offline `normalize_tile.py` over the
result — that is the tile tool, and it destroys the texture. `normalize-env.py` is the one
for environment pieces.

## 7. How pieces get placed

Placement is data. [scene.js](scene.js) holds one entry per world — the drawer's **World**
picker lists them — and each world holds its pieces:

```js
{ model: "island", at: [0, 0], y: "deck", deck: true }
{ model: "boat",   at: [11.5, 1.5], y: -2.15, yaw: 60, size: 2.6 }
```

| Field | Meaning |
|---|---|
| `model` | `assets/env/models/<name>.glb` |
| `at` | world `[x, z]` |
| `y` | a datum name from §2, or a plain number for a world height |
| `deck` | `true` if the board stands on it — then `size` is not used |
| `margin` | deck border in tiles; defaults to `cfg.envDeckMargin` |
| `size` | a prop's width in tiles |
| `yaw` | degrees. A deck may only take quarter turns; a prop may sit at any angle |
| `repeat` | optional `{count, step:[dx,dz]}` for a row of the same piece |

Note what is **not** there: no scale, no anchor, no fit, no per-asset rotation offset. Those
were the hand-tuned numbers that had to be re-derived for every asset, and they are the file's
job now. A `yaw` on a deck piece is a design choice about which side faces the player — not a
correction. If you find yourself wanting a non-quarter-turn yaw on a deck, the file is wrong;
conform it.

## 8. Check before delivering

- [ ] `normalize-env.py --check` passes
- [ ] Height within §4 for where the piece stands
- [ ] ≤ 4000 triangles (deck) or ≤ 2000 (prop), one baked texture, ≤ 1024 square
- [ ] Silhouette and palette sit with the tiles, not against them

**Fastest sanity test:** add it to the manifest, load the board and watch the console. The
engine reports anything off screen, over budget, missing, or not carrying the board.
