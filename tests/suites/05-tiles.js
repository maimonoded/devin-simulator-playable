"use strict";
/* board-actor.js · pools.js · tiles/* — landing behaviour, asserted on the returned event lists.

   Every landing is a weighted draw now (GDD §3.2), so most of these tests pin one row of one
   pool with forcePool() and then assert on what that row turned into. Rolling for it and hoping
   would test the random number generator, not the tile. */

/* Collect every float/log/reveal/etc. an event list carries. */
function evField(events, field) { return events.filter(e => e[field]).map(e => e[field]); }
/* Land on a tile of a given type — the first one the board has. */
function landOn(type, ctx) {
  const i = tilesOfType(type)[0];
  return TILE_TYPES[type].onLand(Object.assign({ pos: i, mult: 1, bs: cfg.boardScale }, ctx));
}

suite("board-actor: reward helpers");

test("gainCoins adds coins and returns a float event", () => {
  freshRun();
  const t = TILE_TYPES.std;
  state.coins = 100;
  const ev = t.gainCoins(50);
  eq(state.coins, 150);
  ok(ev.float, "should return a float event");
  eq(ev.float.text, "+50");
});

test("gainEnergy tops up to the cap", () => {
  freshRun();
  state.energy = cfg.energyCap - 2;
  TILE_TYPES.std.gainEnergy(10);
  eq(state.energy, cfg.energyCap, "clamped to the cap");
});

test("gainEnergy never reduces a balance already above the cap", () => {
  freshRun();
  state.energy = 500;                      // bought from the store
  TILE_TYPES.std.gainEnergy(5);
  eq(state.energy, 500, "an over-cap balance must not be clamped down");
});

test("a tile has no clue helper of its own — Clues.grant() is the only way in", () => {
  ok(typeof TILE_TYPES.std.gainClues === "undefined",
     "a clue is per-episode evidence now; a bare counter must not come back");
});

test("presentation builders produce well-formed events", () => {
  const t = TILE_TYPES.std;
  deepEq(t.reveal("+5", "sub", { positive: true, energy: true, ms: 900 }),
         { reveal: { big: "+5", sub: "sub", positive: true, energy: true, ms: 900 } });
  deepEq(t.reveal("x", "y"), { reveal: { big: "x", sub: "y", positive: false, energy: false, ms: undefined } });
  deepEq(t.collect("+9", "Bonus"), { collect: { big: "+9", sub: "Bonus" } });
  deepEq(t.card("Windfall", "+300", { positive: true }),
         { card: { name: "Windfall", big: "+300", positive: true, energy: false } });
});

test("startLandingBonus pays pass + land and seeds the Gala pot", () => {
  freshRun();
  state.coins = 0; state.vip = 0;
  const paid = TILE_TYPES.premiere.startLandingBonus(2);
  eq(paid, (cfg.startPass + cfg.startLand) * cfg.boardScale * 2);
  eq(state.coins, paid);
  eq(state.vip, cfg.vipSeed * cfg.boardScale, "the pot is still state.vip — see js/tiles/tile.js");
});

test("advanceToStart moves the token to 0 and reveals the bonus", () => {
  freshRun();
  state.pos = 30;
  const ev = TILE_TYPES.std.advanceToStart(30, 1, 90, "swept");
  eq(state.pos, 0, "token must land on Start");
  const move = ev.find(e => e.move);
  eq(move.move.path.length, boardSize() - 30);
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
  for (let i = 0; i < boardSize(); i++) types.add(tileType(i));
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
  BOARD_CORNERS.forEach(t => eq(TILE_TYPES[t].corner, true, t));
  Object.keys(TILE_POOLS).forEach(t => eq(TILE_TYPES[t].corner, false, t));
});

test("the four pooled types are one class, told apart only by their pool and icon", () => {
  const pooled = Object.keys(TILE_POOLS).map(t => TILE_TYPES[t]);
  pooled.forEach(t => ok(t instanceof PoolTile, t.type + " should be a PoolTile"));
  eq(new Set(pooled.map(t => t.icon)).size, pooled.length, "each needs its own fallback icon");
  eq(new Set(pooled.map(t => t.constructor)).size, 1, "and they must all be the SAME class");
});

test("no tile prints a value — a tile that draws cannot advertise a number", () => {
  Object.values(TILE_TYPES).forEach(t => eq(t.valueLabel(3), "", t.type));
});

suite("tiles: the draw");

