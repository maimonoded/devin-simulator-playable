# Pull deck artwork

The paintings behind the deck the player draws from: one per card face, one per collectible item,
and one back.

```
assets/cards/card-<face>.png     5:3 landscape  — the art band on a card face
assets/cards/item-<id>.png       1:1 square     — a collectible prop
assets/cards/card-back.png       0.70 portrait  — the back, on every card in the stack
```

## The card face is composed at runtime, not baked

A card is 340 × 480. **The painting fills the top 60% of it and code draws the name and the amount
over the bottom 40%**, onto the canvas. That split is the reason for everything below:

- **the art is a landscape crop, not a card-shaped picture.** It is never seen as a 340 × 480
  image, only as the band across the top of one;
- **no image carries a word.** The name and the number are drawn in the same typeface at the same
  place on every card, which a generator cannot do — see below;
- **the sides of a painting are expendable.** The band is about 340 × 288, which is 1.18:1, and
  the art is 5:3. Filling the band by cover scales the picture to the band's *height* and throws
  away roughly **an eighth of the width off each side**. So the style suffix says to keep nothing
  important in the outer eighth, and a new card must obey that or lose its subject's edges.

## Three shapes, because they are three different jobs

| | Ratio | Shipped at | Why |
|---|---|---|---|
| Card face | 5:3 landscape | 791 × 475 … 860 × 516 | The art band on a card, cover-cropped into it |
| Item | 1:1 square | 614 × 614 | Shown on a card **and** as a collectible in the library's bag, so it cannot assume a card's proportions |
| Back | 0.703 portrait | 512 × 728 | The whole card, so it matches 340 × 480 exactly |

They are not crops of one another. An item is square because it has two homes and a square is the
only shape that suits both; cutting a card face down to a square would put the subject off-centre,
and blowing an item up to 5:3 would strand it in empty surface.

## Naming

**The filename is the id, and nothing else.** `item-ring.png` is the item whose `id` is `"ring"`
in [content/series/001.js](../../content/series/001.js); `card-windfall.png` is the deck's windfall
card. No manifest, no table — the same contract as `assets/tiles/models/<type>.glb` and
`assets/library/episodes/NNN.jpg`.

Items are named after the item id and **not** after the series, because the ids are global. A
second series brings its own five items with their own ids, and their pictures land beside these
without renaming anything.

## What reads them

[js/ui/card-art.js](../../js/ui/card-art.js), and nothing else. It draws the face —
`CardArt.face(cardEvent)` returns a 340 x 480 canvas — and two things use that one canvas:
[js/ui/shoe3d.js](../../js/ui/shoe3d.js) wraps it in a `THREE.CanvasTexture` for the card that
lifts off the deck on the board, and [js/ui/fx.js](../../js/ui/fx.js) drops it straight into the
DOM for the flat card shown when there is no 3D board. So there is one answer to "what does a
card look like" however it reaches the screen.

**A card's file is found through a name -> slug map in `CardArt.SLUGS`, not through a column on
the deck row.** The deck table lives in [js/config.js](../../js/config.js), is edited live in the
tuning drawer, and is rebuilt wholesale by `Economy.apply()` from the loaded workbook — a field
added to a row would be edited away or overwritten. So **adding a card is two edits**: the row in
`deck` (and its mirror in `ECONOMY_DEFAULT`), and one line in `SLUGS`. Forgetting the second one
costs that card its painting and nothing else.

The **items** need no map at all: the filename is the Catalog item id, so `item-ring.png` is
found by the id the tile already put on the event. A second series brings its own five and they
are picked up without a line changing anywhere.

## Missing files degrade, they do not break

Same contract as the tile art, the library posters and the mystery box: **an absent or broken
`.png` costs that one card its picture and nothing else.** The deck must draw the card anyway —
its name, its amount and its colour on a plain field — and carry on dealing.

That matters more here than elsewhere, because a card is a *move*: a deck that throws on a missing
file would take the game down mid-turn. So the drawing is not a placeholder waiting to be removed.
It is what renders while these files are still downloading, and what renders forever if one is
lost. A generation that comes out badly can simply be deleted.

