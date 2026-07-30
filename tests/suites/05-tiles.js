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

test("gainClues adds clues", () => {
  freshRun();
  state.clues = 2;
  TILE_TYPES.standard.gainClues(3);
  eq(state.clues, 5);
});

test("presentation builders produce well-formed events", () => {
  const t = TILE_TYPES.standard;
  deepEq(t.reveal("+5", "sub", { positive: true, energy: true, ms: 900 }),
         { reveal: { big: "+5", sub: "sub", positive: true, energy: true, ms: 900 } });
  deepEq(t.reveal("x", "y"), { reveal: { big: "x", sub: "y", positive: false, energy: false, ms: undefined } });
  deepEq(t.collect("+9", "Train bonus"), { collect: { big: "+9", sub: "Train bonus" } });
  deepEq(t.card("Windfall", "+300", { positive: true }),
         { card: { name: "Windfall", big: "+300", positive: true, energy: false } });
});

test("startLandingBonus pays pass + land and seeds VIP", () => {
  freshRun();
  state.coins = 0; state.vip = 0;
  const paid = TILE_TYPES.start.startLandingBonus(2);
  eq(paid, (cfg.startPass + cfg.startLand) * cfg.boardScale * 2);
  eq(state.coins, paid);
  eq(state.vip, cfg.vipSeed * cfg.boardScale);
});

test("advanceToStart moves the token to 0 and reveals the bonus", () => {
  freshRun();
  state.pos = 30;
  const ev = TILE_TYPES.premiere.advanceToStart(30, 1, 90, "swept");
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
  ["start", "spa", "vip", "premiere"].forEach(t => eq(TILE_TYPES[t].corner, true, t));
  ["standard", "train", "deck"].forEach(t => eq(TILE_TYPES[t].corner, false, t));
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

test("train pays around trainEV on average and offers a Collect popup", () => {
  freshRun();
  state.coins = 0;
  const N = 4000;
  for (let k = 0; k < N; k++) TILE_TYPES.train.onLand({ mult: 1, bs: 1 });
  near(state.coins / N, cfg.trainEV, cfg.trainEV * 0.08, "train EV should track cfg.trainEV");
  state.coins = 0;
  const ev = TILE_TYPES.train.onLand({ mult: 1, bs: 1 });
  eq(evField(ev, "collect").length, 1, "train must use the Collect popup");
  eq(evField(ev, "log").length, 1);
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

test("premiere sweeps to Start at the configured speed", () => {
  freshRun();
  state.pos = 30; state.coins = 0;
  const ev = TILE_TYPES.premiere.onLand({ pos: 30, mult: 1 });
  eq(state.pos, 0);
  eq(ev.find(e => e.move).move.stepMs, cfg.premiereStepMs);
  eq(state.coins, (cfg.startPass + cfg.startLand) * cfg.boardScale);
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
  const ev = forceCard("Windfall", () => TILE_TYPES.deck.onLand({ pos: 3, mult: 1, bs: 1 }));
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
  const ev = forceCard("Fine / Paparazzi", () => TILE_TYPES.deck.onLand({ pos: 3, mult: 1, bs: 1 }));
  eq(state.coins, 1000 + fine.coins, "the loss comes off the balance");
  eq(state.vip, fine.vip, "and is recycled into the VIP pool");
  eq(ev.find(e => e.card).card.positive, false);
});

test("an energy card flags the dice shower", () => {
  freshRun();
  state.energy = 0;
  const ev = forceCard("Small energy", () => TILE_TYPES.deck.onLand({ pos: 3, mult: 1, bs: 1 }));
  eq(state.energy, 2);
  eq(ev.find(e => e.card).card.energy, true);
});

/* The deck pays no clues: the economy model moved every clue to the Mystery Box so that one
   table sets the rate a prediction runs on. A card that grants clues would double-count. */
test("no deck card grants clues — the Mystery Box is the only source", () => {
  freshRun();
  eq(deck.filter(c => c.clues > 0).length, 0);
  state.clues = 0; state.cycleClues = 0;
  deck.forEach(c => forceCard(c.name, () => TILE_TYPES.deck.onLand({ pos: 3, mult: 1, bs: 1 })));
  eq(state.clues, 0, "the album total stays put");
  eq(state.cycleClues, 0, "and so does the flow");
});

test("the advance card walks to Start and pays the landing bonus", () => {
  freshRun();
  state.pos = 3; state.coins = 0;
  const ev = forceCard("Advance to Start", () => TILE_TYPES.deck.onLand({ pos: 3, mult: 1, bs: 1 }));
  eq(state.pos, 0);
  eq(ev.find(e => e.move).move.path.length, 37);
  eq(state.coins, (cfg.startPass + cfg.startLand) * cfg.boardScale);
  eq(ev.find(e => e.card).card.name, "Advance to Start");
});

test("card payouts scale with the multiplier", () => {
  freshRun();
  state.coins = 0;
  forceCard("Small coins", () => TILE_TYPES.deck.onLand({ pos: 3, mult: 10, bs: 1 }));
  eq(state.coins, 300, "30 x10");
});
