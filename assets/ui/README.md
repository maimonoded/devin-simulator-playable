# UI icons

Flat 2D icons for the interface itself — the chrome, not the board. Today there is one: the coin
that stands for the currency the whole economy is denominated in.

```
assets/ui/coin.png     256 × 256, square, RGBA with a real alpha channel
```

It replaces the 🪙 emoji, which on the user's machine rendered as a dull grey-brown disc — "the
coin looks like a rock". An emoji is also whatever the OS decides it is, which is a poor way to
draw the one symbol the player sees on every screen.

## The contract

| | |
|---|---|
| Shape | square, one coin, face on, dead centre |
| Ship size | 256 × 256 |
| Generated at | 1024 × 1024, downscaled once with Lanczos |
| Background | **transparent** — 27.2% of the frame is fully clear |
| Coin diameter | 243 px of 256, a 5% margin all round |
| Colour depth | 24-bit. Not quantized — see below |
| Weight | 83 KB |

**The alpha is not optional.** This icon sits on the dark HUD bar (`--panel #1b2050`), on lighter
panels (`--panel2 #232a63`), and floats over the 3D board (`--bg #0d1029`). A baked background
would show as a square patch on at least one of those, and a bad cutout's fringe is invisible at
full size and obvious at 20 px.

## A UI icon is judged at the size it is used, not the size it is made

This is the whole rule, and it is the only reason the shipped file is the one it is. Every
candidate was downscaled to **20 px and 24 px and looked at there** before anything was chosen,
composited over both the dark panel and the near-black board. A coin that is gorgeous at 512 and a
mustard smudge at 20 has failed, and three of the eight generated were exactly that.

What the 20 px test actually killed:

- **A sunburst device on the face.** Twelve broad wedges, deliberately fat so they would not turn
  to noise. They turned to noise anyway — at 20 px it read as a citrus slice. The face is plain in
  the shipped icon and the lighting carries it, which is what the brief suspected.
- **A dark recessed middle.** Beautiful at 256, a gold ring around a brown hole at 20 px — a
  washer, not a coin. Contrast between rim and face is required, but it has to come from *light on
  gold*, never from letting the middle go dark.
- **A milled edge plus a broad diagonal light band.** The band read as a glare streak across the
  disc and the rim ring stopped closing at 20 px.

