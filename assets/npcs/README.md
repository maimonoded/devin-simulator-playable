# NPCs

The people from the series, standing on the board. Unlike a tile (which *is* the ground) and
unlike a prop (which sits still on one), an NPC is meant to **move between tiles**, and that is
what every rule below is really about.

```
assets/npcs/models/simon.glb      the male lead, in his street coat
assets/npcs/models/victoria.glb   the female lead
assets/npcs/models/carl.glb       the ex-fiancé
assets/npcs/raw/*.glb             what the generator returned, before normalization
```

## Who they are

Three characters out of [episodes/](../../episodes/) 001–018, picked to be told apart at
roughly 47 px:

| File | Character | Read |
|---|---|---|
| `simon.glb` | **Simon Jones** — the billionaire living rough while he builds a case against his own family | Olive overcoat, dark beanie, tan duffel. One big coat silhouette |
| `victoria.glb` | **Victoria** — jilted by Carl, needs a groom by Christmas, marries Simon to get one | Dusty rose coat, cream scarf, pale garment bag. The only warm-toned figure |
| `carl.glb` | **Carl** — the ex-fiancé, caught with her cousin, later thrown off Jones Airlines | Slate navy coat, sunglasses, phone at his ear, wheeled case. The only dark figure |

Simon is the **street** look, which is his for episodes 1–11 and the whole hook of the series.
A suited Simon for the reveal is the same prompt with one clause changed; it is deliberately
not generated yet, because the board is visible from turn one and a suit on it spoils episode 6.

The obvious fourth and fifth are **Victoria's mother** and **Grandma**. The cousin is the one
character to leave alone — she is unnamed in the scripts and would read as a second Victoria at
tile size, which is the only thing that actually matters at 47 px.

## The contract

| | |
|---|---|
| Footprint | normalized to 1 × 1, like a tile and a prop |
| Up axis | +Y |
| Origin | centre of the base — so the figure rests on whatever Y it is placed at |
| Triangles | 1900 / 1990 / 1900 |
| Texture | one baked 512² map each |
| Height as delivered | ~1.8 units, because normalization scales the **footprint** and a person is far taller than they are wide |

**Scale them by height, not by footprint.** This is the token's rule, not the mystery box's
(`js/ui/board3d.js` `setTokenHeight` vs `BOX_SIZE`), and for the same reason: a figure reads by
how tall it stands next to a tile. The delivered ~1.8 is an artefact of a 1 × 1 footprint fit
and means nothing on the board.

### Height is what keeps them from burying the player

The tile-art budget (`assets/tiles/ART-BRIEF.md` §2.2) exists because the far side of a ring
board is seen *through* the near side, so a tall piece hides the player's token on someone
else's tile. An NPC is worse than a tile in one specific way: it **walks**, so it can arrive in
front of the token rather than being placed clear of it once.

The budget for an occluder standing at its tile's centre works out to the token's own height,
and `cfg.tokenHeight` is 1.15 tile units. **0.75 is the number these were verified at** — it
reads unmistakably as a person beside the piece, and it cannot hide the piece from anywhere on
the ring, at any camera angle, ever. Going above ~1.1 gives that guarantee up.

### Facing is per-file, and Victoria is not like the other two

| File | Mesh fronts | Yaw offset needed |
|---|---|---|
| `simon.glb` | +Z | 0° |
| `carl.glb` | +Z | 0° |
| `victoria.glb` | **−X** | **+90°** |

+Z is the house convention (see the tile brief), and two of the three landed on it. Victoria did
not, and the reason is worth keeping because it will happen again on the next figure in a coat:

`normalize_tile.py` squares the model to the axes by fitting a minimum-area rectangle to the
**bottom 20% of its height** — a tile's floor. For a man in boots that band is two rectangular
feet and the fit is stable, so Simon squared by 4.0° and Carl by 13.5°. Victoria's coat hem is
almost circular, and the minimum-area rectangle around a circle is arbitrary: she squared by
**87.5°**, which is a quarter turn applied for no reason at all.

