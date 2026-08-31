# Field notes — building levels 7 to 20

Written while working through [LEVEL-PLAN.md](../../assets/estate/LEVEL-PLAN.md) with
[SKILL.md](SKILL.md), by somebody who had not seen this repo before. These are **findings, not a
rewrite of the skill** — the durable rules belong in SKILL.md and somebody else is folding them in.
What is here is what actually happened, including the parts that went wrong, because a rule with
the incident that produced it is worth ten rules asserted flat.

Covers tier 2 (levels 7–10), tier 3 (12–15) and tier 4 (17–20). Tiers 5 and 6 were not reached.

## The one finding that matters most

**Whether a change survives is decided by how exposed its surface is to the camera, not by how
large it is or how saturated its colour.** The skill's rule — contrast, not size — is necessary and
true, but it is a rule about the *2D image*, and the 2D image is not what the player sees. What the
player sees is a reconstruction, and the reconstruction only knows about surfaces the reference
image actually showed it.

Ranked by how reliably a change in that place survived, over the fourteen conversions this run:

| where the change is | survived | why |
|---|---|---|
| **above the roofline** — a pergola, a canopy | every time | nothing occludes it, and it changes the *silhouette*, which is what reads at 200 px |
| **projecting from the face** — an awning, a sign | every time | same reason, seen from both above and the side |
| **the open sky-facing terrace** | every time | the camera looks straight down into it |
| **the open cutaway edge of a floor** | usually | visible, but shallow — small props still soften |
| **under an overhang** — the slab, the back wall | about half | the 38° camera barely sees into it and the model has almost nothing to go on |

The corollary is the practical rule: **place the one change where the camera can see it, not where
it belongs.** A sofa belongs against a wall. Put it against the wall and it will not survive.

And the stronger version, which is the single most useful thing to come out of this run: **when a
band needs one step to land, spend it on something that breaks the outline.** Twice, unprompted,
the step that read best in its band was the one that stuck out of the building — the flat's pergola
at level 10 and the townhouse's awning at level 15. The apartment's canopy at 20 is the third. That
is not a coincidence about those three objects; a silhouette change is legible at a size where an
interior change is four brown pixels next to four slightly different brown pixels.

**How confident am I?** Reasonably, with a caveat. The evidence is consistent and there is a
mechanism that explains it, which is better than a correlation. Fourteen conversions is a small
sample, though, and it is confounded: the exposed changes were also often the *larger* ones, so
"exposure" and "size" are not fully separated by this run. The cleanest evidence against the
confound is level 8 — a floor covering the entire ground slab, the largest-area change in tier 2 by
some way, and it vanished completely on the first conversion. Big and hidden lost; small and
exposed won. That is the observation the theory is really resting on.

## The three lost sofas, and the failure that looks like success

Level 7 was meant to be one emerald sofa in the flat's sitting room. It took **five conversions**.
The first three all came from a reference image where the sofa stood against the ground floor's
back wall — which is where a person would put a sofa, and where it looked perfect in 2D.

1. **A teal smear under a grey shard.** The sofa did not reconstruct as an object at all; its
   colour ended up painted onto the wall behind it, and a large flat grey polygon cut through the
   room.
2. **A deformed building with a blue spike.** Same image, different seed. A blade of geometry
   across the roof terrace and the whole house squatter by 11%.
3. **A clean, well-formed building with the sofa simply absent.** No artefacts. Nothing obviously
   wrong. It just was not there — a blue daybed sat where the emerald sofa should have been.

**The third is the dangerous one and it deserves a name.** The first two announce themselves; you
look at them and know to retry. The third passes a glance, passes a thumbnail, and would pass
review. What it says to the player is *nothing happened* — which is precisely the defect the whole
per-level exercise exists to avoid, arriving in the form of a file that looks fine. If you are
going to check one thing about a level, do not check whether the mesh is clean. Check whether the
thing you asked for is **in** it.

Moving the sofa to the open front edge of the floor, and saying so explicitly in the prompt, fixed
it on the next conversion.

Level 8 repeated the lesson in a different key: blue-and-white encaustic tiles across the whole
ground floor came back on the first conversion as **plain grey slab**, tiles gone entirely, in an
otherwise clean building. Second sample of the same cutout kept them.

## Where the skill and the plan were wrong or misleading

This is the section it would be polite to leave out, so here it is in full.

**"Drift is expected and is not a bug to chase" conflates two different failures.** The plan says
this, and a follow-up message from the session running this work repeated it. It is entirely true
of *dimensional* drift — footprints wandering a few percent, floors bowing, small props going soft.
It is **not** true of a change vanishing, which is a different kind of event with a different fix.
The wording did push me toward accepting the lost tiles at level 8 as ordinary drift before I
looked closely enough to see they were not, and I nearly shipped it. The distinction worth writing
into the skill: *dimensional drift is free and permanent; a missing change is a defect and is
always worth a retry.* They are not on the same axis at all.

