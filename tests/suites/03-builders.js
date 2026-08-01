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

test("cost follows the model's power law: base x levelGrowth^(L-1) x b^exponent x boardScale", () => {
  resetCfg();
  // tier is the level already owned, so the level being paid for is tier+1;
  // b is the 1-based GLOBAL builder number, which in series 1 is index+1
  const expected = (idx, t) => {
    const seg = Economy.segmentFor(idx + 1);          // the shipped curve has six of them
    return seg.base * Math.pow(seg.levelGrowth, t) * Math.pow(idx + 1, seg.exponent) * cfg.boardScale;
  };
  // sampled either side of the 15 / 29 / 64 / 74 boundaries, so the segment lookup is exercised
  [[0, 0], [0, 4], [5, 2], [11, 4], [13, 0], [14, 0], [27, 3], [28, 1], [40, 2], [62, 4], [63, 0], [73, 2]]
    .forEach(([b, t]) => near(Builders.cost(b, t), expected(b, t), 1e-6, `cost(${b},${t})`));
  near(Builders.cost(0, 0), Economy.segmentFor(1).base, 1e-9,
       "builder 1 level 1 is the first segment's base, since b^exponent is 1 there");
});

test("the curve is a power law, not an exponential — it barely rises across a series", () => {
  resetCfg();
  const span = Builders.cost(239, 0) / Builders.cost(0, 0);   // builder 240 vs builder 1
  ok(span > 1 && span < 2, `240 builders should span well under 2x, got ${span.toFixed(3)}x`);
});

test("the last curve segment is open-ended, so no builder is ever unpriced", () => {
  resetCfg();
  const curve = Economy.model().costCurve;
  eq(curve[curve.length - 1].to, undefined, "the final segment must not be bounded");
  ok(isFinite(Economy.costFor(100000, 1)), "a builder far past the model still has a price");
  deepEq(Economy.validateCurve(curve), [], "the shipped curve validates");
});

test("validateCurve rejects a bounded final segment and a gap between segments", () => {
  const bounded = [{ from: 1, to: 10, kind: "power", base: 100, levelGrowth: 1.5, exponent: 0.05 }];
  ok(Economy.validateCurve(bounded).some(e => /last cost-curve segment/i.test(e)),
     "a curve that stops must be refused");
  const gapped = [
    { from: 1, to: 10, kind: "power", base: 100, levelGrowth: 1.5, exponent: 0.05 },
    { from: 20, kind: "power", base: 100, levelGrowth: 1.5, exponent: 0.05 },
  ];
  ok(Economy.validateCurve(gapped).some(e => /leave no gap/i.test(e)), "builders 11-19 would be unpriced");
});

test("a continuous segment picks up exactly where the previous one left off", () => {
  const saved = Economy.model().costCurve;
  const curve = [
    { from: 1, to: 20, kind: "power", base: 164, levelGrowth: 1.5, exponent: 0.0497678368,
      bIndex: "global", baseMode: "absolute" },
    { from: 21, kind: "power", base: 999, levelGrowth: 1.5, exponent: 0.4,
      bIndex: "global", baseMode: "continuous" },
  ];
  Economy.model().costCurve = curve;
  const before = 164 * Math.pow(21, 0.0497678368);   // what rule 1 would have charged at 21
  near(Economy.costFor(21, 1), before, 1e-9, "no step at the boundary");
  ok(Economy.costFor(40, 1) > Economy.costFor(21, 1), "and the steeper exponent takes over after it");
  Economy.model().costCurve = saved;
});

test("an absolute segment steps at the boundary, deliberately", () => {
  const saved = Economy.model().costCurve;
  Economy.model().costCurve = [
    { from: 1, to: 20, kind: "power", base: 164, levelGrowth: 1.5, exponent: 0.05, bIndex: "global", baseMode: "absolute" },
    { from: 21, kind: "power", base: 500, levelGrowth: 1.5, exponent: 0.05, bIndex: "global", baseMode: "absolute" },
  ];
  ok(Economy.costFor(21, 1) > Economy.costFor(20, 1) * 2, "the new base applies in full");
  Economy.model().costCurve = saved;
});

