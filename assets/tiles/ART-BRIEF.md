# Tile art brief

Hand this to whoever produces the tile artwork. It is self-contained.

The board is a 40-tile ring drawn in **orthographic isometric** projection. Each tile is a
diamond. Art replaces the tile entirely, so a piece has to sit in that diamond exactly, or
neighbouring tiles won't line up.

---

## 1. The camera — the one thing that must be right

Render every asset with an **orthographic camera** (no perspective / no lens):

| Setting | Value |
|---|---|
| Projection | **Orthographic** — perspective breaks tiling |
| Azimuth (yaw) | **45°** — looking at the ground square corner-on |
| Elevation | **38° above the horizon** (= 52° down from vertical) |
| Roll | 0° |

⚠️ **This is not standard isometric.** The usual game-art preset is 30° elevation, which gives a
2 : 1 diamond. This board needs **38°**, which gives a **1.62 : 1** diamond. Art rendered at 30°
will not fit and cannot be corrected by scaling.

Every asset must use the identical camera. Same for the key light direction, so tiles look like
one place.

## 2. Geometry

One tile of ground renders as a diamond of exactly:

```
         ●                    width  : 200 px
      ╱     ╲                 height : 123 px
   ●           ●              ratio  : 1.62 : 1
      ╲     ╱                 (delivered at 3× for retina;
         ●                     on screen it is 66.9 × 41.2)
```

Rules:

- **Ground footprint = exactly one tile.** The ground diamond is 200 × 123 px. It must not spill
  into the neighbouring tiles — that is what made the first test piece collide.
- **Build upward, not sideways.** Height is free: a tower, a gate arch, a tree can rise well above
  the diamond and will correctly overlap the tile behind it. Width is not free.
- **Horizontally centred** in the canvas.
- **Bottom vertex of the ground diamond sits on the canvas bottom edge.** That is the anchor the
  engine positions by, so it must be consistent in every file.
- Any contact shadow stays **inside** the diamond, or it will darken the neighbouring tile.

## 3. Canvas & format

| | |
|---|---|
| Width | **200 px** (= the ground diamond width) |
| Height | whatever the piece needs — 200 px for something flat, up to ~400 px for something tall |
| Format | **PNG-24 with alpha**. Fully transparent background — no black, no matte |
| Colour | sRGB |

Deliver one file per tile, named by tile number: `1.png` … `40.png`.

## 4. Which tile is which

Numbering runs clockwise from Start (the bottom vertex of the diamond on screen).

| File | Tile | What it is |
|---|---|---|
| `1.png` | Start | the entrance / go-again tile |
| `11.png` | Spa | grants energy |
| `21.png` | VIP Lounge | pays out the accumulated pot |
| `31.png` | Premiere | sends the player back to Start |
| `6, 16, 26, 36.png` | Train | bonus coins |
| `4, 9, 14, 19, 24, 29.png` | Plot Twist | the card/chance tile |
| everything else | Standard | ordinary property tiles |

The four corners are the landmarks — they should read as bigger, distinct locations. The 26
standard tiles should be visually quieter so the corners and specials stand out.

## 5. Legibility

A tile is **66.9 × 41.2 px on screen**. That is small. The 3× delivery is for sharpness, not for
detail — anything under ~3 px in the delivered file disappears.

- bold silhouettes, strong value contrast
- no text, no thin outlines, no fine texture
- read the piece at 25% zoom: if it's mush, simplify it

## 6. Check before delivering

- [ ] Orthographic, 45° azimuth, **38° elevation** — same camera in every file
- [ ] Ground diamond exactly **200 × 123 px**, ratio 1.62 : 1
- [ ] Ground diamond horizontally centred, bottom vertex on the canvas bottom edge
- [ ] Nothing but height extends past the diamond's left/right vertices
- [ ] Transparent background, no baked matte
- [ ] Same light direction across the set
- [ ] Named `N.png`, `N` = tile number from the table above

**Fastest sanity test:** put two finished tiles side by side, offset the second by **+100 px
horizontally and +61.5 px vertically** (half the diamond width and height). Their grounds should
interlock into a continuous surface with no gap and no overlap. If they do, they'll tile on the
board.
