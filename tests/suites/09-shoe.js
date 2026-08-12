"use strict";
/* js/shoe.js — the card shoe that replaced the dice.

   The suite the dice suite vacated. Two things here are worth more than the rest: the
   two-tickets-per-pack invariant asserted over a MIXED sequence of buys and free deals (not
   per-pack, which any implementation passes), and the merge-and-reshuffle on a purchase, which
   is what stops a ticket still sitting in the remainder from being destroyed. */

suite("shoe: a pack");

test("a fresh pack is exactly packSize cards", () => {
  freshRun();
  eq(Shoe.mintPack().length, cfg.packSize);
});

/* A real deck: four suits of 1..13 and the two jokers. 54, not 52 — the jokers ARE the
   tickets, so they are part of the pack rather than an extra on top of it.

   THE JOKER COUNT IS PINNED HERE rather than taken from the shipped default, which is 10. This
   test is the natural-deck contract — room for every card, so nothing is trimmed — and it has to
   go on saying that whatever number the economy happens to ship. What the game actually deals is
   the test below, and the two together are the point: one fixes the shape, one fixes today. */
test("a pack is four suits of 1..13 plus the two jokers", () => {
  freshRun();
  cfg.ticketsPerPack = 2;
  const pack = Shoe.mintPack();
  eq(pack.length, 54, "a whole deck");
  Shoe.SUITS.forEach(su => {
    for (let r = 1; r <= 13; r++)
      eq(pack.filter(c => c === su + r).length, 1, `one ${su}${r}`);
  });
  deepEq(pack.filter(c => Shoe.isTicket(c)).sort(), ["J1", "J2"], "both jokers, one each");
  ok(pack.every(c => Shoe.isLegal(c)), "and nothing the game cannot read");
});

/* WHAT THE GAME ACTUALLY DEALS: the whole numbered deck, plus ten jokers on top of it — 62. */
test("the shipped pack is the whole numbered deck plus its twelve jokers", () => {
  freshRun();
  eq(cfg.ticketsPerPack, 12, "the shipped joker count");
  eq(cfg.ticketsPerPack % Shoe.jokerTypes(), 0,
     "and it divides by the cast, or the first leads get a permanent supply advantage");
  eq(cfg.packSize, 64, "52 numbered cards plus twelve jokers");
  const pack = Shoe.mintPack();
  eq(pack.length, 64);
  eq(pack.filter(c => Shoe.isTicket(c)).length, 12, "twelve jokers");
  /* Round-robin over the whole cast, EVENLY — the reason ticketsPerPack must divide by it. */
  Shoe.JOKERS.forEach(j => eq(pack.filter(c => c === j).length, 12 / Shoe.jokerTypes(),
                             `an equal share of ${j}`));
  /* THE RANKS SURVIVE THE JOKER COUNT, and this is the whole reason the size is derived. When
     packSize was set independently, raising the jokers ate 12s and 13s off the top of the deck
     to make room — so a change that reads as "more tickets" also quietly cut the token's longest
     moves, with nothing at the call site to say so. */
  Shoe.SUITS.forEach(su => {
    for (let r = 1; r <= 13; r++) eq(pack.filter(c => c === su + r).length, 1, `one ${su}${r}`);
  });
  ok(pack.every(c => Shoe.isLegal(c)), "and nothing the game cannot read");
});

/* The derivation itself, across the range — one input, and the size follows it. */
test("pack size follows the joker count instead of competing with it", () => {
  freshRun();
  cfg.ticketsPerPack = 2;  eq(Shoe.packSize(), 54, "the natural deck");
  cfg.ticketsPerPack = 10; eq(Shoe.packSize(), 62, "the shipped one");
  cfg.ticketsPerPack = 40; eq(Shoe.packSize(), 92, "and it just keeps growing — nothing is traded");
  cfg.ticketsPerPack = 0;  eq(Shoe.packSize(), 52, "no jokers is simply the numbered deck");
  [2, 10, 40].forEach(n => {
    cfg.ticketsPerPack = n;
    const pack = Shoe.mintPack();
    eq(pack.filter(c => !Shoe.isTicket(c)).length, 52, `the 52 are intact at ${n} jokers`);
    eq(pack.filter(c => Shoe.isTicket(c)).length, n, `and there are ${n} of them`);
  });
});

