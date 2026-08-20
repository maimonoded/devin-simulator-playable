# Zara — the host

The figure who guides the player. She owns the first-time flow (`js/ui/ftue.js`) and is meant to
carry on through the rest of the journey, so this is a shared folder rather than an FTUE one.

## The files

| File | Where it is used |
|---|---|
| `zara-welcome.png` | Screen 2, the welcome — weight on one hip, one hand open in a "come in" gesture. |
| `zara-excited.png` | Screen 4, her reaction to episode 1, and the win — both hands up, delighted. |
| `zara-thinking.png` | Screen 5, asking the guess, and the hint on a wrong tap — hand under her chin. |
| `zara-eager.png` | Screen 8, "let's unlock more episodes" — leaning in, beckoning. |
| `zara-face.png` | The small round avatar in her bubble over video. Head and shoulders. |

`Ftue.POSE` in `js/ui/ftue.js` is the mapping. Adding a pose is a line there and a file here.

**All of them are optional.** A missing pose falls back to a plain silhouette rather than a broken
image, exactly the way tile models and props do, so the flow stays playable if one is deleted or
still being redrawn.

## What the art has to be

- **Transparent background PNG.** She is composited onto a lit, deep-navy stage — anything baked
  into the background shows up as a rectangle around her. This is not a preference: the first pass
  used art drawn on white paper, and the only way to hide the plate was to make the whole intro
  white, which is what the game does not look like.
- **Full body, standing, facing the viewer**, feet included and roughly centred. `.ftueHost`
  bottom-anchors her against the panel below, so a shot cropped at the ankles reads as floating.
- **Portrait, about 0.70** (the installed files are 844 × 1200). She is sized by *height*, and the
  bubble sits **above** her rather than beside her precisely because a figure tall enough to fill
  the scene is also wide enough to fill the column.
- `zara-face.png` is the exception: it is drawn into a 40px circle at `object-position: 50% 22%`,
  so it wants head and shoulders, centred, at 512 × 512.

## How they were made

Generated with Scenario (`model_bytedance-seedream-5-0-pro`) from a reference of the character,
then cut out with `model_photoroom-background-removal` and downscaled to 1200px tall. The same
rule the tile and card art run on applies: **the style block is locked and only the pose changes.**
Reusing it verbatim is what keeps four images looking like one character rather than four takes on
a brief. The block that produced these:

> Clean 2D cel-shaded character illustration in a modern comic / graphic-novel style: bold
> confident dark ink outlines, smooth flat colour fills with soft airbrushed shading, warm natural
> skin tones, crisp highlights. Full body, standing, feet fully visible, facing the viewer,
> centred, with headroom above her hair and floor space below her shoes. Plain flat off-white
> background with a soft subtle contact shadow under the shoes.
>
> CHARACTER: a young woman with warm fair skin, green eyes, defined dark eyebrows, small gold hoop
> earrings, and voluminous wavy blonde hair pulled up into a high ponytail with soft loose curls
> framing her face. She wears a crisp white button-down shirt with the collar open and the sleeves
> rolled to just below the elbow, a fitted black buttoned waistcoat with a tiny plain gold pin on
> the left chest, a brown leather belt with a square buckle, dark charcoal-grey tailored trousers,
> and dark brown leather brogue shoes.
>
> POSE: *(the only part that changes)*
>
> No text, no lettering, no numbers, no logos, no watermark, no border, no frame.

Generate on the off-white ground and remove it afterwards rather than asking for transparency
directly — the model paints a better-lit figure when it has a ground to light her against, and
Photoroom cuts the line art cleanly.

**Never ask for text.** The waistcoat's emblem is a plain gold pin for this reason: generated
lettering is the fastest way to make a character look wrong, and it would differ on every pose.
