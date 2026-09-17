"use strict";
/* board-actor.js · tiles/* — landing behaviour, asserted on the returned event lists */

/* Collect every float/log/reveal/etc. an event list carries. */
function evField(events, field) { return events.filter(e => e[field]).map(e => e[field]); }

suite("board-actor: reward helpers");

test("gainCoins adds coins and returns a float event", () => {
  freshRun();
  const t = TILE_TYPES.standard;
  state.coins = 100;
  const ev = t.gainCoins(50);
  eq(state.coins, 150);
  ok(ev.float, "should return a float event");
  eq(ev.float.text, "+50");
});

test("gainEnergy tops up to the cap", () => {
  freshRun();
  const t = TILE_TYPES.standard;
  state.energy = cfg.energyCap - 2;
  t.gainEnergy(10);
  eq(state.energy, cfg.energyCap, "clamped to the cap");
});

test("gainEnergy never reduces a balance already above the cap", () => {
  freshRun();
  const t = TILE_TYPES.standard;
  state.energy = 500;                      // bought from the store
  t.gainEnergy(5);
  eq(state.energy, 500, "an over-cap balance must not be clamped down");
});

test("presentation builders produce well-formed events", () => {
  const t = TILE_TYPES.standard;
  deepEq(t.reveal("+5", "sub", { positive: true, energy: true, ms: 900 }),
         { reveal: { big: "+5", sub: "sub", positive: true, energy: true, ms: 900 } });
  deepEq(t.reveal("x", "y"), { reveal: { big: "x", sub: "y", positive: false, energy: false, ms: undefined } });
  deepEq(t.collect("+9", "Bonus"), { collect: { big: "+9", sub: "Bonus" } });
  deepEq(t.card("Windfall", "+300", { positive: true }),
         { card: { name: "Windfall", big: "+300", positive: true, energy: false, item: null } });
  /* `item` is the Catalog id of a granted prop, and it is always PRESENT — null when there was
     none. The card's face (js/ui/card-art.js) shows which prop was found, and an absent key and
     a null one are the same thing to read but not the same thing to forget to send. */
  deepEq(t.card("Prop from the set", "x1", { positive: true, item: "ring" }),
         { card: { name: "Prop from the set", big: "x1", positive: true, energy: false, item: "ring" } });
});

test("startLandingBonus pays pass + land and seeds VIP", () => {
  freshRun();
  state.coins = 0; state.vip = 0;
  const paid = TILE_TYPES.start.startLandingBonus(2);
  eq(paid, (cfg.startPass + cfg.startLand) * cfg.boardScale * 2);
  eq(state.coins, paid);
  eq(state.vip, cfg.vipSeed * cfg.boardScale);
});

/* The deck's Advance-to-Start card is the only caller left now the Reshoot corner has taken
   the jail's job, but the helper lives on Tile and any tile may use it. */
test("advanceToStart moves the token to 0 and reveals the bonus", () => {
  freshRun();
  state.pos = 30;
  const ev = TILE_TYPES.deck.advanceToStart(30, 1, 90, "swept");
  eq(state.pos, 0, "token must land on Start");
  const move = ev.find(e => e.move);
  eq(move.move.path.length, 10);
  eq(move.move.path[move.move.path.length - 1], 0);
  eq(move.move.stepMs, 90);
  const reveal = ev.find(e => e.reveal).reveal;
  eq(reveal.positive, true);
  eq(reveal.sub, "swept");
  eq(reveal.ms, cfg.startRevealMs, "arrival uses the Start dwell time");
});

suite("tiles: registry");

test("every board type has a registered tile", () => {
  const types = new Set();
  for (let i = 0; i < 40; i++) types.add(tileType(i));
  types.forEach(t => ok(TILE_TYPES[t], "no tile registered for " + t));
});

test("tiles inherit the shared base and expose the render contract", () => {
  Object.values(TILE_TYPES).forEach(t => {
    ok(t instanceof Tile && t instanceof BoardActor, t.type + " must extend Tile/BoardActor");
    eq(typeof t.icon, "string");
    eq(typeof t.corner, "boolean");
    eq(typeof t.valueLabel(1), "string");
    eq(typeof t.onLand, "function");
  });
});

test("only the four corners are flagged as corners", () => {
  ["start", "spa", "vip", "reshoot"].forEach(t => eq(TILE_TYPES[t].corner, true, t));
  ["standard", "deck", "payroll", "overheads"].forEach(t => eq(TILE_TYPES[t].corner, false, t));
});

suite("tiles: landing behaviour");

test("standard pays its printed value and prints what it pays", () => {
  freshRun();
  state.coins = 0;
  const i = 9;
  const ev = TILE_TYPES.standard.onLand({ pos: i, mult: 1, bs: cfg.boardScale });
  const expected = cfg.stdBase * stdWeights[i] * cfg.boardScale;
  near(state.coins, expected, 1e-9);
  eq(TILE_TYPES.standard.valueLabel(i), String(Math.round(expected)));
  eq(evField(ev, "reveal").length, 0, "standard tiles must not interrupt play");
});