Measuring beat guessing every time. Mean colour of the rim band and of the face, sampled by
radius, is what caught the two hue failures the eye was still arguing about: one candidate's face
drifted to lemon (hue 52° against gold's 41°) and another came back brass (saturation 67% against
gold's 100%). Both looked fine in isolation and wrong beside the Roll button.

## The palette is the app's, not a generator's idea of gold

Pulled from `:root` in [css/base.css](../../css/base.css), so the coin matches the Roll button and
the gold numerals it sits next to:

| Token | Value | Role |
|---|---|---|
| `--gold` | `#ffcb5c` | the lit rim and the top of the dome |
| `--gold-d` | `#e0a63a` | the shaded lower right and the groove |

The shipped icon measures `#efb44d` overall and `#fbd465` across the face — hue 38–44°, against
`--gold`'s 41°. Close enough that it reads as the same material as the text beside it.

**Contrast comes from value, never from hue.** That sentence is in the prompt because the first
pass ignored it: asking for "contrast between the rim and the face" got a face in a different
*colour*, not a face in shadow.

## Why it looks shiny rather than printed

Three things, and the prompt names all three:

1. a **domed** face rather than a flat one, so light sweeps across it instead of sitting on it;
2. **one** strong specular, upper left, going to near-white only in that single hit;
3. a **warm amber bounce** raking the lower-right rim, which is what says "metal in a room"
   rather than "yellow circle".

The dome is the load-bearing one. A flat-faced candidate with the same palette and the same rim
came back correct and inert — at 20 px it is a bright disc, not a lit object.

## How it was made

| | |
|---|---|
| Model | `model_bytedance-seedream-5-0-pro` (Seedream 5.0 Pro) |
| Parameters | `width: 1024`, `height: 1024`, `optimizePromptMode: "standard"` |
| Cutout | `model_photoroom-background-removal`, `hdBackgroundRemoval: true`, `shadowMode: ""` |
| Cost | 8 generations at 9 CU + 8 cutouts at 3 CU |

Seedream because it is what [assets/cards/](../cards/README.md) already uses, and specifically
because `card-back.png` is "one bold gold disc on a dark field" verified down to 28 px — the same
job as this one. Using the tile pipeline's Flux + board LoRA would have pulled the colour toward
the board's muted chalky palette, which is the opposite of what a currency icon needs.

`shadowMode: ""` for the same reason the 3D pipeline uses it: a drop shadow baked into the cutout
becomes a grey smear hanging off one side of a transparent icon.

### The prompt

Generated on a **flat near-black indigo `#0d1029` field**, not on white. Gold against near-black
mattes cleanly, and any fringe the cutout does leave is then dark indigo — invisible on the two
backgrounds this icon actually sits on. A white field would have left a white fringe, which is the
one thing guaranteed to show on all of them.

The prompt is three blocks — SCENE, COLOUR, STYLE — plus a background clause and a text ban. The
clauses worth keeping verbatim next time:

> the entire coin sits in ONE narrow warm-gold hue band, around hue 40 degrees, richly saturated
> … Contrast comes from VALUE (light versus shadow), never from hue. Nothing may drift to lemon,
> acid yellow, chartreuse, greenish yellow or cream, and nothing may go brass, bronze, copper,
> brown, muddy or dull

> The coin is SOLID OPAQUE POLISHED METAL — not glass, not resin, not amber, not translucent,
> nothing shows through it anywhere.

> Absolutely no text, letters, numbers, numerals, words, denominations, currency symbols, dollar
> signs, logos, watermarks, signatures, dates, engraved portraits, heads, faces, animals or
> heraldry anywhere on the coin or in the image. If you are about to engrave a number or a symbol
> on the face, do not: the face is blank.

**No lettering, ever**, for the same reason as the deck: a baked-in number would be wrong the
moment the amount is retuned, and the balance is drawn in the DOM beside the icon anyway. A coin
is also the single most tempting place for a generator to put a denomination, so it is banned by
name and then pre-empted a second time.

## Two traps, both worth knowing before making the next one

**Photoroom will make a shiny object semi-transparent.** This cost the most time here. Four of the
first four cutouts came back with the coin's *face* partly see-through — the matting model read
high-gloss highlights as glass. Composited on the dark board that looks like a dull olive-grey
disc, which is indistinguishable from bad painting and sent the first review chasing the palette.
It was 40% of the coin's area on the worst one.

The tell is in the alpha histogram, not the eye: a clean cutout of a disc has ~1,000 partial-alpha
pixels (a one-pixel antialiased rim) and the broken ones had **80,000–100,000**. The fix is to
force it opaque — flood-fill the transparent region inward from the frame, and everything the fill
cannot reach is interior and gets alpha 255, keeping the original soft alpha only in a two-pixel
band at the boundary. A coin is an opaque disc; its alpha should be a filled circle and nothing
else. Check the count before judging the art.

**Do not quantize this file.** 256 colours takes it from 83 KB to 32 KB and visibly mottles the
dome — the gold gradient is the entire effect, and it is a single large smooth ramp with nothing
to hide banding behind. This is the same finding as the card art's, which fixes resolution last
and colour depth never; here the resolution is fixed by the contract instead, so there is nothing
left to trade and the file ships at 24-bit.

## Verifying a replacement

Do all four, in this order, before shipping anything into this folder:

1. **Downscale to 20 px and 24 px and look at it**, composited on `#0d1029` *and* `#1b2050`. If
   the silhouette does not close or the middle goes dark, it has failed, whatever it looks like at
   256.
2. **Count partial-alpha pixels.** Order 1,000 for a disc-shaped icon. Tens of thousands means the
   cutout made it translucent, not that the art is dull.
3. **Measure the mean colour** of the rim band and the face by radius and compare the hue and
   saturation against `--gold`. Hue drift past about 48° reads as lemon; saturation under about
   75% reads as brass. Neither is reliably visible in isolation.
4. **Composite ideal-vs-rendered.** Compositing at 256 and then downscaling is the ideal; the
   browser downscales and then composites. Diff the two at 20 px — the shipped file differs by at
   most 21/255 on a one-pixel ring, which is a clean alpha. A real halo shows up here as a bright
   ring worth 60+.

## Adding another icon

Same folder, same contract: square, transparent, generated large, shipped at the size the
interface uses times a comfortable multiple, and **chosen at display size**. Name the file after
the thing it means, as everywhere else in this repo — `assets/ui/<thing>.png`, no manifest.
