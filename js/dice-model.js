"use strict";
/* Dice geometry: which way to turn a die so a given number ends up on top, and where a
   thrown pair comes to rest. Pure — no DOM, no three.js — so the tests can hold it, and so
   the one piece of this that is easy to get silently wrong is the piece that is checked.
   js/ui/dice3d.js does the rendering and knows none of this. */

/* Mirrors the asset contract in assets/dice/README.md: which way each face of die.glb points
   in the model's own space. If the GLB is ever rebuilt with a different mapping, this table is
   what has to move with it — nothing else here names a face. */
const DIE_FACE_AXIS = {
  1: [0, 1, 0],    // +Y, top
  6: [0, -1, 0],   // -Y
  2: [0, 0, 1],    // +Z, front
  5: [0, 0, -1],   // -Z
  3: [1, 0, 0],    // +X, right
  4: [-1, 0, 0],   // -X
};

const DIE_QUARTER = Math.PI / 2;

/* The turn that carries a face onto +Y, as an axis and an angle rather than an Euler triple.
   Euler order is a trap here: the renderer also wants to spin the die about the world's Y so
   two dice don't land identically, and whether that spin preserves "which face is up" depends
   entirely on which side it is composed on. An axis-angle hands the renderer an unambiguous
   quaternion to build, and the yaw goes on the left where it provably cannot tilt anything. */
const DIE_TOP_TILT = {
  1: { axis: [1, 0, 0], angle: 0 },
  2: { axis: [1, 0, 0], angle: -DIE_QUARTER },
  5: { axis: [1, 0, 0], angle: DIE_QUARTER },
  6: { axis: [1, 0, 0], angle: Math.PI },
  3: { axis: [0, 0, 1], angle: DIE_QUARTER },
  4: { axis: [0, 0, 1], angle: -DIE_QUARTER },
};

function dieTopTilt(value) {
  const t = DIE_TOP_TILT[value];
  if (!t) throw new Error(`dieTopTilt: ${value} is not a die face`);
  return t;
}

/* Rodrigues, so the tests can check the table by USING it rather than by restating it:
   turn each face's own axis by its tilt and assert the result is +Y. A table that agrees
   with itself proves nothing; this rotates a vector and looks at where it went. */
function dieRotateVec(v, axis, angle) {
  const [x, y, z] = v, [ax, ay, az] = axis;
  const c = Math.cos(angle), s = Math.sin(angle);
  const dot = ax * x + ay * y + az * z;
  return [
    x * c + (ay * z - az * y) * s + ax * dot * (1 - c),
    y * c + (az * x - ax * z) * s + ay * dot * (1 - c),
    z * c + (ax * y - ay * x) * s + az * dot * (1 - c),
  ];
}

/* The screen's own directions, in world terms. The camera sits at a fixed 45° azimuth, so
   neither world axis reads as "across" or "down" on its own — spreading dice along x alone
   would send them diagonally up-screen rather than sideways. */
const DIE_SCREEN_RIGHT = [Math.SQRT1_2, 0, -Math.SQRT1_2];
const DIE_SCREEN_TOWARD = [Math.SQRT1_2, 0, Math.SQRT1_2];   // down the screen, toward the camera

/* Where a throw comes from: the bottom-left corner of the view. That is down-the-screen plus
   left-of-screen, i.e. DIE_SCREEN_TOWARD - DIE_SCREEN_RIGHT, normalised — and because the two
   are 90° apart at 45° azimuth, their sum lands exactly on a world axis. The tests derive it
   rather than trusting the tidy answer. */
const DIE_THROW_FROM = [0, 0, 1];

function diceLanding(n, spread, centre) {
  const c = centre || [0, 0];
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) * spread;
    out.push({ x: c[0] + DIE_SCREEN_RIGHT[0] * t, z: c[1] + DIE_SCREEN_RIGHT[2] * t });
  }
  return out;
}

/* The arc of a throw, as a 0..1 progress -> height multiplier. One bounce: up, down hard,
   a small second hop, then still. Kept here rather than in the renderer so its shape is
   tunable and testable — it must start and end at zero or the dice hang in the air. */
function diceArcHeight(t) {
  if (t >= 1) return 0;
  if (t < 0) return 0;
  if (t < 0.62) {                       // the throw itself
    const u = t / 0.62;
    return Math.sin(u * Math.PI) * 1.0;
  }
  const u = (t - 0.62) / 0.38;          // the bounce
  return Math.sin(u * Math.PI) * 0.22 * (1 - u);
}
