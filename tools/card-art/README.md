# Painting the Season's cards

150 cards, and `art` on a catalogue row is **optional** — absent means the procedural face
(`cardProcCss()` in `js/ui/cardface.js`), a two-hue gradient hashed off the card id. That is the
right answer for most Commons, and it is why this can be done in batches over time without the
game ever looking broken in between.

```bash
node tools/card-art/audit.js      # what is painted, and what is inconsistent
```

## The pipeline, per card

1. **Generate** — Scenario MCP, `model_bytedance-seedream-5-0-pro`, **864×1152**, `numImages: 1`,
   9 credits. The size is not arbitrary: Seedream has a minimum pixel floor a little under
   1 MP, and anything smaller is refused.
2. **Download** — `asset_download` with `format: "webp"` gives a signed URL.
3. **Finish** — `tools/card-art/finish-card.sh <id> <url>` downscales to 420px and re-encodes to
   ~35 KB. A card is drawn about 200px across; the full-size render is forty times the file for
   no visible gain.
4. **Tag** — `python3 tools/card-art/tag-card.py <id> …` writes `art:` onto the catalogue rows,
   and refuses any card whose file is not on disk.

Fire seven generations at once — that is the concurrency limit — then wait, download, finish and
tag the batch together.

## The prompts

`jobs.json` holds every remaining card with its prompt already written, split into five jobs.
Each prompt is the card's name plus its **set's** setting, so the ten cards of a set look like
they came from the same afternoon:

> Dramatic painterly illustration for a collectible card, vertical composition. **{name}**.
> {the set's setting}. Cinematic, rich saturated colour, soft depth of field, single clear
> subject centred with margin, no text, no letters, no numbers, no logos, no watermark.

The "no text" tail earns its length. Without it the model letters the card itself — a title
across the top, a fake rarity ribbon — and the result fights the frame the app draws.

## Two failures worth knowing

Both have happened, and neither shows up in the browser console.

- **Tagged, but no file.** The card renders as an empty frame. `tag-card.py` will not tag a card
  whose file is missing, and `audit.js` reports any that slipped through.
- **On disk, but untagged.** Generated, paid for, and invisible — the card still shows its
  procedural face. This is the one that hid: three catalogue rows are written with no space after
  a comma, and a regex that required the space skipped them silently.

## The clue photographs

Separate, and much smaller: **twelve** case photographs under `assets/cards/clues/`, shared by
all 144 clues, which pick one by hashing their own id. Same generate/finish steps, but they are
black-and-white surveillance stills rather than painted illustrations, and they are named by
subject (`phone.webp`, `letter.webp`) rather than by card id — see `CLUE_ART` in
`assets/cards/cards.js`.
