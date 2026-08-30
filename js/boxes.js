"use strict";
/* Boxes — the only way anything is collected, and the one place a drop is decided.

   A box is opened the moment it is won: there is no box sitting on a tile any more. Landing on
   a deck tile hands one over, the store sells them, and later sources will do the same — every
   one of them ends here, in open(), which mutates state and hands back a plain description of
   what came out for js/ui/pack.js to present.

   THE ENGINE OWNS THE MONEY. open() has already banked the cards, coins, energy and status by
   the time it returns; the popup is told what to show, never what to pay. That is the same
   split the bonus mini-games use, and it is why a box whose animation is skipped (auto-play) or
   broken still pays exactly the same.

   ---- three tiers, three tables ----

   boxTiers (js/config.js) holds them. A tier is `items` draws from its own weighted `table`, so
   the tiers differ in BOTH how much comes out and how good it is likely to be — a Diamond Box
   is not a Silver Box with better odds, it is three draws against a table weighted at the rare
   end. The table's `kind` is what the draw resolves to:

     card    one card from the Season catalogue, at or above `floor` (js/cards.js)
     clue    one clue for the episode being worked on (js/clues.js)
     coins   `amount`, scaled by cfg.boardScale like every other payout
     energy  `amount`, topped up toward the cap and never reducing a purchased overflow

   A BOX NO LONGER DROPS STATUS ITEMS. GDD §4.5 is plain that a pack contains cards, and a shelf
   item falling out of one made the shelf the thing packs were bought for — while the Collectible
   a pack is actually working toward, the third copy of a card (§4.3), got no beat at all. So the
   status ribbon now belongs to conversion (bankedEvents, below) and the shelf is bought and
   earned, which is what js/status.js already says it is. A leftover `status` row in a tier's
   table is not an error, because a box always pays: it falls through to coins like anything else
   the draw cannot resolve.

   ---- what happens when a category is empty ----

   Every empty case falls forward rather than paying nothing: a rarity with nothing authored at
   it falls DOWN to a commoner one, and a clue with the whole story already unlocked falls to
   coins. A box always pays. */