test("standard payout scales with the multiplier", () => {
  freshRun();
  state.coins = 0;
  TILE_TYPES.standard.onLand({ pos: 9, mult: 5, bs: 1 });
  near(state.coins, cfg.stdBase * stdWeights[9] * 5, 1e-9);
});

test("spa grants energy and flags the dice shower", () => {
  freshRun();
  state.energy = 0;
  const ev = TILE_TYPES.spa.onLand({});
  eq(state.energy, cfg.spaEnergy);
  const r = ev.find(e => e.reveal).reveal;
  eq(r.positive, true);
  eq(r.energy, true, "energy wins get the dice shower");
});

test("vip collects the whole pool, then leaves it empty", () => {
  freshRun();
  state.vip = 400; state.coins = 0;
  const ev = TILE_TYPES.vip.onLand({});
  eq(state.coins, 400);
  eq(state.vip, 0);
  eq(ev.find(e => e.reveal).reveal.positive, true);
  // second visit with an empty pool
  const ev2 = TILE_TYPES.vip.onLand({});
  eq(state.coins, 400, "nothing more to collect");
  eq(ev2.find(e => e.reveal).reveal.positive, false, "empty pool reads as a loss");
});

test("vip uses its own dwell time", () => {
  freshRun();
  state.vip = 10;
  eq(TILE_TYPES.vip.onLand({}).find(e => e.reveal).reveal.ms, cfg.vipRevealMs);
});

test("start pays pass + land and dwells for startRevealMs", () => {
  freshRun();
  state.coins = 0; state.vip = 0;
  const ev = TILE_TYPES.start.onLand({ mult: 1 });
  eq(state.coins, (cfg.startPass + cfg.startLand) * cfg.boardScale);
  eq(state.vip, cfg.vipSeed * cfg.boardScale);
  eq(ev.find(e => e.reveal).reveal.ms, cfg.startRevealMs);
});

suite("tiles: the two bills");

/* Payroll (3) and Studio Overheads (23) are the only tiles that take, and they take the same
   shape: cost x boardScale x mult, floored by the balance itself. The pair is asserted together
   because a divergence between them would be the bug — what differs is the number and the
   wording, not the mechanic. */
const BILL_TILES = [["payroll", "payrollCost", 3], ["overheads", "overheadsCost", 23]];

test("each bill is the type sitting on its index", () => {
  BILL_TILES.forEach(([type, , i]) => eq(tileType(i), type, `tile ${i}`));
  ok(cfg.overheadsCost > cfg.payrollCost, "Studio Overheads is the larger bill");
});

test("a bill charges cost x boardScale x mult", () => {
  BILL_TILES.forEach(([type, key, i]) => {
    freshRun();
    state.coins = 1e6;
    TILE_TYPES[type].onLand({ pos: i, mult: 1, bs: cfg.boardScale });
    near(state.coins, 1e6 - cfg[key] * cfg.boardScale, 1e-9, type);

    freshRun();
    state.coins = 1e6; cfg.boardScale = 2.5;
    TILE_TYPES[type].onLand({ pos: i, mult: 1, bs: cfg.boardScale });
    near(state.coins, 1e6 - Math.round(cfg[key] * 2.5), 1e-9, type + " at board scale");
  });
});

test("the bill scales with the stake, so a x5 roll pays five times", () => {
  BILL_TILES.forEach(([type, key, i]) => {
    freshRun();
    state.coins = 1e6;
    TILE_TYPES[type].onLand({ pos: i, mult: 5, bs: 1 });
    near(1e6 - state.coins, cfg[key] * 5, 1e-9, type);
    // and every stake charges the same per point of multiplier
    MULTIPLIERS.forEach(m => {
      freshRun();
      state.coins = 1e6;
      TILE_TYPES[type].onLand({ pos: i, mult: m, bs: 1 });
      near(1e6 - state.coins, cfg[key] * m, 1e-9, `${type} at x${m}`);
    });
  });
});

/* The balance is the guard — there is no separate clamp, so these are the cases that would
   catch one going missing. A player sitting on nothing pays nothing, a balance too small pays
   what is there and lands on exactly zero, and an overdrawn balance is not charged again. */
