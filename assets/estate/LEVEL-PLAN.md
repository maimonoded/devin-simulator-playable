# The rest of the estate — levels 7 to 30

A work plan for the twenty level assets that do not exist yet. It is written to be picked up cold
by somebody who has not been part of the conversation that produced tier 1, and worked through
unattended.

**Read [`claude-skills/estate-art/SKILL.md`](../../claude-skills/estate-art/SKILL.md) first.** It
has the pipeline, the pinned model ids and — more importantly — the half-dozen rules that are not
guessable and cost a re-roll each to discover. This file does not repeat them. It says *what* to
build; the skill says *how*, and the how is where the failures are.

## THIS PLAN IS BUILT. All thirty levels have a model.

Every asset this file asked for exists, is registered in `estate.js` and is on
`collectible_version`. Stepping 1 → 30 in [`tools/estate-levels.html`](../../tools/estate-levels.html)
draws **thirty distinct meshes** with no console errors and no 404s. Nothing below is outstanding
work; the plan is kept because the reasoning in it is what the next Season's estate should be
built from, and because the per-band notes record what each level actually contains.

**Read [`claude-skills/estate-art/FIELD-NOTES.md`](../../claude-skills/estate-art/FIELD-NOTES.md)
before building anything like this again.** It carries what the run learnt, including the rules
that were not in the skill when this plan was written and the places where this plan was wrong.

| tier | band | opens at | levels | built |
|---|---|---|---|---|
| 1 · The bedsit | 1–5 | `tier1.glb` | `tier1-lv2` … `lv5` | earlier |
| 2 · The flat | 6–10 | `tier2.glb` | 7, 8, 9, 10 | ✔ |
| 3 · The townhouse | 11–15 | `tier3.glb` | 12, 13, 14, 15 | ✔ |
| 4 · The apartment | 16–20 | `tier4.glb` | 17, 18, 19, 20 | ✔ |
| 5 · The penthouse | 21–25 | `tier5.glb` | 22, 23, 24, 25 | ✔ |
| 6 · The villa | 26–30 | `tier6.glb` | 27, 28, 29, 30 | ✔ |

Twenty files built in one run, from twenty-three image-to-3D conversions and roughly 3,700 CU.
Naming is `tierN-lvL.glb`, absolute level, e.g. `tier3-lv13.glb`.

**Two things in this plan turned out to be wrong**, both recorded in full in the field notes and
worth knowing before reusing it:

- **The contrast axes were right in all five bands; the named COLOURS were wrong in three.** Each
  time the plan named a colour the tier already owned — terracotta for the terracotta-floored
  flat, pale for the already-pale apartment, emerald for the teal-and-gold penthouse — which is
  the axis with its contrast subtracted. Built as plum, rust and emerald respectively. A plan
  should name the contrast and leave the colour to whoever is looking at the reference image.
- **"Drift is expected and not a bug to chase" is true of dimensional drift and false of a change
  vanishing.** Those are different failures. A footprint wandering a few percent is free; a level
  whose one change did not survive the conversion is a defect and is always worth a retry. Two
  levels needed exactly that.

The costing here was also optimistic — three calls per asset is the floor, not the expectation,
and a band runs 600–1300 CU depending on how much of it lands under a roof. The binding
constraint turned out to be neither credits nor conversion time but Scenario's rolling rate
limit; see the field notes and `references/mcp-path.md`.

## The shape every band follows

Four steps, each a larger area than the last, so a band builds rather than plateaus:

**furniture → floor → walls → structure.**

That is the tier 1 arc and it worked: a new bed, then new boards, then painted walls, then the
shop below mended and the fire escape repaired. Keep the shape and change what it means per tier.

**Each level is generated from the image of the level before it**, never from the tier's own
painting. That is the whole of what makes the improvements accumulate. Level 8's reference is
level 7's image; level 9's is level 8's. If a chain is broken you get five alternatives to the
tier instead of four steps away from it.

## The contrast is different in every band, and this is the part to get right

The skill's rule is that a step is legible because of **contrast, not size** — the estate renders
about 200 px wide, so the new thing has to look *wrong* next to the old. In tier 1 that was easy:
the room was a wreck, so anything new clashed. Higher up the building is already pleasant, and
"new against ruined" stops being available. What replaces it, per tier:

