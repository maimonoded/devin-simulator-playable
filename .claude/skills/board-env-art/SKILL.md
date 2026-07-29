---
name: board-env-art
description: Generate the environment AROUND a board — the island or plateau the board stands on, and the props in the world beyond it — as game-ready GLB, using Scenario (scenario.com) and conformed to the Harbour Heights environment asset contract. Use this whenever the user asks for a board environment, a new world/setting/biome for the board, the island or ground the board sits on, scenery or props around the board, or wants to re-skin the board's surroundings ("make it a desert town", "put the board on a snowy plateau", "add boats/trees around the board"). Also use when they mention assets/env, scene.js, normalize-env.py, a deck piece, or ART-BRIEF-ENV.md. Do NOT use for the 40 tiles on the board itself — that is board-tile-art.
---

# Board Environment Art

Produces the world around the board: a **deck piece** the board stands on, and **props** that sit
around it. Same generator path as `board-tile-art` — locked-style 2D reference, then image-to-3D —
but a different composition, a different contract, and a different normalizer.

The one thing that makes this workflow different from tiles: **a tile only has to look right, a
deck piece has to fit.** An 11×11 board sits on it, square and centred. That is a geometric
promise, and it is kept by conforming the file, not by eyeballing the render.

This skill is versioned **in this repo**, at `.claude/skills/board-env-art/`, so it arrives
with a clone and loads for anyone working here. That is deliberate: it is built entirely
around this board's contract and is meaningless elsewhere, and keeping it beside the brief and
the tool it depends on is what stops the three drifting apart.

## Read this first

The contract, the camera, the height rule and the placement manifest live in the project, not in
this skill, because the engine and the tests are written against them:

- **`assets/env/ART-BRIEF-ENV.md`** — §5 is the contract, §4 the height rule, §7 the manifest.
- **`assets/env/README.md`** — how the environment is wired and what the console will tell you.
- **`tools/normalize-env.py`** — the conform step. `--check` verifies a finished file.

Read §5 before generating anything. Everything below assumes it.

## The two kinds of piece

| | Deck piece | Prop |
|---|---|---|
| What | the ground the board stands on | boats, trees, rocks, buildings, anything else |
| Must guarantee | a flat square big enough for the board | nothing |
| Conform with | `normalize-env.py --deck` | `normalize-env.py` |
| Manifest | `{ model, at, y, deck: true }` | `{ model, at, y, size, yaw }` |
| Triangles | ≤ 4000 | ≤ 2000 |

An environment is **one deck piece plus a handful of props**. Resist putting the scenery into the
deck piece: anything standing on the deck ends up underneath the board, and anything on its near
rim stands between the camera and the front row of tiles.

## Step 0: check the connection and the team

Confirm the Scenario MCP tools are available. Then `teams_list` once per session — OAuth callers
must pass `team_id` and `project_id` on every generation call.

Exact calls, model IDs and parameters are in [mcp-path.md](mcp-path.md). Read it before the first
generation.

## Step 1: the 2D reference

Prompt = **subject sentence** + **style block**. The style block is the one from
`board-tile-art`, **with its composition clause replaced** — that clause is written for a tile and
is actively wrong here. Full text of both variants in [mcp-path.md](mcp-path.md).

Writing the subject sentence for a **deck piece**:

- **Describe a plot with an empty middle.** "A flat empty dusty lot, timber boardwalk running
  around its edge." Not "a town square with a bandstand" — the bandstand lands under the board.
- **Say the deck is flat, level and empty**, in those words. It is the single most important
  phrase in the prompt.
- **Deck ≥ four fifths of the width.** A generous rim looks good in the reference and then scales
  up with the deck until it fills the frame.
- **The rim is low.** One or two blocks. A tall rim on the near side hides the front row of tiles.
- **Isolate it**: "alone in empty space — no water, no ground plane, nothing underneath or around
  it." A baked ground slab becomes geometry that ends on a hard edge a few tiles out.

Writing the subject sentence for a **prop**:

- one clear object, 2–4 named parts, no scene around it
- same isolation clause
- height matters — check it against §4 for where it will stand

Generate **two variants** and look at both. Rejection is cheap here and expensive after
image-to-3D.

## Step 2: cut out the background

Photoroom, `hdBackgroundRemoval: true`, **`shadowMode: ""`**. The empty shadow mode is
deliberate: a baked contact shadow gets reconstructed as geometry, and then the engine lights and
shadows the piece again.

## Step 3: image → 3D

Tripo P1. `faceLimit` at the budget (4000 deck / 2000 prop), `pbr: false`, `orientation:
"align_image"`. Takes 2–3 minutes, so expect `status: "in_progress"` and follow with `jobs_wait`.

**The result will be rotated.** `align_image` orients the mesh to the reference's three-quarter
camera — measured at 50° and 52.6° on two different pieces, so it is systematic. Do not try to
correct it in the prompt or the manifest. Step 5 removes it.

## Step 4: download to `raw/`

`asset_download` gives a signed URL; `curl -L` it into `assets/env/raw/<name>.glb`. **Keep the raw
file.** Conforming is not reversible from the output, and a re-conform needs the original.

## Step 5: conform (never skip)

```bash
python3 tools/normalize-env.py assets/env/raw/NAME.glb --deck -o assets/env/models/NAME.glb
python3 tools/normalize-env.py assets/env/models/NAME.glb --deck --check
```

Zero dependencies — it parses the glTF directly. It measures the mesh, then writes the correction
as a transform on a new root node: **geometry, materials and the BIN chunk are copied byte for
byte**, so unlike the tile skill's `normalize_tile.py` it cannot cost you the baked texture.

It prints what it measured. Read those numbers — a deck that comes back at 0.72 × 0.74 is 2% out
of square, and that is a fact about the asset worth knowing before it is on screen.

**Always run `--check` afterwards.** It is not a formality: it caught a rotation-sign bug that
left a deck 10° off while every other measurement passed, because nothing else looked at the
angle.

## Step 6: place it

One line per piece in `assets/env/scene.js`. A deck piece takes no size, no rotation and no
anchor — those are the file's job now:

```js
{ model: "NAME", at: [0, 0], y: "deck", deck: true }
{ model: "PROP", at: [11.5, 1.5], y: -2.15, yaw: 60, size: 2.6 }
```

If a piece replaces the procedural terrain, turn that part off in `terrain`. If the environment
is not a harbour, set the ground colour there too — that is data, not code.

## Step 7: verify on the board, not in the viewer

Load the page and **read the console**. The engine reports, by name: a missing file, a piece off
screen, a bad datum, a prop over the sight-line budget, and — the one that matters — **a deck
that does not carry the board**, listing which of the ring's corners and edge midpoints missed
and by how much.

A silent console is the pass condition. Then look at it: the board should sit square, with an
even border of deck all the way round.

## What goes wrong, and what it looks like

Each of these cost a regeneration or a debugging session on the first environment:

| Symptom | Cause |
|---|---|
| Board sits crooked on the deck | the piece was never conformed, or was conformed from an already-conformed file |
| Deck is tiny under a huge island | the reference's deck was a small share of the piece |
| Something stands in the middle of the board | scenery was authored onto the deck |
| Front row of tiles hidden | rim or a near-side prop over the §4 height budget |
| Hard edge of ground a few tiles out | a ground slab was baked into the reference |
| Piece renders plain white | the texture was lost — you ran a mesh-rewriting normalizer |

## Batches

Work one piece at a time through Steps 1–5. Ask Scenario for a dry-run cost estimate before a
large set; image-to-3D is the expensive call. Keep the raw files — re-placing a piece should
never mean re-generating it.