## No text in the image, ever

Not a name, not an amount, not a number on a key fob, not a chyron on a screen in the background.
The card's own name and value are drawn over the painting in canvas, so a baked-in one would double
up, and it would be wrong the moment a number is retuned. Generators are also bad at letterforms
and produce misspelled near-words that read as a bug.

Every prompt says so twice — once in the style suffix, and once again for whatever in that
particular scene invites it. This set is full of such invitations and they all had to be named:
the call sheet, the currency bands, the clapperboard slate, the phone screen, the step-and-repeat
wall, the studio gate's arch, the key fob, the prop table's label cards, the certificate, and the
black card's own face. All came back clean because each was individually declared blank.

---

## The look

Sixteen pictures that each work alone but do not stand together are a failure, so the look was
decided **once**, written down, and appended verbatim to every prompt. To add a card, paste the
block below unchanged and write only a new SCENE paragraph.

### Palette

Pulled from `:root` in [css/base.css](../../css/base.css), the same five values the library posters
use, so the deck and the library look like one product:

| Token | Value | Role in the art |
|---|---|---|
| `--bg` | `#0d1029` | Backgrounds and crushed shadows |
| `--bg2` | `#141838` | Midnight blue, the second shadow value |
| `--gold` | `#ffcb5c` | The key light, every practical, every highlight |
| `--teal` | `#2dd4bf` | Small accent only — bokeh, a charge light |
| `--pink` | `#ff6fa5` | Small accent only — neon, an uplighter, a reflection |

Gold carries the image and teal and pink are kickers. Reversing that weighting is what makes a
card stop matching the other fifteen — with two deliberate exceptions, below.

### The style suffix — appended verbatim to all sixteen

> STYLE — apply exactly, identical on every image in this set: painterly cinematic still life,
> oil-painted brushwork over a photoreal armature, high-gloss premium-streaming finish, the same
> world as a vertical short-drama's key art. One warm gold key light and a cool indigo fill, deep
> crushed shadows, high contrast, fine film grain. Colour grade pulled hard toward a dark jewel
> palette — near-black indigo #0d1029 and midnight blue #141838 through the backgrounds and the
> shadows, warm gold #ffcb5c carrying the key light, the practicals and every highlight, teal
> #2dd4bf and hot pink #ff6fa5 only as small accents in bokeh, neon or reflections. Composed as a
> single bold shape: one clear subject, large and centred, still readable when the picture is
> shrunk to the size of a postage stamp, and nothing important in the outer eighth of the frame.
> Absolutely no text, letters, numbers, words, captions, titles, logos, watermarks, signatures or
> readable signage of any kind anywhere in the image; every paper, screen, label, sign, tag and
> card face in frame must be completely blank.

**The five items add a second locked block**, because an item has a job a card face does not — it
has to survive being shown as a small icon in the bag:

> FRAMING — evidence-photograph framing, identical for every object in this group: square frame,
> camera straight on and slightly above, ONE object alone on a dark surface, the object filling the
> middle two thirds of the square so its silhouette still reads when it is shown as a small
> collectible icon. A warm gold raking light from the upper left picks out the form and throws a
> long soft shadow to the lower right; the surface falls away to near-black indigo at every edge.
> Nothing else in frame — no hands, no people, no other props, and no decorative border or frame
> around the picture.

### Two cards break the palette on purpose

The suffix is fixed, so an exception has to be stated in the scene paragraph loudly enough to beat
it. Two are:

- **`card-energy`** inverts it — teal leads, gold is a low fill. Energy is not money, and the card
  has to say so before the float appears. Its scene says *"THE HERO LIGHT HERE IS COOL, and this is
  the one image in the set where gold does not lead"*, and then bans coins and banknotes from the
  frame by name. Warm-grading it would make it a third coin card.
- **`card-fine`** goes cold — clinical white and blue-white, hard black shadows, gold surviving
  only in one reflection. It is the only card that *takes*, and it is the only hostile image in the
  set. The same reasoning as `reshoot.glb` being the one dark corner on the board
  (see [assets/tiles/README.md](../tiles/README.md)): the tile that costs you reads differently
  from across the room.

