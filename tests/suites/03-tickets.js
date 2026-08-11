"use strict";
/* js/tickets.js — the ticket row, and the episode-unlock rules it inherited.

   Most of this is ported word for word from the builders suite it replaces, because the rules
   are the same rules: the row is derived rather than stored, episodes come off the FRONT of the
   story whatever order slots filled in, and firstUnwatchedId falls back to the queue. The one
   genuinely new rule is that a row clears only when its episodes have been WATCHED, not merely
   filled — that is the pull-stop, and it is now the only stop condition in the game. */

/* Fill a placeholder outright, without going through award()'s row rules. */
function fill(i) { state.tickets[i] = Tickets.perEpisode(); }
/* Mark an episode watched by taking it out of the unwatched queue. */
function watch(i) {
  const id = Tickets.idAt(i);
  const k = state.epQueue.indexOf(id);
  if (k >= 0) state.epQueue.splice(k, 1);
}

suite("tickets: shape");

test("a fresh series has one placeholder per episode, all empty", () => {
  freshRun();
  eq(Tickets.count(), cfg.episodesInSeries);
  eq(Tickets.all().length, cfg.episodesInSeries);
  eq(Tickets.doneCount(), 0);
});

test("an episode needs ticketsPerEpisode tickets", () => {
  freshRun();
  for (let k = 0; k < Tickets.perEpisode(); k++) {
    ok(!Tickets.isFull(0), `full after only ${k}`);
    Tickets.award(1);
  }
  ok(Tickets.isFull(0), "full on the last one");
  eq(Tickets.doneCount(), 1);
});

test("reshape keeps the progress that still fits", () => {
  freshRun();
  state.tickets[0] = 3; state.tickets[1] = 2;
  cfg.episodesInSeries = 3;
  Tickets.reshape();
  eq(Tickets.all().length, 3);
  eq(Tickets.held(0), 3, "kept");
  cfg.ticketsPerEpisode = 2;
  Tickets.reshape();
  eq(Tickets.held(0), 2, "clamped to the new cap");
  resetCfg();
});

suite("tickets: awarding");

test("tickets land on the lowest unfilled placeholder", () => {
  freshRun();
  Tickets.award(1);
  eq(Tickets.held(0), 1);
  eq(Tickets.held(1), 0, "the second is untouched until the first is full");
});

test("one award can spill across several placeholders", () => {
  freshRun();
  const per = Tickets.perEpisode();
  const r = Tickets.award(per + 2);
  eq(Tickets.held(0), per);
  eq(Tickets.held(1), 2);
  eq(r.episodeIds.length, 1, "one placeholder completed, so one episode unlocked");
});

/* Tickets are awarded from INSIDE playEvents() while a pull is still animating. The old
   Builders.upgrade() refused in exactly that state; porting that guard across would have made
   every ticket card silently do nothing. */
test("award works mid-animation — it must not inherit the old upgrade guard", () => {
  freshRun();
  state.animating = true;
  Tickets.award(1);
  eq(Tickets.held(0), 1, "a ticket earned mid-pull still lands");
  state.animating = false;
});

suite("tickets: the row");

test("the row is the first five placeholders and is derived, not stored", () => {
  freshRun();
  cfg.episodesInSeries = 12; cfg.episodeRowSize = 5; Tickets.reshape();
  deepEq(Tickets.pageSlots(), [0, 1, 2, 3, 4]);
  eq(Tickets.page(), 0);
  resetCfg();
});

test("filling out of order can never skip a row", () => {
  freshRun();
  cfg.episodesInSeries = 12; cfg.episodeRowSize = 5; Tickets.reshape();
  fill(7); fill(9);                       // later rows finished first
  eq(Tickets.page(), 0, "the row with work left is still the one on screen");
  resetCfg();
});

/* The new rule, and the reason the row exists at all. */
test("a full row does NOT clear until every episode on it has been watched", () => {
  freshRun();
  cfg.episodesInSeries = 12; cfg.episodeRowSize = 5; Tickets.reshape();
  for (let i = 0; i < 5; i++) { fill(i); state.epQueue.push(Tickets.idAt(i)); }
  ok(Tickets.rowFull(), "full");
  eq(Tickets.page(), 0, "but still the current row");
  for (let i = 0; i < 4; i++) watch(i);
  eq(Tickets.page(), 0, "four of five watched is not enough");
  watch(4);
  eq(Tickets.page(), 1, "the fifth clears it");
  resetCfg();
});

/* Ducking out mid-episode must not advance the row, or a sealed bet would be a way past it. */
test("a sealed but unwatched bet counts as not yet watched", () => {
  freshRun();
  cfg.episodesInSeries = 12; cfg.episodeRowSize = 5; Tickets.reshape();
  for (let i = 0; i < 5; i++) fill(i);
  state.epQueue = [];
  state.pendingReveal = { id: Tickets.idAt(2), wager: 10, odds: 2, won: true, payout: 20 };
  eq(Tickets.page(), 0, "the row is held by the outstanding reveal");
  state.pendingReveal = null;
  eq(Tickets.page(), 1);
  resetCfg();
});

