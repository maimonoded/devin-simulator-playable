# Tile art brief — 3D models

Hand this to whoever produces the tile assets. It is self-contained.

The board is a 40-tile ring rendered in three.js under an **orthographic camera at 45° azimuth,
38° elevation**. Each tile is one unit square of ground. Models are dropped in as GLB and the
engine normalizes them on load, so most of the usual export worries don't apply — but the three
rules in §2 are not negotiable, because they're what stops tiles from hiding each other and the
player's token.

> Authoring **flat PNG** art instead? That's the legacy CSS board, and a different brief —
> see [ART-BRIEF-2D.md](ART-BRIEF-2D.md).

---

## 1. What the engine does for you

Don't pre-transform anything. On load, the engine measures the model and:

- **stands it upright** if it's Z-up
- **scales** it so its larger ground dimension spans one tile
- **centres** it on the tile and **rests its base** on the tile surface
- **yaws** it so its front faces out of the ring — each of the four board edges gets a different
  rotation, which is why §2.1 matters

So: any scale, any origin, any up axis is fine. **Do not** rotate the model into an isometric
pose — the camera does that. Author it straight-on, standing on the ground plane.

## 2. The three rules that matter

### 2.1 Front faces +Z

Author with the model's **face — its entrance, signage, the side meant to be read — pointing
+Z**, and the tall mass behind it at −Z.

The engine rotates each tile to face out of the ring. If a model's front points some other way,
that tile ends up presenting its flank while its neighbours present their faces.

### 2.1b The floor is flush and full-bleed — this is the one that decides the look

The ground surface must run **edge to edge, flat and flush**, with no rim, no border strip, no
base plate and no plinth. Neighbouring tiles then form one continuous floor and the paving reads
across the seam.

This — not the wall — is what makes the board hang together. Three regenerations that satisfied
every other rule all failed here: each came back as a raised plinth with a grass rim and a base
slab, so every tile became its own island and the ring read as scattered cards. A tall wall can
*hide* a bad floor by bridging the gap between tiles, which is why the difference is easy to
misattribute to the architecture.

In the subject sentence, say the paving **runs to the very edges of the plot on all four sides**,
and explicitly rule out grass borders, rims, base slabs and raised edges.

### 2.2 Fill the full square, tall mass hard against the back edge

The ground should fill the whole **1 × 1** tile, with tall mass pushed against the **back (−Z)
edge** and the front half kept low.

This is the rule the first asset broke, and it's worth understanding why. That model's ground was
**1.00 × 0.64** — a shallow strip. The engine centres what it's given, so its wall landed only
**0.17** from the tile centre instead of out at the edge, where it stood directly in front of the
player's token on the far side of the board and buried it.

Distance from the tile centre buys height, because the camera looks down at 38°:

| Tall mass sits this far from tile centre | Maximum height |
|---|---|
| 0.10 | 0.64 |
| 0.20 | 0.70 |
| 0.30 | 0.76 |
| 0.40 | 0.82 |
| **0.46 (hard against the edge)** | **0.85** |

All figures in tile units — 1.0 = one tile width. Anything taller hides the token when that tile
is on the far side of the ring.

The first asset was **0.70 tall at 0.17 from centre** — over the 0.64 budget, hence the burial.
The same 0.70 wall pushed to the back edge would have passed comfortably.

### 2.3 Nothing crosses the footprint

Keep every part of the model inside the 1 × 1 square, including the roof overhangs and any
ground/base plate.

The engine scales the *larger* ground dimension to the tile, so one prop sticking out sideways
shrinks the entire tile to compensate — the model gets smaller, not clipped.

Height above the budget in §2.2 is the only dimension that may exceed the cube.

## 3. Which tile is which

Numbering is 1-based, running clockwise from Start (the bottom vertex on screen).

| File | Tile | What it is |
|---|---|---|
| `1.glb` | Start | the entrance / go-again tile |
| `11.glb` | Spa | grants energy |
| `21.glb` | VIP Lounge | pays out the accumulated pot |
| `31.glb` | Premiere | sends the player back to Start |
| `6, 16, 26, 36` | Train | bonus coins |
| `4, 9, 14, 19, 24, 29` | Plot Twist | the card / chance tile |
| everything else | Standard | ordinary property tiles |

The four corners are the landmarks and should read as bigger, distinct places. The 26 standard
tiles should be visually quieter so the corners and specials stand out.

**Corners are seen from two sides.** They sit at the diamond's extreme points where two edges
meet, and the engine can only face them down one of the two. Give them something that reads from
either direction rather than a detailed front and a blank back.

## 4. Legibility

A tile is roughly **47 px on screen**. That is small.

- bold silhouettes, strong value contrast
- no text, no thin outlines, no fine surface detail
- 3–8 chunky primitives is the target complexity, not a detailed model
- judge it at 47 px, not in the viewer — if it's mush, simplify

## 5. Technical

| | |
|---|---|
| Format | `.glb`, single file, texture embedded |
| Triangles | **≤ 2000** — set it at generation, not by decimating afterwards |
| Materials | **one baked texture**, not a PBR map set |
| Texture size | 512 or 1024 square (4096 is ~7 MB/tile once re-encoded — see the README) |
| Up axis | +Y or +Z, either is fine |
| Origin / scale | anything — normalized on load |

Decimating a finished mesh **destroys its UVs and therefore its texture**, so the triangle budget
has to be set when the mesh is generated. See [README.md](README.md).

## 6. Check before delivering

- [ ] Front (entrance / readable side) faces **+Z**
- [ ] Ground fills the full square — not a shallow strip
- [ ] Tall mass hard against the **back (−Z) edge**, front half low
- [ ] Height within the §2.2 budget for where the mass actually sits
- [ ] Nothing crosses the 1 × 1 footprint sideways
- [ ] ≤ 2000 triangles, one baked texture, texture ≤ 1024
- [ ] Named `N.glb`, `N` = tile number from §3

**Fastest sanity test:** drop the model in as `models/N.glb`, load the board, and put the token on
that tile while it's on the **far** side of the ring. If you can still see the token, the piece is
within budget. That is the check the first asset would have failed.
