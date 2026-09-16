# Harbour Heights — the joker-collection version

A Monopoly-GO-style board game used to model a short-drama app's economy. **This version of the
game is about collecting joker cards into the decks on the board to unlock an episode.**

Every other system on the board — the tiles, the coins, the mystery boxes, the mini-games —
exists to put more cards in your hand and more jokers in those decks.

## The loop in one paragraph

You **pull** a card from the shoe. If it is a numbered card its rank moves your token that many
tiles around the 40-tile ring, and whatever you land on resolves. If it is a **joker** the token
does not move at all: the joker flies into one of the episode decks on the board instead. Fill a
deck with `ticketsPerEpisode` jokers (5 by default) and that deck's episode unlocks. Watching an
episode means betting on what happens next in it — which is the thing the whole economy is built
to pace.

```
pull ──► numbered card ──► move that many tiles ──► the tile resolves (coins, clues, a bonus game…)
     └─► joker ─────────► it fills its own deck ──► deck full ──► episode unlocked ──► predict & watch
```

## The cards

A card is a suit letter plus a rank, or a joker — `"s7"`, `"h13"`, `"J1"`. A pack is the fixed 52
(four suits of 1–13) **plus** the jokers on top, so the jokers never compete with the numbers for
space in the pack. The shipped pack is 64 cards: 52 numbered plus `cfg.ticketsPerPack` = 12
jokers.

| Suit | | Meaning |
|---|---|---|
| `s` star | ⭐ | the Walk of Fame |
| `h` heart | ❤️ | love and romance |
| `d` diamond | 💎 | the real stone, not the flat pip |
| `m` mask | 🎭 | the drama itself |

A numbered card's **rank is its move** — a card is worth 1 to 13 tiles. A joker moves nothing.
That is the trade the game is balanced on: the card that advances the story is the card that does
not advance the token.

## The decks — one per lead, filling in parallel

There are four jokers, and each one is a lead of the show: **Victoria**, **Simon**, **Carl** and
**Mama**. The board shows one episode placeholder per lead — that row of decks — and **a pulled
joker fills its own lead's deck**. So all four collections grow at once rather than one filling
before the next begins, and the row's length is *derived* from the cast rather than configured:
add a fifth lead and every row grows a fifth episode with no other edit.

Two consequences worth knowing before you play or change anything:

- **Decks fill out of order, but episodes are still watched in order.** A slot standing for
  episode 3 routinely completes first. It unlocks, but it cannot be watched until every slot
  before it on the row is both full and watched (`Tickets.watchableAt`).
- **The row only moves on when every episode on it is full *and* watched.** With the row full
  there is nothing left to pull for, and the game sends you to **Predict & watch** instead. That
  is the intended stop, not a dead end.

Jokers that arrive for an already-full deck are **banked** by type rather than dropped, and spent
the moment the row moves on.

Note the name collision, because the repo lives with it: the **Plot Twist tiles** at board
positions 3/8/13/18/23/28 are spelled `deck` in `js/board-model.js` and draw from their own
weighted table. They are not the decks you collect into, and not the shoe you pull from.

## Where cards come from

Cards regenerate on the game clock — one free card per `cfg.cardRegenMin` minutes — and a Spa
landing grants more. A whole pack can be bought, but **not with coins**: coins have never been
able to buy a deck, and they exist for prediction wagers. The invariant that makes the pacing
honest is that jokers arrive at exactly `ticketsPerPack` per `packSize` cards *however* the cards
were obtained, so a trickle of free cards carries its proper share of jokers and a session
boundary cannot round them away.

**Cards may exceed the cap, and nothing may clamp the shoe downward.** A bought pack merges onto
whatever is left of the previous one, so overflow is the ordinary path, not an edge case.

## Running it

```bash
python3 serve.py
```

→ http://localhost:8125/index.html. Pass a port to move it: `python3 serve.py 8127`.

A server is required — `file://` does not work, because the board loads three.js as an ES module
and browsers block module scripts on file URLs. `serve.py` ships with the repo for two reasons:
**HTTP Range** (episode videos are 30–60 MB and the player seeks) and **no-store** (the browser
otherwise serves stale files after an edit). There is no build step and no npm.

```bash
node tests/run.js
```

## Where to read next

- [CLAUDE.md](CLAUDE.md) — the architecture: the one rule (logic never touches the DOM), the
  event list, the economy model vs `cfg`, the two auto modes.
- [js/tiles/README.md](js/tiles/README.md) — what each tile does, and the event vocabulary.
- [episodes/README.md](episodes/README.md) — prediction data, the player, the betting rules.
- [TILES.md](TILES.md) · [TILE-REWORK.md](TILE-REWORK.md) — the board itself.
- `js/shoe.js` and `js/tickets.js` — the two files this README is a summary of. Both carry long
  header comments explaining why they are shaped the way they are.
