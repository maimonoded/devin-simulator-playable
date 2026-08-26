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

test("train pays around its REAL ev on average, not the model's", () => {
  freshRun();
  state.coins = 0;
  const N = 8000;
  for (let k = 0; k < N; k++) TILE_TYPES.train.onLand({ mult: 1, bs: 1 });
  const real = Economy.trainRealEV();
  near(state.coins / N, real, real * 0.08, "train payout should track Economy.trainRealEV()");
  // and that number is deliberately BELOW what the sheet says, because the large bonus is
  // presented as a ladder and an even pick of 1/3, 2/3 and the top pays 2/3 of the top
  ok(real < cfg.trainEV, `real ${real.toFixed(2)} must sit under model ${cfg.trainEV}`);
  near(real, cfg.trainSmall * (1 - cfg.trainLargeChance)
           + cfg.trainLarge * (2 / 3) * cfg.trainLargeChance, 1e-9);
});

test("train pays only the four values its two bonuses can produce", () => {
  freshRun();
  const seen = new Set();
  for (let k = 0; k < 900; k++) {
    state.coins = 0;
    TILE_TYPES.train.onLand({ mult: 1, bs: 1 });
    seen.add(state.coins);
  }
  const rungs = Economy.trainLadder(cfg.trainLarge).tiers;
  const allowed = new Set([cfg.trainSmall, ...rungs]);
  eq(seen.size, allowed.size, [...seen].sort((a, b) => a - b).join(" / "));
  [...seen].forEach(v => ok(allowed.has(v), `unexpected payout ${v}`));
});

test("the large bonus ladder is exact thirds, ascending, topped by the model's number", () => {
  const { tiers, winIndex } = Economy.trainLadder(300);
  deepEq(tiers, [100, 200, 300]);
  ok(tiers[0] < tiers[1] && tiers[1] < tiers[2], "rungs must ascend");
  ok(winIndex >= 0 && winIndex <= 2, "winIndex must address a rung");
  // the top rung is the model's number untouched, whatever the multiplier scaled it to
  eq(Economy.trainLadder(cfg.trainLarge).tiers[2], cfg.trainLarge);
});

test("every rung wins sometimes, and only the three rungs ever do", () => {
  const hits = [0, 0, 0];
  for (let k = 0; k < 600; k++) hits[Economy.trainLadder(300).winIndex]++;
  hits.forEach((h, i) => ok(h > 100, `rung ${i} came up ${h}/600 — should be about even`));
});

test("train opens a bonus mini-game carrying the amount it already paid", () => {
  freshRun();
  state.coins = 0;
  const ev = TILE_TYPES.train.onLand({ mult: 1, bs: 1 });
  const mg = evField(ev, "minigame");
  eq(mg.length, 1, "train must open a mini-game");
  eq(evField(ev, "log").length, 1);
  // the coins are banked BEFORE the game opens; the game is only handed the number
  eq(mg[0].amount, state.coins, "the mini-game must be told exactly what was paid");
  ok(["train-small", "train-large"].includes(mg[0].game), mg[0].game);
  if (mg[0].game === "train-large") {
    eq(mg[0].tiers.length, 3, "the large game gets the whole ladder to render");
    eq(mg[0].tiers[mg[0].winIndex], mg[0].amount,
       "the winning rung must be the amount that was actually paid");
  } else {
    eq(mg[0].amount, cfg.trainSmall);
  }
});

test("the mini-game scales with the multiplier and never invents a payout", () => {
  freshRun();
  for (let k = 0; k < 200; k++) {
    state.coins = 0;
    const mg = evField(TILE_TYPES.train.onLand({ mult: 5, bs: 2 }), "minigame")[0];
    eq(mg.amount, state.coins, "the game is handed exactly what was banked");
    const top = (mg.game === "train-large" ? cfg.trainLarge : cfg.trainSmall) * 10;
    ok(mg.amount <= top, `${mg.amount} must not exceed the scaled top rung ${top}`);
  }
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

suite("tiles: the deck tile hands over a box");

/* The plot-twist deck is gone. Every one of its outcomes still exists — coins, energy, a
   fine's opposite number — as rows in a box's table, so what this tile owes is a BOX, and
   which tier it is. What comes out of one is tested in 03-collection.js, where the box lives. */

test("landing hands over exactly one box, of a tier the config defines", () => {
  freshRun();
  const ev = TILE_TYPES.deck.onLand({ pos: 3, mult: 1, bs: 1 });
  const packs = ev.filter(e => e.pack);
  eq(packs.length, 1);
  ok(Boxes.tier(packs[0].pack.tier.key), "the tier has to be one of the three");
  eq(packs[0].pack.drops.length, packs[0].pack.tier.items, "and it is already opened");
});

test("the log names the box before the popup and its contents after", () => {
  freshRun();
  const ev = TILE_TYPES.deck.onLand({ pos: 3, mult: 1, bs: 1 });
  const packAt = ev.findIndex(e => e.pack);
  ok(ev[packAt - 1] && ev[packAt - 1].log, "opened…");
  ok(ev[packAt + 1] && ev[packAt + 1].log, "…and what it paid");
});

test("the tier is drawn from deckBoxes, so the table alone decides how often a Diamond lands", () => {
  freshRun();
  const saved = deckBoxes.map(d => d.weight);
  try {
    deckBoxes.forEach(d => { d.weight = d.key === "diamond" ? 100 : 0; });
    for (let k = 0; k < 8; k++) eq(Boxes.drawTier(), "diamond");
    deckBoxes.forEach(d => { d.weight = d.key === "silver" ? 100 : 0; });
    for (let k = 0; k < 8; k++) eq(Boxes.drawTier(), "silver");
  } finally { deckBoxes.forEach((d, i) => { d.weight = saved[i]; }); }
});

test("the tile pays nothing of its own — the box is the whole payout", () => {
  freshRun();
  state.coins = 0; state.vip = 0;
  const before = state.coins;
  const ev = TILE_TYPES.deck.onLand({ pos: 3, mult: 1, bs: 1 });
  const paid = Boxes.coinsIn(ev.find(e => e.pack).pack);
  eq(state.coins, before + paid, "every coin came out of the box");
  eq(state.vip, 0, "and the tile seeds no VIP pool of its own");
});
