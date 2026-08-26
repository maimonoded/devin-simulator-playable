"use strict";
/* The board — how many tiles, and what each one is.

   A classic script defining a global, like assets/env/scene.js and assets/npcs/npcs.js:
   everything outside js/ui/board3d.js is classic scripts sharing globals, and this file is
   edited by hand far more often than the code that reads it. The engine is js/board-model.js.

   ---- why the board is data ----

   GDD §3.1: the board is "fully data-driven per Season (count, shape, layout and per-tile type
   all load from a board data file)". A new Season is an entry here — a new cast on the NPC
   tiles, a different mix of twists and arrivals — and no code changes. That is the same bet
   §3.2 makes about pools: seasonal boards and live-ops variants should be config, not code.

   ---- the notation ----

   `tiles` is read clockwise from Start, which sits at the BOTTOM point of the diamond, so the
   array reads the way the board looks: Start, up the right side, across the top, and back.
   Each entry is `type` or `type:argument`.

     premiere   corner 0 — Start. Passing pays; landing pays big and gives a free pack.
     spa        corner   — a rest beat. Energy, never a penalty.
     gala       corner   — the jackpot. Everything lost to negative twists collects here.
     scoop      corner   — teleports to a random NPC tile AND triggers it.
     std        the Money pool. The bulk of the board.
     npc:<id>   the Clue pool, and a character beat. The critical path for the story.
     arrival    the Bonus pool. Large money, occasional collectible.
     twist      the Mixed pool. Good and bad, and what feeds the Gala.

   Every non-corner type maps to a pool in assets/pools/pools.js; the corners are the four
   bespoke behaviours GDD §3.4 describes as functions rather than pools.

   ---- season 1's shape ----

   §3.1's illustrative budget exactly: 4 corners, 20 standard, 6 NPC, 4 arrivals at the side
   midpoints, 6 plot twists. The NPC tiles are spread so no lap can miss them, and the arrivals
   sit at 5/15/25/35 — halfway along each side, which is what "side midpoints" means on a
   diamond.

   Simon appears twice. There are six NPC tiles and five faces in the current cast, and doubling
   the lead is better than inventing a sixth character the episodes never mention. Give him a
   different line on each tile (assets/npcs/npcs.js) and it reads as running into him twice. */

const BOARD_SEASONS = [
  {
    season: 1,
    name: "Harbour Heights",
    tiles: [
      "premiere", "std",           "twist",        "npc:simon",   "std",
      "arrival",  "npc:victoria",  "twist",        "std",         "std",
      "spa",      "std",           "std",          "npc:carl",    "std",
      "arrival",  "std",           "twist",        "std",         "std",
      "gala",     "std",           "twist",        "npc:diane",   "std",
      "arrival",  "npc:grandma",   "twist",        "std",         "std",
      "scoop",    "std",           "std",          "npc:simon",   "std",
      "arrival",  "std",           "twist",        "std",         "std",
    ],
  },
];
