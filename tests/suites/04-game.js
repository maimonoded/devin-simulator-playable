"use strict";
/* game.js — dice, lap bonus, session/time */

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
