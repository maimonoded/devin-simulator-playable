# Tile artwork

> **What the board actually draws today.** `tileModelPath()` in
> [../../js/board-model.js](../../js/board-model.js) hands **the ordinary tiles one shared
> model**, `models/standard.glb`, and gives **the four corners and the two tiles that charge the
> player a model of its own** (below). The forty numbered GLBs are still on disk and nothing loads them — 35 of the 40 were
> byte-identical anyway, and the five that differed made the ring read as clutter rather than as
> a board. Point `tileModelPath` back at `models/<i+1>.glb` to get the old per-tile skyline.
>
> The four **card tiles** (5/15/25/35, where the deck is drawn) take **no model at all**. `null`
> is not "missing" — it is the signal to draw that tile's FACE instead, a portrait laid flat on
> the slab. Who stands where is `TILE_FACES` in board-model.js, and the pictures are
> [`faces/`](faces/), named by character rather than by tile number so swapping one is a word in
> that map and not a renamed file.

Two ways to skin a tile, both drop-in — no config, no registration, no code change:

- **`models/N.glb`** — a 3D model, used by the WebGL board.
- **`N.png`** / **`faces/<who>.png`** — flat artwork. On the WebGL board it becomes the slab's
  **top-face texture**; on the legacy CSS board (`cfg.board3d = 0`) it is the tile's background.

A model wins where both exist, which is exactly why a card tile asks for none. Missing files are
normal — the tile keeps its plain slab.

## Faces (`faces/`)

Five portraits, carried over from the `collectible_version` branch: `simon`, `victoria`, `carl`,
`mother`, `grandma`. Four of them are on the board; the other is there to swap in.

**A face is a full-bleed square with nothing important in its corners.** The tile renders as a
diamond and the diamond crops the picture — the corners sample outside the texture and are
edge-clamped, so whatever is at the picture's edge continues into them. `_loadArt()` turns the
UVs by `ENV_CAM.az` before applying them, because the slab's top face maps u/v to world axes that
this camera renders as screen diagonals; without that turn a portrait lands as a 45° lozenge.
That correction is a property of the camera, so it is made once in code rather than baked into
each file.

## 3D models (`models/`)

`models/standard.glb` is the piece the ring is built from, and the **four corners take a model
each**: `start.glb`, `spa.glb`, `vip.glb`, `reshoot.glb`. So do the **two tiles that charge the
player**: `payroll.glb` and `overheads.glb`. Every one of these files is named after its **tile
type**, so the type maps in [../../js/board-model.js](../../js/board-model.js) are the whole
mapping — there is no second list to keep in step, and renaming a type renames its file.

A model that is not on disk is not an error: the tile keeps its plain slab and its coloured rim,
exactly as any absent model does. So they can be dropped in one at a time.

The numbered files use 1-based numbering — `models/1.glb` is Start — and are currently unused;
see the note at the top.

### What the four corners are

Each corner is **one low prop lying on the shared cream slab**, not a building — a corner is seen
from two sides at once, and a prop lying down reads from either, where a frontage shows its back
to half the board.

| File | The prop | Accent |
|---|---|---|
| `start.glb` | a broad chevron arrow with coin stacks against it | gold |
| `spa.glb` | an oval plunge pool sunk into the ground, towels, pebbles | teal |
| `vip.glb` | a spilled heap of coins, an ice bucket, a velvet rope laid in a curve | violet |
| `reshoot.glb` | a clapperboard lying open, its striped arm up, a toppled studio lamp | rose |

The accent is the dusty cousin of that corner's rim colour in `COLORS.edge` (board3d.js), so the
model and the rim around it say the same thing. **Reshoot is the only dark one**, deliberately:
it is the only corner that costs the player something, and charcoal against three warm tiles is
what makes that legible at 47 px, where a clapperboard's stripes are already mush.

They are taller than the ring — 0.20 / 0.18 / 0.34 / 0.40 of a tile against `standard.glb`'s
0.28 — which is what makes a corner read as a landmark. All four stay inside the
[ART-BRIEF.md](ART-BRIEF.md) §2.2 budget for where their mass actually sits, so none of them
buries the token from across the ring.

### The two tiles that charge the player

Payroll and Studio Overheads are the studio's two standing bills, and they are the only tiles on
the ring that **only ever take**. Their art has one job the payout tiles don't: to be legible as
a *cost* from across the board, before the float appears.

They share **one ground and one mark**, and that pairing is the whole design:

| | |
|---|---|
| Ground | neutral near-black `#1E2024`, edge to edge — the only non-cream ground on the ring |
| Mark | a deep red `#C01F2B` **hazard band**, painted flat on the ground, running edge to edge |
| `payroll.glb` | an open steel cash drawer tipped forward and emptied, a spill of dull bronze coins tumbling over its lip, a folded grey payslip |
| `overheads.glb` | a dark meter plate with three dials, a closed junction box, a folded grey invoice slip |

