"use strict";
/* cards.js — the Season catalogue, what you own of it, and what owning it is worth (GDD §4).

   The composition tests are content tests, and they matter more than they look: "90/38/18/4" is
   a balance decision, and a typo in it is invisible in play. The game would simply feel slightly
   wrong for a whole Season. */

suite("cards: the catalogue");

test("the shipped catalogue validates clean", () => {
  deepEq(Cards.validate(), []);
});

test("GDD §4.6's shape: 150 cards, fifteen sets of ten, 90/38/18/4", () => {
  const all = Cards.all();
  eq(all.length, 150);
  eq(Cards.sets().length, 15);
  Cards.sets().forEach(s => eq(s.cards.length, 10, s.key));
  const by = {};
  all.forEach(c => { by[c.rarity] = (by[c.rarity] || 0) + 1; });
  deepEq(by, { common: 90, rare: 38, epic: 18, legendary: 4 });
});

test("the rarity weights are §4.2's 60/25/12/3 and read as percentages", () => {
  deepEq(Cards.rarities().map(r => r.weight), [60, 25, 12, 3]);
  eq(Cards.rarities().reduce((a, r) => a + r.weight, 0), 100);
});

test("rarer is worth more, at every step and on every axis", () => {
  const rs = Cards.rarities();
  for (let i = 1; i < rs.length; i++) {
    ok(rs[i].rank > rs[i - 1].rank, `${rs[i].key} rank`);
    ok(rs[i].weight < rs[i - 1].weight, `${rs[i].key} must be rarer`);
    ok(rs[i].status > rs[i - 1].status, `${rs[i].key} status`);
    ok(rs[i].dup > rs[i - 1].dup, `${rs[i].key} duplicate value`);
  }
});

test("a card knows its set and its Season without storing either", () => {
  const c = Cards.all()[0];
  const set = Cards.setForCard(c.id);
  ok(set && set.cards.includes(c), "derived from the catalogue, not from a field on the card");
  eq(Cards.setForCard("no-such-card"), null);
});

test("art is optional, and where it exists it resolves under the Season's directory", () => {
  const withArt = Cards.all().filter(c => c.art);
  ok(withArt.length > 0 && withArt.length < Cards.all().length,
     "most Commons are procedural on purpose; the top of the ladder is not");
  withArt.forEach(c => ok(Cards.artFor(c).startsWith(Cards.season().art), c.id));
  eq(Cards.artFor(Cards.all().find(c => !c.art)), null, "no art is a normal state, not a gap");
});

test("validate catches a reused id, a bad rarity and weights that no longer sum to 100", () => {
  const set = Cards.sets()[0], real = set.cards.slice();
  const w = Cards.rarities()[0].weight;
  try {
    set.cards = real.concat([{ id: Cards.all()[20].id, name: "clash", rarity: "common" },
                             { id: "brand-new", name: "?", rarity: "mythic" }]);
    Cards.rarities()[0].weight = 59;
    const errs = Cards.validate();
    ok(errs.some(e => /reuses an id/.test(e)), "the clash");
    ok(errs.some(e => /which does not exist/.test(e)), "the bad rarity");
    ok(errs.some(e => /sum to 99/.test(e)), "the broken percentage");
  } finally { set.cards = real; Cards.rarities()[0].weight = w; }
});

suite("cards: owning, and converting");

test("three copies convert, and the third is the one that pays the status", () => {
  freshRun();
  const id = Cards.all()[0].id, r = Cards.rarityOf(id);
  const a = Cards.add(id, 1);
  eq(a.isNew, true); eq(a.converted, false);
  /* A card you have never seen now pays BOTH — a share of the conversion value, so the status
     track moves on the pull, and the flat per-copy coins every copy pays. It used to pay
     nothing at all, which meant a whole session of new cards left the bar sitting still. */
  eq(a.status, Cards.firstCopyStatus(r), "a new card moves the track");
  eq(a.coins, Cards.cardCoins(), "and every copy pays a little money");
  eq(Cards.converted(id), false);
  const b = Cards.add(id, 1);
  eq(b.converted, false);
  eq(b.status, 0, "a plain duplicate is not a new card and pays no status");
  ok(b.coins > Cards.cardCoins(), "a plain duplicate always converts to something");
  const c = Cards.add(id, 1);
  eq(c.converted, true, "the third copy is the Collectible");
  eq(c.status, r.status, "and conversion is still the payoff, undiluted");
  eq(c.coins, Cards.cardCoins(), "it pays in status rather than in consolation");
  ok(Cards.converted(id));
});

test("copies past the third trickle status, so no pull is ever dead", () => {
  freshRun();
  const id = Cards.all()[0].id, r = Cards.rarityOf(id);
  Cards.add(id, 3);
  const extra = Cards.add(id, 1);
  eq(extra.status, r.trickle);
  ok(extra.coins > 0, "and it still pays coins");
});

