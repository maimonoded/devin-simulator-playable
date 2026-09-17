"use strict";
/* js/unlock.js — the item inventory and the step-by-step unlock, plus the round trip through
   js/storage.js. The catalog is the shipped content, so the spine these walk is the real one. */

/* Stands a test wherever it needs to be on the spine without playing the game up to that point:
   marks the first n entries fully paid. */
function paidThrough(n) {
  state.paid = {};
  Catalog.spine().slice(0, n).forEach(e => { if (e.price.length) state.paid[e.key] = e.price.length; });
}

suite("items");

test("an item nobody has ever seen counts zero", () => {
  freshRun();
  eq(Items.count("cert"), 0);
  eq(Items.has("cert"), false);
});

test("add banks them and returns the new total", () => {
  freshRun();
  eq(Items.add("cert", 2), 2);
  eq(Items.add("cert", 3), 5);
  eq(Items.count("cert"), 5);
  ok(Items.has("cert", 5));
  ok(!Items.has("cert", 6));
});

test("an item the catalog does not know is refused, not banked", () => {
  freshRun();
  withQuietConsole(() => eq(Items.add("dragon", 3), 0));
  eq("dragon" in state.items, false, "storage would drop it on the next load anyway");
});

test("all() lists what is held, in the order the series declared it", () => {
  freshRun();
  Items.add("keycard", 1); Items.add("cert", 2);
  deepEq(Items.all().map(r => [r.item.id, r.count]), [["cert", 2], ["keycard", 1]]);
  ok(Items.all()[0].item.icon, "the def rides along, so a panel can draw the icon");
});

test("spend is all or nothing", () => {
  freshRun();
  Items.add("cert", 2); Items.add("ring", 1);
  eq(Items.spend({ cert: 1, ring: 2 }), false, "one of them is short");
  eq(Items.count("cert"), 2, "so the one that WAS covered is untouched");
  eq(Items.count("ring"), 1);
  eq(Items.spend({ cert: 1, ring: 1 }), true);
  eq(Items.count("cert"), 1);
  eq("ring" in state.items, false, "an emptied pile leaves no zero behind");
});

suite("unlock: reading the spine");

test("a [] price is unlocked the moment it exists", () => {
  freshRun();
  ok(Unlock.isUnlocked("series", "001"), "the first series is free");
  ok(Unlock.isUnlocked("season", "001-1"), "and so is its first season");
  ok(!Unlock.isUnlocked("episode", "001"), "the first episode is not");
  eq(Unlock.stepCount("series", "001"), 0);
});

test("current() is the first unpaid entry on the spine", () => {
  freshRun();
  eq(Unlock.current().key, "episode:001", "a new player's only target");
  paidThrough(9);                                   // series, both seasons so far, six episodes
  eq(Unlock.current().key, "episode:007");
  paidThrough(23);
  ok(Unlock.current() === null, "everything paid");
});

test("a season sits between the episodes on either side of it", () => {
  freshRun();
  paidThrough(8);                                   // series, season 1 and its six episodes
  eq(Unlock.current().key, "season:001-2", "episode 007 is behind the season gate");
});

test("stepsPaid and nextStep walk a multi-step price", () => {
  freshRun();
  const price = Unlock.price("episode", "013");
  eq(Unlock.stepCount("episode", "013"), 3);
  eq(Unlock.stepsPaid("episode", "013"), 0);
  deepEq(Unlock.nextStep("episode", "013"), price[0]);
  state.paid["episode:013"] = 1;
  deepEq(Unlock.nextStep("episode", "013"), price[1]);
  state.paid["episode:013"] = 2;
  deepEq(Unlock.nextStep("episode", "013"), price[2]);
  state.paid["episode:013"] = 3;
  ok(Unlock.nextStep("episode", "013") === null, "nothing left to pay");
  ok(Unlock.isUnlocked("episode", "013"));
});

test("a paid count is clamped to the price it belongs to", () => {
  freshRun();
  state.paid["episode:001"] = 99;                   // a price that lost steps since the save
  eq(Unlock.stepsPaid("episode", "001"), 1);
  ok(Unlock.isUnlocked("episode", "001"));
});

test("isAvailable asks the ancestors, not the spine position", () => {
  freshRun();
  ok(Unlock.isAvailable("episode", "001"), "series and season 1 are both free");
  ok(!Unlock.isAvailable("episode", "007"), "season 001-2 is still locked");
  ok(Unlock.isAvailable("series", "002"), "a series has no ancestors to wait for");
});

