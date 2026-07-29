# MCP path — exact calls

Model IDs are pinned deliberately, and are the same ones `board-tile-art` uses. Swapping a model
changes the look, and the environment has to sit with the tiles.

## 1. Resolve team and project (once per session)

```
scenario:teams_list(response_format="json")
```

OAuth callers must pass `team_id` and `project_id` on every generation call or it errors. Use
`response_format="json"` — the markdown form omits the IDs.

## 2. The style block

Take the block from `board-tile-art` verbatim **except the composition clause**. The tile version
reads:

> Three-quarter view looking down at about 40 degrees onto a full square plot of ground; the whole
> square base is visible, open ground across the front half, **the tall mass set against the back
> edge.**

That last clause is what puts a rock tower in the middle of a deck. For an environment piece use:

> Three-quarter view looking down at about 40 degrees onto a full square plot of ground; the whole
> square base is visible, **the top surface completely flat, level and empty, every detail confined
> to the outer rim.**

Everything after it is unchanged and must stay word for word:

```
Everything built from 3-8 chunky stacked primitives, every corner beveled and rounded, no sharp
edges anywhere. Toy-sized proportions: doors too small, roofs too fat, nothing architecturally
correct. Matte plastic material with a soft specular pop, flat single color per surface, no
texture detail, no PBR realism. One warm key light from the upper left, cool fill light. Bright
daytime. Clean neutral background.
```

For a **prop** the composition clause becomes simply:

> Three-quarter view looking down at about 40 degrees; the whole piece visible, nothing cropped.

## 3. Generate the reference

```
scenario:model_run(
  model_id   = "model_bfl-flux-2-dev",
  parameters = {
    "prompt": "<subject + style block>",
    "loras": ["model_JJ54CEwcWD5upeaCuLD83Ddh"],
    "width": 1024, "height": 1024, "numOutputs": 2
  },
  team_id = ..., project_id = ..., wait = true
)
```

The LoRA cannot be run as `model_id`; it rides on the base model via `loras`.

Two outputs, always. Look at both with `asset_display` before spending an image-to-3D call.

Skip `prompt_spark` — it rewrites rather than edits, and it will not leave the style block alone.

## 4. Background removal

```
scenario:model_run(
  model_id   = "model_photoroom-background-removal",
  parameters = { "image": "<asset_id>", "hdBackgroundRemoval": true, "shadowMode": "" },
  team_id = ..., project_id = ...
)
```

`shadowMode` accepts `""`, `soft`, `hard`, `floating`. For 3D it is always `""`.

## 5. Image to 3D

```
scenario:model_run(
  model_id   = "model_tripo-p1-image-to-3d",
  parameters = {
    "image": "<asset_id from step 4>",
    "faceLimit": 4000,           # deck piece; 2000 for a prop
    "pbr": false,
    "texture": true,
    "textureQuality": "detailed",
    "textureAlignment": "original_image",
    "orientation": "align_image",
    "enableImageAutofix": true,
    "autoSize": false
  },
  team_id = ..., project_id = ..., wait = true
)
```

- `pbr: false` — PBR emits separate albedo/metal-rough/normal maps and ignores the texture
  parameters. The contract wants one baked texture.
- `autoSize: false` — real-world metre scaling is pointless; `normalize-env.py` sets the scale.
- `orientation: "align_image"` — aligns the mesh to the reference's camera. **This is what makes
  the result arrive rotated** (50° and 52.6° measured on two pieces). Keep it anyway: the
  alternative orientations are less predictable, and the conform step removes rotation exactly.

Expect `status: "in_progress"` after ~75s. That is not a failure:

```
scenario:jobs_wait(job_ids=["job_xxx"], team_id=..., project_id=...)
```

## 6. Download

```
scenario:asset_download(asset_id=..., format="glb")
curl -L -o assets/env/raw/<name>.glb "<signed url>"
```

The URL is signed and short-lived. Save straight into `raw/` — `models/` holds the conformed file
and is written by the normalizer, never by curl.

## Cost

`model_run` supports `dry_run=true`. Image-to-3D is the expensive call — roughly 105 credits
against 32 for a two-output reference — so it is worth a dry run before a set of pieces, and worth
rejecting a weak reference rather than "seeing how it reconstructs".
