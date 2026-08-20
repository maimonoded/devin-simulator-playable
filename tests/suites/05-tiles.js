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

test("gainCards tops the shoe up to the cap", () => {
  freshRun();
  state.shoe = state.shoe.slice(0, cfg.packSize - 2);
  TILE_TYPES.standard.gainCards(10);
  eq(Shoe.count(), cfg.packSize, "clamped to the cap");
});

/* The overflow rule, transplanted from energy onto cards — and it matters MORE now: energy only
   overflowed via the store, but a bought pack merges onto the leftovers, so this is the
   ordinary path rather than an edge case. */
test("gainCards never reduces a shoe already above the cap", () => {
  freshRun();
  state.shoe = Shoe.mintPack().concat(Shoe.mintPack());   // two packs merged, as a purchase does
  const before = Shoe.count();
  TILE_TYPES.standard.gainCards(5);
  eq(Shoe.count(), before, "an over-cap shoe must not be trimmed");
});

test("gainTickets fills placeholders through Tickets.award", () => {
  freshRun();
  TILE_TYPES.standard.gainTickets(2);
  eq(Tickets.held(0), 2, "the lowest unfilled placeholder takes them");
});

test("gainClues adds clues", () => {
  freshRun();
  state.clues = 2;
  TILE_TYPES.standard.gainClues(3);
  eq(state.clues, 5);
});

test("presentation builders produce well-formed events", () => {
  const t = TILE_TYPES.standard;
  /* `shower` is a STRING now, not a boolean: there are two kinds of thing to rain and the
     shower should be made of what was actually won. */
  deepEq(t.reveal("+5", "sub", { positive: true, shower: "cards", ms: 900 }),
         { reveal: { big: "+5", sub: "sub", positive: true, shower: "cards", ms: 900 } });
  deepEq(t.reveal("x", "y"), { reveal: { big: "x", sub: "y", positive: false, shower: null, ms: undefined } });
  deepEq(t.collect("+9", "Train bonus"), { collect: { big: "+9", sub: "Train bonus" } });
  deepEq(t.card("Windfall", "+300", { positive: true }),
         { card: { name: "Windfall", big: "+300", positive: true, shower: null } });
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

test("spa deals cards and flags the card shower", () => {
  freshRun();
  state.shoe = [];
  const ev = TILE_TYPES.spa.onLand({ card: "s7" });
  eq(Shoe.count(), 7);
  const r = ev.find(e => e.reveal).reveal;
  eq(r.positive, true);
  eq(r.shower, "cards", "a card grant rains cards");
});

/* The grant IS the card that landed on it — the whole point of threading `card` through the
   landing context. A joker has no rank, so it takes its own number. */
test("spa grants the rank of the card that landed on it", () => {
  freshRun();
  [["s1", 1], ["h7", 7], ["d13", 13], ["m4", 4]].forEach(([card, want]) => {
    state.shoe = [];
    TILE_TYPES.spa.onLand({ card });
    eq(Shoe.count(), want, card + " grants " + want);
  });
});

test("spa grants spaJokerCards on a joker, and spaCards when there is no card", () => {
  freshRun();
  state.shoe = [];
  TILE_TYPES.spa.onLand({ card: "J1" });
  eq(Shoe.count(), cfg.spaJokerCards, "a joker has no rank, so it takes its own grant");
  state.shoe = [];
  TILE_TYPES.spa.onLand({});
  eq(Shoe.count(), cfg.spaCards, "no card at all falls back to the flat grant");
});

/* The reason this corner deals through Shoe.dealExtra: dealFree tops up only TOWARD the cap,
   so on a full shoe — the ordinary state right after buying a pack — the old Spa dealt nothing
   while still announcing a card. Always paying is the rule; the cap is not this corner's. */
test("spa pays a shoe that is already over the cap, and says what it really dealt", () => {
  freshRun();
  state.shoe = new Array(cfg.packSize + 5).fill("s2");
  const before = Shoe.count();
  const ev = TILE_TYPES.spa.onLand({ card: "h9" });
  eq(Shoe.count(), before + 9, "a full shoe still gets the whole grant");
  const f = ev.find(e => e.float).float;
  eq(f.text, "💆 +9🃏");
  eq(ev.find(e => e.log).log.msg.includes("<b>9</b>"), true, "the log reports what was dealt");
});

/* Spa cards come off the pack tail like every other free card. If it minted loose cards the
   two-tickets-per-pack invariant would leak away one Spa landing at a time. */
test("spa cards are dealt off the pack, not minted loose", () => {
  freshRun();
  state.shoe = []; state.packTail = [];
  const priced = state.ticketsPriced;
  TILE_TYPES.spa.onLand({ card: "s3" });
  eq(state.ticketsPriced, priced + cfg.ticketsPerPack, "one pack minted, not one loose card");
  eq(state.packTail.length, cfg.packSize - 3, "the rest of that pack is kept for next time");
});

/* The chest is opened by the PAY-OUT and nothing else. It used to watch state.vip and open on
   every change, which fired ~10x a pack with the camera on the other side of the board. */
test("vip opens the chest when it pays, and not when the pool is dry", () => {
  freshRun();
  state.vip = 400;
  const paid = TILE_TYPES.vip.onLand({});
  const chest = paid.find(e => e.chest);
  eq(!!chest, true, "a pay-out opens the chest");
  eq(chest.chest.ms, cfg.chestOpenMs);
  eq(!!chest.reveal, true, "it rides on the reveal, so the two play together");
  state.vip = 0;
  eq(TILE_TYPES.vip.onLand({}).some(e => e.chest), false,
     "an empty pool must not open a chest heaped with coins it did not pay");
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
  const saved = twistDeck.map(c => c.weight);
  twistDeck.forEach(c => { c.weight = c.name === name ? 100 : 0; });
  try { return fn(); } finally { twistDeck.forEach((c, i) => { c.weight = saved[i]; }); }
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
  const fine = twistDeck.find(c => c.name === "Fine / Paparazzi");
  const ev = forceCard("Fine / Paparazzi", () => TILE_TYPES.deck.onLand({ pos: 3, mult: 1, bs: 1 }));
  eq(state.coins, 1000 + fine.coins, "the loss comes off the balance");
  eq(state.vip, fine.vip, "and is recycled into the VIP pool");
  eq(ev.find(e => e.card).card.positive, false);
});

test("a ticket card fills a placeholder and flags the ticket shower", () => {
  freshRun();
  const ev = forceCard("Backstage pass", () => TILE_TYPES.deck.onLand({ pos: 3, mult: 1, bs: 1 }));
  eq(Tickets.held(0), 1);
  eq(ev.find(e => e.card).card.shower, "tickets");
});

/* The deck pays no clues: the economy model moved every clue to the Mystery Box so that one
   table sets the rate a prediction runs on. A card that grants clues would double-count. */
test("no deck card grants clues — the Mystery Box is the only source", () => {
  freshRun();
  eq(twistDeck.filter(c => c.clues > 0).length, 0);
  state.clues = 0; state.cycleClues = 0;
  twistDeck.forEach(c => forceCard(c.name, () => TILE_TYPES.deck.onLand({ pos: 3, mult: 1, bs: 1 })));
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
