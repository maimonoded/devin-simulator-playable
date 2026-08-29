"use strict";
/* Status — the player's standing, as a LEVEL that resets every Season.

   Content is assets/status/status.js. This file is the maths and the transaction; it never
   touches the DOM. js/ui/profile.js renders it and js/ui/render.js puts the band in the HUD.

   ---- four inflows, all of them derived ----

   GDD §5.1. There is no stored score, because every one of these is already written down
   somewhere else and a second copy would only drift:

     converting   a card's third copy turns it into a Collectible worth its rarity, and copies
                  past that trickle                                    (js/cards.js)
     completing   a set of ten                                         (cfg.setBonusStatus)
     watching     cfg.statusPerEpisode an episode                      (state.epsWatched)
     predicting   cfg.statusPerPrediction a correct call               (state.predWins)

   The shelf items are Collectibles too — granted whole rather than converted, and the seed of
   the Showcase (§5.2). So a player who never spends a coin still climbs, and a player who buys
   the whole shelf still has to watch the show and call it right to finish a Season.

   ---- the one thing that IS stored ----

   `state.seasonFrom` — those same four totals at the moment the current Season began. Points
   this Season are the difference. That is what lets §5.3's reset take Status to zero while the
   collection, the Showcase and the lifetime prediction record all persist: nothing is deleted,
   the line just moves.

   ---- the level ----

   The curve is Economy.statusCurve() and lives in the economy model, because §5.4 calls the
   Season gate "the single most important value in the game". Reaching the top level IS the
   Season gate.

   ---- an item arrives one of three ways ----

     bought    with coins, from the profile screen
     earned    its `earn` milestone is met, and sweep() hands it over free
     found     it came out of a box (js/boxes.js)

   Every item has a price AND a milestone, deliberately. Which route it actually arrived by is
   recorded, because "bought" and "earned" are different bragging rights.

   sweep() is idempotent, so calling it too often costs nothing and calling it late only delays
   a toast. So is milestoneSweep(). */

