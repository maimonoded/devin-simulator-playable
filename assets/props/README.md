# Board props

Small 3D objects placed by the board rather than being part of it — the mystery box
([js/overlays/mystery-box.js](../../js/overlays/mystery-box.js)) sitting on a tile, and the VIP
treasure chest standing outside the ring.

```
assets/props/models/mystery-box.glb        plum — coins or energy inside
assets/props/models/mystery-box-gold.glb   gold — clues inside
assets/props/models/treasure-chest.glb     the VIP pool, shut
assets/props/models/treasure-chest-open.glb  the VIP pool, open, gold inside
```

## The treasure chest is two files because a generated mesh cannot hinge

Image-to-3D returns **one fused mesh with no separate lid node**, so a chest made this way
physically cannot open. The shut one and the open one are therefore two models and "opening" is a
swap — the same idiom as the box's plum/gold pair, where *the file is the state*. The swap is
covered by a point light coming up inside the chest, which is what the eye follows; splitting a
lid by hand in Blender would buy a real hinge at the cost of a manual step on every regeneration.

It opens when the **VIP Lounge pays out**, and at no other time. `Board3D.openChest(ms)` is
pushed from `playEvents` on the `chest` event that [vip-tile.js](../../js/tiles/vip-tile.js)
emits; `_tickChest` only renders whatever was last asked for and owns no state.

**It used to poll `state.vip` and open on any change, and that was a real bug even though the
animation worked.** The pool is seeded about ten times a pack — every lap past Start, every
arrival, every fine — and all of those happen with the token, and therefore the camera,
somewhere else, with this corner off the top of the frame. Nine openings in ten played to an
empty room and the tenth was over before the player looked up. The pay-out is the one moment
the player is standing here. Still never blocking: nothing in the pull loop waits for it.

**The two chests need different yaws, and that is not a bug.** `normalize_tile.py` squares a
model's floor to the axes, and squaring is modulo 90° — which quadrant a model ends up in is
arbitrary. These two were squared by 60.5° and 55.5° and came out a quarter-turn apart: the shut
one shows its clasp at 90°, the open one shows its coins at 0. `CHEST_YAW` is therefore a map
keyed by model, measured by rendering four clones of each at 0/90/180/270 and looking at them.
**Re-generate either model and the yaw has to be re-measured.** The lid is a barrel, so the two
wrong answers are not subtle — they present a blank arched end.

Placement is `CHEST_AT`, on the outward diagonal past the VIP corner, and the distance is
**measured rather than chosen**: it has to clear the plinth so the chest is not standing on the
board's lip, and stay inside the town, because further out it disappears *behind* the texas-town
storefronts. `cfg.chest` removes it — which is also the answer for the harbour world, where that
spot is open water.

Two boxes, because a box's contents are decided when it is **placed** rather than when it is
landed on, so the board can say which one is worth crossing to. See
[js/overlays/README.md](../../js/overlays/README.md). Gold falls back to the plum model before it
falls back to the cube: a wrong-coloured box still reads as a box, where a cube reads as missing
art.

### The gold box deliberately breaks the palette

The style block demands "muted dusty desaturated colours only, chalky and soft, never bright" —
and the first gold box obeyed it. On a pale cream deck at tile size, a muted gold is nearly
invisible next to the plum one; it read as "another box", which defeats the entire point of
showing contents on the board.

So this one is prompted **against** the house style: vivid saturated gold, with a deep burgundy
ribbon for internal contrast, because gold-on-cream is low contrast however bright the gold is.
`lorasScale` drops to 0.6 as well, since the LoRA is what pulls colours back toward the muted
board palette. A rarity marker is signage, not scenery — it is supposed to stand out.

Colour alone still was not enough at tile size, so the engine adds the rest (see
`_addBox`/`_tickBoxes` in [js/ui/board3d.js](../../js/ui/board3d.js), all tunable under the
drawer's "Gold (clue) box" group): it is **1.22×** the size of a plain box, **self-lit** via an
emissive so the sun angle cannot dull it, wrapped in an additive **halo** sprite, and it **turns
and bobs**. The motion is what the eye actually catches from across the board — the idle tick is
skipped while a throw or an opening is running, since those own the transforms.

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
