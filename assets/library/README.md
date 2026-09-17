# Library artwork

The pictures behind the Netflix-style library: one poster per episode, one billboard per series.

```
assets/library/episodes/001.jpg … 018.jpg   2:3 portrait, 832 × 1248 — the cards in the rails
assets/library/series/001.jpg               16:9 landscape, 1600 × 900 — the hero banner
assets/library/series/002.jpg               16:9, the locked placeholder series
```

## Naming

**The filename is the id, and nothing else.** `episodes/007.jpg` is the episode whose `id` is
`"007"` in [content/seasons/001-2.js](../../content/seasons/001-2.js); `series/001.jpg` is the
series whose `id` is `"001"`. Three digits, zero-padded, `.jpg`.

No season files. A season is a heading on the spine, not a thing with a picture — it inherits
the look of its series and is drawn from its episodes' cards.

The ids are already global and already stable (a price names an item and nothing else; a queue
entry names an episode id), so deriving a path from an id needs no table and no manifest. Adding
episode 019 is a file called `019.jpg` and no code change, which is the same contract as
`assets/tiles/models/N.glb`.

## Two shapes, because they are two different jobs

| | Ratio | Size | Why |
|---|---|---|---|
| Episode poster | 2:3 | 832 × 1248 | A card in a horizontally scrolling rail. Tall is what fits five-across on a phone, and it is the shape every streaming app has trained people to read as "one episode" |
| Series billboard | 16:9 | 1600 × 900 | A hero plate across the top of the page. It is the width of the viewport, so a tall crop would either letterbox or throw away the sides |

They are not crops of each other and must not be generated as one image and cut down. A poster
is composed with the subject in the lower two thirds; a billboard is composed with the subject
weighted right. Cropping either into the other puts the composition in the wrong place.

**The top third of a poster and the left third of a billboard are deliberately dark and empty.**
The library draws the title in HTML over the card, so that area is reserved. It is not wasted
space — it is the space the type sits in.

## No text in the image, ever

Not a title, not a logo, not a caption, not a station ident on a television in the background.
The library already draws the title, so a baked-in one would double up, and it would be wrong
the moment a title is edited in `content/`. Generators are also simply bad at letterforms and
will produce misspelled near-words that look like a bug.

Every prompt says so twice — once in the style suffix and once again for any prop that invites
it ("any paper, screen, sign or label in frame must be blank"). Episode 005 is a man signing a
marriage certificate and episode 012 is a wall of news screens; both were generated with the
paper and the screens explicitly blank, and both came back clean.

## Missing files degrade, they do not break

Same contract as the tile art, the mystery box and the player piece: **an absent or broken
`.jpg` costs that one card its picture and nothing else.** The library must draw a poster-shaped
placeholder — the series' accent colour, the title over it — and carry on scrolling.

This is not hypothetical. `content/series/001.js` ships with `art: "assets/series/001.jpg"`
pointing at a path that does not exist, and `content/series/002.js` ships with `art: ""`, both
with a comment saying the library has to handle it. Series 002 now has a billboard here; the
`art` fields in `content/` are a separate question and were not touched.

---

## The look

Eighteen posters that each look good alone but do not stand together are a failure, so the look
was decided **once**, written down, and appended verbatim to every prompt. To add episode 019,
paste the two blocks below unchanged and write only a new SCENE paragraph.

### Palette

Pulled from `:root` in [css/base.css](../../css/base.css) so the library does not look like a
different product bolted onto the board:

| Token | Value | Role in the art |
|---|---|---|
| `--bg` | `#0d1029` | Backgrounds and crushed shadows |
| `--bg2` | `#141838` | Midnight blue, the second shadow value |
| `--gold` | `#ffcb5c` | The key light, every practical, every highlight |
| `--teal` | `#2dd4bf` | Small accent only — screen glow, an exit sign, bokeh |
| `--pink` | `#ff6fa5` | Small accent only — neon, a reflection in wet ground |

Gold carries the image and teal and pink are kickers. Reversing that weighting is what makes a
poster stop matching the other seventeen.