Every other card holds gold, which is what makes those two land.

### The three paying cards are a ladder, and the pictures have to agree

The deck pays three flat coin amounts, and **the art has to rank in the same order as the
numbers**:

```
card-small-coins (30)  <  card-medium-coins (80)  <  card-windfall (300)
```

That contract is load-bearing, not decoration. A player reads the picture before the number: if
the jackpot looks cheaper than the mid card, the deck feels broken even though the maths is right.
It went wrong exactly once and the fix was a regeneration — `card-windfall` was originally a blank
sheet of paper and a fountain pen under a banker's lamp, which reads as a contract, a summons or a
**bill**, something being *taken*. Meanwhile `card-medium-coins` is two bricks of banded
banknotes with coins spilling across a lit studio, and was easily the most opulent image in the
set. So the jackpot looked like the cheapest card and the mid card looked like the jackpot.

The three levers that make the rank read, in order of how much they do:

1. **How much money is physically in frame.** A dozen loose coins, then two banded bricks, then a
   container that cannot hold what is in it. Volume is the only one of the three that survives the
   340 × 288 crop intact.
2. **How warm and how bright.** Small coins sit in a dim pool on pale kraft paper; windfall floods
   the whole frame with bounced gold and keeps indigo only in the corners.
3. **Motion.** Money at rest reads as an amount; money spilling, falling and mid-air reads as an
   *event*. Only the top rung gets it.

**Adding a fourth coin card means re-checking the whole ladder**, not just painting the new one:
open all of them cover-cropped to 340 × 288, side by side, and confirm the order is obvious with
the numbers covered. A rung can be fixed by lifting the new card or by bringing a neighbour down —
either is fine, as long as the run ends up monotonic.

### The five items are equal

No frames, no glows, no rarity tiers, no richer lighting on the scarcer ones. They are lit,
framed and graded identically, and they are deliberately interchangeable at a glance.

This is a decision, not an oversight: the library's counters already say what is still needed, so
making the rare ones *look* rare would say it twice and would make the common ones feel like
failures. If a future item arrives with a glow on it, it will be the odd one out.

### The back has to work at stack size

The back is the one image seen more than any other — on every card in the stack on the board, and
on the reverse of the card being pulled. On the board that stack is a pile of slabs, so the back is
mostly seen as a **~40 px sliver**, and a design that only works at full size is the commonest way
this goes wrong.

So it was rendered small and looked at before it was accepted: at 150, 110, 80, 56, 40 and 28 px.
It holds, because it is built as **one bold gold disc on a dark field** and not as a scene — the
sunburst medallion mushes into a single gold coin shape rather than into noise, and the ring of
marquee bulbs inside the border survives as a warm dotted edge. Stacked, those borders line up into
a gilt ribbon down the side of the deck, which is the best thing about it and was not planned.

**The monogram carries no letterforms.** It is a production company's crest built only from shapes
— a camera aperture inside a laurel inside a sunburst, with two spotlights and a curl of film. A
monogram is the single most tempting place to let a letter in, and a letter there would be wrong on
every card at once.

---

## How they were made

| | |
|---|---|
| Model | `model_bytedance-seedream-5-0-pro` (Seedream 5.0 Pro) |
| Card faces | `width: 1600`, `height: 960` (5:3), `optimizePromptMode: "standard"` |
| Items | `width: 1536`, `height: 1536` |
| Back | `width: 1024`, `height: 1456` |
| Cost | 9 CU per image; 30 runs (16 shipped, 14 regenerated) |

Seedream over the library's `gpt-image` because a card back is an ornate symmetrical composition
and that is what this model holds together; it is the model the repo's own
[card-deck-art skill](../../claude-skills/card-deck-art/SKILL.md) already pins for this job.

