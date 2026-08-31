---
name: estate-art
description: Generate the Status Estate — the open dollhouse at the centre of the Harbour Heights board — as game-ready GLB, using Scenario (scenario.com). Six tiers, one per status band, and optionally a different building per LEVEL inside a band. Use this whenever the user asks for an estate, a status house, a new tier or level of the estate, wants the estate to change more between levels, mentions assets/estate, estate.js, ESTATE_TIERS, tier1-lv2.glb, estate3d.js, or the fog/promotion beat over the board's centre. Also use when they describe an upgrade to the house at the middle of the board ("give level 3 a new floor", "make the villa"). Do NOT use for the 40 tiles on the ring — that is board-tile-art — or for the island and props around the board, which is board-env-art.
---

# Estate Art

Produces the building at the middle of the board: an **open dollhouse** — no roof, near walls
removed — that upgrades with the player's Status level. Same generator path as `board-tile-art`,
a different composition and a different contract.

The engine is [`js/ui/estate3d.js`](../../js/ui/estate3d.js); the manifest is
[`assets/estate/estate.js`](../../assets/estate/estate.js); the reasoning behind both is
[`assets/estate/README.md`](../../assets/estate/README.md). **Read that README before generating
anything.** Everything here assumes it.

## Two different jobs, and they need different prompts

|  | A TIER | A LEVEL inside a tier |
|---|---|---|
| What it is | a different building — bedsit → flat → townhouse | the same room, one thing better |
| How often | six, one per status band, five levels apart | up to four per band, optional |
| Generated from | that tier's existing painting in `items/` | **the previous level's image** |
| Registered as | `model:` on the tier | `levels: { 3: "..." }` on the tier |
| The beat it gets | fog + shrink + burst + ring + embers | fog + shrink |

Getting these the wrong way round is the main way to waste a day. A tier prompt that says "keep
everything" produces six near-identical houses; a level prompt that does not say it produces five
unrelated ones.

## Step 0: connection and team

Confirm the Scenario MCP tools are available, then `teams_list` once per session — OAuth callers
must pass `team_id` and `project_id` on every generation call. Exact calls and pinned model IDs
are in [references/mcp-path.md](references/mcp-path.md). Read it before the first generation.

## Step 1: the reference image

**Never generate the estate from scratch.** Every tier already has a painting in
`assets/estate/items/tierN.webp` — an isolated three-quarter diorama of that building on its own
plot. That is the right composition, the right style and the right identity already. The job is to
edit it, not to replace it.

### For a TIER: take the roof off

`model_google-gemini-3-1-flash`, the tier's art as `referenceImages`, `aspectRatio: "3:4"`,
`resolution: "2K"`, `thinkingLevel: "HIGH"`, `numOutputs: 2`.

The prompt has to be blunt about geometry — the model will happily leave a roof on if you only
imply it. In this order:

1. Rebuild it as an **open dollhouse cutaway**.
2. Take the roof **completely** off.
3. Remove the **two walls that face the viewer**.
4. Keep only the two BACK walls, meeting at the far corner.
5. **Name the palette and the props to keep, item by item.** A tier is recognisable by a handful
   of landmarks — the yellow door and blue balcony, the copper cupola, the olive trees in their
   planters. "Keep the style" loses all of them.
6. Furnish the exposed interior, and say **what to leave uncluttered**.
7. Keep the isometric three-quarter view, centred, fully in frame.
8. Isolate it: "alone in empty space on a plain flat dark navy background, no ground plane,
   nothing around or underneath it".
9. End with the constraint restated flat: **no roof, no ceilings, no front walls, open to the sky**.

Where a tier already has a roof terrace, ask for it to **survive as the open top floor** rather
than being removed with the roof.

### For a LEVEL: change one thing, and make it clash

This is where the interesting rules are, and they were all learnt the expensive way.

**Generate from the PREVIOUS LEVEL's image, never from the tier's.** That is what makes the
improvements accumulate: the bed is still there at 5, under walls painted at 4, on boards laid at
3. Generating each from the tier gives four alternatives to level 1 instead of four steps away
from it.

**Contrast is what makes a step legible, not size.** The estate renders about 200 px wide. The
first attempt at level 2 politely upgraded a shabby bed to a tidier bed and read as *nothing at
all* — two brown objects became two slightly different brown objects. What worked was making the
bed conspicuously, almost comically NEW against a room left exactly as decayed: pale timber, crisp
white sheets, and a **saturated blue blanket**, the only saturated colour in the tier. Colour
survives being 200 px wide; craftsmanship does not.

**Do not improve the room. Put something new IN the room and leave the room alone.** The bad fit is
the message — this is somebody's first upgrade, not a refurbishment. Say so explicitly:
*"Do not tidy the room. Do not repaint the walls. Do not clean the floor. The room must stay a
wreck so the new bed stands out."* Asked to lay a new floor, the model will cheerfully repaint the
walls too, and two rungs of the ladder are spent at once.

**The prompt is mostly a list of things NOT to change**, in three parts:

1. Everything that stays: same building, same cutaway, same walls, same window, same staircase,
   same plot, same camera, same framing, same lighting, same style, same background.
2. **Everything the room has already gained**, named individually, and that it stays. "This room
   accumulates improvements and never loses one."