test("a bill can never take the player below zero", () => {
  BILL_TILES.forEach(([type, key, i]) => {
    freshRun();
    state.coins = 0;
    const broke = TILE_TYPES[type].onLand({ pos: i, mult: 1, bs: 1 });
    eq(state.coins, 0, type + " took coins that were not there");
    eq(evField(broke, "float").length, 1, "and still says the bill came due");

    freshRun();
    state.coins = 10;                       // far less than either bill
    TILE_TYPES[type].onLand({ pos: i, mult: 1, bs: 1 });
    eq(state.coins, 0, type + " should take the balance and stop");

    freshRun();
    state.coins = 12.4;                     // standard tiles pay fractions, so balances are fractional
    TILE_TYPES[type].onLand({ pos: i, mult: 1, bs: 1 });
    eq(state.coins, 0, type + " must land exactly on zero, not near it");

    freshRun();
    state.coins = -50;                      // a deck fine can leave one
    TILE_TYPES[type].onLand({ pos: i, mult: 1, bs: 1 });
    eq(state.coins, -50, type + " charged an already overdrawn balance");

    // the biggest bill the board can present: max stake, and a board scaled up
    freshRun();
    state.coins = 5; cfg.boardScale = 10;
    TILE_TYPES[type].onLand({ pos: i, mult: 10, bs: cfg.boardScale });
    eq(state.coins, 0, `${type} at x10 on a scaled board`);
    ok(cfg[key] * 10 * 10 > 5, "the test is only meaningful if the bill exceeds the balance");
  });
});

/* A bill floats and logs and gets out of the way. It must NOT block: the two are landed on
   0.28 times a lap between them — one roll in twenty — and every blocking beat is paid for
   again by auto-roll on every run. See the reasoning in js/tiles/payroll-tile.js. */
test("a bill floats its cost and never stops the board", () => {
  BILL_TILES.forEach(([type, , i]) => {
    freshRun();
    state.coins = 1e6;
    const ev = TILE_TYPES[type].onLand({ pos: i, mult: 1, bs: 1 });
    eq(ev.length, 1, type + " should resolve in one event");
    const f = evField(ev, "float")[0];
    ok(f && f.text.includes("\u2212"), "the float reads as a charge, not a payout");
    eq(f.color, "var(--bad)");
    ok(evField(ev, "log")[0].msg.length > 0, "the log is the receipt");
    ["reveal", "collect", "card", "minigame", "boxOpen", "move"].forEach(k =>
      eq(evField(ev, k).length, 0, `${type} must not ${k}`));
  });
});

test("a bill prints its price on the tile", () => {
  BILL_TILES.forEach(([type, key, i]) => {
    freshRun();
    eq(TILE_TYPES[type].valueLabel(i), "\u2212" + Math.round(cfg[key]));
    cfg[key] = 250;
    eq(TILE_TYPES[type].valueLabel(i), "\u2212250", "the label follows the drawer");
  });
});

suite("tiles: deck cards");

function forceCard(name, fn) {
  const saved = deck.map(c => c.weight);
  deck.forEach(c => { c.weight = c.name === name ? 100 : 0; });
  try { return fn(); } finally { deck.forEach((c, i) => { c.weight = saved[i]; }); }
}

test("a coin card pays and shows the drawn card", () => {
  freshRun();
  state.coins = 0;
  const ev = forceCard("Windfall", () => TILE_TYPES.deck.onLand({ pos: 5, mult: 1, bs: 1 }));
  eq(state.coins, 300);
  const card = ev.find(e => e.card).card;
  eq(card.name, "Windfall");
  eq(card.positive, true);
  eq(ev[0].log.msg.includes("Windfall"), true, "the log line comes first");
});

test("a fine costs coins, seeds VIP and reads as a loss", () => {
  freshRun();
  state.coins = 1000; state.vip = 0;
  const fine = deck.find(c => c.name === "Fine / Paparazzi");
  const ev = forceCard("Fine / Paparazzi", () => TILE_TYPES.deck.onLand({ pos: 5, mult: 1, bs: 1 }));
  eq(state.coins, 1000 + fine.coins, "the loss comes off the balance");
  eq(state.vip, fine.vip, "and is recycled into the VIP pool");
  eq(ev.find(e => e.card).card.positive, false);
});

test("an energy card pays 1…mult and flags the dice shower", () => {
  freshRun();
  state.energy = 0;
  const ev = forceCard("Small energy", () => TILE_TYPES.deck.onLand({ pos: 5, mult: 1, bs: 1 }));
  eq(state.energy, 1, "at 1x there is only one amount it can be");
  eq(ev.find(e => e.card).card.energy, true);
});

test("an energy card never pays more than the multiplier staked", () => {
  freshRun();
  for (let i = 0; i < 80; i++) {
    state.energy = 0;
    forceCard("Small energy", () => TILE_TYPES.deck.onLand({ pos: 5, mult: 5, bs: 1 }));
    ok(state.energy >= 1 && state.energy <= 5, "out of range: " + state.energy);
  }
});

test("an energy card never clamps a balance already above the cap", () => {
  freshRun();
  state.energy = 500;                      // bought from the store
  forceCard("Small energy", () => TILE_TYPES.deck.onLand({ pos: 5, mult: 10, bs: 1 }));
  eq(state.energy, 500, "an over-cap balance must not be clamped down");
});