### The style suffix — appended verbatim to all eighteen posters

> STYLE — apply exactly, identical on every poster in this set: cinematic vertical-drama key art,
> photoreal with a glossy premium-streaming finish. One strong key light plus a warm gold rim
> light from behind one shoulder and a cool indigo fill from the other side; deep crushed
> shadows, high contrast, shallow depth of field, subtle fine film grain. Colour grade pulled
> hard toward a dark jewel-toned palette — near-black indigo #0d1029 and midnight blue #141838
> through the background and shadows, warm gold #ffcb5c in the key light, practicals and
> highlights, teal #2dd4bf and hot pink #ff6fa5 only as small accents in background bokeh, neon
> or reflections. Skin natural and warm, faces clean and evenly lit so they stay readable when
> the image is shrunk to a small card. Framed for a tall card: subjects large in the lower two
> thirds, the top third kept darker, simpler and emptier so a title can be laid over it later.
> Absolutely no text, letters, numbers, words, captions, subtitles, titles, logos, watermarks,
> signatures, credits or readable signage of any kind anywhere in the image; any paper, screen,
> sign or label in frame must be blank.

**The billboards use the same block with one sentence swapped**, because the reserved space moves:

> Framed for a wide billboard banner: the figures weighted to the right of frame, the left third
> kept darker, simpler and emptier so a title can be laid over it later.

Everything else is identical, which is why the banner and the cards grade the same.

### The character blocks — pasted verbatim into every prompt a character appears in

Consistency across the set matters more than any single image, so a character is described the
same way every time rather than freshly each time. The wardrobe cues match the board's NPCs
(see [assets/npcs/README.md](../npcs/README.md)) so the figure walking the ring and the face on
the card are the same person.

**SIMON — street look (episodes 001–011):**

> SIMON: a man in his early thirties, tall and lean, short dark brown hair, a few days of dark
> stubble, a strong straight jaw, deep-set dark brown eyes, a small scar through his right
> eyebrow. Street look: a worn olive-green wool overcoat over a charcoal-grey sweater, a dark
> knitted beanie, a tan canvas duffel bag. Guarded, watchful, quietly calculating.

**SIMON — revealed look (episodes 012–018):**

> SIMON, revealed look: the same man as the reference — early thirties, tall and lean, short dark
> brown hair, a strong straight jaw, deep-set dark brown eyes, a small scar through his right
> eyebrow — now clean shaven, hair combed back, in a sharply tailored charcoal three-piece suit
> over a black open-collar shirt. Unmistakably the same face as the man in the olive street coat;
> only the clothes and the bearing have changed.

Two blocks, one face. The split lands at episode 012, where the news breaks that the missing
Jones CEO has been found — before that a suit would spoil the hook, which is the same reason
`assets/npcs/` deliberately ships only the street Simon. The scar through the right eyebrow is
doing real work: it is the one feature a generator reproduces reliably at small size, and it is
what makes the street man and the suited man legibly the same person.

**VICTORIA:**

> VICTORIA: a woman in her late twenties, warm ivory skin, long dark chestnut hair worn loose
> with a soft wave, delicate features, large expressive dark-brown eyes, full brows, a small
> beauty mark high on her left cheek. Her everyday look is a dusty rose-pink wool coat with a
> cream knitted scarf; in formal scenes a deep emerald-green satin dress. Poised, proud, visibly
> holding something back.

**CARL:**

> CARL: a man in his mid thirties, handsome and groomed, sharp cheekbones, light-brown hair swept
> back with product, pale grey-green eyes, a thin contemptuous mouth, clean shaven. Always a
> slate-navy overcoat over a crisp white shirt, often with dark sunglasses or a phone at his ear
> and a silver wheeled case. Preening, impatient, never quite looking at the person he is talking
> to.

**Supporting cast**, same rule — written once, reused:

> THE COUSIN: a woman in her mid twenties with honey-blonde hair in a sleek chin-length bob, a
> sly satisfied expression and a wine-red dress. Deliberately unlike Victoria so the two are
> never confused.

