---
name: board-tile-art
description: Generate low-poly toy-diorama board game tiles as game-ready 3D assets (glTF/GLB) using Scenario (scenario.com) — normalized to a 1x1 unit footprint, +Y up, origin at base centre, single baked texture, under a triangle budget. Use this whenever the user asks for a board tile, game tile, tileset, map tile, board art, or a 3D prop for a game board; whenever they describe a location or building to be turned into a game asset; whenever they mention Scenario, scenario.com, the Scenario MCP, GLB, glTF, or image-to-3D; and whenever they need a batch of visually consistent game assets. Trigger even if they only say something like "make me a tile of a gas station" or "generate the board assets for these 10 locations" without naming Scenario or the format.
---

# Board Tile Art

Produces board game tiles as game-ready GLB meshes: a 2D style reference from a locked-style LoRA, then image-to-3D, then a local normalization pass that forces the mesh to the engine's spec.

Two things matter more than anything else here:

**Consistency across the board.** Forty tiles that each look good alone but don't sit together are a failure. The style block is locked and only the subject sentence changes.

**The engine's spec is exact, and generators don't respect it.** Every generated mesh arrives at an arbitrary scale, orientation and origin. Normalization is not cleanup — it's the step that makes the asset usable. It never gets skipped, and its checks never get waved through.

## Target spec

| Requirement | Value |
|---|---|
| Format | glTF / GLB |
| Footprint | 1 × 1 unit per tile |
| Up axis | +Y |
| Origin | centre of the base |
| Ground | model sits on the ground plane (min Y = 0) |
| Ground shape | fills the square — not a shallow strip (see below) |
| Tile base colour | supplied by `assets/base-tile.png`, measured **#F4EDDD** — not re-invented per tile |
| Height | **low** — object ≤ 0.2 tile units — flat, not merely short; check at 0.3, which allows for the base slab (see below) |
| Facing | the readable side points one consistent way (+Z by convention) |
| Materials | baked to a single texture |
| Budget | ≤ 2000 triangles |

Confirm these with the user on first use if a project brief exists — they vary per engine, and `normalize_tile.py` takes `--max-tris`, `--footprint`, `--max-height` and `--min-ground-ratio` to match.

### Height is not free, and this is the easiest thing to get wrong

The obvious reading of "1 × 1 footprint, height free" is that a tall piece is always safe. It isn't, on a ring-shaped board: the tiles on the far side are viewed *through* the tiles in front of them, so a tall model hides the player's token — and it hides it on someone else's tile, which is why it survives every per-tile check.

How tall a piece may be depends on **how far its mass sits from the tile centre**, because the camera looks down at a fixed angle. Mass at the back edge is nearly free; mass in the middle is not. For a camera at elevation `e`, an occluder at distance `d` from the tile centre toward the camera, and a token whose top is at height `t`:

```
max height ≈ t + d · cos(45°) · tan(e)
```

The `cos(45°)` is there because only the component along the camera's azimuth counts. Worked through for one real board — 38° elevation, token top 0.53, tile 0.92 wide:

| Mass sits this far from tile centre | Max height |
|---|---|
| 0.10 | 0.64 |
| 0.30 | 0.76 |
| 0.46 (hard against the edge) | 0.85 |

That board's first tile was 0.70 tall with its mass 0.17 from centre — over budget, and it buried the token. The same 0.70 wall at the back edge would have passed. **Ask the engine for its camera elevation and token height and compute the budget before generating a set**, then pass it as `--max-height`.

This is also why the ground has to fill the square: a strip-shaped tile puts its mass mid-tile no matter how the art was intended.

## Step 0: Check the connection

Runs on the Scenario MCP server. Confirm `scenario:*` tools are available (`scenario:model_run`, `scenario:jobs_wait`, `scenario:asset_display`).

If they aren't, stop and point the user at `README.md`. Don't substitute another generator — the output won't match the rest of the board, which defeats the purpose.

Tool call details, model IDs and parameters live in `references/mcp-path.md`. Read it before the first generation.

## Step 1: 2D reference, generated ON TOP of the fixed base tile

**Always pass `assets/base-tile.png` as `referenceImages[0]`.** The slab is not
regenerated per tile — it is supplied, and the model only adds the object standing on
it. This is the single biggest consistency lever in the skill: a slab that is given
cannot drift in colour, shape or camera, and forty tiles that share one base read as
one board.

