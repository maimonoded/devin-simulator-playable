"use strict";
/* The pools — what a landing can turn up, per kind of tile.

   Content, like assets/board/board.js. The engine that reads it is js/pools.js.

   ---- one draw system, many pools ----

   GDD §3.2: every landing draws ONE card from the pool its tile points at. That is the whole
   tile system. It replaced eight bespoke onLand() behaviours, and the reason is not tidiness —
   it is that a new tile type, a seasonal board or a live-ops variant becomes a table here rather
   than a new file in js/tiles/.

   ---- no pool is pure ----

   Also §3.2, and it is the rule most worth defending when tuning: the Money pool is *mostly*
   money but carries a minority of cards and the occasional clue; the Clue pool is weighted to
   clues but pays money too. Every landing stays slightly uncertain, and no tile is ever a tile
   you are sorry to land on. A pure pool would make twenty of the forty tiles dead air.

   ---- the outcome kinds ----

     money    `amount` coins, scaled by cfg.boardScale. NEGATIVE amounts are legitimate — what
              they take feeds the Gala (§3.4), which is the only reason a loss is bearable.
     card     one collectible card, drawn by rarity from the Season catalogue (js/cards.js).
     clue     one clue for the episode currently being worked on (js/clues.js).
     move     `to`: "start" walks the token round to Start and pays the landing bonus;
              "npc" is the Scoop's teleport.
     energy   `amount` energy, topped up toward the cap and never reducing an overflow.
     event    flavour only. Carries the beat and nothing else — the pool needs somewhere for
              "nothing happened" to live, or every landing has to pay and the economy inflates.

   ---- these numbers are a starting shape, not a tuning ----

   Weights sum to 100 in each pool so a row reads as a percentage. They are set against §6.6's
   clue pacing and §4.6's card inflow (roughly 12 cards a day from board draws for an engaged
   player at ~40 rolls), but §4.6 is explicit that these are "a coherent starting shape for the
   simulation to tune, not tuned values". The economy model should own them once it has a tab
   for them. */

const POOLS = {
  /* 20 tiles — half of every lap. The bulk of the game's money, and by volume the biggest
     single source of cards. */
  money: [
    { name: "Loose change",     weight: 20, kind: "money",  amount: 30 },
    { name: "A good day",       weight: 18, kind: "money",  amount: 70 },
    { name: "Payday",           weight:  8, kind: "money",  amount: 170 },
    { name: "A find",           weight: 30, kind: "card" },
    { name: "Overheard",        weight: 18, kind: "clue",   n: 1 },
    { name: "Nothing doing",    weight:  6, kind: "event",  flavour: "Quiet street." },
  ],

  /* 6 NPC tiles — the primary clue source and therefore the critical path for the whole
     narrative track (§3.3). The clue weight here is one of the three knobs that set story
     pacing; the other two are the NPC tile count and the clue cost per episode.

     RETUNED FOR THE DEMO BUILD. The clue rate across the whole board was 11.8% a roll, which
     put ten episodes about 345 rolls away — sixteen minutes of tapping for the first session
     alone. The target is eight earned episodes in a first session of roughly ninety rolls.

     Two changes get there, and the split between them is deliberate. Clue weight went up in
     ALL FOUR tables rather than only this one: making the NPC tiles a clue faucet would have
     hit the same number while turning the other thirty-four tiles into scenery, and CLAUDE.md's
     first rule about pools is that no pool is pure and none may become dead air. And a clue row
     now pays `n: 2`, which does most of the work — it makes the landing meatier instead of
     making clues more frequent and more forgettable. */
  clue: [
    { name: "A word in private", weight: 60, kind: "clue",   n: 1 },
    { name: "A keepsake",        weight: 22, kind: "card" },
    { name: "A tip-off",         weight: 12, kind: "money",  amount: 60 },
    { name: "Just passing",      weight:  6, kind: "event",  flavour: "They had nothing new." },
  ],

  /* 4 arrivals, at the side midpoints. "Large Money, occasional Collectible" (§3.1) — the
     reward beat you aim for on a long roll. */
  bonus: [
    /* The two rows carrying a `game` are the board's bonus mini-games (minigames/). They used to
       be a tile type of their own; a pool row is a better home for them, because "this outcome
       is worth a full-frame moment" is a property of the outcome, not of the ground you are
       standing on. `ladder` makes the amount a ceiling and the game a three-rung reveal —
       see drawBonusGame() in js/tiles/pool-tile.js. */
    { name: "A generous night",  weight: 36, kind: "money",  amount: 240, game: "train-small" },
    { name: "The good table",    weight: 18, kind: "money",  amount: 690, game: "train-large", ladder: true },
    { name: "Someone's gift",    weight: 26, kind: "card" },
    { name: "A whisper",         weight: 15, kind: "clue",   n: 1 },
    { name: "A moment to rest",  weight:  5, kind: "energy", amount: 3 },
  ],

  /* 6 plot twists — the only pool that can take money away, and the one that fills the Gala.
     Good and bad in the same table is the point: it is the tile you cannot read. */
  mixed: [
    { name: "A windfall",        weight: 14, kind: "money",  amount: 200 },
    { name: "Small mercy",       weight:  8, kind: "money",  amount: 60 },
    { name: "Paparazzi",         weight: 11, kind: "money",  amount: -90 },
    { name: "A bad review",      weight:  7, kind: "money",  amount: -180 },
    { name: "Left on a table",   weight: 22, kind: "card" },
    { name: "A loose thread",    weight: 28, kind: "clue",   n: 1 },
    { name: "Called to the set", weight:  4, kind: "move",   to: "start" },
    { name: "A long lunch",      weight:  4, kind: "energy", amount: 4 },
    { name: "Slow news day",     weight:  2, kind: "event",  flavour: "Nothing in the papers." },
  ],
};

/* Which pool each tile type draws from. The four corners are absent on purpose: §3.4 describes
   them as functions rather than pools, and a corner that drew from a table would stop being a
   landmark. */
const TILE_POOLS = {
  std: "money",
  npc: "clue",
  arrival: "bonus",
  twist: "mixed",
};