test("an item card grants an item of the series being unlocked", () => {
  freshRun();
  const ev = forceCard("Prop from the set", () => TILE_TYPES.deck.onLand({ pos: 5, mult: 1, bs: 1 }));
  const held = Items.all();
  eq(held.length, 1, "exactly one kind of item");
  eq(held[0].count, 1);
  const cur = Unlock.current();
  const seriesId = Catalog.ancestorsOf(cur.kind, cur.id)[0].id;
  ok(Catalog.itemsOf(seriesId).some(i => i.id === held[0].item.id), "drawn from that series' set");
  const card = ev.find(e => e.card).card;
  ok(card.big.includes(held[0].item.icon), "the card shows the item's icon");
  ok(card.big.includes(held[0].item.name), "and its name");
  /* And the id rides along, so the drawn face can show the prop itself rather than only name
     it. Presentation only — the item is already in the inventory by here. */
  eq(card.item, held[0].item.id, "the card names which item it granted");
});

test("a card that grants nothing carries item: null", () => {
  freshRun();
  const ev = forceCard("Windfall", () => TILE_TYPES.deck.onLand({ pos: 5, mult: 1, bs: 1 }));
  eq(ev.find(e => e.card).card.item, null);
});

test("an item card pays coins when there is nothing left to unlock", () => {
  freshRun();
  Catalog.spine().forEach(e => { state.paid[e.key] = e.price.length; });
  eq(Unlock.current(), null, "the whole spine is paid for");
  state.coins = 0;
  forceCard("Prop from the set", () => TILE_TYPES.deck.onLand({ pos: 5, mult: 2, bs: 1 }));
  eq(state.coins, cfg.stdBase * 2, "one item's worth at the board's own unit of value");
  deepEq(state.items, {}, "and nothing granted");
});

/* ONE bonus card now. Which game it opens is Economy.trainDraw()'s call, not the deck's, so
   these force the SPLIT with withRandom rather than forcing a different card. */
function forceBonus(large, fn){
  /* Force the SPLIT through its own knob, not by stubbing Math.random. weighted() reads
     `Math.random()*total` and returns the first row once the running total is <= 0 — so pinning
     random to 0 makes it return the FIRST card in the table whatever the weights are, which
     quietly defeats forceCard and draws Small coins instead. chance(p) is `Math.random() < p`,
     so 1 is always-large and 0 is never. */
  const saved = cfg.trainLargeChance;
  cfg.trainLargeChance = large ? 1 : 0;
  try { return forceCard("Bonus Game", fn); } finally { cfg.trainLargeChance = saved; }
}

test("the small bonus banks cfg.trainSmall and opens its game", () => {
  freshRun();
  state.coins = 0;
  const ev = forceBonus(false, () => TILE_TYPES.deck.onLand({ pos: 5, mult: 2, bs: 1 }));
  eq(state.coins, cfg.trainSmall * 2, "banked before the game opens");
  const g = ev.find(e => e.minigame).minigame;
  eq(g.game, "train-small");
  eq(g.amount, cfg.trainSmall * 2, "the game is handed the finished number");
  ok(Array.isArray(g.items), "always a list, so a game never has to guess the shape");
  eq(Items.all().length, 1, "the small bonus pays a prop as well as coins");
  eq(g.items.length, 1, "and hands it to the game to present");
  eq(evField(ev, "float").length, 0, "the coins are the game's to reveal, so nothing floats");
});

test("the large bonus pays one rung of the engine's ladder", () => {
  freshRun();
  state.coins = 0;
  const ev = forceBonus(true, () => TILE_TYPES.deck.onLand({ pos: 5, mult: 1, bs: 1 }));
  const g = ev.find(e => e.minigame).minigame;
  eq(g.game, "train-large");
  eq(g.tiers.length, 3, "three rungs");
  eq(g.tiers[2], cfg.trainLarge, "the top rung is the model's number");
  eq(g.amount, g.tiers[g.winIndex], "the amount IS the rung the engine picked");
  eq(state.coins, g.amount, "banked before the game opens");
});

test("the large bonus also grants the item it hands the game", () => {
  freshRun();
  const ev = forceBonus(true, () => TILE_TYPES.deck.onLand({ pos: 5, mult: 1, bs: 1 }));
  const g = ev.find(e => e.minigame).minigame;
  eq(g.items.length, 1);
  const held = Items.all();
  eq(held.length, 1, "granted, not just announced");
  eq(g.items[0].name, held[0].item.name);
  eq(g.items[0].count, held[0].count);
});

/* The large bonus's props are a LADDER, like its coins: one prize per rung, shown before the
   first pick. Which means the tile now draws three identities and banks exactly one of them, so
   the tests that matter are about the two rungs that did NOT land. Every one of these runs the
   real card through onLand — nothing here stubs Math.random, so the winning rung is whichever
   the engine picked and the assertions are written against g.winIndex. */
const largeBonus = (mult) => {
  freshRun();
  const ev = forceBonus(true, () => TILE_TYPES.deck.onLand({ pos: 5, mult, bs: 1 }));
  return ev.find(e => e.minigame).minigame;
};

