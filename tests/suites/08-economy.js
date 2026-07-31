"use strict";
/* economy.js — the model, the series shape, the clue edge
   economy-import.js — the structural gate a workbook has to pass

   The importer is tested against a STUB workbook rather than a real .xlsx, because the file
   format is js/xlsx.js's problem and it needs a browser. What matters here is the validation:
   that a workbook whose layout has shifted is refused rather than half-imported. */

suite("economy: cost curve");

test("solveExponent reproduces the workbook's derived value", () => {
  // Inputs!C17 = LN(C15/C16)/LN(C14/C12)-1, which the shipped sheet prints as 0.0497678368
  near(Economy.solveExponent({ episodesSeries1: 60, daysSeries1: 14, totalEpisodes: 240, totalDays: 60 }),
       0.0497678368, 1e-9);
  eq(Economy.solveExponent({ episodesSeries1: 60, daysSeries1: 14, totalEpisodes: 60, totalDays: 60 }), null,
     "equal episode anchors have no solution");
  eq(Economy.solveExponent(null), null);
});

test("the shipped curve tracks the workbook's builder-1 prices to within 1%", () => {
  resetCfg();
  /* Builder!C6:G6 in economy model v3.12. The fit is deliberately not exact — the six segments
     are chosen to preserve the cumulative cost that sets pacing, so any single builder may sit
     up to 1% either side of the sheet. */
  [160.2752, 240.4128, 360.6193, 540.9289, 811.3933].forEach((want, i) => {
    const got = Economy.costFor(1, i + 1);
    ok(Math.abs(got - want) / want < 0.01, `level ${i + 1}: ${got.toFixed(4)} vs ${want}`);
  });
});

test("no builder anywhere in the run is mispriced by more than 1%", () => {
  resetCfg();
  /* The whole point of six segments rather than three. Spot-checked against the sheet at the
     segment boundaries, where a fitted curve is at its worst. */
  [[1, 160.2752], [14, 167.8050], [15, 168.4630], [28, 178.3957], [29, 179.0620],
   [63, 198.3581], [64, 199.0873], [73, 206.2506], [74, 206.7320], [227, 224.4166],
   [228, 224.5554], [240, 226.2492]].forEach(([b, want]) => {
    const got = Economy.costFor(b, 1);
    ok(Math.abs(got - want) / want < 0.01, `builder ${b}: ${got.toFixed(4)} vs ${want}`);
  });
});

test("the six segments reproduce the model's pacing", () => {
  resetCfg();
  /* This is the contract the fit was built to keep. Days come from cumulative cost: a builder
     takes however long it takes to earn its price, net of the box income the model credits
     against it. Series 1 lands within a quarter of an hour and the full run within a minute. */
  const COINS_PER_DAY = 7344.126506, BOX_INCOME = 889.608434;
  let cum = 0;
  const days = [];
  for (let b = 1; b <= 240; b++) {
    let gross = 0;
    for (let L = 1; L <= 5; L++) gross += Economy.costFor(b, L);
    cum += (gross - BOX_INCOME) / COINS_PER_DAY;
    days.push(cum);
  }
  near(days[59], 11.9555, 0.02, "series 1 — Progression!E6");
  near(days[239], 59.5836, 0.01, "the full run — Progression!C11");
  eq(days.filter(d => d <= 14).length, 68, "builders finished by day 14, the pace that was asked for");
});

test("segmentFor picks the rule that owns a builder, and the open-ended one owns the tail", () => {
  const saved = Economy.model().costCurve;
  Economy.model().costCurve = [
    { from: 1, to: 10, kind: "power", base: 100, levelGrowth: 1.5, exponent: 0.05, bIndex: "global", baseMode: "absolute" },
    { from: 11, kind: "power", base: 200, levelGrowth: 1.5, exponent: 0.05, bIndex: "global", baseMode: "absolute" },
  ];
  eq(Economy.segmentFor(10).base, 100);
  eq(Economy.segmentFor(11).base, 200);
  eq(Economy.segmentFor(999999).base, 200, "the last rule never runs out");
  Economy.model().costCurve = saved;
});

