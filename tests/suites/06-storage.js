"use strict";
/* game.js resolveLandingEvents dispatch; storage.js.

   The overlay suite that used to live here is gone with the overlays: nothing sits on a tile
   any more, so a board index has exactly one thing on it. What a box pays is now tested in
   03-collection.js, where the box lives. */

suite("game: landing dispatch");

test("resolveLandingEvents delegates to the tile for that index", () => {
  freshRun();
  forcePool("money", r => r.kind === "money" && r.amount === 30, () => {
    state.pos = tilesOfType("std")[0]; state.coins = 0;
    resolveLandingEvents(1);
    eq(state.coins, 30 * cfg.boardScale);
  });
});

test("a landing yields that tile's events and nothing else", () => {
  freshRun();
  state.pos = 0;                                   // the Premiere: a free pack
  ok(resolveLandingEvents(1).some(e => e.pack), "the Premiere's pack");
  forcePool("money", r => r.kind === "money", () => {
    state.pos = tilesOfType("std")[0];
    eq(resolveLandingEvents(1).filter(e => e.pack).length, 0,
       "nothing arrives from a layer that no longer exists");
  });
});

test("a board type nobody registered is a quiet nothing, not a thrown roll", () => {
  freshRun();
  const real = BOARD_SEASONS[0];
  BOARD_SEASONS[0] = { season: 9, name: "x", tiles: real.tiles.map((t, i) => i === 9 ? "ghost" : t) };
  try {
    state.pos = 9;
    deepEq(resolveLandingEvents(1), [], "state.animating must never be left stuck by a throw");
  } finally { BOARD_SEASONS[0] = real; }
});

test("the returned list is a copy — a caller cannot mutate the tile's own array", () => {
  freshRun();
  /* Pinned to one row, because two landings are two independent draws now and would differ
     in length for reasons that have nothing to do with aliasing. */
  forcePool("money", r => r.kind === "money" && r.amount === 30, () => {
    state.pos = tilesOfType("std")[0];
    const a = resolveLandingEvents(1);
    a.push({ log: { icon: "x", msg: "x" } });
    eq(resolveLandingEvents(1).length, a.length - 1);
  });
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
  ok(s.albums && typeof s.albums === "object", "the collection rides along");
  ok(s.status && typeof s.status === "object", "and so does the shelf");
});

test("save then load restores a run", () => {
  freshRun();
  state.coins = 4321; state.clues = { "001": ["c2", "c5"] }; state.clueDay = { "001": 2 }; state.vip = 99; state.day = 4;
  state.energy = 17; state.pos = 23; state.mult = 5; state.rolls = 12;
  const held = Collection.pool()[0];
  Collection.add(held, 2);
  Status.grant("mug", "bought");
  saveState();

  freshRun();                                   // wipe in-memory state
  eq(state.coins, 0);
  ok(loadState(), "loadState should report success");
  eq(state.coins, 4321);
  deepEq(state.clues, { "001": ["c2", "c5"] }, "the evidence comes back clue by clue");
  deepEq(state.clueDay, { "001": 2 }, "and so does the clock the catch-up valve measures from");
  eq(state.vip, 99);
  eq(state.day, 4);
  eq(state.pos, 23);
  eq(state.mult, 5);
  eq(state.rolls, 12);
  eq(Collection.countOf(held), 2, "duplicates survive — the count is the album's memory");
  ok(Status.owns("mug"));
  eq(Status.howGot("mug"), "bought", "and how it arrived, which the profile shows");
  eq(state.animating, false, "always restored idle");
  eq(state.lastCoins, state.coins, "tween baseline starts where we left off");
});

test("a finished board and the one after it both come back", () => {
  freshRun();
  Collection.pool(1).forEach(id => Collection.add(id, 1));
  /* Cards no longer finish a set: its episodes have to be unlocked by clues AND watched. */
  Collection.pages(1).forEach(p => watchEpisode(unlockEpisode(p.ep)));
  Collection.advanceBoard();
  Collection.add(Collection.pool()[0], 1);
  const unlocked = Collection.unlockedEpisodeIds().slice();
  saveState();
  freshRun();
  loadState();
  eq(state.boardNum, 2);
  eq(state.boardsDone, 1);
  eq(Collection.collected(1), Collection.poolSize(1), "set 1's album is kept, not cleared");
  eq(Collection.collected(2), 1);
  deepEq(Collection.unlockedEpisodeIds(), unlocked,
         "the library is derived from the albums, so it survives without being stored");
});

test("a corrupt album degrades to an empty one rather than NaN", () => {
  freshRun();
  saveState();
  const raw = JSON.parse(localStorage.getItem("pmdrama.state.v1") || "{}");
  raw.albums = { "1": { "char:simon@gold": "lots", "clue:sign": -3, "clue:will": 2 },
                 "notaboard": { "clue:sign": 1 }, "0": { "clue:sign": 1 } };
  raw.boardNum = "x";
  localStorage.setItem("pmdrama.state.v1", JSON.stringify(raw));
  ok(loadState());
  eq(state.boardNum, 1, "a bad board number falls back to the first");
  eq(Collection.countOf("char:simon@gold"), 0, "a non-numeric count is dropped");
  eq(Collection.countOf("clue:sign"), 0, "and so is a negative one");
  eq(Collection.countOf("clue:will"), 2, "the good entry survives");
  eq(state.albums["notaboard"], undefined, "a key that is not a board number is not a board");
  eq(state.albums["0"], undefined);
});