| tier | what it is | the contrast to play |
|---|---|---|
| 2 · The flat | pleasant but builder-basic | **chosen** against **standard-issue** |
| 3 · The townhouse | handsome but faded | **restored** against **shabby-genteel** |
| 4 · The apartment | new-built and sparse | **lived in** against **showroom-empty** |
| 5 · The penthouse | already glamorous | **one-off** against **expensive-but-ordinary** |
| 6 · The villa | already the top | **estate-scale** against **merely enormous** |

Colour still does the heavy lifting at 200 px. Tier 1's blue blanket carried level 2 because it
was the only saturated colour in the band. Give each band one or two colours it did not have
before and let those arrive with the new thing.

## What tiers 2 and 3 taught, which the remaining bands should use

Three findings came out of building the flat and the townhouse. They are in the skill in full;
here is what they mean for the bands still to do.

**Say where the change goes, in every prompt.** Not where the object belongs — where the camera
can see it. "Hard against the open cutaway edge, clear of the floor above" is the phrase. An
interior change tucked under an overhang is the one place image-to-3D reliably loses things, and
the townhouse only reads because all three of its interior steps were pushed to the open edge.

**The structure rung carries the band, so make it project.** The flat's pergola and the
townhouse's awning are the two loudest steps built so far, both because they stick out of the
building and change its silhouette rather than its contents. Each remaining band's last rung
already has something that projects — the apartment's canopy, the penthouse's cabana — so lean into
those rather than treating them as dressing. **The villa is the exception and its rung must project
upward**, not across the island: tier 6 is span-bound, so anything added on the ground is charged
to the roofline. See "A wide plot is drawn short" in the estate-art skill.

**Retry a vanished change; do not retry drift.** A clean mesh with the change simply absent is a
failure and worth another conversion every time. A footprint a few percent off is not. The first
looks like success, which is why every asset has to be stepped against the one before it in
`tools/estate-levels.html` before it is committed.

**Colours here are suggestions and several of them were wrong.** This file was written away from
the reference images, and a colour chosen that way is a coin flip: it asks for a terracotta sofa in
a tier whose floor tiles are already terracotta, and for "pale stone floors" and "a large pale
sectional" in a building that is entirely pale stone and pale sectionals. Both would have been the
contrast with its contrast removed. **Take the axis from this file and choose the colour after
looking at what the tier has already spent.**

## The twenty, by band

Each line is the ONE change for that level. Everything else in the prompt is a list of what stays,
including everything earlier levels added — see the skill.

### Tier 2 · The flat (7–10)
Cream Mediterranean waterside house: blue-tiled roof terrace with a plunge pool, yellow door, blue
balcony, olive tree, bicycle, jetty, moored boat. The flat of somebody doing alright.

- **7 · furniture** — the sitting room gets a proper suite: a deep sofa in a saturated terracotta,
  a low table, a good lamp. Replaces the plain table and chairs. *(briefed separately)*
- **8 · floor** — patterned encaustic tiles laid through the ground floor, in blue and white,
  replacing the plain boards. A large area and a strong pattern; this is the loudest step.
- **9 · walls and kitchen** — a real fitted kitchen along the back wall, tiled splashback, open
  shelves with crockery. Walls repainted clean white.
- **10 · structure** — the terrace done properly: a timber pergola with vines over it, real
  loungers, planting along the balustrade, and the little boat repainted and re-rigged.

### Tier 3 · The townhouse (12–15)
Red brick Victorian, forest-green shutters, teal bay windows, copper-domed cupola on the roof
terrace, a boutique on the ground floor, panelled room with a fireplace, brass bed above.
Handsome, and a bit down at heel.

- **12 · furniture** — a deep green leather chesterfield and a proper writing desk in the panelled
  room, replacing the mismatched armchairs. Books arrive.
- **13 · floor** — herringbone parquet laid and a large antique carpet over it, in deep reds.
- **14 · walls** — the panelling restored and painted, a picture wall of framed prints, proper
  brass wall lights instead of the bare bulb.
