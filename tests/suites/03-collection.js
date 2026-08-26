"use strict";
/* js/collection.js, js/boxes.js, js/status.js — the loop that replaced the builders. */

suite("collection: the board's shape");

test("board 1 is authored, consistent, and adds up to its pool", () => {
  freshRun();
  deepEq(Collection.validate(1), [], "the shipped board must not have a single problem in it");
  eq(Collection.pages(1).length, cfg.episodesPerBoard);
  eq(Collection.poolSize(1), cfg.episodesPerBoard * cfg.collectiblesPerEpisode);
});

test("the pool is derived from the requirements, not declared", () => {
  freshRun();
  const wanted = Collection.pages(1).flatMap(p => p.needs);
  const pool = Collection.pool(1);
  eq(pool.length, new Set(wanted).size, "the pool is the distinct union of what is wanted");
  pool.forEach(id => ok(wanted.includes(id), `${id} is in the pool but nothing wants it`));
});

test("every card in the pool resolves to real content", () => {
  freshRun();
  Collection.pool(1).forEach(id => {
    const c = Collection.cardOf(id, 1);
    ok(c, `${id} does not resolve`);
    ok(c.name && c.art, `${id} is missing a name or its art`);
  });
});

test("a card id round-trips through parse and idFor", () => {
  deepEq(Collection.parse("char:simon@gold"), { kind: "char", who: "simon", tier: "gold" });
  deepEq(Collection.parse("clue:sign"), { kind: "clue", who: "sign", tier: null });
  eq(Collection.idFor("char", "simon", "gold"), "char:simon@gold");
  eq(Collection.idFor("clue", "sign"), "clue:sign");
  eq(Collection.parse("nonsense"), null, "an id with no kind is not an id");
  eq(Collection.parse(""), null);
});

test("an id the board cannot explain resolves to null rather than throwing", () => {
  freshRun();
  eq(Collection.cardOf("char:nobody@gold", 1), null);
  eq(Collection.cardOf("char:simon@platinum", 1), null, "an unknown tier is not a card either");
  eq(Collection.cardOf("clue:nothing", 1), null);
});

test("clue cards carry no tier, character cards always do", () => {
  freshRun();
  Collection.pool(1).forEach(id => {
    const c = Collection.cardOf(id, 1);
    if (c.kind === "clue") eq(c.tier, null, `${id} is a clue and must not have a tier`);
    else ok(!!Collection.tier(c.tier), `${id} must name a real tier`);
  });
});

suite("collection: owning cards");

test("adding a card reports whether it was new, and counts duplicates", () => {
  freshRun();
  const id = Collection.pool()[0];
  const a = Collection.add(id, 1);
  eq(a.isNew, true); eq(a.count, 1);
  const b = Collection.add(id, 1);
  eq(b.isNew, false, "the second copy is not new");
  eq(b.count, 2, "but it is still counted");
  eq(Collection.countOf(id), 2);
  eq(Collection.collected(), 1, "distinct cards, not copies");
});

test("banking a card touches no clue and gates nothing", () => {
  freshRun();
  /* Cards stopped being the gate (GDD 6.1). Every card in the set can be in the album and not
     one episode is unlocked by it — which is the whole point of the split. */
  Collection.pool().forEach(id => Collection.add(id, 1));
  deepEq(state.clues, {}, "a card is not evidence");
  deepEq(Collection.unlockedEpisodeIds(), [], "and it unlocks nothing");
  eq(Collection.collected(), Collection.poolSize(), "the album still fills");
});

test("albums are per board — the same id on another board is a different card", () => {
  freshRun();
  const id = Collection.pool(1)[0];
  Collection.add(id, 1);
  ok(Collection.has(id, 1));
  eq(Collection.has(id, 2), false, "board 2's album starts empty whatever board 1 holds");
});

suite("collection: unlocking episodes");

test("a page reports its CLUE progress, and unlocks on the last one", () => {
  freshRun();
  const page = Collection.pages()[0];
  const need = Clues.requiredFor(page.ep);
  const cs = Clues.authoredFor(page.ep);
  state.clues[page.ep] = cs.slice(0, need - 1).map(c => c.id);
  eq(Collection.pageReady(page), false, `${need - 1} of ${need} is not an unlock`);
  deepEq(Collection.pageProgress(page), [need - 1, need]);
  state.clues[page.ep].push(cs[need - 1].id);
  ok(Collection.pageReady(page), "the last clue is the unlock");
  ok(Collection.unlockedEpisodeIds().includes(page.ep));
});

