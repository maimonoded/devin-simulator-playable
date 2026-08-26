"use strict";
/* util.js · config.js · board-model.js */

suite("util");

test("fmtShort compacts prices and never exceeds four characters", () => {
  eq(fmtShort(0), "0");
  eq(fmtShort(999), "999");
  eq(fmtShort(1000), "1k", "a bare 1.0 loses the pointless decimal");
  eq(fmtShort(2500), "2.5k");
  eq(fmtShort(2900), "2.9k");
  eq(fmtShort(9949), "9.9k");
  eq(fmtShort(9950), "10k", "no '10.0k' — the decimal is dropped once it would not fit");
  eq(fmtShort(12500), "13k");
  eq(fmtShort(999499), "999k");
  eq(fmtShort(999500), "1m", "rounding up rolls over a unit instead of printing '1000k'");
  eq(fmtShort(1240000), "1.2m");
  eq(fmtShort(3.4e9), "3.4b");
  eq(fmtShort(1.1e12), "1.1t");
  eq(fmtShort(-2500), "-2.5k");
  // the promise the upgrade row depends on: five of these fit one phone line
  for (const n of [0, 999, 1000, 2500, 9950, 12500, 999500, 1.24e6, 3.4e9, 1.1e12, 9.9e14])
    ok(fmtShort(n).length <= 4, `fmtShort(${n}) = "${fmtShort(n)}" is wider than 4 chars`);
});

test("fmt rounds and adds thousands separators", () => {
  eq(fmt(0), "0");
  eq(fmt(1234.6), "1,235");
  eq(fmt(-50), "-50");
  eq(fmt(1000000), "1,000,000");
});

test("rand stays within [a,b)", () => {
  withRandom([0, 0.5, 0.999999], () => {
    eq(rand(10, 20), 10);
    eq(rand(10, 20), 15);
    ok(rand(10, 20) < 20);
  });
});

test("chance is inclusive of 0 and exclusive of 1", () => {
  withRandom([0], () => { ok(chance(0.01)); ok(!chance(0)); });
  withRandom([0.99], () => { ok(!chance(0.5)); ok(chance(1)); });
});

test("weighted picks by weight and never returns undefined", () => {
  const table = [{ name: "a", weight: 1 }, { name: "b", weight: 0 }, { name: "c", weight: 9 }];
  withRandom([0], () => eq(weighted(table).name, "a"));
  withRandom([0.5], () => eq(weighted(table).name, "c"));
  // zero-weight entries are never chosen
  for (let i = 0; i < 50; i++) ok(weighted(table).name !== "b");
});

test("weighted survives an all-zero table", () => {
  const t = [{ name: "x", weight: 0 }, { name: "y", weight: 0 }];
  ok(weighted(t) !== undefined);
});

test("shuffle returns a permutation and leaves the input alone", () => {
  const src = [0, 1, 2, 3, 4];
  const out = shuffle(src);
  eq(out.length, 5);
  deepEq(src, [0, 1, 2, 3, 4], "input mutated");
  deepEq(out.slice().sort(), [0, 1, 2, 3, 4], "not a permutation");
});

test("shuffle actually reorders across many draws", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(shuffle([0, 1, 2]).join(""));
  ok(seen.size > 1, "shuffle never changed the order");
});

suite("config");

test("every tuning key exists in DEFAULTS", () => {
  const missing = [];
  TUNING.forEach(g => g.items.forEach(([key]) => {
    if (!(key in DEFAULTS)) missing.push(key);
  }));
  deepEq(missing, [], "tuning rows with no default");
});

test("tuning keys are unique", () => {
  const keys = [];
  TUNING.forEach(g => g.items.forEach(([k]) => keys.push(k)));
  eq(keys.length, new Set(keys).size, "duplicate tuning key");
});

test("deck and box tables have their default copies preserved", () => {
  eq(deck.length, defDeck.length);
  eq(boxTable.length, defBox.length);
  ok(deck !== defDeck, "defDeck must be a separate copy");
});

test("the train's two bonuses are a well-formed pair", () => {
  ok(typeof TRAIN_MULT === "undefined", "the old five-rung spread must be gone, not shadowed");
  ok(cfg.trainSmall > 0 && cfg.trainLarge > cfg.trainSmall, "large must be the bigger of the two");
  ok(cfg.trainLargeChance > 0 && cfg.trainLargeChance < 1, "both outcomes have to be reachable");
  // cfg.trainEV is derived from the pair; nothing pays from it, but the model is checked against it
  near(cfg.trainEV, Economy.trainEV(), 1e-9);
});

suite("board-model");

test("the shipped board validates, and every tile is a corner or a pool", () => {
  deepEq(validateBoard(0), [], "Season 1 must be well-formed");
  const known = new Set([...BOARD_CORNERS, ...Object.keys(TILE_POOLS)]);
  for (let i = 0; i < boardSize(); i++) ok(known.has(tileType(i)), `tile ${i} -> ${tileType(i)}`);
});

