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

test("Plot Twist and box tables have their default copies preserved", () => {
  eq(twistDeck.length, defTwistDeck.length);
  eq(boxTable.length, defBox.length);
  ok(twistDeck !== defTwistDeck, "defTwistDeck must be a separate copy");
});

test("the train's two bonuses are a well-formed pair", () => {
  ok(typeof TRAIN_MULT === "undefined", "the old five-rung spread must be gone, not shadowed");
  /* The rework's deletions, asserted the same way: a global that still exists somewhere is a
     global something can still accidentally read. */
  ok(typeof MULTIPLIERS === "undefined", "the roll stake spread is gone with the multiplier");
  ok(typeof rollDice === "undefined", "the dice are gone");
  ok(typeof Builders === "undefined", "builders are gone — Tickets replaced them");
  ok(typeof deck === "undefined", "the bare `deck` global is gone; the Plot Twist table is twistDeck");
  ok(cfg.trainSmall > 0 && cfg.trainLarge > cfg.trainSmall, "large must be the bigger of the two");
  ok(cfg.trainLargeChance > 0 && cfg.trainLargeChance < 1, "both outcomes have to be reachable");
  // cfg.trainEV is derived from the pair; nothing pays from it, but the model is checked against it
  near(cfg.trainEV, Economy.trainEV(), 1e-9);
});

suite("board-model");

test("tileType maps every index and only to known types", () => {
  const known = new Set(["start", "spa", "vip", "premiere", "train", "deck", "standard"]);
  for (let i = 0; i < 40; i++) ok(known.has(tileType(i)), `tile ${i} -> ${tileType(i)}`);
});

test("corners, trains and decks sit where the layout says", () => {
  eq(tileType(0), "start"); eq(tileType(10), "spa");
  eq(tileType(20), "vip");  eq(tileType(30), "premiere");
  [5, 15, 25, 35].forEach(i => eq(tileType(i), "train", `tile ${i}`));
  [3, 8, 13, 18, 23, 28].forEach(i => eq(tileType(i), "deck", `tile ${i}`));
  eq(tileType(1), "standard");
});

test("there are 26 standard tiles", () => {
  let n = 0;
  for (let i = 0; i < 40; i++) if (tileType(i) === "standard") n++;
  eq(n, 26);
});

test("gridPos gives 40 unique cells inside an 11x11 ring", () => {
  const cells = new Set();
  for (let i = 0; i < 40; i++) {
    const p = gridPos(i);
    ok(p.r >= 0 && p.r <= 10 && p.c >= 0 && p.c <= 10, `tile ${i} off-grid`);
    ok(p.r === 0 || p.r === 10 || p.c === 0 || p.c === 10, `tile ${i} not on the ring`);
    cells.add(p.r + "," + p.c);
  }
  eq(cells.size, 40, "duplicate grid cell");
});

test("Start sits at the bottom-facing corner and corners are corners", () => {
  deepEq(gridPos(0), { r: 10, c: 10 }, "Start should be the screen-bottom vertex");
  [0, 10, 20, 30].forEach(i => {
    const p = gridPos(i);
    ok((p.r === 0 || p.r === 10) && (p.c === 0 || p.c === 10), `corner tile ${i} not on a grid corner`);
  });
});

test("consecutive tiles are always grid-adjacent", () => {
  for (let i = 0; i < 40; i++) {
    const a = gridPos(i), b = gridPos((i + 1) % 40);
    eq(Math.abs(a.r - b.r) + Math.abs(a.c - b.c), 1, `tiles ${i}->${(i + 1) % 40} not adjacent`);
  }
});

test("stdWeights covers exactly the standard tiles and averages 1", () => {
  const keys = Object.keys(stdWeights).map(Number);
  eq(keys.length, 26);
  keys.forEach(i => eq(tileType(i), "standard", `weight on non-standard tile ${i}`));
  const mean = keys.reduce((a, i) => a + stdWeights[i], 0) / keys.length;
  near(mean, 1, 1e-9);
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
