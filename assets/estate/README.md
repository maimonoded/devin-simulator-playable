# The Status Estate

Six tiers of one building, from a bedsit over a chip shop to a clifftop villa with a helipad.

GDD §3.5 puts an **estate at the centre of the board** that upgrades visually with Status level —
the passive-progress anchor that makes Status visible while you roll, the way builder landmarks
used to be. `estate.js` is the manifest; the engine is
[`js/ui/estate3d.js`](../../js/ui/estate3d.js).

## One tier per band

There are six tiers and six named status bands (`STATUS_RANKS` in
[`../status/status.js`](../status/README.md)), five levels apart. That pairing is deliberate:
reaching a new band is the moment your **title** changes *and* the moment the **house** changes,
which is one beat instead of two. The engine derives the tier from the level rather than storing
it, so re-cutting the bands re-cuts the estate for free — and `Estate3D.validate()` is written to
refuse a tier that opens where no band does. Note that it is the one validator in the project
nothing calls: it is a module export and the boot-time sweep in `js/ui/main.js` is a classic
script, which cannot see it. See [TODO.md](../../TODO.md).

## An OPEN estate

**No roof, and the two walls nearest the camera taken away.** The estate is a dollhouse cutaway:
you look down into the rooms and see the floors, the walls behind them and everything standing on
them. It is not a model of a building's outside.

Three reasons, in the order they matter:

1. **The camera is already looking down at it.** At 38° elevation over a board whose middle is
   otherwise empty, a closed building presents its roof and two blank walls. An open one presents
   its contents, which is the half worth looking at.
2. **A collection game's centrepiece should show the collection.** The floors are display
   surfaces. Nothing stands on them yet, but the room is the reason there will be somewhere to
   put a Collectible when that work happens — an estate you can see into is a shelf; a closed
   house is a prop.
3. **The upgrade is legible.** Six tiers of exterior differ in silhouette, which is a thing you
   have to remember to compare. Six tiers of interior differ in what is *in* them, which is a
   thing you notice.

## How it is drawn

**A model, and a sign.** A tier that has a `model` gets a GLB standing on the board, the way a
tile's model does; the plaque that used to be welded under the painting stands beside it on its
own upright plane, a sign planted at the front of the plot.

That is a change of kind, not of dressing. The estate began as a painting — the tier's art inside
a gilt frame — which is a picture *of* the place. §3.5 asks for the place. A board whose
centrepiece is a framed poster while forty tiles around it are real geometry reads as exactly
that: a poster propped up in the middle of the game.

**The painting is still here, as the fallback.** A tier with no model yet, a file that 404s, a
GLTFLoader that fails — all land back on the framed picture, which is the same art the album and
the profile use anyway. Nothing has to be migrated in one go, which is the point: the six tiers
are modelled one at a time, and a half-modelled set is a working set.

What stays a painted canvas either way is the **plaque** — the band icon, the tier's name, the
level, the pips and the level bar. It is the only Status readout on the board and the one thing
here that moves every few rolls, so it is drawn by the same code in both paths and cannot drift
into looking like two different objects.

### The sign is an upright plane, not a sprite

A sprite — or any camera-facing quad — has one depth for the whole quad, so a die landing in
front of the estate's feet would be measured against its middle and vanish behind the whole
thing. See CLAUDE.md, "Nothing on the board fades or hides". The model needs none of that care:
it is solid, so it occludes and is occluded on its own terms.

### Seeing it without playing to level 30

[`tools/estate-levels.html`](../../tools/estate-levels.html) steps the Status track with **+** and
**−** (or the arrow keys) and draws the estate exactly as the board draws it — every level from 1
to 30, the fog included wherever it fires.

It is not a mock-up: it imports the shipped `js/ui/estate3d.js` and loads the real `ESTATE_TIERS`,
`Status` and `Economy` curve under a camera and light rig copied from `js/ui/board3d.js`. So the
building, its fit, its lamp, its plaque and its cloud are the ones the game renders, and the tool
cannot drift away from them the way a second implementation would. The only stubs are the parts of
`Status` that reach into a run it does not have — `Cards.statusPoints()` is the dial the buttons
turn, so a level can be set to an exact points total.