test("bIndex 'segment' restarts the builder index inside the segment", () => {
  const saved = Economy.model().costCurve;
  Economy.model().costCurve = [
    { from: 1, to: 10, kind: "power", base: 100, levelGrowth: 2, exponent: 0.5, bIndex: "global", baseMode: "absolute" },
    { from: 11, kind: "power", base: 100, levelGrowth: 2, exponent: 0.5, bIndex: "segment", baseMode: "absolute" },
  ];
  near(Economy.costFor(11, 1), 100, 1e-9, "builder 11 is the segment's b=1, so it pays the bare base");
  near(Economy.costFor(14, 1), 100 * Math.pow(4, 0.5), 1e-9, "and builder 14 is its b=4");
  Economy.model().costCurve = saved;
});

suite("economy: series");

test("seriesPlan splits the declared builders into runs of one series each", () => {
  const plan = Economy.seriesPlan();
  eq(plan.length, 4, "240 builders at 60 per series");
  eq(plan[0].from, 1); eq(plan[0].to, 60);
  eq(plan[3].from, 181); eq(plan[3].to, 240);
  eq(plan.reduce((a, s) => a + s.declared, 0), 240);
});

test("seriesShape never promises more builders than there are episodes", () => {
  const shape = Economy.seriesShape(150);
  eq(shape[0].builders, 60);
  eq(shape[1].builders, 60);
  eq(shape[2].builders, 30, "the third series gets what is left");
  eq(shape[3].builders, 0, "and the fourth has no content at all");
  eq(Economy.seriesShape(0).every(s => s.builders === 0), true);
});

test("builder numbers stay contiguous when a series is short on content", () => {
  const shape = Economy.seriesShape(70);   // series 1 full, series 2 gets 10
  eq(shape[0].from, 1); eq(shape[0].to, 60);
  eq(shape[1].from, 61); eq(shape[1].to, 70, "no gap in the numbering the cost curve sees");
});

test("globalOf translates a series-local builder to its global number", () => {
  freshRun();
  eq(state.series, 0);
  eq(Economy.globalOf(0), 1);
  eq(Economy.globalOf(5), 6);
});

test("a later series prices and unlocks from its global builder number", () => {
  freshRun();
  const shape = Economy.seriesShape();
  if (shape[1] && shape[1].builders > 0) {
    state.series = 1;
    eq(Economy.globalOf(0), shape[1].from);
    near(Builders.cost(0, 0), Economy.costFor(shape[1].from, 1), 1e-9,
         "series 2's first builder is priced as its global number, not as builder 1");
    state.series = 0;
  } else {
    // only one series has content in this library, which is itself the documented behaviour
    eq(Economy.nextSeries(), null, "no second series until more episodes ship");
  }
});

test("playableSeries drops the ones with no content", () => {
  const playable = Economy.seriesShape(70).filter(s => s.builders > 0);
  eq(playable.length, 2);
});

suite("economy: wager tiers");

test("a tier is a share of the balance, and Confident is the modelled default", () => {
  resetCfg();
  const t = Economy.wagerTiers(10000);
  deepEq(t.map(x => x.key), ["safe", "confident", "max"]);
  deepEq(t.map(x => x.amount), [500, 1000, 2000], "5% / 10% / 20% of 10,000");
  eq(Economy.DEFAULT_TIER, "confident", "the tier Inputs!C50 calls the modelled default");
  eq(Economy.wagerTier("max", 10000).amount, 2000);
  eq(Economy.wagerTier("nope", 10000), null);
});

test("tiers scale with the balance — the flat minimum no longer sets the bet", () => {
  resetCfg();
  const small = Economy.wagerTier("confident", 5000).amount;
  const big = Economy.wagerTier("confident", 500000).amount;
  eq(small, 500);
  eq(big, 50000, "a hundredfold balance stakes a hundredfold bet");
  ok(big / small === 100, "the tier is proportional, which is what the model assumes");
});

test("minWager is a floor under every tier, never a ceiling", () => {
  resetCfg();                                  // minWager 100
  const t = Economy.wagerTiers(400);           // 5% = 20, below the floor
  deepEq(t.map(x => x.amount), [100, 100, 100], "all three clamp up to the minimum");
  const u = Economy.wagerTiers(3000);          // 5% = 150, clear of it
  deepEq(u.map(x => x.amount), [150, 300, 600]);
});

test("a tier can never stake more than the player holds", () => {
  resetCfg();
  cfg.minWager = 5000;
  deepEq(Economy.wagerTiers(1200).map(x => x.amount), [1200, 1200, 1200],
         "the floor is capped by the balance, so no tier overdraws");
  resetCfg();
});

