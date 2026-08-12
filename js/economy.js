"use strict";
/* The economy model — the numbers the game is balanced around, and the rules that read them.

   This is a separate layer from `cfg` on purpose. `cfg` is the *live tuning surface*: flat
   scalars the drawer edits by hand, mixed in with presentation and camera settings. `economy`
   is the *loaded model*: a structured object that comes from a spreadsheet, carries a version,
   and knows things cfg cannot express — a segmented cost curve, an ordered series list, a
   two-item mystery box.

   The two meet in Economy.apply(), which projects the model's flat values onto cfg and rebuilds
   `twistDeck`/`boxTable`. So the tile code keeps reading cfg.stdBase and nothing downstream had to
   learn about this file. Editing a value in the drawer changes the live game; re-applying the
   model puts it back.

   Loading a workbook is js/economy-import.js. This file is the model and the maths only —
   it never touches the DOM and never parses anything. */

/* ---------------------------------------------------------------------------
   The cost curve

   cost(e, t) = base x ticketGrowth^(t-1) x e^exponent

   e is the global EPISODE number and t is which of that episode's cfg.ticketsPerEpisode
   tickets is being paid for. Before the rework this same curve priced builder LEVELS, and the
   numbers are unchanged because the mapping is 1:1: one builder of five levels became one
   episode of five tickets. That is why the six fitted segments below, the boundaries at 29 and
   74, and the whole v3.12 pacing story survive the rework verbatim.

   It is a POWER LAW in the episode index e, not an exponential. That distinction is
   the whole design: the shipped exponents grow the price 1.43x across 240 episodes, where a
   1.05^e exponential would grow 115,942x. Pacing is meant to come from the ticket ramp and the
   sheer number of episodes, not from later episodes escalating.

   ONE power law is not enough, because pacing is not one rate. The v3.12 model asks for a fast
   opening that steps down twice — 6 episodes/day, then 5 from day 5, then 4 from day 15 easing
   to 3.5 by day 60. The workbook expresses that as a rate schedule and prints the 240 resulting
   episode prices; a single e^exponent cannot follow it (the local exponent it implies swings
   between 0.008 and 0.21).

   So the curve is a LIST of segments, each its own power law over a builder range. Six of them
   reproduce the workbook's pacing to within 12 minutes on series 1 and exactly on the full run,
   with no single builder mispriced by more than 1%. They are fitted to preserve the SUM of
   prices over each range, not to minimise the worst one: days-to-finish is a cumulative total,
   so a fit that tracks the running sum beats a fit that tracks any individual price.

   The segment list is also what lets the economy bend at builder 500, then again at 550,
   without touching code. Two knobs decide what happens at a boundary:

     bIndex   "global"  — b keeps counting from builder 1, so a new exponent bends the
                          existing curve
              "segment" — b restarts at 1 inside the segment, making it its own curve
     baseMode "absolute"   — the segment's own `base` is used, which generally puts a STEP
                             in the price at the boundary
              "continuous" — `base` is solved so the segment starts exactly where the previous
                             one left off, giving a smooth bend and no step

   THE LAST SEGMENT MUST HAVE NO `to`. A bounded final segment would leave the economy with no
   rule past that builder and the game would deadlock at a price of Infinity. validateCurve()
   enforces this, and it is the one invariant here worth being loud about. */