test("a landing draws from ITS pool, not from any other", () => {
  freshRun();
  /* Give the clue pool nothing but clues and the money pool nothing but money, then land on
     one of each: the tile must reach the table its type points at. */
  forcePool("clue", r => r.kind === "clue", () =>
    forcePool("money", r => r.kind === "money", () => {
      state.coins = 0;
      landOn("npc");
      /* A clue row pays `n` of them (assets/pools/pools.js), so this counts AT LEAST one rather
         than exactly one — the assertion is about which TABLE was read, not about the row's
         payout, and pinning the count here would break every time pacing is retuned. */
      const first = Clues.total();
      ok(first >= 1, "an NPC tile draws the clue pool");
      /* Coins may be non-zero and still prove the point: when a row pays two clues the second
         can repeat the first, and a duplicate clue pays dupClueCoins by design (GDD 12). What
         must NOT appear is money-pool money, so this checks the amount is only ever clue
         change. */
      ok(state.coins % Math.round(cfg.dupClueCoins * cfg.boardScale) === 0,
         `${state.coins} coins is not a whole number of duplicate clues — the money pool leaked in`);
      const afterNpc = state.coins;
      landOn("std");
      ok(state.coins > afterNpc, "a standard tile draws the money pool");
      eq(Clues.total(), first, "and a standard tile pays no clues");
    }));
});

test("money pays, scales with the multiplier, and never interrupts play", () => {
  freshRun();
  forcePool("money", r => r.kind === "money" && r.amount === 30, () => {
    state.coins = 0;
    const ev = landOn("std");
    eq(state.coins, 30 * cfg.boardScale);
    eq(evField(ev, "reveal").length, 0, "a money row must not block the roll loop");
    eq(evField(ev, "log").length, 1, "but it does say what happened");
    state.coins = 0;
    landOn("std", { mult: 5, bs: 1 });
    eq(state.coins, 150);
  });
});

test("a loss takes coins, feeds the Gala pot, and never digs below zero", () => {
  freshRun();
  forcePool("mixed", r => r.kind === "money" && r.amount < 0, () => {
    state.coins = 10000; state.vip = 0;
    landOn("twist");
    const taken = 10000 - state.coins;
    ok(taken > 0, "a negative row has to take something");
    eq(state.vip, taken, "and every coin of it lands in the pot");
    /* …and with nothing to take, nothing is taken and nothing is invented. */
    state.coins = 0; state.vip = 0;
    landOn("twist");
    eq(state.coins, 0, "a player with nothing must not go negative");
    eq(state.vip, 0, "and the pot cannot be fed money that never existed");
  });
});

test("a card row banks a card, and a plain duplicate pays instead of blocking", () => {
  freshRun();
  forcePool("money", r => r.kind === "card", () => {
    const ev = landOn("std");
    eq(Cards.owned(), 1, "the card is banked before any of this is shown");
    eq(evField(ev, "card").length, 1, "a card you did not have holds the screen");
    /* Another copy of something already held: coins, a float, and the roll keeps moving. */
    const coins = state.coins;
    let dupe = null;
    for (let k = 0; k < 400 && !dupe; k++) {
      const e2 = landOn("std");
      if (!evField(e2, "card").length) dupe = e2;
    }
    ok(dupe, "a duplicate has to turn up eventually");
    ok(state.coins > coins, "and it pays coins rather than nothing");
    eq(evField(dupe, "reveal").length, 0, "a duplicate must never block");
  });
});

test("energy tops up and an event row pays nothing at all", () => {
  freshRun();
  forcePool("bonus", r => r.kind === "energy", () => {
    state.energy = 0;
    landOn("arrival");
    ok(state.energy > 0);
  });
  forcePool("money", r => r.kind === "event", () => {
    state.coins = 0; state.energy = 5;
    const before = Cards.owned();
    const ev = landOn("std");
    eq(state.coins, 0); eq(Clues.total(), 0); eq(state.energy, 5);
    eq(Cards.owned(), before, "an event row is flavour, and flavour is free");
    eq(evField(ev, "log").length, 1, "it still earns its line in the log");
  });
});

test("a move row is the only kind that relocates the token", () => {
  freshRun();
  forcePool("mixed", r => r.kind === "move" && r.to === "start", () => {
    const from = tilesOfType("twist")[1];
    state.pos = from; state.coins = 0;
    const ev = TILE_TYPES.twist.onLand({ pos: from, mult: 1, bs: 1 });
    eq(state.pos, 0, "advance to Start means Start");
    eq(ev.find(e => e.move).move.stepMs, cfg.premiereStepMs);
    eq(state.coins, (cfg.startPass + cfg.startLand) * cfg.boardScale);
  });
});

suite("tiles: the bonus games");

test("a money row may open a mini-game, and the coins are banked before it does", () => {
  freshRun();
  forcePool("bonus", r => r.game === "train-small", () => {
    state.coins = 0;
    const ev = landOn("arrival");
    const mg = evField(ev, "minigame");
    eq(mg.length, 1, "the row names a game, so a game opens");
    eq(mg[0].amount, state.coins, "the game is handed exactly what was already paid");
    eq(mg[0].game, "train-small");
    /* the gain event has to come first — the money is not the game's to decide */
    ok(ev.findIndex(e => e.float) < ev.findIndex(e => e.minigame));
  });
});

