"use strict";
/* clues.js — the gate on the story, and the evidence you bet on (GDD §6).

   The thing worth pinning down here is that these are ONE object doing two jobs. A test that
   only checked "four clues unlock an episode" would pass just as happily against a counter, and
   the counter is exactly what the design refuses: the requirement sits below the authored pool,
   so which four you hold is information, not just progress. */

suite("clues: the content");

test("every shipped episode has enough clues to be unlockable", () => {
  deepEq(Clues.validate(), []);
});

test("the pool is bigger than the requirement — that is what makes evidence personal", () => {
  const need = Clues.baseRequired();
  Episodes.ids().forEach(id => {
    ok(Clues.authoredFor(id).length > need,
       `${id} authors ${Clues.authoredFor(id).length} clues against a requirement of ${need} — ` +
       "with no slack, every player would reach the wager screen holding the same evidence");
  });
});

test("validate catches an episode that can never be unlocked", () => {
  const ep = Episodes.get("001"), real = ep.clues;
  try {
    ep.clues = [];
    ok(Clues.validate().some(e => /can never be unlocked/.test(e)));
    ep.clues = [{ id: "c1", text: "one" }, { id: "c1", text: "two" }];
    const errs = Clues.validate();
    ok(errs.some(e => /two clues called/.test(e)), "a duplicate id");
    ok(errs.some(e => /are needed to unlock/.test(e)), "and too few of them");
  } finally { ep.clues = real; }
});

suite("clues: holding and unlocking");

test("a clue is banked against a specific episode, and unlocking is derived from it", () => {
  freshRun();
  const id = Episodes.ids()[0];
  const need = Clues.requiredFor(id);
  eq(Clues.isUnlocked(id), false);
  for (let k = 0; k < need; k++) {
    eq(Clues.countFor(id), k);
    state.clues[id] = Clues.authoredFor(id).slice(0, k + 1).map(c => c.id);
  }
  ok(Clues.isUnlocked(id), "the requirement is the whole gate — there is no flag to set");
  deepEq(Clues.unlockedIds(), [id]);
});

test("clues go to the first episode that is not unlocked yet, so they always move the story", () => {
  freshRun();
  const ids = Episodes.ids();
  eq(Clues.currentId(), ids[0]);
  unlockEpisode(ids[0]);
  eq(Clues.currentId(), ids[1], "a clue never arrives for something already bought");
  for (let k = 0; k < 30; k++) Clues.grant();
  eq(Clues.countFor(ids[0]), Clues.requiredFor(ids[0]),
     "the unlocked episode gained nothing more");
});

test("granting stops cleanly when every episode is unlocked", () => {
  freshRun();
  Episodes.ids().forEach(id => unlockEpisode(id));
  eq(Clues.currentId(), null);
  eq(Clues.grant(), null, "a real state, not an error — the collection caught up with the story");
});

test("a duplicate clue pays coins rather than nothing", () => {
  freshRun();
  const id = Clues.currentId();
  /* Hold every clue but one, then grant until the draw repeats itself. */
  const cs = Clues.authoredFor(id);
  state.clues[id] = cs.slice(0, cs.length - 1).map(c => c.id);
  state.clueDay[id] = state.day;
  let dupe = null;
  for (let k = 0; k < 500 && !dupe; k++) {
    state.coins = 0;
    const got = Clues.grant();
    if (got && !got.isNew) dupe = got;
  }
  ok(dupe, "with seven of eight held, a repeat has to come up");
  ok(dupe.coins > 0, "GDD §12: a duplicate always converts to something");
  eq(state.coins, dupe.coins);
});

test("the evidence is resolved to its text, in authored order", () => {
  freshRun();
  const id = Episodes.ids()[0], cs = Clues.authoredFor(id);
  state.clues[id] = [cs[4].id, cs[1].id];
  deepEq(Clues.evidenceFor(id).map(c => c.id), [cs[1].id, cs[4].id],
         "read back in the order the writer put them in, not the order they were drawn");
  Clues.evidenceFor(id).forEach(c => ok(c.text, "the wager screen prints this"));
});

test("the lifetime total is derived, never stored", () => {
  freshRun();
  eq(Clues.total(), 0);
  state.clues = { "001": ["c1", "c2"], "002": ["c5"] };
  eq(Clues.total(), 3);
});

suite("clues: the catch-up valve");

test("it does nothing at all for a player who is progressing", () => {
  freshRun();
  const id = Clues.currentId();
  eq(Clues.requiredFor(id), Clues.baseRequired());
  Clues.grant();
  eq(Clues.daysOn(id), 0);
  eq(Clues.requiredFor(id), Clues.baseRequired(), "day one is not being stuck");
});

test("after cfg.clueStuckDays it eases by one a day, and never below one", () => {
  freshRun();
  const id = Clues.currentId();
  Clues.grant();                                  // stamps the day the episode started costing
  const base = Clues.baseRequired();
  state.day = 1 + cfg.clueStuckDays;
  eq(Clues.requiredFor(id), base, "the valve opens after the grace period, not during it");
  state.day = 1 + cfg.clueStuckDays + 1;
  eq(Clues.requiredFor(id), base - 1);
  state.day = 1 + cfg.clueStuckDays + 99;
  eq(Clues.requiredFor(id), 1, "it can ease the requirement, never remove it");
});

test("the clock only starts once a clue has actually landed for that episode", () => {
  freshRun();
  const id = Clues.currentId();
  state.day = 500;
  eq(Clues.daysOn(id), 0, "a player who has just arrived has not been unlucky");
  eq(Clues.requiredFor(id), Clues.baseRequired());
});

test("the requirement steps between Seasons but is fixed within one", () => {
  freshRun();
  const saved = cfg.clueSeasonStep;
  try {
    cfg.clueSeasonStep = 1;
    state.season = 0;
    eq(Clues.baseRequired(), cfg.cluesPerEpisode);
    state.season = 2;
    eq(Clues.baseRequired(), cfg.cluesPerEpisode + 2, "GDD §6.2 — stepped, not a curve");
  } finally { cfg.clueSeasonStep = saved; state.season = 0; }
});

test("the requirement can never exceed what an episode actually authors", () => {
  freshRun();
  const saved = cfg.cluesPerEpisode;
  try {
    cfg.cluesPerEpisode = 999;
    Episodes.ids().forEach(id =>
      ok(Clues.requiredFor(id) <= Clues.authoredFor(id).length,
         `${id} would be unlockable only in theory`));
  } finally { cfg.cluesPerEpisode = saved; }
});
