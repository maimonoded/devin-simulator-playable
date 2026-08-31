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

   `at` is the LEVEL the tier opens at and must match a band's `from`; Estate3D validates it.

   ---- art, model, and which one you get ----

   `model` is a GLB that STANDS on the board, the way a tile's model does — an OPEN dollhouse,
   roof off and the near walls gone, so the camera looks down into the rooms rather than at a
   roof. `art` is the painting: the same place, seen from outside a gilt frame. The model is the
   estate and the painting is the FALLBACK — a tier with no model yet, or one whose file will not
   load, falls back to it. That is what lets the six tiers be modelled one at a time instead of
   all at once.

   Keep the two in step. The painting a tier falls back to should be a picture of the estate its
   model shows; assets/estate/README.md's step 6 is how, and it is one command.

   All six tiers are modelled. The paintings stay anyway: they are what a tier falls back to if
   its GLB ever fails to load, and the fallback is not decoration — it is the reason a broken or
   missing file costs a picture rather than the whole centre of the board.

   Changing tier is covered by a cloud, so the two buildings are never both on screen and neither
   is seen arriving. Estate3D owns that; nothing here has to know about it.

   Two optional numbers ride beside the path, and both exist because a generated mesh is not a
   drawing you can redraw:

     yaw    extra turn, in radians, on top of the turn that faces the estate at the camera.
            Image-to-3D returns a mesh in its reference image's frame, and no two references are
            drawn from the same angle.
     scale  multiplier on the tier's height. A villa is not a bedsit's size, and neither of them
            should have to be the size the mesh happened to arrive at.

   Neither is a code change, which is the point. */

const ESTATE_TIERS = [
  { at:  1, name: "The bedsit",      art: "assets/estate/items/tier1.webp",
    model: "assets/estate/models/tier1.glb",
    blurb: "Above the chip shop. The window doesn't shut." },
  { at:  6, name: "The flat",        art: "assets/estate/items/tier2.webp",
    model: "assets/estate/models/tier2.glb",
    blurb: "A balcony, and something growing on it." },
  { at: 11, name: "The townhouse",   art: "assets/estate/items/tier3.webp",
    model: "assets/estate/models/tier3.glb",
    blurb: "Bay windows. Brass on the door." },
  { at: 16, name: "The apartment",   art: "assets/estate/items/tier4.webp",
    model: "assets/estate/models/tier4.glb",
    blurb: "The terrace wraps all the way round." },
  { at: 21, name: "The penthouse",   art: "assets/estate/items/tier5.webp",
    model: "assets/estate/models/tier5.glb",
    blurb: "The pool is on the roof. So is everyone else." },
  { at: 26, name: "The villa",       art: "assets/estate/items/tier6.webp",
    model: "assets/estate/models/tier6.glb",
    blurb: "Clifftop. There is a helipad. There is a yacht." },
];
