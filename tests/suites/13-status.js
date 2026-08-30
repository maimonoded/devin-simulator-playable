"use strict";
/* status.js — the player's standing as a LEVEL that resets every Season (GDD §5).

   The thing worth pinning down is that nothing here is stored except a baseline. A test that
   only checked "points go up" would pass against a counter, and the counter is exactly what the
   design refuses: every inflow is already written down somewhere else, and a second copy would
   drift the moment anything touched one and not the other. */

suite("status: the four inflows");

test("status starts at zero and every inflow moves it", () => {
  freshRun();
  eq(Status.points(), 0);
  /* 1 · watching */
  state.epsWatched = 3;
  eq(Status.points(), 3 * cfg.statusPerEpisode);
  /* 2 · calling it right */
  state.predWins = 2;
  eq(Status.points(), 3 * cfg.statusPerEpisode + 2 * cfg.statusPerPrediction);
  /* 3 · converting a card — the THIRD copy, not the first */
  const id = Cards.all()[0].id, r = Cards.rarityOf(id);
  const first = Cards.firstCopyStatus(r);
  Cards.add(id, 2);
  /* Holding it pays the first-copy value, once. That is not the Collectible — conversion still
     is — and this checks the two are counted separately rather than the second copy silently
     converting anything. */
  eq(Status.points(), 3 * cfg.statusPerEpisode + 2 * cfg.statusPerPrediction + first,
     "two copies is progress, not a Collectible");
  Cards.add(id, 1);
  /* The third copy converts. The first-copy value does NOT go away when it does — you still
     hold the card — so the two stack. */
  eq(Status.points(),
     3 * cfg.statusPerEpisode + 2 * cfg.statusPerPrediction + first + r.status);
  /* 4 · the Showcase */
  const item = Status.item("mug");
  Status.grant("mug", "found");
  eq(Status.points(),
     3 * cfg.statusPerEpisode + 2 * cfg.statusPerPrediction + first + r.status + item.points);
});

test("completing a set pays too, through the collection", () => {
  freshRun();
  const set = Cards.sets()[0];
  set.cards.forEach(c => Cards.add(c.id, 1));
  const before = Status.points();
  Cards.claimSet(set.key);
  eq(Status.points(), before + cfg.setBonusStatus);
});

test("the breakdown adds up to the points, so the drawer cannot lie", () => {
  freshRun();
  state.epsWatched = 4; state.predWins = 3;
  Cards.add(Cards.all()[0].id, 3);
  Status.grant("mug", "found");
  const sum = Status.breakdown().reduce((a, r) => a + r.points, 0);
  eq(sum, Status.points());
  eq(Status.breakdown().length, 4, "GDD §5.1 names four");
});

test("nothing is stored — editing the sources moves the score", () => {
  freshRun();
  ok(typeof state.statusPoints === "undefined", "a second copy of the score must not exist");
  state.epsWatched = 10;
  const a = Status.points();
  state.epsWatched = 20;
  ok(Status.points() > a, "derived, so it follows its sources without being told");
});

suite("status: the level");

test("the curve is the economy model's, and the gate is its last threshold", () => {
  freshRun();
  eq(Status.maxLevel(), cfg.statusLevels);
  eq(Status.curve().length, cfg.statusLevels);
  eq(Status.curve()[0], 0, "level 1 is free — everyone starts there");
  eq(Status.levelAt(Status.maxLevel()), Economy.statusGate());
  eq(Economy.statusGate(), cfg.statusTotal, "the TOTAL is the authoritative knob (§5.4)");
});

test("levels get dearer, never cheaper", () => {
  for (let n = 2; n < Status.maxLevel(); n++)
    ok(Economy.statusCostOf(n) >= Economy.statusCostOf(n - 1), `level ${n} is cheaper than ${n - 1}`);
  ok(Economy.statusCostOf(1) === cfg.statusFirst);
});

test("the level is read off the points, and the top one holds", () => {
  freshRun();
  eq(Status.level(0), 1);
  eq(Status.level(Status.levelAt(2)), 2, "landing exactly on a threshold is the new level");
  eq(Status.level(Status.levelAt(2) - 1), 1);
  eq(Status.level(Economy.statusGate()), Status.maxLevel());
  eq(Status.level(Economy.statusGate() * 5), Status.maxLevel(), "there is nothing above the top");
});

test("progress reads through the level, and the top level reads as full", () => {
  freshRun();
  eq(Status.levelProgress(0), 0);
  /* The tolerance is DERIVED from the span, not a flat 0.02. Points are whole numbers, so
     rounding the midpoint of a span moves the fraction by up to half a point — on a 25-point
     opening climb that is 0.02 on its own, and a fixed tolerance turns a correct curve into a
     failing test the moment the curve is retuned. */
  const lo = Status.levelAt(1), hi = Status.levelAt(2), span = Math.max(1, hi - lo);
  const mid = Math.round((lo + hi) / 2);
  near(Status.levelProgress(mid), 0.5, 0.5 / span + 1e-9);
  eq(Status.levelProgress(Economy.statusGate()), 1,
     "the top reads as full, not as a fraction of a span that does not exist");
  eq(Status.toNextLevel(Economy.statusGate()), 0);
});