The readout says which step of which band you are on and what the lamp is at, because most steps
change the LIGHT and not the house: six buildings cover thirty levels, and without a number on it
"nothing happened" and "the lamp went from 0.94 to 1.43" look the same.

    python3 serve.py
    http://localhost:8125/tools/estate-levels.html
    http://localhost:8125/tools/estate-levels.html?lv=20&fog=6000

Note the `<base href="../">` at the top of that file, which is load-bearing rather than tidy:
`Estate3D` fetches its models by document-relative path because it was written for `index.html` at
the root, and from `/tools/` those resolve to `/tools/assets/...` and 404 — leaving an empty gilt
frame that reads as a rendering bug rather than a path one.

### Changing tier: weather, not a cut

A promotion swaps one building for another in the middle of the board, and swapping it in place
is a **cut** — one frame a bedsit, the next a townhouse, while the player is reading a status
ribbon somewhere else. It reads as an asset popping in, which is what it is.

So a cloud rolls over the plot, the building is exchanged where the cloud is thickest, and it
clears: `cfg.estateFogMs` end to end, `cfg.estateFog` to switch it off. Nothing waits on it —
it plays behind the status ribbon, and what it hides was banked in `state` long before.

Three things about it are load-bearing:

- **It obeys the depth rules.** The puffs are not drawn over the scene with depth testing off,
  which would put fog over a die that landed in *front* of the estate. They are moved bodily
  toward the camera along the view axis — the same trick `_packAnchor()` plays with a box — so
  they cover the building behind them while anything nearer still draws in front, for free.
- **The phase is read off the clock**, not accumulated from frames. A throttled tab would
  otherwise crawl the cloud at a fraction of its speed and still be thickening long after the
  swap. Read from the clock, a sparse frame lands at the right density and a tab that never
  renders shows nothing and loses nothing — the swap and the clean-up are on timers either way.
- **A promotion waits for its house.** The new tier's model is almost never in hand on the frame
  the level ticks over. Rather than show the painting for a moment and then pop the building in
  — two changes where there should be one — the estate holds still until the file lands, and the
  tier turns over in a single beat. The tier after the current one is fetched a level early, so
  that hold is usually imperceptible.

### The lights come on

The estate has to change a little every level and a lot every fifth, and only six pieces of art
exist for thirty levels — so the per-level difference is something the engine does to the asset
it already has. On the painting that was a golden soft-light wash. On the model it is an actual
warm point light, ramping across the tier, plus a touch of emissive.

**The lamp stands inside the open box**, at about the height of the floor between the storeys.
That placement is what makes it safe to be bright: what it lights is the rooms, which are in
shadow from every direction the scene's own lights come from, and it barely reaches the outer
walls. An earlier pass, on a closed building, put the same light outside and ran it up to the
scene's key — it floodlit the front and took the teal straight out of the walls.

## The files

| | |
|---|---|
| `models/tier1.glb` … `tier6.glb` | the estate itself. **All six ship** |
| `items/tier1.webp` … `tier6.webp` | the painting — what a tier falls back to |

Paintings are portrait, 384×512, ~30 KB each. Meshes run 1.6–2.4 MB and 9.9k–10.9k triangles,
almost all of it the baked texture. Both were generated with Scenario.

**A tier is let go once nothing is borrowing it.** Each mesh carries one 4096² baked texture —
about 2 MB on disk and about **89 MB** once the GPU has decoded it and built its mips. Six of
those is 15 MB of repository and roughly **537 MB of video memory**, and a Season walks the player
through all six, so a cache that simply kept everything it had loaded was fine on a desktop and a
crash on a phone — and invisible to any check that looks at file sizes. `Estate3D._sweep()` keeps
what is drawn, the tier the player is on, and the one being pre-fetched, and disposes the rest;
re-reaching an evicted tier re-fetches it. Two or three resident instead of six.

