"use strict";
/* The cast — who walks the board, and how each one has to be turned to face where it is going.

   A classic script defining a global, for the same reason assets/env/scene.js is one: everything
   outside js/ui/board3d.js is classic scripts sharing globals, and this file is edited by hand far
   more often than the code that reads it. Adding a character is an entry here plus its .glb.

   Fields:
     id      stable key, also what a warning names when the file is missing
     name    the character, for humans reading this file
     model   path to the GLB
     yaw     DEGREES to add so the figure fronts +Z — see below
     start   the tile it begins on, 0-39. Spread them out; nothing enforces it
     pace    step time multiplier. 1 is cfg.npcStepMs, higher is slower

   ---- yaw is data, not a convention ----

   +Z is the house convention (assets/tiles/ART-BRIEF.md §2.1) and the engine turns each figure to
   face its direction of travel on that assumption. Two of these three arrived on it and one did
   not, and it is not a defect in the asset — it is what the offline normalizer does.

   normalize_tile.py squares a model to the axes by fitting a minimum-area rectangle to the bottom
   fifth of its height, because on a tile that band is the floor. For a man in boots it is two
   rectangles and the fit is stable: Simon squared by 4.0 degrees, Carl by 13.5. Victoria's coat
   hem is nearly circular, the minimum-area rectangle around a circle is arbitrary, and she came
   back squared by 87.5 — a quarter turn applied for no reason.

   Every check still passed, because a 1x1 footprint is 1x1 whichever way round the figure stands.
   The tell is the footprint's SHAPE, since shoulders are wider than a body is deep: the two men
   measured (1.00, 0.78) and (1.00, 0.76), Victoria (0.77, 1.00). A figure whose footprint is
   deeper than it is wide is a quarter turn out.

   So the number lives here rather than being baked into the mesh or guessed at load: the next
   character in a long coat will land somewhere else again, and one field is cheaper than
   re-generating an asset that is otherwise perfectly good. See assets/npcs/README.md. */

const NPC_CAST = [
  /* Six months on the street and in no hurry — the slowest of the three. */
  { id: "simon", name: "Simon", model: "assets/npcs/models/simon.glb",
    yaw: 0, start: 7, pace: 1.25 },
  /* Fronts -X: the coat-hem case above. */
  { id: "victoria", name: "Victoria", model: "assets/npcs/models/victoria.glb",
    yaw: 90, start: 21, pace: 1.0 },
  /* Late for a flight he is about to be thrown off. */
  { id: "carl", name: "Carl", model: "assets/npcs/models/carl.glb",
    yaw: 0, start: 34, pace: 0.8 },
];