test("the four corners sit one per side, and Season 1 is GDD 3.1's budget", () => {
  const per = boardSize() / 4;
  BOARD_CORNERS.forEach((c, k) => eq(tileType(k * per), c, `corner ${k}`));
  const count = t => tilesOfType(t).length;
  eq(boardSize(), 40);
  eq(count("std"), 20);      eq(count("npc"), 6);
  eq(count("arrival"), 4);   eq(count("twist"), 6);
  eq(count("std") + count("npc") + count("arrival") + count("twist") + 4, boardSize());
});

test("the arrivals sit at the side midpoints", () => {
  const per = boardSize() / 4;
  deepEq(tilesOfType("arrival"), [0, 1, 2, 3].map(k => k * per + per / 2));
});

test("an NPC tile names who is on it, and a plain tile names nobody", () => {
  tilesOfType("npc").forEach(i => ok(tileArg(i), `tile ${i} has no character on it`));
  eq(tileArg(tilesOfType("std")[0]), null);
});

test("validateBoard reports EVERY problem, not the first", () => {
  const real = BOARD_SEASONS[0];
  BOARD_SEASONS[0] = { season: 9, name: "broken", tiles: ["std", "std", "npc", "nonsense"] };
  try {
    const errs = validateBoard(0);
    ok(errs.length >= 3, "a corner in the wrong place, an unknown type and a nameless NPC: " + errs.join(" | "));
    ok(errs.some(e => /premiere/.test(e)), "the missing corner");
    ok(errs.some(e => /nonsense/.test(e)), "the unknown type");
    ok(errs.some(e => /nobody on it/.test(e)), "the nameless NPC");
  } finally { BOARD_SEASONS[0] = real; }
});

test("a board must divide by four so its sides are equal", () => {
  const real = BOARD_SEASONS[0];
  BOARD_SEASONS[0] = { season: 9, name: "odd", tiles: new Array(38).fill("std") };
  try { ok(validateBoard(0).some(e => /divide by 4/.test(e))); }
  finally { BOARD_SEASONS[0] = real; }
});

test("gridPos gives one unique ring cell per tile, on a grid of side N/4+1", () => {
  const n = boardSize(), m = gridN() - 1;
  eq(gridN(), n / 4 + 1, "the ring's four sides share their corners");
  const cells = new Set();
  for (let i = 0; i < n; i++) {
    const p = gridPos(i);
    ok(p.r >= 0 && p.r <= m && p.c >= 0 && p.c <= m, `tile ${i} off-grid`);
    ok(p.r === 0 || p.r === m || p.c === 0 || p.c === m, `tile ${i} not on the ring`);
    cells.add(p.r + "," + p.c);
  }
  eq(cells.size, n, "duplicate grid cell");
});

test("Start sits at the bottom-facing corner and corners are corners", () => {
  const m = gridN() - 1, per = boardSize() / 4;
  deepEq(gridPos(0), { r: m, c: m }, "Start should be the screen-bottom vertex");
  [0, 1, 2, 3].map(k => k * per).forEach(i => {
    const p = gridPos(i);
    ok((p.r === 0 || p.r === m) && (p.c === 0 || p.c === m), `corner tile ${i} not on a grid corner`);
  });
});

test("consecutive tiles are always grid-adjacent", () => {
  const n = boardSize();
  for (let i = 0; i < n; i++) {
    const a = gridPos(i), b = gridPos((i + 1) % n);
    eq(Math.abs(a.r - b.r) + Math.abs(a.c - b.c), 1, `tiles ${i}->${(i + 1) % n} not adjacent`);
  }
});

test("no tile carries a printed value any more — the position weights are gone", () => {
  ok(typeof stdWeights === "undefined",
     "a tile that draws cannot advertise a number; the weights must be gone, not shadowed");
});

test("tileImagePath is 1-based and points into assets/tiles", () => {
  eq(tileImagePath(0), "assets/tiles/1.png", "the first tile (Start) uses 1.png");
  eq(tileImagePath(5), "assets/tiles/6.png");
  eq(tileImagePath(39), "assets/tiles/40.png", "the last tile uses 40.png");
  eq(TILE_ART_DIR, "assets/tiles/");
  eq(TILE_ART_EXT, ".png");
});

test("every tile maps to a distinct art filename", () => {
  const paths = new Set();
  for (let i = 0; i < 40; i++) paths.add(tileImagePath(i));
  eq(paths.size, 40);
});

test("corner tiles land on the filenames the docs promise", () => {
  eq(tileImagePath(10), "assets/tiles/11.png");   // Spa
  eq(tileImagePath(20), "assets/tiles/21.png");   // VIP
  eq(tileImagePath(30), "assets/tiles/31.png");   // Premiere
});

test("pathToStart ends on Start and has the right length", () => {
  eq(pathToStart(39).length, 1);
  deepEq(pathToStart(39), [0]);
  eq(pathToStart(30).length, 10);
  eq(pathToStart(1).length, 39);
  eq(pathToStart(0).length, 40, "from Start it should be a full lap, not zero");
  [0, 1, 17, 30, 39].forEach(i => eq(pathToStart(i)[pathToStart(i).length - 1], 0, `from ${i}`));
});