test("claimUnlocked queues only what is newly unlocked", () => {
  freshRun();
  const pages = Collection.pages();
  unlockEpisode(pages[0].ep);
  deepEq(state.epQueue, [pages[0].ep]);
  /* Watched, so off the queue — and it must not come back as "fresh" on the next unlock. */
  state.epQueue = [];
  const after = Collection.unlockSnapshot();
  state.clues[pages[1].ep] = Clues.authoredFor(pages[1].ep)
    .slice(0, Clues.requiredFor(pages[1].ep)).map(c => c.id);
  deepEq(Collection.claimUnlocked(after), [pages[1].ep], "only the new one");
  deepEq(state.epQueue, [pages[1].ep], "an already-watched episode is not re-queued");
});

test("pageMissing names exactly what is still needed", () => {
  freshRun();
  const page = Collection.pages()[0];
  Collection.add(page.needs[0], 1);
  Collection.add(page.needs[2], 1);
  deepEq(Collection.pageMissing(page), [page.needs[1], page.needs[3], page.needs[4]]);
});

test("firstUnwatchedId walks the album in order, not the queue's push order", () => {
  freshRun();
  const pages = Collection.pages();
  unlockEpisode(pages[2].ep);
  unlockEpisode(pages[0].ep);
  eq(Collection.firstUnwatchedId(), pages[0].ep,
     "unlocking episode 3 first still plays episode 1 first");
});

suite("collection: turning the board over");

test("a board is complete only when every page is", () => {
  freshRun();
  eq(Collection.boardComplete(), false);
  Collection.pages().forEach(p => unlockEpisode(p.ep));
  ok(Collection.boardComplete());
  deepEq(Collection.boardProgress(), [cfg.episodesPerBoard, cfg.episodesPerBoard]);
});

test("a set is finished only when its episodes have been watched, not merely collected", () => {
  freshRun();
  Collection.pages().forEach(p => unlockEpisode(p.ep));
  ok(Collection.boardComplete(), "every episode unlocked");
  eq(Collection.boardFinished(), false, "but five episodes are still waiting");
  deepEq(Collection.boardWatched(), [0, cfg.episodesPerBoard]);
  state.epQueue = [];                            // …watched
  ok(Collection.boardFinished());
  deepEq(Collection.boardWatched(), [cfg.episodesPerBoard, cfg.episodesPerBoard]);
});

test("a sealed reveal is not a watched episode", () => {
  freshRun();
  Collection.pages().forEach(p => unlockEpisode(p.ep));
  state.epQueue = [];
  state.pendingReveal = { id: "001", wager: 10, odds: 2, won: true, payout: 20 };
  eq(Collection.boardFinished(), false, "the bet is placed but the answer is still owed");
  state.pendingReveal = null;
  ok(Collection.boardFinished());
});

test("advanceBoard refuses until the set is finished, then moves on", () => {
  freshRun();
  eq(Collection.advanceBoard(), null, "an incomplete board does not turn over");
  Collection.pages().forEach(p => unlockEpisode(p.ep));
  eq(Collection.advanceBoard(), null, "and neither does an unlocked-but-unwatched one");
  state.epQueue = [];
  const next = Collection.advanceBoard();
  ok(next, "a complete board with content behind it advances");
  eq(state.boardNum, 2);
  eq(state.boardsDone, 1);
  eq(Collection.collected(), 0, "the new set's album starts empty");
  eq(Collection.poolSize(), cfg.episodesPerBoard * cfg.collectiblesPerEpisode);
});

test("a finished board keeps its episodes forever", () => {
  freshRun();
  Collection.pages(1).forEach(p => unlockEpisode(p.ep));
  state.epQueue = [];
  const wasUnlocked = Collection.unlockedEpisodeIds().slice();
  ok(wasUnlocked.length, "the set has to actually be unlocked for this to mean anything");
  Collection.advanceBoard();
  const now = Collection.unlockedEpisodeIds();
  wasUnlocked.forEach(id => ok(now.includes(id), `${id} must survive the board change`));
});

test("a derived board wears the template's requirements over its own episodes", () => {
  freshRun();
  const derived = Collection.boardFor(2);
  eq(derived.derivedFrom, 1, "board 2 is not authored yet");
  deepEq(Collection.pages(2).map(p => p.ep), Episodes.ids().slice(5, 10));
  eq(Collection.poolSize(2), Collection.poolSize(1));
});

test("the loop stops when the library runs out rather than looping forever", () => {
  freshRun();
  const last = Collection.boardCount();
  eq(Collection.episodeIdsFor(last + 1).length, 0);
  state.boardNum = last + 1;
  eq(Collection.pages().length, 0);
  eq(Collection.boardComplete(), false, "an empty board is not a finished one");
  eq(Collection.hasNextBoard(), false);
});

suite("boxes: drawing");