test("a card's rank is its move and its suit is only ever art", () => {
  freshRun();
  eq(Shoe.rank("s7"), 7);
  eq(Shoe.rank("h13"), 13);
  eq(Shoe.rank("d1"), 1);
  eq(Shoe.rank("J1"), 0, "a joker moves nothing — it is the ticket");
  eq(Shoe.suitOf("s7"), "star");
  eq(Shoe.suitOf("h2"), "heart");
  eq(Shoe.suitOf("d9"), "diamond");
  eq(Shoe.suitOf("m4"), "mask");
  eq(Shoe.suitOf("J2"), "joker");
});

test("the two jokers are distinct cards, and both are tickets", () => {
  freshRun();
  ok(Shoe.isTicket("J1") && Shoe.isTicket("J2"), "both are tickets");
  ok(Shoe.JOKERS[0] !== Shoe.JOKERS[1], "but they are not the same card");
  eq(Shoe.jokerIndex("J1"), 0);
  eq(Shoe.jokerIndex("J2"), 1);
  /* -1, NOT 0. It picks the episode a ticket fills now, so clamping an unknown joker to
     the first lead would silently stuff episode 1. award() treats -1 as a wildcard. */
  eq(Shoe.jokerIndex("J9"), -1, "an unknown joker is not the first lead");
});

/* Every path that reads a saved shoe leans on this, so it is asserted rather than assumed. */
test("illegal cards are recognisable as illegal", () => {
  freshRun();
  ["s0", "s14", "x3", "7", "", "J9", "s07"].forEach(c =>
    ok(!Shoe.isLegal(c), `${JSON.stringify(c)} must be refused`));
  ["s1", "h13", "d7", "m12", "J1", "J2"].forEach(c => ok(Shoe.isLegal(c), c));
});

test("a pack is a shuffle, not a sorted list", () => {
  freshRun();
  const pack = Shoe.mintPack();
  const ranks = pack.filter(c => !Shoe.isTicket(c)).map(c => Shoe.rank(c));
  ok(ranks.some((v, i) => i > 0 && v < ranks[i - 1]), "some rank follows a larger one");
});

/* The invariant the whole economy rests on, asserted over a MIXED sequence of buys and small
   free deals — per-pack counting passes trivially, and the real question is whether cards
   trickled out a few at a time carry their share of the tickets or quietly dilute them.

   Measured over a whole number of packs, deliberately. Mid-pack the count is NOT proportional
   and must not be: the tickets sit at random positions in the shuffle, so 26 cards into a pack
   you may have drawn none of them or both. Exactness returns at the pack boundary, and that is
   the promise the economy is priced against. */
test("exactly ticketsPerPack tickets per packSize cards, however they were obtained", () => {
  freshRun();
  state.shoe = []; state.packTail = [];
  let tickets = 0;
  const drain = () => { while (state.shoe.length) { if (Shoe.isTicket(Shoe.pull())) tickets++; } };
  state.coins = 1e9;
  for (let k = 0; k < 3; k++) { Shoe.buyPack(); drain(); }          // 3 packs, bought
  /* 2 packs, six at a time — stopping ON the boundary rather than assuming six divides a pack.
     It used to divide 54 exactly and the loop counted chunks; a pack is 62 now and the same
     arithmetic overshot by most of a pack, which is a fine reminder that "54 divides by 6" was
     a fact about one number and not about the invariant being tested. */
  const want = cfg.packSize * 2;
  for (let dealt = 0; dealt < want; ) {
    const n = Math.min(6, want - dealt);
    Shoe.dealFree(n); dealt += n; drain();
  }
  eq(tickets, 5 * cfg.ticketsPerPack, "five packs' worth of cards carry five packs' worth of tickets");
  eq(state.packTail.length, 0, "and they came out to a clean pack boundary");
});

test("free cards come off the pack tail rather than minting a loose card", () => {
  freshRun();
  state.shoe = []; state.packTail = [];
  Shoe.dealFree(1);
  eq(state.packTail.length, cfg.packSize - 1, "the rest of that pack waits for next time");
  const priced = state.ticketsPriced;
  Shoe.dealFree(5);
  eq(state.ticketsPriced, priced, "still inside the same pack — the curve pointer does not move");
});

suite("shoe: dealing and pulling");

test("dealFree tops up toward the cap and never past it", () => {
  freshRun();
  state.shoe = state.shoe.slice(0, 10);
  eq(Shoe.dealFree(999), cfg.packSize - 10, "only the room is dealt");
  eq(Shoe.count(), cfg.packSize);
});

/* The overflow rule, at the first of its four enforcement sites. Energy only overflowed via the
   store; a shoe overflows on the ordinary buy-a-pack path, so this one is hit constantly. */
