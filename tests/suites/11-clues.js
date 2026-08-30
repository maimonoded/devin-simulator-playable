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

suite("clues: the unlock reaches the queue");

/* Land repeatedly on the first tile that draws from `pool`, with only clue rows live, until
   `done()` or the attempts run out. Returns every event produced. */
function landClues(pool, done, cap) {
  let i = 0;
  for (; i < boardSize(); i++) if (tilePool(i) === pool) break;
  const type = tileType(i), tile = TILE_TYPES[type];
  const seen = [];
  forcePool(pool, r => r.kind === "clue", () => {
    for (let k = 0; k < (cap || 300); k++) {
      seen.push(...tile.onLand({ pos: i, mult: 1, bs: cfg.boardScale }));
      if (done()) return;
    }
  });
  return seen;
}

/* THE BUG THIS PINS was silent and total, which is why it gets four assertions rather than one.

   "Unlocked" is derived from the clues. "Watched" is derived as UNLOCKED MINUS state.epQueue
   (Collection.watchedIds), and only Collection.claimUnlocked pushes onto that queue. So a clue
   row that completed an episode's four WITHOUT claiming did not merely fail to announce it —
   the episode became unlocked and instantly read as ALREADY WATCHED. firstUnwatchedId() went
   null, the 🎬 button never lit, and blockedBy() named the NEXT episode, which was not unlocked
   at all. The story ate an episode per unlock, and nothing threw.

   Clues are the primary unlock route (§6.1), so this was most of the game. */
test("a clue row that completes an episode QUEUES it, rather than skipping past it", () => {
  freshRun();
  const ep = Episodes.ids()[0];
  landClues("clue", () => Collection.unlockedEpisodeIds().includes(ep));

  ok(Collection.unlockedEpisodeIds().includes(ep), "clue rows unlock the first episode");
  ok(state.epQueue.includes(ep), "it is WAITING to be watched, not silently past");
  eq(Collection.watchedIds().includes(ep), false, "and nobody has watched it");
  eq(Collection.firstUnwatchedId(), ep, "so it is the one the player may watch now");
});

test("the unlock is ANNOUNCED — the landing returns an {unlock} event to play", () => {
  /* The queue and the beat are the same claim. A version that pushed but returned nothing would
     pass the test above and still leave the player with an episode arriving from nowhere. */
  freshRun();
  const ep = Episodes.ids()[0];
  const ev = landClues("clue", () => Collection.unlockedEpisodeIds().includes(ep));
  const unlock = ev.find(e => e.unlock);
  ok(unlock, "the clue landing that completes an episode returns {unlock}");
  ok(unlock.unlock.ids.includes(ep), "naming the episode it just bought");
});

test("a clue landing that unlocks NOTHING announces nothing", () => {
  /* The other half: bankedEvents runs on every clue row now, and a snapshot compared against
     itself must stay quiet. An {unlock} with an empty id list would block the roll loop on a
     popup about no episodes. */
  freshRun();
  const ev = landClues("clue", () => false, 1);
  eq(ev.filter(e => e.unlock).length, 0, "one clue, four short of an episode, says nothing");
});

suite("clues: a clue is a card, and it looks like one");

/* THE FACE EXISTED AND NOTHING CALLED IT. .fam-clue in css/collection.css and the clue branch of
   dropFace() in js/ui/cardface.js draw a contact sheet with the case photograph and the sentence
   typed on a slip — and CLAUDE.md ranks that family FIRST of the three, because four of them buy
   the next episode. A clue out of a BOX got that face. The same clue on a TILE, which is how most
   of them arrive, got a float and a log line — and ?view=mobile hides the log, so on a phone it
   arrived with no presentation whatsoever. */