const ECONOMY_DEFAULT = {
  /* Identity — Guide!B2 of the workbook this came from, or the model this was transcribed
     from when nothing has been imported. */
  /* BUMPED WHEN A VALUE HERE CHANGES, not only when a workbook is imported — this string IS the
     gate. js/storage.js stamps the saved config with it and drops every OWNED_CFG_KEYS entry from
     the save when it no longer matches, so changing a number here without bumping the version
     leaves anyone who has played before on their old value forever, with nothing thrown and
     nothing logged. v3.17 is v3.14 with twelve jokers added to the pack instead of two. */
  version: "Economy Model v3.17 - 52 cards + 12 jokers, segmented cost curve, 240 episodes x 5 tickets",
  filename: null,          // set on import, kept purely so a designer can see what they loaded
  loadedAt: null,          // ISO string, same reason

  /* The deck, which is what energy became. `regenMin` is minutes of game clock per free card
     and is now the ONLY pacing gate in the game: a pack earns far more coins than it costs, so
     nothing else stops a player buying packs back to back. The workbook's dailyAllowance is
     gone rather than renamed — it was imported and never read. */
  /* ticketsPerPack IS THE JOKER COUNT — the jokers are the tickets (js/shoe.js), so there is one
     number for both and never two that can disagree. Twelve rather than the natural two: at two, a
     five-ticket episode takes two and a half packs, which is a long way to walk to see the ticket
     path work at all.

     AND IT MUST DIVIDE BY THE NUMBER OF LEADS. mintPack deals jokers round-robin over Shoe.JOKERS,
     so ten across four leads is 3,3,2,2 — a permanent 50% supply advantage to the first two
     episodes of every row, forever. That was invisible while tickets were interchangeable; type
     routing (js/tickets.js) turns it into a balance defect compounding over a 240-episode run.
     Twelve gives three of each. Change the cast and this wants changing with it.

     THERE IS NO packSize HERE, deliberately. The 52 numbered cards are fixed and jokers are added
     on top, so the size is derived (Shoe.packSize(), 64 at twelve jokers) and apply() computes it.
     A packSize in this table would be a second number saying the same thing, free to drift from
     the joker count and silently eat ranks off the top of the deck when it did. Note the one
     knock-on: pack size is also the free-card cap, so a bigger pack is a slightly longer leash
     on the game's clock — 64 cards between top-ups rather than 54. */
  cards: { ticketsPerPack: 12, regenMin: 3, sessionsPerDay: 2.5, secPerPull: 5 },

  structure: { totalEpisodes: 240, ticketsPerEpisode: 5, episodesPerSeries: 60 },

  /* Six segments, fitted to the phased pacing curve v3.12 printed as 240 builder rows. The
     boundaries at 29 and 74 are the model's own: they are where its day-5 and day-15 steps land
     in builder space. The other three splits are where one power law stops tracking the schedule
     within 1%.

     v3.13 of the workbook carries these same six segments natively, in a block on its Builder
     tab, instead of the 240 rows — so this list and the spreadsheet now describe the curve the
     same way. They still have to be kept in step by hand until EconomyImport can read that
     block; see TODO.md. */
  costCurve: [
    { from: 1,   to: 14,  kind: "power", base: 158.722823, ticketGrowth: 1.5, exponent: 0.017804825,
      bIndex: "global", baseMode: "absolute" },
    { from: 15,  to: 28,  kind: "power", base: 130.940527, ticketGrowth: 1.5, exponent: 0.091685906,
      bIndex: "global", baseMode: "absolute" },
    { from: 29,  to: 63,  kind: "power", base: 113.831949, ticketGrowth: 1.5, exponent: 0.131745838,
      bIndex: "global", baseMode: "absolute" },
    { from: 64,  to: 73,  kind: "power", base:  65.134193, ticketGrowth: 1.5, exponent: 0.268494329,
      bIndex: "global", baseMode: "absolute" },
    { from: 74,  to: 227, kind: "power", base: 148.768898, ticketGrowth: 1.5, exponent: 0.074138555,
      bIndex: "global", baseMode: "absolute" },
    { from: 228,          kind: "power", base: 101.359660, ticketGrowth: 1.5, exponent: 0.146500821,
      bIndex: "global", baseMode: "absolute" },
  ],

  tiles: {
    stdBase: 40, trainSmall: 60, trainLarge: 315, trainLargeChance: 0.35,
    startPass: 100, startLand: 100, spaCards: 1, vipSeed: 60, boardScale: 1,
  },

  plotTwist: [
    { name: "Small coins",      weight: 40, coins:  30, tickets: 0, clues: 0, vip:  0 },
    { name: "Medium coins",     weight: 15, coins:  80, tickets: 0, clues: 0, vip:  0 },
    { name: "Windfall",         weight:  5, coins: 300, tickets: 0, clues: 0, vip:  0 },
    { name: "Backstage pass",    weight: 15, coins:   0, tickets: 1, clues: 0, vip:  0 },
    { name: "Insider tip",      weight: 10, coins:  50, tickets: 0, clues: 0, vip:  0 },
    { name: "Fine / Paparazzi", weight: 10, coins: -80, tickets: 0, clues: 0, vip: 80 },
    { name: "Advance to Start", weight:  5, coins:   0, tickets: 0, clues: 0, vip:  0, advance: true },
  ],

  /* Two items every box. Item 1 is always coins; item 2 is one weighted draw of three.
     The split is what supplies clues — the deck no longer pays any. */
  box: {
    boxesPerTicketCard: 1,
    item1Coins: 60,
    item2: [
      { name: "Coins",  kind: "coins",  weight: 33, amount: 60 },
      { name: "Ticket", kind: "tickets", weight: 33, amount:  1 },
      { name: "Clues",  kind: "clues",  weight: 33, amount:  2 },
    ],
  },

  prediction: {
    participation: 0.95,
    wagerSafe: 0.05, wagerConfident: 0.10, wagerMax: 0.20,
    baseAccuracy: 0.55, accuracyPerClue: 0.04, maxAccuracy: 0.70,
    avgOdds: 1.8, clueAlbumSize: 300,
  },

  /* Relative knobs, all 1.00x. They scale whole groups so the economy can move proportionally
     without editing base numbers. Deliberately separate from tiles.boardScale, which scales
     income AND cost together and so has no pacing effect at all. */
  knobs: { earn: 1, ticketCost: 1, cardSupply: 1, sessionFreq: 1, wagerAppetite: 1 },

  /* What the workbook itself predicts. Nothing reads these — they are here so a run can be
     checked against the model that produced it. */
  reference: {
    coinsPerPull: 81.275,
    coinsPerDayEngaged: 7344.126506, totalDays: 59.58355042, episodesPerDay: 4.027957352,
  },
};