The check table passes either way — a footprint is 1 × 1 whichever way round the figure stands.
What gives it away is the *shape* of the footprint, since a person is wider across the shoulders
than front to back: Simon and Carl came back `(1.00, 0.78)` and `(1.00, 0.76)`, Victoria
`(0.77, 1.00)`. **When a figure's footprint is deeper than it is wide, it is a quarter turn out.**

So the offset is carried as data, in [npcs.js](npcs.js), the way `assets/env/scene.js` carries
`yaw` per piece — not baked into the mesh and never guessed at load. A future character in a long
coat or a dress will land somewhere else again, and one field in a manifest is cheaper than
re-generating an asset that is otherwise correct.

### Missing files are normal

Same contract as the tile art, the player piece and the mystery box: an absent or broken `.glb`
costs that one character and nothing else. `NPC3D._load()` warns and carries on, so the rest of
the cast still walks; a missing `npcs.js` leaves the board empty of people and otherwise intact.

## What draws them

[npcs.js](npcs.js) is the cast — who walks, where each starts, how fast, and the yaw offset.
[js/ui/npc3d.js](../../js/ui/npc3d.js) walks them: one tile at a time, clockwise, on the
**inner** edge of the ring, each with its own random dwell between steps so three figures do not
end up marching in formation. Everything timed is in `cfg` under the drawer's **NPCs** group.

They are scenery on purpose. They own no state, are not persisted, and cost nothing to meet —
which keeps them outside the event list that every other board effect reaches the player through
([js/tiles/README.md](../../js/tiles/README.md)). If they ever earn a mechanic it belongs in
[js/overlays/](../../js/overlays/) with the mystery box, resolving before the tile it stands on.

## How they were made

Scenario, via the [board-tile-art](../../claude-skills/) skill's pipeline, with the same two
deviations the [mystery box](../props/README.md) needed — and one more of their own:

- **No base-tile reference image.** A figure has nothing underneath it, so the cream slab is not
  passed and the prompt rules out a ground, plinth, pedestal and cast shadow.
- **The "everything is flat" rule is dropped.** It exists to stop a tile hiding the token; height
  here is governed by the 0.75 scale instead.
- **A front view, not the three-quarter view.** New. Tripo's `orientation: "align_image"` returns
  the mesh in the reference's frame, so a straight-on reference is what puts a figure's face on a
  predictable axis. The tiles' three-quarter reference is exactly why they arrive rotated 45–52°.

The style block is otherwise the locked one, and only the subject sentence changes between the
three — same rule as the board: three figures that each look good alone but do not stand together
are a failure.

Pipeline: `model_bfl-flux-2-dev` + the board LoRA at 0.8, 2 variants each →
`model_photoroom-background-removal` (`shadowMode: ""`) → `model_tripo-p1-image-to-3d`
(`faceLimit: 2000`, `pbr: false`) → `normalize_tile.py --max-tris 2400 --tex-size 512
--min-ground-ratio 0`.

`--min-ground-ratio 0` turns off the strip-shaped-ground warning. That check asks whether a
tile's ground fills its square, which a standing person's does not and should not; left on, all
three files warn about a problem none of them has.

`--max-tris 2400` sits above Tripo's `faceLimit: 2000` on purpose. The normalizer **refuses** to
decimate rather than silently trading a mesh for its UVs, so the budget has to be set at
generation — a `--max-tris` under what the generator returned fails the file instead of fixing it.

## Adding another character

Generate it the same way, normalize it, drop it in `models/`, and give it an entry wherever the
NPCs are listed. Then check two things on the board, because neither shows up in the report:

1. **Which way it faces**, against a figure you already trust. Put both on adjacent tiles at the
   same yaw — the one facing away is the one that needs an offset.
2. **That the token still reads** with the NPC standing between it and the camera.