const Boxes = {
  /* ---------------- tiers ---------------- */
  tiers() { return boxTiers; },
  tier(key) { return boxTiers.find(t => t.key === key) || null; },
  /* ---------------- what a pack costs ----------------
     Flat for Standard and Premium; ESCALATING for the Insider (GDD 6.5), by insiderStep for
     every one bought since the last episode unlocked. That is what caps sprint speed by design:
     a player can always buy the next clue, and can never buy ten of them cheaply. The count
     resets the moment an episode unlocks (Collection.claimUnlocked). */
  priceOf(key) {
    const t = this.tier(key);
    if (!t || !(t.coins > 0)) return 0;
    const base = t.coins * (+cfg.boardScale || 1);
    if (!t.escalates) return Math.round(base);
    const n = Math.max(0, state.insiderBought | 0);
    return Math.round(base * Math.pow(1 + Math.max(0, +cfg.insiderStep || 0), n));
  },
  affordable(key) { const p = this.priceOf(key); return p > 0 && state.coins >= p; },
  /* Spend and open. One place, so the store, a milestone and any future source cannot disagree
     about what a pack costs or about the Insider's counter. Returns the events, or null when it
     could not be paid for. */
  buyEvents(key) {
    const price = this.priceOf(key);
    if (!(price > 0) || state.coins < price) return null;
    state.coins -= price;
    const t = this.tier(key);
    if (t && t.escalates) state.insiderBought = Math.max(0, state.insiderBought | 0) + 1;
    return openBoxEvents(key);
  },

  /* Which pack a corner hands over — weighted, so an Insider off the board is an event. */
  drawTier() {
    const pick = weighted(deckBoxes);
    return (pick && pick.key) || (boxTiers[0] && boxTiers[0].key) || "silver";
  },

  /* The cheapest pack the balance can cover, or null. Cheapest rather than best: a Standard is
     the most DRAWS per coin, and draws are what move a collection. Used by the auto-play
     session, which is the batch balancing tool. Reads priceOf, so the Insider's escalation is
     respected rather than undercut by its base price. */
  cheapest() {
    let best = null, bestPrice = Infinity;
    boxTiers.forEach(t => {
      const p = this.priceOf(t.key);
      if (!(p > 0) || state.coins < p) return;
      if (p < bestPrice) { best = t; bestPrice = p; }
    });
    return best;
  },

  /* ---------------- opening ----------------
     Returns {tier, drops:[...]} with state already mutated. `drops` is in the order they should
     be shown; a box with items:3 hands back three. */
  open(key) {
    const t = this.tier(key) || boxTiers[0];
    const n = Math.max(1, Math.round(t.items || 1));
    const drops = [];
    /* THE INSIDER'S GUARANTEE, first and off the top (GDD 6.5): one clue you do not already
       hold. It is what makes the dearest pack the one that can never be a dud, and it is why
       the Insider is the pack you buy when the story has stalled rather than when you want
       cards. Falls through silently once every episode is unlocked — there is nothing left to
       learn, and the pack is still three draws. */
    if (t.clue === "fresh") {
      const got = Clues.grant({ fresh: true });
      if (got) drops.push({ kind: "clue", ep: got.id, clue: got.clue, isNew: got.isNew, coins: got.coins });
    }
    for (let k = 0; k < n; k++) drops.push(this.drawDrop(t));
    return { tier: t, drops };
  },
  drawDrop(t) {
    const pick = weighted(t.table) || { kind: "coins", amount: cfg.boxCoins };
    if (pick.kind === "card") return this.dropCard(pick.floor);
    if (pick.kind === "clue") return this.dropClue();
    if (pick.kind === "energy") return this.dropEnergy(pick);
    /* Everything else, INCLUDING a `status` row left in a tuned table, is coins. See the note at
       the top: a box always pays, and an unresolvable row must never be the exception. */
    return this.dropCoins(pick);
  },

  /* ---------------- the drops ---------------- */
  /* `floor` is a rarity guarantee, not a target: Cards.draw falls DOWN when a rarity has
     nothing authored at it, so a box can never hand over nothing. */
  dropCard(floor) {
    const r = Cards.drawAndAdd(floor || null);
    if (!r) return this.dropCoins({ amount: cfg.boxCoins });
    return Object.assign({ kind: "card" }, r);
  },
  /* A clue is not a card any more (GDD 6.1) — it is evidence for the episode being worked on,
     and Clues.grant() owns every rule about which one and what a repeat pays. With the story
     fully unlocked there is nothing to learn, so it falls to coins. */
  dropClue() {
    const got = Clues.grant();
    if (!got) return this.dropCoins({ amount: cfg.boxCoins });
    return Clues.dropFor(got.id, got.clue, { isNew: got.isNew, coins: got.coins });
  },
  dropCoins(pick) {
    const amount = Math.round((pick && pick.amount ? pick.amount : cfg.boxCoins) * (cfg.boardScale || 1));
    state.coins += amount;
    return { kind: "coins", amount };
  },
  dropEnergy(pick) {
    const amount = Math.max(1, Math.round((pick && pick.amount) || 3));
    grantEnergy(amount);                                      // see js/board-actor.js
    return { kind: "energy", amount };
  },

  /* ---------------- reading a result ----------------
     Small helpers the popup and the log share, so "what did this box do" is answered once. */
  coinsIn(res) { return res.drops.reduce((a, d) => a + (d.kind === "coins" ? d.amount : (d.coins || 0)), 0); },
  energyIn(res) { return res.drops.reduce((a, d) => a + (d.kind === "energy" ? d.amount : 0), 0); },
  newCardsIn(res) { return res.drops.filter(d => d.kind === "card" && d.isNew).length; },
  convertedIn(res) { return res.drops.filter(d => d.kind === "card" && d.converted).length; },
  statusIn(res) { return res.drops.reduce((a, d) => a + (d.status || 0), 0); },
};

/* ---------------- cards landing, and what follows ----------------

   Banking cards is never the whole story: a card can complete an episode's page, a third copy
   can convert and move the rank, and the last watch of a set can finish the board. Every source
   of cards owes the same three checks in the same order, and this is where they live once.

   `draw` is a CALLBACK rather than a result because the unlock snapshot has to be taken BEFORE
   anything is banked — "unlocked" is derived from the albums (CLAUDE.md), so the only way to
   know what changed is to look before and compare after. Handing over a finished result would
   be one instruction too late. */
function bankedEvents(draw){
  const before=Collection.unlockSnapshot();
  /* Snapshotted here too, because the beat that shows the status track moving needs somewhere
     to move FROM — and by the time the events are built, everything has already been banked. */
  const statusBefore=Status.points();
  const res=draw();
  const fresh=Collection.claimUnlocked(before);
  const after=[];
  /* CONVERSION IS THE BEAT (GDD §4.3). The third copy is where a card stops being a duplicate and
     becomes that card's Collectible — the object that carries Status — and until now it said so
     with a boolean on a generic `card` event, while a shelf item found in the same box got a
     whole ribbon. That had it backwards: the shelf is a side dish and conversion is what the
     collection is FOR.

     THE SAME EVENT, DELIBERATELY. A Collectible is duck-typed {name, points, art} exactly like a
     trophy, so js/ui/statusup.js, the .su* rules in the CSS and dropFace({kind:"status"}) already
     know how to draw one; a second event name would be a second thing to keep in step for no
     gain. Cards converted in the same breath count toward the same jump, which is why this reads
     the whole delta rather than each item's own points. */
  const made=(res.drops||[]).filter(d=>d.kind==="card"&&d.converted)
                            .map(d=>Cards.collectibleOf(d.id)).filter(Boolean);
  if(made.length) after.push({statusUp:{items:made,from:statusBefore,to:Status.points(),source:"converted"}});
  /* A card set finished by whatever just landed. Swept rather than checked at the call site,
     because five different things bank cards and every one of them owes the same payment — and
     because it is IDEMPOTENT: an unclaimed set stays unclaimed, so a missed sweep is a delayed
     bonus and never a lost one. A set never gates anything (GDD 4.4), so this is pure reward. */
  Cards.unclaimedSets().forEach(set=>{
    const paid=Cards.claimSet(set.key);
    if(paid) after.push({setDone:paid});
  });
  if(fresh.length) after.push({unlock:{ids:fresh}});
  /* A set is NOT over when its last card lands — it is over when its last episode has been
     watched, and an episode cannot be watched before it is collected. So the celebration lives
     at the end of the prediction flow, not here. The check is still made, because "collected
     and watched" is one predicate and one predicate should have one caller shape; it simply
     cannot be true on this path unless something upstream changes. */
  if(Collection.boardFinished()) after.push({boardDone:{board:Collection.num()}});
  return {res,after};
}

