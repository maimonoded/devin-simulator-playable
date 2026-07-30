"use strict";
/* overlays/* — the mystery box; game.js resolveLandingEvents dispatch; storage.js */

suite("overlays: registry & placement");

test("the mystery box is registered and inherits the base", () => {
  const box = OVERLAY_TYPES.mysteryBox;
  ok(box, "not registered");
  ok(box instanceof Overlay && box instanceof BoardActor);
  ok(!(box instanceof Tile), "an overlay is not a tile");
  eq(box.stateKey, "boxes");
  eq(box.icon, "🎁");
  ok(OVERLAYS.includes(box));
});

test("boxes are only eligible for standard tiles", () => {
  const box = OVERLAY_TYPES.mysteryBox;
  for (let i = 0; i < 40; i++) eq(box.eligible(i), tileType(i) === "standard", "tile " + i);
});

test("spawn places the requested count on free eligible tiles", () => {
  freshRun();
  const box = OVERLAY_TYPES.mysteryBox;
  const got = box.spawn(5);
  eq(got.length, 5);
  eq(new Set(got).size, 5, "no duplicates");
  got.forEach(i => ok(box.eligible(i), "spawned on an ineligible tile: " + i));
  eq(box.all().length, 5);
});

test("spawn never exceeds the number of free tiles", () => {
  freshRun();
  const box = OVERLAY_TYPES.mysteryBox;
  const got = box.spawn(999);
  eq(got.length, 26, "there are only 26 standard tiles");
  eq(box.spawn(1).length, 0, "nothing free left");
});

test("has / all / clear reflect placement", () => {
  freshRun();
  const box = OVERLAY_TYPES.mysteryBox;
  const [t] = box.spawn(1);
  ok(box.has(t));
  eq(box.all().length, 1);
  box.clear();
  eq(box.all().length, 0);
  ok(!box.has(t));
});

test("consume removes the box and returns an event for each of its two items", () => {
  freshRun();
  const box = OVERLAY_TYPES.mysteryBox;
  const [t] = box.spawn(1);
  const ev = box.consume(t);
  ok(!box.has(t), "must be removed from the board");
  ok(Array.isArray(ev), "a two-item box has to return two events — one float per event");
  eq(ev.length, 2);
  ev.forEach((e, i) => { ok(e.log, `item ${i + 1} has a log line`); ok(e.float, `item ${i + 1} has a float`); });
});

test("item 1 is always coins, whatever item 2 turns out to be", () => {
  freshRun();
  ["coins", "energy", "clues"].forEach(kind => {
    state.coins = 0;
    forceDrop(kind, () => OVERLAY_TYPES.mysteryBox.onLand());
    ok(state.coins >= cfg.boxCoins * cfg.boardScale, `guaranteed coins still paid on a ${kind} draw`);
  });
});

suite("overlays: mystery box drops");

function forceDrop(kind, fn) {
  const saved = boxTable.map(c => c.weight);
  boxTable.forEach(c => { c.weight = c.kind === kind ? 100 : 0; });
  try { return fn(); } finally { boxTable.forEach((c, i) => { c.weight = saved[i]; }); }
}

test("a coin drop pays coins and does not fire the dice shower", () => {
  freshRun();
  state.coins = 0;
  const [, second] = forceDrop("coins", () => OVERLAY_TYPES.mysteryBox.onLand());
  ok(state.coins > 0);
  eq(second.dice, false);
  eq(second.pause, 120);
});

test("an energy drop grants energy and fires the dice shower", () => {
  freshRun();
  state.energy = 0;
  const [, second] = forceDrop("energy", () => OVERLAY_TYPES.mysteryBox.onLand());
  ok(state.energy > 0);
  eq(second.dice, true);
});

test("a clue drop feeds both the album total and the per-prediction flow", () => {
  freshRun();
  state.clues = 0; state.cycleClues = 0;
  forceDrop("clues", () => OVERLAY_TYPES.mysteryBox.onLand());
  ok(state.clues > 0, "the album counts it");
  eq(state.cycleClues, state.clues, "and so does the flow that buys accuracy");
});

test("an energy drop cannot reduce an over-cap balance", () => {
  freshRun();
  state.energy = 500;
  forceDrop("energy", () => OVERLAY_TYPES.mysteryBox.onLand());
  eq(state.energy, 500);
});

suite("game: landing dispatch");

test("resolveLandingEvents delegates to the tile for that index", () => {
  freshRun();
  state.pos = 9; state.coins = 0;
  OVERLAY_TYPES.mysteryBox.clear();
  resolveLandingEvents(1);
  near(state.coins, cfg.stdBase * stdWeights[9] * cfg.boardScale, 1e-9);
});