Why it is not simply "dispose the old one": the cached scene is what every clone is made from, and
three.js shares geometry across `clone()` while a cloned material shares its `.map`. The source
owns the two expensive things and the building on the board is borrowing them. `_swap()` therefore
disposes a clone's *materials* and nothing else, and `_sweep()` always keeps whatever the body was
built from — which is what makes it safe during the two windows where the level and the drawn
house disagree, the fog and the load hold.

The paintings stay now that every tier is modelled, and they are not dead weight: they are what
the board shows if a GLB fails to load, which turns a broken file into a picture rather than an
empty middle. Keep each one a picture of the estate its model shows.

### What a model should contain

| | |
|---|---|
| Format | `.glb`, single file, texture embedded |
| Budget | ≤ 8000 triangles — one hero object, not one of forty tiles |
| Footprint | any — fitted to the view's height AND ground span on load |
| Up axis | +Y (glTF mandates it) |
| Origin | anywhere — re-centred and rested on the board on load |
| Materials | one baked texture (not PBR map sets) |

The engine normalizes on import exactly as the tile loader does, so an export at any scale or
origin drops in. It fits the mesh inside **both** a height and a ground span and takes whichever
bound it hits first — a rule the open estate forced and the villa would have forced anyway.
Scaling by height alone works only while every tier is the same shape, and taking the roof off
turned a tall narrow house into a wide shallow box: by height, its floor would have filled the
ring. It also means the file is used **as exported** — do not round-trip it through
`tools/normalize-env.py` or the tile skill's `normalize_tile.py`, both of which drop the baked
texture.

### Facing is the one number always worth checking

An open estate turned the wrong way is two blank walls. That makes `MODEL_YAW` load-bearing in a
way it would not be for a closed building, where a bad angle only costs you the nice side.

It is also not derivable. These are image-to-3D meshes, and the generator returns each in the
frame of its own reference image — near enough the same frame every time, since every tier comes
off the same pipeline, but never exactly. All four shipped tiers landed on the same angle and
none of them needs a `yaw` of its own, which is the case for having a default at all; it is not
a guarantee about the fifth. So the shipped default is the angle that fits the shipped set,
**found by looking**:
[`tools/estate-preview.html`](../../tools/estate-preview.html) renders a mesh at eight yaws under
this same camera and answers it in one screenshot. A tier that lands somewhere else corrects
itself with `yaw` and needs no code change.

### Two optional numbers, in `estate.js` rather than in code

- **`yaw`** — extra turn in radians, for a tier whose reference was drawn at another angle.
- **`scale`** — multiplier on the tier's height. A villa is not a bedsit's size.

Neither is a code change, which is the point.

## How a tier is made

The pipeline that produced `models/tier1.glb`, and the reason the other five are cheap: **the art
in `items/` is already most of the reference image.** Each one is an isolated three-quarter
diorama of that tier's building on its own plot against a flat ground — the right composition,
the right style, the right identity. What it is not is *open*. So a tier is one edit and one
conversion, and the mesh cannot drift away from the building the tier is supposed to be.

Via the Scenario MCP (`team_id` and `project_id` are required on every call):

1. **Upload** `items/tierN.webp` — converted to PNG first, uploaded as an image asset.

   Tier 1 had an upscale pass here (`model_upscale-v3`, `upscaleFactor: 4`,
   `style: "3d-rendered"`, `preset: "precise"`). Tiers 2–4 skipped it and are no worse, which
   settles the question: step 2 outputs at 2K regardless, so the upscale only mattered back when
   step 2 was a straight conversion of the 384×512 original. **Skip it.**

