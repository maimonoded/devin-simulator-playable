"use strict";
/* pools.js — the draw. What a landing can turn up, and whether the tables say so honestly.

   These are content tests as much as code tests. A mis-authored pool does not throw; it looks
   exactly like bad luck, and it can go unnoticed for a whole balancing run. That is why
   Pools.validate() reports every problem at once and why it is asserted here as well as printed
   at boot. */

suite("pools: the tables");

test("the shipped pools validate clean", () => {
  deepEq(Pools.validate(), []);
});

test("every pool's weights sum to 100, so a row reads as a percentage", () => {
  Pools.keys().forEach(k => {
    const total = Pools.table(k).reduce((a, r) => a + r.weight, 0);
    eq(total, 100, `pool "${k}" sums to ${total}`);
  });
});

test("every tile type on the board points at a pool that exists, or is a corner", () => {
  const seen = new Set();
  for (let i = 0; i < boardSize(); i++) seen.add(tileType(i));
  seen.forEach(t => {
    if (BOARD_CORNERS.includes(t)) return eq(Pools.keyFor(t), null, `${t} is a corner and must have no pool`);
    ok(Pools.table(Pools.keyFor(t)), `${t} points at no table`);
  });
});

test("no pool is pure — GDD 3.2's rule, and the one worth defending while tuning", () => {
  Pools.keys().forEach(k => {
    const kinds = new Set(Pools.table(k).map(r => r.kind));
    ok(kinds.size >= 3, `pool "${k}" only pays ${[...kinds].join("/")} — a tile you can read is a tile you skip`);
  });
  ok(Pools.shareOf("money", "card") > 0, "even the money pool has to pay cards sometimes");
  ok(Pools.shareOf("clue", "money") > 0, "and the clue pool has to pay money");
});

test("only the Mixed pool can take money away, and it is the only one that feeds the Gala", () => {
  Pools.keys().forEach(k => {
    const negatives = Pools.table(k).filter(r => r.kind === "money" && r.amount < 0);
    if (k === "mixed") ok(negatives.length > 0, "the plot twist has to be able to hurt");
    else eq(negatives.length, 0, `pool "${k}" must not take money`);
  });
});

suite("pools: drawing");

test("a draw returns a row from that table and nothing else", () => {
  const rows = new Set(Pools.table("clue"));
  for (let k = 0; k < 400; k++) ok(rows.has(Pools.draw("clue")), "drew a row from somewhere else");
});

test("draws follow the authored weights", () => {
  const table = Pools.table("clue");
  const hits = new Map();
  const N = 20000;
  for (let k = 0; k < N; k++) {
    const r = Pools.draw("clue");
    hits.set(r.name, (hits.get(r.name) || 0) + 1);
  }
  table.forEach(r => {
    const got = (hits.get(r.name) || 0) / N * 100;
    near(got, r.weight, 2.5, `"${r.name}" came up ${got.toFixed(1)}% against an authored ${r.weight}%`);
  });
});

test("a corner draws nothing — it is a function, not a table", () => {
  BOARD_CORNERS.forEach(c => {
    const i = tilesOfType(c)[0];
    eq(Pools.drawAt(i), null, c);
  });
});

test("shareOf and boardShareOf agree with the tables", () => {
  const t = Pools.table("clue");
  const total = t.reduce((a, r) => a + r.weight, 0);
  const clue = t.filter(r => r.kind === "clue").reduce((a, r) => a + r.weight, 0);
  near(Pools.shareOf("clue", "clue"), clue / total, 1e-9);
  /* The board share is the number that actually sets pacing: a 52% clue pool on six of forty
     tiles is not a 52% clue rate. */
  let acc = 0;
  for (let i = 0; i < boardSize(); i++) acc += Pools.shareOf(Pools.keyFor(tileType(i)) || "", "clue");
  near(Pools.boardShareOf("clue"), acc / boardSize(), 1e-9);
  ok(Pools.boardShareOf("clue") < Pools.shareOf("clue", "clue"), "the corners and the money tiles dilute it");
});

test("the board's card and clue rates hit the DEMO pacing target", () => {
  const rolls = 40;                                   // an engaged player's day (GDD 6.6)
  const cards = Pools.boardShareOf("card") * rolls;
  const clues = Pools.boardShareOf("clue") * rolls;
  near(cards, 11, 3, `${cards.toFixed(1)} cards a day against a target of about 11`);
  /* RETUNED. GDD 6.6's 3.5 clues a day is the real economy; this build is a demo that has to
     put eight earned episodes inside a first session, which is about 87 rolls at ~25% a roll.
     A clue ROW also pays two now (the `n` field), so the story moves at roughly four times the
     rate the shipped game will. Change this number when the demo target changes — do not widen
     the tolerance to make a drift pass. */
  near(clues, 10, 2, `${clues.toFixed(1)} clues a day against the demo target of about 10`);
});

suite("pools: validate catches mis-authored content");

/* Swap in a broken table, assert the complaint, always put the real one back. */
function withBrokenPool(rows, fn) {
  const real = POOLS.money;
  POOLS.money = rows;
  try { return fn(Pools.validate()); } finally { POOLS.money = real; }
}

test("a table whose weights sum to zero is refused, not silently biased", () => {
  /* weighted() walks the rows subtracting a random slice of the total, so a zero total always
     returns the LAST row — a pool that looks fine and pays one thing forever. */
  withBrokenPool([{ name: "a", weight: 0, kind: "money", amount: 1 },
                  { name: "b", weight: 0, kind: "money", amount: 2 }],
    errs => ok(errs.some(e => /no positive weight/.test(e)), errs.join(" | ")));
});

test("a row with no weight, no name, or an unknown kind is reported", () => {
  withBrokenPool([{ name: "", weight: 50, kind: "money", amount: 1 },
                  { name: "b", weight: 0, kind: "money", amount: 2 },
                  { name: "c", weight: 50, kind: "wishes" }],
    errs => {
      ok(errs.some(e => /has no name/.test(e)), "the nameless row");
      ok(errs.some(e => /can never be drawn/.test(e)), "the weightless row");
      ok(errs.some(e => /which is not one of/.test(e)), "the unknown kind");
      ok(errs.length >= 3, "every problem at once, not the first: " + errs.join(" | "));
    });
});

test("a kind that needs a payload and has none is reported", () => {
  withBrokenPool([{ name: "a", weight: 50, kind: "money" },
                  { name: "b", weight: 25, kind: "energy", amount: 0 },
                  { name: "c", weight: 25, kind: "move", to: "nowhere" }],
    errs => {
      ok(errs.some(e => /needs a non-zero amount/.test(e)), "money with no amount");
      ok(errs.some(e => /needs a positive amount/.test(e)), "energy with no amount");
      ok(errs.some(e => /needs to:/.test(e)), "a move to nowhere");
    });
});

test("a board tile pointing at a pool that does not exist is reported", () => {
  const real = TILE_POOLS.std;
  TILE_POOLS.std = "ghost";
  try { ok(Pools.validate().some(e => /does not exist/.test(e))); }
  finally { TILE_POOLS.std = real; }
});