- **15 · structure** — the shopfront done properly: fresh teal paint, gilt lettering on the glass,
  a striped awning, the iron railings repainted black, the cupola reglazed.

### Tier 4 · The apartment (17–20)
White and glass, wrap-around terrace on every level, turquoise roof pool, olive trees in
planters, warm strip lighting. New-built and half empty.

- **17 · furniture** — a large pale sectional, a serious rug, a big piece of art on the back wall.
  The room stops echoing.
- **18 · floor and kitchen** — pale stone floors throughout and a marble island with stools,
  replacing the builder's kitchen.
- **19 · walls and light** — a stone feature wall with a long linear fireplace set into it, and
  proper architectural lighting.
- **20 · structure** — the terrace landscaped: an outdoor kitchen, a dining table under a canopy,
  mature planting all the way round, the pool surround rebuilt in stone.

### Tier 4 · a warning from the band already built

Tier 4 is mostly **glass**, and glass reconstructs as an opaque smear — the shipped `tier4.glb` has
it too, so it is the tier's established look rather than something the levels introduced. The
consequence: the apartment's interiors are not a usable place to put a change, and an interior
*prop* there is wasted work. All three built steps had to lean on a large element — a whole floor
finish, a whole wall — rather than an object. Level 17's mesh also dropped the turquoise pool, one
of the tier's landmarks; the retry lost the change instead, so the landmark was sacrificed. That is
the right call when forced — the step is why the file exists — but it is a real defect, recorded as
one rather than filed under drift.

### Tier 5 · The penthouse (22–25)
Art-deco teal and gold, long turquoise rooftop pool, cocktail bar with a neon arch, palms,
festoon lights, a grand piano below. Already glamorous — so the step has to be *specific* rather
than merely expensive.

- **22 · furniture** — a statement piece: a curved velvet banquette in deep emerald, and a real
  sculpture. Not more furniture; better furniture.
- **23 · floor** — inlaid terrazzo with a deco sunburst worked into it, in black, cream and brass.
- **24 · walls and ceiling** — fluted gold-leaf panelling and a chandelier over the piano.
- **25 · structure** — the roof deck extended: a cabana at one end, a sunken hot tub beside the
  pool, more neon, and the bar rebuilt in brass and onyx.

### Tier 6 · The villa (27–30)
A clifftop island: white villa with terracotta trim, cascading infinity pools, a helipad with a
helicopter, a domed rotunda, cypresses, a jetty with a yacht. The top of the track.

- **27 · furniture** — the great rooms furnished properly: a long dining table, a library that is
  actually full, four-posters, chandeliers throughout.
- **28 · grounds** — formal gardens across the terraces: clipped parterres, fountains, statuary,
  lit paths.
- **29 · structure** — a belvedere raised over the villa itself, glass and stone, with a roof
  terrace above the great room. **Upward, and not across the island.** As shipped this rung was
  built to an earlier wording — a guest pavilion on the far side — and `tier6-lv29.glb` is drawn
  at 1.89 of a 3.15 height budget as a result. Kept here as the correction, not as the record.
- **30 · the crown** — the Season gate, and it should feel like arriving. The whole island lit at
  night: every window warm, the pools lit from beneath, the paths and the rotunda picked out, a
  second larger yacht at the jetty. This is the only level allowed to change the light of the
  whole piece rather than one part of it.

## Working order

Band by band, in order, **2 → 3 → 4 → 5 → 6**, and within a band in level order. The chaining
requires it: level 9 cannot be made before level 8 exists.

Do not batch across bands to save time. The image-to-3D calls can overlap — fire several with
`wait=false` and pass the ids to one `jobs_wait` — but the *image* steps within a band are strictly
sequential.

## Per asset, the loop

1. Generate the edit from the previous level's image. Two variants; take the more open one.
2. Background removal, `shadowMode: ""`. Look for detached objects before converting.
3. Image → 3D. Download to `assets/estate/models/tierN-lvL.glb`.
4. Register in `assets/estate/estate.js` under that tier's `levels`.
5. Check facing in `tools/estate-preview.html` if anything looks turned; add `yaw` to the tier
   rather than changing code.
