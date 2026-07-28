"use strict";
/* env-model.js — the environment's geometry, and the manifest contract env3d.js renders.

   Everything here is checked against the board it has to agree with: the ring is 11 tiles
   across, its corners land at ±11/√2 in screen depth, and the tile slabs top out at 0.16.
   If those move, these numbers have to move with them, which is the point of the file. */

suite("env geometry");

test("screen axes put Start nearest the camera and the ring corners where the brief says", () => {
  /* Start is the +x+z corner of the ring; VIP is the opposite one. */
  eq(+envScreen(5.5, 5.5).v.toFixed(3), +ENV_RING.toFixed(3));
  eq(+envScreen(-5.5, -5.5).v.toFixed(3), -(+ENV_RING.toFixed(3)));
  /* The side corners sit on the across-screen axis, at zero depth. */
  eq(+envScreen(5.5, -5.5).u.toFixed(3), +ENV_RING.toFixed(3));
  eq(+envScreen(5.5, -5.5).v.toFixed(3), 0);
});

test("the visible region is the diamond |x±z| <= 11m, at any aspect", () => {
  const m = 1.7, k = 11 * m;
  ok(envVisible(0, 0, m));
  ok(envVisible(k / 2, k / 2, m), "the near vertex of the region is inside it");
  ok(!envVisible(k / 2 + 0.1, k / 2 + 0.1, m));
  ok(envVisible(k, 0, m), "the axis directions reach furthest — they are the screen corners");
  ok(!envVisible(k + 0.1, 0, m));
  /* The whole board is always in frame, even with the environment off. */
  [[5.5, 5.5], [-5.5, 5.5], [5.5, -5.5], [-5.5, -5.5]]
    .forEach(([x, z]) => ok(envVisible(x, z, ENV_MARGIN_BARE), `ring corner ${x},${z}`));
});

test("envMargin falls back to the bare-board framing when the environment is off", () => {
  const was = [cfg.env3d, cfg.envMargin];
  cfg.env3d = 0; eq(envMargin(), ENV_MARGIN_BARE);
  cfg.env3d = 1; cfg.envMargin = 1.7; eq(envMargin(), 1.7);
  [cfg.env3d, cfg.envMargin] = was;
});

test("the height budget is measured to the board's near edge, not its near corner", () => {
  const free = ENV_Y.deck + ENV_FRAME_H;
  /* Behind the board nothing can come between it and the camera. */
  eq(envMaxTop(-8, -8), free);
  /* Beyond the board's left and right points there is no board in that screen column. */
  eq(envMaxTop(12, -12), free);
  /* But level with them and slightly nearer, there is — this is the case a corner-based
     budget calls free and shouldn't. */
  ok(envMaxTop(7.5, 0) < free, "a tall piece out to the side still covers the tiles behind it");

  /* In front, the budget starts at the tile top and climbs by tan(38°) per unit of depth. */
  ok(envMaxTop(7, 7) < envMaxTop(9, 9), "further from the board buys more height");
  /* One number off the brief's table: 2 tiles in front of the near corner. */
  const v = ENV_RING + 2;
  eq(+envMaxTop(v / Math.SQRT2, v / Math.SQRT2).toFixed(2), 1.72);
  /* Just in front of the corner the budget is barely more than the tile it protects. */
  ok(envMaxTop(5.6, 5.6) < 0.4);
});

suite("env manifest");

test("envPlace resolves a datum name, converts the yaw and defaults the rest", () => {
  const p = envPlace({ model: "boat", at: [3, -2], y: "water", yaw: 90, size: 2 });
  eq(p.x, 3); eq(p.z, -2);
  eq(p.y, ENV_Y.water);
  eq(+p.yaw.toFixed(4), +(Math.PI / 2).toFixed(4));
  eq(p.anchor, "base");
  eq(p.fit, "bbox");
  deepEq(p.problems, []);
});

test("a numeric y is taken as a world height, not a datum name", () => {
  eq(envPlace({ model: "boat", at: [0, 0], y: -2.15, size: 1 }).y, -2.15);
});

test("anchor and fit only accept the modes env3d.js implements", () => {
  eq(envPlace({ model: "a", at: [0, 0], size: 1, anchor: "surface" }).anchor, "surface");
  eq(envPlace({ model: "a", at: [0, 0], size: 1, anchor: "top" }).anchor, "top");
  eq(envPlace({ model: "a", at: [0, 0], size: 1, anchor: "middle" }).anchor, "base",
     "an unknown anchor falls back rather than throwing");
  eq(envPlace({ model: "a", at: [0, 0], size: 1, fit: "surface" }).fit, "surface");
  eq(envPlace({ model: "a", at: [0, 0], size: 1, fit: "nonsense" }).fit, "bbox");
});

test("the problems list names what is wrong instead of dropping the piece", () => {
  const p = envPlace({ at: [400, 0] });
  ok(p.problems.some(s => /no model/.test(s)));
  ok(p.problems.some(s => /size/.test(s)));
  ok(p.problems.some(s => /off screen/.test(s)));
  eq(envPlace({ model: "a", at: [0, 0], size: 1, y: "nowhere" }).problems.length, 1);
});

test("envExpand turns a repeat into individual placements and leaves singles alone", () => {
  const one = { model: "a", at: [0, 0], size: 1 };
  deepEq(envExpand([one]), [one]);
  const rows = envExpand([{ model: "b", at: [1, 2], size: 1, repeat: { count: 3, step: [2, 0] } }]);
  eq(rows.length, 3);
  deepEq(rows.map(r => r.at), [[1, 2], [3, 2], [5, 2]]);
  ok(rows.every(r => !r.repeat), "expanded entries must not expand again");
});

test("the shipped manifest places every piece somewhere legal", () => {
  ENV_SCENE.pieces.forEach(piece => {
    const p = envPlace(piece);
    deepEq(p.problems, [], `${piece.model} at ${piece.at}`);
  });
});

test("the island is wide enough for the board to stand on it", () => {
  const island = ENV_SCENE.pieces.find(p => p.model === "island");
  ok(island, "the manifest should ship an island");
  ok(island.size > 11, "the ring is 11 tiles across — a smaller plaza puts it over the edge");
  eq(island.fit, "surface", "sized by its plaza, not by its silhouette");
  eq(island.anchor, "surface", "its plaza, not its walls, is what meets the board");
});
