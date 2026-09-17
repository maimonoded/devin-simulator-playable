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
  eq(got.length, 30, "there are only 30 standard tiles — the two bills are not eligible either");
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

test("consume removes the box and returns the opening plus one event per item", () => {
  freshRun();
  const box = OVERLAY_TYPES.mysteryBox;
  const [t] = box.spawn(1);
  const ev = box.consume(t);
  ok(!box.has(t), "must be removed from the board");
  ok(Array.isArray(ev), "a two-item box has to return two events — one float per event");
  eq(ev.length, 3, "the opening, then one event per item");
  // the opening comes first: the box has to pop before its numbers come out of the burst
  ok(ev[0].boxOpen, "the opening leads");
  eq(ev[0].boxOpen.tile, t, "and it knows which box to fly");
  ok(!ev[0].float && !ev[0].log, "it pays nothing itself — it only shows what was already banked");
  ev.slice(1).forEach((e, i) => { ok(e.log, `item ${i + 1} has a log line`); ok(e.float, `item ${i + 1} has a float`); });
});

test("contents are decided when the box is PLACED, not when it is landed on", () => {
  freshRun();
  const box = OVERLAY_TYPES.mysteryBox;
  box.spawn(6);
  box.all().forEach(i => {
    const d = box.dataAt(i);
    ok(d, `tile ${i} must know what it holds the moment it is placed`);
    ok(["coins", "energy"].includes(d.kind), d.kind);
    ok(d.amount > 0);
  });
});

test("what a box shows is what it pays — the stored draw is honoured, not re-rolled", () => {
  freshRun();
  const box = OVERLAY_TYPES.mysteryBox;
  state.energy = 0;
  box.positions().set(9, { kind: "energy", amount: 2, name: "Energy" });
  // force the TABLE to coins: a re-roll at landing would pay coins instead of what was stored
  const [open] = forceDrop("coins", () => box.consume(9));
  eq(open.boxOpen.energy, 2, "the box opens as what it was placed holding, not what the table now says");
  eq(state.energy, 2);
});

/* A save made while the box table still had a clues row can still be sitting in a browser.
   Its boxes must open as SOMETHING rather than silently paying nothing. */
test("a box holding a kind that no longer exists falls back to coins", () => {
  freshRun();
  const box = OVERLAY_TYPES.mysteryBox;
  state.coins = 0;
  box.positions().set(9, { kind: "clues", amount: 2, name: "Clues" });
  const ev = box.consume(9);
  ok(state.coins > 0, "it pays coins rather than nothing at all");
  ok(ev[0].boxOpen, "and still opens normally");
});

test("a box saved before contents were decided still opens", () => {
  freshRun();
  // the old shape: a bare tile index with nothing stored alongside it
  state.boxes = new Map([[9, null]]);
  const ev = OVERLAY_TYPES.mysteryBox.consume(9);
  ok(Array.isArray(ev) && ev.length === 3, "draws for it at landing, as the old code did");
  ok(ev[0].boxOpen);
});

