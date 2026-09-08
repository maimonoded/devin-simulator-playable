# Tile artwork

Two ways to skin a tile, both drop-in — no config, no registration, no code change:

- **`models/N.glb`** — a 3D model standing on the slab. For a tile whose subject is an *object*.
- **`N.png`** — a picture printed on the slab's **top face**. For a tile whose subject is an
  *image*: the six NPC tiles are character portraits this way, because a person cannot be a low
  prop and a portrait can be a floor.

**Both work on the WebGL board**, and both apply if both exist — the model stands on top of the
picture, which is almost never what you want. Pick one per tile. (This README used to call the
PNG "legacy CSS board only". That was wrong: `_loadArt()` in
[../../js/ui/board3d.js](../../js/ui/board3d.js) has always textured the 3D slab with it.)

Missing files are normal — the tile keeps its plain slab.

### A tile PNG is turned by the engine, so draw it upright

The slab is an unrotated box, so its top face maps u to world +X and v to world −Z — and the
camera's fixed 45° azimuth renders both of those as screen **diagonals**. Art applied straight
comes out as a lozenge.

`_loadArt()` corrects it once for every tile PNG there will ever be, by rotating the UVs by the
camera azimuth. So **author the image upright** and it lands upright.

Two consequences for the art:

- **Full bleed, square.** The image fills the whole face and the tile's diamond outline crops it.
  Do not inset the picture to dodge that crop — it reads as a stamp floating on a cream margin
  rather than as the tile's face.
- **Nothing important in the corners.** The face's four corners sample outside the image and are
  edge-clamped; those corners are the diamond's points, and the edge pixels continue into them.
  A centred subject is invisible-seam; a subject running into a corner is not.

## 3D models (`models/`)

Same 1-based numbering as the PNGs: `models/1.glb` is Start. Mapped by `tileModelPath()` in
[../../js/board-model.js](../../js/board-model.js).

### The engine normalizes on load, so the file doesn't have to be normalized

`_loadModel()` in [../../js/ui/board3d.js](../../js/ui/board3d.js) measures the model's bounding
box and then fixes the up axis (a model deeper than it is tall is treated as Z-up and stood
upright), scales the larger ground dimension to one tile, centres it in XZ, and rests its base on
the slab top. So an export at any scale, origin or orientation drops in and lands correctly.

This is deliberate, and it is why the generated GLB is used **as exported** rather than run
through the `board-tile-art` skill's `normalize_tile.py`: that script round-trips the mesh
through trimesh, which **drops the baked texture** — the raw export carries 1 image and 1
texture, the normalized file carries 0, and the tile renders plain white. These assets already
arrive inside the 2000-triangle budget (`faceLimit` is set at generation), so the offline pass
had nothing left to contribute. If a future asset does come in over budget, decimate it — but
verify the texture survives before trusting the output.

### What the file should contain

| | |
|---|---|
| Format | `.glb`, single file, texture embedded |
| Budget | ≤ 2000 triangles |
| Footprint | any — scaled to the tile on load |
| Up axis | +Y or +Z — detected on load |
| Origin | anywhere — re-centred on load |
| Materials | one baked texture (not PBR map sets) |

Height is free: a model taller than its tile stands up off the board like a prop, which is the
intended look.

### Facing: authored +Z, yawed outward per edge

Models are authored facing **+Z**, and `_tileYaw()` turns each one to face **out of the ring** —
0° / ±90° / 180°, one per board edge. Without that, the two side edges would present the model's
flank while the other two present its face.

Outward rather than inward because the two edges nearest the camera are the ones the player
reads: an inward-facing model puts its back between the camera and its own tile, hiding the art
and the token standing on it.

**Not** rotated 45° to face the camera, which is the tempting version — that swings the square
footprint into a diamond measuring 1.07 against a 0.92 tile, a 16% overhang into both neighbours.
Corner tiles have two equally valid normals and simply take one, for the same reason.

### Tall art hides the token — see the brief

The token's top sits at 0.53 world units; the first asset's wall reached 0.726 and buried it on
the far side of the ring. How tall a model may be depends on how far its mass sits from the tile
centre, because the camera looks down at 38°. [ART-BRIEF.md](ART-BRIEF.md) §2.2 has the budget
table and the reasoning — it is the main thing to get right when commissioning a tile.

