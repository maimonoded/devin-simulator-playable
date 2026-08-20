"use strict";
/* js/tickets.js — the ticket row, and the episode-unlock rules it inherited.

   Much of this is ported from the builders suite it replaces, because the rules are the same
   rules: the row is derived rather than stored, and firstUnwatchedId falls back to the queue. Two
   rules are NOT inherited — a row clears only when its episodes have been WATCHED rather than
   merely filled (the pull-stop, and the only stop condition in the game), and a placeholder now
   earns ITS OWN episode rather than the front of the story, because one lead collects into each
   and out-of-order filling is the normal case. */

/* Fill a placeholder outright, skipping award()'s routing — but still QUEUEING the episode, the
   way award() does on the transition into full. Without that this helper builds a state award()
   cannot produce: a full slot whose episode was never unlocked, which isWatched() then reads as
   watched (an episode never queued has trivially left the queue) and the row advances over it. */
function fill(i) { state.tickets[i] = Tickets.perEpisode(); Tickets.completeEpisode(i); }
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

test("the row is one placeholder per lead, derived from the cast and not stored", () => {
  freshRun();
  cfg.episodesInSeries = 12; Tickets.reshape();   // row size is Shoe.jokerTypes()
  eq(Tickets.rowSize(), Shoe.jokerTypes(), "one episode per joker, never a config key");
  deepEq(Tickets.pageSlots(), Shoe.JOKERS.map((_, k) => k));
  eq(Tickets.page(), 0);
  resetCfg();
});

test("filling out of order can never skip a row", () => {
  freshRun();
  cfg.episodesInSeries = 12; Tickets.reshape();   // row size is Shoe.jokerTypes()
  fill(7); fill(9);                       // later rows finished first
  eq(Tickets.page(), 0, "the row with work left is still the one on screen");
  resetCfg();
});

/* The new rule, and the reason the row exists at all. */
test("a full row does NOT clear until every episode on it has been watched", () => {
  freshRun();
  cfg.episodesInSeries = 12; Tickets.reshape();   // row size is Shoe.jokerTypes()
  const N = Tickets.rowSize();
  for (let i = 0; i < N; i++) fill(i);
  ok(Tickets.rowFull(), "full");
  eq(Tickets.page(), 0, "but still the current row");
  for (let i = 0; i < N - 1; i++) watch(i);
  eq(Tickets.page(), 0, "all but one watched is not enough");
  watch(N - 1);
  eq(Tickets.page(), 1, "the last one clears it");
  resetCfg();
});

/* Ducking out mid-episode must not advance the row, or a sealed bet would be a way past it. */
test("a sealed but unwatched bet counts as not yet watched", () => {
  freshRun();
  cfg.episodesInSeries = 12; Tickets.reshape();   // row size is Shoe.jokerTypes()
  for (let i = 0; i < Tickets.rowSize(); i++) fill(i);
  state.epQueue = [];
  state.pendingReveal = { id: Tickets.idAt(2), wager: 10, odds: 2, won: true, payout: 20 };
  eq(Tickets.page(), 0, "the row is held by the outstanding reveal");
  state.pendingReveal = null;
  eq(Tickets.page(), 1);
  resetCfg();
});

test("rowFull is the pull-stop, and is false one ticket short", () => {
  freshRun();
  cfg.episodesInSeries = 12; Tickets.reshape();   // row size is Shoe.jokerTypes()
  const N = Tickets.rowSize(), last = N - 1;
  for (let i = 0; i < last; i++) fill(i);
  state.tickets[last] = Tickets.perEpisode() - 1;
  ok(!Tickets.rowFull(), "one ticket short still allows a pull");
  Tickets.award(1, last);            // that lead's own joker
  ok(Tickets.rowFull(), "a full row stops it");
  resetCfg();
});

/* A ticket that arrives with the row full must neither jump the wall into the next row's
   episodes nor be thrown away — a ticket can be bought with real money. */
test("tickets earned while the row is full are banked, not lost and not spilled", () => {
  freshRun();
  cfg.episodesInSeries = 12; Tickets.reshape();   // row size is Shoe.jokerTypes()
  const N = Tickets.rowSize();
  for (let i = 0; i < N; i++) fill(i);
  const r = Tickets.award(3, 0);                 // three of the FIRST lead, nowhere to go
  eq(r.banked, 3, "banked");
  eq(Tickets.held(N), 0, "and did not spill into the next row");
  for (let i = 0; i < N; i++) watch(i);
  Tickets._drainPending();
  /* THE BANK KEEPS THE TYPE. These were lead 0's jokers, so they land on the next row's lead-0
     placeholder — not wherever happened to be emptiest. A bare count could not have said so. */
  eq(Tickets.held(N), 3, "they land on their own lead's placeholder once the row advances");
  eq(Tickets.bankedCount(), 0);
  resetCfg();
});