test("the bands are five levels apart and named", () => {
  deepEq(Status.validate(), []);
  eq(Status.rank(0).name, STATUS_RANKS[0].name);
  eq(STATUS_RANKS[0].from, 1, "a player at level 1 still has a standing");
  const second = STATUS_RANKS[1];
  eq(Status.rank(Status.levelAt(second.from)).name, second.name);
  eq(Status.rank(Status.levelAt(second.from) - 1).name, STATUS_RANKS[0].name);
  eq(Status.nextRank(Economy.statusGate()), null, "there is nothing above the last band");
});

suite("status: milestones");

test("a milestone pays once, when its level is reached", () => {
  freshRun();
  const m = Status.milestones()[0];
  deepEq(Status.pendingMilestones(), [], "nothing is owed at level 1");
  state.epsWatched = 100000;                       // straight past it
  ok(Status.level() >= m.level);
  ok(Status.pendingMilestones().some(x => x.level === m.level));
  const paid = Status.claimMilestone(m.level);
  ok(paid, "the milestone was owed");
  ok(Status.milestoneClaimed(m.level));
  eq(Status.claimMilestone(m.level), null, "and only once");
});

test("a clue cache actually advances the story", () => {
  freshRun();
  const m = Status.milestones().find(x => x.kind === "clues");
  state.epsWatched = 100000;
  const before = Clues.total();
  const paid = Status.claimMilestone(m.level);
  eq(paid.clues.length, m.amount);
  eq(Clues.total(), before + paid.clues.filter(c => c.isNew).length);
  ok(paid.clues.every(c => Episodes.has(c.id)), "and it lands on a real episode");
});

test("an energy milestone tops up without draining an overflow", () => {
  freshRun();
  const m = Status.milestones().find(x => x.kind === "energy");
  state.epsWatched = 100000;
  state.energy = 900;                              // bought, far over the cap
  Status.claimMilestone(m.level);
  eq(state.energy, 900, "a milestone must never clamp a purchased balance downward");
});

test("the sweep is idempotent and pays everything owed in level order", () => {
  freshRun();
  state.epsWatched = 100000;
  const paid = Status.milestoneSweep();
  ok(paid.length > 1, "reaching the top owes every milestone below it");
  deepEq(paid.map(p => p.milestone.level), paid.map(p => p.milestone.level).slice().sort((a, b) => a - b));
  deepEq(Status.milestoneSweep(), [], "and a second sweep owes nothing");
});

suite("status: the Season");

test("the Season gate is the top level, and there is one Season today", () => {
  freshRun();
  eq(Status.seasonReady(), false);
  state.epsWatched = 100000;
  ok(Status.seasonReady());
  eq(Status.hasNextSeason(), false, "only Season 1 is authored");
  eq(Status.advanceSeason(), null, "so the gate holds rather than rolling over to nothing");
});

test("a Season turn moves the baseline and DELETES nothing", () => {
  freshRun();
  /* Stand in a second Season so the turn is allowed at all. */
  BOARD_SEASONS.push({ season: 2, name: "Season Two", tiles: BOARD_SEASONS[0].tiles.slice() });
  CARD_SEASONS.push({ season: 2, name: "Season Two", art: "x/", sets: CARD_SEASONS[0].sets.slice(0, 1) });
  try {
    Cards.add(Cards.all()[0].id, 3);
    state.epsWatched = 100000; state.predWins = 7;
    Status.milestoneSweep();
    const lifetime = Status.lifetime(), cards = Cards.owned(), wins = state.predWins;
    ok(Status.seasonReady());
    const next = Status.advanceSeason();
    ok(next, "a Season with content behind it turns over");
    eq(state.season, 1);
    eq(Status.points(), 0, "Status reads as zero…");
    eq(Status.lifetime(), lifetime, "…because the line moved, not because anything was deleted");
    eq(Cards.owned(), cards, "the collection persists (§5.3)");
    eq(state.predWins, wins, "and so does the lifetime prediction record");
    deepEq(state.statusMilestones, {}, "the Season's milestones are owed again");
  } finally {
    BOARD_SEASONS.pop(); CARD_SEASONS.pop(); state.season = 0;
  }
});

suite("status: the Showcase");

test("every item is both buyable and earnable — that is the design, not a variant", () => {
  STATUS_ITEMS.forEach(i => {
    ok(i.price > 0, `${i.id} has no coin price`);
    ok(i.earn && Object.keys(i.earn).length === 1, `${i.id} has no play milestone`);
    ok(i.points > 0, `${i.id} is worth nothing`);
  });
});

