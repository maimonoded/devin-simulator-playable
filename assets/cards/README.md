# The collection

`cards.js` is the Season catalogue — **150 cards, in 15 sets of ten**. Content, like
[`assets/board/board.js`](../board/README.md); the engine is [`js/cards.js`](../../js/cards.js).

## What changed, and why it matters

Cards used to **be** the gate: five named ones unlocked an episode, so the pool was derived from
the episodes' requirements and every card had a job. GDD §6.1 moved the gate to
[clues](../../js/clues.js), and that frees the collection to be what §4 actually describes — a
catalogue you are never finished with, whose only job is Status and the satisfaction of the thing
itself.

So there are no requirements here any more. **A card is wanted because it is missing.**

## The shape (§4.6)

| Rarity | Count | Drop weight | Converts for | Each copy past that | Duplicate coins |
|---|---|---|---|---|---|
| Common | 90 | 60% | 10 | 2 | ×1 |
| Rare | 38 | 25% | 30 | 6 | ×3 |
| Epic | 18 | 12% | 100 | 20 | ×8 |
| Legendary | 4 | 3% | 400 | 80 | ×25 |

Per set that is six Commons and a tail: eight sets carry three Rares and an Epic, three carry two
Rares and two Epics, and four carry two Rares, an Epic and one of the Season's four Legendaries.
`Cards.validate()` checks the totals, because "90/38/18/4" is a balance decision and a typo in it
is invisible in play — the game would simply feel slightly wrong for a whole Season.

## Three copies convert

§4.3, and it is the rule that makes a duplicate worth pulling. Copies accumulate; the **third**
converts the card into its Collectible, which is what pays Status. Past the third, copies trickle
Status directly, so no pull is ever dead — GDD §12 lists that as one of three non-negotiable
mitigations for a game where both tracks are random.

Nothing about conversion is stored. `state.cards` is copies held, and converted is
`count >= cfg.cardCopiesToConvert`. One number, one derivation, nothing to drift.

## A set is a target, never a gate

§4.4. Completing one pays coins and Status and nothing depends on it having happened. The only
thing about a set that has to be *stored* is whether its bonus was already paid (`state.setsDone`)
— "was this given" is not derivable from a collection that only ever grows.

## Ids

A card's id is the whole identity — ownership, drop tables and the Showcase all key off it — and
it must be unique **across every Season**, not just within one. A Season's cards persist after its
reset (§5.3), so two Seasons reusing `the-blanket` would silently merge two different cards into
one pile. `validate()` refuses it.

## Art

`art` is **optional** and names a file in `s1/`. Absent means the procedural face
([`js/ui/cardface.js`](../../js/ui/cardface.js)), which is the right answer for most of the ninety
Commons: ninety pieces of generated art would cost more to make than they would ever be looked at.

The top of the ladder is where painted art earns its place — §4.2 calls an Epic "the pull that
makes a pack memorable", and a memorable pull cannot be a gradient. **All 18 Epics and all 4
Legendaries are painted**, plus nine lower-rarity cards that reuse the evidence images.

Generated with Scenario at 864×1152 and sized down to ~420px wide, ~30 KB each.

## Adding a card

1. A row in the right set's `cards` array: `{ id, name, rarity }`, plus `art` if it has any.
2. Keep the set at ten and the Season totals at 90/38/18/4 — swap a card out rather than growing
   a set, or `Cards.validate()` will say so at boot and in the tuning drawer.
3. Drop the art in `s1/` if there is any.

No code changes. A new Season is a new entry in `CARD_SEASONS` with its own `art` directory.
