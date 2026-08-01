"use strict";
/* game.js — dice, lap bonus, prediction resolution, session/time */

suite("game: dice & rolling");

test("rollDice returns two faces in 1..6 and their sum", () => {
  for (let i = 0; i < 200; i++) {
    const { d1, d2, steps } = rollDice();
    ok(Number.isInteger(d1) && d1 >= 1 && d1 <= 6, "d1 out of range: " + d1);
    ok(Number.isInteger(d2) && d2 >= 1 && d2 <= 6, "d2 out of range: " + d2);
    eq(steps, d1 + d2);
  }
});

test("rollDice can produce both extremes", () => {
  withRandom([0], () => deepEq(rollDice(), { d1: 1, d2: 1, steps: 2 }));
  withRandom([0.999], () => deepEq(rollDice(), { d1: 6, d2: 6, steps: 12 }));
});

test("spendRoll charges energy equal to the multiplier and counts the roll", () => {
  freshRun();
  state.energy = 30;
  spendRoll(5);
  eq(state.energy, 25);
  eq(state.rolls, 1);
  spendRoll(1);
  eq(state.energy, 24);
  eq(state.rolls, 2);
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

test("advanceSession refills energy to the cap", () => {
  freshRun();
  state.energy = 0;
  advanceSession();
  eq(state.energy, cfg.energyCap);
});

test("advanceSession never drains energy bought above the cap", () => {
  freshRun();
  state.energy = 1000;                       // a store purchase
  advanceSession();
  eq(state.energy, 1000, "over-cap balance must survive");
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
  state.energy = cfg.energyCap;              // so the gap is the session slot, not a refill
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
  state.energy = cfg.energyCap;
  const r = advanceSession();
  eq(state.day, 5);
  eq(r.rewards.length, 4, "one per day crossed");
  deepEq(r.rewards.map(x => x.day), [2, 3, 4, 5]);
  resetCfg();
});

test("the gap is the greater of a full refill and one session slot", () => {
  freshRun();
  cfg.sessionsPerDay = 2;                    // 720-minute slot
  cfg.regenMin = 3;                          // 30 energy => 90 minutes to refill
  state.energy = 0;
  const before = state.clock;
  advanceSession();
  eq(state.clock - before, 720, "session slot dominates a short refill");
  resetCfg();
});
