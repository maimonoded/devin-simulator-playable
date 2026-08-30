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

test("the Insider's price climbs with every one bought since the last unlock", () => {
  freshRun();
  const base = Boxes.priceOf("insider");
  eq(Boxes.priceOf("standard"), Math.round(Boxes.tier("standard").coins * cfg.boardScale),
     "a flat pack does not escalate");
  /* Read as a pure function of the counter rather than by buying: a pack GUARANTEES a clue, so
     buying a few in a row can unlock an episode, which resets the counter — correct behaviour,
     and it made this test fail one run in five when it tried to drive the counter by shopping. */
  let last = base;
  for (let n = 1; n <= 5; n++) {
    state.insiderBought = n;
    const p = Boxes.priceOf("insider");
    ok(p > last, `GDD 6.5 — pack ${n + 1} has to cost more than pack ${n}`);
    last = p;
  }
  state.insiderBought = 0;
  eq(Boxes.priceOf("insider"), base);
});

test("buying an Insider bumps the counter, and an unlock puts it back", () => {
  freshRun();
  state.coins = 1e9;
  const before = Collection.unlockSnapshot();
  Boxes.buyEvents("insider");
  /* Either it bumped, or the guaranteed clue unlocked an episode and reset it — and an unlock
     resetting it is the whole rule, so both are the rule holding. */
  const unlocked = Collection.unlockedEpisodeIds().length > before.length;
  eq(state.insiderBought, unlocked ? 0 : 1);
  /* Now force one, and watch it reset. */
  state.insiderBought = 4;
  const snap = Collection.unlockSnapshot();
  const ep = Clues.currentId();
  state.clues[ep] = Clues.authoredFor(ep).slice(0, Clues.requiredFor(ep)).map(c => c.id);
  Collection.claimUnlocked(snap);
  eq(state.insiderBought, 0, "back to base the moment the story moves");
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

test("a box never hands over a Collectible directly — it pays cards (\u00a74.5)", () => {
  /* Boxes used to drop a status item whole. \u00a74.5 says "each contains three cards", and \u00a78.1
     lists the only four sources of a Collectible: card conversion, set completion, predictions,
     episodes. A box handing one over was a fifth route nobody designed.

     A tier table that still carries a `status` row must therefore FALL THROUGH rather than
     throw — a box always pays, and a stale row is a content mistake, not a crash. */
  freshRun();
  /* The tier tables no longer carry a status row at all, so the stale-row case cannot even be
     constructed from config any more — which is the stronger outcome, and why this asserts the
     absence rather than the fall-through. */
  boxTiers.forEach(t => t.table.forEach(r =>
    ok(r.kind !== "status", `${t.key} still carries a status row`)));
  let seen = 0;
  for (let i = 0; i < 300; i++)
    Boxes.open("insider").drops.forEach(d => { if (d.kind === "status") seen++; });
  eq(seen, 0, "and across three hundred boxes, not one Collectible falls out");
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

suite("cards: which copies stop the board");

/* A MEMORY's duplicate is a consolation — a coin float, and the board keeps moving. A TROPHY is
   held on EVERY copy, because its card carries the n-of-3 counter and the counter is what makes
   you want another one. Skipping the second copy meant it could only ever read "1 of 3" or
   "3 of 3" and never "2 of 3", which is the state that does the work. */
function drawOf(id) {
  /* Force the draw to this exact card, then take the events a landing would produce. */
  const real = Boxes.dropCard;
  Boxes.dropCard = () => Object.assign({ kind: "card" }, Cards.add(id));
  try { return drawCardEvents("Test", "🃏", null); }
  finally { Boxes.dropCard = real; }
}

test("a memory's duplicate does NOT stop the board", () => {
  freshRun();
  const mem = Cards.all().find(c => !Cards.isStatusCard(c.id));
  drawOf(mem.id);                                  // 1st copy
  const ev = drawOf(mem.id);                       // 2nd — a plain duplicate
  eq(ev.filter(e => e.card).length, 0, "no card is held");
  ok(ev.some(e => e.float), "just the coin float");
});

test("a trophy stops the board on every copy, so the counter can read 2 of 3", () => {
  freshRun();
  const tro = Cards.all().find(c => Cards.isStatusCard(c.id));
  const need = Cards.copiesToConvert();
  const counts = [];
  for (let i = 0; i < need; i++) {
    const beat = drawOf(tro.id).find(e => e.card);
    ok(beat, `copy ${i + 1} is held on screen`);
    counts.push(beat.card.count);
    eq(beat.card.statusCard, true, "and knows it is a trophy");
    eq(beat.card.need, need, "and what it is counting to");
  }
  eq(counts.join(","), [1, 2, 3].slice(0, need).join(","),
     "1 of 3, 2 of 3, 3 of 3 — the middle one is the point of this test");
});

test("only the third copy celebrates", () => {
  freshRun();
  const tro = Cards.all().find(c => Cards.isStatusCard(c.id));
  const need = Cards.copiesToConvert();
  const flags = [];
  for (let i = 0; i < need + 1; i++) {
    const beat = drawOf(tro.id).find(e => e.card);
    if (beat) flags.push(!!beat.card.converted);
  }
  eq(flags.filter(Boolean).length, 1, "the celebration fires exactly once");
  eq(flags[need - 1], true, "on the copy that converts");
});