test("canWager is the same affordability rule the modal shows", () => {
  resetCfg();
  ok(!Economy.canWager(99));
  ok(Economy.canWager(100), "exactly the minimum can bet");
  cfg.minWager = 0;
  ok(!Economy.canWager(1e9), "a zero minimum turns betting off entirely");
  resetCfg();
});

test("apply projects the model's three tiers and the album target onto cfg", () => {
  resetCfg();
  const p = Economy.model().prediction;
  Economy.apply();
  eq(cfg.wagerSafe, p.wagerSafe);
  eq(cfg.wagerConfident, p.wagerConfident);
  eq(cfg.wagerMax, p.wagerMax);
  eq(cfg.clueAlbumSize, p.clueAlbumSize);
  ["wagerSafe", "wagerConfident", "wagerMax", "clueAlbumSize"].forEach(k =>
    ok(Economy.OWNED_CFG_KEYS.includes(k), `${k} must be economy-owned so an import replaces it`));
  ok(!Economy.OWNED_CFG_KEYS.includes("participation"),
     "participation is an observed rate, not a game input — see Economy.apply()");
  resetCfg();
});

suite("economy: the clue edge");

test("accuracy rises per clue and stops at the cap", () => {
  resetCfg();
  near(Economy.accuracyFor(0), 0.55, 1e-9, "unclued is near a coin flip by design");
  near(Economy.accuracyFor(1), 0.59, 1e-9);
  near(Economy.accuracyFor(3), 0.67, 1e-9);
  near(Economy.accuracyFor(4), 0.70, 1e-9);
  near(Economy.accuracyFor(50), 0.70, 1e-9, "capped");
  near(Economy.accuracyFor(-5), 0.55, 1e-9, "a negative count cannot lower it");
});

test("a prediction spends the cycle's clues and resets the flow, leaving the album alone", () => {
  freshRun();
  state.coins = 1e6;
  state.clues = 9; state.cycleClues = 3;
  state.epQueue.push("001");
  const r = resolvePrediction({ wager: 10, odds: 2, sel: 0, correct: 0, auto: false });
  eq(r.cluesSpent, 3);
  near(r.accuracy, 0.67, 1e-9, "the outcome was modelled at the clued accuracy");
  eq(state.cycleClues, 0, "the flow resets for the next builder");
  eq(state.clues, 9, "the album is cosmetic and untouched");
});

test("clues only decide the outcome in auto runs — a manual pick still wins on its merits", () => {
  freshRun();
  state.coins = 1e6; state.cycleClues = 0;   // accuracy floor, 0.55
  state.epQueue.push("001");
  eq(resolvePrediction({ wager: 10, odds: 2, sel: 0, correct: 0, auto: false }).won, true,
     "the right answer wins regardless of the modelled accuracy");
});

suite("economy: projection onto cfg");

test("apply pushes the model's numbers onto the live tuning surface", () => {
  resetCfg();
  const e = Economy.model();
  Economy.apply();
  eq(cfg.energyCap, e.energy.cap);
  eq(cfg.stdBase, e.tiles.stdBase);
  eq(cfg.vipSeed, e.tiles.vipSeed);
  eq(cfg.boxCoins, e.box.item1Coins);
  eq(cfg.tiers, e.structure.levelsPerBuilder);
  near(cfg.trainEV, e.tiles.trainSmall * (1 - e.tiles.trainLargeChance) + e.tiles.trainLarge * e.tiles.trainLargeChance, 1e-9,
       "the small/large pair collapses to the EV the train tile actually pays");
  eq(deck.length, e.deck.length);
  eq(boxTable.length, e.box.item2.length);
  resetCfg();
});

test("the shipped config defaults already match the built-in model", () => {
  resetCfg();
  const e = ECONOMY_DEFAULT;
  eq(DEFAULTS.energyCap, e.energy.cap);
  eq(DEFAULTS.stdBase, e.tiles.stdBase);
  eq(DEFAULTS.vipSeed, e.tiles.vipSeed);
  eq(DEFAULTS.boxCoins, e.box.item1Coins);
  eq(DEFAULTS.accuracy, e.prediction.baseAccuracy);
  eq(DEFAULTS.accuracyPerClue, e.prediction.accuracyPerClue);
  eq(DEFAULTS.accuracyMax, e.prediction.maxAccuracy);
  eq(defBox.length, e.box.item2.length, "the box table ships as the model's item 2");
  eq(defDeck.filter(c => c.clues > 0).length, 0, "and the deck ships with no clue card");
});