test("a card this build no longer defines is kept, not deleted", () => {
  freshRun();
  saveState();
  const raw = JSON.parse(localStorage.getItem("pmdrama.state.v1") || "{}");
  raw.albums = { "1": { "char:someone-from-a-later-set@gold": 3 } };
  localStorage.setItem("pmdrama.state.v1", JSON.stringify(raw));
  ok(loadState());
  /* Board content is authored data that gets rewritten. Throwing the card away because this
     build has not heard of it would quietly delete a collection; it is invisible instead. */
  eq(state.albums["1"]["char:someone-from-a-later-set@gold"], 3);
  eq(Collection.cardOf("char:someone-from-a-later-set@gold"), null, "and it draws as nothing");
});

test("a status item this build no longer defines IS dropped", () => {
  freshRun();
  saveState();
  const raw = JSON.parse(localStorage.getItem("pmdrama.state.v1") || "{}");
  raw.status = { "mug": { day: 2, how: "bought" }, "ghost-item": { day: 1, how: "found" },
                 "stickers": { day: 1, how: "nonsense" } };
  localStorage.setItem("pmdrama.state.v1", JSON.stringify(raw));
  ok(loadState());
  ok(Status.owns("mug"));
  eq(Status.owns("ghost-item"), false,
     "unlike a card, an item that no longer exists is points nothing can explain");
  eq(Status.howGot("stickers"), "earned", "an unknown provenance falls back rather than sticking");
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
  unlockEpisode("002");
  saveState();
  // hand-edit the saved slot into the legacy format, which stored titles
  const raw = JSON.parse(localStorage.getItem("pmdrama.state.v1"));
  raw.epQueue = ["The Inheritance", "Rumors at Dawn", "002"];
  localStorage.setItem("pmdrama.state.v1", JSON.stringify(raw));

  freshRun();
  loadState();
  deepEq(state.epQueue, ["002"], "unknown titles dropped, real ids kept");
});

test("…and drops one whose episode is no longer unlocked", () => {
  freshRun();
  unlockEpisode("001");
  saveState();
  /* A save from when episodes were unlocked by CARDS has a queue and no evidence. Offering
     "Predict & watch" for an episode the player has not bought would be worse than resetting. */
  const raw = JSON.parse(localStorage.getItem("pmdrama.state.v1"));
  raw.clues = {};
  localStorage.setItem("pmdrama.state.v1", JSON.stringify(raw));
  freshRun();
  loadState();
  deepEq(state.epQueue, [], "the queue can only ever hold what is currently unlocked");
});

/* The library is not persisted at all — it is derived from the albums
   (Collection.unlockedEpisodeIds), so there is nothing here to round-trip beyond the albums
   themselves, which the board test above covers. */

test("a sealed reveal survives a reload — closing the tab cannot duck the bet", () => {
  freshRun();
  state.pendingReveal = { id: "001", wager: 500, odds: 2.4, won: false, payout: 0 };
  saveState();
  freshRun();
  eq(state.pendingReveal, null, "gone in memory");
  loadState();
  deepEq(state.pendingReveal, { id: "001", wager: 500, odds: 2.4, won: false, payout: 0 },
         "restored, so the losing bet is still owed a reveal");
});

test("a sealed reveal for a missing or malformed episode is dropped", () => {
  freshRun();
  saveState();
  const raw = JSON.parse(localStorage.getItem("pmdrama.state.v1"));
  [{ id: "999", wager: 10, odds: 2, won: true, payout: 20 },   // no such episode
   { id: "001", wager: 10, odds: 2 },                          // no decided outcome
   "nonsense", 7].forEach(bad => {
    raw.pendingReveal = bad;
    localStorage.setItem("pmdrama.state.v1", JSON.stringify(raw));
    freshRun(); loadState();
    eq(state.pendingReveal, null, `must not restore ${JSON.stringify(bad)}`);
  });
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

test("the box tables round-trip, and a wrong-shaped one is refused", () => {
  resetCfg();
  boxTiers[0].table[0].weight = 77;
  deckBoxes[0].weight = 55;
  saveConfig();
  resetCfg();
  eq(boxTiers[0].table[0].weight, defBoxTiers[0].table[0].weight, "reset first");
  ok(loadConfig());
  eq(boxTiers[0].table[0].weight, 77, "an edited drop weight comes back");
  eq(deckBoxes[0].weight, 55);

  /* A tier list from an older build that is short a tier would leave the store with a button
     that opens nothing, so it is refused wholesale rather than merged. */
  const raw = JSON.parse(localStorage.getItem("pmdrama.cfg.v1"));
  raw.boxTiers = raw.boxTiers.slice(0, 2);
  localStorage.setItem("pmdrama.cfg.v1", JSON.stringify(raw));
  resetCfg();
  ok(loadConfig());
  eq(boxTiers.length, defBoxTiers.length, "the shipped tiers stand");
  eq(boxTiers[0].table[0].weight, defBoxTiers[0].table[0].weight);
  clearConfig();
  resetCfg();
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
