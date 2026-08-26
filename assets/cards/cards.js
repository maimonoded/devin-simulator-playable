"use strict";
/* The collection — what there is to collect, and what each episode costs in cards.

   A classic script defining globals, for the same reason assets/env/scene.js and
   assets/npcs/npcs.js are: everything outside js/ui/board3d.js is classic scripts sharing
   globals, and this file is edited by hand far more often than the code that reads it.
   The engine that reads it is js/collection.js.

   ---- the shape of a board ----

   A BOARD is one turn of the game loop: cfg.episodesPerBoard episodes, each unlocked by
   cfg.collectiblesPerEpisode cards. Board 1 is 5 x 5, so its pool is 25 distinct cards and
   every one of them is needed exactly once. Nothing here states 25 — the pool is DERIVED as
   the union of the episodes' `needs`, which is what makes a mis-authored board a validation
   error (Collection.validate) rather than a card that can drop but is never wanted.

   ---- card ids ----

   A card id is a string, and it is the whole identity — ownership, drop tables and episode
   requirements all key off it:

     char:simon@gold     a character portrait at a tier
     clue:sign           a clue card (clue cards have no tier — see below)

   Character cards come in THREE TIERS off ONE portrait. The tier is a frame drawn in CSS
   (css/collection.css), not a second piece of art: three portraits of the same person that
   differ only in rarity would be three near-identical images to generate, store and tell
   apart. It also means a new tier is a line in CARD_TIERS rather than a re-render of the cast.

   Clue cards are deliberately NOT tiered. They are the one kind whose art carries information
   — an object out of the story — so a clue at three rarities would be the same evidence three
   times. They also look different from every other card by design (see the .clue rules in
   css/collection.css), because they are the kind that feeds the prediction: collecting one
   banks a clue for the next wager exactly as the old mystery box did.

   ---- boards past the authored ones ----

   Only board 1 is authored. Collection.boardFor(n) derives any board past the last authored
   one from the last authored one, re-pointing it at that board's episodes — so the loop runs
   as long as there are episode files and adding real content later is an entry here, not a
   code change. See js/collection.js. */

/* Rarity, rarest last. `rank` is the order. `dup` is what a SECOND copy is worth, as a
   multiplier on cfg.dupCoins — a duplicate diamond has to feel like a diamond even though the
   album already has one, and the rarer the card the more that consolation is worth. How often
   each tier drops is not here: that is per box tier, in js/boxes.js. */
const CARD_TIERS = [
  { key: "silver",  name: "Silver",  rank: 1, dup: 1, icon: "🥈" },
  { key: "gold",    name: "Gold",    rank: 2, dup: 3, icon: "🥇" },
  { key: "diamond", name: "Diamond", rank: 3, dup: 8, icon: "💎" },
];

const CARD_BOARDS = [
  {
    board: 1,
    name: "Six Months on the Street",
    /* Every art path in this board is relative to here. */
    art: "assets/cards/board1/",
    /* The cast. One portrait each; CARD_TIERS decides how many cards that portrait becomes. */
    characters: [
      { id: "simon",    name: "Simon",    role: "The man on the bench",     art: "simon.webp" },
      { id: "victoria", name: "Victoria", role: "The bride with no groom",  art: "victoria.webp" },
      { id: "carl",     name: "Carl",     role: "The fiancé, caught",       art: "carl.webp" },
      { id: "diane",    name: "Diane",    role: "The mother of the bride",  art: "diane.webp" },
      { id: "grandma",  name: "Grandma",  role: "The one nobody fools",     art: "grandma.webp" },
    ],
    /* The clues, written as the line that goes on the card. */
    clues: [
      { id: "sign",      name: "A cardboard sign, lettered in a steady hand", art: "clue-sign.webp" },
      { id: "shoes",     name: "Shoes worth more than the coat",             art: "clue-shoes.webp" },
      { id: "card",      name: "A bank card, unused, six months expired",    art: "clue-card.webp" },
      { id: "bench",     name: "The bench he never sleeps on",               art: "clue-bench.webp" },
      { id: "phone",     name: "A phone that only ever receives",            art: "clue-phone.webp" },
      { id: "will",      name: "A will with one name struck through",        art: "clue-will.webp" },
      { id: "chair",     name: "The brother who took the meeting",           art: "clue-chair.webp" },
      { id: "photo",     name: "A photograph cropped to two people",         art: "clue-photo.webp" },
      { id: "cash",      name: "Legal fees paid in cash",                    art: "clue-cash.webp" },
      { id: "signature", name: "A signature that leans the wrong way",       art: "clue-signature.webp" },
    ],
    /* One page of the album per episode, in order. `needs` IS the requirement — which card, at
       which tier — and it is data precisely so "episode 5 wants the whole cast in diamond" is a
       decision made here rather than a rule buried in the unlock check.

       The set escalates: silver across the opening two, gold through the middle, and the last
       episode holds the diamond cast, so the rarest tier is what gates the end of the board. */
    episodes: [
      { ep: "001", needs: ["char:simon@silver", "char:victoria@silver",
                           "clue:sign", "clue:shoes", "clue:card"] },
      { ep: "002", needs: ["char:carl@silver", "char:diane@silver", "char:grandma@silver",
                           "clue:bench", "clue:phone"] },
      { ep: "003", needs: ["char:simon@gold", "char:victoria@gold", "char:carl@gold",
                           "clue:will", "clue:chair"] },
      { ep: "004", needs: ["char:diane@gold", "char:grandma@gold",
                           "clue:photo", "clue:cash", "clue:signature"] },
      { ep: "005", needs: ["char:simon@diamond", "char:victoria@diamond", "char:carl@diamond",
                           "char:diane@diamond", "char:grandma@diamond"] },
    ],
  },
];