test("an explicit segment reads its prices straight from the table", () => {
  const saved = Economy.model().costCurve;
  Economy.model().costCurve = [
    { from: 1, to: 2, kind: "explicit", levels: [[10, 20, 30, 40, 50], [11, 21, 31, 41, 51]] },
    { from: 3, kind: "power", base: 164, levelGrowth: 1.5, exponent: 0.05, bIndex: "global", baseMode: "absolute" },
  ];
  eq(Economy.costFor(1, 1), 10);
  eq(Economy.costFor(2, 3), 31);
  Economy.model().costCurve = saved;
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

suite("builders: paging");

test("a page holds pageSize builders, and the last one carries the remainder", () => {
  freshRun();
  cfg.buildings = 12; cfg.builderPageSize = 5; Builders.reshape();
  eq(Builders.pageCount(), 3, "12 builders at 5 a page");
  eq(Builders.page(), 0);
  deepEq(Builders.pageBuilders(), [0, 1, 2, 3, 4]);
  // max the whole first page
  for (let i = 0; i < 5; i++) state.builder[i].tier = cfg.tiers;
  eq(Builders.page(), 1, "page turns only once every builder on it is done");
  deepEq(Builders.pageBuilders(), [5, 6, 7, 8, 9]);
  for (let i = 5; i < 10; i++) state.builder[i].tier = cfg.tiers;
  eq(Builders.page(), 2);
  deepEq(Builders.pageBuilders(), [10, 11], "short final page, not a padded one");
  resetCfg();
});

test("the page does not turn while any builder on it is unfinished", () => {
  freshRun();
  cfg.buildings = 12; cfg.builderPageSize = 5; Builders.reshape();
  // finish four of five, out of order, and leave one at a middling tier
  [0, 1, 3, 4].forEach(i => { state.builder[i].tier = cfg.tiers; });
  state.builder[2].tier = cfg.tiers - 1;
  eq(Builders.page(), 0, "one unfinished builder holds the page");
  deepEq(Builders.pageBuilders(), [0, 1, 2, 3, 4]);
  state.builder[2].tier = cfg.tiers;
  eq(Builders.page(), 1);
  resetCfg();
});

test("completing everything holds on the last page rather than running off the end", () => {
  freshRun();
  cfg.buildings = 12; cfg.builderPageSize = 5; Builders.reshape();
  state.builder.forEach(b => { b.tier = cfg.tiers; });
  eq(Builders.page(), 2, "clamped to the last page");
  deepEq(Builders.pageBuilders(), [10, 11]);
  resetCfg();
});

test("paging survives a page size that does not divide, or exceeds the series", () => {
  freshRun();
  cfg.buildings = 12; cfg.builderPageSize = 7; Builders.reshape();
  eq(Builders.pageCount(), 2);
  deepEq(Builders.pageBuilders(), [0, 1, 2, 3, 4, 5, 6]);
  cfg.builderPageSize = 50;
  eq(Builders.pageCount(), 1, "a page bigger than the series is one page");
  eq(Builders.pageBuilders().length, 12);
  cfg.builderPageSize = 0;
  eq(Builders.pageSize(), 1, "a zero page size cannot divide by zero");
  ok(Builders.pageCount() >= 1);
  resetCfg();
});

suite("builders: episodes & series");

test("series length is one episode per builder", () => {
  freshRun();
  eq(Builders.totalEpisodes(), cfg.buildings);
  eq(Builders.unlockedEpisodes(), 0);
});

test("unlockedEpisodes counts completed builders, so it cannot exceed the series", () => {
  freshRun();
  state.builder.forEach(b => { b.tier = cfg.tiers; });
  eq(Builders.unlockedEpisodes(), Builders.totalEpisodes());
  eq(Builders.unlockedEpisodes(), Builders.doneCount(),
     "one episode per completed builder — no separate counter to drift");
});

/* The library is DERIVED from the builders, never stored. These are the tests that pin that:
   the episode id is the builder number, so a completed builder IS an unlocked episode. */
test("episodes come off the FRONT of the story, whatever order builders are finished in", () => {
  freshRun();
  deepEq(Builders.unlockedEpisodeIds(), [], "nothing built, nothing unlocked");
  // finish builder 3 first — the drama is serialised, so this earns episode 1, not episode 3
  state.builder[2].tier = cfg.tiers;
  deepEq(Builders.unlockedEpisodeIds(), ["001"], "builder 3 done → episode 1");
  state.builder[0].tier = cfg.tiers;
  deepEq(Builders.unlockedEpisodeIds(), ["001", "002"], "two done → the first two episodes");
  state.builder[1].tier = cfg.tiers - 1;                 // unfinished changes nothing
  deepEq(Builders.unlockedEpisodeIds(), ["001", "002"]);
  eq(Builders.unlockedCount(), 2);
});

test("the library keeps an episode after it has been watched", () => {
  freshRun();
  state.coins = 1000;
  state.builder[0].tier = cfg.tiers;
  Builders.unlockEpisode();
  deepEq(state.epQueue, ["001"], "queued as unwatched");
  resolvePrediction({ wager: 0, odds: 2, sel: 0, correct: 0, auto: false, id: "001" });
  deepEq(state.epQueue, [], "watched, so it leaves the queue");
  deepEq(Builders.unlockedEpisodeIds(), ["001"],
         "but the library still has it — the builder is still built, which is the whole point");
});

test("firstUnwatchedId is the earliest unwatched in album order, not queue order", () => {
  freshRun();
  for (let i = 0; i < 5; i++) state.builder[i].tier = cfg.tiers;
  deepEq(Builders.unlockedEpisodeIds(), ["001", "002", "003", "004", "005"]);
  // 1-3 watched, 4 and 5 not — and queued in the "wrong" order, as out-of-order completion does
  state.epQueue = ["005", "004"];
  eq(Builders.firstUnwatchedId(), "004",
     "tapping 5 must start 4: album order decides, not the order they happened to unlock");
  state.epQueue = ["005"];
  eq(Builders.firstUnwatchedId(), "005", "once 4 is watched, 5 is the earliest left");
  state.epQueue = [];
  eq(Builders.firstUnwatchedId(), null, "nothing unwatched");
});

test("firstUnwatchedId falls back to the queue for an episode outside the album", () => {
  freshRun();
  // e.g. a previous series' episode still queued after advanceSeries reset the builders
  state.epQueue = ["007"];
  deepEq(Builders.unlockedEpisodeIds(), [], "no builders complete in this series");
  eq(Builders.firstUnwatchedId(), "007", "it must still be reachable");
});

test("the library survives a reload with no stored list at all", () => {
  freshRun();
  // an old save: builders done, some watched, and nothing recording which episodes existed
  state.builder[0].tier = cfg.tiers; state.builder[1].tier = cfg.tiers;
  state.builder[2].tier = cfg.tiers; state.builder[3].tier = cfg.tiers;
  state.epQueue = ["004"];                                // three already watched
  saveState();
  freshRun();
  loadState();
  deepEq(Builders.unlockedEpisodeIds(), ["001", "002", "003", "004"],
         "four unlocked, three watched — the library must still show all four");
  deepEq(state.epQueue, ["004"], "and only the unwatched one is still queued");
});

test("unlockEpisode queues the next episode in the story, not the builder's own", () => {
  freshRun();
  // complete builder 5 first: it must still earn episode 1
  state.builder[4].tier = cfg.tiers;
  eq(Builders.unlockEpisode(), "001", "builder 5 done → episode 1");
  deepEq(state.epQueue, ["001"]);
  state.builder[2].tier = cfg.tiers;
  eq(Builders.unlockEpisode(), "002", "then the next one along");
  deepEq(state.epQueue, ["001", "002"]);
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
  eq(Builders.unlockedEpisodes(), 1);
  deepEq(state.epQueue, ["001"]);
});

test("each upgrade BANKS the configured number of mystery boxes", () => {
  freshRun();
  state.coins = 1e9;
  cfg.boxesPerUpgrade = 2;
  const r = Builders.upgrade(0);
  eq(r.boxes, 2);
  // banked, not placed — the player is on the builders screen and would never see them land
  eq(state.pendingBoxes, 2, "the buy banks boxes rather than dropping them on the board");
  eq(state.boxes.size, 0, "nothing reaches the board until the player goes back to it");
  eq(r.pendingBoxes, 2);
  Builders.upgrade(0);
  eq(state.pendingBoxes, 4, "banked boxes accumulate across upgrades");
  resetCfg();
});

test("banked boxes land on standard tiles when they are finally spawned", () => {
  freshRun();
  state.coins = 1e9;
  cfg.boxesPerUpgrade = 3;
  Builders.upgrade(0);
  const spawned = OVERLAY_TYPES.mysteryBox.spawn(state.pendingBoxes);
  eq(spawned.length, 3);
  eq(state.boxes.size, 3);
  spawned.forEach(i => eq(tileType(i), "standard", "boxes only go on standard tiles"));
  resetCfg();
});

test("a full board keeps the leftover boxes banked instead of eating them", () => {
  freshRun();
  // fill every eligible tile, then ask for two more
  const box = OVERLAY_TYPES.mysteryBox;
  const room = box.spawn(40).length;
  ok(room > 0 && state.boxes.size === room, "board filled to capacity");
  state.pendingBoxes = 2;
  const spawned = box.spawn(state.pendingBoxes);
  eq(spawned.length, 0, "no free tiles left");
  // this is the rule deliverBoxes() relies on to avoid losing a paid-for reward
  eq(Math.max(0, state.pendingBoxes - spawned.length), 2, "both stay banked for the next trip");
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
  eq(Builders.unlockedEpisodes(), cfg.buildings, "one episode per builder");
  eq(state.epQueue.length, cfg.buildings);
  eq(Builders.doneCount(), cfg.buildings);
});

test("the queue is filled in builder order", () => {
  freshRun();
  state.coins = 1e9;
  for (let i = 0; i < 3; i++) for (let t = 0; t < cfg.tiers; t++) Builders.upgrade(i);
  deepEq(state.epQueue, ["001", "002", "003"]);
});
