"use strict";
/* Environment placement manifest — which pieces stand where.

   A classic script defining a global, for the same reason episode content is .js and not
   .json: everything outside js/ui/board3d.js is classic scripts sharing globals, and this
   file is edited by hand far more often than the code that reads it.

   Field reference and the rules a placement has to obey are in ART-BRIEF-ENV.md §7.
   Short version:  at:[x,z] world position · y: datum name or a world height · deck: true for
   the piece the board stands on · size: a prop's width in tiles · yaw: degrees.

   Swapping the whole environment is this file plus conformed .glb files — no code. */

const ENV_SCENE = {
  version: 1,

  /* The ground beyond the deck. `ground` is the plane that reaches the frame edge and fades
     out before it gets there; nothing generated can do that job, so it stays procedural and
     only its colour changes per environment. The rest is off because the modelled deck
     replaces it. */
  terrain: {
    ground: true,
    groundColor: 0x8a4a2c,        // dry red Texas dirt (0x1d4f8f is the harbour blue)
    shelf: false, island: false, plinth: false,
  },

  /* The harbour is still in assets/env/models — swapping back is this file, nothing else:
       terrain: { ground: true, groundColor: 0x1d4f8f, shelf: false, island: false, plinth: false }
       { model: "island", at: [0, 0], y: "deck", deck: true }
       { model: "boat", at: [11.5, 1.5], y: -2.15, yaw: 60, size: 2.6 }                          */
  pieces: [
    /* A small Texas town square. `deck: true` is the whole specification: the asset was
       conformed by tools/normalize-env.py, so the engine scales it to the board plus
       cfg.envDeckMargin on each side and drops it. No size, no anchor, nothing measured.

       The yaw is the one judgement call, and it is a design choice rather than a
       correction: this piece carries its storefronts along a single edge, and a quarter
       turn decides which side of the board they stand on. */
    { model: "texas-town", at: [0, 0], y: "deck", deck: true, yaw: 0 },
  ],
};
