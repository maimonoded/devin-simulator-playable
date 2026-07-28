"use strict";
/* Environment placement manifest — which pieces stand where.

   A classic script defining a global, for the same reason episode content is .js and not
   .json: everything outside js/ui/board3d.js is classic scripts sharing globals, and this
   file is edited by hand far more often than the code that reads it.

   Field reference and the rules a placement has to obey are in ART-BRIEF-ENV.md §7.
   Short version:  at:[x,z] world position · y: datum name · yaw: degrees, 0 leaves the
   model's authored +Z facing +Z · size: width in tiles.

   The quay ring runs from 6.0 (plinth edge) to 7.5 (shoreline), so a prop centred at 6.8
   with size ≤ 1.4 sits on it comfortably. */

const ENV_SCENE = {
  version: 1,

  /* Which procedural terrain pieces to keep. The modelled island replaces the plinth and
     the island block; the sea stays, because nothing generated can reach the frame edge at
     every window shape. Turn these back on to see the piece the model is standing in for. */
  terrain: { sea: true, shelf: false, island: false, plinth: false },

  pieces: [
    /* The island the board stands on. anchor:"surface" puts its plaza — not its walls and
       not its keel — at deck level, so the board sits on it. */
    { model: "island", at: [0, 0], y: "deck", yaw: 45, anchor: "surface", fit: "surface", size: 11.9 },

    /* Boats. They go in the four world-axis directions, because those are the screen's
       corners — the only places water is visible once the island is in frame. Sunk a little
       below the waterline so they float rather than perch on it. */
    { model: "boat", at: [ 11.5,  1.5], y: -2.15, yaw:  60, size: 2.6 },
    { model: "boat", at: [  1.0, 11.8], y: -2.15, yaw: 200, size: 2.3 },
    { model: "boat", at: [-11.8, -1.0], y: -2.15, yaw: 120, size: 2.4 },
  ],
};
