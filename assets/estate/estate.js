"use strict";
/* The Status Estate — the object at the centre of the board (GDD §3.5).

   Content, like assets/board/board.js: a classic script defining a global. The engine that
   draws it is js/ui/estate3d.js.

   ---- what it is for ----

   §3.5 wants an estate at the board's centre that upgrades visually with Status level. It is the
   passive-progress anchor: the thing that makes the Status track visible while you are rolling,
   the way builder landmarks used to be. Without it, Status is a four-pixel bar in the corner of
   the HUD and the middle of the board is empty.

   ---- one tier per band ----

   There are six tiers and six named bands (STATUS_RANKS in assets/status/status.js), five levels
   apart. That pairing is deliberate: reaching a new band is the moment your title changes AND
   the moment the house changes, which is one beat instead of two. The engine derives the tier
   from the band rather than storing it, so re-cutting the bands re-cuts the estate for free.

   `at` is the LEVEL the tier opens at and must match a band's `from`; Estate3D validates it. */

const ESTATE_TIERS = [
  { at:  1, name: "The bedsit",      art: "assets/estate/items/tier1.webp",
    blurb: "Above the chip shop. The window doesn't shut." },
  { at:  6, name: "The flat",        art: "assets/estate/items/tier2.webp",
    blurb: "A balcony, and something growing on it." },
  { at: 11, name: "The townhouse",   art: "assets/estate/items/tier3.webp",
    blurb: "Bay windows. Brass on the door." },
  { at: 16, name: "The apartment",   art: "assets/estate/items/tier4.webp",
    blurb: "The terrace wraps all the way round." },
  { at: 21, name: "The penthouse",   art: "assets/estate/items/tier5.webp",
    blurb: "The pool is on the roof. So is everyone else." },
  { at: 26, name: "The villa",       art: "assets/estate/items/tier6.webp",
    blurb: "Clifftop. There is a helipad. There is a yacht." },
];