> VICTORIA'S MOTHER: a well-kept woman in her fifties, dark hair streaked with silver in a low
> chignon, pearl earrings, a plum wool coat, beaming and utterly relentless.

> GRANDMA: a frail elderly woman with soft white hair and bright knowing eyes, wrapped in a cream
> shawl.

The cousin is blonde on purpose. `assets/npcs/README.md` leaves her out of the board entirely
because she would read as a second Victoria at 47 px; a poster has room to tell them apart, but
only if the hair does the work.

### What each poster depicts

The scene comes from the episode's `question` field in `episodes/NNN.js` and its correct answer —
that is a one-sentence statement of what actually happens, and it is a far better brief than the
title or the blurb. `episodes/` is parked data now, but it is still the best description of the
story that exists.

---

## How they were made

Scenario, **not** via the `board-tile-art` skill — that skill's pipeline and its muted low-poly
style block exist for 3D board assets and have nothing to say about photoreal key art.

| | |
|---|---|
| Model | `model_openai-gpt-image-2-5-sunburst` (GPT Image 2.5 Sunburst) |
| Posters | `width: 832`, `height: 1248`, `quality: "high"`, `numOutputs: 1` |
| Billboards | `width: 2048`, `height: 1152`, `quality: "high"`, `numOutputs: 1`, downscaled on disk to 1600 × 900 |
| Character lock | `referenceImages: ["asset_hVxTTuqMDZrtzt37jqmsPpdi"]` on every prompt with a person in it |
| Cost | 12 CU per poster, 13 per billboard; 21 successful runs |

### The reference plate is the whole trick

Faces drift. Eighteen prompts that each describe "a man in his early thirties with dark hair"
produce eighteen different men, and no amount of adjectives fixes it. So the first generation was
not a poster at all — it was a **character reference plate**: Simon, Victoria and Carl waist-up,
side by side, front-on, neutral expression, flat studio light on a plain charcoal backdrop. That
one asset is then passed as `referenceImages` to every prompt that contains a person, over the
instruction:

> Use the attached reference plate ONLY as a likeness reference for the characters' faces and
> wardrobe — keep their faces exactly the same person. Do NOT copy its framing, its flat lighting
> or its grey studio backdrop. Paint a completely new cinematic scene as described below.

That last sentence matters. `referenceImages` on this model is an edit slot, so without being
told otherwise it will hand back a relit version of the plate instead of a new scene. Flat
lighting and a grey backdrop are exactly what the posters must not have, so the plate's own look
has to be ruled out by name.

The plate is deliberately flat-lit and plain. It is a reference, not art — the temptation to make
it pretty makes it worse, because anything characterful in it leaks into all eighteen posters.

Series 002's billboard is the one image generated **without** a reference, because it contains no
people. Passing a plate full of faces to a prompt whose entire point is that nothing is revealed
would be working against it.

### Regenerating one

Generate at 2:3, then convert on disk:

```bash
sips -s format jpeg -s formatOptions 82 raw.jpg --out assets/library/episodes/NNN.jpg
```

`formatOptions 82` is the number to keep. The API returns JPEG at quality 100, which is about
1 MB per poster; a rail can have twenty cards on screen, so 20 MB of pictures for one scroll is
not acceptable. 82 lands every poster between 220 and 400 KB with no visible loss at card size.
The whole folder is 5.8 MB.

Billboards get `-Z 1600` as well, since 2048 is more than the banner ever draws.

## What is weak

- **017 (`Putting On a Show`)** is the softest of the eighteen. The first attempt was refused by
  the model's output moderation as sexual — it was prompted as a kiss — and the version that
  shipped is a forehead-to-forehead almost-kiss instead. It reads sweet and it reads correct, but
  the room and Victoria's high-necked dress tip slightly period, where the rest of the set is
  contemporary. If one poster gets regenerated, it is this one; keep it chaste, but push the
  wardrobe modern.
- **012** puts Simon's face on a dozen screens at once. It is the strongest image in the set and
  also the most fragile: it only works because every screen is blank of text, and a regeneration
  that lets one chyron through will look broken rather than stylised.
