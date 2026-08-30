# The collection

`cards.js` is the Season catalogue — **48 cards, in 4 sets of twelve**. Content, like
[`assets/board/board.js`](../board/README.md); the engine is [`js/cards.js`](../../js/cards.js).

## What changed, and why it matters

Cards used to **be** the gate: five named ones unlocked an episode, so the pool was derived from
the episodes' requirements and every card had a job. GDD §6.1 moved the gate to
[clues](../../js/clues.js), and that frees the collection to be what §4 actually describes — a
catalogue you are never finished with, whose only job is Status and the satisfaction of the thing
itself.

So there are no requirements here any more. **A card is wanted because it is missing.**

## Two kinds in one catalogue (§4.1)

A Season's cards come in two interleaved kinds, and both are in every set:

| | | per set |
|---|---|---|
| **narrative** | a record of the story — the blanket, the registrar's face, the cancelled booking | 7 |
| **status** | aspirational objects: the watch, the necklace, the roadster, the villa | 5 |

They are not two systems. A status card is an ordinary card with an ordinary rarity that drops,
duplicates and converts exactly like any other — the difference is only what it is a picture of.
That is the point of interleaving them: completing a set means owning **both the memory and the
trophy**, which is a sentence you can only write if they live in the same twelve.

The alternative was tried and it failed. Ten "status items" used to sit in
[`assets/status/`](../status/README.md) with a price, an earn threshold and a box weight, sharing
an id with no card and belonging to no set. A player asked which cards they had collected to earn
the cup and there was no answer — which is the whole argument for §4.3 in one question. See
[that README](../status/README.md) for the post-mortem.

## The shape (§4.6)

| Rarity | Count | Drop weight | Converts for | Each copy past that | Duplicate coins |
|---|---|---|---|---|---|
| Common | 29 | 60% | 10 | 2 | ×1 |
| Rare | 12 | 25% | 30 | 6 | ×3 |
| Epic | 6 | 12% | 100 | 20 | ×8 |
| Legendary | 1 | 3% | 400 | 80 | ×25 |

Per set that is seven Commons and three Rares, plus an Epic and the Season's Legendary in *The
Street*, two Epics each in *The Name* and *The Rose Hotel*, and one in *The Suite*. The counts
land on §4.2's 60/25/12/3 shares almost exactly — 60.4 / 25 / 12.5 / 2.1 — which is what the
drop weights assume.

### Forty-eight, not a hundred and fifty

The catalogue was 150 in 15 sets of ten, and that number is what broke conversion. §4.3 makes the
**third copy** the entire link between collecting and Status, and against 150 cards a given
Common turned up **0.67 times** in a demo run — so the core loop of the game essentially never
fired, and a player collected for a session watching a bar that did not move. 48 against 18
episodes is roughly two and a half cards an episode and one set an arc, which is the density §4
is written for. A catalogue is not made deeper by being made longer; it is made emptier.

## Three copies convert

§4.3, and it is the rule that makes a duplicate worth pulling. Copies accumulate; the **third**
converts the card into its Collectible, which is what pays Status and what stands on the
Showcase. Past the third, copies trickle Status directly, so no pull is ever dead — GDD §12 lists
that as one of three non-negotiable mitigations for a game where both tracks are random.

**The Collectible is an object, and it is derived.** `Cards.collectibleOf(id)` synthesises
`{id, name, art, points, rarity, setKey, setName}` on demand from the card, and
`Cards.collectibleIds()` says which ones the player actually holds — in catalogue order, because
a shelf that reorders itself as cards land is not a collection. Nothing new is stored: converted
is still `count >= cfg.cardCopiesToConvert`, one number and one derivation, the same pattern as
`Status.trophyOf()`.

The split between the two matters. `collectibleOf()` describes a card's Collectible **whether or
not it has been earned**, which is what lets a set's display piece be named before it is won and
lets a locked slot show what it would be.

## A set is a target, never a gate

§4.4. Completing one pays coins, Status and a **display piece** — and nothing depends on it
having happened. The only thing about a set that has to be *stored* is whether its bonus was
already paid (`state.setsDone`): "was this given" is not derivable from a collection that only
ever grows.

The display piece is `Cards.setCentrepiece()`: the Collectible of the set's **rarest** card. Not
a thirteenth object authored beside the twelve — that would be the shelf again, an id belonging
to nothing. A set that had a Legendary in it should be remembered by the Legendary, so *The
Street* is remembered by "Six Months on the Street" and the other three by their first Epic.
Ties go to the first authored, so the piece is settled the moment the catalogue is written rather
than by which copy happened to land last, and it is earned by **finishing the set** — it does not
ask whether that card has converted, because the three-copy rule already prices Status and this
is a display object.

## Ids

A card's id is the whole identity — ownership, drop tables and the Showcase all key off it — and
it must be unique **across every Season**, not just within one. A Season's cards persist after its
reset (§5.3), so two Seasons reusing `the-blanket` would silently merge two different cards into
one pile. `validate()` refuses it.

## Art

`art` is **optional** and names a file in `s1/`. Absent means the procedural face
([`js/ui/cardface.js`](../../js/ui/cardface.js)), which hashes the card id into two hues — the
same card, the same colours, every time.

**All 48 are painted**, the twenty status objects included — and they were drawn rather than
inherited. The old shelf's pictures in `assets/status/items/` were not a shortcut: a card is
864 × 1152 and full-bleed, those are 320 × 320 squares cropped for a grid.

Optional still matters even with nothing missing: it is what lets a Season's catalogue be
authored before its art exists, which is the order those two jobs actually happen in.

Generated with Scenario at 864×1152 and sized down to ~420px wide, ~30 KB each. `tools/card-art/`
is how it gets made and `audit.js` there reports what is missing.

**`retired.txt` is why that audit still means something.** Cutting the catalogue from 150 to 48
left 122 finished pictures in `s1/` belonging to no card, and an untagged file used to mean
one specific mistake — art generated and never wired up. Every retired card would now report as
exactly that, and an audit that always fails is an audit nobody reads. So retirement is stated
once, in that file, and anything untagged and *not* listed there still fails the way it always
did. The art is kept rather than deleted because it is paid-for work a later Season can pick back
up: tag it and delete its line.

## Adding a card

1. A row in the right set's `cards` array: `{ id, name, rarity }`, plus `art` if it has any.
2. Keep the set at twelve and keep both kinds in it — swap a card out rather than growing a set.
   A set of only narrative cards would quietly undo §4.1.
3. Drop the art in `s1/` if there is any.

`Cards.validate()` reports every problem at once, at boot and in the tuning drawer. What it can
catch is what a typo would otherwise hide: a missing name the collection would print blank, a
rarity that does not exist, an id already used in another Season, and rarity weights that no
longer sum to a hundred. It does **not** police the composition — the 29/12/6/1 split is a
balance decision the counts above record, and a set that quietly drifts to eight Commons is
something to notice here rather than something the engine can refuse.

No code changes. A new Season is a new entry in `CARD_SEASONS` with its own `art` directory.