test("adding several copies at once pays exactly what adding them one at a time would", () => {
  freshRun();
  const id = Cards.all()[0].id;
  const many = Cards.add(id, 5);
  const coinsMany = state.coins, statusMany = many.status;
  freshRun();
  let coins1 = 0, status1 = 0;
  for (let k = 0; k < 5; k++) { const r = Cards.add(id, 1); status1 += r.status; }
  coins1 = state.coins;
  eq(coinsMany, coins1, "coins");
  eq(statusMany, status1, "status");
});

test("a duplicate is worth its rarity — a Legendary dupe is not a Common dupe", () => {
  freshRun();
  const pick = k => Cards.all().find(c => c.rarity === k).id;
  const paid = k => { const id = pick(k); Cards.add(id, 1); state.coins = 0; Cards.add(id, 1); return state.coins; };
  const common = paid("common"), leg = paid("legendary");
  ok(leg > common, "rarity has to survive into the consolation or a dupe is a dupe");
});

test("what the collection is worth is derived from the copies and nothing else", () => {
  freshRun();
  eq(Cards.statusPoints(), 0);
  const id = Cards.all()[0].id, r = Cards.rarityOf(id);
  const first = Cards.firstCopyStatus(r);
  Cards.add(id, 2);
  /* Holding it pays the first-copy value ONCE however many copies are held — two copies is
     still progress rather than a Collectible, and that is the invariant this guards. The
     derived total and what add() reported must agree, or the bar would move and then snap back
     on the next render. */
  eq(Cards.statusPoints(), first, "two copies is progress, not a Collectible");
  Cards.add(id, 1);
  eq(Cards.statusPoints(), first + r.status);
  Cards.add(id, 2);
  eq(Cards.statusPoints(), first + r.status + 2 * r.trickle);
});

suite("cards: drawing");

test("draws follow the rarity weights", () => {
  freshRun();
  const hits = {}, N = 20000;
  for (let k = 0; k < N; k++) { const c = Cards.draw(); hits[c.rarity] = (hits[c.rarity] || 0) + 1; }
  Cards.rarities().forEach(r => {
    const got = (hits[r.key] || 0) / N * 100;
    near(got, r.weight, 2, `${r.key} came up ${got.toFixed(1)}% against an authored ${r.weight}%`);
  });
});

test("a floor is a GUARANTEE, not a target — never undershot, and better is allowed", () => {
  freshRun();
  const min = Cards.rarity("epic").rank;
  const seen = new Set();
  for (let k = 0; k < 3000; k++) {
    const c = Cards.draw("epic");
    ok(Cards.rarity(c.rarity).rank >= min, `${c.rarity} is below the floor`);
    seen.add(c.rarity);
  }
  ok(seen.has("legendary"), "a floor must not cap the draw at itself");
});

test("a floor with nothing authored above it falls DOWN rather than paying nothing", () => {
  freshRun();
  const set = Cards.sets()[0];
  const real = CARD_SEASONS[0].sets;
  try {
    /* A Season of Commons only, asked for a Legendary. */
    CARD_SEASONS[0].sets = [{ key: "x", name: "x", cards: set.cards.map(c => ({ ...c, rarity: "common" })) }];
    const c = Cards.draw("legendary");
    ok(c, "a draw that pays nothing is the one outcome a collection game cannot afford");
    eq(c.rarity, "common");
  } finally { CARD_SEASONS[0].sets = real; }
});

suite("cards: sets");

test("a set completes on the last card OWNED, not the last one converted", () => {
  freshRun();
  const set = Cards.sets()[0];
  set.cards.slice(0, -1).forEach(c => Cards.add(c.id, 1));
  eq(Cards.setComplete(set.key), false);
  deepEq(Cards.setProgress(set.key), [set.cards.length - 1, set.cards.length]);
  Cards.add(set.cards[set.cards.length - 1].id, 1);
  ok(Cards.setComplete(set.key), "thirty copies is a different game");
});

test("the bonus is paid once, and claiming is idempotent", () => {
  freshRun();
  const set = Cards.sets()[0];
  set.cards.forEach(c => Cards.add(c.id, 1));
  state.coins = 0;
  const paid = Cards.claimSet(set.key);
  ok(paid, "a finished set owes a bonus");
  eq(state.coins, Math.round(cfg.setBonusCoins * cfg.boardScale));
  eq(Cards.claimSet(set.key), null, "and only once");
  eq(state.coins, Math.round(cfg.setBonusCoins * cfg.boardScale));
  deepEq(Cards.unclaimedSets().map(s => s.key), [], "nothing left to sweep");
});

test("an unfinished set cannot be claimed", () => {
  freshRun();
  const set = Cards.sets()[0];
  eq(Cards.claimSet(set.key), null);
  eq(Cards.setClaimed(set.key), false);
});