test("missing() is the shortfall, and empty means affordable", () => {
  freshRun();
  state.coins = 0;
  deepEq(Unlock.missing("episode", "001"), { coins: 1200, items: {} });
  state.coins = 1200;
  deepEq(Unlock.missing("episode", "001"), { coins: 0, items: {} });
  paidThrough(7); state.paid["episode:006"] = 1;    // the first step that asks for an item
  state.coins = 1600;
  deepEq(Unlock.missing("episode", "006"), { coins: 0, items: { cert: 1 } });
});

suite("unlock: paying");

test("payStep deducts the coins and advances one step", () => {
  freshRun();
  state.coins = 5000;
  const r = Unlock.payStep("episode", "001");
  ok(r, "the payment went through");
  eq(r.kind, "episode"); eq(r.id, "001");
  eq(r.step.coins, 1200, "the result carries the step that was charged");
  eq(state.coins, 3800);
  eq(Unlock.stepsPaid("episode", "001"), 1);
  eq(r.justUnlocked, true, "a one-step price finishes on its first payment");
  eq(Unlock.current().key, "episode:002", "and the spine moves on");
});

test("justUnlocked is false until the last step of a price", () => {
  freshRun();
  paidThrough(7);                                   // standing on episode 006, two steps to go
  state.coins = 99999;
  Items.add("cert", 1);
  eq(Unlock.payStep("episode", "006").justUnlocked, false, "one of two");
  eq(Unlock.payStep("episode", "006").justUnlocked, true, "two of two");
  eq(Items.count("cert"), 0, "and the item went with it");
});

test("payStep refuses when the coins are short, and deducts NOTHING", () => {
  freshRun();
  paidThrough(7); state.paid["episode:006"] = 1;    // next step: 1600 coins + one certificate
  state.coins = 1599;
  Items.add("cert", 1);
  ok(Unlock.payStep("episode", "006") === null, "refused");
  eq(state.coins, 1599, "coins untouched");
  eq(Items.count("cert"), 1, "and the item it COULD have taken is still there");
  eq(Unlock.stepsPaid("episode", "006"), 1, "the step bar did not move");
});

test("payStep refuses when an item is short, and deducts NOTHING", () => {
  freshRun();
  paidThrough(7); state.paid["episode:006"] = 1;
  state.coins = 50000;
  ok(Unlock.payStep("episode", "006") === null, "no certificate, no payment");
  eq(state.coins, 50000, "the coins it COULD have taken are still there");
  eq(Unlock.stepsPaid("episode", "006"), 1);
});

test("a step asking for two items takes both or neither", () => {
  freshRun();
  paidThrough(16); state.paid["episode:013"] = 2;   // last step: coins + one ring + one certificate
  state.coins = 99999;
  Items.add("ring", 1);                             // but no certificate
  const before = state.coins;
  ok(Unlock.payStep("episode", "013") === null);
  eq(Items.count("ring"), 1, "the ring is not taken on its own");
  eq(state.coins, before);
  Items.add("cert", 1);
  ok(Unlock.payStep("episode", "013"), "with both, it pays");
  eq(Items.count("ring"), 0);
  eq(Items.count("cert"), 0);
});

test("nothing but current() may be paid for", () => {
  freshRun();
  state.coins = 999999;
  ok(Unlock.payStep("episode", "002") === null, "the drama is serialised — 001 comes first");
  ok(Unlock.payStep("season", "001-2") === null);
  ok(Unlock.payStep("series", "002") === null);
  eq(state.coins, 999999, "and none of the refusals cost anything");
  eq(Unlock.canPay("episode", "002"), false);
  eq(Unlock.canPay("episode", "001"), true);
});

test("an already-unlocked target cannot be paid again", () => {
  freshRun();
  state.coins = 999999;
  ok(Unlock.payStep("series", "001") === null, "a free target has no step to pay");
  eq(state.coins, 999999);
});

test("payStep refuses while the board is animating", () => {
  freshRun();
  state.coins = 5000;
  state.animating = true;
  ok(Unlock.payStep("episode", "001") === null);
  eq(state.coins, 5000);
  state.animating = false;
  ok(Unlock.payStep("episode", "001"), "and goes through once the roll has finished");
});

test("unlockedEpisodeIds and progress report in story order", () => {
  freshRun();
  deepEq(Unlock.unlockedEpisodeIds(), []);
  deepEq(Unlock.progress(), { episodes: 0, total: 18 });
  paidThrough(8);
  deepEq(Unlock.unlockedEpisodeIds(), ["001", "002", "003", "004", "005", "006"]);
  deepEq(Unlock.progress(), { episodes: 6, total: 18 });
});

suite("unlock: persistence");

