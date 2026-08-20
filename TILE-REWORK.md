# Tile rework — the list

Changes to tile logic, collected here first and then built in one pass.

**All four items below are now BUILT** — this file is kept as the record of what was decided and
why, including the questions that were answered along the way and the ones the code forced. New
items go on the end the same way: written down first, built when the list is ready.

One section per item. Each records the rule as decided, what it replaces, what it touches, and any
question that has to be answered before it can be written. Open questions are marked **?** — they
are not objections, just the things the code will force a decision on.

The board as it stands today — every index, type and printed value — is [TILES.md](TILES.md).

| # | Item | Status |
|---|---|---|
| 1 | [The Spa corner](#1--the-spa-corner) | **built** — 1a chosen; the wheel (1b) is still on the table as a later replacement |
| 2 | [Real art for the three named corners](#2--real-art-for-the-three-named-corners) | **built** — `11/21/31.glb` |
| 3 | [The train tiles become an airplane](#3--the-train-tiles-become-an-airplane) | **built** — `6/16/26/36.glb`, copy renamed to Flight bonus |
| 4 | [A treasure chest behind the VIP Lounge](#4--a-treasure-chest-behind-the-vip-lounge) | **built** — two models, ambient open/glow/shut |

---

## 1 · The Spa corner

**Settled: 1a was chosen and built.** Two directions were on the table — the corner keeps granting
cards but pays what you pulled ([1a](#1a--spa-pays-the-card-that-landed-you-on-it)), or it stops
being a card grant altogether and becomes a **wheel** ([1b](#1b--or-the-spa-becomes-a-wheel)).

**1b is kept below rather than deleted**, because it is still a live option for later: nothing in
1a forecloses it, and the expensive half of 1a — putting the pulled card on the landing context —
is the half a wheel would need too.

### 1a · Spa pays the card that landed you on it

**The rule.** The Spa tile **always** grants extra cards, and the number granted is the **rank of
the card that moved the player onto it** — land on Spa with an 8 and you get 8 cards. If it was a
**joker**, the grant is **15 standard cards**, drawn at random.

"Standard" here names the *deck type*, not the card: the pack we ship today is the **standard
deck**, and more deck types are coming. This is the first place that vocabulary appears in the
game's rules, so it is worth fixing now — see [the deck-type question](#deck-types) below.

#### What it replaces

Today the Spa deals a flat `cfg.spaCards` — which ships at **1** — through
`BoardActor.gainCards()` → `Shoe.dealFree()`. Two behaviours go away with this change:

- **The grant is fixed.** One card, whatever brought you there.
- **The grant is capped, so it is often nothing.** `dealFree` tops up *toward* `cfg.packSize` and
  never past it, so on a shoe at or above 64 cards — the ordinary state right after buying a pack,
  since a purchase merges onto the leftovers — the Spa deals **zero**. "Always gives extra cards"
  is a direct reversal of that, and it is the load-bearing half of this item.

#### What it does to the clock

The deck is the whole clock, so this is an economy change before it is a tile change. Measured over
20,000 simulated packs, dealing granted cards back into the shoe so they can be pulled again:

| | Today | After |
|---|---|---|
| Cards granted per 64-card pack | 1.3 | **11.1** |
| Average grant per Spa landing | 1.0 (0 on a full shoe) | **7.1** |
| Spa landings per pack | 1.30 | 1.56 |
| **Pulls a 64-card pack is worth** | **64** | **75.1** |

So a pack lasts about **17% longer**, and that is compounding rather than additive: granted cards
are themselves pulls that can land on Spa again. The average grant lands at 7.1 rather than 7.0
because a longer pack drifts the landing-rank distribution very slightly; the ranks that reach Spa
are otherwise uniform over 1–13.

Worth deciding deliberately, because the free-card rate (`cfg.cardRegenMin`) is the game's pacing
knob and this quietly turns it by 17%. If pacing should hold, that is a compensating change to
`cardRegenMin` in the same pass.

#### What it touches

- **[js/tiles/spa-tile.js](js/tiles/spa-tile.js)** — the whole tile, rewritten. Its header comment
  explains the grant of 1 and stops being true.
- **The landing context — this is the real work.** `onLand(ctx)` receives `{pos, mult, bs}` and
  **the pulled card is not in it**. `resolveLandingEvents(mult)` in [js/game.js:25](js/game.js:25)
  doesn't take one either; `pull()` in [js/ui/main.js](js/ui/main.js) has the card in a local and
  calls `await playEvents(resolveLandingEvents(1))` without it. So the card (or its rank) has to be
  threaded through both, and `ctx` gains a field every tile type can see. That is the one edit here
  that reaches outside `js/tiles/`, and it is worth doing as its own step: *any* later tile rule
  that wants to know what card brought the player here needs the same field.
- **The cap.** `gainCards` is shared with every other card grant, so the Spa needs an uncapped path
  rather than a changed `dealFree` — CLAUDE.md's "the shoe may exceed the cap" rule names four
  enforcement sites and two of them are deliberately "do nothing" comments. `Shoe.buyPack()` is the
  existing precedent for a grant that never clamps.
- **The reporting text.** Today the float, the log line and the reveal are all built from `n` (the
  intended grant), not from what was dealt, so on a full shoe the board says "+1🃏" while dealing
  nothing. Under "always grants" they converge — but the number is now variable, so all three must
  be built from what actually landed. `gainCards`'s own default text already does this
  (`"+"+got+"🃏"`); the Spa currently overrides it.
- **`cfg.spaCards`** becomes dead. Either remove it (and its drawer row) or repurpose it as a
  multiplier on the rank. The **15** for a joker should not be a literal — everything tunable lives
  in `cfg` and appears in the drawer.
- **[tests/suites/](tests/suites/)** — the tile tests assert the flat grant and the cap behaviour.

#### Open questions

**? The joker branch is unreachable as the game stands.** A joker moves nothing (`Shoe.rank()`
returns 0 for it) and `pull()` **returns early** on a ticket card, before `resolveLandingEvents()`
is ever called — deliberately, because otherwise the landing would re-resolve the tile the token is
already standing on and re-collect any mystery box there. So today no joker can put anyone on the
Spa. The rule needs one of:

- it is written now for a **future** in which jokers move or the deck gains cards that do; or
- "landed on Spa with a joker" actually means something else — e.g. **pulling a joker while already
  standing on Spa**, which would need the early return to gain an exception; or
- it is speculative and the branch waits.

Worth answering early: the third option is free, the second one touches the rule that stops the
mystery box being double-collected.

<a name="deck-types"></a>**? What "15 standard cards, random" draws from.** Free cards today are
not random — `dealFree` deals off `state.packTail`, the undealt remainder of a minted pack, so a
trickle of free cards carries its proper share of jokers and a session boundary cannot round them
away. That is the ticket-density invariant the economy rests on. Two readings:

- **15 cards off the tail**, as every other free card is dealt — keeps the invariant, and about 3
  of the 15 would be jokers at today's 12-per-64 density.
- **15 random *numbered* cards**, minted outside a pack — 15 cards with no ticket share, which is
  the first path in the game that mints a loose card outside a pack. `Shoe.mintPack()`'s header
  says there is deliberately no such path today.

The same question decides whether the **rank-based** grant is drawn the same way, and it is really
one question: *does a Spa grant carry tickets?*

**? What "standard deck" will mean as a type.** Nothing in the code has a deck type yet — there is
one pack shape (52 numbered + `ticketsPerPack` jokers) and `Shoe.mintPack()` is the only thing that
builds it. If decks are about to become plural, the Spa's grant is the first rule that has to name
one, and it is worth knowing whether a deck type is a different *card set*, a different *joker
count*, or both before the Spa hard-codes "standard".

### 1b · …or the Spa becomes a wheel

**A direction, not a spec.** Instead of granting cards, the corner spins a **wheel** for a prize.
Nothing about what is on it, how it is weighted, or what it pays has been decided — this section
exists so the option is on the record, and so the notes below don't have to be rediscovered when we
come back to it.

**Most of 1a stops applying**, including everything about the shoe cap and the ticket-density
question — a wheel that pays coins never touches the shoe. **The landing-context change survives
either way** if the wheel's outcome depends at all on the card that brought you there (number of
spins, a multiplier, which wheel you get), which is worth knowing because it is the expensive half
of 1a.

Three things the codebase already settles, so they are not open questions:

- **There is a pattern for this, and it is the train tile.** A tile that opens a full-frame game
  over the board is [js/tiles/train-tile.js](js/tiles/train-tile.js) plus a page in
  [minigames/](minigames/README.md), talking over `postMessage`. **The engine owns the money**: the
  tile picks the outcome and banks the coins *before* the game opens, and the game is handed a
  finished number purely to present it. A wheel would be built the same way — it reveals a result,
  it never rolls one. A missing or broken game degrades to the Collect popup, so it can never cost
  the player anything.
- **A weighted prize table already has a shape.** `twistDeck` and `boxTable` in
  [js/config.js](js/config.js:220) are both `{name, weight, …}` lists that the tuning drawer edits
  live and the economy model owns. A wheel's segments are that same shape, and should be that same
  shape.
- **It blocks the pull loop.** Any `minigame`/`reveal`/`collect` event stops auto-pull until it
  resolves, which is why every timing in the game is a config key rather than a literal — and why
  the auto-play *session* mode takes the Collect fast path instead of opening a WebGL page per pull.

The one genuinely open thing, whenever we pick this up: **what a wheel is for**. The board already
has a coin-prize tile with a bonus game (train), a weighted-prize card tile (Plot Twist), and a
pooled jackpot (VIP). If the wheel pays coins it overlaps all three; the Spa's current job — the
only tile that hands back *cards*, the thing the clock is actually made of — is the one that has no
substitute elsewhere on the board.

---

## 2 · Real art for the three named corners

**The job.** Generate real tile models for **Spa** (`11.glb`), **VIP Lounge** (`21.glb`) and **The
Premiere** (`31.glb`) with the [board-tile-art](claude-skills/board-tile-art) skill on the Scenario
MCP server. Art only — no logic changes.

All three currently carry the **shared placeholder**: `11/21/31.glb` are byte-identical to the copy
sitting on 35 of the 40 tiles, so the game's three most important landmarks are indistinguishable
from ordinary ground. Worse for these three than for a standard tile, because a tile with a model
**loses its emoji** (`showIcon()` in [js/ui/render.js](js/ui/render.js:78)) — so 💆 / 🌟 / 🎭 are
already suppressed and nothing is standing in for them.

Start (`1.glb`) already has its own model, so finishing these three completes the four corners.

### The pipeline, in the order it has to run

Per tile, one at a time — five steps, from the skill:

1. **2D reference**, 1024², with `assets/base-tile.png` passed as `referenceImages[0]`. The slab is
   *supplied*, never regenerated, which is what stops the cream drifting between tiles. Check the
   bare slab colour on the reference against **#F4EDDD** before paying for the 3D call.
2. **Background cutout** — Photoroom, `hdBackgroundRemoval: true`, `shadowMode: ""` (an empty
   shadow mode on purpose: a baked contact shadow gets rebuilt as geometry and then lit again).
3. **Image → 3D** — Tripo P1, `faceLimit: 2000`, `pbr: false`. Takes 2–3 min, so it returns
   `in_progress` and needs `jobs_wait`.
4. **Download** the GLB.
5. **Normalize** — `scripts/normalize_tile.py`, never skipped. Relay the whole check table
   **including `WARNING:` lines**; the two warnings that don't fail the file are exactly the two
   faults that pass every measurement and still sit wrong on a board (strip-shaped ground, over
   height budget).

Then **look at one tile in the engine before generating the other two** — with the token on it,
while that tile is on the *far* side of the board. Every failure the skill documents passed the
check table and was only visible on screen.

### The constraints that actually bite

- **Flat, not merely short.** Object ≤ 0.2 tile units, checked at 0.3 to allow for the slab. This
  board's camera is 38° elevation with the token top at 0.53 — a tall corner piece hides the token
  on *someone else's* tile, which is why it survives every per-tile check.
- **The subject sentence describes the object only.** The base is supplied, so any mention of
  paving, grass, a plot or a rim re-specifies the slab and invites the model to replace it.
- **2–4 chunky primitives, muted and desaturated, and name the side meant to be read** — the engine
  yaws each tile to face out of the ring, so a piece with no clear front shows its flank.
- **Don't raise `--max-tris` to rescue a failure.** Decimation drops UVs and the script refuses
  rather than trading an over-budget tile for a white one; the fix is upstream, at Tripo's
  `faceLimit`.
- Ask Scenario for a **dry-run cost estimate** first — image-to-3D is the expensive call.

### Draft subjects

Spa's is already written, in
[board.example.json](claude-skills/board-tile-art/board.example.json) (tile 11, role Spa). The
other two are drafts to argue with, not decisions — both deliberately choose things that are
*inherently* flat, since the generator builds upward at the slightest excuse:

| File | Tile | Subject |
|---|---|---|
| `11.glb` | Spa | *"A shallow round turquoise plunge basin with two rolled white towels beside it"* — already in the manifest |
| `21.glb` | VIP Lounge | draft: *"A low flat gold star lying face-up, with two short coiled dusty-red velvet ropes resting beside it"* — a stanchion would stand upright, so the rope is coiled on the ground instead |
| `31.glb` | Premiere | draft: *"A short strip of dusty red carpet laid flat, with a small closed clapperboard resting on it and a low folded velvet rope along one edge"* — a carpet is the one premiere object that is flat by nature |

Add all three to a real `board.json` when we run it, so the set stays reproducible and a later
style bump can re-run the whole board rather than mixing versions.

---

## 3 · The train tiles become an airplane

**The job.** One real tile model for the four train tiles — **an airplane, not a train** — and
**all four tiles carry the same art**: `6.glb`, `16.glb`, `26.glb`, `36.glb` (indices 5, 15, 25,
35). Same pipeline and same constraints as [item 2](#2--real-art-for-the-three-named-corners).

### Same art means four identical files

There is no sharing mechanism: `tileModelPath(i)` maps each index to its own filename, so identical
art is one generation copied to four names. That is a **supported pattern rather than a workaround**
— it is exactly what the placeholder does on 35 tiles today — with two consequences worth knowing:

- **It costs one generation, not four.** The expensive call is image-to-3D, so the four train tiles
  are the cheapest art on the board.
- **A re-generation means re-copying all four.** Nothing detects that `16.glb` has fallen behind
  `6.glb`; they are just four files. Regenerate once, then copy, and check with
  `md5 -q assets/tiles/models/{6,16,26,36}.glb | sort -u` — one line out means all four match.

They will not read as copy-paste on the board, because `_tileYaw()` gives each board edge a
different rotation: the same plane points out of the ring four different ways.

### The name is about to disagree with the art

Nothing breaks, but "train" is written in a lot of places and none of them will say airplane:

| Where | What it says | Player-facing? |
|---|---|---|
| [js/tiles/train-tile.js](js/tiles/train-tile.js) | log lines *"Train bonus"* / *"**Big** train bonus"*, and the float `🚗 +…` | **yes** |
| [js/ui/minigame.js](js/ui/minigame.js:19) | game ids `train-small` / `train-large` | no |
| [js/board-model.js](js/board-model.js) | the tile **type** `train` | no |
| [css/board.css:53](css/board.css:53), [js/ui/board3d.js:64](js/ui/board3d.js:64) | `.tile.train`, the `train: 0x2a2f66` palette entry | no |
| [minigames/README.md](minigames/README.md), [TILES.md](TILES.md), CLAUDE.md | prose and tables | docs |

The split to make is the one the repo already made for `deck`: **keep the type name, change the
copy.** Renaming the type would reach the 3D palette, the CSS and the mini-game registry for no
gain, exactly as renaming `deck` would. So the decision is only about the **two log strings and the
icon** — *"Flight bonus"* / *"Big flight bonus"* and ✈️, plus the tables in TILES.md.

Worth noting the icon is already wrong in the other direction: the train tile's emoji is **🚗, a
car**. And it is moot on the board itself — a tile with a model suppresses its emoji — so it only
shows in the legacy CSS board and in the docs.

**? Does the copy change with the art, or does the art just become an airplane on a tile still
called a train bonus?** Both are defensible; the second is zero code.

### Draft subject

The hard part is that an airplane is a *tall* subject and this board's ceiling is 0.2 tile units.
A fuselage with an upright tail fin is exactly the shape the generator wants to build and exactly
what hides the token on the far side of the board. So the subject has to specify a plane that is
flat by construction — seen from above, belly-down, wings doing the work:

> *"A small chunky toy airplane lying belly-down and seen from above, with short stubby swept wings
> and a tiny rounded tail, in muted dusty white and pale blue, nose pointing forward"*

Explicitly rule out an upright tail fin, landing gear and a raised cockpit when the prompt is
written — those are the three parts that will stand up on their own. Nose is the readable front, so
it points **+Z**.

---

## 4 · A treasure chest behind the VIP Lounge

**The job.** A **brown treasure chest**, 3D model, with two states: a **standard** state (shut), and
a **filling** state that **opens the lid, glows the coins inside, and shuts it again**.

**It does not stand on the tile.** It sits **beyond the ring**, out past the VIP corner in the
world — where the texas-town scene currently shows a tree, part of which it will cover.

It is the natural piece of art for that corner: the VIP Lounge is the board's only *pot*, and right
now the pool it holds is invisible until you land on it — the readout lives on the HUD, off the
board entirely. Putting it outside the ring is also what makes it affordable: it neither shares the
square with the token nor competes with the tile's own art.

### Where it goes

The VIP corner is the **far vertex** of the diamond — tile 20 sits at world `(-5.5, -5.5)`, and the
world is measured in tiles with the ring's edges at ±5.5. Beyond it come the plinth (±6.0) and the
island (±7.5), so the chest lands somewhere around **`at: [-6.5, -6.5]`**, in the quay band on the
outward diagonal. That is the band the tree is standing in.

Two rules it has to satisfy, both already expressed in [js/env-model.js](js/env-model.js):

- **Visible at every window shape** — `envVisible()` guarantees only the diamond `|x−z| ≤ 11·m` and
  `|x+z| ≤ 11·m`, where `m` is `cfg.envMargin` (**1.7** at ship). At `(-6.5, -6.5)` that is 13
  against 18.7, so it is comfortably inside — but `envMargin` is a live drawer knob that trades
  board size against visible ground, and **dropping it below ~1.18 pushes the chest off screen**.
  Worth a look in `?view=mobile` too, where the 9:16 frame is the tightest case.
- **Under the sight line** — `envMaxTop()` caps a piece's height by how much board it could hide.
  Out past the far vertex there is no board behind it at all, so it is capped only by the frame:
  `ENV_Y.deck + ENV_FRAME_H` = **3.0 world units**, about three tiles. This is the one piece of art
  in the whole list with room to be tall.

### Whose thing is it — the world's, or the board's?

Neither category quite fits today, and this is the choice to make first:

- **An environment piece** ([assets/env/scene.js](assets/env/scene.js)) is data: `{model, at, y,
  yaw, size}` in the scene's `pieces`, conformed by `tools/normalize-env.py` — a different
  contract from the prop normalizer. But env pieces are **static scenery**; `env3d.js` places them
  and forgets them, so nothing there can drive a lid off `state.vip`.
- **A board prop** ([assets/props/](assets/props/README.md)) is what the mystery box is: a
  `*_MODEL` path and a size constant in [js/ui/board3d.js](js/ui/board3d.js), placed and animated
  in code, **optional** with a plain-cube fallback. Its FX machinery — throws, scale restore,
  idle tick — already exists.

**Recommend the prop route, placed at world coordinates rather than on a tile.** It is board-relative
so it follows the board into any world, it can animate today, and it reuses the box's tick. The cost
is that the chest is then unaware of the scenery it is standing in — see the question below.

**? The tree is baked into the world.** Each scene is one conformed GLB (`texas-town`, `island`), so
the tree cannot be removed or moved — the chest simply overlaps it, which is what was asked for. But
`cfg.envScene` switches worlds live, and in the harbour scene that same spot is **open water**. So:
does the chest follow the board into every world (and float in the harbour), or is it placed
per-scene and absent from worlds that have nowhere to put it?

### It holds no state

`state.vip` already exists and is already persisted; the chest is a *view* of it. Nothing is added
to `serializeState()`, and the chest must never write to the pool — the same rule that keeps the
NPCs harmless (CLAUDE.md: a figure that moved coins from outside the event list is the one thing
that could desync the economy from what the player was shown). It is also **not** an
[overlay](js/overlays/README.md): overlays are things you land on and consume.

### The hard part: a generated mesh cannot open

The art pipeline (Tripo image-to-3D) returns **one fused mesh with no separate lid node**, so a
chest generated the usual way physically cannot hinge. Three ways out, cheapest first:

1. **Two models** — `treasure-chest.glb` and `treasure-chest-open.glb` — swapped, with the glow and
   a short bob covering the cut. This is the repo's existing idiom: the mystery box already ships
   as two files (`mystery-box.glb` / `mystery-box-gold.glb`) precisely because *the file is the
   state*. Cheapest, and it survives the fallback rule cleanly (open falls back to shut, shut falls
   back to the cube).
2. **Split the lid by hand** in Blender after generation, into a two-node GLB the code can rotate.
   One real animation instead of a swap, at the cost of a manual step that has to be repeated on
   every regeneration.
3. **Never open it** — the lid stays shut and the "filling" is a glow through the seam plus a coin
   burst above it. Zero modelling risk; least of what was asked for.

**? Which of the three.** Recommend 1 unless the lid motion is the point, in which case 2.

Because it stands outside the ring, it does **not** collide with
[item 2](#2--real-art-for-the-three-named-corners): `21.glb` keeps its own art, the token still has
its square, and the two are read together — the Lounge on the board, its takings behind it.

### Frequency is the thing that will make or break it

Measured over 200k packs: the VIP pool is seeded **≈9.7 times per 64-card pack** — every lap past
Start, every arrival at Start, every Premiere sweep, every Advance card, every fine. That is
**roughly once every 6–7 pulls**.

So the filling animation **must be ambient and non-blocking**. It cannot go through the blocking
event vocabulary (`reveal`, `collect`, `card`, `boxOpen`) or auto-pull will stop dead ten times a
pack, and a two-second open-glow-close every six pulls would be intolerable even by hand. Build it
as a tick-driven flourish like the gold box's turn-and-bob, skipped while anything else owns the
transforms.

Three timings and a scale go in `cfg` with drawer rows — everything timed is tunable, no literals.

**? The pay-out is the better beat, and it is not in the brief.** The chest opens ~9.7 times a pack
to accept a seed, but the pool is *emptied* only **1.35 times a pack**, for an average of **479
coins** — that is the rare, dramatic moment, and it is the one the animation is describing when it
opens a chest and shows the gold. Worth considering: a small shimmer on fill, and the full
open-glow-close on collect.

### Making the model

Prop pipeline, not the tile one — the differences are in
[assets/props/README.md](assets/props/README.md) and they matter. (If it goes in as an environment
piece instead, it is `tools/normalize-env.py` and the env contract rather than the below; the
generation half is the same either way.)

- **No `assets/base-tile.png` reference.** A tile is generated standing on the fixed cream slab; a
  prop must have nothing underneath it, so the slab is omitted and the prompt rules out a ground,
  plinth or shadow plane.
- **The "everything is flat" rule is dropped** — a prop is meant to be chunky. It keeps the
  palette and material language, and loses the flatness.
- Pipeline: flux + board LoRA at 0.8 → Photoroom (`shadowMode: ""`) → Tripo
  (`faceLimit: 1200`, `pbr: false`) → `normalize_tile.py --max-tris 1500 --tex-size 512`.
- Expect `floor squared by N deg` in the report — Tripo returns the mesh sitting diagonally
  because the reference is a three-quarter view. The script corrects it; a loader scaling by the
  raw AABB would render the prop ~70% of its intended size.

Draft subject: *"A small chunky closed wooden treasure chest with a domed lid, muted dusty brown
with dark iron bands and a small iron clasp, front facing forward"* — and the open variant as the
same chest with the lid tilted back, gold coins heaped inside.

Unlike a tile, its **yaw is free** (the boats in the harbour scene set theirs by eye), and the front
should be turned to face the **camera** — down the diagonal toward Start — rather than the +Z the
tile loader assumes. A chest read from behind is a brown box.

One palette note before choosing the brown: the gold mystery box **deliberately breaks** the house
style because a muted gold on the cream deck was nearly invisible at tile size. A dusty brown chest
on cream is a similar contrast problem — it may need the same treatment (a darker, more saturated
wood, iron bands for internal contrast) to read from across the board.


---

## What was actually built, and what the build changed

Recorded because three of the decisions were made against the code rather than in front of it.

**1a — the Spa.** `ctx.card` now reaches every tile: `pull()` passes the pulled card into
`resolveLandingEvents(mult, card)`, which puts it on the landing context. The Spa reads its rank.
Two things came out of building it that the write-up had only guessed at:

- `gainCards` gained `opts.uncapped` **and** an `ev.dealt` field. The uncapped path is
  `Shoe.dealExtra`, a new method rather than a flag on `dealFree`, so the cap rule stays stated
  at each site. `ev.dealt` exists because the old Spa built its float, its log line *and* its
  reveal from what it asked for — so on a full shoe it announced a card it had not given. Every
  number the corner shows now comes from what actually landed.
- **The joker branch was left reachable but is still unreachable in play**, exactly as the open
  question said: a joker moves nothing and `pull()` returns before the landing resolves, so
  `cfg.spaJokerCards` (15) is dead until something changes. It is wired, tested and waiting.
- `cfg.spaCards` was **not** repurposed. It stays economy-owned with its old meaning and is now
  the fallback for a landing that carries no card — redefining an imported key would have
  silently changed what a workbook means.

**2 and 3 — the art.** Six references generated, two rejected on the "nothing stands upright"
rule (the Premiere came back with eight stanchions, then three; the airplane grew a tail fin) and
one re-rolled. Two meshes came back 5 and 38 triangles over budget and were **re-generated at a
lower faceLimit rather than decimated** — decimation discards UVs and the normalizer refuses,
which is the correct trade: an over-budget tile is worth less than an untextured one.

**4 — the chest.** Placement was measured on the board, not chosen. At the originally written
`-6.6` the chest stood *behind* the texas-town storefronts and could not be seen at all; `-6.05`
puts it in the one band that is both off the plinth and in front of the buildings. Size went 1.8
→ 2.5 to clear them, then **2.5 → 0.83** once it was seen at the size it actually renders: 2.5
made a chest taller than the buildings behind it.

Two things the build taught, both worth keeping:

- **The two models needed different yaws** — the shut one at 90°, the open one at 0. Not a
  mistake: `normalize_tile.py` squares a model's floor modulo 90°, so which quadrant it lands in
  is arbitrary, and these two were squared by 60.5° and 55.5°. `CHEST_YAW` is a map keyed by
  model, measured by rendering four clones of each and looking. Re-generating either means
  re-measuring.
- **The far corner is not reachable by eye**, which is why the debug menu gained
  *Go to Start / the Spa / the VIP Lounge / the Premiere*. They walk the token and **resolve
  nothing** — landing on the VIP Lounge would empty the pool you went to look at, and the
  Premiere would sweep you straight back to Start. And a fact worth keeping: **that corner is only in frame when
the camera is near it** — the camera follows the token, so with the token at Start the far vertex
and tile 20 itself are above the top of the frame. The chest is a landmark you arrive at.

The pay-out beat suggested in the write-up was **not** built: the chest opens on any change to
the pool, which includes the collection. If the fill flourish proves too frequent in play, the
cheap version is to open only when the pool *drops*.