test("tierItems is three rungs, index-aligned with the coin ladder", () => {
  for (let i = 0; i < 40; i++) {
    const g = largeBonus(1);
    ok(Array.isArray(g.tierItems), "tierItems must be a list");
    eq(g.tierItems.length, 3, "one entry per rung");
    eq(g.tierItems.length, g.tiers.length, "aligned with the coin rungs, not a separate shape");
    g.tierItems.forEach((rung, r) => {
      ok(Array.isArray(rung), `rung ${r} must be a list, even when empty`);
      rung.forEach(c => {
        eq(typeof c.icon, "string"); eq(typeof c.name, "string");
        ok(c.count > 0, "a chip with no count must be an absent chip, never a ×0");
      });
    });
  }
});

test("the flat items field IS the winning rung", () => {
  for (let i = 0; i < 40; i++) {
    const g = largeBonus(2);
    deepEq(g.items, g.tierItems[g.winIndex],
           "a consumer that ignores tierItems must still be handed the right prize");
  }
});

/* The whole point of the split: three identities are drawn so three rungs can be SHOWN, and
   only the one that landed reaches the inventory. A drawItem() call per rung would have banked
   all three — six props a round at x1 instead of two, on the currency the run is gated on. */
test("only the winning rung's props are granted", () => {
  const seenWinners = new Set();
  for (let i = 0; i < 60; i++) {
    const g = largeBonus(1);
    seenWinners.add(g.winIndex);
    const held = Items.all();
    const want = g.tierItems[g.winIndex];
    eq(held.length, want.length, "exactly the winning rung's props are held");
    eq(held.reduce((a, h) => a + h.count, 0),
       want.reduce((a, c) => a + c.count, 0),
       "the inventory moved by the winning rung's count and no other rung's");
    want.forEach(c => {
      const h = held.find(x => x.item.name === c.name);
      ok(h, `the run never banked ${c.name}`);
      eq(h.count, c.count, "and banked exactly what the rung promised");
    });
    /* A losing rung may name the same prop as the winner (one demand snapshot, three draws),
       so the check that catches a stray grant is the TOTAL above — never "the loser's prop is
       absent", which would fail on a legitimate repeat. The ladder always promises 6 at x1, so
       a tile that banked every rung would show up as 6 held against a want of 1, 2 or 3. */
    eq(g.tierItems.reduce((a, r) => a + r.reduce((b, c) => b + c.count, 0), 0), 6,
       "the whole ladder is 1+2+3, which is what a grant-them-all bug would leave in the bag");
  }
  eq(seenWinners.size, 3, "every rung should win sometimes — the ladder pick is uniform");
});

test("the ladder ascends, and the stake scales every rung", () => {
  [1, 2, 5, 10].forEach(m => {
    const g = largeBonus(m);
    const counts = g.tierItems.map(r => r.reduce((a, c) => a + c.count, 0));
    deepEq(counts, BONUS_LARGE_LADDER.map(n => n * m),
           `x${m}: each rung is its ladder entry times the stake`);
    ok(counts[0] < counts[1] && counts[1] < counts[2], "the richer rung pays more props");
  });
});

/* Same number of props per run as the flat prize it replaced, because the winning rung is an
   even pick of three and [1,2,3] averages 2. This is what lets CLAUDE.md's pacing table stand. */
test("the item ladder averages what the flat prize paid", () => {
  eq(BONUS_LARGE_LADDER.reduce((a, n) => a + n, 0) / BONUS_LARGE_LADDER.length, 2,
     "retuning the ladder off a mean of 2 changes the run's clock — re-measure it");
});

test("the large bonus's card face names no prop, so the ladder is not spoiled", () => {
  freshRun();
  const ev = forceBonus(true, () => TILE_TYPES.deck.onLand({ pos: 5, mult: 1, bs: 1 }));
  eq(ev.find(e => e.card).card.item, null,
     "a medallion of the winning rung's prop would tell the player which rung won");
  /* The small bonus has no rungs to give away, so its face still shows what was found. */
  freshRun();
  const small = forceBonus(false, () => TILE_TYPES.deck.onLand({ pos: 5, mult: 1, bs: 1 }));
  eq(small.find(e => e.card).card.item, Items.all()[0].item.id);
});

test("the log names the winning rung's props and no others", () => {
  for (let i = 0; i < 20; i++) {
    freshRun();
    const ev = forceBonus(true, () => TILE_TYPES.deck.onLand({ pos: 5, mult: 1, bs: 1 }));
    const g = ev.find(e => e.minigame).minigame;
    /* NOT ev[0]. On the bonus path the receipt is deliberately LAST — its ×count names the
       winning rung, so a log played before the game would hand the player the answer. Finding
       it by shape rather than by index is also what keeps this test honest about that. */
    const logs = ev.filter(e => e.log);
    eq(ev.indexOf(logs[0]), ev.length - 1, "the bonus receipt must come after the game");
    const msg = logs[0].log.msg;
    g.tierItems[g.winIndex].forEach(c => ok(msg.includes("×" + c.count), "the receipt is short: " + msg));
    /* The receipt has to match the bag: one item clause, however many rungs were drawn. */
    eq((msg.match(/×/g) || []).length, g.tierItems[g.winIndex].length,
       "a losing rung leaked into the log: " + msg);
  }
});

