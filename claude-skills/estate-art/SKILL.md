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

**Then decide your pace, before the first call rather than after the fortieth.** An asset costs
three model calls, and the account rate-limits on *burst*: forty calls inside ninety minutes earned
`429`s with cooldowns of eight to twelve minutes, which is slower than not hurrying would have been.
A run of more than a dozen assets should spread its calls rather than fire them as fast as they
return. Two things worth not guessing at: buying credits does not lift this (an exhausted balance is
a payment error, a rate limit is a `429` with a retry-after), and this pipeline reaches the limit on
its own with nothing else running, so do not wait on another workload to clear. Detail in
[references/mcp-path.md](references/mcp-path.md).

## Step 1: the reference image

**Never generate the estate from scratch.** Every tier already has a painting in
`assets/estate/items/tierN.webp` — an isolated three-quarter diorama of that building on its own
plot. That is the right composition, the right style and the right identity already. The job is to
edit it, not to replace it.

### A wide plot is drawn short, and the villa already pays for it

`_buildModel()` fits the mesh inside **two** budgets and takes whichever runs out first —
`min(3.15 / height, 3.90 / footprint)` — so a building reaches its full height only while its
footprint stays under about **1.24×** it. Past that the span binds, the whole model is scaled down
until it fits, and every extra metre of plot is paid for out of the roofline. Nothing warns you:
the file loads, the mesh is clean, the tool draws it, and the house is simply smaller than the one
before it.

**Which bound binds splits the six tiers in two, and that is the whole of it.** Tiers 1 to 5 are
rooms and buildings: they stand at 3.15 at every level, height-bound, with span to spare. Tier 6 is
a clifftop island and is span-bound before a single level step — the bare cutaway draws at
**2.295**, twenty-seven percent short — and levels 29 and 30 take it to 1.89 and **1.78**. So the
villa is at its smallest on screen at the Season gate, the one place the track is meant to peak.

Note where the loss actually is, because it is not where you would guess. Level 27 furnishes the
interior and draws *taller* than the base at 2.513; level 28 adds the formal gardens and is taller
too. **The tier's own cutaway is the bigger lever**, and the last two rungs finished the job. A
band inherits its proportion from the cutaway it was grown from, so a wide tier is five short
houses rather than one.

**The rule is therefore a constraint on the SUBJECT.** A room cannot sprawl — a sofa, a floor, a
wall colour add the area of the change and not a millimetre of plot, which is why furniture → floor
→ walls → structure ran five tiers without anyone discovering there was a second budget. A plot can
only sprawl, because everything a villa is recognisable by sits on the ground. Decide which of the
two you are prompting for before you write the prompt; nothing else in this file will ask you.

For a plot, say what may not grow, in the prompt, in about these words: *"the island stays exactly
the size it is, do not extend the grounds, do not add land or terraces"*. Reach for a storey, a
tower, a belvedere, a cupola, a raised deck, a terrace over what is already there. Avoid a second
building, a wing, gardens spread across the plot, a longer jetty, another moored boat — and
especially anything phrased **"on the far side"**, which is an instruction to put the new mass as
far from the house as the plot allows.

**Do not try to measure 1.24 in the reference image.** It is a mesh number, taken *after* the
engine turns the model 45°, and image-to-3D returns each plan in the frame of its own reference —
so the same building can land either side of the line by as much as a factor of √2 depending only
on how it happened to arrive. In the 3:4 image the limit looks like *a subject no wider than it is
tall*: the projection stretches the plot sideways and foreshortens the height, so a reference that
measures 1.24 on the page is already far over. Aim well inside it, and get the real number at
Step 5.

**What it is worth.** Under about 1.3 the loss is a couple of percent and not worth a retry — the
apartment's cutaway sits at 1.247 and gives up 0.7%, which is why 25 of the 30 levels can be called
clean. Past about 1.6 you are giving up a quarter of the roofline, and that is a re-edit of the
reference rather than another conversion: **a conversion cannot change the proportion of the thing
it is converting.**