test("the ledger survives a save and reload", () => {
  freshRun();
  state.coins = 5000;
  Unlock.payStep("episode", "001");
  Items.add("ring", 3);
  state.watched.push("001");
  saveState();

  freshRun();
  eq(Items.count("ring"), 0, "a fresh run owns nothing");
  ok(loadState());
  eq(Unlock.stepsPaid("episode", "001"), 1);
  ok(Unlock.isUnlocked("episode", "001"));
  eq(Items.count("ring"), 3);
  deepEq(state.watched, ["001"]);
  eq(Unlock.current().key, "episode:002");
});

test("ids the catalog no longer knows are dropped on load", () => {
  freshRun();
  Items.add("cert", 2);
  state.paid["episode:001"] = 1;
  state.watched.push("001");
  saveState();
  const raw = JSON.parse(localStorage.getItem("pmdrama.state.v1"));
  raw.items.dragon = 4;                     // an item some earlier build dropped
  raw.paid["episode:404"] = 1;              // an episode that has since been cut
  raw.paid["builder:12"] = 3;               // a whole kind that no longer exists
  raw.paid["episode:001"] = 9;              // more steps than the price has
  raw.watched.push("404", "001");           // an unknown id, and a duplicate
  localStorage.setItem("pmdrama.state.v1", JSON.stringify(raw));

  freshRun();
  ok(loadState());
  eq("dragon" in state.items, false, "an unknown item is not carried");
  eq(Items.count("cert"), 2, "and the real one still is");
  eq("episode:404" in state.paid, false);
  eq("builder:12" in state.paid, false);
  eq(Unlock.stepsPaid("episode", "001"), 1, "an over-long count is clamped to the price");
  deepEq(state.watched, ["001"], "unknown and duplicate episode ids are dropped");
  clearState();
});

test("a save written before items existed still loads", () => {
  freshRun();
  state.coins = 777;
  saveState();
  const raw = JSON.parse(localStorage.getItem("pmdrama.state.v1"));
  delete raw.items; delete raw.paid; delete raw.watched;
  localStorage.setItem("pmdrama.state.v1", JSON.stringify(raw));

  freshRun();
  ok(loadState());
  eq(state.coins, 777, "the run comes back");
  deepEq(state.items, {});
  deepEq(state.paid, {});
  deepEq(state.watched, []);
  clearState();
});

/* ---------------------------------------------------------------------------
   Regressions from the first audit of the unlock build. Each of these was a
   real defect, and each is cheap to catch here.
   --------------------------------------------------------------------------- */
suite("unlock: demand-weighted item draws");

test("demand counts the whole tail of the spine, not just the next step", () => {
  freshRun();
  const need = Unlock.demand("001");
  const asked = {};
  Catalog.spine().forEach(e => e.price.forEach(s =>
    Object.entries(s.items || {}).forEach(([id, n]) => { asked[id] = (asked[id] || 0) + n; })));
  deepEq(need, asked, "with nothing paid and nothing held, demand IS the whole run's bill");
});

test("holding an item removes it from demand, and a covered item drops out entirely", () => {
  freshRun();
  const before = Unlock.demand("001");
  const id = Object.keys(before)[0];
  Items.add(id, 1);
  eq(Unlock.demand("001")[id], before[id] - 1, "one held is one less owed");
  Items.add(id, before[id]);                     // now holding more than the run asks for
  eq(id in Unlock.demand("001"), false, "a covered item stops being demanded at all");
});

test("an item the run no longer needs is never drawn", () => {
  freshRun();
  const need = Unlock.demand("001");
  const ids = Catalog.itemsOf("001").map(i => i.id);
  const dead = ids.find(i => !(i in need)) || ids[ids.length - 1];
  // cover everything except one id, so the draw has exactly one legal answer
  const want = ids.find(i => i !== dead && need[i]);
  ids.forEach(i => { if (i !== want) Items.add(i, (need[i] || 0) + 5); });
  const drawn = new Set();
  for (let k = 0; k < 200; k++) {
    /* Put back what the draw just banked. Without this the test defeats itself: 200 draws
       over-fill the one item still owed, demand empties, and the even-spread fallback fires —
       which is the code working, not failing. */
    const got = TILE_TYPES.deck.drawItem(1);
    drawn.add(got.item.id);
    state.items[got.item.id] -= 1;
  }
  deepEq([...drawn], [want], "every draw goes to the only item still owed");
});

test("the draw falls back to an even spread when the run owes nothing", () => {
  freshRun();
  Catalog.itemsOf("001").forEach(i => Items.add(i.id, 500));   // everything covered
  const drawn = new Set();
  for (let k = 0; k < 300; k++) drawn.add(TILE_TYPES.deck.drawItem(1).item.id);
  ok(drawn.size > 1, "a card with nothing outstanding still pays, across the whole set");
});

suite("unlock: the stake scales items like it scales coins");