test("an overlay resolves before the tile, and both pay out", () => {
  freshRun();
  state.coins = 0;
  OVERLAY_TYPES.mysteryBox.clear();
  const tile = 9;
  OVERLAY_TYPES.mysteryBox.positions().add(tile);
  state.pos = tile;
  const ev = forceDrop("coins", () => resolveLandingEvents(1));
  ok(ev[0].log && ev[0].log.msg.includes("Mystery Box"), "box event must come first");
  const tilePay = cfg.stdBase * stdWeights[tile] * cfg.boardScale;
  ok(state.coins > tilePay, "should include both the box and the tile payout");
  ok(!OVERLAY_TYPES.mysteryBox.has(tile), "box consumed");
});

test("landing on a tile with no overlay yields only tile events", () => {
  freshRun();
  OVERLAY_TYPES.mysteryBox.clear();
  state.pos = 9;
  const ev = resolveLandingEvents(1);
  eq(ev.filter(e => e.log && e.log.msg.includes("Mystery Box")).length, 0);
});

suite("storage");

test("serializeState captures progress and omits transient fields", () => {
  freshRun();
  state.coins = 1234; state.day = 3; state.rolls = 7;
  state.animating = true;                       // transient
  const s = serializeState();
  eq(s.coins, 1234);
  eq(s.day, 3);
  eq(s.rolls, 7);
  eq("animating" in s, false, "animating must not be persisted");
  eq("lastCoins" in s, false, "tween baselines must not be persisted");
  ok(Array.isArray(s.boxes), "sets are serialised as arrays");
  ok(Array.isArray(s.builder));
});

test("save then load restores a run", () => {
  freshRun();
  state.coins = 4321; state.clues = 6; state.vip = 99; state.day = 4;
  state.energy = 17; state.pos = 23; state.mult = 5; state.rolls = 12;
  state.builder[2].tier = 3;
  OVERLAY_TYPES.mysteryBox.clear();
  OVERLAY_TYPES.mysteryBox.positions().add(9);
  saveState();

  freshRun();                                   // wipe in-memory state
  eq(state.coins, 0);
  ok(loadState(), "loadState should report success");
  eq(state.coins, 4321);
  eq(state.clues, 6);
  eq(state.vip, 99);
  eq(state.day, 4);
  eq(state.pos, 23);
  eq(state.mult, 5);
  eq(state.rolls, 12);
  eq(Builders.tier(2), 3);
  ok(state.boxes instanceof Set, "boxes must come back as a Set");
  ok(state.boxes.has(9));
  eq(state.animating, false, "always restored idle");
  eq(state.lastCoins, state.coins, "tween baseline starts where we left off");
});

test("restore keeps energy bought above the cap", () => {
  freshRun();
  state.energy = 900;
  saveState();
  freshRun();
  loadState();
  eq(state.energy, 900, "no cap clamp on restore");
});

test("loadState drops queue entries that aren't known episode ids", () => {
  freshRun();
  state.epQueue = ["001"];
  state.epUnlockedCount = 1;
  saveState();
  // hand-edit the saved slot into the legacy format, which stored titles
  const raw = JSON.parse(localStorage.getItem("pmdrama.state.v1"));
  raw.epQueue = ["The Inheritance", "Rumors at Dawn", "002"];
  raw.epUnlockedCount = 3;
  localStorage.setItem("pmdrama.state.v1", JSON.stringify(raw));

  freshRun();
  loadState();
  deepEq(state.epQueue, ["002"], "unknown titles dropped, real ids kept");
  eq(state.epUnlockedCount, 1, "counter reduced by the number dropped");
});

test("loadState reports false when there is nothing saved", () => {
  localStorage.removeItem("pmdrama.state.v1");
  freshRun();
  eq(loadState(), false);
});

test("corrupt saved data is ignored rather than throwing", () => {
  localStorage.setItem("pmdrama.state.v1", "{not json");
  freshRun();
  eq(loadState(), false);
  localStorage.removeItem("pmdrama.state.v1");
});

test("config round-trips, and saved values merge onto DEFAULTS", () => {
  resetCfg();
  cfg.stdBase = 99;
  cfg.tokenStepMs = 42;
  saveConfig();
  // simulate a build that added a new key after this save was written
  const raw = JSON.parse(localStorage.getItem("pmdrama.cfg.v1"));
  delete raw.cfg.revealMs;
  localStorage.setItem("pmdrama.cfg.v1", JSON.stringify(raw));

  resetCfg();
  ok(loadConfig());
  eq(cfg.stdBase, 99, "saved value restored");
  eq(cfg.tokenStepMs, 42);
  eq(cfg.revealMs, DEFAULTS.revealMs, "a key missing from the save falls back to its default");
  clearConfig();
  resetCfg();
});

test("clearConfig and clearState empty their own slots only", () => {
  resetCfg();
  saveConfig();
  freshRun();
  saveState();
  clearConfig();
  eq(localStorage.getItem("pmdrama.cfg.v1"), null);
  ok(localStorage.getItem("pmdrama.state.v1") !== null, "progress must survive a config reset");
  clearState();
  eq(localStorage.getItem("pmdrama.state.v1"), null);
});
