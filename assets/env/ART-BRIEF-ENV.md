# Environment art brief — the world around the board

Hand this to whoever produces the environment assets. It is self-contained.

The 40-tile board is a ring of 1×1 tiles rendered in three.js under an **orthographic camera at
45° azimuth, 38° elevation**. This brief covers everything *outside* that ring: the platform the
board stands on, the ground and water around it, the props in the near collar, and the far
backdrop.

> Authoring a **tile** instead — one of the 40 pieces on the board itself? Different brief, tighter
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

The board's four vertices are at `v = ±7.78` and `u = ±7.78`. **Start is the near one.**

## 2. Vertical datums — the board sits on a plinth

Five stacked levels. Do **not** author your own ground plane into a piece; stand it on a datum.

| Datum | y | What it is |
|---|---|---|
| `deck` | **0** | top of the plinth = underside of the board tiles. Tiles occupy 0 → 0.16 |
| `plinth` | −1.2 → 0 | a 12×12 platform with a chamfered top edge. The board sits on this |
| `quay` | **−1.2** | the land the props stand on. Level with the plinth's base |
| `water` | **−1.85** | harbour surface, 0.65 below the quay |
| `backdrop` | — | distant band, see §6 |

The 1.2-unit step from quay to deck is the whole point: it is what makes the board read as a
raised platform standing in a place, rather than a tray floating in a picture.

## 3. What is actually on screen

With the framing margin `M` (a tuning value, default **1.45**), the region visible at **every**
window shape is exactly:

```
|x − z| ≤ 11·M          |x + z| ≤ 11·M          → at M = 1.45:  ≤ 16 on both
```

That is a 3.5-tile collar all the way round the ring. Some window shapes show more, none show
less.

| Band | Where | Treat it as |
|---|---|---|
| **Collar** | ring edge → 3.5 tiles out | always visible, always in focus — put the detail here |
| **Mid** | 3.5 → 6 tiles out | visible on wide or tall windows only. Silhouette masses, no detail |
| **Beyond** | past 6 tiles | never seen at any aspect. Don't build it |

At M = 1.45 the board's near vertex (Start) sits about 3.5 tiles from the bottom edge of the
frame, and its far vertex about 3.5 from the top. That headroom above the far vertex is where the
backdrop lives, and it is roughly **3 units tall** — anything higher is cut off by the top of the
frame.

## 4. The one occlusion rule: the near quadrant

The camera looks down at 38°, so anything standing **between the viewer and the board** — that
is, at a `v` greater than the board's — can hide the front row of tiles, the art on them, and the
player's token.

For a piece whose `v` exceeds 7.78, let `d = v − 7.78` (how far in front of the near vertex it
stands, in tiles). Its **maximum height above the quay** is:

```
h  =  1.36 + 0.781 · d
```

| `d` — tiles in front of the board | Max height above the quay |
|---|---|
| 0.0 | 1.36 |
| 0.5 | 1.75 |
| 1.0 | 2.14 |
| 1.5 | 2.53 |
| 2.0 | 2.92 |
| 3.0 | 3.70 |

So: low and wide up close — boats, pontoons, bollards, parked cars, a kiosk. Anything with real
height — a crane, a lighthouse, a warehouse — stands at `d ≥ 1.5` or goes behind the board.

**There is no such limit on the far side or the left and right sides.** Nothing there can be
between the camera and the board. The only ceiling is the top of the frame, §3.

## 5. Collar pieces

The near collar is what the player actually reads. Target roughly 15–25 pieces, reused and
repeated rather than 25 unique ones.

| | |
|---|---|
| Format | `.glb`, single file, texture embedded |
| Triangles | **≤ 3000** per piece |
| Materials | **one baked texture** per piece, not a PBR map set |
| Texture | 1024 square max |
| Footprint | any — declare it in the manifest, §7 |
| Up axis | +Y (glTF standard) |
| Origin | anywhere — re-centred on load, base dropped onto its datum |
| Front | **+Z**, same convention as the tiles |

Mid-band pieces: ≤ 1500 triangles, 512 texture, silhouette only.

**Budget for the whole environment: ≤ 80,000 triangles and ≤ 30 draw calls.** The 40 tiles already
cost about 80k; the scene should stay under ~200k total.

Style must match the tiles exactly: **low-poly toy diorama**, chunky primitives, flat baked colour,
strong value contrast, no fine detail and no text. If a piece is fussier than the tiles it will
read as a different game.

## 6. The far backdrop

Not geometry — **one textured quad**, standing across the far side at about `|x + z| = 15`,
facing the camera.

| | |
|---|---|
| File | one PNG with alpha |
| Size | 2048 × 512 |
| Content | a distant skyline silhouette, 2–3 depth layers, low contrast |
| Top edge | **must fade to `#161b41`** — the page background behind the canvas is a CSS gradient, and scene fog is set to the same colour. A hard top edge will show as a seam |

Low contrast matters: this sits behind the tallest thing in the scene and must not compete with
the board.

## 7. How pieces get placed

Placement is data, not code, and not baked into the model. Each piece gets an entry in
`assets/env/scene.js`:

```js
{ model: "quay-crane", at: [7.5, -2.0], y: "quay", yaw: 180, size: 2.4 }
```

| Field | Meaning |
|---|---|
| `model` | `assets/env/models/<name>.glb` |
| `at` | world `[x, z]` |
| `y` | a datum name from §2, or a number |
| `yaw` | degrees; 0 leaves the model's authored **+Z** facing +Z |
| `size` | the piece's width in tiles — the engine scales its X-extent to this |
| `repeat` | optional `{count, step:[dx,dz]}` for rows of the same piece |

Because `size` is declared per piece, **you do not have to export at any particular scale** — the
engine normalizes on load exactly as it does for tiles. Author at whatever size is comfortable.

## 8. Check before delivering

- [ ] Front faces **+Z**
- [ ] Up axis is **+Y**, and the piece stands on `y = 0` in its own file (no built-in ground plane)
- [ ] If it belongs in the near quadrant, height is within the §4 table for its `d`
- [ ] ≤ 3000 triangles, one baked texture, ≤ 1024 square
- [ ] Reads at a glance from 45°/38° — check it *in the board*, not in a model viewer
- [ ] Silhouette and palette sit with the tiles, not against them

**Fastest sanity test:** drop the piece into the manifest, load the board, and put the token on
the **Start** tile. If the piece is in the near collar and you can still see the token clearly, it
is within budget.
