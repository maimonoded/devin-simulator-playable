"use strict";
/* Status — the player's standing as a fan of the show, and the things that prove it.

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

   The items below are Collectibles too — granted whole rather than converted, and the seed of
   the Showcase (5.2). So a player who never spends a coin still climbs, and a player who buys the
   whole shelf still has to watch the show and call it right to finish a Season.

   ---- how an item is obtained ----

   Every item has BOTH routes, deliberately:

     price   coins, bought from the profile screen
     earn    a play milestone that awards it for free — {episodes|cards|boards|rolls: n}
     box     its weight in a box's status slot (js/boxes.js); 0 never drops

   "Buyable and earnable" is the whole design brief here, so an item with only one of the two
   is a content bug rather than a variant. The earn milestone is always reachable by play alone;
   the price is what shortcuts it.

   ---- zones ----

   `zone` is where the item will hang when the profile becomes the player's room rather than a
   grid — wall, shelf, desk, wardrobe. The grid already groups by it, so authoring for the room
   costs nothing today and the room costs no re-authoring later. */

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
const STATUS_RANKS = [
  { from:  1, name: "Extra",     icon: "🎬" },
  { from:  6, name: "Fan",       icon: "💗" },
  { from: 11, name: "Insider",   icon: "🎟" },
  { from: 16, name: "Regular",   icon: "⭐" },
  { from: 21, name: "VIP",       icon: "🌟" },
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

const STATUS_ITEMS = [
  { id: "mug",           name: "Harbour Heights mug",    zone: "desk",     points:  5,
    price:  1200, earn: { cards:  5 }, box: 20, art: "assets/status/items/mug.webp",
    blurb: "Chipped on the second morning. Kept anyway." },
  { id: "stickers",      name: "Fan sticker sheet",      zone: "desk",     points:  5,
    price:   900, earn: { rolls: 60 }, box: 22, art: "assets/status/items/stickers.webp",
    blurb: "Die-cut, glossy, and none of them ever used." },
  { id: "ticket-framed", name: "Framed premiere ticket", zone: "wall",     points: 10,
    price:  2500, earn: { episodes: 1 }, box: 16, art: "assets/status/items/ticket-framed.webp",
    blurb: "Row F. You still have the stub." },
  { id: "bouquet",       name: "The wedding bouquet",    zone: "shelf",    points: 10,
    price:  3500, earn: { episodes: 3 }, box: 14, art: "assets/status/items/bouquet.webp",
    blurb: "White roses, plum ribbon, caught on camera." },
  { id: "card-binder",   name: "Collector's binder",     zone: "shelf",    points: 20,
    price:  6000, earn: { cards: 15 }, box: 10, art: "assets/status/items/card-binder.webp",
    blurb: "Nine sleeves a page. You know which are missing." },
  { id: "sunglasses",    name: "Designer sunglasses",    zone: "wardrobe", points: 20,
    price:  8000, earn: { episodes: 5 }, box:  8, art: "assets/status/items/sunglasses.webp",
    blurb: "Worn indoors, as intended." },
  { id: "poster-signed", name: "Signed premiere poster", zone: "wall",     points: 30,
    price: 12000, earn: { boards: 1 }, box:  5, art: "assets/status/items/poster-signed.webp",
    blurb: "Silver marker, straight across the corner." },
  { id: "neon-heart",    name: "Cracked neon heart",     zone: "wall",     points: 30,
    price: 18000, earn: { cards: 25 }, box:  3, art: "assets/status/items/neon-heart.webp",
    blurb: "The show's title card, in your own hallway." },
  { id: "gown",          name: "The premiere gown",      zone: "wardrobe", points: 50,
    price: 26000, earn: { episodes: 9 }, box:  1.5, art: "assets/status/items/gown.webp",
    blurb: "Emerald silk. Somewhere to wear it: pending." },
  { id: "award",         name: "Fan-club award",         zone: "shelf",    points: 70,
    price: 40000, earn: { boards: 2 }, box:  0.5, art: "assets/status/items/award.webp",
    blurb: "Gold clapperboard on marble. Heavier than it looks." },
];