**`model_run` with `wait: true` does not work on this host, and the skill's MCP path specifies it.**
Every MCP call here is capped at 60 seconds. A conversion takes two to three minutes, so `wait:
true` always returns a timeout error *even though the job was created and is running perfectly
well*. `jobs_wait` times out the same way. Worse, the timeout looks like a failure, and the obvious
reaction — fire it again — pays 105 CU for a duplicate. The pattern that works is `wait: false`,
then poll `job_get`; and after any timeout, check `jobs_list` before re-firing anything. The skill
does say "expect `in-progress` and follow with `jobs_wait`", which is right in spirit, but it
frames the timeout as a property of long jobs rather than of the transport.

**"Three model calls per asset" is optimistic, and by a factor that varies enormously by tier.**
Actual, this run:

| tier | assets | conversions | CU total | CU per asset |
|---|---|---|---|---|
| 2 · the flat | 4 | **10** | ~1265 | ~316 |
| 3 · the townhouse | 4 | **4** | ~590 | ~148 |
| 4 · the apartment | 3 (so far) | **5** | ~700 | ~230 |

Tier 3 hit the plan's estimate exactly — four assets, four conversions, every one usable first
time. Tier 2 cost more than twice that, almost entirely on level 7 while the placement rule was
being learnt the expensive way. The honest planning number is **not** three calls per asset; it is
three calls per asset *plus a retry budget*, and the retry budget is a function of how much of the
band lands under an overhang. Tell somebody a band costs 600–1300 CU, not 590.

**The variant-selection rule did not discriminate.** The skill says to prefer the variant with
"the lower walls and the more open floor". Across seven pairs, the two variants never differed
meaningfully in that respect — they are edits of one reference, so the architecture is fixed. What
they *did* differ in, every single time, was far more useful and is not mentioned: **whether the
variant silently deleted something it was told to keep**, and **where it put the new thing**. At
level 7 one variant removed the plain wicker sofa that was there to be clashed against; at level 13
one dropped the crimson carpet and kept only the parquet; at level 14 one applied the new wall
colour to the wrong floor. Those are the differences worth looking for. The real selection rule is:
*take the variant that kept everything and put the change where it can be seen.*

**The skill assumes you can find the previous level's image, and never says how.** For a level
inside a band you have just made, fine — you have the asset id in hand. For the *first* level of a
band, the reference is the tier's own cutaway, which was made months ago by somebody else and is
one of several hundred assets in the project. Keyword search does not find it; the descriptions are
auto-generated and say "a cutaway view of a coastal house". What works is the parent chain: list
image assets by `createdAt` descending, find the tier's *background-removed* cutout by its
description, then `asset_get` it and read `metadata.parentId` — that is the edited image you want,
and `metadata.rootParentId` is the uploaded `items/tierN.webp` that proves you have the right tier.
That took a while to work out and is pure overhead the next person should not pay. The three I
resolved:

    tier 2, level 6   asset_QRqY46nBgA33HmSYAgDSuSSu
    tier 3, level 11  asset_Fo3QS9LeNzyXeAfebtBcSgoM
    tier 4, level 16  asset_25s8obThKyVzmcnq3wCUbApN

## Other things nobody tells you

**The Scenario search index lags roughly ten minutes behind reality.** Assets you created two
minutes ago do not appear in `search` at all. If you need an id for something just made, get it
from the job, never from search — I lost time assuming a job had failed because its output was not
findable.

**There is a rolling rate limit, and it bites hard.** After roughly forty model calls in ninety
minutes the account started returning `429` with cooldowns of 517, 687 and 702 seconds. Once you
are in it, the effective budget is about **one model call every twelve minutes**, which turns a
three-call asset into a forty-minute asset. This dominates every other cost consideration for a
twenty-asset run and the plan should say so: the binding constraint is not credits or wall-clock
conversion time, it is the request rate. Pace deliberately from the start rather than discovering
it at asset twelve.

**`./start.sh` runs the server in the foreground.** It does not daemonise, so a compound command
that starts it and then does something else never reaches the something else. Background it, or run
`python3 serve.py &` directly.

**In `estate-preview.html`, 45° is the game angle.** The tool's own comment explains it (the tier's
`yaw` is your angle minus the 45° `MODEL_YAW` already applies), but the practical shortcut is worth
stating flat: render at `?a=45&c=1` and you are looking at exactly what the board will show. All
eleven meshes this run landed on 45 and none needed a `yaw`.

**Screenshot `estate-levels.html` with `fog=0`.** Otherwise the swap you are trying to photograph
happens inside a cloud. And drive it by clicking `#up` rather than loading `?lv=N` per level — it
exercises the same transition the game does, and the readout confirms which file is drawn.