test("a ladder row makes its amount a CEILING and pays the rung that won", () => {
  freshRun();
  forcePool("bonus", r => r.ladder, () => {
    const row = Pools.table("bonus").find(r => r.ladder);
    for (let k = 0; k < 60; k++) {
      state.coins = 0;
      const mg = evField(landOn("arrival"), "minigame")[0];
      eq(mg.tiers.length, 3, "three rungs to reveal");
      eq(mg.tiers[mg.winIndex], mg.amount, "the winning rung IS what was paid");
      eq(mg.amount, state.coins);
      ok(mg.amount <= row.amount * cfg.boardScale, `${mg.amount} must not exceed the ceiling`);
    }
  });
});

test("the ladder is exact thirds, ascending, topped by the row's number", () => {
  const { tiers, winIndex } = Economy.trainLadder(300);
  deepEq(tiers, [100, 200, 300]);
  ok(winIndex >= 0 && winIndex <= 2, "winIndex must address a rung");
});

suite("tiles: the four corners");

test("Spa Day grants energy, flags the dice shower, and never takes anything", () => {
  freshRun();
  state.energy = 0; state.coins = 500;
  const ev = TILE_TYPES.spa.onLand({});
  eq(state.energy, cfg.spaEnergy);
  eq(state.coins, 500, "the rest beat is never a penalty");
  const r = ev.find(e => e.reveal).reveal;
  eq(r.positive, true);
  eq(r.energy, true, "energy wins get the dice shower");
});

test("The Premiere pays pass + land, seeds the pot, and hands over a free pack", () => {
  freshRun();
  state.coins = 0; state.vip = 0;
  const ev = TILE_TYPES.premiere.onLand({ mult: 1 });
  const packs = evField(ev, "pack");
  eq(packs.length, 1, "landing on the Premiere is a pack on the house");
  eq(state.vip, cfg.vipSeed * cfg.boardScale);
  eq(state.coins, (cfg.startPass + cfg.startLand) * cfg.boardScale + Boxes.coinsIn(packs[0]),
     "the coins are the landing bonus plus whatever the pack paid, and nothing else");
  eq(ev.find(e => e.reveal).reveal.ms, cfg.startRevealMs);
});

test("The Gala collects the whole pot, leaves it empty, and still pays a card", () => {
  freshRun();
  state.vip = 400; state.coins = 0;
  const ev = TILE_TYPES.gala.onLand({ pos: 20, mult: 1, bs: 1 });
  ok(state.coins >= 400, "the pot is collected");
  eq(state.vip, 0, "and left empty");
  eq(ev.find(e => e.reveal).reveal.positive, true);
  eq(ev.find(e => e.reveal).reveal.ms, cfg.vipRevealMs, "the Gala uses its own dwell");
  eq(Cards.owned(), 1, "guaranteed a card even so");
});

test("an empty pot still pays a card, so the Gala is never a wasted landing", () => {
  freshRun();
  state.vip = 0; state.coins = 0;
  const ev = TILE_TYPES.gala.onLand({ pos: 20, mult: 1, bs: 1 });
  ok(!ev.some(e => e.reveal && e.reveal.positive), "an empty pot reads as the letdown it is");
  eq(Cards.owned(), 1, "…and the card is the consolation");
});

test("The Scoop teleports to an NPC tile and triggers it", () => {
  freshRun();
  const npcs = tilesOfType("npc");
  forcePool("clue", r => r.kind === "clue", () => {
    for (let k = 0; k < 40; k++) {
      state.pos = 30; state.clues = {}; state.coins = 0;
      const ev = TILE_TYPES.scoop.onLand({ pos: 30, mult: 1, bs: 1 });
      ok(npcs.includes(state.pos), `landed on ${state.pos}, which is not an NPC tile`);
      ok(Clues.total() >= 1, "and the tile it lands on actually fires");
      const move = ev.find(e => e.move).move;
      /* THE ONE-STEP PATH IS THE PROOF that no lap bonus is paid: a path of length one cannot
         cross Start, and the bonus is paid by walking past it. Coins used to stand in for that
         and no longer can — a clue row pays two now, the second may repeat the first, and a
         duplicate clue legitimately pays coins. */
      eq(move.path.length, 1, "a teleport is one step — walking it would pay a lap bonus");
      eq(move.path[0], state.pos);
      ok(state.coins % Math.round(cfg.dupClueCoins * cfg.boardScale) === 0,
         `${state.coins} coins is not duplicate-clue change, so something paid a lap bonus`);
    }
  });
});

test("every NPC tile is reachable from the Scoop", () => {
  freshRun();
  const seen = new Set();
  for (let k = 0; k < 600; k++) { state.pos = 30; TILE_TYPES.scoop.onLand({ pos: 30, mult: 1, bs: 1 }); seen.add(state.pos); }
  eq(seen.size, tilesOfType("npc").length, "a tile the Scoop can never reach is a dead tile");
});