/* One box, opened, as an event list — the shape everything else in the game speaks.

   Free function rather than a method because every caller is outside a box: the Premiere corner
   (js/tiles/premiere-tile.js) and the store (js/ui/store.js). A box bought is exactly a box
   landed on, and this is what guarantees it: one code path, so the drop odds, the episode
   unlock and the board-complete check cannot diverge between them.

   State is mutated before the first event is returned. The events are presentation. */
function openBoxEvents(tierKey){
  const {res,after}=bankedEvents(()=>Boxes.open(tierKey));
  return [
    {log:{icon:res.tier.icon,msg:`<b>${res.tier.name}</b> — opening…`}},
    /* The popup blocks, so everything below it lands after the player has seen what came out. */
    {pack:res},
    {log:{icon:res.tier.icon,msg:boxSummary(res)}},
    ...after,
  ];
}

/* ONE card, drawn and banked — what a `card` row from any pool turns into (js/tiles/pool-tile.js).

   A card comes up on roughly a quarter of all landings (GDD §4.6 wants about twelve a day), so
   it cannot open the box ceremony every time. The split is the whole design of the beat:

     a card you did not have  →  held on screen, and the roll waits for it
     one you did              →  a coin float, and the board keeps moving

   That is also why a duplicate never feels like a wasted pull — it pays, quietly, at the speed
   its value deserves. `tier` narrows the draw (the Gala's "Rare or better"); null draws from
   the whole pool, and Boxes.dropCard falls forward when a tier has nothing left in it. */
function drawCardEvents(label,icon,floor){
  const ico=icon||"\ud83c\udccf";
  const {res,after}=bankedEvents(()=>({drops:[Boxes.dropCard(floor||null)]}));
  const d=res.drops[0];
  /* dropCard falls to coins only when the catalogue is empty, which validate() forbids. */
  if(d.kind!=="card")
    return [{float:{text:"+"+fmt(d.amount),color:"var(--gold)"},
             log:{icon:ico,msg:`${label} · +<b>${fmt(d.amount)}</b> coins`}},...after];
  const name=d.card?d.card.name:d.id;
  /* THREE BEATS, and the gap between them is the design (GDD 4.3):
       a card you did not have  →  held on screen
       the copy that CONVERTS   →  held on screen, and says so — this is the payoff
       any other copy           →  a coin float, and the board keeps moving */
  if(!d.isNew&&!d.converted)
    return [{float:{text:"+"+fmt(d.coins),color:"var(--gold)"},
             log:{icon:ico,msg:`${label} · ${name} \u00d7${d.count} · +<b>${fmt(d.coins)}</b> coins`}},...after];
  return [
    {float:{text:(d.converted?"\u2b50 ":"\ud83c\udccf ")+name,color:"var(--teal)"},
     log:{icon:ico,msg:d.converted
       ? `${label} · <b>${name}</b> collected \u2014 +${d.status} status`
       : `${label} · <b>${name}</b> found`}},
    /* The card's own face, not a generic panel — the collection and the box popup already
       share cardFace(), and a card drawn off a tile is the same card. */
    {card:{name,collectible:d.card,count:d.count,converted:d.converted,positive:true}},
    ...after,
  ];
}

/* One line for the activity log: what the box actually paid. */
function boxSummary(res){
  const parts=[];
  res.drops.forEach(d=>{
    if(d.kind==="card"){
      const n=d.card?d.card.name:d.id;
      if(d.isNew) parts.push(`<b>${n}</b>`);
      else if(d.converted) parts.push(`<b>${n}</b> collected!`);
      else parts.push(`${n} (dupe +${fmt(d.coins)})`);
    }
    else if(d.kind==="clue") parts.push(d.isNew?`a clue on <b>${Episodes.titleOf(d.ep)}</b>`
                                               :`a clue you had (+${fmt(d.coins)})`);
    else if(d.kind==="coins") parts.push(`+${fmt(d.amount)} coins`);
    else if(d.kind==="energy") parts.push(`+${d.amount}\u26a1`);
  });
  return parts.join(" \u00b7 ")||"nothing";
}