/* A finished spine has no series left whose props are worth finding, so every rung draws null.
   The ladder still has to be a well-formed three — an empty rung is an empty ARRAY, never a
   missing entry and never a ×0 chip. */
test("a run with nothing outstanding still hands the game a well-formed ladder", () => {
  freshRun();
  Catalog.spine().forEach(e => { state.paid[e.key] = e.price.length; });
  eq(Unlock.current(), null, "the whole spine is paid for");
  const ev = forceBonus(true, () => TILE_TYPES.deck.onLand({ pos: 5, mult: 5, bs: 1 }));
  const g = ev.find(e => e.minigame).minigame;
  deepEq(g.tierItems, [[], [], []], "three empty rungs, not a missing field");
  deepEq(g.items, [], "and the flat field is still the winning rung");
  deepEq(state.items, {}, "nothing granted");
  eq(state.coins, g.amount, "the coins are untouched by any of it");
  eq(ev.find(e => e.card).card.item, null);
});

/* tierItems is the LADDER game's field. The small bonus has no ladder to hang per-rung prizes
   on, and a game that received one would have nowhere honest to put it. */
test("the small bonus is sent no ladder at all", () => {
  freshRun();
  const ev = forceBonus(false, () => TILE_TYPES.deck.onLand({ pos: 5, mult: 3, bs: 1 }));
  const g = ev.find(e => e.minigame).minigame;
  eq(g.tierItems, undefined, "no per-rung prizes");
  eq(g.tiers, undefined, "and no coin rungs either — it is flat by design");
  eq(g.items.length, 1, "it still pays its one flat prop");
  eq(g.items[0].count, BONUS_SMALL_ITEMS * 3, "scaled by the stake");
});

/* pickItem() is the half of the draw that decides and banks NOTHING. If it ever started
   granting, the ladder would pay for rungs that lost and the flat item card would double-pay. */
test("pickItem chooses without granting; drawItem still banks", () => {
  freshRun();
  for (let i = 0; i < 20; i++) {
    const item = TILE_TYPES.deck.pickItem();
    ok(item && item.id, "a pick must still name a prop");
  }
  deepEq(state.items, {}, "twenty picks must leave the inventory untouched");
  const got = TILE_TYPES.deck.drawItem(4);
  eq(Items.count(got.item.id), 4, "and drawItem is unchanged: it picks and banks");
});

/* The point of the merge: one lever for "how often is a bonus", another for "how rich is it". */
test("the deck decides how often a bonus happens, the model decides which one", () => {
  freshRun();
  eq(deck.filter(c => c.game).length, 1, "exactly one card opens a bonus");
  eq(deck.find(c => c.game).game, "bonus", "and it does not name a game");
  const w = deck.reduce((a, c) => a + c.weight, 0);
  near(deck.find(c => c.game).weight / w, 0.25, 0.001, "the bonus card is a quarter of the deck");
  /* Change the split and only the split moves — the card's weight is untouched by it. */
  const before = deck.find(c => c.game).weight;
  cfg.trainLargeChance = 0.9;
  eq(deck.find(c => c.game).weight, before, "retuning the split does not retune the deck");
  resetCfg();
});

test("the advance card walks to Start and pays the landing bonus", () => {
  freshRun();
  state.pos = 5; state.coins = 0;
  const ev = forceCard("Advance to Start", () => TILE_TYPES.deck.onLand({ pos: 5, mult: 1, bs: 1 }));
  eq(state.pos, 0);
  eq(ev.find(e => e.move).move.path.length, 35);   // tile 5 is 35 steps from Start
  eq(state.coins, (cfg.startPass + cfg.startLand) * cfg.boardScale);
  eq(ev.find(e => e.card).card.name, "Advance to Start");
});

test("card payouts scale with the multiplier", () => {
  freshRun();
  state.coins = 0;
  forceCard("Small coins", () => TILE_TYPES.deck.onLand({ pos: 5, mult: 10, bs: 1 }));
  eq(state.coins, 300, "30 x10");
});

suite("tiles: reshoot (the jail corner)");

/* Math.floor(rand(1,7)) is floor(1 + r*6), so r = (v-1)/6 forces face v exactly.
   Two draws per throw, then two more for the fine's two uniform samples. */
const FACE = v => (v - 1) / 6;
const NO_DOUBLES = [FACE(1), FACE(2), FACE(3), FACE(4), FACE(5), FACE(6)];
const reshootEv = ev => ev.find(e => e.reshoot).reshoot;

