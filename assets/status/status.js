"use strict";
/* Status — the player's standing as a fan of the show, and the things that prove it.

   Content, like assets/cards/cards.js: a classic script defining globals, read by js/status.js.

   ---- what status is ----

   Status is a POINT TOTAL with named milestones, and it comes from three places at once:

     items      the things below, each worth `points` once owned
     watching   cfg.statusPerEpisode for every episode watched
     collecting cfg.statusPerCard for every card in the collection, cfg.statusPerBoard a board

   So a player who never spends a coin still climbs — slowly — and a player who buys the whole
   shelf still has to watch the show to reach the top rank. That split is the point: status is
   meant to be the thing both loops feed, not a second currency.

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

/* Rarest last. `at` is the point total that opens the rank. The first must be at 0 — a player
   with nothing still has a standing, and js/status.js falls back to the first entry. */
const STATUS_RANKS = [
  { at:   0, name: "Extra",     icon: "🎬" },
  { at:  25, name: "Fan",       icon: "💗" },
  { at:  60, name: "Insider",   icon: "🎟" },
  { at: 110, name: "Regular",   icon: "⭐" },
  { at: 180, name: "VIP",       icon: "🌟" },
  { at: 260, name: "Producer",  icon: "👑" },
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
