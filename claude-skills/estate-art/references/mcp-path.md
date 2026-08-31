# MCP path — exact calls

Pinned. Swapping a model mid-set changes the look of the set, so these ids are as much part of the
asset contract as the file format is.

## 1. Resolve team and project (once per session)

OAuth callers must pass `team_id` and `project_id` on every generation call, or:

```
Error: team_id and project_id are required for OAuth users.
```

```
scenario:teams_list(response_format="json")
```

Use `response_format="json"` — the markdown form omits the ids. One team with one project: use it
without asking.

## 2. Upload the source painting

The tier's existing art is the reference. Convert it to PNG first — `sips -s format png` — because
the upload is an image asset and WebP is not worth the risk here.

Files are ~250 KB, so use the multipart path: `scenario:upload_asset` with `file_size` and no
`data`, `curl -fS -X PUT -T <file> '<upload_url>'`, then `scenario:upload_asset_complete`. Do not
add `x-amz-checksum-*` headers; S3 returns 403 HeadersNotSigned.

**An upscale pass is not needed.** Tier 1 had one (`model_upscale-v3`, `upscaleFactor: 4`,
`style: "3d-rendered"`, `preset: "precise"`); tiers 2–6 skipped it and are no worse, because step 3
outputs at 2K regardless. It only mattered when step 3 was a straight conversion of the 384×512
original. **Skip it.**

## 3. The edit — roof off, or one thing changed

```
scenario:model_run(
  model_id   = "model_google-gemini-3-1-flash",
  parameters = {
    "prompt": "<see SKILL.md — the shape of this prompt is the whole skill>",
    "referenceImages": ["<asset id>"],
    "aspectRatio": "3:4",
    "resolution": "2K",
    "thinkingLevel": "HIGH",
    "numOutputs": 2
  },
  team_id = ..., project_id = ..., wait = true
)
```

For a TIER the reference is the tier's own painting. For a LEVEL it is **the previous level's
image** — that is what makes improvements accumulate rather than reset.

`numOutputs: 2` and look at both. Rejection is cheap here and expensive after image-to-3D. A
`status: "failure"` with one asset returned means one of the two failed; the other is usable.

## 4. Background removal

```
scenario:model_run(
  model_id   = "model_photoroom-background-removal",
  parameters = { "image": "<asset id>", "hdBackgroundRemoval": true, "shadowMode": "" }
)
```

`shadowMode` accepts `""`, `soft`, `hard`, `floating`. For 3D always `""` — a baked contact shadow
comes back as geometry.

## 5. Image → 3D

```
scenario:model_run(
  model_id   = "model_tripo-p1-image-to-3d",
  parameters = {
    "image": "<asset id from step 4>",
    "faceLimit": 12000,
    "pbr": false,
    "texture": true,
    "textureQuality": "detailed",
    "textureAlignment": "original_image",
    "orientation": "align_image",
    "enableImageAutofix": true,
    "autoSize": false
  },
  wait = false
)
scenario:jobs_wait(job_ids=["job_xxx"])
```

- `pbr: false` — PBR emits separate albedo/metal-rough/normal maps and **ignores the texture
  parameters entirely**. A single baked texture needs plain texturing.
- `faceLimit: 12000` — higher than the tiles' 2000 because a cutaway spends its triangles on an
  interior. At the tile budget the rooms come back as a smooth shell.
- `autoSize: false` — the engine fits the mesh on import; real-world metres are meaningless here.
- Takes 2–3 minutes. `jobs_wait` timing out is not an error; call it again with the pending ids.
  It can also fail transiently with `ERR_NAME_NOT_RESOLVED` or a server timeout — retry.

Several conversions can run at once: fire them with `wait=false` and pass all the job ids to one
`jobs_wait`.

## 6. Download

```
scenario:asset_download(asset_id=..., format="glb")
curl -sL -o assets/estate/models/tier3.glb "<signed url>"
```

Follow redirects. The url is signed and short-lived, so download promptly.

## Cost

Each estate file is three model calls: an edit, a cutout and a conversion. The conversion is the
expensive one at ~105 CU. A full tier with four extra levels is fifteen calls.

## Alternatives worth knowing

- **`model_rodin-hyper3d-v2-5`** — has `textureDelight`, which strips baked lighting from the
  source render. The estate references bake a warm interior light on purpose, so this is the lever
  if a tier ever looks double-lit once the engine lights it.
- **`model_hunyuan-3d-pro-i23d`** — explicit `LowPoly` generate type and topology control. Worth a
  look if cutaway interiors ever need to reconstruct more crisply than Tripo manages.

Treat either as a style version bump: re-run the whole estate, not one tier of it.
