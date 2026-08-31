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
    /* One building per band left the levels inside it looking identical but for the lamp, which
       is not enough to read as progress. `levels` names a different GLB at a given level, so the
       room can improve a piece at a time without leaving the tier. Optional and per level — a
       tier with none of these behaves exactly as before.

       The bedsit's five are one story told in four steps, and each was generated FROM THE ONE
       BEFORE IT so the improvements accumulate rather than reset:

         1  a wreck
         2  a conspicuously new bed, white sheets and a blue blanket, in a room still ruined
         3  the upper floor reboarded in clean gold, and a red rug
         4  the upper walls stripped and painted sage, white skirting, white window frame
         5  the shop below replastered and tidied, plants in, and the fire escape mended

       What makes each step legible is CONTRAST, not size: the new thing has to look wrong in the
       old room. The first attempt at level 2 politely upgraded the bed and read as nothing at
       all at the size this renders. The blue blanket is the whole trick — the only saturated
       colour in the tier, so it survives being two hundred pixels wide. */
    levels: { 2: "assets/estate/models/tier1-lv2.glb",
              3: "assets/estate/models/tier1-lv3.glb",
              4: "assets/estate/models/tier1-lv4.glb",
              5: "assets/estate/models/tier1-lv5.glb" },
    blurb: "Above the chip shop. The window doesn't shut." },
  { at:  6, name: "The flat",        art: "assets/estate/items/tier2.webp",
    model: "assets/estate/models/tier2.glb",
    /* The flat is not a wreck, so a step inside it cannot be read the way the bedsit's are.
       There the contrast was new-against-DERELICT; here the room is already pleasant and the
       only contrast left is new-against-PLAIN, which is a narrower gap and has to be paid for
       in colour rather than in condition.

       Level 7 is the furniture rung of the same arc — the ground floor's plain beige sofa
       replaced by an emerald velvet one, and nothing else in the building touched. Emerald
       because the tier had already spent every other saturated colour it owns: blue on the
       balcony, the terrace, the bicycle and the boat, yellow on the door and the bed. Green
       was here only as leaves, so an emerald object is the one thing that cannot be mistaken
       for something that was always there.

       The wicker sofa stays beside it deliberately. Two variants came back and the one that
       deleted it was the worse asset: with nothing plain left in shot the new sofa is merely
       the furniture, where next to the old one it is visibly an upgrade.

       The band then follows the bedsit's shape — furniture, floor, walls, structure:

         7  an emerald velvet sofa, delivered into a room that is otherwise all cream and beige
         8  blue-and-white patterned encaustic tiles laid across the whole ground floor
         9  the back walls painted crisp white, and a real fitted kitchen along them
        10  the terrace done properly: a vine-covered pergola, loungers, planting all round the
            balustrade, and the little boat repainted

       Note which of those actually survive image-to-3D, because it is not the ones you would
       expect. The pergola at 10 is the most legible step in the band by a distance: it stands
       ABOVE the roofline, where nothing occludes it, so it reconstructs cleanly every time and
       changes the building's silhouette rather than its contents. The floor at 8 is the least
       reliable — a large flat area lying UNDER the first-floor overhang, which is where the
       camera has least information — and the first conversion came back with the tiles gone
       entirely and the slab plain grey. The one that shipped is a second sample of the same
       cutout. See the commit for the rule this produced. */
    levels: { 7: "assets/estate/models/tier2-lv7.glb",
              8: "assets/estate/models/tier2-lv8.glb",
              9: "assets/estate/models/tier2-lv9.glb",
             10: "assets/estate/models/tier2-lv10.glb" },
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
