"use strict";
/* Status — the player's standing, and the shelf of things that prove it.

   Content is assets/status/status.js. This file is the maths and the transaction; it never
   touches the DOM. js/ui/profile.js renders it and js/ui/render.js puts the rank in the HUD.

   ---- points come from three places ----

     items      each owned item's `points`
     watching   cfg.statusPerEpisode per episode watched
     collecting cfg.statusPerCard per card ever collected, cfg.statusPerBoard per board finished

   So play alone climbs the ranks and buying alone does not finish them. That is the whole
   design of the track: it is the one number both loops feed.

   ---- an item arrives one of three ways ----

     bought    with coins, from the profile screen
     earned    its `earn` milestone is met, and sweep() hands it over free
     found     it came out of a box (js/boxes.js)

   Every item has a price AND a milestone, deliberately — see the header in status.js. Which
   route it actually arrived by is recorded on the item, because "bought" and "earned" are
   different bragging rights and the profile says which.

   sweep() is called from the UI after anything that moves a metric (a roll, an episode, a
   card, a board). It is idempotent: an item already owned is never re-granted, so calling it
   too often costs nothing and calling it late only delays the toast. */

const Status = {
  /* ---------------- content ---------------- */
  items() { return STATUS_ITEMS; },
  item(id) { return STATUS_ITEMS.find(i => i.id === id) || null; },
  zones() { return STATUS_ZONES; },
  itemsInZone(zone) { return STATUS_ITEMS.filter(i => i.zone === zone); },

  /* ---------------- ownership ----------------
     state.status is { id: {day, how} } — how being "bought" | "earned" | "found". */
  bag() {
    if (!state.status || typeof state.status !== "object") state.status = {};
    return state.status;
  },
  owns(id) { return !!this.bag()[id]; },
  ownedIds() { return STATUS_ITEMS.filter(i => this.owns(i.id)).map(i => i.id); },
  ownedCount() { return this.ownedIds().length; },
  howGot(id) { const e = this.bag()[id]; return e ? e.how : null; },
  /* Put an item on the shelf. Returns the item, or null if it was already there — so a caller
     can announce a grant without first asking whether it landed. */
  grant(id, how) {
    const item = this.item(id);
    if (!item || this.owns(id)) return null;
    this.bag()[id] = { day: state.day, how: how || "earned" };
    return item;
  },

  /* ---------------- points and ranks ---------------- */
  /* Distinct cards ever held — the collecting half of the play score. Phase 4 replaces this
     whole scale with GDD §5's level and its four inflows; until then a card is worth a card. */
  cardsCollected() { return Object.keys(state.cards || {}).length; },
  itemPoints() { return this.ownedIds().reduce((a, id) => a + (this.item(id).points || 0), 0); },
  playPoints() {
    return Math.round(
      (cfg.statusPerEpisode || 0) * Math.max(0, state.epsWatched | 0) +
      (cfg.statusPerCard || 0) * this.cardsCollected() +
      (cfg.statusPerBoard || 0) * Math.max(0, state.boardsDone | 0));
  },
  points() { return this.itemPoints() + this.playPoints(); },

  /* Ranks, in order, first one at 0 — see STATUS_RANKS. */
  rankIndex(pts) {
    const p = pts == null ? this.points() : pts;
    let k = 0;
    STATUS_RANKS.forEach((r, i) => { if (p >= r.at) k = i; });
    return k;
  },
  rank(pts) { return STATUS_RANKS[this.rankIndex(pts)] || STATUS_RANKS[0]; },
  nextRank(pts) { return STATUS_RANKS[this.rankIndex(pts) + 1] || null; },
  /* Progress through the CURRENT rank, 0-1. The top rank reads as full rather than as a
     fraction of a span that does not exist. */
  rankProgress(pts) {
    const p = pts == null ? this.points() : pts;
    const here = this.rank(p), next = this.nextRank(p);
    if (!next) return 1;
    const span = Math.max(1, next.at - here.at);
    return Math.max(0, Math.min(1, (p - here.at) / span));
  },
  /* Points still owed to the next rank, or 0 at the top. */
  toNext(pts) {
    const p = pts == null ? this.points() : pts;
    const next = this.nextRank(p);
    return next ? Math.max(0, next.at - p) : 0;
  },

  /* ---------------- earning ---------------- */
  /* What the `earn` conditions are measured against. One place, so a new condition is a key
     here and a key in status.js rather than a new branch in the check. */
  metrics() {
    return {
      episodes: Math.max(0, state.epsWatched | 0),
      cards: this.cardsCollected(),
      boards: Math.max(0, state.boardsDone | 0),
      rolls: Math.max(0, state.rolls | 0),
    };
  },
  /* [have, need] for an item's milestone — what the profile shows under a locked item. */
  earnProgress(item) {
    const m = this.metrics(), key = Object.keys(item.earn || {})[0];
    if (!key) return null;
    return { key, have: m[key] || 0, need: item.earn[key] };
  },
  earnMet(item) {
    const m = this.metrics();
    return Object.keys(item.earn || {}).every(k => (m[k] || 0) >= item.earn[k]);
  },
  /* Hand over every item whose milestone is now met. Returns what was granted, for the toast. */
  sweep() {
    const got = [];
    STATUS_ITEMS.forEach(i => {
      if (!this.owns(i.id) && this.earnMet(i)) { this.grant(i.id, "earned"); got.push(i); }
    });
    return got;
  },

  /* ---------------- buying ---------------- */
  priceOf(item) { return Math.max(0, Math.round((item.price || 0) * (cfg.statusPriceScale || 1))); },
  canBuy(item) { return !!item && !this.owns(item.id) && this.priceOf(item) > 0 && state.coins >= this.priceOf(item); },
  /* Spend the coins and shelve it. Returns {item, cost} or null when it wasn't allowed —
     the same shape of refusal Builders.upgrade() used, so the UI reads one way. */
  buy(id) {
    const item = this.item(id);
    if (!this.canBuy(item)) return null;
    const cost = this.priceOf(item);
    state.coins -= cost;
    this.grant(id, "bought");
    return { item, cost };
  },
  /* The cheapest unowned item the balance covers, or null. The auto-play session's coin sink,
     mirroring Boxes.cheapest(). */
  cheapestBuyable() {
    let best = null;
    STATUS_ITEMS.forEach(i => {
      if (!this.canBuy(i)) return;
      const c = this.priceOf(i);
      if (!best || c < this.priceOf(best)) best = i;
    });
    return best;
  },
  /* An item nobody owns yet, drawn by its `box` weight — what a box's status slot pays out.
     Returns null once the shelf is full, which is the caller's cue to pay coins instead. */
  drawUnowned() {
    const left = STATUS_ITEMS.filter(i => !this.owns(i.id) && (i.box || 0) > 0);
    if (!left.length) return null;
    return weighted(left.map(i => ({ weight: i.box, item: i }))).item;
  },
};