---

## Flat PNG artwork (legacy CSS board)

> **Commissioning art?** Hand over [ART-BRIEF.md](ART-BRIEF.md) — it's the self-contained spec
> (camera angle, diamond geometry, anchor, naming). The camera is the part that matters: this
> board needs **38° elevation**, not the standard isometric 30°.

## Naming

**The filename is 1-based**, counting clockwise from Start:

| File | Tile | Which tile |
|---|---|---|
| `1.png` | index 0 | **Start** (bottom vertex of the diamond) |
| `2.png` | index 1 | first standard tile after Start |
| `4.png` | index 3 | first Plot Twist / deck tile |
| `6.png` | index 5 | first train tile |
| `11.png` | index 10 | **Spa** corner |
| `21.png` | index 20 | **VIP Lounge** corner |
| `31.png` | index 30 | **Premiere** corner |
| `40.png` | index 39 | last tile before Start |

So the file number is `index + 1`. Only `.png` is looked for.

The mapping lives in `tileImagePath()` in [../../js/board-model.js](../../js/board-model.js) — if
you'd rather the filenames matched the 0-based code indices, that's the one line to change.

## Size

A tile renders at **47.3 × 47.3 CSS px** on the default 560px board (11 columns, 4px gaps).

| | Size | Notes |
|---|---|---|
| **Recommended** | **144 × 144 px** | 3× for retina; what to author at |
| Acceptable | 96 × 96 px | 2× |
| Minimum | 48 × 48 px | 1×; will look soft on retina |

Square, and `background-size: cover` fills the tile — so anything non-square gets cropped.
Transparency is fine; it composites over the board background.

**Author it straight-on, not pre-skewed.** The board is drawn at `rotateX(52deg) rotateZ(45deg)`,
but the artwork is counter-rotated by the same amount, so it **faces the viewer upright** — exactly
as the source file looks. Don't skew your art into a diamond to "match" the board; that would be
applied twice. A straight-on render or illustration is what you want.

**A perfect edge-to-edge fit isn't possible, by design.** The board has a 1200px perspective, so a
tile's on-screen diamond gets *taller* the nearer it is to the camera:

| Tile | Where | Diamond width : height |
|---|---|---|
| 0 (Start) | nearest | 1.16 : 1 |
| 5 | lower edge | 1.41 : 1 |
| 10 / 30 | left & right corners | 1.67 : 1 |
| 20 (VIP) | farthest | 2.18 : 1 |

Standard isometric art is drawn at 2:1, which only matches the far end of the board. So art is
treated as a **prop standing on the tile** rather than a texture filling it — the tile face stays
visible around it, which is how Monopoly-GO-style boards look anyway. Two tuning-drawer values
control the fit, under *Tile values*:

- **`tileArtScale`** (default 1.45) — how large the art is relative to its tile
- **`tileArtLift`** (default 8%) — how far it's raised so its base sits on the tile face

Both are live, so open the drawer with your art in place and dial them until it sits right.

The picture is scaled slightly larger than the tile and is allowed to overflow it, so art with a
base or a tall element reads as an object standing on the board rather than a flat texture. It
still occupies a small area — roughly 47px — so fine detail, thin lines and small text will not
survive. Bold shapes and strong contrast read best.

## What changes when art is present

- the art is drawn on a child element (`.art`) that counter-rotates the board tilt — a CSS
  background would be sheared by the board's 3D transform, which is why it isn't one
- the tile's gradient background and inset shadow are dropped
- its **type border colour is kept** (gold Start, teal Spa, purple VIP, pink Premiere) so the
  board still reads
- the emoji icon is hidden — the art replaces it
- the small coin-value label stays, switched to white with a shadow for legibility
- mystery-box markers still sit on top

## Partial sets are fine

Missing files are simply not used, so you can skin one tile or all forty. Absence is detected by
attempting to load the image (`fetch()` is blocked on `file://`), which means **404s for missing
files are expected** in the network log. The result is cached per tile for the page's lifetime,
so rebuilding the board doesn't re-probe.