test("buying spends the coins once and refuses when it cannot", () => {
  freshRun();
  const item = Status.item("mug"), price = Status.priceOf(item);
  state.coins = price - 1;
  eq(Status.buy("mug"), null, "one coin short is short");
  state.coins = price;
  const r = Status.buy("mug");
  ok(r); eq(r.cost, price); eq(state.coins, 0);
  ok(Status.owns("mug"));
  eq(Status.howGot("mug"), "bought");
  eq(Status.buy("mug"), null, "and it cannot be bought twice");
});

test("statusPriceScale moves every price at once", () => {
  freshRun();
  const base = Status.priceOf(Status.item("mug"));
  cfg.statusPriceScale = 2;
  eq(Status.priceOf(Status.item("mug")), base * 2);
  cfg.statusPriceScale = 1;
});

test("sweep grants what the play milestones have earned, and only once", () => {
  freshRun();
  eq(Status.sweep().length, 0, "nothing is owed at the start");
  state.epsWatched = 1;                        // ticket-framed wants one episode
  const got = Status.sweep();
  ok(got.some(i => i.id === "ticket-framed"));
  eq(Status.howGot("ticket-framed"), "earned");
  eq(Status.sweep().filter(i => i.id === "ticket-framed").length, 0, "not granted twice");
});

test("drawUnowned only ever offers something missing", () => {
  freshRun();
  const first = Status.drawUnowned();
  ok(first && !Status.owns(first.id));
  STATUS_ITEMS.forEach(i => Status.grant(i.id, "found"));
  eq(Status.drawUnowned(), null, "a full shelf has nothing left to give");
});

test("validate catches a band outside the Season and a milestone that pays nothing", () => {
  const realFrom = STATUS_RANKS[1].from, realKind = STATUS_MILESTONES[0].kind;
  try {
    STATUS_RANKS[1].from = 999;
    STATUS_MILESTONES[0].kind = "wishes";
    const errs = Status.validate();
    ok(errs.some(e => /past the Season/.test(e)), "the unreachable band");
    ok(errs.some(e => /which is not a thing/.test(e)), "the impossible milestone");
  } finally { STATUS_RANKS[1].from = realFrom; STATUS_MILESTONES[0].kind = realKind; }
});

/* ---- the earn condition, in English -------------------------------------------------------
   Every surface that shows a status item owes the player an explanation of why they have it,
   or how they would get it. The condition is a {cards:5} object, so without this each caller
   invents its own phrasing and they drift. */
test("earnWords turns a condition into a sentence, with the plural right", () => {
  const w = i => Status.earnWords(i);
  eq(w({ earn: { cards: 5 } }), "5 cards collected");
  eq(w({ earn: { cards: 1 } }), "1 card collected", "not '1 cards'");
  eq(w({ earn: { episodes: 1 } }), "1 episode watched");
  eq(w({ earn: { episodes: 3 } }), "3 episodes watched");
  eq(w({ earn: { boards: 1 } }), "1 set finished", "singular agrees with the requirement");
  eq(w({ earn: { boards: 2 } }), "2 sets finished");
  eq(w({ earn: { rolls: 60 } }), "60 rolls");
  eq(w({}), "", "an item with no condition says nothing rather than something wrong");
  eq(w(null), "");
});

test("the deed and the unit come from ONE table and cannot drift", () => {
  /* The reward beat says what you DID; the profile's locked slot counts the UNIT. Same
     condition, two shapes — and they lived in two separate tables that had already drifted to
     "collecting" vs "collected" for the same mug. Both now key off Status.EARN. */
  const mug = { earn: { cards: 5 } };
  eq(Status.earnWords(mug), "5 cards collected", "the whole threshold");
  eq(Status.earnUnit(mug), "cards collected", "the unit, for counting progress");
  eq(Status.earnKey(mug), "cards");
  /* Every key that produces a deed must also produce a unit, or one screen goes blank. */
  Object.keys(Status.EARN).forEach(k => {
    const fake = { earn: { [k]: 2 } };
    ok(Status.earnWords(fake).length > 2, `${k} has no deed`);
    ok(Status.earnUnit(fake).length > 2, `${k} has no unit`);
  });
  eq(Status.earnUnit({}), "", "no condition, no unit — not a broken string");
});

test("every shipped item can explain itself", () => {
  /* A new item with an unhandled condition key would fall through to a raw "{n} {key}" — which
     is legible but not English. This catches one being added without a phrasing. */
  const known = ["cards", "episodes", "rolls", "boards"];
  Status.items().forEach(i => {
    const key = Object.keys(i.earn || {})[0];
    ok(key, `${i.id} has no earn condition`);
    ok(Status.EARN[key], `${i.id} earns on "${key}", which Status.EARN has no phrasing for`);
    ok(Status.earnWords(i).length > 3, `${i.id} produced no words`);
  });
});
