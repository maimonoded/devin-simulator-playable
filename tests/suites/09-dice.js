"use strict";
/* dice-model.js — the turn that puts a rolled number on top, and where a thrown pair lands.

   The point of these is that they don't restate the tables. A table agreeing with itself
   proves nothing, and this is exactly the kind of geometry that looks right in a screenshot
   while being wrong: a die showing 3 with 5 underneath reads as a die. So the face tests
   ROTATE a vector by the tilt and check where it ended up, and the two conventions the asset
   is built on — opposite faces sum to 7, right-handed — are asserted from the axis table. */

suite("dice geometry");

test("every face's tilt actually carries that face onto +Y", () => {
  for (let v = 1; v <= 6; v++) {
    const { axis, angle } = dieTopTilt(v);
    const got = dieRotateVec(DIE_FACE_AXIS[v], axis, angle);
    /* Rounded because the quarter turns run through Math.sin: 6.1e-17 is not a failure. */
    const r = got.map(c => +c.toFixed(6));
    eq(r[0], 0, `face ${v} lands off-axis in x`);
    eq(r[1], 1, `face ${v} does not end up on top`);
    eq(r[2], 0, `face ${v} lands off-axis in z`);
  }
});

test("the tilt is a rotation, not a squash — it preserves the other axes too", () => {
  /* A tilt that puts the right face up but mirrors the die would pass the test above and
     still show a mirror-image number. Check the frame stays right-handed under the turn. */
  for (let v = 1; v <= 6; v++) {
    const { axis, angle } = dieTopTilt(v);
    const X = dieRotateVec([1, 0, 0], axis, angle);
    const Y = dieRotateVec([0, 1, 0], axis, angle);
    const cross = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]];
    const Z = dieRotateVec([0, 0, 1], axis, angle);
    cross.forEach((c, i) => eq(+c.toFixed(6), +Z[i].toFixed(6), `face ${v} is mirrored`));
  }
});

test("the axis table is a real die: opposite faces sum to 7", () => {
  for (let v = 1; v <= 6; v++) {
    const a = DIE_FACE_AXIS[v];
    const opp = [1, 2, 3, 4, 5, 6].find(w =>
      DIE_FACE_AXIS[w].every((c, i) => c === -a[i]));
    ok(opp !== undefined, `face ${v} has no opposite`);
    eq(v + opp, 7, `${v} sits opposite ${opp}`);
  }
});

test("the axis table is right-handed: 1 up and 2 front puts 3 on the right", () => {
  /* This is the convention the GLB is built to, asserted here as well as at build time —
     tools/make-dice.py and this file have to agree or the die shows the wrong number. */
  deepEq(DIE_FACE_AXIS[1], [0, 1, 0]);
  deepEq(DIE_FACE_AXIS[2], [0, 0, 1]);
  deepEq(DIE_FACE_AXIS[3], [1, 0, 0]);
  /* up cross front = right, for a right-handed die */
  const up = DIE_FACE_AXIS[1], front = DIE_FACE_AXIS[2];
  const right = [up[1] * front[2] - up[2] * front[1],
                 up[2] * front[0] - up[0] * front[2],
                 up[0] * front[1] - up[1] * front[0]];
  deepEq(right, DIE_FACE_AXIS[3]);
});

test("a bad face value is refused rather than quietly landing on 1", () => {
  throws(() => dieTopTilt(7), "7 is not a die face");
  throws(() => dieTopTilt(0), "0 is not a die face");
  throws(() => dieTopTilt(undefined), "a missing value is not a die face");
});

test("dice land spread across the screen, not diagonally up it", () => {
  const p = diceLanding(2, 1.4);
  eq(p.length, 2);
  /* Centred on the board: the two offsets cancel. */
  eq(+(p[0].x + p[1].x).toFixed(6), 0);
  eq(+(p[0].z + p[1].z).toFixed(6), 0);
  /* Spread apart by exactly `spread` in world distance. */
  const d = Math.hypot(p[1].x - p[0].x, p[1].z - p[0].z);
  eq(+d.toFixed(6), 1.4);
  /* And along the screen's horizontal, which is world (1,0,-1)/sqrt(2) at 45° azimuth —
     so x and z move oppositely and equally. Equal-and-same-sign would be straight up-screen. */
  eq(+(p[1].x - p[0].x).toFixed(6), -(+(p[1].z - p[0].z).toFixed(6)));
});

test("a single die lands dead centre", () => {
  const p = diceLanding(1, 1.4);
  eq(p.length, 1);
  eq(+p[0].x.toFixed(6), 0);
  eq(+p[0].z.toFixed(6), 0);
});

test("dice land around wherever the camera is looking, not the board's middle", () => {
  /* With camFollow on, the middle of the board is regularly off-screen — the dice have to
     come down in view. board3d.js passes the camera's current aim as the centre. */
  const p = diceLanding(2, 1.4, [3, -2]);
  eq(+((p[0].x + p[1].x) / 2).toFixed(6), 3);
  eq(+((p[0].z + p[1].z) / 2).toFixed(6), -2);
  /* Still spread the same way, just moved. */
  eq(+Math.hypot(p[1].x - p[0].x, p[1].z - p[0].z).toFixed(6), 1.4);
});

test("the throw comes in from the bottom-left of the screen", () => {
  /* Derived, not trusted: down-the-screen minus across-the-screen, normalised. The tidy
     (0,0,1) is a consequence of the 45° azimuth, not something to hard-code by eye. */
  const d = DIE_SCREEN_TOWARD.map((c, i) => c - DIE_SCREEN_RIGHT[i]);
  const len = Math.hypot(...d);
  d.forEach((c, i) => eq(+(c / len).toFixed(6), DIE_THROW_FROM[i], `axis ${i}`));
  /* And it is a direction, not a distance — dice3d.js scales it by cfg.diceThrowFrom. */
  eq(+Math.hypot(...DIE_THROW_FROM).toFixed(6), 1);
});

test("screen right and screen toward-camera are perpendicular unit vectors", () => {
  /* If these drift apart the throw corner and the spread stop agreeing with the projection. */
  eq(+Math.hypot(...DIE_SCREEN_RIGHT).toFixed(6), 1);
  eq(+Math.hypot(...DIE_SCREEN_TOWARD).toFixed(6), 1);
  const dot = DIE_SCREEN_RIGHT.reduce((a, c, i) => a + c * DIE_SCREEN_TOWARD[i], 0);
  eq(+dot.toFixed(6), 0);
});

test("the throw arc starts and ends on the table", () => {
  /* If either end is off zero the dice sink through the board or hang above it. */
  eq(diceArcHeight(0), 0);
  eq(diceArcHeight(1), 0);
  eq(diceArcHeight(1.5), 0, "past the end stays landed, it does not wrap");
  eq(diceArcHeight(-0.2), 0);
  ok(diceArcHeight(0.31) > 0.9, "peaks near the middle of the throw");
  /* The bounce is real but small, and never rivals the throw. */
  const bounce = diceArcHeight(0.7);
  ok(bounce > 0, "there is a bounce");
  ok(bounce < 0.25, "the bounce is a bounce, not a second throw");
});