/* seriesShape clamps a series to the content that exists, so the last row is genuinely short. */
test("a short final row returns fewer than rowSize and is not padded", () => {
  freshRun();
  /* A series that is NOT a whole number of rows — the last one is genuinely short, and some
     leads then have no placeholder on it at all. Sized off the cast so it stays short whatever
     the cast becomes. */
  const N = Tickets.rowSize();
  cfg.episodesInSeries = N + 2; Tickets.reshape();
  for (let i = 0; i < N; i++) fill(i);
  for (let i = 0; i < N; i++) watch(i);
  eq(Tickets.page(), 1);
  eq(Tickets.pageSlots().length, 2, "two placeholders, not a padded row");
  deepEq(Tickets.pageSlots(), [N, N + 1]);
  resetCfg();
});

/* There is no cfg.episodeRowSize any more — the row is the cast. What still has to hold is the
   degenerate shape: a series SHORTER than one row is one short row, not a negative one. */
test("a series shorter than one row still yields exactly one short row", () => {
  freshRun();
  cfg.episodesInSeries = Math.max(1, Tickets.rowSize() - 1); Tickets.reshape();
  eq(Tickets.rowCount(), 1);
  eq(Tickets.pageSlots().length, Tickets.count());
  eq(Tickets.page(), 0);
  resetCfg();
});

suite("tickets: episodes");

/* THE RULE THAT CHANGED. Episodes used to come off the FRONT of the story whatever order slots
   filled, because slots only ever filled left to right and "front of the story" and "this slot's
   episode" were the same answer. Type routing makes out-of-order filling normal and the two come
   apart, so a slot now IS its episode — and the ordering it used to get for free is an explicit
   gate instead. See watchableAt. */
test("a placeholder earns ITS OWN episode, not the front of the story", () => {
  freshRun();
  fill(2);                                       // queues its episode, the way award() does
  deepEq(state.epQueue, [Tickets.idAt(2)], "the third placeholder earns the third episode");
  ok(Tickets.idAt(2) !== Episodes.idForBuilder(0), "and NOT the front of the story");
  eq(Tickets.completeEpisode(2), null, "queueing it twice is refused, or isWatched would flap");
});

/* The silent one. isWatched asks whether a slot's episode has left the unwatched queue, and an
   episode that was never unlocked has trivially left it — so without the isFull guard an EMPTY
   slot reads as watched and page() walks the row forward over content nobody has seen. */
test("an unfilled placeholder is never 'watched', however empty the queue is", () => {
  freshRun();
  state.epQueue = [];
  ok(!Tickets.isWatched(0), "nothing collected, nothing watched");
  ok(!Tickets.isWatched(1));
  eq(Tickets.page(), 0, "and the row does not advance past unseen episodes");
});

/* The ordering the old front-of-story rule used to give away for free. */
test("an episode is not watchable until the ones before it on the row are watched", () => {
  freshRun();
  fill(2);
  ok(Tickets.isFull(2), "collected");
  ok(!Tickets.watchableAt(2), "but episodes 1 and 2 are not done, so it cannot be watched");
  fill(0); fill(1);
  ok(Tickets.watchableAt(0), "the first is always watchable once complete");
  ok(!Tickets.watchableAt(1), "the second waits on the first being WATCHED, not just full");
  watch(0);
  ok(Tickets.watchableAt(1));
  watch(1);
  ok(Tickets.watchableAt(2), "and now the third");
  eq(Tickets.nextWatchableId(), Tickets.idAt(2), "which is what firstUnwatchedId offers");
});

/* The number the library's Watch button carries. It is NOT the queue length, which is what the
   🎬 badge shows: an episode whose predecessor on the row is still being collected is waiting,
   not available, and counting it promises a binge the ordering gate then refuses. */
test("bingeableCount stops at the first placeholder that is not full", () => {
  freshRun();
  eq(Tickets.bingeableCount(), 0, "nothing collected, nothing to watch");
  fill(2);
  eq(Tickets.bingeableCount(), 0, "complete, but nothing before it is — so it cannot start");
  fill(0);
  eq(Tickets.bingeableCount(), 1, "only the first: the second is still a gap in the run");
  fill(1);
  eq(Tickets.bingeableCount(), 3, "the gap closes and all three play back to back");
  watch(0);
  eq(Tickets.bingeableCount(), 2, "a watched one stops counting without stopping the walk");
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
