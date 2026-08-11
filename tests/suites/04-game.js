"use strict";
/* game.js — the pull, lap bonus, prediction resolution, session/time */

suite("game: pulling");

test("every card moves 1..13 tiles, or is a joker and moves nothing", () => {
  freshRun();
  Shoe.mintPack().forEach(c => {
    ok(Shoe.isLegal(c), "illegal card: " + c);
    const r = Shoe.rank(c);
    if (Shoe.isTicket(c)) eq(r, 0, "a joker moves nothing");
    else ok(r >= 1 && r <= 13, `${c} moves ${r}`);
  });
});

test("a pull takes exactly one card off the front and counts it", () => {
  freshRun();
  state.shoe = ["s7", "J1", "d3"];
  eq(Shoe.pull(), "s7");
  eq(state.pulls, 1);
  deepEq(state.shoe, ["J1", "d3"], "off the FRONT, in order");
  eq(Shoe.pull(), "J1");
  eq(state.pulls, 2);
});

/* The dice never ran out, so nothing downstream was written to expect an empty draw. Returning
   null rather than undefined is what lets pull() bail cleanly instead of moving the token by
   NaN tiles. */
test("pulling an empty shoe returns null rather than undefined", () => {
  freshRun();
  state.shoe = [];
  eq(Shoe.pull(), null);
  eq(state.pulls, 0, "a pull that produced nothing is not counted");
});

test("applyPassStart pays the lap bonus and seeds the VIP pool", () => {
  freshRun();
  state.coins = 0; state.vip = 0;
  const paid = applyPassStart(1);
  eq(paid, cfg.startPass * cfg.boardScale);
  eq(state.coins, paid);
  eq(state.vip, cfg.vipSeed * cfg.boardScale);
});

test("the lap bonus scales with the multiplier but the VIP seed does not", () => {
  freshRun();
  state.coins = 0; state.vip = 0;
  const paid = applyPassStart(5);
  eq(paid, cfg.startPass * cfg.boardScale * 5);
  eq(state.vip, cfg.vipSeed * cfg.boardScale, "vip seed is per lap, not per multiplier");
});

suite("game: prediction resolution");

function setupPrediction(coins = 10000) {
  freshRun();
  state.coins = coins;
  state.epQueue = ["001", "002"];
  return state;
}

test("a correct pick wins and pays wager x odds", () => {
  setupPrediction();
  const before = state.coins;
  const r = resolvePrediction({ wager: 1000, odds: 2.2, sel: 0, correct: 0, auto: false });
  eq(r.won, true);
  near(r.payout, 2200, 1e-9);
  near(state.coins, before - 1000 + 2200, 1e-9, "stake out, payout in");
  eq(state.predWins, 1);
  eq(state.streak, 1);
});

test("a wrong pick loses the stake and resets the streak", () => {
  setupPrediction();
  state.streak = 4;
  const before = state.coins;
  const r = resolvePrediction({ wager: 1000, odds: 2.2, sel: 1, correct: 0, auto: false });
  eq(r.won, false);
  eq(r.payout, 0);
  near(state.coins, before - 1000, 1e-9);
  eq(state.predLoss, 1);
  eq(state.streak, 0);
});

test("bestStreak keeps the high-water mark", () => {
  setupPrediction();
  for (let i = 0; i < 3; i++) {
    state.epQueue.push("001");
    resolvePrediction({ wager: 10, odds: 2, sel: 0, correct: 0, auto: false });
  }
  eq(state.streak, 3);
  state.epQueue.push("001");
  resolvePrediction({ wager: 10, odds: 2, sel: 1, correct: 0, auto: false });
  eq(state.streak, 0);
  eq(state.bestStreak, 3);
});

test("watching consumes exactly one queued episode and counts it", () => {
  setupPrediction();
  eq(state.epQueue.length, 2);
  resolvePrediction({ wager: 0, odds: 2, sel: 0, correct: 0, auto: false });
  deepEq(state.epQueue, ["002"], "the front episode is consumed");
  eq(state.epsWatched, 1);
  eq(state.predsMade, 1);
});

test("a zero wager changes no coins but still resolves and counts", () => {
  setupPrediction();
  const before = state.coins;
  const r = resolvePrediction({ wager: 0, odds: 2, sel: 1, correct: 0, auto: false });
  eq(state.coins, before, "no stake, no payout");
  eq(r.won, false);
  eq(state.predWins, 0);
  eq(state.predLoss, 0, "unwagered results must not pollute accuracy");
  eq(state.epsWatched, 1);
});