test("an item card grants its count times the multiplier", () => {
  freshRun();
  const got = TILE_TYPES.deck.drawItem(1 * 5);
  eq(got.count, 5);
  eq(Items.count(got.item.id), 5, "and that is what actually lands in the bag");
});

suite("unlock: paying is all or nothing");

test("a refused step leaves coins AND items exactly where they were", () => {
  freshRun();
  const cur = Unlock.current();
  const step = Unlock.nextStep(cur.kind, cur.id);
  state.coins = (step.coins || 0) - 1;                 // one coin short, deliberately
  Object.entries(step.items || {}).forEach(([id, n]) => Items.add(id, n));
  const coinsBefore = state.coins;
  const itemsBefore = JSON.stringify(state.items);
  eq(Unlock.payStep(cur.kind, cur.id), null, "refused");
  eq(state.coins, coinsBefore, "not one coin taken");
  eq(JSON.stringify(state.items), itemsBefore, "not one item taken");
  eq(Unlock.stepsPaid(cur.kind, cur.id), 0, "and the bar did not move");
});

/* ---------------------------------------------------------------------------
   The whole remaining price. This is what the "ready to unlock" popup asks
   about — it fires only when a target can be cleared outright.
   --------------------------------------------------------------------------- */
suite("unlock: paying a target outright");

/* Find an episode with more than one step, so the all-vs-next distinction is real — and make it
   the CURRENT target, since nothing but current() can be paid for. Marking the entries before it
   as fully paid is exactly what playing up to it would do. */
function multiStepEpisode() {
  const spine = Catalog.spine();
  const k = spine.findIndex(e => e.kind === "episode" && e.price.length > 1);
  spine.slice(0, k).forEach(e => { state.paid[e.key] = e.price.length; });
  return spine[k];
}

test("remaining sums every unpaid step, and shrinks as they are paid", () => {
  freshRun();
  const ep = multiStepEpisode();
  ok(ep, "the content has a multi-step episode to test with");
  eq(Unlock.current().key, Catalog.key(ep.kind, ep.id), "and it is the current target");
  const all = Unlock.remaining(ep.kind, ep.id);
  const summed = ep.price.reduce((a, s) => a + (s.coins || 0), 0);
  eq(all.coins, summed, "every step's coins, not just the next one's");

  state.paid[Catalog.key(ep.kind, ep.id)] = 1;          // pretend the first step is done
  eq(Unlock.remaining(ep.kind, ep.id).coins, summed - (ep.price[0].coins || 0),
     "a paid step stops being owed");
});

test("canPayAll is strictly stronger than canPay", () => {
  freshRun();
  const ep = multiStepEpisode();
  /* Afford exactly the first step and nothing more. */
  const first = ep.price[0];
  state.coins = first.coins;
  Object.entries(first.items || {}).forEach(([it, n]) => Items.add(it, n));
  ok(Unlock.canPay(ep.kind, ep.id), "the next step is affordable");
  eq(Unlock.canPayAll(ep.kind, ep.id), false, "but the whole thing is not");
});

test("payAll clears every step and reports the unlock", () => {
  freshRun();
  const ep = multiStepEpisode();
  const need = Unlock.remaining(ep.kind, ep.id);
  state.coins = need.coins;
  Object.entries(need.items).forEach(([it, n]) => Items.add(it, n));

  const res = Unlock.payAll(ep.kind, ep.id);
  ok(res, "it went through");
  eq(res.steps.length, ep.price.length, "every step charged");
  eq(res.justUnlocked, true);
  ok(Unlock.isUnlocked(ep.kind, ep.id));
  eq(state.coins, 0, "and it cost exactly what remaining() said");
  Object.keys(need.items).forEach(it => eq(Items.count(it), 0));
});

test("payAll refuses outright rather than paying part of the price", () => {
  freshRun();
  const ep = multiStepEpisode();
  const need = Unlock.remaining(ep.kind, ep.id);
  state.coins = need.coins - 1;                          // one coin short of the whole thing
  Object.entries(need.items).forEach(([it, n]) => Items.add(it, n));

  const coinsBefore = state.coins, itemsBefore = JSON.stringify(state.items);
  eq(Unlock.payAll(ep.kind, ep.id), null, "refused");
  eq(state.coins, coinsBefore, "not one coin taken");
  eq(JSON.stringify(state.items), itemsBefore, "not one item taken");
  eq(Unlock.stepsPaid(ep.kind, ep.id), 0, "and no step was banked");
});

test("payAll refuses anything that is not the current target", () => {
  freshRun();
  state.coins = 1e9;
  const later = Catalog.spine().filter(e => e.kind === "episode")[4];
  eq(Unlock.canPayAll(later.kind, later.id), false, "the story still runs in order");
  eq(Unlock.payAll(later.kind, later.id), null);
});