test("dealFree never reduces a shoe already over the cap", () => {
  freshRun();
  state.shoe = Shoe.mintPack().concat(Shoe.mintPack());
  const big = Shoe.count();
  eq(Shoe.dealFree(10), 0, "no room, so nothing is dealt");
  eq(Shoe.count(), big, "and nothing is taken away");
});

test("a pull removes exactly one card from the front", () => {
  freshRun();
  state.shoe = ["s5", "h8", "J1"];
  eq(Shoe.pull(), "s5");
  deepEq(state.shoe, ["h8", "J1"]);
});

test("pulling an empty shoe returns null and counts nothing", () => {
  freshRun();
  state.shoe = [];
  eq(Shoe.pull(), null);
  eq(state.pulls, 0);
});

suite("shoe: buying");

/* Merge, not replace. A ticket still in the remainder must survive being bought over — that is
   the whole reason a purchase shuffles the leftovers in instead of assigning a fresh pack. */
test("buying merges the new pack into what is left and reshuffles all of it", () => {
  freshRun();
  state.coins = 1e9;
  state.shoe = ["s1", "h2", "d3", "J2", "m5", "s6", "h7"];
  const before = state.shoe.slice();
  const r = Shoe.buyPack();
  ok(r, "the purchase went through");
  eq(Shoe.count(), before.length + cfg.packSize, "nothing was dropped");
  eq(state.shoe.filter(c => Shoe.isTicket(c)).length, 1 + cfg.ticketsPerPack,
     "the leftover joker is still in there");
  ok(!before.every((v, i) => state.shoe[i] === v), "and the old remainder is not simply a prefix");
});

/* A deck is a real-money product: coins buy prediction wagers and nothing else. Until IAP is
   wired up the purchase completes for free, so buyPack ALWAYS succeeds and no caller may branch
   on affordability. The coin balance must come out untouched — a deck quietly costing coins
   would be the exact bug this pins. */
test("buying a deck takes no coins and always succeeds", () => {
  freshRun();
  state.coins = 0;
  const r = Shoe.buyPack();
  ok(r, "no coins, and it still went through");
  eq(state.coins, 0, "a deck is not a coin sink");
  eq(r.usd, cfg.deckPriceUsd, "it reports the real-money price it will carry");
  eq(Shoe.count(), 2 * cfg.packSize, "a full pack merged onto the opening one");
});

suite("shoe: what a pack costs");

/* The model still prices a pack off the cost curve even though nothing charges it — that is
   the economy's own accounting of how far along the curve a run has got, and it is what a
   future IAP price gets sanity-checked against. */
test("the MODEL still prices a pack as the next ticketsPerPack rungs of the curve", () => {
  freshRun();
  /* Pinned to two so the expectation can be written out longhand. WHICH rungs get summed is the
     whole assertion, and a loop over cfg.ticketsPerPack here would just be packPrice's own loop
     copied into the test — it would agree with any off-by-one the implementation had. */
  cfg.ticketsPerPack = 2;
  state.ticketsPriced = 0;
  near(Shoe.modelPrice(), Economy.ticketCost(1) + Economy.ticketCost(2), 1e-9);
  state.ticketsPriced = 3;
  near(Shoe.modelPrice(), Economy.ticketCost(4) + Economy.ticketCost(5), 1e-9);
  /* And the joker count is what decides how many rungs: the shipped ten-joker pack consumes ten
     of them, which is what keeps the curve walking in step with the tickets actually dealt. */
  cfg.ticketsPerPack = 10;
  state.ticketsPriced = 0;
  let ten = 0;
  for (let i = 1; i <= 10; i++) ten += Economy.ticketCost(i);
  near(Shoe.modelPrice(), ten, 1e-9);
  ok(ten > Economy.ticketCost(1) + Economy.ticketCost(2), "ten rungs cost more than two");
});

/* The straddle: with 5 tickets an episode, a 2-ticket pack starting at rung 5 buys the last
   ticket of one episode and the first of the next. It needs no special case, but it is exactly
   the case an off-by-one would hide in. */
test("a pack straddling an episode boundary is priced across both", () => {
  freshRun();
  /* Two, not the shipped ten: a ten-ticket pack spans two whole episodes and lands back on a
     boundary, which is the one arrangement where an off-by-one at the join cancels out. The
     two-rung straddle is the case that actually catches it. */
  cfg.ticketsPerPack = 2;
  state.ticketsPriced = 4;
  deepEq(Economy.ticketSlot(5), { episode: 1, ticket: 5 });
  deepEq(Economy.ticketSlot(6), { episode: 2, ticket: 1 });
  near(Shoe.modelPrice(), Economy.costFor(1, 5) + Economy.costFor(2, 1), 1e-9);
});