6. Step the band in `tools/estate-levels.html` and confirm the change reads and the file name in
   the readout is the new one.
7. `node tests/run.js` — 313/313.
8. Commit. One commit per band is right; per asset is noise.

## Ground rules

- **Branch is `collectible_version`.** Never `main` — that is a different game loop.
- **Several sessions share the branch.** Rebase onto `origin/collectible_version` before pushing;
  never force-push.
- **Commit style**: a lower-case sentence as the subject, then prose explaining the reasoning and
  what went wrong on the way. End with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Stop and say so if blocked.** No repo access, no Scenario tools, the skill not loading — a
  clean stop with the reason is worth far more than a result produced by working around the skill.

## What this will cost, and what it is worth knowing before starting

**Time and credits, measured rather than estimated.** Three calls per asset is the floor, not the
expectation — retries are the variable, and they scale with how much of a band lands where the
camera cannot see. Actual, over eleven assets:

| tier | assets | conversions | CU | per asset |
|---|---|---|---|---|
| 2 · the flat | 4 | 10 | ~1265 | ~316 |
| 3 · the townhouse | 4 | 4 | ~590 | ~148 |
| 4 · the apartment | 3 | 5 | ~700 | ~230 |

Quote a band at **600–1300 CU**.

**The binding constraint is the request rate, not credits or conversion time.** After roughly forty
model calls in ninety minutes the account began returning `429` with cooldowns of 517, 687 and 702
seconds — an effective budget of about **one call every twelve minutes**, which turns a three-call
asset into a forty-minute one. Pace from the start rather than discovering it at asset twelve.

Three things about that limit, checked against the account's own usage figures rather than assumed,
because each one is a thing somebody will otherwise reasonably guess wrong:

- **It is a burst limit, not a daily quota.** The day it was tripped carried 72 estate calls in
  total, which is not a large number spread over a day. Forty of them inside ninety minutes is what
  did it. Pacing beats rationing.
- **Buying credits does not lift it.** They are different axes, and an empty balance and a rate
  limit can be true at the same time. It is worth knowing which one you are looking at: an
  exhausted balance usually reports itself as a payment error, and a rate limit gives you a
  `429` with a retry-after in seconds.
- **It was self-inflicted, not contention.** The obvious suspicion is another workload on the same
  account — this project's icon art ran 129 image jobs over the two previous days, which dwarfs the
  estate pipeline's volume. But on the day the limit was hit that work was finished: two image jobs
  all day against seventy-two estate calls. The estate pipeline reaches the limit on its own.
  Sequencing it away from other art work is still worth doing, but it is not the fix.

**Weight.** Each file is 1.6–2.4 MB. Twenty more takes `assets/estate/models/` from about 22 MB to
roughly 60 MB, and the whole `assets/` directory past 130 MB. Runtime memory is fine — `_sweep()`
evicts everything but the drawn tier, the current and the pre-fetched next — but the repository
grows and does not shrink. **Worth confirming this is acceptable before starting, not after.**

**Dimensional drift is expected and is not a bug to chase.** Each file is an independent
reconstruction, so levels within a band differ slightly everywhere, not only in the thing that
changed. Tier 1's footprints ran 0.835 → 0.860 → 0.922 → 0.854 → 0.906, up to 10% off and not
monotonic. The fog hides it in play.

**That is not the same as a change vanishing**, and the two must not be confused — an earlier
version of this sentence did confuse them, and may have cost a retry. A building that converts
cleanly with the new thing simply absent is a failure, not drift, and is worth another conversion
every time. If it ever becomes intolerable the fix is per-level props on a fixed room, which
is written up at the foot of the skill — but that is a rebuild, not an adjustment.

## If you have budget for only some of it

The bands are independent, so any subset works. In order of value:

1. **Tier 6 (27–30).** The end of the track is where the payoff should be biggest, and level 30 is
   the Season gate.
2. **Tier 2 (7–10).** The earliest band most players will actually reach.
3. **Tiers 3, 4, 5.** The middle, in whatever order.

Within a band, if only two are affordable, do **floor** and **structure** — the two largest areas,
and the two that read most clearly at board scale.
