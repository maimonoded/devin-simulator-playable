# Cards — what there is to collect

The collection is the game's progression: a **set** is `cfg.episodesPerBoard` episodes, each
unlocked by owning `cfg.collectiblesPerEpisode` named cards. Board 1 is 5 × 5, so its pool is
**25 distinct cards** and every one of them is needed exactly once.

```
assets/cards/
  cards.js            CARD_TIERS + CARD_BOARDS — the content
  board1/*.webp       the art: one portrait per character, one still life per clue
```

The engine that reads this is [`js/collection.js`](../../js/collection.js); the card is drawn by
[`js/ui/cardface.js`](../../js/ui/cardface.js) and styled in
[`css/collection.css`](../../css/collection.css).

## The pool is derived, not declared

Nothing anywhere says "25". The pool of a board is the **union of its episodes' `needs`**, so a
card that can drop but is never wanted — or a requirement naming a card that does not exist — is
a `Collection.validate()` error rather than a silent hole. The tuning drawer prints what it
finds, and `boot()` logs it.

## Card ids

A card id is a string, and it is the whole identity — ownership, drop tables and requirements all
key off it:

```
char:simon@gold      a character portrait at a tier
clue:sign            a clue card (no tier — see below)
```

## Three tiers off one portrait

Character cards come in three tiers, and **the tier is a frame drawn in CSS, not a second piece
of art**. Three portraits of the same person differing only in rarity would be three near
identical images to generate, store and tell apart. It also means adding a tier is a line in
`CARD_TIERS` rather than a re-render of the whole cast.

| field | meaning |
|---|---|
| `key` | what an id says: `char:simon@gold` |
| `rank` | the order, rarest last |
| `dup` | what a **second** copy is worth, as a multiplier on `cfg.dupCoins` |
| `icon` | shown on the card's ribbon |

## Clue cards are deliberately different

They are the one kind whose art carries information out of the story rather than a face, and the
one kind that feeds the wager: collecting a **new** clue card banks a clue for the next
prediction, exactly as the old mystery box did (a duplicate pays coins, not insight). So they
carry **no tier at all** and wear a paper evidence-tag treatment — dashed cream border, tape,
typewriter face — which is three signals that this is a different *kind* of thing, readable from
across the album.

## Authoring a board

```js
{
  board: 2,
  name: "…",
  art: "assets/cards/board2/",
  characters: [{ id, name, role, art }],      // one portrait each
  clues:      [{ id, name, art }],            // `name` is the line printed on the card
  episodes: [{ ep: "006", needs: ["char:…@silver", "clue:…", …] }],
}
```

`needs` **is** the requirement — which card, at which tier — and it is data precisely so
"episode 5 wants the whole cast in diamond" is a decision made here rather than a rule buried in
the unlock check. Board 1 escalates: silver across the opening two, gold through the middle, the
full diamond cast last.

Only board 1 is authored. `Collection.boardFor(n)` past the last authored board returns that
board re-pointed at board *n*'s episodes, so the loop never dead-ends on missing content and
authoring board 2 for real is an entry in `cards.js`, not a code change. A derived board reuses
the template's art, which is honest about what it is: the same cast, a new set to collect.

## The art

Generated with the Scenario MCP (`model_bytedance-seedream-5-0-pro`) at 864 × 1152, then
resized to 432 wide and encoded to WebP — ~25 KB a card against ~2 MB for the source PNG, which
is what makes a 25-card set cost half a megabyte instead of fifty.

One locked style block for the cast (painterly romance-drama poster, warm key light from the
upper left, teal and plum shadows, dark bokeh background) and one for the clues (the same light
on a single object, shot as evidence). **No text of any kind** is generated — names, tiers and
counts are DOM over the art, so they stay crisp and translatable. On the clue prompts, writing
that belongs to the object is asked for as *illegible*: a will has to look like a will without
the generator inventing words.
