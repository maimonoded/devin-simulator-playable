# MCP path — exact calls

## 1. Resolve team and project (once per session)

OAuth callers must pass `team_id` and `project_id` on every generation call, or:

```
Error: team_id and project_id are required for OAuth users.
```

```
scenario:teams_list(response_format="json")
```

Use `response_format="json"` — the markdown form omits the IDs. One team with one project: use it without asking. Several: ask which, since assets landing in the wrong project are annoying to undo.

## 2. Generate the 2D reference

```
scenario:model_run(
  model_id   = "model_bfl-flux-2-dev",
  parameters = {
    "prompt": "<subject + style block>",
    "loras": ["model_JJ54CEwcWD5upeaCuLD83Ddh"],
    "lorasScale": [0.8],
    "referenceImages": ["<asset id of assets/base-tile.png>"],
    "width": 1024,
    "height": 1024,
    "numOutputs": 2
  },
  team_id = ..., project_id = ..., wait = true
)
```

The LoRA can't be run by its own ID — `model_run` with `model_id` set to the LoRA fails. It rides on the base model via `loras`. `scenario:model_schema_get` on any LoRA returns a `run_with` block naming its base.

Generate 2 variants and show both with `scenario:asset_display`. Reject rate is high — a stray tree, a cropped subject — and picking from two is much cheaper than re-running, especially before an image-to-3D call.

`referenceImages` takes up to 5 images. Pass exactly one — the base tile — so the model
receives the slab rather than inventing it. Upload `assets/base-tile.png` once with
`scenario:upload_asset` and reuse that asset id for the whole board; re-uploading per tile
wastes a call and risks pointing at the wrong image.

Use the **white-background** copy, not `base-tile-cutout.png`. Alpha in a reference image is
flattened before conditioning, often onto black, which biases the model's reading of the
cream slab.

`lorasScale: [0.8]` matches the run the base tile came from. Changing it changes how strongly
the LoRA reshapes the reference, so it is pinned alongside the model ids.

Skip `scenario:prompt_spark`. It rewrites prompts rather than lightly editing them, which breaks the locked style block.

## 3. Background removal

```
scenario:model_run(
  model_id   = "model_photoroom-background-removal",
  parameters = {
    "image": "<asset_id from step 2>",
    "hdBackgroundRemoval": true,
    "shadowMode": ""
  },
  team_id = ..., project_id = ...
)
```

`shadowMode` accepts `""`, `soft`, `hard`, `floating` — anything else returns a 400 naming the valid set. For 3D, always `""`.

## 4. Image to 3D

```
scenario:model_run(
  model_id   = "model_tripo-p1-image-to-3d",
  parameters = {
    "image": "<asset_id from step 3>",
    "faceLimit": 2000,
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

Notes on the parameters:

- `pbr: false` — PBR emits separate albedo/metal-rough/normal maps and **ignores the texture parameters entirely**. A single baked texture requires plain texturing.
- `autoSize: false` — real-world metre scaling is pointless here; `normalize_tile.py` sets the scale.
- `faceLimit` accepts 48-20000. Setting it to the budget helps, but doesn't guarantee triangles — verify after normalization.
- `orientation: "align_image"` rotates the model to match the source render — and the source render is a **three-quarter view**, so the plot's square ground comes back sitting diagonally, typically 45-52° off axis. The mesh is not wrong, but its axis-aligned bounding box is then the *diamond's* box, far larger than the floor inside it: one tile measured a 1.00 × 0.99 AABB around a floor that was really 0.70 × 0.76. Any engine that scales by the bounding box therefore renders the tile at ~70% with its floor skewed, so tiles meet at their corners instead of tiling. `normalize_tile.py` now detects this and squares the floor up; keep the flag, but never assume the delivered mesh is axis-aligned.

This takes ~2-3 minutes and will usually exceed the `model_run` wait window, returning `status: "in_progress"` with a job id. That is not a failure:

```
scenario:jobs_wait(job_ids=["job_xxx"], team_id=..., project_id=...)
```

`jobs_wait` blocks up to ~180s. If it returns `in_progress` again with `pending_job_ids`, call it again with those. Timeout is never an error.

## Alternatives worth knowing

- **`model_rodin-hyper3d-v2-5`** — has `textureDelight`, which strips baked lighting from the source render. The style block bakes a warm key light into the reference, so if tiles look double-lit once the engine lights them, this is the lever. Also offers explicit 2K-triangle quality tiers.
- **`model_hunyuan-3d-pro-i23d`** — has an explicit `LowPoly` generate type and triangle/quad topology control.
- **Text-to-3D** — skips the reference image. Cheaper, but no style anchor across a board. See SKILL.md Step 1.

Model IDs here are pinned deliberately. Swapping models mid-board changes the look. If one is retired, `scenario:recommend` finds a replacement — treat that as a style version bump and re-run the whole board.

## 5. Display and download

`scenario:asset_display(asset_id=...)` renders GLBs in an interactive viewer, not just images. Use `format="display"` for the first asset in a turn and `format="viewer"` for the rest — `display` duplicates what the widget already shows. Don't describe the result back in text; the user can see it.

`scenario:asset_download(asset_id=..., format="glb")` returns a signed CDN URL, valid for a limited window. Follow redirects when saving:

```bash
curl -L -o raw/11.glb "<signed url>"
```

On claude.ai this fetch fails with `x-deny-reason: host_not_allowed` unless the user has allowlisted `cdn.cloud.scenario.com`. Try it; on failure, hand over the link and the normalize command rather than silently stopping.

## Cost

`scenario:model_run` supports a dry run for cost estimation. Use it before any batch — image-to-3D is the expensive call, and a 40-tile board runs three model calls per tile.
