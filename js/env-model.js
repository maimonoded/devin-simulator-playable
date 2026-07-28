"use strict";
/* Environment geometry — pure numbers, no DOM and no three.js.

   The board's world is fixed: 40 tiles on an 11×11 grid centred on the origin, each slab
   running from y=0 to y=0.16. This file describes everything *around* that, and it lives
   here rather than inside js/ui/env3d.js for the same reason js/board-model.js exists —
   one place defines the layout, the art brief quotes it, and tests/run.js can load it.

   Two coordinate systems matter. World x/z is what pieces are authored and placed in.
   Screen space decides what is visible and what hides the board, and because the camera is
   a fixed orthographic 45° azimuth / 38° elevation it is only a rotation:

     u = (x - z) / √2     across the screen
     v = (x + z) / √2     toward the camera — larger v is NEARER the viewer

   The ring's four corners land at u = ±7.78 and v = ±7.78 (ENV_RING). Start is the one at
   +v, nearest the player. */

const ENV_CAM = { az: 45, el: 38 };      // camera azimuth / elevation, degrees — board3d.js reads these
const ENV_RING = 11 / Math.SQRT2;        // 7.778 — the ring's vertex, in screen-depth units
const ENV_BOARD_TOP = 0.16;              // top of a tile slab (TILE_H in board3d.js)

/* Vertical datums. The board never moves: `deck` is the underside of the tiles and the
   world is built downward from it, so adding the environment can't shift the board. */
const ENV_Y = { deck: 0, quay: -1.2, water: -1.85, keel: -3.6 };

/* Horizontal half-extents, in tiles. The ring itself is 5.5.
     plinth — the platform the board stands on, a 0.5 lip around the ring
     island — the land: leaves a 2.0–2.8 tile quay outside the plinth for props
     sea    — the water plane. 24 covers the visible diamond at every aspect with a little
              to spare, and no more: the sea fades out radially, so an oversized plane would
              push the fade past the frame and leave a hard edge instead. */
const ENV_SIZE = { plinth: 6.0, island: 7.5, sea: 24 };

/* Framing margin when the environment is off — the value board3d.js used before there was
   anything to see outside the ring. cfg.envMargin replaces it when the environment is on. */
const ENV_MARGIN_BARE = 1.12;
function envMargin() {
  return (typeof cfg === "object" && cfg.env3d) ? cfg.envMargin : ENV_MARGIN_BARE;
}

/* World (x,z) → screen axes. */
function envScreen(x, z) {
  return { u: (x - z) / Math.SQRT2, v: (x + z) / Math.SQRT2 };
}

/* Is (x,z) on screen at EVERY window shape?

   resize() picks a half-width of 11·m·√2/2 and derives the vertical half-extent from the
   aspect, so what is visible depends on the window. Working the two cases through, the
   region guaranteed at any aspect is exactly the diamond |u| ≤ 11m/√2, |v| ≤ 11m/√2 —
   which in world coordinates is this. Wide or tall windows show more, none show less. */
function envVisible(x, z, m) {
  const k = 11 * (m ?? envMargin());
  return Math.abs(x - z) <= k && Math.abs(x + z) <= k;
}

/* The highest world y a piece at (x,z) may reach.

   Absolute, not relative to whatever it stands on: a prop on the water and a prop on the
   island deck are constrained by the same sight line, and expressing the budget against
   each one's own datum only invites getting the subtraction wrong.

   A sight line toward the camera keeps u and gains height at tan(38°) per unit of v, so a
   piece hides board that shares its u and sits behind it in v. What matters is therefore
   the distance to the board's NEAR EDGE at this piece's u — not to the board's near corner.

   The ring's silhouette in screen axes is the diamond |u| + |v| ≤ ENV_RING, so that edge is
   at v = ENV_RING - |u|. Measuring against the corner instead (i.e. ENV_RING flat) says a
   piece level with the board's left or right point is unconstrained, and it is not: at
   u = 5.3 the board's near edge is only 2.5 deep, so a tall piece out there covers the
   tiles behind it. Past |u| = ENV_RING there is no board in that column at all. */
const ENV_FRAME_H = 3.0;                 // headroom above the deck before the frame clips
function envMaxTop(x, z) {
  const { u, v } = envScreen(x, z);
  const frame = ENV_Y.deck + ENV_FRAME_H;
  if (Math.abs(u) >= ENV_RING) return frame;
  const d = v - (ENV_RING - Math.abs(u));
  if (d <= 0) return frame;
  return Math.min(frame, ENV_BOARD_TOP + Math.tan(ENV_CAM.el * Math.PI / 180) * d);
}

/* Resolve one manifest entry (see assets/env/ART-BRIEF-ENV.md §7) into placement numbers,
   plus whatever is wrong with it. Pure, so tests can check a manifest without a canvas;
   env3d.js logs the problems rather than refusing, because a piece that is too tall still
   renders — it just sits badly, and saying so is more use than dropping it silently. */
function envPlace(piece) {
  const [x, z] = piece.at || [0, 0];
  const datum = typeof piece.y === "number" ? piece.y : ENV_Y[piece.y ?? "quay"];
  const problems = [];
  if (!piece.model) problems.push("no model");
  if (datum === undefined) problems.push(`unknown datum "${piece.y}"`);
  if (!(piece.size > 0)) problems.push("size must be > 0");
  if (!envVisible(x, z)) problems.push(`off screen at (${x}, ${z})`);
  const maxTop = envMaxTop(x, z);
  return {
    x, z,
    y: datum ?? ENV_Y.quay,
    /* Which part of the model lands on the datum.
         base    — the model's lowest point. Right for anything standing on the ground.
         top     — its highest point.
         surface — the height of the mesh directly above its own centre, found by casting a
                   ray down. This is the one the island needs: what has to line up with the
                   board is the plaza the board stands on, and that is neither the model's
                   top (the parapet wall) nor its base (a rocky keel of whatever depth the
                   generator felt like). Nothing else can locate it without being told. */
    anchor: ["top", "surface"].includes(piece.anchor) ? piece.anchor : "base",
    /* What `size` measures. "bbox" (the default) is the piece's full width including
       anything sticking out. "surface" measures only the flat top — the right choice when
       what has to be a given size is the deck rather than the silhouette. */
    fit: piece.fit === "surface" ? "surface" : "bbox",
    yaw: (piece.yaw || 0) * Math.PI / 180,
    size: piece.size || 1,
    maxTop,
    problems,
  };
}

/* Expand a `repeat: {count, step:[dx,dz]}` entry into individual placements. */
function envExpand(pieces) {
  const out = [];
  (pieces || []).forEach(p => {
    const rep = p.repeat;
    if (!rep || !(rep.count > 1)) { out.push(p); return; }
    const [dx, dz] = rep.step || [1, 0];
    for (let i = 0; i < rep.count; i++) {
      out.push(Object.assign({}, p, {
        at: [p.at[0] + dx * i, p.at[1] + dz * i],
        repeat: null,
      }));
    }
  });
  return out;
}