It also removes work downstream. The colour-correction pass exists because the slab
used to be re-invented every time; with a fixed base it should rarely have anything
to correct.

Generate a 1024×1024 reference image first, then convert it to 3D. It's tempting to skip straight to text-to-3D — one call instead of two, about half the cost — but the 2D step earns its keep on a multi-tile board:

- The LoRA is the style anchor. Text-to-3D has no equivalent, and consistency across 40 tiles is the whole game.
- It's an approval gate. A bad reference costs one cheap call; a bad mesh costs an expensive one.

For a one-off prop where neither matters, text-to-3D is reasonable. For a board, use the reference.

Prompt = **subject sentence** + **style block**, in that order. The style block is fixed — don't paraphrase, reorder or "improve" it between tiles. Drift here is the main cause of a board that doesn't hang together.

```
<SUBJECT>. Low-poly 3D toy diorama board game tile, centered square composition.
Three-quarter view looking down at about 40 degrees onto a flat square tile.
The tile is a plain flat slab in warm cream ivory #F4EDDD, edge to edge, the
same colour on every tile, its bare surface clearly visible all around the
object. One small object sits centred on the tile, covering about half of it,
and it is VERY FLAT — a low-relief miniature that hugs the tile surface, no
more than a fifth of the tile's width in height, as if pressed down onto the
tile. Nothing stands upright. No towers, no walls, no posts, no fences, no
uprights, no vertical structures of any kind, however tall the subject sounds:
lay it down, flatten it, or show it from above instead. Objects are 3-8 chunky
primitives with rounded bevelled corners. Muted dusty desaturated colours only,
chalky and soft, never bright, clean, neon or saturated. Matte finish, one flat
colour per surface, absolutely no texture detail, no surface patterns, no
material realism. Soft even daytime light, gentle shadows. Clean neutral
background.
```

Three parts of that block are load-bearing and get overridden constantly by an enthusiastic
subject sentence. They are not stylistic preferences:

- **The tile base colour is fixed for the whole board.** Every tile is the same warm cream slab;
  only the object on it varies. Forty tiles each in their own colour reads as noise, and the
  board stops looking like one place. Never let a subject sentence recolour the tile.

  The hex is now a *description* of `assets/base-tile.png`, not a target the generator has to
  hit — that is the point of supplying the base. #F4EDDD is its measured top-face median.
  Drift is still possible, because the model repaints what it is given, so **check it on the 2D
  reference before converting to 3D**: sample a patch of bare slab and compare. That is the
  cheap gate — a drifted tile costs one image, a drifted mesh costs an image-to-3D call, and a
  board where tile 12 is a different cream from tile 11 costs the whole set. Re-roll the
  reference rather than accepting a drifted one.
- **Everything is flat.** Not "short" — flat. A fifth of the tile's width is the ceiling, and
  nothing stands upright. Height is what hides the player's token and the tiles behind it, and
  the generator will build upward at the slightest excuse: naming a gate gets a standing gate,
  naming a shop gets a shopfront. Rewrite the subject so the object is inherently low — lying
  down, folded, laid out, or seen from above — rather than hoping the style block holds it back.
  It usually doesn't on its own.
- **The object sits ON the tile, it does not become the tile.** Bare slab has to be visible
  around it. Art that covers the whole tile leaves nothing to read the board's grid by.

With a fixed base, the subject sentence describes **only the object** — never the
ground. "A low folded striped deckchair" is right; "a deckchair on a paved courtyard"
re-specifies the slab and invites the model to replace it. Any mention of paving,
grass, gravel or a plot is now a bug in the subject, not a detail.

Writing the subject sentence:

- **Name one object, and keep it low.** The subject sentence names the *object standing on the tile* — not a scene, not a plot, not a building. "A folded towel and two dumbbells" beats "a fitness club". If the tile's role suggests something tall, translate it into a low prop: a lighthouse becomes a squat striped bollard, a hotel becomes a luggage trolley. Say the object is small, low and sits in the middle of the tile.
- **Never restate colour for the tile itself.** Describe the object's colours only, and keep them muted. Any mention of the ground, base, floor or paving invites the generator to recolour or retexture the slab, which breaks the board's uniformity.
- **Demand a flush, full-bleed floor.** The single biggest factor in whether a set reads as one board. Say the ground "runs to the very edges of the plot on all four sides, flat and flush", and explicitly rule out grass borders, rims, base slabs, plinths and raised edges — generators add them by default, and each one turns its tile into a separate floating island. It is easy to misattribute this to the architecture, because a tall wall bridges the gap between tiles and hides a bad floor.
- **Describe a plot, not a facade.** This is the one that bites. "A brick walkway with a brick wall *in the background*" reads as an elevation — a wall seen head-on — and reconstruction returns a shallow strip, 1.00 × 0.64, rather than a square. The engine centres what it is given, so the wall lands in the *middle* of the tile instead of at its back edge, standing between the camera and the tile and hiding the player's token. Say "a square courtyard plot, brick wall along its back edge, paved walkway across the front" instead. `normalize_tile.py` warns when the delivered ground comes back strip-shaped.
- **Name 2-4 objects, no more.** A paragraph of scene-setting makes the model spend its budget on clutter that the mesh can't afford anyway at 2000 triangles.
- **Big silhouettes over fine detail.** Image-to-3D reconstructs shape, not decoration. Mortar lines, ribbons and signage become texture noise at best and geometry noise at worst. Restate detail as bigger shapes: "wreaths as solid green rings", not "wreaths with bows".
- **One clear subject, one ground plot.** Reconstruction handles a single coherent object far better than a scattered scene.
- **Say which way it faces.** Name the side meant to be read — entrance, signage, frontage. The engine rotates tiles to face out of the board, so a piece with no clear front ends up showing its flank next to neighbours showing their faces.

## Step 2: Cut out the background

Photoroom, `hdBackgroundRemoval: true`, **`shadowMode: ""`**.

The empty shadow mode is deliberate and differs from 2D tile work. A baked contact shadow would be reconstructed as geometry or painted into the texture, and then the engine lights the tile again — you get a shadow that doesn't move with the light.

## Step 3: Image → 3D

Tripo P1 (`model_tripo-p1-image-to-3d`) — organized edge flow rather than dense scanned geometry, a direct face-limit control, and native GLB.

Two parameter choices that matter:

- **`faceLimit: 2000`** — sets the budget at source. Don't rely on it alone; "faces" may be quads, so the real triangle count gets verified in Step 5.
- **`pbr: false`** — PBR output means separate albedo, metal-rough and normal maps. A single baked texture needs plain texturing. If the engine actually wants PBR maps, flip this and revisit the "single texture" requirement with the user rather than quietly shipping three maps.

Image-to-3D takes ~2-3 minutes, longer than `model_run` waits. When it returns `status: "in_progress"`, follow up with `scenario:jobs_wait` rather than assuming failure.

## Step 4: Download the GLB

`scenario:asset_download` gives a signed URL; fetch it to disk.

On claude.ai the sandbox blocks `cdn.cloud.scenario.com` unless the user has allowlisted it — see `README.md`. Claude Code has no such restriction. If the fetch fails, hand the user the download link and the normalize command rather than dropping the last two steps silently.

## Step 5: Normalize (never skip)

```bash
python scripts/normalize_tile.py raw/11.glb --out tiles/11.glb
python scripts/normalize_tile.py 'raw/*.glb' --outdir tiles/ --max-tris 2000
```

Call it with whatever `python` is to hand. If the skill has its own `.venv/`, the script re-executes itself with that interpreter automatically — don't try to activate anything or guess a path. If dependencies are missing it says so and names the fix; run `--check-env` to see which interpreter is actually in use before debugging anything else.

Detects and corrects the up axis, decimates to budget, scales the XZ footprint to 1×1, moves the origin to the centre of the base, and prints a per-check report. Exit code is non-zero if any tile fails, so a batch can't half-succeed unnoticed.

Order inside the script is deliberate: **decimation runs before scaling and centring.** Quadric simplification moves vertices, so decimating afterwards leaves the footprint at ~0.999 and the base plane a fraction off zero. Small, but the engine anchors on the origin, and 40 tiles each off by a different fraction means visible seams.

Flags: `--max-tris`, `--footprint`, `--tex-size`, and `--up y|z` to override the detected up axis.

**glTF input is always treated as Y-up**, because the glTF 2.0 spec mandates it and trimesh has applied the node transforms by the time the mesh is measured. The extent-based heuristic — smallest extent is the height — is only used for formats that carry no convention (OBJ, PLY, STL). It has to be restricted this way: it holds for a flat plate-like tile but breaks on anything with a tall feature, and a wall-and-gate tile measuring 1.00 × 0.64 tall × 0.70 deep was duly rotated onto its back, silently, with all checks still passing. If you do run a non-glTF source, check the reported axis on the first tile of a set.