test("every tier draws its stated number of items, and always pays", () => {
  freshRun();
  Boxes.tiers().forEach(t => {
    const res = Boxes.open(t.key);
    eq(res.drops.length, t.items, `${t.key} pays ${t.items}`);
    res.drops.forEach(d => ok(d && d.kind, `${t.key} produced an empty drop`));
  });
});

test("a card drop comes from the pool, at the tier the table asked for", () => {
  freshRun();
  forceBox("silver", r => r.kind === "card" && r.tier === "gold", () => {
    const d = Boxes.open("silver").drops[0];
    eq(d.kind, "card");
    eq(d.card.tier, "gold");
    ok(Collection.pool().includes(d.id), "and it is a card this board actually wants");
  });
});

test("a duplicate pays its tier's consolation and nothing else", () => {
  freshRun();
  /* Every diamond, not just one: the draw is uniform across that tier's slice of the pool, so
     holding one card guarantees nothing about which one comes back. */
  Collection.poolOf("char", "diamond").forEach(id => Collection.add(id, 1));
  forceBox("silver", r => r.kind === "card" && r.tier === "diamond", () => {
    state.coins = 0;
    const d = Boxes.open("silver").drops[0];
    eq(d.isNew, false);
    eq(d.coins, Math.round(cfg.dupCoins * Collection.tier("diamond").dup * cfg.boardScale));
    eq(state.coins, d.coins, "the consolation is banked, not just reported");
  });
});

test("a duplicate silver is worth less than a duplicate diamond", () => {
  freshRun();
  const s = Boxes.dupValue({ tier: "silver" }), d = Boxes.dupValue({ tier: "diamond" });
  ok(d > s, "rarity has to survive into the consolation or a dupe is a dupe");
  eq(Boxes.dupValue({ tier: null }), cfg.dupCoins * cfg.boardScale, "a clue dupe pays the base");
});

test("coins and energy drops are banked, and energy never drains an overflow", () => {
  freshRun();
  forceBox("silver", r => r.kind === "coins", () => {
    state.coins = 0;
    const d = Boxes.open("silver").drops[0];
    eq(d.kind, "coins");
    eq(state.coins, d.amount);
  });
  forceBox("silver", r => r.kind === "energy", () => {
    state.energy = 900;                        // bought, far over the cap
    Boxes.open("silver");
    eq(state.energy, 900, "a box must never clamp a purchased balance downward");
  });
});

test("a status drop shelves an item, and falls back to coins once the shelf is full", () => {
  freshRun();
  forceBox("diamond", r => r.kind === "status", () => {
    const d = Boxes.open("diamond").drops[0];
    eq(d.kind, "status");
    ok(Status.owns(d.item.id), "it is on the shelf, not merely announced");
    STATUS_ITEMS.forEach(i => Status.grant(i.id, "found"));   // fill it
    eq(Boxes.open("diamond").drops[0].kind, "coins", "a box always pays");
  });
});

test("openBoxEvents pays a box and says nothing more when nothing completed", () => {
  freshRun();
  forceBox("silver", r => r.kind === "coins", () => {
    const ev = openBoxEvents("silver");
    eq(ev.filter(e => e.pack).length, 1, "one box");
    eq(ev.filter(e => e.unlock).length, 0, "a coin drop unlocks nothing");
    eq(ev.filter(e => e.boardDone).length, 0);
    ok(ev[0].log && ev[ev.length - 1].log, "opened, then what it paid");
  });
});

test("a box unlocks nothing — cards and the story are separate tracks now", () => {
  freshRun();
  for (let k = 0; k < 40; k++) {
    eq(openBoxEvents("silver").filter(e => e.unlock).length, 0,
       "an episode is bought with clues, and a box does not contain any");
  }
  eq(Collection.unlockedEpisodeIds().length, 0);
});

test("openBoxEvents does not end a set — unlocking an episode is not watching it", () => {
  freshRun();
  Collection.pages().forEach(p => unlockEpisode(p.ep));
  ok(Collection.boardComplete(), "every episode unlocked");
  eq(Collection.boardFinished(), false, "but not one of them watched");
  forceBox("silver", r => r.kind === "coins", () => {
    eq(openBoxEvents("silver").filter(e => e.boardDone).length, 0,
       "the set holds until the episodes have been seen");
  });
});

test("landing on the Premiere hands over a box and nothing else", () => {
  freshRun();
  const ev = TILE_TYPES.premiere.onLand({ pos: 0, mult: 1, bs: 1 });
  ok(ev.some(e => e.pack), "the free pack (GDD 3.4)");
  eq(ev.filter(e => e.pack).length, 1, "exactly one");
  ok(Boxes.tier(ev.find(e => e.pack).pack.tier.key), "and the tier is a real one");
});

