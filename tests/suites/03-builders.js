"use strict";
/* builders/builders.js — cost curve, queries, and the upgrade transaction */

suite("builders: shape & queries");

test("a fresh run has the configured number of builders at tier 0", () => {
  freshRun();
  eq(Builders.count(), cfg.buildings);
  eq(Builders.all().length, cfg.buildings);
  eq(Builders.doneCount(), 0);
  ok(!Builders.allMaxed());
  ok(Builders.all().every(b => b.tier === 0));
});

test("tier / isMaxed / progress track a builder's level", () => {
  freshRun();
  eq(Builders.tier(0), 0);
  eq(Builders.progress(0), 0);
  state.builder[0].tier = cfg.tiers;
  ok(Builders.isMaxed(0));
  eq(Builders.progress(0), 1);
  eq(Builders.doneCount(), 1);
  eq(Builders.tier(999), 0, "unknown builder index reads as 0");
});

test("reshape keeps progress that still fits and drops the rest", () => {
  freshRun();
  state.builder[0].tier = 3;
  state.builder[5].tier = 5;
  cfg.buildings = 3;
  Builders.reshape();
  eq(Builders.all().length, 3, "array resized");
  eq(Builders.tier(0), 3, "surviving builder keeps its tier");
  cfg.tiers = 2;
  Builders.reshape();
  eq(Builders.tier(0), 2, "tier clamped to the lowered cap");
  resetCfg();
});

suite("builders: cost curve");

test("cost matches baseCost x tierGrowth^tier x bldgGrowth^index x boardScale", () => {
  resetCfg();
  const expected = (b, t) => cfg.baseCost * Math.pow(cfg.tierGrowth, t) * Math.pow(cfg.bldgGrowth, b) * cfg.boardScale;
  [[0, 0], [0, 4], [5, 2], [11, 4]].forEach(([b, t]) => near(Builders.cost(b, t), expected(b, t), 1e-6, `cost(${b},${t})`));
  eq(Builders.cost(0, 0), cfg.baseCost);
});

test("cost rises with both level and builder index", () => {
  resetCfg();
  ok(Builders.cost(0, 1) > Builders.cost(0, 0), "later levels cost more");
  ok(Builders.cost(1, 0) > Builders.cost(0, 0), "later builders cost more");
});

test("boardScale scales every price", () => {
  resetCfg();
  const base = Builders.cost(3, 2);
  cfg.boardScale = 2;
  near(Builders.cost(3, 2), base * 2, 1e-6);
  resetCfg();
});

test("nextCost is the price of the next level, and null once maxed", () => {
  freshRun();
  eq(Builders.nextCost(0), Builders.cost(0, 0));
  state.builder[0].tier = 2;
  eq(Builders.nextCost(0), Builders.cost(0, 2));
  state.builder[0].tier = cfg.tiers;
  eq(Builders.nextCost(0), null);
});

test("canAfford compares against the player's coins", () => {
  freshRun();
  state.coins = Builders.nextCost(0) - 1;
  ok(!Builders.canAfford(0));
  state.coins = Builders.nextCost(0);
  ok(Builders.canAfford(0), "exactly enough should be affordable");
  state.builder[0].tier = cfg.tiers;
  ok(!Builders.canAfford(0), "a maxed builder is never affordable");
});

test("cheapest finds the lowest available upgrade and ignores maxed ones", () => {
  freshRun();
  const c = Builders.cheapest();
  eq(c.b, 0, "builder 1 is cheapest at equal tiers");
  near(c.cost, Builders.cost(0, 0), 1e-6);
  state.builder.forEach(b => { b.tier = cfg.tiers; });
  eq(Builders.cheapest(), null, "nothing left to buy");
});

suite("builders: episodes & series");

test("series length is one episode per builder", () => {
  freshRun();
  eq(Builders.totalEpisodes(), cfg.buildings);
  eq(Builders.unlockedEpisodes(), 0);
});

test("unlockedEpisodes never exceeds the series length", () => {
  freshRun();
  state.epUnlockedCount = 999;
  eq(Builders.unlockedEpisodes(), Builders.totalEpisodes());
});

test("unlockEpisode queues that builder's episode id", () => {
  freshRun();
  eq(Builders.unlockEpisode(0), "001");
  deepEq(state.epQueue, ["001"]);
  eq(state.epUnlockedCount, 1);
  Builders.unlockEpisode(4);
  deepEq(state.epQueue, ["001", "005"]);
});

suite("builders: upgrade transaction");

test("upgrade refuses when the player can't pay", () => {
  freshRun();
  state.coins = Builders.nextCost(0) - 1;
  eq(Builders.upgrade(0), null);
  eq(Builders.tier(0), 0, "tier must not move");
});

test("upgrade refuses on a maxed builder, an unknown index, or a finished series", () => {
  freshRun();
  state.coins = 1e9;
  state.builder[0].tier = cfg.tiers;
  eq(Builders.upgrade(0), null, "maxed");
  eq(Builders.upgrade(99), null, "unknown index");
  freshRun(); state.coins = 1e9; state.seriesDone = true;
  eq(Builders.upgrade(0), null, "series over");
});

test("upgrade refuses mid-animation", () => {
  freshRun();
  state.coins = 1e9;
  state.animating = true;
  eq(Builders.upgrade(0), null);
  state.animating = false;
  ok(Builders.upgrade(0) !== null);
});

test("a successful upgrade deducts the cost and raises the tier", () => {
  freshRun();
  state.coins = 1e9;
  const cost = Builders.nextCost(0);
  const before = state.coins;
  const r = Builders.upgrade(0);
  near(state.coins, before - cost, 1e-6);
  eq(Builders.tier(0), 1);
  near(r.cost, cost, 1e-6);
  eq(r.level, 1);
  eq(r.builderDone, false);
});

test("episodes unlock only on the level that completes a builder", () => {
  freshRun();
  state.coins = 1e9;
  const titles = [];
  for (let t = 0; t < cfg.tiers; t++) titles.push(Builders.upgrade(0).title);
  const expected = new Array(cfg.tiers - 1).fill(null);
  deepEq(titles.slice(0, -1), expected, "intermediate levels must not unlock");
  ok(titles[titles.length - 1] !== null, "completing the builder must unlock");
  eq(state.epUnlockedCount, 1);
  deepEq(state.epQueue, ["001"]);
});

test("each upgrade spawns the configured number of mystery boxes", () => {
  freshRun();
  state.coins = 1e9;
  cfg.boxesPerUpgrade = 2;
  const r = Builders.upgrade(0);
  eq(r.spawned.length, 2);
  eq(state.boxes.size, 2);
  r.spawned.forEach(i => eq(tileType(i), "standard", "boxes only go on standard tiles"));
  resetCfg();
});

test("maxing every builder ends the series and unlocks one episode each", () => {
  freshRun();
  state.coins = 1e9;
  let lastResult = null;
  for (let i = 0; i < cfg.buildings; i++)
    for (let t = 0; t < cfg.tiers; t++) lastResult = Builders.upgrade(i);
  ok(Builders.allMaxed());
  ok(state.seriesDone, "seriesDone flag");
  eq(lastResult.seriesDone, true);
  eq(state.epUnlockedCount, cfg.buildings, "one episode per builder");
  eq(state.epQueue.length, cfg.buildings);
  eq(Builders.doneCount(), cfg.buildings);
});

test("the queue is filled in builder order", () => {
  freshRun();
  state.coins = 1e9;
  for (let i = 0; i < 3; i++) for (let t = 0; t < cfg.tiers; t++) Builders.upgrade(i);
  deepEq(state.epQueue, ["001", "002", "003"]);
});