suite("economy: importing a workbook");

/* A stand-in for js/xlsx.js's Workbook, built from the model itself so the happy path is a
   round trip: default model → cells → import → the same numbers back. */
function stubWorkbook(over) {
  const cells = {};
  const put = (sheet, ref, v) => { cells[sheet + "!" + ref.toUpperCase()] = v; };
  const dig = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const e = ECONOMY_DEFAULT;
  /* The importer still reads the v3 layout: one cost base, one level growth, one derived
     exponent and the four pacing anchors it was solved from. Those constants are written out
     here rather than lifted from ECONOMY_DEFAULT, whose curve is now the six fitted v3.12
     segments — no single base, and no anchors to solve. Until the workbook grows a segment
     table (TODO.md), these two shapes are legitimately different. */
  const extra = {
    "_anchors.daysSeries1": 14,
    "_anchors.totalDays": 60,
    "_exponent": 0.0497678368,
    "_costBase": 164,
    "_levelGrowth": 1.5,
  };

  put("Guide", "B2", "Economy Model v9 - test fixture");
  EconomyImport.FIELDS.forEach(([sheet, labelRef, expected, valueRef, path]) => {
    put(sheet, labelRef, expected && expected.prefix ? expected.prefix + " (test)" : expected);
    const v = path in extra ? extra[path] : dig(e, path);
    put(sheet, valueRef, typeof v === "number" ? v : 0);
  });
  [["B4", "Card"], ["C4", "Weight"], ["D4", "Coins"], ["E4", "Energy"], ["F4", "Clues"], ["G4", "To VIP pool"]]
    .forEach(([ref, t]) => put("Deck", ref, t));
  e.deck.forEach((c, i) => {
    const r = 5 + i;
    put("Deck", "B" + r, c.name); put("Deck", "C" + r, c.weight); put("Deck", "D" + r, c.coins);
    put("Deck", "E" + r, c.energy); put("Deck", "F" + r, c.clues); put("Deck", "G" + r, c.vip);
  });
  put("Deck", "B" + (5 + e.deck.length), "Total weight");
  [["B9", "Outcome"], ["C9", "Weight"], ["D9", "Amount"]].forEach(([ref, t]) => put("MysteryBox", ref, t));
  e.box.item2.forEach((c, i) => {
    const r = 10 + i;
    put("MysteryBox", "B" + r, c.name); put("MysteryBox", "C" + r, c.weight); put("MysteryBox", "D" + r, c.amount);
  });
  put("MysteryBox", "B" + (10 + e.box.item2.length), "Total weight");

  const sheets = EconomyImport.REQUIRED_SHEETS.slice();
  if (over) over({ put, cells, sheets });
  return {
    sheetNames: sheets,
    has: s => sheets.indexOf(s) >= 0,
    cell: (s, r) => { const v = cells[s + "!" + r.toUpperCase()]; return v === undefined ? null : v; },
    label: (s, r) => { const v = cells[s + "!" + r.toUpperCase()]; return v == null ? "" : String(v).trim(); },
    number: (s, r) => { const v = cells[s + "!" + r.toUpperCase()]; return typeof v === "number" ? v : null; },
    rows: () => 300,
  };
}

test("a well-formed workbook imports and round-trips the model", () => {
  const res = EconomyImport.fromWorkbook(stubWorkbook(), "fixture.xlsx", Economy.version());
  deepEq(res.errors, [], "no errors");
  ok(res.ok);
  eq(res.version, "Economy Model v9 - test fixture");
  eq(res.economy.filename, "fixture.xlsx");
  ok(res.economy.loadedAt, "the load time is recorded");
  eq(res.economy.energy.cap, ECONOMY_DEFAULT.energy.cap);
  eq(res.economy.deck.length, ECONOMY_DEFAULT.deck.length);
  eq(res.economy.deck.filter(c => c.advance).length, 1, "the teleport card is found by name");
  eq(res.economy.box.item2.map(r => r.kind).sort().join(","), "clues,coins,energy");
  eq(res.economy.costCurve.length, 1);
  eq(res.economy.costCurve[0].to, undefined, "the imported curve is open-ended");
  deepEq(Economy.validateCurve(res.economy.costCurve), []);
});

