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

suite("board-model");

test("tileType maps every index and only to known types", () => {
  const known = new Set(["start", "spa", "vip", "reshoot", "deck", "standard", "payroll", "overheads"]);
  for (let i = 0; i < 40; i++) ok(known.has(tileType(i)), `tile ${i} -> ${tileType(i)}`);
});

test("corners and card tiles sit where the layout says", () => {
  eq(tileType(0), "start"); eq(tileType(10), "spa");
  eq(tileType(20), "vip");  eq(tileType(30), "reshoot");
  // the deck moved onto the four bonus tiles; there is no separate chance tile any more
  [5, 15, 25, 35].forEach(i => eq(tileType(i), "deck", `tile ${i}`));
  [8, 13, 18, 28].forEach(i => eq(tileType(i), "standard", `tile ${i}`));
  eq(tileType(1), "standard");
});

/* The two bills. Their placement is the design, not a free choice: 20 apart so one is met
   about every half lap, each three tiles after a tile that PAYS OUT (Start at 0, the VIP
   Lounge at 20), and clear of the card tiles and Reshoot so nothing charges twice in three. */
test("the two bills sit three tiles after the two payouts, half a lap apart", () => {
  eq(tileType(3), "payroll");
  eq(tileType(23), "overheads");
  eq(23 - 3, 20, "half a lap apart");
  eq(3 - 0, 3, "Payroll follows Start");
  eq(23 - 20, 3, "Studio Overheads follows the VIP Lounge");
  /* Nothing may charge a player twice within three tiles, so the two bills and Reshoot — the
     only three tiles that take on their own — are each at least three apart. */
  const takers = [3, 23, 30];
  takers.forEach(a => takers.forEach(b => {
    if (a === b) return;
    const gap = Math.min((a - b + 40) % 40, (b - a + 40) % 40);
    ok(gap >= 3, `tiles ${a} and ${b} both charge and are only ${gap} apart`);
  }));
  [3, 23].forEach(i => ok(!DECKS.has(i) && !CORNERS[i], `tile ${i} must not be a card tile or a corner`));
});

test("there are 30 standard tiles", () => {
  // 40 less the four corners, the four card tiles and the two bills
  let n = 0;
  for (let i = 0; i < 40; i++) if (tileType(i) === "standard") n++;
  eq(n, 30);
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

/* Taking two indices out of `standard` re-normalises this table on its own — which is the
   point of deriving it from tileType rather than listing it. The mean is still exactly 1, so
   cfg.stdBase still means "what an average standard tile pays". */
test("stdWeights covers exactly the standard tiles and averages 1", () => {
  const keys = Object.keys(stdWeights).map(Number);
  eq(keys.length, 30);
  ok(!(3 in stdWeights) && !(23 in stdWeights), "a bill is not paid a standard tile's coins");
  keys.forEach(i => eq(tileType(i), "standard", `weight on non-standard tile ${i}`));
  const mean = keys.reduce((a, i) => a + stdWeights[i], 0) / keys.length;
  near(mean, 1, 1e-9);
});

test("tileImagePath is 1-based and points into assets/tiles", () => {
  eq(tileImagePath(0), "assets/tiles/1.png", "the first tile (Start) uses 1.png");
  eq(tileImagePath(39), "assets/tiles/40.png", "the last tile uses 40.png");
  eq(TILE_ART_DIR, "assets/tiles/");
  eq(TILE_ART_EXT, ".png");
});

/* The card tiles are the exception to the numbered convention: they are named by WHO is on
   them, so swapping a face is a word in TILE_FACES rather than a renamed file. */
test("a card tile's art is its character, not its number", () => {
  deepEq(Object.keys(TILE_FACES).map(Number).sort((a, b) => a - b), [5, 15, 25, 35],
         "the four card tiles, and only those, carry a face");
  eq(tileImagePath(5), "assets/tiles/faces/simon.png");
  eq(tileImagePath(15), "assets/tiles/faces/victoria.png");
  Object.keys(TILE_FACES).forEach(i => eq(tileFace(+i), TILE_FACES[i]));
  eq(tileFace(4), null, "a tile with no entry has no face");
});

test("every tile maps to a distinct art filename", () => {
  const paths = new Set();
  for (let i = 0; i < 40; i++) paths.add(tileImagePath(i));
  eq(paths.size, 40, "no two tiles may share a picture, face or numbered");
});

/* One model for the whole ring EXCEPT the four corners, and none at all on a card tile — null
   is the signal that its face should be drawn instead, which is what board3d.js keys the art
   path off. */
test("every plain tile draws the same model, and a card tile draws none", () => {
  const models = new Set();
  for (let i = 0; i < 40; i++) {
    const m = tileModelPath(i);
    if (tileFace(i)) eq(m, null, `tile ${i} carries a face, so it must ask for no model`);
    else if (tileType(i) === "standard") models.add(m);
  }
  deepEq([...models], [TILE_MODEL_STD], "the 30 standard tiles share one piece");
  ok(TILE_MODEL_STD.endsWith("standard.glb"));
});

/* A corner's model is named after the corner, so CORNERS is the only mapping — there is no
   second list that could drift out of step with it. The files themselves are allowed not to
   exist yet: an absent model leaves the plain slab, which is the documented contract. */
test("each corner asks for its own model, named after its type", () => {
  deepEq([0, 10, 20, 30].map(tileModelPath), [
    "assets/tiles/models/start.glb",
    "assets/tiles/models/spa.glb",
    "assets/tiles/models/vip.glb",
    "assets/tiles/models/reshoot.glb",
  ]);
  Object.keys(CORNERS).forEach(i => eq(tileModelPath(+i), `${TILE_MODEL_DIR}${CORNERS[i]}.glb`,
                                       `corner ${i} must be named after its type`));
  eq(new Set([0, 10, 20, 30].map(tileModelPath)).size, 4, "no two corners may share a model");
  eq(tileModelPath(1), TILE_MODEL_STD, "a plain tile still gets the shared piece");
});

/* A bill is named after its type exactly as a corner is, so BILLS is the whole mapping. The
   files are generated separately and are allowed not to exist yet: an absent model leaves the
   plain slab, which is the documented contract for every tile on the board. */
test("each bill asks for its own model, named after its type", () => {
  eq(tileModelPath(3), "assets/tiles/models/payroll.glb");
  eq(tileModelPath(23), "assets/tiles/models/overheads.glb");
  Object.keys(BILLS).forEach(i => eq(tileModelPath(+i), `${TILE_MODEL_DIR}${BILLS[i]}.glb`,
                                     `bill ${i} must be named after its type`));
  const named = [0, 10, 20, 30, 3, 23].map(tileModelPath);
  eq(new Set(named).size, 6, "no two named tiles may share a model");
  ok(!named.includes(TILE_MODEL_STD), "and none of them draws the paving");
});

test("corner tiles land on the filenames the docs promise", () => {
  eq(tileImagePath(10), "assets/tiles/11.png");   // Spa
  eq(tileImagePath(20), "assets/tiles/21.png");   // VIP
  eq(tileImagePath(30), "assets/tiles/31.png");   // Reshoot
});

test("pathToStart ends on Start and has the right length", () => {
  eq(pathToStart(39).length, 1);
  deepEq(pathToStart(39), [0]);
  eq(pathToStart(30).length, 10);
  eq(pathToStart(1).length, 39);
  eq(pathToStart(0).length, 40, "from Start it should be a full lap, not zero");
  [0, 1, 17, 30, 39].forEach(i => eq(pathToStart(i)[pathToStart(i).length - 1], 0, `from ${i}`));
});