**And the budget is not slack to be reclaimed.** A tier's `scale` multiplies *both* bounds, so on a
span-bound model it does raise the house — by spilling the footprint past 3.90 in the same
proportion, which is precisely what `span` exists to stop. The comment above `MODEL` in
`js/ui/estate3d.js` says why, and names this tier while doing it: `span` is what keeps a wide one
from swallowing the ring the game is played on. `scale` cannot fix a proportion. It can only draw a
wrong one larger.

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
7. Keep the isometric three-quarter view, centred, fully in frame — and **compact**: taller than
   it is wide, the plot no larger than the building standing on it. The cutaway sets the
   proportion for all five of the band's levels.
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

**Choose that colour by looking at the tier, never in advance.** A colour named in a plan written
away from the reference is a coin flip. A plan asked for a *terracotta* sofa in the flat, and
terracotta is exactly the colour of that tier's existing floor tiles and splashback — the axis with
its contrast removed; emerald went in instead, the only saturated colour the tier did not own. The
same trap in the apartment, worse: the plan asked for "pale stone floors" and "a large pale
sectional" in a building already entirely pale stone and pale sectionals. Burnt orange, honey oak
and charcoal went in instead, and the charcoal fireplace wall — the first dark mass that tier had
ever had — was the strongest single step of that run. Read the plan's AXIS, then open the reference
and see what the tier has already spent, then choose.

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
3. The single thing that moves — and then, again, that the rest stays a wreck. Where the subject
   is a plot rather than a room, add that the ground does not grow: same island, same terraces,
   same footprint, the new thing fitted onto what is already there.

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

**Know what the shape costs, though.** Those rungs are also, in that order, increasingly
**exposed**: furniture and floors are interior and half-hidden, structure is exterior and
unmissable. So a band's most reliable and most legible step is always its last, and its most
fragile are the two the player meets first. Budget retries accordingly — the first two rungs need
them and the last two do not. If the shape is ever revisited, consider opening a band with
something that touches the outline instead.

### WHERE the change goes decides whether it survives

This is the rule that cost the most to find, it is not intuitive, and it belongs beside the
contrast rule rather than below it: **put the one change where the camera can see it, not where it
belongs.**

The reference image is a 2D cutaway and shows the whole interior unobstructed. The mesh is not. A
first-floor slab overhangs the ground floor, so an object placed sensibly — a sofa against the back
wall, where a person would actually put one — sits in a pocket the 38° camera barely sees, and
image-to-3D has almost no information about it. The flat's level 7 sofa was lost three times from
that one position: once as a teal smear with a grey shard through the room, once as a deformed
building with a blue spike across the terrace, and once as a clean building with **the sofa simply
absent**. Moving it to the open front edge of the floor, clear of the overhang, and saying so in
the prompt, fixed it on the next conversion.

**Exposure decides reliability, not size and not colour.** Ranked, from what has been observed
across three tiers:

| where the change is | how it converts |
|---|---|
| above the roofline, breaking the silhouette | every time |
| the open front edge of a floor | usually |
| back walls, and the slab under an overhang | this is where changes quietly disappear |

Budget a second conversion for anything in that last row, and say "hard against the open cutaway
edge" in the prompt for every interior change. The townhouse is four storeys of enclosed rooms and
three of its four steps are interior; stating the placement explicitly in every prompt is what made
12, 13 and 14 read at all.

### The loudest step in a band is the one that sticks out of the building

Observed twice, so treat it as a rule rather than a coincidence. The flat's band is carried by the
level 10 **pergola**; the townhouse's by the level 15 **awning and signwriting**. Both project from
the building, so nothing occludes them from any angle, and both change the **silhouette** rather
than the contents — which is what actually reads when the estate is 200 px wide.

So when a band needs one step to land, spend it on something that breaks the outline. And this is
a second reason the arc ends on *structure*: it is the rung most likely to survive, so it is the
right one to finish on.

