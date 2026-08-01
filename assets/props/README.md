# Board props

Small 3D objects that sit **on** a tile rather than being one. Today there is one: the mystery
box ([js/overlays/mystery-box.js](../../js/overlays/mystery-box.js)).

```
assets/props/models/mystery-box.glb        plum — coins or energy inside
assets/props/models/mystery-box-gold.glb   gold — clues inside
```

Two boxes, because a box's contents are decided when it is **placed** rather than when it is
landed on, so the board can say which one is worth crossing to. See
[js/overlays/README.md](../../js/overlays/README.md). Gold falls back to the plum model before it
falls back to the cube: a wrong-coloured box still reads as a box, where a cube reads as missing
art.

| | |
|---|---|
| Footprint | normalized to 1 × 1, like a tile |
| Up axis | +Y |
| Origin | centre of the base — so the model rests on whatever Y it is placed at |
| Triangles | 1181 |
| Texture | one baked 512² map |
| Size on the board | `BOX_SIZE` in [js/ui/board3d.js](../../js/ui/board3d.js), currently 0.42 tile units |

A prop is normalized exactly like a tile so the loader can treat it the same way, and then scaled
in code — `BOX_SIZE` is the only number that decides how big it looks, and it is in tile units, so
"0.42" means "a bit under half a tile".

**The file is optional.** If it is missing or fails to load, `Board3D._addBox()` falls back to the
plain cube the board used before it existed, and everything else works unchanged. That is the same
contract as the player piece and the tile art: absent art degrades the look, never the game.

## How it was made

Scenario, via the [board-tile-art](../../claude-skills/) skill, but **not** as a tile:

- **No base-tile reference image.** A tile is generated standing on a fixed cream slab so all
  forty share one ground. A prop must have nothing underneath it, so the slab reference is
  omitted and the prompt explicitly rules out a ground, plinth or shadow plane.
- **The style block's "everything is flat" rule is dropped.** That rule exists because a tall
  tile hides the player's token behind it. A prop that sits on a tile is meant to be a chunky
  object, so it keeps the palette and material language ("muted dusty desaturated colours, matte,
  one flat colour per surface") and loses the flatness.

Pipeline: `model_bfl-flux-2-dev` + the board LoRA at 0.8 → `model_photoroom-background-removal`
(`shadowMode: ""`) → `model_tripo-p1-image-to-3d` (`faceLimit: 1200`, `pbr: false`) →
`normalize_tile.py --max-tris 1500 --tex-size 512`.

Normalizing reported `floor squared by 53.5 deg` — Tripo's `orientation: "align_image"` returns
the mesh sitting diagonally because the reference is a three-quarter view, so its raw bounding box
is the diamond's box rather than the object's. The script corrects it; a loader that scaled by the
raw AABB would render the prop about 70% of its intended size.

## Adding another prop

Generate it the same way, normalize it, drop it in `models/`, and give it a `*_MODEL` path and a
size constant in `board3d.js`. Keep the fallback: the board should still work with the folder
empty.
