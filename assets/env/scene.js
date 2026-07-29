"use strict";
/* Environment placement manifests — one entry per world the board can stand in.

   A classic script defining a global, for the same reason episode content is .js and not
   .json: everything outside js/ui/board3d.js is classic scripts sharing globals, and this
   file is edited by hand far more often than the code that reads it.

   Adding an environment is an entry here plus its conformed .glb files. Nothing else — the
   tuning drawer lists whatever this object contains, so a new world needs no code change.
   Field reference and the rules a placement has to obey are in ART-BRIEF-ENV.md §7.

   Each scene has:
     terrain — the procedural parts. `ground` is the plane that reaches the frame edge and
               fades out before it gets there; nothing generated can do that job, so it stays
               procedural and only its colour changes per world. The rest is off wherever a
               modelled deck replaces it.
     pieces  — the models. `deck: true` marks the one the board stands on. */

const ENV_SCENES = {

  "texas-town": {
    label: "Texas town",
    terrain: {
      ground: true,
      groundColor: 0x8a4a2c,        // dry red dirt
      shelf: false, island: false, plinth: false,
    },
    pieces: [
      /* `deck: true` is the whole specification: the asset was conformed by
         tools/normalize-env.py, so the engine scales it to the board plus cfg.envDeckMargin
         on each side and drops it. No size, no anchor, nothing measured.

         The yaw is the one judgement call left, and it is a design choice rather than a
         correction — a quarter turn decides which storefronts face the player. Anything but
         a quarter turn is rejected: the board is square, so only those keep its corners on
         a square deck. */
      { model: "texas-town", at: [0, 0], y: "deck", deck: true, yaw: 0 },
    ],
  },

  harbour: {
    label: "Harbour",
    terrain: {
      ground: true,
      groundColor: 0x1d4f8f,        // sea
      shelf: false, island: false, plinth: false,
    },
    pieces: [
      { model: "island", at: [0, 0], y: "deck", deck: true },
      /* Boats sit in the four world-axis directions, because those are the screen's corners
         — the only places water is visible once the island is in frame. `size` is the piece's
         width in tiles and `yaw` is free: a prop has nothing to line up with. `y` is below
         the waterline so they float rather than perch on it. */
      { model: "boat", at: [ 11.5,  1.5], y: -2.15, yaw:  60, size: 2.6 },
      { model: "boat", at: [  1.0, 11.8], y: -2.15, yaw: 200, size: 2.3 },
      { model: "boat", at: [-11.8, -1.0], y: -2.15, yaw: 120, size: 2.4 },
    ],
  },
};