test("a double pays the sum of the dice times the stake, and ends the attempt", () => {
  freshRun();
  state.energy = 0;
  const ev = withRandom([FACE(4), FACE(4), FACE(2), FACE(5)],
                        () => TILE_TYPES.reshoot.onLand({ pos: 30, mult: 3, bs: 1 }));
  const r = reshootEv(ev);
  eq(r.won, true);
  eq(r.throws.length, 1, "throwing stops at the first double");
  deepEq(r.throws, [{ d1: 4, d2: 4 }]);
  eq(r.energy, (4 + 4) * 3, "the SUM of the dice, times the stake");
  eq(state.energy, 24, "already granted by the time the event is returned");
  eq(r.fine, 0, "a double is never also fined");
});

test("the throws keep going until one is a double", () => {
  freshRun();
  state.energy = 0;
  const ev = withRandom([FACE(1), FACE(2),  FACE(3), FACE(5),  FACE(6), FACE(6),  FACE(1), FACE(1)],
                        () => TILE_TYPES.reshoot.onLand({ pos: 30, mult: 1, bs: 1 }));
  const r = reshootEv(ev);
  eq(r.throws.length, 3, "two failures, then the escape");
  eq(r.won, true);
  eq(r.energy, 12);
  eq(state.energy, 12);
});

test("the jail never moves the token", () => {
  freshRun();
  state.pos = 30;
  const ev = withRandom(NO_DOUBLES, () => TILE_TYPES.reshoot.onLand({ pos: 30, mult: 1, bs: 1 }));
  eq(state.pos, 30, "the sweep to Start is gone — a jail delays you where you stand");
  eq(ev.filter(e => e.move).length, 0, "and it emits no move event");
});

test("no double in three throws pays no energy and takes a fine of 0.1%-2%", () => {
  freshRun();
  state.coins = 1000000; state.energy = 0;
  const ev = withRandom([...NO_DOUBLES, 0.5, 0.5],
                        () => TILE_TYPES.reshoot.onLand({ pos: 30, mult: 1, bs: 1 }));
  const r = reshootEv(ev);
  eq(r.won, false);
  eq(r.throws.length, cfg.reshootThrows);
  eq(r.energy, 0);
  eq(state.energy, 0, "a failed escape pays nothing back");
  ok(r.finePct >= cfg.reshootFineMin && r.finePct <= cfg.reshootFineMax,
     `fine share ${r.finePct} outside [${cfg.reshootFineMin}, ${cfg.reshootFineMax}]`);
  ok(r.fine > 0, "a million coins must actually be fined something");
  eq(state.coins, 1000000 - r.fine, "already taken by the time the event is returned");
});

/* The fine is the price of the delay, not of the stake. Same balance and the same dice, ten
   times the multiplier, same number off the balance. */
test("the fine does not scale with the multiplier", () => {
  const fineAt = (mult) => {
    freshRun();
    state.coins = 500000;
    const ev = withRandom([...NO_DOUBLES, 0.25, 0.75],
                          () => TILE_TYPES.reshoot.onLand({ pos: 30, mult, bs: 1 }));
    return reshootEv(ev).fine;
  };
  const one = fineAt(1);
  ok(one > 0, "there has to be a fine for the comparison to mean anything");
  eq(fineAt(10), one, "x10 must cost exactly what x1 costs");
});

test("a fine can never take the player below zero", () => {
  /* 0.999 on both uniform draws is as close to reshootFineMax as this gets. */
  const worst = [...NO_DOUBLES, 0.999, 0.999];
  freshRun();
  state.coins = 0;
  const broke = withRandom(worst, () => TILE_TYPES.reshoot.onLand({ pos: 30, mult: 1, bs: 1 }));
  eq(reshootEv(broke).fine, 0, "nothing to take");
  eq(state.coins, 0);

  freshRun();
  state.coins = 10;
  const ev = withRandom(worst, () => TILE_TYPES.reshoot.onLand({ pos: 30, mult: 1, bs: 1 }));
  eq(state.coins, 10 - reshootEv(ev).fine);
  ok(state.coins >= 0, "a balance too small to fine must not go negative");

  /* And a balance already in the red (a deck fine can leave one) is not charged again. */
  freshRun();
  state.coins = -50;
  withRandom(worst, () => TILE_TYPES.reshoot.onLand({ pos: 30, mult: 1, bs: 1 }));
  eq(state.coins, -50, "an overdrawn balance is floored, not fined further");
});

/* The store-overflow invariant: energy packs are far larger than the cap and nothing may
   clamp a balance downward. See "Energy may exceed the cap" in CLAUDE.md. */
/* The escape pays a number the player is SHOWN — the float, the log and the reveal all print
   (d1+d2)*mult — so it is granted past the cap rather than topped up toward it. Capping it
   silently while announcing the full figure was the board lying about what it had just paid.
   The invariant that matters is unchanged and is what this asserts: energy is never REDUCED. */