test("a NEW clue landed on a tile returns a card beat, carrying a drop the face can draw", () => {
  freshRun();
  const ev = landClues("clue", () => true, 1);
  const beat = ev.find(e => e.card);
  ok(beat, "a new clue produces a {card} beat, like every other card does");
  const d = beat.card.drop;
  ok(d, "and it carries a drop rather than a generic panel");
  eq(d.kind, "clue");
  ok(Episodes.has(d.ep), "naming the episode it was filed against");
  ok(d.clue && typeof d.clue.text === "string" && d.clue.text.length > 0, "and the clue itself");
  eq(d.isNew, true);
});

test("all THREE routes build the same drop — one face wherever you meet a clue", () => {
  /* This is the actual guarantee. Three things hand dropFace() a clue: a box paying one, a tile
     landing on a clue row, and the evidence board on the wager screen. If their shapes drift,
     the same clue looks like different objects depending on where you met it — which is the one
     thing a collection cannot do. Clues.dropFor() is the single builder; this pins that. */
  freshRun();
  const tileDrop = landClues("clue", () => true, 1).find(e => e.card).card.drop;
  freshRun();
  let boxDrop = null;
  for (let i = 0; i < 300 && !boxDrop; i++)
    boxDrop = Boxes.open("insider").drops.find(d => d.kind === "clue") || null;
  ok(boxDrop, "a box eventually pays a clue");
  const ep = Episodes.ids()[0];
  const evidenceDrop = Clues.dropFor(ep, Clues.authoredFor(ep)[0]);
  const shape = d => Object.keys(d).sort().join(",");
  eq(shape(tileDrop), shape(boxDrop), "tile and box agree");
  eq(shape(evidenceDrop), shape(boxDrop), "and so does the wager screen's evidence board");
});

test("a held clue renders as its SENTENCE, not as a duplicate's coin value", () => {
  /* dropFace keys on isNew to choose between printing the clue text and printing "You knew that
     one" over a coin badge. Evidence being re-read on the wager screen is neither a fresh drop
     nor a duplicate — it is a clue you own and are looking at again — so dropFor defaults to the
     face that shows the words. Getting this backwards would make the evidence board, whose
     entire job is to be read before betting, print the same four non-sentences every time. */
  const ep = Episodes.ids()[0], clue = Clues.authoredFor(ep)[0];
  const d = Clues.dropFor(ep, clue);
  eq(d.kind, "clue");
  eq(d.ep, ep);
  eq(d.clue, clue);
  eq(d.isNew, true, "so the face prints the sentence");
  eq(d.coins, 0, "and there is no duplicate payout to announce");
  eq(Clues.dropFor(ep, clue, { isNew: false, coins: 40 }).isNew, false, "callers can still say otherwise");
  eq(Clues.dropFor(ep, clue, { isNew: false, coins: 40 }).coins, 40);
});

test("a DUPLICATE clue gets no card beat — it pays coins and the board keeps moving", () => {
  /* Same three-way split drawCardEvents() uses. A duplicate must not cost the player the five
     seconds a new clue is worth, or the pacing collapses on a well-explored episode.

     Asserted as an INVARIANT over many landings rather than by staging one duplicate. Staging it
     is harder than it looks: filling an episode's clues UNLOCKS it, and Clues.grant() then moves
     to the next episode, so the repeat never happens. Landing repeatedly reproduces the real
     distribution — four distinct out of eight takes about five draws, so repeats are common. */
  freshRun();
  const before = state.coins;
  const ev = landClues("clue", () => false, 60);
  const beats = ev.filter(e => e.card);
  ok(beats.length > 0, "new clues did land");
  ok(beats.every(b => b.card.drop && b.card.drop.isNew === true),
     "every card held on screen is a clue the player did NOT already have");
  const dups = ev.filter(e => e.log && /you knew that one/.test(e.log.msg));
  ok(dups.length > 0, "and repeats did occur, which is what makes this test mean anything");
  eq(ev.filter(e => e.card && e.card.drop && !e.card.drop.isNew).length, 0,
     "not one of them was held on screen");
  ok(state.coins > before, "they converted to coins instead — GDD \u00a712's rule about variance");
});
