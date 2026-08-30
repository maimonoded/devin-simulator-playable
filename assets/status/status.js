"use strict";
/* Status — the player's standing as a fan of the show: the track, its bands and its milestones.

   Content, like assets/cards/cards.js: a classic script defining globals, read by js/status.js.

   ---- what status is ----

   Status is a LEVEL, 1 to cfg.statusLevels, and it resets every Season (GDD 5). Reaching the top
   is the Season gate — 5.4 calls that "the single most important value in the game", which is why
   the curve lives in the economy model (js/economy.js) beside the cost curve rather than as a
   scalar in cfg.

   Points come from four inflows (5.1), and every one of them is DERIVED — there is no stored
   score to drift:

     converting   a card's third copy turns it into a Collectible worth its rarity, and copies
                  past that trickle (js/cards.js)
     completing   a set of ten
     watching     cfg.statusPerEpisode an episode
     predicting   cfg.statusPerPrediction a correct call

   FOUR, AND NOT FIVE. A shelf of ten "status items" used to live here — bought with coins,
   dropped whole by boxes, or handed over when a play threshold was met. None of that is in the
   doc: 8.1 says a Collectible comes from converting a card, and 2.2 says money buys packs. The
   ten objects are ordinary cards now (assets/cards/cards.js), so they arrive the one way
   everything else does, and this file is the track alone.

   ---- zones ----

   The surfaces of the room the profile will one day be, rather than the grid it is. Nothing is
   authored into one today — the Showcase's pieces are cards and trophies, which carry their own
   set — but the room still wants somewhere to hang them. */

const STATUS_ZONES = [
  { key: "wall",     name: "On the wall",  icon: "🖼" },
  { key: "shelf",    name: "On the shelf", icon: "🏆" },
  { key: "desk",     name: "On the desk",  icon: "☕" },
  { key: "wardrobe", name: "In the closet", icon: "👗" },
];

/* The named bands, keyed by LEVEL rather than by points — a level is what the player watches,
   and a band is five of them. `from` is the level that opens the band, and the first must be 1:
   a player at level 1 still has a standing, and js/status.js falls back to the first entry.

   Six bands over thirty levels puts a new name on the profile every five levels, which is also
   where the milestones land. That is not a coincidence: a milestone and a new title arriving
   together is one beat instead of two. */
/* THE LADDER IS ABOUT ACCESS, so the icons have to be about access too.

   They used to be 🎬 💗 🎟 ⭐ 🌟 👑, and two of those were wrong in different ways.

   The HEART was wrong in meaning: a heart says affection, and this track is not how much you
   like the show — it is where you STAND in relation to it. Worse, it is the badge the HUD wears
   through levels 6 to 10, so it was most players' first impression of the whole track.

   The TWO STARS were wrong in kind, and that is the sharper bug: ⭐ and 🌟 are adjacent bands
   AND near-identical glyphs at 13px in a pill. An icon ladder exists so the rungs can be told
   apart at a glance, and those two could not be told apart at all.

   Now it reads as one escalating idea — on set, watching, let in, invited, recognised, running
   it — with six silhouettes no two of which can be confused:

     🎬 on the set as nobody · 🍿 in the audience · 🎟 through the door
     🥂 at the party · 🕶 recognised at it · 👑 running it */
const STATUS_RANKS = [
  { from:  1, name: "Extra",     icon: "🎬" },
  { from:  6, name: "Fan",       icon: "🍿" },
  { from: 11, name: "Insider",   icon: "🎟" },
  { from: 16, name: "Regular",   icon: "🥂" },
  { from: 21, name: "VIP",       icon: "🕶" },
  { from: 26, name: "Producer",  icon: "👑" },
];

/* MILESTONES, every five levels (GDD 5.3). What they pay is chosen to push back on the thing
   that is scarcest at that point in a Season:

     a clue cache  accelerates the STORY, which is the whole reason Status is worth climbing —
                   5.3 wants the two tracks coupled, and this is the coupling
     energy        buys more rolls, which is the other track
     a pack        the collection, and the only one of the three that is pure reward

   Each is claimed once and the record is stored (state.statusMilestones), because "was this
   given" is not derivable from a level that only goes up. */
const STATUS_MILESTONES = [
  { level:  5, kind: "clues",  amount: 2,          blurb: "Two clues, on the house." },
  { level: 10, kind: "energy", amount: 20,         blurb: "A full tank and then some." },
  { level: 15, kind: "pack",   tier: "premium",    blurb: "A Premium Pack." },
  { level: 20, kind: "clues",  amount: 4,          blurb: "Four clues — the story owes you." },
  { level: 25, kind: "energy", amount: 50,         blurb: "Enough to finish the week." },
  { level: 30, kind: "pack",   tier: "insider",    blurb: "An Insider Pack, and the Season is yours." },
];