test("a card drawn off a tile goes through the same banking as one out of a box", () => {
  freshRun();
  const ev = drawCardEvents("test", "🃏");
  eq(Collection.collected(), 1, "banked before a single event is returned");
  eq(ev.filter(e => e.pack).length, 0, "and it is NOT the box ceremony");
  eq(ev.filter(e => e.card).length, 1, "a card you did not have holds the screen");
});

test("a duplicate off a tile pays coins and never blocks", () => {
  freshRun();
  const real = Collection.poolOf;
  Collection.poolOf = () => [Collection.pool()[0]];
  try {
    drawCardEvents("test", "🃏");
    state.coins = 0;
    const ev = drawCardEvents("test", "🃏");
    ok(state.coins > 0, "a duplicate always converts to something");
    eq(ev.filter(e => e.card).length, 0, "and it does not stop the roll");
  } finally { Collection.poolOf = real; }
});

suite("status: points, ranks and buying");

test("points come from items, watching and collecting together", () => {
  freshRun();
  eq(Status.points(), 0);
  state.epsWatched = 3;
  eq(Status.points(), 3 * cfg.statusPerEpisode);
  Collection.add(Collection.pool()[0], 1);
  eq(Status.points(), 3 * cfg.statusPerEpisode + cfg.statusPerCard);
  const item = Status.item("mug");
  Status.grant("mug", "found");
  eq(Status.points(), 3 * cfg.statusPerEpisode + cfg.statusPerCard + item.points);
});

test("ranks climb with the points and stop at the top", () => {
  freshRun();
  eq(Status.rank(0).name, STATUS_RANKS[0].name);
  eq(Status.rank(STATUS_RANKS[1].at).name, STATUS_RANKS[1].name);
  eq(Status.rank(STATUS_RANKS[1].at - 1).name, STATUS_RANKS[0].name);
  const top = STATUS_RANKS[STATUS_RANKS.length - 1];
  eq(Status.rank(top.at + 9999).name, top.name);
  eq(Status.nextRank(top.at), null);
  eq(Status.rankProgress(top.at), 1, "the top rank reads as full, not as a fraction of nothing");
  eq(Status.toNext(top.at), 0);
});

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
});

test("sweep grants what the milestones have earned, and only once", () => {
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

suite("collection: watching in order");

test("watched is derived — unlocked, and no longer waiting", () => {
  freshRun();
  const pages = Collection.pages();
  unlockEpisode(pages[0].ep);
  deepEq(Collection.watchedIds(), [], "unlocked but queued is not watched");
  state.epQueue = [];
  deepEq(Collection.watchedIds(), [pages[0].ep]);
});

test("the next episode is the next of the STORY, however the cards fell", () => {
  freshRun();
  const pages = Collection.pages();
  unlockEpisode(pages[1].ep);                            // episode 2 unlocks first
  eq(Collection.nextStoryId(), pages[0].ep, "episode 1 is still what is owed next");
  eq(Collection.firstUnwatchedId(), null, "and it cannot be watched — it is not unlocked");
  eq(Collection.blockedBy(), pages[0].ep, "so the UI can say which one is holding things up");
  eq(Collection.canWatch(pages[1].ep), false, "episode 2 does not jump the queue");
});

test("collecting the earlier episode unblocks it, and only it", () => {
  freshRun();
  const pages = Collection.pages();
  unlockEpisode(pages[1].ep);
  unlockEpisode(pages[0].ep);
  eq(Collection.firstUnwatchedId(), pages[0].ep);
  eq(Collection.blockedBy(), null);
  ok(Collection.canWatch(pages[0].ep));
  eq(Collection.canWatch(pages[1].ep), false, "still not until 1 has been watched");
  state.epQueue = state.epQueue.filter(id => id !== pages[0].ep);   // watch it
  eq(Collection.firstUnwatchedId(), pages[1].ep, "now 2 is next");
});

test("the order runs across sets, not just within one", () => {
  freshRun();
  Collection.pages(1).forEach(p => unlockEpisode(p.ep));
  state.epQueue = [];
  Collection.advanceBoard();
  const pages = Collection.pages();
  /* A real snapshot, not []: claimUnlocked([]) would treat set 1's five watched episodes as
     newly unlocked and push them all back onto the queue. */
  const before = Collection.unlockSnapshot();
  pages[2].needs.forEach(id => Collection.add(id, 1));
  Collection.claimUnlocked(before);
  eq(Collection.nextStoryId(), pages[0].ep, "set 2 starts at its own first episode");
  eq(Collection.blockedBy(), pages[0].ep);
});
