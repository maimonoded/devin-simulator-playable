---
name: card-deck-art
description: Generate a new look for Harbour Heights' pull deck — the card back and the joker cards (the show's two leads) — as painted PNGs using Scenario (scenario.com), installed into assets/cards/. Use this whenever the user asks for new card art, a new deck design, a re-skin or re-theme of the deck, a different card back, new joker/character cards, or art for a new season or a different show; whenever they name a card, a deck, a joker, a suit, or assets/cards; and whenever the leads change and the joker portraits need to follow. Trigger even if they only say something like "make the deck look like a noir thriller" or "new card back please" without naming Scenario.
---

# Card Deck Art

Paints the two parts of the deck that are worth painting — **the back** and **the jokers** — and
installs them into `assets/cards/`. Everything else about the deck stays vector, on purpose.

## What is painted and what is not

`js/ui/card-art.js` draws the whole deck to canvas. This skill only replaces the pictorial cards:

| Card | Source | Why |
|---|---|---|
| The back | `assets/cards/back.png` | One image, seen on every card in the stack and on the reverse of the pulled card. It carries the deck's whole identity, so it is worth painting. |
| The jokers | `assets/cards/joker-<name>.png` | The show's leads, and the only cards that are TICKETS. They should look like nothing else in the deck. |
| The 52 numbered cards | **vector, never generated** | See below. This is not a gap waiting to be filled. |

**Do not generate the numbered cards.** The suit pip has to be the same shape at 92px in the
middle of a card and at 34px in its corner, and the rank has to be instantly legible in the
half-second the card is on screen — a pull is a *move*, and the number is the move. A generated
7-of-Hearts would be a slightly different drawing every time and mush at index size. The four
suits are paths in `card-art.js` (`_pathStar`, `_pathHeart`, `_pathDiamond`, `_pathMask`); change
the deck's colours or shapes *there*, not here.

## The absent-file contract

**A missing PNG changes nothing.** `CardArt._override()` probes each file by loading it; on
failure the vector version stays, forever, with no error. That means:

- a generation that comes out badly can simply be deleted, and the game is still whole;
- the drawing is not a placeholder to be removed once art exists — it is what renders during the
  download and what renders if the file is lost;
- you never need to "wire up" a new file beyond putting it at the expected path.

The one exception is the joker *names*: they are drawn over the painting by `_jokerBand()`, from
`CardArt.JOKERS`. New leads mean editing that array (name + `file`) **and** `Shoe.JOKERS` stays
as-is — the card ids `J1`/`J2` are game state and must not change.

## Target spec

| Requirement | Value |
|---|---|
| Format | PNG |
| Aspect | portrait, close to 0.70 (the card is 340×480) |
| Generate at | 1024 × 1456 |
| Install at | 728 tall (~512×728) — the card is about one tile on screen; more is wasted bytes |
| Text in the image | **none** — see below |
| Bleed | full, to all four edges |

**Never ask the model for text.** The name band and the TICKET flash are drawn over the painting
so they are crisp, correctly spelled and identical across cards. Generated lettering is the
single most reliable way to make a card look wrong. Every prompt ends with
`No text, no lettering, no numbers.`

## How to generate

Scenario's MCP server must be connected — see [board-tile-art/INSTALL.md](../board-tile-art/INSTALL.md).
`model_run` is a write, so it needs `team_id` and `project_id`; ask for them once and reuse them.

**Model: `model_bytedance-seedream-5-0-pro`.** Chosen for key art and packaging — it holds a
symmetrical, ornate composition together, which is exactly what a card back is. `model_ideogram-v4`
is the alternative if a design ever genuinely needs in-image text, which so far none has.

```
model_run(model_id="model_bytedance-seedream-5-0-pro",
          team_id=…, project_id=…,
          parameters={"prompt": …, "width": 1024, "height": 1456})
```

Generation takes 90–150s per image. Fire all three, then `jobs_wait` on the ids together rather
than waiting on each in turn.

### The style block is locked; only the subject changes

The same rule the tile art runs on. Three cards that each look good alone but do not belong to
one deck is a failure. Write the style once and reuse it verbatim:

> Stylised 3D character render like a modern animated feature, cinematic key light, deep indigo
> background with art deco gold rays, ornate gold card border, bold clean shapes that stay
> readable when small. No text, no lettering, no numbers.

and vary only the subject sentence. The shipped deck used:

- **back** — *"Ornate playing card BACK design, art deco theatre marquee style. Deep indigo and
  midnight purple field with a symmetrical gold filigree border and a ring of small glowing
  marquee light bulbs just inside the edge. A centred circular gold medallion holds four emblems
  arranged in a diamond: a five-pointed Walk-of-Fame star at the top, a sparkling brilliant-cut
  diamond gemstone at the right, a pair of theatre comedy-and-tragedy masks at the bottom, a
  romantic heart at the left…"*
- **joker-victoria** — *"…a glamorous young woman: long dark hair, confident knowing half-smile,
  elegant deep red evening gown, one hand raised in a small theatrical flourish, standing in a
  bright theatrical spotlight beam…"* (rose red and gold palette)
- **joker-simon** — *"…a handsome young man: short dark hair, light stubble, quietly intense
  expression, sharply cut charcoal suit with the collar open, standing in a bright theatrical
  spotlight beam…"* (teal and gold palette)

**Put the four suits on the back.** The back is the only place the whole suit set appears
together, and it is what tells a player this is *this* deck. A re-theme should re-interpret the
four — never drop one.

**Give the two jokers different palettes.** They are pulled seconds apart and must be told apart
at a glance; the shipped pair is warm red vs cool teal. Keep the framing identical so they read
as a matched pair.

## Installing

```bash
claude-skills/card-deck-art/scripts/install-cards.sh back.png joker-victoria.png joker-simon.png
```

It downscales to 728 tall and writes into `assets/cards/` under exactly those names. Download the
asset first with `asset_download` (follow redirects: `curl -L`).

Then **look at it**, in the game and not just as a file:

```js
// in the browser console, over the running board
const g=document.createElement("div");
g.style.cssText="position:fixed;inset:0;z-index:9999;background:#fff;display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:10px";
["s7","h7","d7","m7","J1","J2"].forEach(c=>{const i=new Image();i.src=CardArt.face(c).toDataURL();i.style.width="100%";g.appendChild(i)});
document.body.appendChild(g);
```

On a **white** background, deliberately: it is the only way to see a transparent hole, and the
mask pip's cut-out eyes have punched one before.

Check the back at stack size too — the deck on the board is small, and a design that only works
at full size is the commonest way this goes wrong.

## Re-theming for a different show

1. New prompts, one locked style block, three images.
2. `install-cards.sh`.
3. If the leads changed: `CardArt.JOKERS` in `js/ui/card-art.js` — the `name` shown on the band
   and the `file` it loads. Leave `Shoe.JOKERS` (`J1`/`J2`) alone; those are saved in player
   state and renaming them invalidates every save.
4. If the *suits* changed, that is a code change in `card-art.js` and in `Shoe.SUITS`
   (`js/shoe.js`) — and it changes card ids, so it needs a storage-slot bump. Say so before
   starting; it is a much larger job than new paintings.