test("an id consumes THAT episode, not whichever is at the front", () => {
  setupPrediction(1e9);
  state.epQueue = ["001", "002", "003"];
  resolvePrediction({ wager: 10, odds: 2, sel: 0, correct: 0, auto: false, id: "002" });
  deepEq(state.epQueue, ["001", "003"],
         "the library can play any unwatched episode, so the played one is the one removed");
});

test("with no id it still consumes the front of the queue", () => {
  setupPrediction(1e9);
  state.epQueue = ["001", "002", "003"];
  resolvePrediction({ wager: 10, odds: 2, sel: 0, correct: 0, auto: false });
  deepEq(state.epQueue, ["002", "003"]);
});

test("an id that is not queued leaves the queue alone", () => {
  setupPrediction(1e9);
  state.epQueue = ["001"];
  resolvePrediction({ wager: 0, odds: 2, sel: 0, correct: 0, auto: false, id: "007" });
  deepEq(state.epQueue, ["001"], "a replay must not silently eat a queued episode");
});

test("auto mode ignores the pick and uses the clue-driven accuracy", () => {
  setupPrediction(1e9);
  cfg.accuracy = 1; cfg.accuracyMax = 1;   // the cap binds first, so it has to move too
  for (let i = 0; i < 5; i++) {
    state.epQueue.push("001");
    eq(resolvePrediction({ wager: 10, odds: 2, sel: 1, correct: 0, auto: true }).won, true,
       "accuracy 1 must always win even with a wrong pick");
  }
  cfg.accuracy = 0;
  for (let i = 0; i < 5; i++) {
    state.epQueue.push("001");
    eq(resolvePrediction({ wager: 10, odds: 2, sel: 0, correct: 0, auto: true }).won, false,
       "accuracy 0 must always lose even with the right pick");
  }
  resetCfg();
});

test("manual mode ignores cfg.accuracy entirely", () => {
  setupPrediction(1e9);
  cfg.accuracy = 0;
  state.epQueue.push("001");
  eq(resolvePrediction({ wager: 10, odds: 2, sel: 0, correct: 0, auto: false }).won, true,
     "a correct pick wins regardless of accuracy");
  resetCfg();
});

suite("game: session & time");

test("advanceSession deals the shoe back up to the cap", () => {
  freshRun();
  state.shoe = [];
  advanceSession();
  eq(Shoe.count(), cfg.packSize);
});

/* The overflow rule again, at the third of its four enforcement sites. */
test("advanceSession never trims a shoe merged above the cap", () => {
  freshRun();
  state.shoe = Shoe.mintPack().concat(Shoe.mintPack());   // a bought pack on top of leftovers
  const big = Shoe.count();
  advanceSession();
  eq(Shoe.count(), big, "an over-cap shoe must survive");
});

test("advancing within a day increments the session counter", () => {
  freshRun();
  cfg.sessionsPerDay = 4;                    // 360-minute slots, day starts at 9:00
  const r = advanceSession();
  eq(r.isNewDay, false);
  eq(state.day, 1);
  eq(state.sessionsToday, 2);
  deepEq(r.rewards, []);
  resetCfg();
});

test("crossing midnight rolls the day and pays a login reward", () => {
  freshRun();
  state.clock = 23 * 60;                     // late in day 1
  state.shoe = Shoe.mintPack();              // full, so the gap is the session slot
  const r = advanceSession();
  eq(r.isNewDay, true);
  eq(state.day, 2);
  eq(state.sessionsToday, 1, "counter resets on a new day");
  eq(r.rewards.length, 1);
  eq(r.rewards[0].day, 2);
  ok(r.rewards[0].amount > 0);
});

test("login rewards are actually credited", () => {
  freshRun();
  state.clock = 23 * 60;
  state.coins = 0;
  const r = advanceSession();
  const total = r.rewards.reduce((a, x) => a + x.amount, 0);
  eq(state.coins, total);
});

test("skipping several days pays one reward per day", () => {
  freshRun();
  cfg.sessionsPerDay = 0.25;                 // 5760-minute gap = 4 days
  state.shoe = Shoe.mintPack();
  const r = advanceSession();
  eq(state.day, 5);
  eq(r.rewards.length, 4, "one per day crossed");
  deepEq(r.rewards.map(x => x.day), [2, 3, 4, 5]);
  resetCfg();
});

test("the gap is the greater of a full deal and one session slot", () => {
  freshRun();
  cfg.sessionsPerDay = 2;                    // 720-minute slot
  cfg.cardRegenMin = 3;                      // 50 cards => 150 minutes to refill
  state.shoe = [];
  const before = state.clock;
  advanceSession();
  eq(state.clock - before, 720, "session slot dominates a short refill");
  resetCfg();
});
