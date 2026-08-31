# The board

`board.js` declares every Season's ring. It is **content** — a classic script defining a global,
like `assets/env/scene.js` and `assets/npcs/npcs.js`. The engine that reads it is
[`js/board-model.js`](../../js/board-model.js).

GDD §3.1 asks for the count, the shape and every tile's type to load from a data file, so a new
Season is an entry here and no code changes. Nothing downstream assumes 40 tiles: a ring of N is
drawn on a grid of side `N/4 + 1`, and N must divide by 4 so the four sides are equal.

## Writing a Season

```js
{ season: 1, name: "Harbour Heights", tiles: [ "premiere", "std", "twist", "npc:simon", … ] }
```

`tiles` is read **clockwise from Start**, which sits at the bottom point of the diamond, so the
array reads the way the board looks. Each entry is `type` or `type:argument`.

| Entry | Is | Draws from |
|---|---|---|
| `premiere` | corner 0 — pass pays, landing pays big and gives a free pack | — |
| `spa` | corner — a rest beat, never a penalty | — |
| `gala` | corner — the jackpot everything lost to twists collects into | — |
| `scoop` | corner — teleports to a random NPC tile and triggers it | — |
| `std` | the bulk of the ring | `money` |
| `npc:<id>` | a character beat, and the critical path for the story | `clue` |
| `arrival` | large money, occasional collectible | `bonus` |
| `twist` | good and bad, and what feeds the Gala | `mixed` |

The four corners must sit one per side (index `k × N/4`). Every other type needs an entry in
`TILE_POOLS` ([../pools/](../pools/README.md)) or it has nowhere to draw from.

`validateBoard()` reports **every** problem at once and is printed in the tuning drawer and logged
at boot — a mis-authored board is the one failure that is invisible in play.

## Season 1

§3.1's illustrative budget exactly: 4 corners, 20 `std`, 6 `npc`, 4 `arrival` at the side
midpoints (5/15/25/35), 6 `twist`.

Simon appears twice. There are six NPC tiles and five faces in the current cast, and doubling the
lead is better than inventing a sixth character the episodes never mention — give him a different
line on each tile ([`assets/npcs/npcs.js`](../npcs/README.md)) and it reads as running into him
twice.
