"use strict";
/* js/collection.js, js/boxes.js, js/status.js — the loop that replaced the builders. */

suite("collection: the arc");

test("the shipped set validates, and its episodes all exist and can be unlocked", () => {
  freshRun();
  deepEq(Collection.validate(1), []);
  eq(Collection.pages(1).length, cfg.episodesPerBoard);
  Collection.pages(1).forEach(p => {
    ok(Episodes.has(p.ep), `${p.ep} has no file`);
    ok(Clues.authoredFor(p.ep).length >= Clues.baseRequired(), `${p.ep} cannot be unlocked`);
  });
});

test("a set is a run of the story, straight down the episode list", () => {
  freshRun();
  const per = cfg.episodesPerBoard;
  deepEq(Collection.episodeIdsFor(1), Episodes.ids().slice(0, per));
  deepEq(Collection.episodeIdsFor(2), Episodes.ids().slice(per, per * 2));
  eq(Collection.boardFor(1).name, Episodes.titleOf(Episodes.ids()[0]),
     "a set has no authored name — it is named after the episode it opens with");
});

test("validate reports a set with no episodes rather than pretending it has some", () => {
  freshRun();
  state.boardNum = Collection.boardCount() + 5;
  ok(Collection.validate().some(e => /has no episodes/.test(e)));
  eq(Collection.boardComplete(), false, "and an empty set is never a finished one");
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

test("a page has no card requirements left to miss", () => {
  const page = Collection.pages()[0];
  ok(!("needs" in page), "a page is an episode now; the cards it used to demand are gone");
  eq(typeof Collection.pageMissing, "undefined");
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
  deepEq(Collection.pages().map(p => p.ep), Episodes.ids().slice(cfg.episodesPerBoard, cfg.episodesPerBoard * 2),
         "and it is pointed at the next run of the story");
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

test("every set past the first works without being authored", () => {
  freshRun();
  /* Nothing about a set is authored any more: it is a slice of the episode list, named after
     the episode it opens with. So the loop runs as long as there are episode files. */
  const per = cfg.episodesPerBoard;
  deepEq(Collection.pages(2).map(p => p.ep), Episodes.ids().slice(per, per * 2));
  eq(Collection.boardFor(2).name, Episodes.titleOf(Episodes.ids()[per]));
  deepEq(Collection.validate(2), []);
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

test("every pack draws its stated number, plus the Insider's guaranteed clue", () => {
  freshRun();
  Boxes.tiers().forEach(t => {
    const res = Boxes.open(t.key);
    /* GDD 6.5's guarantee sits ON TOP of the draws, not instead of one: the Insider is the pack
       you buy when the story has stalled, and paying for it with a card slot would make it a
       worse card pack rather than a story one. */
    const extra = t.clue === "fresh" ? 1 : 0;
    eq(res.drops.length, t.items + extra, `${t.key} pays ${t.items}${extra ? " + a clue" : ""}`);
    res.drops.forEach(d => ok(d && d.kind, `${t.key} produced an empty drop`));
    if (extra) eq(res.drops[0].kind, "clue", "and it comes off the top");
  });
});

test("the Insider's clue is one you do not already hold", () => {
  freshRun();
  const ep = Clues.currentId(), all = Clues.authoredFor(ep);
  /* One short of the requirement, so the episode is still the current one — hold any more and
     it unlocks and the draw moves to the next episode. A uniform draw over the eight would
     repeat three times in eight; this must never. */
  const held = all.slice(0, Clues.requiredFor(ep) - 1).map(c => c.id);
  for (let k = 0; k < 40; k++) {
    state.clues[ep] = held.slice();
    state.clueDay[ep] = state.day;
    const d = Boxes.open("insider").drops[0];
    eq(d.kind, "clue");
    eq(held.includes(d.clue.id), false, "the dearest pack must never be a dud");
    eq(d.isNew, true);
  }
});

test("the Insider's price climbs with every one bought, and an unlock resets it", () => {
  freshRun();
  const base = Boxes.priceOf("insider");
  eq(Boxes.priceOf("standard"), Math.round(Boxes.tier("standard").coins * cfg.boardScale),
     "a flat pack does not escalate");
  state.coins = 1e9;
  Boxes.buyEvents("insider");
  const second = Boxes.priceOf("insider");
  ok(second > base, "GDD 6.5 — sprint speed is capped by price, not by a cooldown");
  Boxes.buyEvents("insider");
  ok(Boxes.priceOf("insider") > second, "…and it keeps climbing");
  /* An episode unlocking is what resets it. */
  const beforeSnap = Collection.unlockSnapshot();
  unlockEpisode(Episodes.ids()[0]);
  eq(state.insiderBought, 0);
  eq(Boxes.priceOf("insider"), base, "back to base the moment the story moves");
});

test("buyEvents spends exactly once and refuses when it cannot pay", () => {
  freshRun();
  state.coins = Boxes.priceOf("standard") - 1;
  eq(Boxes.buyEvents("standard"), null, "one coin short is short");
  eq(state.coins, Boxes.priceOf("standard") - 1, "and nothing was taken");
  state.coins = Boxes.priceOf("standard");
  const ev = Boxes.buyEvents("standard");
  ok(ev && ev.some(e => e.pack));
  ok(state.coins >= 0, "the price came out, and whatever the pack paid went back in");
});

test("a card drop honours the table's rarity FLOOR, which is a guarantee and not a target", () => {
  freshRun();
  forceBox("insider", r => r.kind === "card" && r.floor === "epic", () => {
    for (let k = 0; k < 60; k++) {
      /* Past the guaranteed clue, which is not a table draw. */
      const d = Boxes.open("insider").drops[1];
      eq(d.kind, "card");
      ok(Cards.rarity(d.card.rarity).rank >= Cards.rarity("epic").rank,
         `${d.card.name} is ${d.card.rarity} — a floor must never be undershot`);
    }
  });
});

test("a clue can come out of a box, and it unlocks like any other clue", () => {
  freshRun();
  forceBox("standard", r => r.kind === "clue", () => {
    const before = Clues.total();
    const d = Boxes.open("standard").drops[0];
    eq(d.kind, "clue");
    ok(Episodes.has(d.ep));
    eq(Clues.total(), before + (d.isNew ? 1 : 0));
  });
});

test("coins and energy drops are banked, and energy never drains an overflow", () => {
  freshRun();
  forceBox("standard", r => r.kind === "coins", () => {
    state.coins = 0;
    const d = Boxes.open("standard").drops[0];
    eq(d.kind, "coins");
    eq(state.coins, d.amount);
  });
  forceBox("standard", r => r.kind === "energy", () => {
    state.energy = 900;                        // bought, far over the cap
    Boxes.open("standard");
    eq(state.energy, 900, "a box must never clamp a purchased balance downward");
  });
});

test("a status drop shelves an item, and falls back to coins once the shelf is full", () => {
  freshRun();
  forceBox("insider", r => r.kind === "status", () => {
    const d = Boxes.open("insider").drops[1];
    eq(d.kind, "status");
    ok(Status.owns(d.item.id), "it is on the shelf, not merely announced");
    STATUS_ITEMS.forEach(i => Status.grant(i.id, "found"));   // fill it
    eq(Boxes.open("insider").drops[1].kind, "coins", "a box always pays");
  });
});

test("openBoxEvents pays a box and says nothing more when nothing completed", () => {
  freshRun();
  forceBox("standard", r => r.kind === "coins", () => {
    const ev = openBoxEvents("standard");
    eq(ev.filter(e => e.pack).length, 1, "one box");
    eq(ev.filter(e => e.unlock).length, 0, "a coin drop unlocks nothing");
    eq(ev.filter(e => e.boardDone).length, 0);
    ok(ev[0].log && ev[ev.length - 1].log, "opened, then what it paid");
  });
});

test("a box's CARDS unlock nothing — only the clue in it can", () => {
  freshRun();
  forceBox("standard", r => r.kind === "card", () => {
    for (let k = 0; k < 60; k++) eq(openBoxEvents("standard").filter(e => e.unlock).length, 0);
    eq(Collection.unlockedEpisodeIds().length, 0, "the collection is not the gate");
    ok(Cards.owned() > 0, "…though the collection did fill");
  });
});

test("openBoxEvents does not end a set — unlocking an episode is not watching it", () => {
  freshRun();
  Collection.pages().forEach(p => unlockEpisode(p.ep));
  ok(Collection.boardComplete(), "every episode unlocked");
  eq(Collection.boardFinished(), false, "but not one of them watched");
  forceBox("standard", r => r.kind === "coins", () => {
    eq(openBoxEvents("standard").filter(e => e.boardDone).length, 0,
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
  eq(Cards.owned(), 1, "banked before a single event is returned");
  eq(ev.filter(e => e.pack).length, 0, "and it is NOT the box ceremony");
  eq(ev.filter(e => e.card).length, 1, "a card you did not have holds the screen");
});

test("the three card beats: new holds, a plain copy floats, the converting copy holds", () => {
  freshRun();
  const id = Cards.all()[0].id;
  const real = Cards.draw;
  Cards.draw = () => Cards.get(id);
  try {
    eq(drawCardEvents("t").filter(e => e.card).length, 1, "copy 1 is new");
    state.coins = 0;
    const two = drawCardEvents("t");
    eq(two.filter(e => e.card).length, 0, "copy 2 does not stop the roll");
    ok(state.coins > 0, "…but it always pays");
    const three = drawCardEvents("t");
    const beat = three.find(e => e.card);
    ok(beat, "copy 3 CONVERTS, and that is the payoff worth stopping for");
    eq(beat.card.converted, true);
    ok(Cards.converted(id));
  } finally { Cards.draw = real; }
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
  unlockEpisode(pages[2].ep);
  eq(Collection.nextStoryId(), pages[0].ep, "set 2 starts at its own first episode");
  eq(Collection.blockedBy(), pages[0].ep);
});