test("rowFull is the pull-stop, and is false one ticket short", () => {
  freshRun();
  cfg.episodesInSeries = 12; cfg.episodeRowSize = 5; Tickets.reshape();
  for (let i = 0; i < 4; i++) fill(i);
  state.tickets[4] = Tickets.perEpisode() - 1;
  ok(!Tickets.rowFull(), "24 of 25 still allows a pull");
  Tickets.award(1);
  ok(Tickets.rowFull(), "25 of 25 stops it");
  resetCfg();
});

/* A ticket that arrives with the row full must neither jump the wall into the next row's
   episodes nor be thrown away — a ticket can be bought with real money. */
test("tickets earned while the row is full are banked, not lost and not spilled", () => {
  freshRun();
  cfg.episodesInSeries = 12; cfg.episodeRowSize = 5; Tickets.reshape();
  for (let i = 0; i < 5; i++) { fill(i); state.epQueue.push(Tickets.idAt(i)); }
  const r = Tickets.award(3);
  eq(r.banked, 3, "banked");
  eq(Tickets.held(5), 0, "and did not spill into the next row");
  for (let i = 0; i < 5; i++) watch(i);
  Tickets._drainPending();
  eq(Tickets.held(5), 3, "they land once the row advances");
  eq(state.pendingTickets, 0);
  resetCfg();
});

/* seriesShape clamps a series to the content that exists, so the last row is genuinely short. */
test("a short final row returns fewer than rowSize and is not padded", () => {
  freshRun();
  cfg.episodesInSeries = 12; cfg.episodeRowSize = 5; Tickets.reshape();
  for (let i = 0; i < 10; i++) { fill(i); state.epQueue.push(Tickets.idAt(i)); }
  for (let i = 0; i < 10; i++) watch(i);
  eq(Tickets.page(), 2);
  deepEq(Tickets.pageSlots(), [10, 11], "two placeholders, not five");
  resetCfg();
});

test("a row size larger than the series still yields one row", () => {
  freshRun();
  cfg.episodeRowSize = 50; Tickets.reshape();
  eq(Tickets.rowCount(), 1);
  eq(Tickets.pageSlots().length, Tickets.count());
  cfg.episodeRowSize = 0; Tickets.reshape();
  eq(Tickets.rowSize(), 1, "zero is floored to one rather than dividing by zero");
  resetCfg();
});

suite("tickets: episodes");

/* The rule that makes a serialised drama watchable. Completing the third placeholder first
   still earns episode 001 — the unlocked set is always a PREFIX of the story. */
test("episodes come off the front of the story, whatever order placeholders filled", () => {
  freshRun();
  fill(2);
  const id = Tickets.completeEpisode();
  eq(id, Episodes.idForBuilder(0), "the third placeholder still earns the first episode");
});

test("each completed placeholder queues the next episode in order", () => {
  freshRun();
  const per = Tickets.perEpisode();
  Tickets.award(per * 3);
  deepEq(state.epQueue, ["001", "002", "003"]);
});

test("the library is derived from the placeholders, so it survives a reload with no stored list", () => {
  freshRun();
  const per = Tickets.perEpisode();
  Tickets.award(per * 4);
  state.epQueue = ["004"];                       // three already watched
  deepEq(Tickets.unlockedEpisodeIds(), ["001", "002", "003", "004"],
         "all four are still in the library");
});

test("firstUnwatchedId walks album order, not queue order", () => {
  freshRun();
  const per = Tickets.perEpisode();
  Tickets.award(per * 3);
  state.epQueue = ["003", "001"];                // unlocked out of order
  eq(Tickets.firstUnwatchedId(), "001", "album order wins");
});

/* The only way an episode queued before a series change stays reachable. */
test("firstUnwatchedId falls back to the front of the queue", () => {
  freshRun();
  state.epQueue = ["005"];
  eq(Tickets.firstUnwatchedId(), "005");
  state.epQueue = [];
  eq(Tickets.firstUnwatchedId(), null);
});

test("filling every placeholder ends the series", () => {
  freshRun();
  cfg.episodesInSeries = 3; Tickets.reshape();
  const r = Tickets.award(3 * Tickets.perEpisode());
  ok(r.seriesDone);
  ok(state.seriesDone);
  eq(r.episodeIds.length, 3, "one episode per placeholder");
  resetCfg();
});

suite("tickets: pricing");

test("a placeholder's ticket is priced from its GLOBAL episode number", () => {
  freshRun();
  near(Tickets.cost(0, 0), Economy.costFor(Economy.globalEpisodeOf(0), 1), 1e-9);
  near(Tickets.cost(3, 2), Economy.costFor(Economy.globalEpisodeOf(3), 3), 1e-9);
});

test("nextCost is null once a placeholder is full", () => {
  freshRun();
  ok(Tickets.nextCost(0) > 0);
  fill(0);
  eq(Tickets.nextCost(0), null);
});
