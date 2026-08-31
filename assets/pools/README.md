# The pools

`pools.js` is what a landing can turn up, per kind of tile. Content, like
[`assets/board/board.js`](../board/README.md); the engine is [`js/pools.js`](../../js/pools.js)
and the tile that plays the result is
[`js/tiles/pool-tile.js`](../../js/tiles/README.md).

GDD §3.2: **every landing draws one row from the pool its tile points at.** That replaced eight
bespoke `onLand()` behaviours, and the reason is that a new tile type, a seasonal board or a
live-ops variant becomes a table here rather than a new file.

## The rule worth defending

**No pool is pure.** The money pool is *mostly* money but carries a minority of cards and the
occasional clue; the clue pool is weighted to clues but pays money too. Every landing stays
slightly uncertain, and no tile is one you are sorry to land on. A pure pool would make twenty of
the forty tiles dead air.

## The outcome kinds

| `kind` | Carries | Notes |
|---|---|---|
| `money` | `amount` | scaled by `cfg.boardScale` and the multiplier. **Negative is legitimate** — what it takes feeds the Gala, which is the only reason a loss is bearable. May also carry `game` (and `ladder`) to open a bonus mini-game |
| `card` | — | one collectible, drawn from the Season catalogue |
| `clue` | — | one clue |
| `move` | `to` | `"start"` walks to Start and pays the landing bonus; `"npc"` is the Scoop's teleport |
| `energy` | `amount` | topped up toward the cap, never reducing an overflow |
| `event` | `flavour` | pays nothing, **on purpose**: the pool needs somewhere for "nothing happened" to live, or every landing has to pay and the economy inflates |

Weights sum to 100 in each pool so a row reads as a percentage. `Pools.validate()` reports every
problem at once — an unknown kind, a weightless row, a table summing to zero (which `weighted()`
would silently resolve to its last row forever).

## These numbers are a starting shape

They are set against §6.6's clue pacing and §4.6's card inflow — about 10 cards and 4 clues per
40-roll day — but §4.6 is explicit that these are "a coherent starting shape for the simulation to
tune, not tuned values". The tuning drawer prints both the per-pool share and the **board** share,
because a weight means nothing without its total: a 52% clue pool on six of forty tiles is a 10%
clue rate per roll, and that second number is the one that sets pacing.