**No reference plate, and no characters.** The library's eighteen posters need
`referenceImages` because faces drift across eighteen prompts. Nothing here has a face: the one card
with a person in it shows **a hand only** (`card-fine`) and the crowds on `card-gala` are
out-of-focus silhouettes. That is deliberate rather than a shortcut — a
recognisable Simon or Victoria on a card would tie the deck to series 001, and the deck outlives
any one show. The props are where the story lives, and the props are the items.

Generation runs 90–150 s per image. Fire a batch with `wait: false` and `jobs_wait` on the ids
together — but **the plan caps parallel jobs at seven**, and the eighth comes back `429
PlanLimitReachedError` rather than queueing, so send them in batches of six.

### Installing: step resolution, never colour

The raw PNGs are 2.5–4.8 MB. They are downscaled and squeezed under budget by
`install.py` (kept in the generating session's scratchpad; the recipe is what matters):

```
try 24-bit at full size → if over budget,
quantize to 256 colours and step the resolution down until it fits
```

**Colour depth is never traded below 256, resolution always is.** Measured on this set: a
256-colour Floyd–Steinberg dither is *indistinguishable* from 24-bit once the file is scaled into
its slot, because the file ships at 2–2.5× its display size and the dither averages out. Dropping
to 64 colours — which is what a fixed 1024-wide target forces — visibly bands the gold pools that
carry every one of these images, and gold gradients are the whole look. Losing a few hundred pixels
of width costs nothing anyone can see; losing the gradient costs the set.

That is why the shipped widths are odd numbers like 799, 860 and 676 rather than a round 1024:
each file is as large as its own budget allows, and two files of the same shape can ship at
different sizes.

| | Budget | Result |
|---|---|---|
| Card face | 300 KB | 261–293 KB |
| Item | 300 KB | 252–299 KB |
| Back | 400 KB | 337 KB |

The whole folder is 4.4 MB. A dozen of these load at once, which is what the budget is for.

The back landing at 512 × 728 is a convergence, not a coincidence: it is the install size the
card-deck-art skill already specifies, arrived at here from the byte budget alone.

## What was fixed on the second pass

Six of the sixteen were regenerated after a review at real size. Each note here is a trap the next
person can fall into, not a changelog:

- **`card-windfall` had the ladder backwards.** See
  [the ladder section](#the-three-paying-cards-are-a-ladder-and-the-pictures-have-to-agree) above —
  the fix was volume: a container overflowing with gold, coins mid-fall, the warmest and brightest
  picture in the set. `card-medium-coins` was left alone: escalating the top rung was enough, and
  bringing the mid card down would have cost the set its second-best image to fix a problem that
  was only ever at the top. (The second pass reached for a *treasure chest*, which fixed the ladder
  and broke the genre — see the third pass below.)
- **`card-prop` had no subject at card size.** It was a wide green felt table with six small
  objects scattered low and left, and the brightest thing in frame was a desk lamp that was not the
  subject — at 340 × 288 it read as "a dark room with a lamp". It is now one hero object, an
  ornate casket with a blank manila tag, large and centred, with the prop table reduced to
  out-of-focus context behind it. **The green went with it**: it was the only large green in the
  sixteen and it fought the jewel palette, so the scene now bans green by name.
- **`card-insider-tip` put its subject in the outer eighth.** The hand that carried the meaning sat
  right where the cover-crop eats, leaving three fingertips at the edge and a blank white slab —
  and a large pure-white rectangle on a card reads as a UI element or a render error before it
  reads as a phone. The hand is gone and the **lit phone is the centred subject**, its screen a
  warm gold glow rather than a white panel. That clause in the style suffix is not advice; this is
  what ignoring it looks like.
- **`item-heel` ignored the FRAMING block** and was shot as an environmental wide on concrete
  steps, so at 64 px it was a gold smear on grey. Regenerated straight-on on a plain dark surface
  like the other four. **The triple count-of-one guard was kept** — see below.
- **`item-ring` had an eight-point star flare on the stone.** No other item has a sparkle effect
  and it implied a rarity tier the game does not have. Removed; the stone is lit by internal
  reflection only.
- **`item-blackcard` was a dark parallelogram on a dark field.** The corner is lifted much further
  now and gold rakes the full silhouette, so the shape carries at icon size. The teal and amber
  specks went at the same time, for the equal-items reason above.

## What was fixed on the third pass

Two images, and both notes are about a constraint the *previous* fix did not know it had.

- **`card-windfall` was the right amount of money in the wrong world.** The second pass paid the
  ladder debt with an antique brass-bound treasure chest — correct on volume, and the least
  film-world image among the eleven card faces. Every other card is the business of making
  television: a call sheet, a clapperboard, a prop table, a red carpet. The player owns a
  production company, not a galleon. It is now **a producer's hard-shell payout case thrown open on
  a desk**, black anodised aluminium with a foam-lined lid, the same overflowing mountain of coins
  and banded bricks bursting out of it. The scene paragraph bans the chest by name and at length —
  *no brass banding, no iron lock plate, no rivets, no barrel lid, nothing nautical, piratical,
  medieval or fantasy* — and ends with the same pre-emption the heel prompt uses: *"If you are
  about to paint a treasure chest, do not."* Without that, the model returns to the chest, which is
  what "gold overflowing a container" means to it by default.

  **The ladder outranks the theming, and the order was agreed before the work started.** The rule
  was: if the replacement does not beat `card-medium-coins` as clearly as the chest does, keep the
  chest and say so — a card in the wrong genre is a smaller problem than a deck that misleads the
  player about what they just won. The case cleared the bar on its first attempt, so the fallback
  was never used. It is written down because it is still the right ordering next time.

- **`item-cert` did not read as itself at 64 px.** A flat pale sheet square to camera, at mean
  luminance 70 against 31–46 for the other four — the brightest and by far the goldest object in a
  group that is supposed to be interchangeable at a glance. Both halves of that were the fix.
  **Silhouette**: the sheet is now *half-furled* — rolled and let go, so its far end stands up off
  the surface as a fat cylinder and casts its own shadow. A standing form beats a flat one at icon
  size, which is the same answer `item-blackcard` got. **Exposure**: the prompt tells the model to
  expose for the shadows, keep the paper a *cool chalky ivory* rather than a saturated warm cream,
  and states the target in the group's own terms — *"this must be the darkest, least golden object
  in its group, darker than a diamond ring or a gold shoe on the same surface."* Naming the
  neighbours is what moved it; "darker" on its own did not.

  **The wax seal is load-bearing, and it is also where a letterform gets in.** It is the second
  colour anchor, and without it the object is just paper — but a seal is a stamp, and a stamp
  invites a monogram: one attempt came back with an angular mark in the wax readable as an *M*. The
  shipped prompt asks for a face that is **smooth and unstamped apart from one plain concentric
  ring**, and lists what it must not be — *no emblem, device, crest, monogram, initial, letter,
  bird, animal, or any angular mark that could be mistaken for a letter*. "Abstract, non-letter"
  is not enough; the model will paint something, so say what.

## What is weak

- **`item-cert` is still the most golden of the five**, at roughly 7% warm pixels against 2–5% for
  the others, because a lit sheet of paper is a large warm area in a way that a ring or a shoe is
  not. It is no longer the *brightest* and it no longer breaks the group, so this is a note rather
  than a defect. Pushing it further would cost the gold rake that gives the furl its edge.
- **Single-of-a-pair objects want the count stated three times.** `item-heel` came back as a *pair*
  of shoes on its first attempt despite the prompt asking for one, which quietly destroys the point
  — one shoe left behind is the whole Cinderella reference, and two shoes is just footwear. The
  prompt that works says it three times and pre-empts the model directly: *"If you are about to
  place another shoe in the composition, do not: the count is one, and one only."* Both regenerated
  heels carried that guard and both came back single. Reuse it verbatim for any object that
  normally comes in twos.
- **`item-ring` needed the FRAMING block to exist.** Its first attempt was correct but small in
  frame, cool, and scattered with rainbow refraction sparks that fought the palette. The fix was
  the "middle two thirds" rule above plus banning prismatic dots by name, and every item since has
  been generated with that block already in place.
