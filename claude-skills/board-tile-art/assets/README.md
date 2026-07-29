# Base tile

`base-tile.png` is the fixed reference for every generation. It is passed as
`referenceImages[0]` on every tile and is never regenerated per tile — holding
it fixed is the whole point.

Use the **white-background** version for referencing, not the cutout. Alpha in
a reference image gets flattened before conditioning, often onto black, which
drags the model's reading of the cream slab in exactly the direction drift is
least wanted.

`base-tile-cutout.png` is the same tile with a real alpha channel. Nothing in
the current pipeline uses it; it is the input for building a canonical base
mesh if the composition approach is ever adopted.

Measured slab colour: **#F4EDDD** (top face median). That is the number the
rest of the skill quotes, because it is what the reference actually contains.

Provenance: Flux 2 dev + LoRA model_JJ54CEwcWD5upeaCuLD83Ddh at scale 0.8,
generated from a liked tile via referenceImages, then background-removed for
the cutout. Scenario assets asset_hTCpPBGuJ7gbxps6nz1XBUkB (with background)
and asset_mZ66BjyME2YawzL8LNhRyqZg (cutout).