test("minting a pack advances the curve pointer by its tickets", () => {
  freshRun();
  state.ticketsPriced = 0;
  Shoe.mintPack();
  eq(state.ticketsPriced, cfg.ticketsPerPack);
});

/* EVERY ticket walks the curve, not just the ones that arrived in a pack. A ticket from a
   mystery box, a Plot Twist card or the store did not have a pack minted for it, so if it did
   not advance the pointer here a run would reach the last episode having paid for only the
   fraction that happened to come in packs — finishing for roughly half what the model says and
   making days-to-finish meaningless. This is easy to get wrong in the direction that looks fine:
   the game still plays, it is just cheaper than designed. */
test("a ticket from outside a pack advances the curve pointer too", () => {
  freshRun();
  state.ticketsPriced = 0;
  Tickets.awardFree(3);
  eq(state.ticketsPriced, 3, "a box / card / store ticket bills its own rung");
});

test("a ticket pulled from the shoe is NOT billed twice", () => {
  freshRun();
  state.shoe = ["J1"];
  const priced = state.ticketsPriced;
  Tickets.award(1);                       // the ticket-card path: already billed at mint
  eq(state.ticketsPriced, priced, "Shoe.mintPack already charged for it");
});

test("total rungs billed equals total tickets earned, whatever the mix", () => {
  freshRun();
  state.shoe = []; state.packTail = []; state.ticketsPriced = 0; state.coins = 1e9;
  cfg.episodesInSeries = 200; Tickets.reshape();
  let earned = 0;
  for (let k = 0; k < 3; k++) {
    Shoe.buyPack();
    while (state.shoe.length) if (Shoe.isTicket(Shoe.pull())) { Tickets.award(1); earned++; }
    Tickets.awardFree(2); earned += 2;    // two boxes paid a ticket each
  }
  eq(state.ticketsPriced, earned, "every ticket earned cost exactly one rung");
  resetCfg();
});

/* costFor returns Infinity past the last curve rule, and a pack sums two of them — so an
   unpriceable pack does not disable one button, it removes the game's only coin sink. */
test("a pack stays finite far past the last authored episode", () => {
  freshRun();
  state.ticketsPriced = 1199;
  ok(isFinite(Shoe.modelPrice()) && Shoe.modelPrice() > 0, "the open-ended final segment still prices it");
});

/* A pack's price SAW-TOOTHS and that is correct: the curve ramps by ticketGrowth within an
   episode and starts the next one near the bottom again, exactly as it did across builder
   levels. The monotone quantity is the cost of a whole episode, which is what days-to-finish
   is actually a running total of — so that is what gets asserted. */
test("a pack's price saw-tooths within an episode rather than climbing monotonically", () => {
  freshRun();
  /* Two again, and for the same reason: the saw-tooth is a property of where a pack sits WITHIN
     an episode, and a pack big enough to hold whole episodes has no "within" to sit in. */
  cfg.ticketsPerPack = 2;
  state.ticketsPriced = 3;                     // rungs 4,5 — the top of episode 1
  const top = Shoe.modelPrice();
  state.ticketsPriced = 5;                     // rungs 6,7 — the bottom of episode 2
  ok(Shoe.modelPrice() < top, "the ramp resets at the episode boundary");
});

/* Within a segment the price only climbs. ACROSS one it may step down slightly: the six
   segments use baseMode "absolute" and were fitted to preserve the SUM of prices over each
   range rather than to line up at the joins, so a small discontinuity at 15/29/64/74/228 is the
   shape that reproduces the workbook's pacing. Asserting strict monotonicity would be asserting
   a curve we deliberately did not fit. */
test("episode cost climbs within a segment and only ever steps slightly at a boundary", () => {
  freshRun();
  const bounds = new Set(economy.costCurve.map(sg => sg.from));
  const episodeCost = e => {
    let t = 0;
    for (let k = 1; k <= Economy.ticketsPerEpisode(); k++) t += Economy.costFor(e, k);
    return t;
  };
  let prev = episodeCost(1);
  for (let e = 2; e <= 300; e++) {
    const c = episodeCost(e);
    ok(isFinite(c) && c > 0, `episode ${e} is unpriced`);
    if (bounds.has(e)) ok(c > prev * 0.95, `the step at segment boundary ${e} is more than 5%`);
    else ok(c >= prev - 1e-6, `episode ${e} is cheaper than ${e - 1} inside a segment`);
    prev = c;
  }
});