test("banking the last card of a set pays for it, through whatever banked it", () => {
  freshRun();
  const set = Cards.sets()[0];
  set.cards.slice(0, -1).forEach(c => Cards.add(c.id, 1));
  const last = set.cards[set.cards.length - 1].id;
  const real = Cards.draw;
  Cards.draw = () => Cards.get(last);
  try {
    const ev = drawCardEvents("t");
    const done = ev.find(e => e.setDone);
    ok(done, "a set finished by a tile draw is still a set finished");
    eq(done.setDone.key, set.key);
    ok(Cards.setClaimed(set.key));
  } finally { Cards.draw = real; }
});

suite("cards: nothing is lost when the content changes");

/* Run `fn` with the catalogue pretending a card was never authored, always restored. This is
   what a rename, a re-cut set or a reshuffled Season looks like from a save's point of view. */
function withCardRemoved(id, fn) {
  const set = Cards.setForCard(id);
  const real = set.cards.slice();
  set.cards = real.filter(c => c.id !== id);
  try { return fn(); } finally { set.cards = real; }
}

test("banking a card remembers what it was", () => {
  freshRun();
  const c = Cards.all().find(x => x.rarity === "legendary");
  Cards.add(c.id, 1);
  const m = state.cardMeta[c.id];
  ok(m, "the record is written on the first copy");
  eq(m.r, "legendary");
  eq(m.name, c.name);
  eq(m.set, Cards.setForCard(c.id).name);
});

test("a card the catalogue forgets keeps its NAME and its RARITY", () => {
  freshRun();
  const c = Cards.all().find(x => x.rarity === "legendary");
  Cards.add(c.id, 3);
  withCardRemoved(c.id, () => {
    eq(Cards.all().some(x => x.id === c.id), false, "the catalogue really has forgotten it");
    const got = Cards.get(c.id);
    ok(got, "…but the save has not");
    eq(got.name, c.name);
    eq(got.rarity, "legendary");
    eq(got.lost, true, "and it says so, rather than passing as ordinary");
  });
});

test("…and therefore keeps its STATUS — the whole point of the record", () => {
  freshRun();
  const c = Cards.all().find(x => x.rarity === "legendary");
  const lr = Cards.rarity("legendary");
  const worth = lr.status + Cards.firstCopyStatus(lr);   // conversion, plus holding it at all
  Cards.add(c.id, 3);
  eq(Cards.statusPoints(), worth);
  withCardRemoved(c.id, () => {
    eq(Cards.statusPoints(), worth,
       "a converted Legendary must not quietly become a Common because content moved");
    eq(Cards.rarityOf(c.id).key, "legendary");
  });
});

test("a forgotten card is kept, counted and listed — never deleted", () => {
  freshRun();
  const c = Cards.all()[0];
  Cards.add(c.id, 2);
  withCardRemoved(c.id, () => {
    eq(Cards.count(c.id), 2, "the copies survive");
    deepEq(Cards.lostIds(), [c.id]);
    eq(Cards.lostCards()[0].name, c.name);
    /* …but it is not part of THIS Season's collection, so it cannot inflate the headline. */
    ok(!Cards.all().some(x => x.id === c.id));
    eq(Cards.owned(), 0, "x/150 counts the catalogue, not the bag");
  });
});

test("the record survives a save and a reload", () => {
  freshRun();
  const c = Cards.all().find(x => x.rarity === "epic");
  Cards.add(c.id, 3);
  saveState();
  freshRun();
  loadState();
  eq(state.cardMeta[c.id].r, "epic");
  withCardRemoved(c.id, () => eq(Cards.rarityOf(c.id).key, "epic"));
});

test("a save from before the record existed is covered on load", () => {
  freshRun();
  const c = Cards.all().find(x => x.rarity === "epic");
  Cards.add(c.id, 3);
  saveState();
  /* Hand-edit the slot back to what an older build wrote: cards, no cardMeta. */
  const raw = JSON.parse(localStorage.getItem("pmdrama.state.v1"));
  delete raw.cardMeta;
  localStorage.setItem("pmdrama.state.v1", JSON.stringify(raw));
  freshRun();
  loadState();
  eq(state.cardMeta[c.id].r, "epic",
     "re-derived on load, so an old collection is covered before the next card is banked");
});

test("an unreadable record degrades rather than throwing the collection away", () => {
  freshRun();
  const c = Cards.all()[0];
  Cards.add(c.id, 1);
  saveState();
  const raw = JSON.parse(localStorage.getItem("pmdrama.state.v1"));
  raw.cardMeta[c.id] = { r: "mythic", name: "" };     // a rarity this build does not have
  localStorage.setItem("pmdrama.state.v1", JSON.stringify(raw));
  freshRun();
  loadState();
  eq(state.cardMeta[c.id].r, "common", "an unknown rarity falls back rather than dropping it");
  ok(state.cardMeta[c.id].name, "and a card remembered by name beats one not remembered at all");
});
