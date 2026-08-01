"use strict";
/* clues.js — the album. Ownership is DERIVED from state.clues, so these mostly pin that:
   there is no album state to get out of step with the counter. */

suite("clues: the album");

test("the album's size comes from the economy model, not from how much content exists", () => {
  freshRun();
  eq(Clues.total(), cfg.clueAlbumSize);
  ok(Clues.total() > CLUE_SETS.length * Clues.setSize(),
     "the shipped album is larger than the authored sets — the rest are placeholders");
});

test("ownership is the first N slots, straight off state.clues", () => {
  freshRun();
  eq(Clues.collected(), 0);
  ok(!Clues.has(0));
  state.clues = 3;
  eq(Clues.collected(), 3);
  ok(Clues.has(0) && Clues.has(2), "the first three are owned");
  ok(!Clues.has(3), "and the fourth is not");
});

test("collected never exceeds the album, however many clues were banked", () => {
  freshRun();
  state.clues = cfg.clueAlbumSize + 5000;
  eq(Clues.collected(), Clues.total());
  ok(Clues.has(Clues.total() - 1));
  ok(!Clues.has(Clues.total()), "there is no slot past the end");
});

test("a negative or fractional counter cannot break the album", () => {
  freshRun();
  state.clues = -4;   eq(Clues.collected(), 0);
  state.clues = 2.7;  eq(Clues.collected(), 2, "a partial clue is not a clue");
});

test("set progress adds up to the album, and the final set reports honestly", () => {
  freshRun();
  const sets = Clues.sets();
  const sum = sets.reduce((a, s) => a + Clues.setProgress(s)[1], 0);
  eq(sum, Clues.total(), "every slot belongs to exactly one set");
  const last = sets[sets.length - 1];
  ok(Clues.setProgress(last)[1] <= Clues.setSize(), "a short final set is not padded");
});

test("a set completes exactly when its last slot is collected", () => {
  freshRun();
  const size = Clues.setSize();
  state.clues = size - 1;
  ok(!Clues.setComplete(0), "one short is not complete");
  deepEq(Clues.setProgress(0), [size - 1, size]);
  state.clues = size;
  ok(Clues.setComplete(0));
  ok(!Clues.setComplete(1), "and the next set has not started");
});

test("every slot has a name — authored where content exists, numbered where it does not", () => {
  freshRun();
  eq(Clues.nameOf(0), CLUE_SETS[0].clues[0], "authored content is used verbatim");
  const past = CLUE_SETS.length * Clues.setSize();
  ok(/^Clue #\d{3}$/.test(Clues.nameOf(past)),
     "a slot past the authored sets falls back to a numbered placeholder, never blank");
  for (let i = 0; i < Clues.total(); i += 37) ok(Clues.nameOf(i), `slot ${i} has a name`);
});

test("every set has a heading, past the authored ones too", () => {
  freshRun();
  eq(Clues.setMeta(0).name, CLUE_SETS[0].name);
  const meta = Clues.setMeta(CLUE_SETS.length + 3);
  ok(meta.name && meta.icon, "an unauthored set still gets a heading rather than a blank");
});

test("the album is a view, not state — reading it never mutates the run", () => {
  freshRun();
  state.clues = 7;
  const before = JSON.stringify(serializeState());
  Clues.sets().forEach(s => { Clues.setProgress(s); Clues.setComplete(s); Clues.setMeta(s); });
  for (let i = 0; i < 20; i++) { Clues.has(i); Clues.nameOf(i); }
  eq(JSON.stringify(serializeState()), before, "no album state exists to be written");
});

test("the album survives a save/load with nothing of its own persisted", () => {
  freshRun();
  state.clues = 12;
  saveState();
  freshRun();
  loadState();
  eq(Clues.collected(), 12, "derived from the clue counter, which is what is actually stored");
});