test("importing does not touch the running economy", () => {
  const before = JSON.stringify(Economy.model());
  EconomyImport.fromWorkbook(stubWorkbook(), "fixture.xlsx", Economy.version());
  eq(JSON.stringify(Economy.model()), before, "the caller installs, the importer never does");
});

test("a missing sheet is refused before anything else is read", () => {
  const res = EconomyImport.fromWorkbook(stubWorkbook(w => { w.sheets.splice(w.sheets.indexOf("Deck"), 1); }), "x.xlsx", null);
  ok(!res.ok);
  eq(res.errors.length, 1, "one clear message, not a cascade");
  ok(/Missing sheet: Deck/.test(res.errors[0]), res.errors[0]);
});

test("re-importing the version that is already loaded is refused", () => {
  const wb = stubWorkbook();
  const res = EconomyImport.fromWorkbook(wb, "x.xlsx", "Economy Model v9 - test fixture");
  ok(!res.ok);
  ok(/already loaded/.test(res.errors[0]), res.errors[0]);
  ok(/Guide!B2/.test(res.errors[0]), "and it says where to bump it");
  ok(EconomyImport.fromWorkbook(wb, "x.xlsx", "Economy Model v3 - something else").ok,
     "a different version goes through");
});

test("an empty version cell is refused", () => {
  const res = EconomyImport.fromWorkbook(stubWorkbook(w => w.put("Guide", "B2", "")), "x.xlsx", null);
  ok(!res.ok);
  ok(/Guide!B2 is empty/.test(res.errors[0]), res.errors[0]);
});

test("a shifted row is caught by its label, not silently imported", () => {
  // the classic failure: someone inserts a row, so C5 now holds a different number
  const res = EconomyImport.fromWorkbook(stubWorkbook(w => w.put("Inputs", "B5", "Something else")), "x.xlsx", null);
  ok(!res.ok);
  ok(res.errors.some(e => /Inputs!B5 should read "Energy cap"/.test(e)), res.errors.join(" | "));
});

test("every layout problem is reported at once, not one per attempt", () => {
  const res = EconomyImport.fromWorkbook(stubWorkbook(w => {
    w.put("Inputs", "B5", "moved"); w.put("Inputs", "B31", "moved"); w.put("Tuning", "B6", "moved");
  }), "x.xlsx", null);
  ok(!res.ok);
  eq(res.errors.length, 3, "all three, so the sheet can be fixed in one pass");
});

test("a non-numeric value where a number belongs is refused", () => {
  const res = EconomyImport.fromWorkbook(stubWorkbook(w => w.put("Inputs", "C5", "thirty")), "x.xlsx", null);
  ok(!res.ok);
  ok(res.errors.some(e => /Inputs!C5 .* is not a number/.test(e)), res.errors.join(" | "));
});

test("a box outcome the game cannot pay out is refused", () => {
  const res = EconomyImport.fromWorkbook(stubWorkbook(w => w.put("MysteryBox", "B11", "Gemstones")), "x.xlsx", null);
  ok(!res.ok);
  ok(res.errors.some(e => /Gemstones/.test(e)), res.errors.join(" | "));
  ok(res.errors.some(e => /missing its "energy" outcome/.test(e)), "and it says what went missing");
});

test("a deck without exactly one advance card is refused", () => {
  const res = EconomyImport.fromWorkbook(stubWorkbook(w => w.put("Deck", "B11", "Nothing happens")), "x.xlsx", null);
  ok(!res.ok);
  ok(res.errors.some(e => /exactly one card whose name contains "Advance"/.test(e)), res.errors.join(" | "));
});

test("a workbook whose exponent was typed over the formula still loads, with a warning", () => {
  const res = EconomyImport.fromWorkbook(stubWorkbook(w => w.put("Inputs", "C17", 0.5)), "x.xlsx", null);
  ok(res.ok, "the printed value wins — the sheet's own pacing was built from it");
  eq(res.economy.costCurve[0].exponent, 0.5);
  ok(res.warnings.some(e => /solve to/.test(e)), res.warnings.join(" | "));
});

test("nonsense that parses is still refused", () => {
  ok(!EconomyImport.fromWorkbook(stubWorkbook(w => w.put("Inputs", "C5", 0)), "x.xlsx", null).ok, "zero energy cap");
  ok(!EconomyImport.fromWorkbook(stubWorkbook(w => w.put("Inputs", "C54", 0.1)), "x.xlsx", null).ok,
     "an accuracy cap below the floor would make clues harmful");
});
