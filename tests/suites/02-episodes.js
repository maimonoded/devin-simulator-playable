"use strict";
/* episodes.js — the registry plus the real content files in episodes/ */

suite("episodes: content files");

test("every shipped episode is schema-valid", () => {
  ok(Episodes.count() >= 12, "expected at least 12 episodes, got " + Episodes.count());
  Episodes.ids().forEach(id => {
    const e = Episodes.get(id);
    eq(e.id, id, "id must match its key");
    ok(/^\d{3}$/.test(e.id), `${id}: id must be three digits`);
    ok(typeof e.title === "string" && e.title.length, `${id}: missing title`);
    ok(typeof e.question === "string" && e.question.length, `${id}: missing question`);
    ok(Array.isArray(e.answers) && e.answers.length >= 2, `${id}: needs 2+ answers`);
    e.answers.forEach((a, i) => {
      ok(typeof a.text === "string" && a.text.length, `${id}: answer ${i} has no text`);
      ok(typeof a.odds === "number" && a.odds > 1, `${id}: answer ${i} odds must be > 1`);
    });
    ok(Number.isInteger(e.correct) && e.correct >= 0 && e.correct < e.answers.length,
       `${id}: correct index out of range`);
  });
});

test("episode ids are contiguous from 001", () => {
  const ids = Episodes.ids();
  ids.forEach((id, i) => eq(id, String(i + 1).padStart(3, "0"), "gap in episode numbering"));
});

suite("episodes: registry");

test("get / has / count / ids", () => {
  ok(Episodes.has("001"));
  ok(!Episodes.has("999"));
  eq(Episodes.get("999"), null, "unknown id should be null, not undefined");
  eq(Episodes.get("001").id, "001");
  eq(Episodes.ids().length, Episodes.count());
});

test("id is the whole identity: builder number and video path derive from it", () => {
  eq(Episodes.builderOf("001"), 1);
  eq(Episodes.builderOf("012"), 12);
  eq(Episodes.videoFor("003"), "episodes/003.mp4");
  eq(Episodes.titleOf("001"), Episodes.get("001").title);
  eq(Episodes.titleOf("999"), "999", "unknown id falls back to the id itself");
});

test("idForBuilder maps builder index to its episode", () => {
  eq(Episodes.idForBuilder(0), "001");
  eq(Episodes.idForBuilder(6), "007");
  eq(Episodes.idForBuilder(11), "012");
});

test("builders past the last episode cycle instead of failing", () => {
  const n = Episodes.count();
  const id = Episodes.idForBuilder(n);          // one past the end
  ok(id !== null, "should not return null");
  ok(Episodes.has(id), "cycled id must exist");
  eq(Episodes.idForBuilder(n + 2), Episodes.ids()[(n + 2) % n]);
});

suite("episodes: difficulty");

test("declared difficulty is kept", () => {
  eq(Episodes.difficultyOf("001"), 4);
  eq(Episodes.difficultyOf("004"), 2);
  eq(Episodes.difficultyOf("003"), 5);
});

test("missing difficulty defaults to 1", () => {
  eq(Episodes.normalizeDifficulty(undefined), 1);
  eq(Episodes.normalizeDifficulty(null), 1);
  eq(Episodes.difficultyOf("999"), 1, "unknown episode still reports 1");
});

test("out-of-range and junk values are clamped or defaulted", () => {
  eq(Episodes.normalizeDifficulty(0), 1);
  eq(Episodes.normalizeDifficulty(-5), 1);
  eq(Episodes.normalizeDifficulty(99), 10);
  eq(Episodes.normalizeDifficulty("7"), 7, "numeric strings are accepted");
  eq(Episodes.normalizeDifficulty("abc"), 1);
  eq(Episodes.normalizeDifficulty(NaN), 1);
  eq(Episodes.normalizeDifficulty(Infinity), 1);
  eq(Episodes.normalizeDifficulty(6.5), 6.5, "fractions are preserved");
});

test("add normalises difficulty and re-adding replaces without duplicating", () => {
  const before = Episodes.count();
  Episodes.add({ id: "900", title: "T", question: "Q",
                 answers: [{ text: "a", odds: 2 }, { text: "b", odds: 2 }], correct: 0 });
  eq(Episodes.difficultyOf("900"), 1, "default applied on add");
  eq(Episodes.count(), before + 1);
  Episodes.add({ id: "900", title: "T2", question: "Q",
                 answers: [{ text: "a", odds: 2 }, { text: "b", odds: 2 }], correct: 0, difficulty: 20 });
  eq(Episodes.count(), before + 1, "re-adding the same id must not duplicate");
  eq(Episodes.titleOf("900"), "T2", "re-adding should replace");
  eq(Episodes.difficultyOf("900"), 10, "clamped on add");
  // clean up so later suites see the real content set
  delete Episodes._byId["900"];
  Episodes._ids.splice(Episodes._ids.indexOf("900"), 1);
  eq(Episodes.count(), before);
});

test("add ignores an entry with no id", () => {
  const before = Episodes.count();
  withQuietConsole(() => {          // it warns on purpose
    Episodes.add({ title: "no id" });
    Episodes.add(null);
  });
  eq(Episodes.count(), before);
});