2. **Take the roof off** — `model_google-gemini-3-1-flash`, the tier's art as `referenceImages`,
   `aspectRatio: "3:4"`, `resolution: "2K"`, `thinkingLevel: "HIGH"`, `numOutputs: 2`. An
   *editing* step rather than a fresh generation, deliberately: the tier already has a look and a
   palette and a plot, and re-rolling it from text would lose all three.

   The prompt has to be blunt about the geometry — the model will happily leave a roof on if you
   only imply it. What worked, in this order: rebuild it as an **open dollhouse cutaway**; take
   the roof completely off; remove the **two walls that face the viewer**; keep only the two BACK
   walls, meeting at the far corner; name the palette and the props to keep; furnish the exposed
   interior and say **what to leave uncluttered**; keep the isometric three-quarter view; isolate
   it "alone in empty space on a plain flat dark navy background, no ground plane, nothing around
   or underneath"; and end with the constraint restated flat — **no roof, no ceilings, no front
   walls, open to the sky**.

   Generate two and look at both. Prefer the one with the **lower walls and the more open floor**:
   it occludes less at 38°, it reconstructs better in step 4, and it leaves more room for whatever
   ends up standing in it. Reject anything that closed itself back up. (Tier 3's two variants are
   the illustration — one kept the front wall and its handsome brass door, the other opened the
   shop floor. The open one won: a door is four pixels at board scale and a room is not.)

   **Name what to keep, item by item.** The prompts that worked list the palette and then the
   specific props — the yellow door and the blue balcony, the copper cupola, the olive trees in
   their planters. A tier is recognisable by its handful of landmarks, and a prompt that only
   says "keep the style" loses them. Where a tier already had a roof terrace, ask for it to
   survive **as the open top floor** rather than being removed with the roof.

3. **Cut out** — `model_photoroom-background-removal`, `hdBackgroundRemoval: true`,
   `shadowMode: ""`. The empty shadow mode is deliberate: a baked contact shadow comes back as
   geometry, and the engine lights and shadows the piece again.

4. **Image → 3D** — `model_tripo-p1-image-to-3d`, `faceLimit: 12000`, `pbr: false`,
   `texture: true`, `textureQuality: "detailed"`, `textureAlignment: "original_image"`,
   `orientation: "align_image"`, `enableImageAutofix: true`, `autoSize: false`. Takes 2–3 minutes,
   so expect `in-progress` and follow with `jobs_wait`.

   `pbr: false` matters — PBR emits separate map sets and ignores the texture parameters
   entirely. The face limit is higher than a closed building needs because a cutaway spends its
   triangles on an interior: at the tile budget the rooms come back as a smooth shell.

   **A cutaway is a harder reconstruction than a box, and it shows.** Floors bow slightly and
   small props go soft. At the size this renders on the board that reads as clutter in a room,
   which is what it is meant to be — but it is the reason to prefer the more open of the two
   references rather than the prettier one.

5. **Download** as `glb` into `models/tierN.glb`, add `model:` to the tier in `estate.js`, and
   look at it — [`tools/estate-preview.html`](../../tools/estate-preview.html) renders it at eight
   yaws under the game's own camera and lights, so the turn is picked from one screenshot instead
   of one reload per guess. `yaw` and `scale` are there for what looking at it tells you.

6. **Refresh the painting.** The fallback should be a picture of the estate the model shows, not
   of the closed building the tier used to be — so step 2's chosen image, scaled to 384×512, is
   the new `items/tierN.webp`. `sips` on macOS cannot write WebP; `sips -z 512 384` to resize and
   `cwebp -q 82` to encode.

### Two things the top tiers taught

**Water has to be named as the thing to remove.** The villa is a clifftop island in an ocean, and
the isolation clause has to say *no sea, no water around it, the rock simply ends* — while
exempting the swimming pools, which are the point of the tier. "Isolated on a plain background"
alone leaves the ocean in, and an ocean reconstructs as a flat blue slab the estate sits on.

**Anything detached comes back floating.** The villa's yacht sat in open water beside the jetty,
so the cutout left it as an island of pixels with a gap — and image-to-3D would have hung it in
mid-air under the estate, where it would have become the model's lowest point and lifted the
whole island off the board. The fix was one more editing pass on the chosen image: *move the
yacht into a carved harbour at the foot of the jetty, touching the rock, so the whole thing is
one connected solid object.* Look for gaps before converting; they are cheap to close in 2D and
impossible afterwards.

Model ids are pinned on purpose. Swapping one mid-set changes the look of the set.
