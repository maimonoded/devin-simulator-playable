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
   the whole design: b^0.0498 grows 1.31x across 240 builders, where a 1.05^b exponential
   grows 115,942x. Pacing is meant to come from the level ramp and the sheer number of
   builders, not from later builders escalating.

   The exponent is DERIVED from four pacing anchors, not typed:
       exponent = LN(daysSeries1 / totalDays) / LN(episodesSeries1 / totalEpisodes) - 1
   The anchors ride along in each segment so a future segment can be re-solved rather than
   guessed at.

   The curve is a LIST of segments because no single formula holds forever. Each segment owns
   a builder range and its own rule, so the economy can bend at builder 500, then again at 550,
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
  /* Identity — Guide!B2 of the workbook this came from. The built-in default carries the same
     string the shipped v3 workbook does, so a fresh install and a v3 import agree. */
  version: "Economy Model v3 - 240 builders / 240 episodes",
  filename: null,          // set on import, kept purely so a designer can see what they loaded
  loadedAt: null,          // ISO string, same reason

  energy: { cap: 30, regenMin: 3, sessionsPerDay: 2.5, dailyAllowance: 240, secPerRoll: 5 },

  structure: { totalBuilders: 240, levelsPerBuilder: 5, episodesPerSeries: 60 },

  costCurve: [
    { from: 1, kind: "power", base: 164, levelGrowth: 1.5, exponent: 0.0497678368,
      bIndex: "global", baseMode: "absolute",
      anchors: { episodesSeries1: 60, daysSeries1: 14, totalEpisodes: 240, totalDays: 60 } },
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
    avgOdds: 1.8, clueAlbumSize: 300,
  },

  /* Relative knobs, all 1.00x. They scale whole groups so the economy can move proportionally
     without editing base numbers. Deliberately separate from tiles.boardScale, which scales
     income AND cost together and so has no pacing effect at all. */
  knobs: { earn: 1, builderCost: 1, energySupply: 1, sessionFreq: 1, wagerAppetite: 1 },

  /* What the workbook itself predicts. Nothing reads these — they are here so a run can be
     checked against the model that produced it. */
  reference: {
    coinsPerRoll: 81.275, energyPerRoll: 0.17,
    coinsPerDayEngaged: 7344.126506, totalDays: 59.42593271, episodesPerDay: 4.03864086,
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

  /* ---------------- prediction ---------------- */

  /* The workbook's clue edge: every clue banked this cycle buys accuracy, up to a cap.
     Reads cfg rather than the model so the drawer can sweep it live; apply() seeds those
     three keys from the model. */
  accuracyFor(clues) {
    return Math.min(cfg.accuracyMax, cfg.accuracy + Math.max(0, clues || 0) * cfg.accuracyPerClue);
  },

  /* ---------------- projection onto cfg ---------------- */

  /* The cfg keys apply() owns. Everything else in cfg (camera, presentation, environment) is
     the designer's and is none of the model's business. js/storage.js uses this list to decide
     what a saved config may override: tweaks made against the model that is still loaded are
     kept, and tweaks made against a model that has since been replaced are dropped, so
     importing a new workbook is never masked by an old save. */
  OWNED_CFG_KEYS: ["energyCap", "regenMin", "sessionsPerDay", "secPerRoll", "tiers",
                   "stdBase", "trainEV", "startPass", "startLand", "spaEnergy", "vipSeed",
                   "boardScale", "boxesPerUpgrade", "boxCoins", "buildings",
                   "accuracy", "accuracyPerClue", "accuracyMax", "avgOdds"],

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
    /* The board still pays the train from an EV plus a spread (js/tiles/train-tile.js); the
       workbook parameterises it from the other end, as a small/large pair. Derive the EV so
       the money matches even though the felt shape does not. See TODO.md. */
    cfg.trainEV = e.tiles.trainSmall * (1 - e.tiles.trainLargeChance)
                + e.tiles.trainLarge * e.tiles.trainLargeChance;
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