test("item 1 is always coins, whatever item 2 turns out to be", () => {
  freshRun();
  ["coins", "energy"].forEach(kind => {
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

test("a coin drop rains coins and no energy", () => {
  freshRun();
  state.coins = 0;
  const [open, , second] = forceDrop("coins", () => OVERLAY_TYPES.mysteryBox.onLand(3));
  ok(state.coins > 0);
  eq(open.boxOpen.energy, 0, "nothing electrical to shower");
  eq(open.boxOpen.coins, state.coins, "the coin shower is sized by what was actually won");
  eq(second.pause, 120);
});

test("an energy drop rains energy as well as the guaranteed coins", () => {
  freshRun();
  state.energy = 0;
  const [open] = forceDrop("energy", () => OVERLAY_TYPES.mysteryBox.onLand(3));
  ok(state.energy > 0);
  ok(open.boxOpen.energy > 0, "energy drops get their own shower");
  // item 1 is always coins, so a coin shower fires on every box whatever item 2 was
  ok(open.boxOpen.coins > 0, "the guaranteed coins still rain");
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
  OVERLAY_TYPES.mysteryBox.positions().set(tile, { kind: "coins", amount: 10, name: "Coins" });
  state.pos = tile;
  const ev = forceDrop("coins", () => resolveLandingEvents(1));
  ok(ev[0].boxOpen, "the box opens before anything else resolves");
  ok(ev[1].log && ev[1].log.msg.includes("Mystery Box"), "then the box pays, ahead of the tile");
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
});

test("save then load restores a run", () => {
  freshRun();
  state.coins = 4321; state.vip = 99; state.day = 4;
  state.energy = 17; state.pos = 23; state.mult = 5; state.rolls = 12;
  OVERLAY_TYPES.mysteryBox.clear();
  OVERLAY_TYPES.mysteryBox.positions().set(9, { kind: "energy", amount: 2, name: "Energy" });
  saveState();

  freshRun();                                   // wipe in-memory state
  eq(state.coins, 0);
  ok(loadState(), "loadState should report success");
  eq(state.coins, 4321);
  eq(state.vip, 99);
  eq(state.day, 4);
  eq(state.pos, 23);
  eq(state.mult, 5);
  eq(state.rolls, 12);
  ok(state.boxes instanceof Map, "boxes come back as a Map — the contents ride with the tile");
  ok(state.boxes.has(9));
  // the draw happened when the box was PLACED, so it must reopen as what it was placed holding
  eq(state.boxes.get(9).kind, "energy", "what was inside survives the round trip");
  eq(state.animating, false, "always restored idle");
  eq(state.lastCoins, state.coins, "tween baseline starts where we left off");
});

test("boxes bought but not yet thrown survive a reload", () => {
  freshRun();
  state.pendingBoxes = 3;
  saveState();
  freshRun();
  eq(state.pendingBoxes, 0, "fresh state starts with none banked");
  ok(loadState());
  // they are paid for — losing them on a reload would be losing a reward
  eq(state.pendingBoxes, 3, "banked boxes are restored, ready for the next trip to the board");
});

test("a corrupt pending-box count degrades to none rather than NaN", () => {
  freshRun();
  const raw = JSON.parse(localStorage.getItem("pmdrama.state.v1") || "{}");
  raw.pendingBoxes = "not a number";
  localStorage.setItem("pmdrama.state.v1", JSON.stringify(raw));
  ok(loadState());
  eq(state.pendingBoxes, 0, "a bad value must not poison the counter");
});

test("restore keeps energy bought above the cap", () => {
  freshRun();
  state.energy = 900;
  saveState();
  freshRun();
  loadState();
  eq(state.energy, 900, "no cap clamp on restore");
});

/* A v1 save — written before builders, clues and predictions were removed — is still sitting
   in browsers. serializeState() no longer names those fields and loadState() only copies keys
   it names, so they are dropped rather than migrated. What the player keeps is the run: coins,
   day, clock, position, energy and their boxes. */
test("a v1 save loads, keeping the run and silently dropping the removed systems", () => {
  freshRun();
  state.coins = 5000; state.day = 6; state.pos = 17; state.rolls = 40;
  saveState();
  const raw = JSON.parse(localStorage.getItem("pmdrama.state.v1"));
  Object.assign(raw, {
    v: 1,
    clues: 12, cycleClues: 3, series: 1, seriesDone: false,
    builder: [{ tier: 5 }, { tier: 2 }],
    epQueue: ["001", "002"], epsWatched: 4,
    pendingReveal: { id: "001", wager: 500, odds: 2.4, won: false, payout: 0 },
    predWins: 3, predLoss: 1, streak: 2, bestStreak: 5, predsMade: 4,
  });
  localStorage.setItem("pmdrama.state.v1", JSON.stringify(raw));

  freshRun();
  ok(loadState(), "an old save must still load, not be refused");
  eq(state.coins, 5000, "the run survives");
  eq(state.day, 6);
  eq(state.pos, 17);
  eq(state.rolls, 40);
  ["clues", "cycleClues", "series", "seriesDone", "builder", "epQueue", "epsWatched",
   "pendingReveal", "predWins", "predLoss", "streak", "bestStreak", "predsMade"]
    .forEach(k => eq(k in state, false, `${k} must not be resurrected onto state`));
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

/* Clues were removed from the GAME, not from the workbook, so the economy version did not
   change and a config saved before the removal is still treated as current. Its deck and box
   table therefore come back verbatim unless loadConfig filters them. */
test("a config saved before clues were removed comes back without them", () => {
  resetCfg();
  saveConfig();
  const raw = JSON.parse(localStorage.getItem("pmdrama.cfg.v1"));
  raw.deck = [{ name: "Small coins", weight: 40, coins: 30, energy: 0, clues: 0, vip: 0 }];
  raw.boxTable = [{ name: "Coins", kind: "coins", weight: 33, amount: 60 },
                  { name: "Energy", kind: "energy", weight: 33, amount: 3 },
                  { name: "Clues", kind: "clues", weight: 33, amount: 2 }];
  localStorage.setItem("pmdrama.cfg.v1", JSON.stringify(raw));

  resetCfg();
  ok(loadConfig());
  eq(boxTable.filter(r => r.kind === "clues").length, 0, "the clue row is dropped");
  eq(boxTable.length, 2, "and the other two survive");
  eq(deck.filter(c => "clues" in c).length, 0, "the dead field is stripped off every card");
  eq(deck[0].coins, 30, "everything else about the saved card is kept");
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