Report the check table to the user, **including any `WARNING:` lines**. Warnings cover the two
failures that pass every measurement and still sit wrong on a board — a strip-shaped ground, and a
piece over the height budget. They deliberately don't fail the file, because both are occasionally
legitimate, so they only do their job if you actually relay them. A silent "done" hides exactly
the failures this step exists to catch.

### Verify the first tile on the board, not just in the report

Before generating the rest of a set, put the first finished tile in the engine and look at it —
specifically with the token on that tile while it sits on the **far** side of the board. Every
problem in this document passed the check table and was only visible on screen: the untextured
white tile, the model rotated onto its back, the buried token. One render is worth more than the
whole report, and it costs one tile instead of forty.

### The texture is the fragile part

Geometry survives this step easily; the baked texture does not. Three things have destroyed it, all silently, and the report's `texture` line and last two checks exist to make each one visible:

- **Pillow missing.** trimesh can't decode the embedded image, so it loads a material with no texture and exports an untextured mesh — while all four *geometry* checks still report PASS. This shipped a plain-white tile once. `imaging_available` catches it.
- **Decimation discards UVs.** `simplify_quadric_decimation` returns `ColorVisuals` with no UVs, so an over-budget tile would be silently traded for a white one. The script now **refuses** and fails the tile instead. The fix is upstream: lower Tripo's `faceLimit` and re-generate, where the mesh is built to fit and keeps its UVs. Don't "fix" a failure here by raising `--max-tris`.
- **Re-encoding bloat.** Generators return a 4096² texture; trimesh re-encodes it as PNG, giving ~7 MB per tile — around 270 MB for a 40-tile board. `--tex-size` caps the longest side, default 1024 (~1 MB/tile). A tile renders a few dozen pixels across, so 4096² was never buying anything. Pass `--tex-size 0` to leave it alone.

### Fit the FLOOR to the cell, not the bounding box

Whichever side does the fitting, the thing that has to line up with the neighbouring tiles is the
**floor**, measured as the bottom ~20% of the model's height. Two failures follow from using the
bounding box instead:

- **Overhang drives the scale.** A wall cap, roof or awning that projects past the ground inflates
  the box, so the fit shrinks the floor away from its neighbours and opens a seam.
- **Generated floors are never quite square.** A real one came back 0.863 × 0.984. A *uniform* fit
  scales to the larger axis and leaves the shorter one 14% short of the cell — a visible gap
  between every pair of tiles. Fitting each ground axis independently closes it; a few percent
  stretch on chunky toy art is invisible, a seam in the board is not.

Don't try to solve either in the art. Ask for a flush full-bleed floor, then let the fit absorb
what the generator actually returns.

### Engine-side normalization is a valid alternative

If the target engine measures the bounding box on import — scaling, centring and grounding the model itself — then a mesh-level normalizer buys little and costs the texture round-trip. Ask what the engine does before assuming this step is required. It is still the right place to enforce the **triangle budget** and to verify the asset, which is worth running even when the transforms are redundant.

One caution if the engine does it: a bounding box taken from cached per-geometry boxes is not tight once anything is rotated — it returns the box of a rotated box. In three.js that means `Box3.setFromObject(obj)` reported 1.0 for a model that was really 0.5, and the tile rendered at half size. Measure from actual vertices (`setFromObject(obj, true)` there). The same trap exists in any engine that caches bounds per mesh.

## Batches

Keep a manifest so the board stays reproducible — see `board.example.json`. Work one tile at a time through Steps 1-5, writing to `<number>.glb`.

Before a large batch, ask Scenario for a dry-run cost estimate. Forty tiles × three model calls adds up, and image-to-3D is the expensive one.

Bump `style_version` if the style block or model IDs ever change, and re-run the whole board — never mix versions on one board.

## Files

- `INSTALL.md` — installing the skill and pointing Claude Code at it.
- `README.md` — connecting the Scenario MCP server, local dependencies.
- `references/mcp-path.md` — exact tool calls, model IDs, parameters, gotchas. Read before first use.
- `setup.sh` — creates the skill-local `.venv` and installs dependencies into it.
- `scripts/normalize_tile.py` — the normalization and verification pass. Auto-selects the skill venv. Tested.
- `assets/base-tile.png` — the fixed slab, passed as `referenceImages[0]` on every tile. See `assets/README.md`.
- `board.example.json` — manifest shape for a full board.