**Which direction is free depends on which bound is binding**, and the two are exact opposites —
so "break the outline" is right in both regimes and means different things in each. On a
height-bound tier the model is already scaled to 3.15, so a new storey buys nothing and costs
everything: raising the mesh only makes the fit shrink it, and the hero object you spent the level
on gets smaller. Sideways is the free direction there, which is why a pergola and an awning are the
two loudest steps in the file. On a span-bound tier it inverts — sideways is the direction already
costing the roofline, and the same job has to be done with a storey, a tower or a terrace over what
is already there. Know which one you are on before choosing the rung. Step 5 tells you.

### Two failures that look alike and are not

- **Dimensional drift** — the footprint wandering a few percent between levels. Expected, not
  fixable with this pipeline, not worth a retry. See the foot of this file.
- **A change vanishing entirely** — the building converts cleanly and the thing you asked for is
  simply not there. This is a *failure*, it is worth a retry every time, and it is the one that
  looks like success: nothing is malformed, the mesh is clean, and only comparing it against the
  previous level shows that nothing happened.

Do not let the first excuse the second. **Check every asset against the level before it in
`tools/estate-levels.html` before committing** — a lost change is invisible in a diff and invisible
in the mesh on its own.

### Choosing between the two variants

**Do not use "lower walls and a more open floor" to choose.** That was this skill's rule and it is
useless within a band: across seven pairs the two variants never differed meaningfully that way,
because they are edits of one reference and the architecture is fixed. It discriminates when
choosing a TIER's cutaway, where the composition really is in play. Not here.

What the variants actually differ in, every time, is two things:

- **Whether one silently deleted something it was told to keep.** One removed the plain wicker sofa
  that was there to be clashed against; one dropped a crimson carpet and kept only the parquet; one
  applied a new wall colour to the wrong floor.
- **Where it put the new thing** — and by the rule above, that decides whether it survives at all.

So the selection rule is: **take the variant that kept everything and put the change where it can
be seen.**

The same judgement applies to the two **conversions**, and it is not the same question. Take the
mesh where the ONE CHANGE is crisp, even if another sample is better everywhere else: a warmer
floor with mangled sofa cushions is the worse asset when the sofa is the whole point of the level.
And a softer complete mesh beats a sharper one that has lost something — the flat's level 9 was
kept as its first sample for exactly that reason, after a retry came back with the kitchen mush.

### Look at the reference at 200 px before you convert it

The edit comes back at 1792×2400 and everything reads beautifully in it. The estate renders about
**200 px wide**. Shrink the candidate to that and look: it takes seconds, costs nothing, and it is
the only check that answers the question the conversion is about to charge 105 CU to answer badly.
A sofa tucked under a first-floor slab is obviously invisible at 200 px and not at all obvious at
1792.

### Do a whole band's images first, then all its conversions

The image chain is strictly sequential — level 9's reference is level 8's image — and cheap, about
40 CU. The conversions are expensive and, once their images exist, independent. So: run all four
edits, look at all four at board scale, decide whether the band reads as one story, and only then
fire the conversions. It paces better against the rate limit, and gives you a chance to change your
mind about a step before paying for it.

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

**Then the height, because the eye cannot catch this one.** A sprawling estate is perfectly
legible — it is only small — so the 200 px check passes it, and the loss happens afterwards in the
fit. With the level on screen and the cloud finished, ask the scene:

```js
const THREE = await import("/vendor/three.module.js");
const s = new THREE.Box3().setFromObject(Estate3D._body, true).getSize(new THREE.Vector3());
({ file: Estate3D._bodyUrl, height: +s.y.toFixed(3), footprint: +Math.max(s.x, s.z).toFixed(3) });
```

`height` should read **3.15** — times the tier's `scale` if it sets one, and 2.60 instead with the
9:16 box ticked. Materially under it means the span bound is biting, and `footprint` will be pinned
at exactly **3.90**: level 3 answers `3.332 / 3.15`, level 30 answers `3.900 / 1.778`. The `true`
flag is load-bearing — without it you measure the box of a rotated box and read high. Measure after
the cloud has cleared rather than during it: the promotion collapses the body to 6% and springs it
back, so mid-beat every model reads small.

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