3. The single thing that moves — and then, again, that the rest stays a wreck.

A worked arc, the bedsit's, which is a story rather than five variations:

| level | the one change |
|---|---|
| 1 | a wreck |
| 2 | a conspicuously new bed — white sheets, blue blanket — in a room still ruined |
| 3 | the upper floor reboarded in clean gold, and a red rug on it |
| 4 | the upper walls stripped and painted sage, white skirting, white window frame |
| 5 | the shop below replastered and tidied, plants in, and the fire escape mended |

Furniture → floor → walls → structure. Each step is a larger area than the last, so the tier
builds rather than plateaus.

### Choosing between the two variants

Prefer the one with the **lower walls and the more open floor**: it occludes less at 38°, it
reconstructs better, and it leaves more room for whatever ends up standing in it. Reject anything
that closed itself back up. A door is four pixels at board scale and a room is not.

## Step 2: cut out the background

`model_photoroom-background-removal`, `hdBackgroundRemoval: true`, **`shadowMode: ""`**. The empty
shadow mode is deliberate: a baked contact shadow comes back as geometry, and the engine lights and
shadows the piece again.

**Look for gaps before converting.** Anything detached in the image becomes an island of pixels and
then a thing floating in mid-air — and if it is the lowest point of the mesh it lifts the whole
estate off the board. The villa's yacht sat in open water beside its jetty; the fix was one more
editing pass moving it into a carved harbour touching the rock, "so the whole thing is ONE
connected solid object". Cheap to close in 2D, impossible afterwards.

## Step 3: image → 3D

`model_tripo-p1-image-to-3d`, `faceLimit: 12000`, `pbr: false`, `texture: true`,
`textureQuality: "detailed"`, `textureAlignment: "original_image"`, `orientation: "align_image"`,
`enableImageAutofix: true`, `autoSize: false`. Two to three minutes, so expect `in-progress` and
follow with `jobs_wait`.

`pbr: false` matters — PBR emits separate map sets and ignores the texture parameters entirely.
The face limit is higher than a closed building needs because a cutaway spends its triangles on an
interior; at the tile budget the rooms come back as a smooth shell.

**A cutaway is a harder reconstruction than a box, and it shows.** Floors bow slightly and small
props go soft. At board scale that reads as clutter in a room, which is what it is meant to be.

## Step 4: install and register

Download as `glb` into `assets/estate/models/`:

- a tier → `tierN.glb`
- a level → `tierN-lvL.glb`

Then in `assets/estate/estate.js`:

```js
{ at: 1, name: "The bedsit", art: "assets/estate/items/tier1.webp",
  model: "assets/estate/models/tier1.glb",
  levels: { 2: "assets/estate/models/tier1-lv2.glb",
            3: "assets/estate/models/tier1-lv3.glb" },
  blurb: "..." },
```

`levels` is optional per tier and per level. A tier with none behaves exactly as it did.

Two more optional fields, both there because a generated mesh is not a drawing you can redraw:
`yaw` (extra turn in radians) and `scale` (a multiplier on the tier's height). Neither is a code
change.

## Step 5: look at it — twice, with two different tools

**Facing first.** [`tools/estate-preview.html`](../../tools/estate-preview.html) renders one mesh
at eight yaws under the game's own camera and lights. An open estate turned the wrong way is two
blank walls, so this is load-bearing rather than optional, and it is not derivable — image-to-3D
returns each mesh in the frame of its own reference. All six shipped tiers landed on the same
angle, which is why `MODEL_YAW` has a default; that is not a guarantee about the seventh.

**Then the progression.** [`tools/estate-levels.html`](../../tools/estate-levels.html) steps the
Status track with + and − across all 30 levels and draws the estate exactly as the board does, fog
included. It names the file it is drawing, so "did the building actually change" is answerable at
a glance. Step 1 → 5 and check the arc reads as one story.

Both need the server: `python3 serve.py`, then `localhost:8125/tools/…`. Note that with several
worktrees on this repo, **a 404 on a file you know exists usually means the checkout being served
is behind**, not that the file is broken.

## What this pipeline does NOT give you

**Structural drift.** Each file is an independent reconstruction, so two levels of one tier differ
slightly *everywhere*, not only in the thing you asked for. Measured across the bedsit's five, the
footprint runs 0.835, 0.860, 0.922, 0.854, 0.906 — up to 10% off, and not monotonic. The fog hides
it in play, since the two are never on screen together; it is plain in the tool.

If this is ever rebuilt, the fix is **per-level props on a fixed room**: one building per tier, and
each level drops in or swaps a small object. No drift by construction, ~100 KB per asset instead of
1.7 MB, and it composes. It needs a prop list with positions in the manifest and a little engine
work. It was not done because per-level buildings were chosen with the trade-off understood.

**Weight.** A file is 1.6–2.4 MB, almost all of it one baked 4096² texture — about 89 MB of video
memory once decoded. `Estate3D._sweep()` evicts everything but the drawn tier, the current one and
the pre-fetched next, so runtime memory is fine; the repository still grows. Tier 1 with all five
levels is 9.8 MB.

## Model ids are pinned

Swapping one mid-set changes the look of the set. If one is retired, `recommend` finds a
replacement — treat that as a style version bump and re-run the whole estate, not one tier of it.