let economy = JSON.parse(JSON.stringify(ECONOMY_DEFAULT));

const Economy = {
  model() { return economy; },
  version() { return economy.version; },
  isImported() { return !!economy.filename; },
  /* Human-readable provenance for the drawer. */
  describe() {
    return economy.filename
      ? `${economy.version} — ${economy.filename}`
      : `${economy.version} (built in)`;
  },

  /* ---------------- cost curve ---------------- */

  /* The segment that owns builder b (1-based, global). Later segments win on overlap, so a
     rule appended for builder 500+ takes over from the open-ended one before it. */
  segmentFor(b) {
    let found = null;
    for (const seg of economy.costCurve) {
      const from = seg.from || 1;
      if (b >= from && (seg.to == null || b <= seg.to)) found = seg;
    }
    return found;
  },

  /* The b that goes into b^exponent, honouring the segment's bIndex mode. */
  _indexIn(seg, b) { return seg.bIndex === "segment" ? (b - (seg.from || 1) + 1) : b; },

  /* A segment's effective base. "continuous" solves it so this segment's first builder costs
     exactly what the previous rule would have charged, instead of stepping. Recomputed per
     call rather than cached — the curve is edited live from the drawer and a stale cached base
     is a far nastier bug than a few multiplications. */
  _baseOf(seg) {
    if (seg.baseMode !== "continuous") return seg.base;
    const i = economy.costCurve.indexOf(seg);
    if (i <= 0) return seg.base;                 // nothing before it to continue from
    const prev = economy.costCurve[i - 1];
    const at = seg.from || 1;
    const prevLevel1 = prev.kind === "explicit"
      ? this._explicitTicket1Tail(prev)
      : prev.base * Math.pow(this._indexIn(prev, at), prev.exponent);
    if (!isFinite(prevLevel1) || prevLevel1 <= 0) return seg.base;
    return prevLevel1 / Math.pow(this._indexIn(seg, at), seg.exponent);
  },
  /* An explicit segment has no formula to extrapolate, so continuity picks up from its last
     row's level-1 price. */
  _explicitTicket1Tail(seg) {
    const rows = seg.levels || [];
    const last = rows[rows.length - 1];
    return last && last.length ? last[0] : NaN;
  },

  /* Price of ticket t (1-based) of global episode e (1-based).
     boardScale comes from cfg, not from the model: it is the live knob the drawer edits and
     every income source already reads it there, so taking it from the model would let the two
     drift apart and make board scale stop being a redenomination.

     An explicit segment's per-episode rows are still called `levels` — that is the shape the
     workbook prints, and the importer reads it verbatim. */
  costFor(e, t) {
    const seg = this.segmentFor(e);
    if (!seg) return Infinity;                   // validateCurve exists to make this unreachable
    const scale = cfg.boardScale * economy.knobs.ticketCost;
    if (seg.kind === "explicit") {
      const row = (seg.levels || [])[e - (seg.from || 1)];
      const c = row && row[t - 1];
      return c == null ? Infinity : c * scale;
    }
    return this._baseOf(seg)
      * Math.pow(seg.ticketGrowth, t - 1)
      * Math.pow(this._indexIn(seg, e), seg.exponent)
      * scale;
  },

  /* ---------------- tickets, and what a pack costs ----------------

     Tickets are bought in PACKS, never singly: a pack is cfg.packSize cards containing exactly
     cfg.ticketsPerPack of them (js/shoe.js). So the curve is walked by a running ORDINAL —
     state.ticketsPriced, the number of rungs already consumed — rather than by asking how many
     tickets the player happens to hold.

     THE POINTER ADVANCES WHEN A TICKET IS MINTED OR GRANTED, NOT WHEN ONE IS SPENT. Minting a
     pack advances it by ticketsPerPack; a ticket from a mystery box or a Plot Twist card
     advances it by one. Two consequences, both intended: buying a pack immediately raises the
     price of the next one, so stockpiling cheap packs is not a strategy; and free tickets raise
     the price of what remains, so the run's total spend still tracks the workbook's cumulative
     curve rather than falling short of it.

     The alternative — index by tickets actually banked — also looks right in a spot check and
     produces a materially different run length. This one is pinned by a test. */
  ticketsPerEpisode() { return Math.max(1, Math.round(cfg.ticketsPerEpisode || 1)); },
  /* Ticket ordinal (1-based, global) → which episode it belongs to and which of its tickets.
     Episode boundaries need no special case: with 5 per episode, ordinal 5 is (ep 1, ticket 5)
     and ordinal 6 is (ep 2, ticket 1). A pack of 2 straddling that boundary is priced correctly
     by summing the two rungs. */
  ticketSlot(n) {
    const L = this.ticketsPerEpisode();
    return { episode: Math.floor((n - 1) / L) + 1, ticket: ((n - 1) % L) + 1 };
  },
  ticketCost(n) { const s = this.ticketSlot(n); return this.costFor(s.episode, s.ticket); },
  /* What the next pack costs, given how many rungs have already been consumed. Inherits
     boardScale and the ticketCost knob from costFor — do NOT re-apply either at the call site. */
  packPrice(priced) {
    const p = Math.max(0, Math.floor(priced || 0));
    const per = Math.max(1, Math.round(cfg.ticketsPerPack || 1));
    let total = 0;
    for (let i = 1; i <= per; i++) total += this.ticketCost(p + i);
    return total;
  },

  /* Solve the exponent from pacing anchors, the way the workbook does. */
  solveExponent(a) {
    if (!a) return null;
    const { episodesSeries1: e1, daysSeries1: d1, totalEpisodes: eT, totalDays: dT } = a;
    if (!(e1 > 0 && d1 > 0 && eT > 0 && dT > 0) || e1 === eT) return null;
    return Math.log(d1 / dT) / Math.log(e1 / eT) - 1;
  },

  /* Returns a list of problems, empty when the curve is sound. Called by the importer before
     a workbook is accepted and by the drawer after a live edit. */
  validateCurve(curve) {
    const errs = [];
    if (!Array.isArray(curve) || !curve.length) return ["Cost curve is empty."];
    curve.forEach((seg, i) => {
      const where = `Cost curve segment ${i + 1}`;
      const from = seg.from;
      if (!(typeof from === "number" && isFinite(from) && from >= 1))
        errs.push(`${where}: "from" must be an episode number of 1 or more.`);
      if (seg.to != null && !(seg.to >= from))
        errs.push(`${where}: "to" (${seg.to}) is before "from" (${from}).`);
      if (i > 0) {
        const prev = curve[i - 1];
        if (prev.to == null) errs.push(`${where}: the previous segment is open-ended, so this one can never be reached.`);
        else if (from !== prev.to + 1) errs.push(`${where}: starts at ${from}, but the previous segment ends at ${prev.to} — leave no gap and no overlap.`);
      }
      if (seg.kind === "explicit") {
        if (!Array.isArray(seg.levels) || !seg.levels.length) errs.push(`${where}: an explicit segment needs a "levels" table.`);
      } else {
        ["base", "ticketGrowth", "exponent"].forEach(k => {
          if (typeof seg[k] !== "number" || !isFinite(seg[k])) errs.push(`${where}: "${k}" must be a number.`);
        });
        if (seg.ticketGrowth <= 0) errs.push(`${where}: "ticketGrowth" must be above zero.`);
      }
    });
    /* The invariant that keeps the game playable forever — and it now guards MORE than it did.
       costFor returns Infinity past the last rule and packPrice sums two of those, so a bounded
       final segment does not disable one upgrade button: it makes every future pack cost
       Infinity and takes out the game's only coin sink entirely. */
    if (curve[curve.length - 1].to != null)
      errs.push("The last cost-curve segment must have no \"to\" — without an open-ended final rule no pack past that episode can be priced, and the deck can never be bought again.");
    return errs;
  },

  /* ---------------- series ---------------- */

  /* The series as DECLARED by the model: totalEpisodes split into runs of episodesPerSeries.
     Sizes here ignore whether the content exists yet. */
  seriesPlan() {
    const s = economy.structure;
    const per = Math.max(1, Math.round(s.episodesPerSeries || 1));
    const total = Math.max(1, Math.round(s.totalEpisodes || 1));
    const out = [];
    for (let from = 1, i = 0; from <= total; i++) {
      const declared = Math.min(per, total - from + 1);
      out.push({ index: i, name: `Series ${i + 1}`, declared, from, to: from + declared - 1 });
      from += declared;
    }
    return out;
  },

  /* The series as PLAYABLE, given the episodes that actually exist. Filling an episode's last
     ticket is what unlocks it, so a series can never be longer than the content left for it:
     each series takes what it can from the remaining pool and the rest come back empty and
     stay locked. Episode numbers stay contiguous across what is really played, so the cost
     curve sees no gap when a series is short on content.

     Note the consequence for the ticket row: the last row of a series is genuinely SHORT when
     the content runs out — three placeholders, not five. Nothing may assume a full row. */
  seriesShape(available) {
    const eps = available != null
      ? available
      : (typeof Episodes !== "undefined" ? Episodes.count() : 0);
    let left = eps, from = 1;
    return this.seriesPlan().map(s => {
      const episodes = Math.max(0, Math.min(s.declared, left));
      left -= episodes;
      const shaped = { index: s.index, name: s.name, declared: s.declared, episodes, from, to: from + episodes - 1 };
      from += episodes;
      return shaped;
    });
  },
  /* Series that have content and can be played. */
  playableSeries() { return this.seriesShape().filter(s => s.episodes > 0); },
  seriesAt(i) { return this.seriesShape()[i] || null; },
  /* The series the run is currently in, falling back to the first. */
  currentSeries() {
    const i = (typeof state !== "undefined" && state && state.series) || 0;
    return this.seriesAt(i) || this.seriesAt(0);
  },
  /* Is there a next series with content in it? */
  nextSeries() {
    const i = (typeof state !== "undefined" && state && state.series) || 0;
    const s = this.seriesAt(i + 1);
    return s && s.episodes > 0 ? s : null;
  },
  /* 0-based episode slot within the current series → 1-based GLOBAL episode number, which is
     what the cost curve and the episode registry are indexed by. */
  globalEpisodeOf(slotIdx) {
    const s = this.currentSeries();
    return (s ? s.from : 1) + slotIdx;
  },

  /* ---------------- prediction ---------------- */

  /* The workbook's clue edge: every clue banked this cycle buys accuracy, up to a cap.
     Reads cfg rather than the model so the drawer can sweep it live; apply() seeds those
     three keys from the model. */
  accuracyFor(clues) {
    return Math.min(cfg.accuracyMax, cfg.accuracy + Math.max(0, clues || 0) * cfg.accuracyPerClue);
  },

  /* ---------------- wagers ---------------- */

  /* The model sizes a bet as a SHARE OF WHAT THE PLAYER HOLDS, not as a flat number, and offers
     exactly three of them. That is why there is no free slider: a bet the player can set to
     anything makes the workbook's "average wager" meaningless, and it was the flat 100-coin
     floor drifting further from the model with every builder that made this worth wiring.

     Confident is the tier the workbook's own projections assume (Inputs!C50, "the modeled
     default"); Max exists to cap a losing streak rather than to be used every time. */
  WAGER_TIERS: [
    { key: "safe",      label: "Safe",      cfgKey: "wagerSafe" },
    { key: "confident", label: "Confident", cfgKey: "wagerConfident" },
    { key: "max",       label: "Max",       cfgKey: "wagerMax" },
  ],
  DEFAULT_TIER: "confident",

  /* Each tier priced against a balance. Amounts are whole coins, never above the balance, and
     floored at cfg.minWager so an early player whose 5% is a rounding error can still bet —
     which does mean every tier reads the same until the balance clears minWager / wagerSafe. */
  wagerTiers(balance) {
    const bal = Math.max(0, Math.floor(balance || 0));
    const floor = Math.max(0, Math.round(cfg.minWager));
    return this.WAGER_TIERS.map(t => {
      const pct = Math.max(0, cfg[t.cfgKey] || 0);
      return { ...t, pct, amount: Math.min(bal, Math.max(floor, Math.round(bal * pct))) };
    });
  },
  wagerTier(key, balance) {
    return this.wagerTiers(balance).find(t => t.key === key) || null;
  },
  /* Can a bet be placed at all? Unchanged rule: the minimum has to be affordable. */
  canWager(balance) { return cfg.minWager > 0 && balance >= cfg.minWager; },

  /* ---------------- the train's two bonuses ---------------- */

  /* The train pays one of exactly two outcomes. Both the amount AND which of the two it is are
     decided here, before anything is shown, because each outcome opens its own bonus mini-game
     and the mini-game is never allowed to invent the payout — it only presents it.
     Reads cfg (not the model) so the tuning drawer stays live. */
  trainDraw() {
    const large = chance(cfg.trainLargeChance);
    return { kind: large ? "large" : "small", base: large ? cfg.trainLarge : cfg.trainSmall };
  },
  /* Derived: what the pair is worth per landing ACCORDING TO THE MODEL. Nothing pays from it — it
     is the single number the spreadsheet is reconciled against. Kept in step by apply(). */
  trainEV() {
    return cfg.trainSmall * (1 - cfg.trainLargeChance) + cfg.trainLarge * cfg.trainLargeChance;
  },

  /* ---------------- the large bonus's prize ladder ---------------- */

  /* The large bonus is presented as a three-rung ladder (minigames/gala-match3.html), but the
     model has exactly ONE number for it. So: the TOP rung is that number, the two lower rungs are
     drawn beneath it as fractions, and the winning rung is an even pick of the three.

     Consequence, deliberately not hidden: an even pick across 1/3, 2/3 and the top pays 2/3 of
     the top, so the large bonus yields 210 where the model says 315. trainRealEV() is what the
     board actually pays and trainEV() is what the sheet says; the gap is real and is tracked in
     TODO.md. To close it, anchor the ladder on its MEAN rather than its top — multiply all three
     rungs by 1.5, which makes the top rung 1.5x the model number and restores the EV exactly. */
  TRAIN_TIER_FRACS: [1 / 3, 2 / 3],   // the two lower rungs, as fractions of the top

  /* Build the ladder for one large bonus and pick its winner.
     `top` is already scaled by boardScale and the roll multiplier, so the rungs are computed at
     the size actually shown. Returns rungs ASCENDING. */
  trainLadder(top) {
    const tiers = this.TRAIN_TIER_FRACS.map(f => Math.round(top * f)).concat(top);
    return { tiers, winIndex: Math.floor(Math.random() * 3) };
  },
  /* What one large bonus is worth on average once the ladder dilutes it: an even pick of
     1/3, 2/3 and 1 of the top rung is 2/3 of the top rung. */
  trainLargeEV() {
    const f = this.TRAIN_TIER_FRACS;
    return cfg.trainLarge * (f[0] + f[1] + 1) / 3;
  },
  /* What a train landing ACTUALLY pays on average. Diverges from trainEV() by the ladder's
     dilution — compare the two rather than assuming they agree. */
  trainRealEV() {
    return cfg.trainSmall * (1 - cfg.trainLargeChance)
         + this.trainLargeEV() * cfg.trainLargeChance;
  },

  /* ---------------- projection onto cfg ---------------- */

  /* The cfg keys apply() owns. Everything else in cfg (camera, presentation, environment) is
     the designer's and is none of the model's business. js/storage.js uses this list to decide
     what a saved config may override: tweaks made against the model that is still loaded are
     kept, and tweaks made against a model that has since been replaced are dropped, so
     importing a new workbook is never masked by an old save. */
  /* Every key apply() assigns must appear here — a missing one produces no error and no
     warning, it just means a returning player keeps their old value forever and an imported
     workbook appears to do nothing for them. There is a test that walks apply() and diffs it
     against this list, because nothing else would catch it.
     There is deliberately NO pack-price key: a pack is priced per purchase from the curve
     (Economy.packPrice), never stored as a scalar that could drift from it. */
  OWNED_CFG_KEYS: ["packSize", "ticketsPerPack", "cardRegenMin", "sessionsPerDay", "secPerPull",
                   "ticketsPerEpisode",
                   "stdBase", "trainSmall", "trainLarge", "trainLargeChance", "trainEV",
                   "startPass", "startLand", "spaCards", "vipSeed",
                   "boardScale", "boxesPerTicketCard", "boxCoins", "episodesInSeries",
                   "accuracy", "accuracyPerClue", "accuracyMax", "avgOdds",
                   "wagerSafe", "wagerConfident", "wagerMax", "clueAlbumSize"],

  /* Push the model's flat values onto the live tuning surface and rebuild the editable tables.
     Everything downstream keeps reading cfg/twistDeck/boxTable exactly as before. */
  apply() {
    const e = economy;
    /* Templates and scalars only — apply() must NEVER touch state.shoe. It runs on every
       drawer edit, every series change, every loadState and every boot, so building the live
       shoe here would reshuffle a player's remaining cards each time a designer nudged a
       slider. The shoe is state; this is tuning. */
    cfg.ticketsPerPack = e.cards.ticketsPerPack;
    /* DERIVED, not copied — the model states a joker count and the pack size follows from it.
       Set after ticketsPerPack, since that is what it is derived from. Shoe loads after this
       file but apply() only ever runs at boot or later, by which point it is there. */
    cfg.packSize = Shoe.packSize();
    cfg.cardRegenMin = e.cards.regenMin;
    cfg.sessionsPerDay = e.cards.sessionsPerDay;
    cfg.secPerPull = e.cards.secPerPull;

    cfg.ticketsPerEpisode = e.structure.ticketsPerEpisode;

    cfg.stdBase = e.tiles.stdBase;
    /* The train's small/large pair now survives into cfg intact — js/tiles/train-tile.js draws
       one of the two outcomes and hands it to the matching bonus mini-game, so the felt shape
       and the modelled shape are finally the same thing. trainEV is derived and carried only so
       the model has a single number to be checked against. */
    cfg.trainSmall = e.tiles.trainSmall;
    cfg.trainLarge = e.tiles.trainLarge;
    cfg.trainLargeChance = e.tiles.trainLargeChance;
    cfg.trainEV = this.trainEV();
    cfg.startPass = e.tiles.startPass;
    cfg.startLand = e.tiles.startLand;
    cfg.spaCards = e.tiles.spaCards;
    cfg.vipSeed = e.tiles.vipSeed;
    cfg.boardScale = e.tiles.boardScale;

    cfg.boxesPerTicketCard = e.box.boxesPerTicketCard;
    cfg.boxCoins = e.box.item1Coins;

    cfg.accuracy = e.prediction.baseAccuracy;   // the no-clue floor; clues raise it per prediction
    cfg.accuracyPerClue = e.prediction.accuracyPerClue;
    cfg.accuracyMax = e.prediction.maxAccuracy;
    cfg.avgOdds = e.prediction.avgOdds;

    /* The three wager tiers, as shares of the player's balance — see wagerTiers(). */
    cfg.wagerSafe = e.prediction.wagerSafe;
    cfg.wagerConfident = e.prediction.wagerConfident;
    cfg.wagerMax = e.prediction.wagerMax;
    cfg.clueAlbumSize = e.prediction.clueAlbumSize;
    /* prediction.participation is deliberately NOT projected. It is the share of predictions
       the model expects a stake on (0.95), which in a game a human plays is an OUTCOME, not an
       input — forcing a 5% random skip would be modelling the player rather than the economy.
       What the game owes the model is the choice it presupposes, so Skip & watch is always
       offered rather than only appearing when the minimum is unaffordable. */

    twistDeck = JSON.parse(JSON.stringify(e.plotTwist));
    boxTable = JSON.parse(JSON.stringify(e.box.item2));

    /* Episodes in the CURRENT series — the number of ticket placeholders the run is playing
       toward, and the length of state.tickets. */
    const s = this.currentSeries();
    cfg.episodesInSeries = s && s.episodes > 0 ? s.episodes : 1;
  },

  /* Swap in a whole new model (from an import or a restore) and project it. */
  install(next) {
    economy = JSON.parse(JSON.stringify(next));
    this.apply();
    return economy;
  },
  reset() { return this.install(ECONOMY_DEFAULT); },
};