Five decisions behind them, none of which is obvious from the files:

- **The ground carries this, not the prop, and not code.** An earlier attempt tinted the model's
  material and laid a dark plate over the tile from `js/ui/board3d.js`, and it was rejected.
  It never had a chance: `_loadModel()` sets `slab.visible = false` once a model loads — "the
  model brings its own ground" — so **the GLB's own base *is* the tile's background colour**, and
  `GAP` is 0, so there is no border to draw either. A tile with a different background is an art
  change by construction. Nothing in board3d.js needs to know these two exist.

- **Dark is not enough on its own, which is what the band is for.** Six tiles on this ring read
  dark at 47 px: these two and the four card tiles at 5/15/25/35, which are photographic
  portraits. Measured over the full tile diamond in the running engine, `card simon` comes in at
  mean luminance **54.2** — *darker than payroll's 68.9*. So "dark = this tile takes my money"
  cannot be taught by value alone, and a second attempt that tried to get there by making the
  grounds darker still would have failed the same way. The band is a **categorical** mark
  instead of a positional one: deep, saturated red on near-black, carried by both bills and
  nothing else. Measured as the share of tile pixels that are saturated dark red, it is
  **19.4%** on payroll and **19.8%** on overheads against **≤1.6%** on every other tile on the
  board. The standard tile's terracotta roof does *not* register — it is a chalky brick at hue
  ~6° and saturation ~0.54, where the band is hue ~354° at ~0.71.

- **The rim in `COLORS.edge` cannot do this job.** At board zoom it is a one-pixel wireframe, and
  overheads' `0xff5f7e` is nearly Reshoot's pink anyway. A mark that has to survive at 23 px has
  to be in the art, on the ground, with area behind it.

- **Both bills get the same ground, deliberately.** An earlier pass made payroll plum-brown and
  overheads near-black, reasoning that the larger bill should read heavier. The player never sees
  the two within one screen — they sit at index 3 and index 23, on opposite edges — so that
  distinction buys nothing and costs the pairing, which is the only thing a player can actually
  learn. **They are told apart by their props, never by their ground.**

- **The props stay dark; they are not the contrast.** The inverse rule — pale objects on a dark
  ground — was tried and it put a big cream mass exactly where the eye lands (22% of payroll and
  34% of overheads above luminance 150), so the tile framed a bright blob instead of reading as a
  hole in the road. Now the objects are gunmetal, charcoal and dull bronze, and the bills carry
  **0.6%** and **0.2%** of pixels above 150 — against 4–19% on the card tiles and 53–61% on a
  standard tile. Nothing on either tile out-brights its own ground by much, and neither of them
  is gold: gold is what Start and the VIP Lounge pay out in, and the player's own token is a gold
  statuette, so a gold prop on a tile that charges would say the opposite of what the tile does.

**Overheads shows the camera its back, and that is the argument for the band in one picture.**
Models are authored facing +Z and `_tileYaw()` turns each to face *out* of the ring. Payroll (index
3) sits on the lower-left edge, so out is toward the camera and its drawer reads. Overheads (index
23) sits on the upper-right edge, so out is *away*, and its meter is a featureless dark block from
the only angle the player ever has. The dials are in the file and they are fine — they are simply
not reachable on that edge. A prop can therefore never be the signal for both bills at once. The
ground can, because it is flat.

They are 0.33 and 0.37 of a tile tall, against `standard.glb`'s 0.28. Both clear the
[ART-BRIEF.md](ART-BRIEF.md) §2.2 budget for where their mass actually sits — 0.33 against 0.73
allowed and 0.37 against 0.66 — so the token still stands clear when either tile is on the far
side of the ring.

`#1E2024` and `#C01F2B` are the paint on the models, so those are the colours a rim for these two
in `COLORS.edge` (board3d.js) wants to be the dusty cousin of — the same rule the corners follow,
so the model and the rim around it say one thing rather than two.

#### Defeating the cream base tile

This is the one place the `board-tile-art` skill has to be deliberately disobeyed, and it will
come up again for any future bad tile.

The skill passes a fixed `assets/base-tile.png` as `referenceImages[0]` on **every** tile — that
supplied slab is exactly what stops forty tiles drifting apart, and it is also exactly what makes
every ground cream. Saying "dark slab" in the prompt while handing the model a cream one is a
fight the reference wins.

**So the reference is repainted rather than argued with.** `assets/base-tile.png` is reprinted in
the target colours with its silhouette and bevel shading intact: slab pixels only (the near-white
background is left alone, because the skill conditions on the white-background copy), luminance
divided by the cream top face's median and re-applied to the target hue, with a `**0.55` gamma on
that ratio — a straight linear ratio crushes the bevel to black once the slab is dark, and the
tile loses its edge.

