"use strict";
/* The economy model — the numbers the game is balanced around, and the rules that read them.

   This is a separate layer from `cfg` on purpose. `cfg` is the *live tuning surface*: flat
   scalars the drawer edits by hand, mixed in with presentation and camera settings. `economy`
   is the *loaded model*: a structured object that comes from a spreadsheet, carries a version,
   and knows things cfg cannot express — a segmented cost curve, an ordered series list, a
   two-item mystery box.

   The two meet in Economy.apply(), which projects the model's flat values onto cfg and rebuilds
   `deck`/`boxTable`. So the tile code keeps reading cfg.stdBase and nothing downstream had to
   learn about this file. Editing a value in the drawer changes the live game; re-applying the
   model puts it back.

   Loading a workbook is js/economy-import.js. This file is the model and the maths only —
   it never touches the DOM and never parses anything. */

/* ---------------------------------------------------------------------------
   The cost curve

   cost(b, L) = base x levelGrowth^(L-1) x b^exponent
   ... which is a POWER LAW in the builder index b, not an exponential. That distinction is
   the whole design: the shipped exponents grow the price 1.43x across 240 builders, where a
   1.05^b exponential would grow 115,942x. Pacing is meant to come from the level ramp and the
   sheer number of builders, not from later builders escalating.

   ONE power law is not enough, because pacing is not one rate. The v3.12 model asks for a fast
   opening that steps down twice — 6 episodes/day, then 5 from day 5, then 4 from day 15 easing
   to 3.5 by day 60. The workbook expresses that as a rate schedule and prints the 240 resulting
   builder prices; a single b^exponent cannot follow it (the local exponent it implies swings
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
  /* The version stamp is what makes an old saved config drop the keys this model owns
     (js/storage.js). Bump it whenever an owned value changes, or a save from before the
     change quietly outvotes the new number — which is exactly how the Status track spent an
     afternoon paying 2 points an episode instead of 50. */
  version: "Economy Model v3.14 - segmented cost curve, the Status track, flat odds",
  filename: null,          // set on import, kept purely so a designer can see what they loaded
  loadedAt: null,          // ISO string, same reason

  energy: { cap: 30, regenMin: 3, sessionsPerDay: 2.5, dailyAllowance: 240, secPerRoll: 5 },

  structure: { totalBuilders: 240, levelsPerBuilder: 5, episodesPerSeries: 60 },

  /* Six segments, fitted to the phased pacing curve v3.12 printed as 240 builder rows. The
     boundaries at 29 and 74 are the model's own: they are where its day-5 and day-15 steps land
     in builder space. The other three splits are where one power law stops tracking the schedule
     within 1%.

     v3.13 of the workbook carries these same six segments natively, in a block on its Builder
     tab, instead of the 240 rows — so this list and the spreadsheet now describe the curve the
     same way. They still have to be kept in step by hand until EconomyImport can read that
     block; see TODO.md. */
  costCurve: [
    { from: 1,   to: 14,  kind: "power", base: 158.722823, levelGrowth: 1.5, exponent: 0.017804825,
      bIndex: "global", baseMode: "absolute" },
    { from: 15,  to: 28,  kind: "power", base: 130.940527, levelGrowth: 1.5, exponent: 0.091685906,
      bIndex: "global", baseMode: "absolute" },
    { from: 29,  to: 63,  kind: "power", base: 113.831949, levelGrowth: 1.5, exponent: 0.131745838,
      bIndex: "global", baseMode: "absolute" },
    { from: 64,  to: 73,  kind: "power", base:  65.134193, levelGrowth: 1.5, exponent: 0.268494329,
      bIndex: "global", baseMode: "absolute" },
    { from: 74,  to: 227, kind: "power", base: 148.768898, levelGrowth: 1.5, exponent: 0.074138555,
      bIndex: "global", baseMode: "absolute" },
    { from: 228,          kind: "power", base: 101.359660, levelGrowth: 1.5, exponent: 0.146500821,
      bIndex: "global", baseMode: "absolute" },
  ],

  tiles: {
    stdBase: 40, trainSmall: 60, trainLarge: 315, trainLargeChance: 0.35,
    startPass: 100, startLand: 100, spaEnergy: 5, vipSeed: 60, boardScale: 1,
  },

  deck: [
    { name: "Small coins",      weight: 40, coins:  30, energy: 0, clues: 0, vip:  0 },
    { name: "Medium coins",     weight: 15, coins:  80, energy: 0, clues: 0, vip:  0 },
    { name: "Windfall",         weight:  5, coins: 300, energy: 0, clues: 0, vip:  0 },
    { name: "Small energy",     weight: 15, coins:   0, energy: 2, clues: 0, vip:  0 },
    { name: "Insider tip",      weight: 10, coins:  50, energy: 0, clues: 0, vip:  0 },
    { name: "Fine / Paparazzi", weight: 10, coins: -80, energy: 0, clues: 0, vip: 80 },
    { name: "Advance to Start", weight:  5, coins:   0, energy: 0, clues: 0, vip:  0, advance: true },
  ],

  /* Two items every box. Item 1 is always coins; item 2 is one weighted draw of three.
     The split is what supplies clues — the deck no longer pays any. */
  box: {
    boxesPerUpgrade: 1,
    item1Coins: 60,
    item2: [
      { name: "Coins",  kind: "coins",  weight: 33, amount: 60 },
      { name: "Energy", kind: "energy", weight: 33, amount:  3 },
      { name: "Clues",  kind: "clues",  weight: 33, amount:  2 },
    ],
  },

  prediction: {
    participation: 0.95,
    wagerSafe: 0.05, wagerConfident: 0.10, wagerMax: 0.20,
    baseAccuracy: 0.55, accuracyPerClue: 0.04, maxAccuracy: 0.70,
    /* Flat now (GDD 7.3): every answer pays this. It was already the model's own average. */
    avgOdds: 1.8, clueAlbumSize: 300,
  },

  /* THE STATUS TRACK (GDD 5.4), which asks for exactly this: a tab of its own, and each
     source's expected contribution. It is here rather than in cfg because the Season gate is
     "the single most important value in the game" — the one number that decides how long a
     Season takes — and a number like that belongs beside the cost curve, in something with a
     version stamp, not in a scalar a saved config can quietly outvote.

     `total` is authoritative and `first` is the opening climb; the step between levels is
     SOLVED from the two (Economy.statusStep). The four per-source values are 5.1's inflows:
     the two card ones live on the rarity table and setBonusStatus, and these are the two the
     collection cannot pay for you. */
  status: {
    levels: 30, first: 200, total: 30000,
    perEpisode: 50, perPrediction: 150, perTrophy: 120,
  },

  /* Relative knobs, all 1.00x. They scale whole groups so the economy can move proportionally
     without editing base numbers. Deliberately separate from tiles.boardScale, which scales
     income AND cost together and so has no pacing effect at all. */
  knobs: { earn: 1, builderCost: 1, energySupply: 1, sessionFreq: 1, wagerAppetite: 1 },

  /* What the workbook itself predicts. Nothing reads these — they are here so a run can be
     checked against the model that produced it. */
  reference: {
    coinsPerRoll: 81.275, energyPerRoll: 0.17,
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
      ? this._explicitLevel1Tail(prev)
      : prev.base * Math.pow(this._indexIn(prev, at), prev.exponent);
    if (!isFinite(prevLevel1) || prevLevel1 <= 0) return seg.base;
    return prevLevel1 / Math.pow(this._indexIn(seg, at), seg.exponent);
  },
  /* An explicit segment has no formula to extrapolate, so continuity picks up from its last
     row's level-1 price. */
  _explicitLevel1Tail(seg) {
    const rows = seg.levels || [];
    const last = rows[rows.length - 1];
    return last && last.length ? last[0] : NaN;
  },

  /* Price of level L (1-based) on global builder b (1-based).
     boardScale comes from cfg, not from the model: it is the live knob the drawer edits and
     every income source already reads it there, so taking it from the model would let the two
     drift apart and make board scale stop being a redenomination. */
  costFor(b, level) {
    const seg = this.segmentFor(b);
    if (!seg) return Infinity;                   // validateCurve exists to make this unreachable
    const scale = cfg.boardScale * economy.knobs.builderCost;
    if (seg.kind === "explicit") {
      const row = (seg.levels || [])[b - (seg.from || 1)];
      const c = row && row[level - 1];
      return c == null ? Infinity : c * scale;
    }
    return this._baseOf(seg)
      * Math.pow(seg.levelGrowth, level - 1)
      * Math.pow(this._indexIn(seg, b), seg.exponent)
      * scale;
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
        errs.push(`${where}: "from" must be a builder number of 1 or more.`);
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
        ["base", "levelGrowth", "exponent"].forEach(k => {
          if (typeof seg[k] !== "number" || !isFinite(seg[k])) errs.push(`${where}: "${k}" must be a number.`);
        });
        if (seg.levelGrowth <= 0) errs.push(`${where}: "levelGrowth" must be above zero.`);
      }
    });
    /* The invariant that keeps the game playable forever. */
    if (curve[curve.length - 1].to != null)
      errs.push("The last cost-curve segment must have no \"to\" — without an open-ended final rule the economy stops at that builder.");
    return errs;
  },

  /* ---------------- series ---------------- */

  /* The series as DECLARED by the model: totalBuilders split into runs of episodesPerSeries.
     Sizes here ignore whether the content exists yet. */
  seriesPlan() {
    const s = economy.structure;
    const per = Math.max(1, Math.round(s.episodesPerSeries || 1));
    const total = Math.max(1, Math.round(s.totalBuilders || 1));
    const out = [];
    for (let from = 1, i = 0; from <= total; i++) {
      const declared = Math.min(per, total - from + 1);
      out.push({ index: i, name: `Series ${i + 1}`, declared, from, to: from + declared - 1 });
      from += declared;
    }
    return out;
  },

  /* The series as PLAYABLE, given the episodes that actually exist. Completing a builder is
     what unlocks an episode, so a series can never be longer than the content left for it:
     each series takes what it can from the remaining pool and the rest come back empty and
     stay locked. Builder numbers stay contiguous across what is really played, so the cost
     curve sees no gap when a series is short on content. */
  seriesShape(available) {
    const eps = available != null
      ? available
      : (typeof Episodes !== "undefined" ? Episodes.count() : 0);
    let left = eps, from = 1;
    return this.seriesPlan().map(s => {
      const builders = Math.max(0, Math.min(s.declared, left));
      left -= builders;
      const shaped = { index: s.index, name: s.name, declared: s.declared, builders, from, to: from + builders - 1 };
      from += builders;
      return shaped;
    });
  },
  /* Series that have content and can be played. */
  playableSeries() { return this.seriesShape().filter(s => s.builders > 0); },
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
    return s && s.builders > 0 ? s : null;
  },
  /* 0-based builder index within the current series → 1-based GLOBAL builder number, which is
     what the cost curve and the episode registry are indexed by. */
  globalOf(bIdx) {
    const s = this.currentSeries();
    return (s ? s.from : 1) + bIdx;
  },

  /* ---------------- the status curve (GDD 5.4) ----------------

     Thirty levels a Season, and reaching the top is the Season gate. 5.4 calls that "the single
     most important value in the game", which is why the curve lives here beside the cost curve
     rather than as a scalar in cfg.

     THE TOTAL IS THE AUTHORITATIVE KNOB. Per-level costs ramp linearly from cfg.statusFirst, and
     the step is SOLVED so the whole ramp sums to exactly cfg.statusTotal:

       total = (L−1)·first + step·(L−2)(L−1)/2   →   step = (total − (L−1)·first) / ((L−2)(L−1)/2)

     L−1 rather than L because level 1 is free: thirty levels are twenty-nine climbs.

     So moving statusTotal moves how long a Season takes and nothing else has to be re-derived —
     which is what you want from the one number the whole schedule hangs on. A step that comes
     out negative (a total too small for the opening cost) is clamped to a flat ramp rather than
     producing levels that get cheaper, which would read as a bug to anyone watching the bar.

     Returns CUMULATIVE thresholds, [0, c1, c1+c2, …], so index n is the points needed to be at
     level n+1. Length is levels; the last entry is the Season gate. */
  statusLevels() { return Math.max(2, Math.round(+cfg.statusLevels || 2)); },
  /* The total the curve is actually built to. A total smaller than the opening climb × the
     number of climbs cannot be spent on a ramp that never goes backwards, so it is raised to the
     flat floor rather than producing levels that get cheaper — which would read as a bug to
     anyone watching the bar. The drawer prints statusGate(), so what it shows is this. */
  statusTotalTarget() {
    const L = this.statusLevels(), first = Math.max(1, +cfg.statusFirst || 1);
    return Math.max((L - 1) * first, +cfg.statusTotal || 0);
  },
  statusStep() {
    const L = this.statusLevels(), first = Math.max(1, +cfg.statusFirst || 1);
    const climbs = L - 1;
    if (climbs < 2) return 0;
    return Math.max(0, (this.statusTotalTarget() - climbs * first) / ((climbs - 1) * climbs / 2));
  },
  /* What level n→n+1 costs on its own. Level 1 is free — everyone starts there.

     THE LAST CLIMB ABSORBS THE ROUNDING. Every cost is rounded to a whole number, and
     twenty-nine roundings drift by up to fourteen points — small, but it would mean the gate
     printed in the drawer and the gate the player actually has to clear were different numbers,
     and the whole point of statusTotal is that it IS the gate. So the final climb is whatever is
     left, and statusGate() lands on statusTotal exactly. */
  statusCostOf(level) {
    const L = this.statusLevels();
    if (!(level >= 1) || level >= L) return 0;
    if (level === L - 1) {
      let below = 0;
      for (let n = 1; n < L - 1; n++) below += this.statusCostOf(n);
      return Math.max(1, Math.round(this.statusTotalTarget() - below));
    }
    return Math.max(1, Math.round((+cfg.statusFirst || 1) + (level - 1) * this.statusStep()));
  },
  statusCurve() {
    const L = this.statusLevels(), out = [0];
    for (let n = 1; n < L; n++) out.push(out[n - 1] + this.statusCostOf(n));
    return out;
  },
  /* The Season gate: points to reach the top level. */
  statusGate() { const c = this.statusCurve(); return c[c.length - 1]; },

  /* ---------------- prediction ---------------- */

  /* THE FLAT PAYOUT MULTIPLIER (GDD 7.3). Every answer pays this, whichever one is picked.
     Per-answer odds leaked the answer — a 1.5 beside a 3.2 tells you which one the writers think
     is true before you have read either — and made the screen read as a betting market rather
     than a guess about a story. This number was already the model's own average, and already
     what the auto-play session priced its payouts at, so nothing in the spreadsheet moves. */
  flatMultiplier() { return Math.max(1, +cfg.avgOdds || 1); },

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
  OWNED_CFG_KEYS: ["energyCap", "regenMin", "sessionsPerDay", "secPerRoll", "tiers",
                   "stdBase", "trainSmall", "trainLarge", "trainLargeChance", "trainEV",
                   "startPass", "startLand", "spaEnergy", "vipSeed",
                   "boardScale", "boxesPerUpgrade", "boxCoins", "buildings",
                   "accuracy", "accuracyPerClue", "accuracyMax", "avgOdds",
                   "wagerSafe", "wagerConfident", "wagerMax", "clueAlbumSize",
                   "statusLevels", "statusFirst", "statusTotal",
                   "statusPerEpisode", "statusPerPrediction", "trophyStatus"],

  /* Push the model's flat values onto the live tuning surface and rebuild the editable tables.
     Everything downstream keeps reading cfg/deck/boxTable exactly as before. */
  apply() {
    const e = economy;
    cfg.energyCap = e.energy.cap;
    cfg.regenMin = e.energy.regenMin;
    cfg.sessionsPerDay = e.energy.sessionsPerDay;
    cfg.secPerRoll = e.energy.secPerRoll;

    cfg.tiers = e.structure.levelsPerBuilder;

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
    cfg.spaEnergy = e.tiles.spaEnergy;
    cfg.vipSeed = e.tiles.vipSeed;
    cfg.boardScale = e.tiles.boardScale;

    cfg.boxesPerUpgrade = e.box.boxesPerUpgrade;
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

    /* The Status track. See economy.status above on why the Season gate lives in the model. */
    cfg.statusLevels = e.status.levels;
    cfg.statusFirst = e.status.first;
    cfg.statusTotal = e.status.total;
    cfg.statusPerEpisode = e.status.perEpisode;
    cfg.statusPerPrediction = e.status.perPrediction;
    cfg.trophyStatus = e.status.perTrophy;
    /* prediction.participation is deliberately NOT projected. It is the share of predictions
       the model expects a stake on (0.95), which in a game a human plays is an OUTCOME, not an
       input — forcing a 5% random skip would be modelling the player rather than the economy.
       What the game owes the model is the choice it presupposes, so Skip & watch is always
       offered rather than only appearing when the minimum is unaffordable. */

    deck = JSON.parse(JSON.stringify(e.deck));
    boxTable = JSON.parse(JSON.stringify(e.box.item2));

    /* Builders in the CURRENT series — the shape the board and the builder list render. */
    const s = this.currentSeries();
    cfg.buildings = s && s.builders > 0 ? s.builders : 1;
  },

  /* Swap in a whole new model (from an import or a restore) and project it. */
  install(next) {
    economy = JSON.parse(JSON.stringify(next));
    this.apply();
    return economy;
  },
  reset() { return this.install(ECONOMY_DEFAULT); },
};