test("the escape pays its full amount, over the cap, and never reduces a balance", () => {
  freshRun();
  state.energy = 500;                      // bought from the store, far above cfg.energyCap
  withRandom([FACE(1), FACE(1)], () => TILE_TYPES.reshoot.onLand({ pos: 30, mult: 1, bs: 1 }));
  eq(state.energy, 502, "double 1 at ×1 pays 2, on top of an over-cap balance");
  ok(state.energy >= 500, "and an over-cap balance is never clamped down");
});

test("the escape pays the full sum × the stake even when it dwarfs the cap", () => {
  freshRun();
  state.energy = 0;
  withRandom([FACE(6), FACE(6)], () => TILE_TYPES.reshoot.onLand({ pos: 30, mult: 10, bs: 1 }));
  eq(state.energy, 120, "(6+6) × 10, not cfg.energyCap — what is announced is what is paid");
});

/* The distribution the brief asked for: inside [0.1%, 2%], weighted toward 0.5%-1.5%.
   Triangular (the mean of two uniforms) puts 77.6% in that band by closed form; 0.7 is over
   ten standard deviations below that at this sample size, so this cannot flake. */
test("the fine is weighted toward the 0.5%-1.5% band", () => {
  freshRun();
  const N = 4000;
  let inBand = 0;
  for (let i = 0; i < N; i++) {
    const p = TILE_TYPES.reshoot.finePct();
    if (p < cfg.reshootFineMin || p > cfg.reshootFineMax) fail(`fine share ${p} out of bounds`);
    if (p >= 0.005 && p <= 0.015) inBand++;
  }
  ok(inBand / N > 0.7, `expected most fines in the band, got ${(100 * inBand / N).toFixed(1)}%`);
});

test("the reshoot event carries the whole already-decided result", () => {
  freshRun();
  state.coins = 200000;
  const ev = withRandom([...NO_DOUBLES, 0.4, 0.6],
                        () => TILE_TYPES.reshoot.onLand({ pos: 30, mult: 2, bs: 1 }));
  const r = reshootEv(ev);
  deepEq(Object.keys(r).sort(), ["energy", "fine", "finePct", "throws", "won"]);
  r.throws.forEach(t => { ok(t.d1 >= 1 && t.d1 <= 6); ok(t.d2 >= 1 && t.d2 <= 6); });
  /* It is a presentation event: everything on it has already been applied to state, so the UI
     can be interrupted without the player gaining or losing a coin. */
  eq(state.coins, 200000 - r.fine);
  ok(ev.some(e => e.log), "and the attempt is logged");
});

/* Nothing on this board may push coins below zero. There are four sinks now — the two bills,
   the Reshoot fee and the deck's Fine card — and the Fine card was the one without a floor:
   at x10 on an empty balance it took coins to -800, which every tile charging afterwards then
   had to have an opinion about. One rule, asserted here for all four. */
suite("tiles: no sink can overdraw the player");

test("the deck's Fine card is floored at the balance", () => {
  freshRun();
  state.coins = 0;
  forceCard("Fine / Paparazzi", () => TILE_TYPES.deck.onLand({ pos: 5, mult: 10, bs: 1 }));
  eq(state.coins, 0, "an empty balance pays nothing, however large the stake");

  state.coins = 50;
  forceCard("Fine / Paparazzi", () => TILE_TYPES.deck.onLand({ pos: 5, mult: 10, bs: 1 }));
  eq(state.coins, 0, "a balance under the fine is taken to exactly zero, never past it");
});

test("a Fine card still seeds the VIP pool even when it can collect nothing", () => {
  freshRun();
  state.coins = 0; state.vip = 0;
  forceCard("Fine / Paparazzi", () => TILE_TYPES.deck.onLand({ pos: 5, mult: 1, bs: 1 }));
  ok(state.vip > 0, "the pool is fed by the card, not by what the player could afford");
});

test("every sink leaves coins at or above zero, from any balance", () => {
  const sinks = [
    ["payroll", () => TILE_TYPES.payroll.onLand({ pos: 3, mult: 10, bs: 1 })],
    ["overheads", () => TILE_TYPES.overheads.onLand({ pos: 23, mult: 10, bs: 1 })],
    ["reshoot", () => withRandom([FACE(1), FACE(2), FACE(3), FACE(4), FACE(5), FACE(6)],
                                 () => TILE_TYPES.reshoot.onLand({ pos: 30, mult: 10, bs: 1 }))],
    ["deck fine", () => forceCard("Fine / Paparazzi",
                                  () => TILE_TYPES.deck.onLand({ pos: 5, mult: 10, bs: 1 }))],
  ];
  [0, 1, 12.4, 500, 100000].forEach(bal => {
    sinks.forEach(([name, run]) => {
      freshRun();
      state.coins = bal;
      run();
      ok(state.coins >= 0, `${name} from a balance of ${bal} left ${state.coins}`);
    });
  });
});