**The band is painted into that same reference**, not asked for in prose. It is multiplied through
by the slab's own shading like the ground is, so it arrives as paint *on* the ground rather than a
sticker over it, and it is masked to the top-face parallelogram so it never creeps onto the slab's
side faces. The four corners of that parallelogram are measured off `base-tile.png` once — the top
vertex, the left and right vertices, and the fourth by construction (`L + R - T`).

**The band runs parallel to a square EDGE, not corner to corner.** In the parallelogram's own
coordinates `P = T + u(R-T) + v(L-T)`, it is a soft-edged strip at constant `u`, spanning 0.66 to
0.92. That matters because `_tileYaw()` gives each tile one of four right-angle yaws: an
edge-parallel band only ever swaps for the mirrored diagonal on screen, both of which read, where
a corner-to-corner band would go thin and foreshortened on two of the board's four edges. Placing
it off centre rather than through the middle keeps it clear of the prop and of the player's token,
which stands on the tile centre.

**Both are done: repainted reference *and* a forceful prompt.** The style block is otherwise
verbatim, with its slab sentence swapped and the object shrunk from "about half" the tile to
"about a third" —

> The tile is a plain flat slab in neutral near-black #1E2024, edge to edge, the entire slab that
> one dark colour - absolutely no cream, ivory, beige, tan, white or pale areas anywhere on the
> slab - and one bold deep red #C01F2B hazard band is painted flat onto the slab surface, running
> straight edge to edge across it exactly as in the reference image, solid and evenly saturated
> along its whole length, its bare dark surface clearly visible all around the object.

— and the subject sentence names the object's colours as staying dark *against a very dark tile*.
The reference alone is probably enough; the sentence costs nothing and removes the doubt.

**Say that the objects sit clear of the band.** Without that line the generator lays the prop
across it, and image-to-3D then smears the covered stretch into a faded gradient: the first
overheads mesh came back with a band that measured 6.3% against payroll's 19.4%, which is not a
pair. Adding "grouped together to one side of the tile, well clear of the red band, which runs
unobstructed from one edge to the other" fixed it in one re-roll, to 19.8%.

The repainting script is not in the repo. It is a few dozen lines of Pillow and the recipe above
is the part worth keeping; re-deriving it from `base-tile.png` takes longer to explain than to
write.

### How all six were made

Made with the repo's `board-tile-art` skill (Flux 2 + its LoRA on the fixed base tile → Photoroom
cutout → Tripo P1, `faceLimit` 1900, `pbr` off). Two things that are worth not re-deriving:

- **`orientation: "default"`, not the skill's pinned `"align_image"`.** `align_image` reconstructs
  in the reference image's frame, so the slab arrives sitting diagonally; `_loadModel()` squares
  it back up from the *bottom* of the mesh, which is the part image-to-3D invents, and lands
  5–20° off. Measured on the four corners: 57–77% of the cell covered with `align_image` against
  99.8% with `default`. A slab short of its cell is a gap between every pair of tiles.
- **The texture is shipped at 1024**, though Tripo returns 4096. A tile renders about 47 px wide,
  so 4096² buys nothing and costs 67 MB of VRAM per tile. Only the embedded image bytes were
  rewritten — vertices, indices and UVs are byte-identical to the export, so the texture-loss
  trap below does not apply. The recipe is **LANCZOS to 1024², JPEG quality 92, 4:4:4 subsampling,
  `optimize` off**, which is recorded because it is what keeps a seventh tile matching the six:
  re-encoding the same export any other way lands a few percent off in both file size and grain.

### The engine normalizes on load, so the file doesn't have to be normalized

`_loadModel()` in [../../js/ui/board3d.js](../../js/ui/board3d.js) squares the floor up to the
tile axes, fits that floor — not the bounding box — to the cell on each axis independently,
centres it and rests its base on the slab top. So an export at any scale or origin drops in and
lands correctly.

It does **not** guess the up axis: glTF 2.0 mandates +Y and the loader has already applied the
node transforms, so a `.glb` is upright by definition. (There was a "deeper than it is tall, so
treat it as Z-up" heuristic here once. A correct tile — square ground, low profile — *is* deeper
than it is tall, so it stood good tiles on end.)

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
| `31.png` | index 30 | **Reshoot** corner (the jail) |
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
- its **type border colour is kept** (gold Start, teal Spa, purple VIP, pink Reshoot) so the
  board still reads
- the emoji icon is hidden — the art replaces it
- the small coin-value label stays, switched to white with a shadow for legibility
- mystery-box markers still sit on top

## Partial sets are fine

Missing files are simply not used, so you can skin one tile or all forty. Absence is detected by
attempting to load the image (`fetch()` is blocked on `file://`), which means **404s for missing
files are expected** in the network log. The result is cached per tile for the page's lifetime,
so rebuilding the board doesn't re-probe.