const Status = {
  /* ---------------- content ---------------- */
  items() { return STATUS_ITEMS; },
  item(id) { return STATUS_ITEMS.find(i => i.id === id) || null; },
  zones() { return STATUS_ZONES; },
  itemsInZone(zone) { return STATUS_ITEMS.filter(i => i.zone === zone); },
  milestones() { return STATUS_MILESTONES; },

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

  /* ---------------- trophies (GDD 7.4) ----------------
     A "Called It" — one per episode, unique, and only ever earned by calling that episode right.
     They are Showcase pieces rather than catalogue cards: a card can be pulled from a box and
     this cannot, which is the whole point of it. Derived from the episode list, so a trophy needs
     no content of its own beyond the episode already having a title. */
  trophyBag() {
    if (!state.trophies || typeof state.trophies !== "object") state.trophies = {};
    return state.trophies;
  },
  hasTrophy(id) { return !!this.trophyBag()[id]; },
  trophyIds() { return Episodes.ids().filter(id => this.hasTrophy(id)); },
  trophyOf(id) {
    return { id, name: `Called it · ${Episodes.titleOf(id)}`, ep: id,
             points: Math.max(0, Math.round(+cfg.trophyStatus || 0)),
             art: "assets/status/called-it.webp" };
  },
  /* Returns the trophy, or null if it was already won — so a caller can announce without first
     asking whether it landed, exactly like grant(). */
  grantTrophy(id) {
    if (id == null || !Episodes.has(id) || this.hasTrophy(id)) return null;
    this.trophyBag()[id] = state.day | 0;
    return this.trophyOf(id);
  },
  trophyPoints() { return this.trophyIds().length * Math.max(0, Math.round(+cfg.trophyStatus || 0)); },

  /* ---------------- the four inflows ---------------- */
  itemPoints() { return this.ownedIds().reduce((a, id) => a + (this.item(id).points || 0), 0); },
  /* Everything ever earned, across every Season. The Showcase's number, and what the Season
     baseline is measured against. */
  lifetime() {
    return Math.round(
      Cards.statusPoints() +
      this.itemPoints() + this.trophyPoints() +
      (+cfg.statusPerEpisode || 0) * Math.max(0, state.epsWatched | 0) +
      (+cfg.statusPerPrediction || 0) * Math.max(0, state.predWins | 0));
  },
  /* Where this Season started. Missing means "this Season began at zero", which is the honest
     reading of a save from before Seasons existed. */
  seasonFrom() { return Math.max(0, (state.seasonFrom | 0)); },
  /* Points THIS Season — what the level is read off. Clamped at zero because the baseline is a
     snapshot and the things it counts can, in principle, be edited downward in the drawer. */
  points() { return Math.max(0, this.lifetime() - this.seasonFrom()); },
  /* What each inflow has contributed this Season. Nothing in the game loop needs this; the
     tuning drawer does, and §5.4 asks for exactly this breakdown. */
  breakdown() {
    const eps = (+cfg.statusPerEpisode || 0) * Math.max(0, state.epsWatched | 0);
    const wins = (+cfg.statusPerPrediction || 0) * Math.max(0, state.predWins | 0);
    return [
      { key: "cards",   name: "Collectibles",   points: Math.round(Cards.statusPoints()) },
      { key: "items",   name: "The Showcase",   points: this.itemPoints() + this.trophyPoints() },
      { key: "watched", name: "Episodes watched", points: Math.round(eps) },
      { key: "called",  name: "Predictions called", points: Math.round(wins) },
    ];
  },

  /* ---------------- the level ---------------- */
  maxLevel() { return Economy.statusLevels(); },
  curve() { return Economy.statusCurve(); },
  /* 1-based. The curve is cumulative, so this is "how many thresholds have been passed". */
  level(pts) {
    const p = pts == null ? this.points() : pts;
    const c = this.curve();
    let lv = 1;
    for (let n = 1; n < c.length; n++) if (p >= c[n]) lv = n + 1;
    return lv;
  },
  /* Points at which a level opens, and what the next one costs. */
  levelAt(lv) { const c = this.curve(); return c[Math.max(0, Math.min(c.length - 1, (lv | 0) - 1))] || 0; },
  /* Progress through the CURRENT level, 0-1. The top level reads as full rather than as a
     fraction of a span that does not exist. */
  levelProgress(pts) {
    const p = pts == null ? this.points() : pts;
    const lv = this.level(p);
    if (lv >= this.maxLevel()) return 1;
    const here = this.levelAt(lv), next = this.levelAt(lv + 1);
    const span = Math.max(1, next - here);
    return Math.max(0, Math.min(1, (p - here) / span));
  },
  /* Points still owed to the next level, or 0 at the top. */
  toNextLevel(pts) {
    const p = pts == null ? this.points() : pts;
    const lv = this.level(p);
    if (lv >= this.maxLevel()) return 0;
    return Math.max(0, this.levelAt(lv + 1) - p);
  },

  /* ---------------- the named bands ----------------
     A band is five levels and carries the title the profile and the HUD show. Keyed by level,
     not by points: a level is what the player watches. */
  rankIndex(pts) {
    const lv = this.level(pts);
    let k = 0;
    STATUS_RANKS.forEach((r, i) => { if (lv >= r.from) k = i; });
    return k;
  },
  rank(pts) { return STATUS_RANKS[this.rankIndex(pts)] || STATUS_RANKS[0]; },
  nextRank(pts) { return STATUS_RANKS[this.rankIndex(pts) + 1] || null; },
  /* Levels still owed to the next band, or 0 at the top. */
  toNextRank(pts) {
    const next = this.nextRank(pts);
    return next ? Math.max(0, next.from - this.level(pts)) : 0;
  },

  /* ---------------- milestones (§5.3) ----------------
     Every five levels. Claimed once, and THAT is the one thing stored — "was this given" is not
     derivable from a level that only goes up. */
  claimedMilestones() {
    if (!state.statusMilestones || typeof state.statusMilestones !== "object") state.statusMilestones = {};
    return state.statusMilestones;
  },
  milestoneClaimed(level) { return !!this.claimedMilestones()[String(level)]; },
  /* Every milestone reached and not yet paid. Derived, so the sweep is idempotent. */
  pendingMilestones() {
    const lv = this.level();
    return STATUS_MILESTONES.filter(m => lv >= m.level && !this.milestoneClaimed(m.level));
  },
  /* Pay one. Mutates state and returns what it gave, for the caller to present. Returns null
     when it was not owed, so a double sweep costs nothing. */
  claimMilestone(level) {
    const m = STATUS_MILESTONES.find(x => x.level === level);
    if (!m || this.level() < m.level || this.milestoneClaimed(m.level)) return null;
    this.claimedMilestones()[String(m.level)] = state.day | 0;
    const paid = { milestone: m, clues: [], energy: 0, tier: null };
    if (m.kind === "clues") {
      /* A clue cache is what couples the two tracks (§5.3): the Status track buying story
         progress is the reason climbing it is worth doing. */
      for (let k = 0; k < Math.max(1, m.amount | 0); k++) {
        const got = Clues.grant();
        if (got) paid.clues.push(got);
      }
    } else if (m.kind === "energy") {
      paid.energy = Math.max(1, m.amount | 0);
      grantEnergy(paid.energy);
    } else if (m.kind === "pack") {
      paid.tier = m.tier || "silver";
    }
    return paid;
  },
  /* Everything owed, in level order. */
  milestoneSweep() {
    return this.pendingMilestones()
      .map(m => this.claimMilestone(m.level))
      .filter(Boolean);
  },

  /* ---------------- the Season (§5.3) ----------------
     Reaching the top level is the gate. Turning the Season over moves the baseline — it deletes
     nothing — and points the board, the catalogue and the cast at the next Season's content. */
  seasonReady() { return this.level() >= this.maxLevel(); },
  hasNextSeason() {
    const n = (state.season | 0) + 1;
    return !!(BOARD_SEASONS[n] && CARD_SEASONS[n]);
  },
  advanceSeason() {
    if (!this.seasonReady() || !this.hasNextSeason()) return null;
    state.season = (state.season | 0) + 1;
    /* THE LINE MOVES; NOTHING IS DELETED. The collection, the Showcase and the lifetime
       prediction record all persist (§5.3) — Status reads as zero because the baseline caught
       up with the total, not because anything was thrown away. */
    state.seasonFrom = this.lifetime();
    state.statusMilestones = {};
    state.seasonsDone = Math.max(0, state.seasonsDone | 0) + 1;
    return { season: state.season, name: (BOARD_SEASONS[state.season] || {}).name || "" };
  },

  /* ---------------- earning an item ---------------- */
  /* What the `earn` conditions are measured against. One place, so a new condition is a key
     here and a key in status.js rather than a new branch in the check. */
  metrics() {
    return {
      episodes: Math.max(0, state.epsWatched | 0),
      cards: Object.keys(state.cards || {}).length,
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
  /* The earn condition, IN ENGLISH — "collecting 5 cards", "watching 3 episodes".

     Every surface that shows a status item has to explain why the player has it or how they
     would get it, and until now none of them could: the condition was a {cards:5} object and
     each caller would have had to invent its own phrasing. One function so the reward beat and
     the profile say the same words about the same item.

     The plural is handled here rather than by a caller remembering to: "1 cards" is the kind of
     thing that survives review and then reads as a bug in a screenshot. */
  earnWords(item) {
    const key = Object.keys((item && item.earn) || {})[0];
    if (!key) return "";
    const n = item.earn[key];
    const one = n === 1;
    switch (key) {
      case "cards":    return `collecting ${n} card${one ? "" : "s"}`;
      case "episodes": return `watching ${n} episode${one ? "" : "s"}`;
      case "rolls":    return `${n} rolls`;
      case "boards":   return `finishing ${n} set${one ? "" : "s"}`;
      default:         return `${n} ${key}`;
    }
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

  /* ---------------- validation ---------------- */
  validate() {
    const errs = [];
    if (!STATUS_RANKS.length || STATUS_RANKS[0].from !== 1)
      errs.push("The first status band must open at level 1 — a player at level 1 still has a standing.");
    STATUS_RANKS.forEach((r, i) => {
      if (i && r.from <= STATUS_RANKS[i - 1].from) errs.push(`Status band "${r.name}" does not open above the one before it.`);
      if (r.from > this.maxLevel()) errs.push(`Status band "${r.name}" opens at level ${r.from}, past the Season's ${this.maxLevel()}.`);
    });
    STATUS_ITEMS.forEach(i => {
      if (!(i.points > 0)) errs.push(`Status item "${i.id}" is worth nothing.`);
      if (!(i.price > 0)) errs.push(`Status item "${i.id}" has no coin price — every item is buyable AND earnable.`);
      if (!i.earn || !Object.keys(i.earn).length) errs.push(`Status item "${i.id}" has no play milestone.`);
      if (!STATUS_ZONES.some(z => z.key === i.zone)) errs.push(`Status item "${i.id}" is in zone "${i.zone}", which does not exist.`);
    });
    STATUS_MILESTONES.forEach(m => {
      if (!(m.level >= 1 && m.level <= this.maxLevel())) errs.push(`Milestone at level ${m.level} is outside the Season.`);
      if (!["clues", "energy", "pack"].includes(m.kind)) errs.push(`Milestone at level ${m.level} pays "${m.kind}", which is not a thing.`);
      if (m.kind === "pack" && !Boxes.tier(m.tier)) errs.push(`Milestone at level ${m.level} pays a "${m.tier}" box, which does not exist.`);
    });
    return errs;
  },
};