**To check the manifest parses, `vm.runInNewContext(src + '; ESTATE_TIERS')`.** A top-level `const`
in a `vm` context does not attach to the context object, so the obvious version silently gives you
`undefined`. Worth it — it catches a bad path before the board does.

The `404` for `/favicon.ico` in every headless run is noise. Ignore it.

## The contrast axes, tier by tier

The plan's table of per-tier axes is the most valuable thing in it, and it was right every time.
What needed adapting was not the axis but the *colour*, because the plan names colours without
checking them against what the tier already owns.

**Tier 2, the flat — chosen against standard-issue.** Correct axis. The plan asks for a
**terracotta** sofa; terracotta is the exact colour of the flat's existing floor tiles and kitchen
splashback, so it would have been new-against-the-same-colour — the axis with the contrast removed.
Spent **emerald** instead, which was the only saturated colour the tier did not already own (blue
on the balcony, terrace, bicycle and boat; yellow on the door and bed; green only as leaves). Then
cobalt-and-white for the floor, white for the walls, and green again for the pergola vines.

**Tier 3, the townhouse — restored against shabby-genteel.** Correct axis, and the easiest band to
work: a faded house has somewhere for "cared for" to show. Spent bottle green (chesterfield),
crimson (carpet), ink blue (panelling), and gilt-and-stripes on the shopfront. Note the tier
supplies its own contrast for free — everything is brown, so any saturated colour is the newest
thing in the room by default.

**Tier 4, the apartment — lived in against showroom-empty.** Correct axis and the sharpest of the
three, because the base image is *aggressively* cream, white, pale stone and gold. Anything warm or
dark reads enormously. Spent **burnt orange** (sectional and rug), **honey oak** (floors), and
**charcoal slate** (the fireplace wall) — the first dark mass the tier has ever had, and the
strongest single step in the whole run. The plan's own suggestions here would have been invisible:
it asks for "pale stone floors throughout" and "a large pale sectional" in a building that is
already entirely pale stone and pale sectionals. Adapted both to their opposites and said so.

The generalisation: **the plan should name the contrast, and let whoever builds it choose the
colour after looking at what the tier already spent.** A named colour in a plan written away from
the reference image is a coin flip.

## What I would do differently starting tier 2 again

Put the sofa at the open front edge the first time, obviously — that alone is four conversions and
roughly 420 CU saved on one asset.

Beyond that: **check the reference at board scale before converting, not after.** The 2D edit is
1792×2400 and everything reads beautifully in it. The estate renders about 200 px wide. Shrinking
the candidate reference to 200 px and looking at it would have told me instantly that a sofa
tucked under the first-floor slab was not going to be visible, and it costs nothing. I only started
doing the equivalent check late, in `estate-levels.html`, by which point the conversion was paid
for.

And I would **generate the whole band's images before converting any of them**. The image chain is
strictly sequential and cheap (40 CU); the conversions are expensive (105 CU) and independent once
their images exist. Doing all four edits first, looking at all four at board scale, and only then
firing four conversions is both better-paced against the rate limit and gives you a chance to see
the band as a story before committing to it. I stumbled into half of this by running level N+1's
edit while level N converted, which helped; doing it deliberately would help more.

## Where I disagree

**The furniture → floor → walls → structure shape is right, but it is back to front for
reliability.** Each rung is a larger *area* than the last, which is the stated logic and it does
build. But the rungs are also, in that order, increasingly *exposed* — furniture and floors are
interior and hidden, structure is exterior and visible. So the band's most reliable and most
legible step is always its last one, and its most fragile steps are the two the player meets first.
A player climbing 6 → 7 → 8 sees the two weakest steps in the band before they see anything that
really lands. If the shape is ever revisited, consider opening each band with something that
touches the outline and saving an interior refinement for later — or at least accept that the first
two rungs of every band need a retry budget the last two do not.

**Tier 4 has a problem the others do not, and it is the building rather than the pipeline.** It is
mostly glass, and glass reconstructs as an opaque smear — the shipped `tier4.glb` has it too, so
this is the tier's established look rather than something these levels introduced. But it means the
apartment's interiors are effectively unusable as a place to put a change: whatever you do in there
comes back as pale mush. All three of its interior steps had to lean on a *large* element (a whole
floor finish, a whole wall) rather than an object. An interior prop in tier 4 would be wasted work.

**One real loss I chose not to spend more on.** Level 17's mesh dropped the turquoise pool, which is
one of tier 4's landmarks — a "never loses one" violation by the letter. A retry came back worse
(the orange washed out to cream, which loses the *change* rather than a landmark), so I kept the
first. Given the choice between losing a landmark and losing the step, losing the landmark is
correct: the step is why the file exists. But it is a real defect and it should be recorded as one
rather than filed under drift.
