"use strict";
/* Workbook → economy model, with the structural check that gates it.

   The contract with the designer is that a bad spreadsheet is REFUSED, loudly and completely,
   rather than half-loaded. So this validates the whole workbook up front and only builds a
   model once every check has passed. Nothing here mutates the running game — the caller
   decides whether to install what comes back.

   How the layout is checked: every value we read has a LABEL cell next to it, and we assert
   the label still says what it said in v3. That is the check that actually catches trouble.
   A designer inserting a row shifts the values but not the labels, so a plain "is C5 a number"
   test would happily import the wrong number; comparing B5 to "Energy cap" will not.

   The workbook's own version string is Guide!B2 ("Economy Model v3 - 240 builders / 240
   episodes"). It is the identity of the model: it names what is loaded, and re-importing the
   same string is refused so a designer who edits numbers without bumping the version finds
   out here rather than three sessions later. */

const EconomyImport = {

  VERSION_CELL: { sheet: "Guide", ref: "B2" },

  /* Every sheet the v3 workbook carries. We only READ a handful, but a file missing any of
     these is not the workbook this importer was written against, and silently accepting it
     would import a shape we never validated. */
  REQUIRED_SHEETS: ["Guide", "Tuning", "Inputs", "Deck", "MysteryBox", "Board",
                    "Archetypes", "Prediction", "Builder", "Progression", "LiveOps",
                    "Dashboard", "Projection"],

  /* [sheet, labelRef, expectedLabel, valueRef, path]
     `path` is where the number lands in the model. An expected label of the form
     {prefix:"..."} matches on the start only — used where the label embeds a number that is
     itself configurable ("Target days for all 240"). */
  FIELDS: [
    // --- Inputs: energy & sessions ---
    /* EVERY expectedLabel below is still the word the WORKBOOK prints, not the word the game
       uses. That is deliberate and it is the whole point of the gate: the check is that the
       label next to a value still says what it said in v3, so an inserted row is caught. Change
       a label to match the game's new vocabulary and the importer refuses every workbook that
       exists; repoint a path while leaving the label and it imports the right cell. So paths
       move, labels never do.

       Rows 5-7 are energy, which the game no longer has. They land on _dead and are deleted
       before assembly (like _anchors and _costBase) — that keeps the layout gate covering those
       three rows without importing a concept the game dropped. */
    ["Inputs", "B5",  "Energy cap",                          "C5",  "_dead.energyCap"],
    ["Inputs", "B6",  "Regen minutes per 1 energy",          "C6",  "_dead.regenMin"],
    ["Inputs", "B7",  "Daily energy allowance (hard cap)",   "C7",  "_dead.dailyAllowance"],
    ["Inputs", "B8",  "Sessions per day (engaged)",          "C8",  "cards.sessionsPerDay"],
    ["Inputs", "B9",  "Seconds per roll",                    "C9",  "cards.secPerPull"],
    // --- Inputs: structure & pacing anchors ---
    ["Inputs", "B12", "Total builders",                      "C12", "structure.totalEpisodes"],
    ["Inputs", "B13", "Levels per builder",                  "C13", "structure.ticketsPerEpisode"],
    ["Inputs", "B14", "Episodes in series 1",                "C14", "structure.episodesPerSeries"],
    ["Inputs", "B15", "Target days to finish series 1",      "C15", "_anchors.daysSeries1"],
    ["Inputs", "B16", { prefix: "Target days for all" },     "C16", "_anchors.totalDays"],
    ["Inputs", "B17", { prefix: "Cost exponent" },           "C17", "_exponent"],
    // --- Inputs: board scale (composition is fixed in js/board-model.js, see TODO.md) ---
    ["Inputs", "B27", "Board scale",                         "C27", "tiles.boardScale"],
    // --- Inputs: tile values ---
    ["Inputs", "B31", "Standard tile: average base coins",   "C31", "tiles.stdBase"],
    ["Inputs", "B32", "Train: small bonus",                  "C32", "tiles.trainSmall"],
    ["Inputs", "B33", "Train: large bonus",                  "C33", "tiles.trainLarge"],
    ["Inputs", "B34", "Train: chance of the large bonus",    "C34", "tiles.trainLargeChance"],
    ["Inputs", "B35", "Start: pass bonus",                   "C35", "tiles.startPass"],
    ["Inputs", "B36", "Start: extra bonus on landing",       "C36", "tiles.startLand"],
    ["Inputs", "B37", "Spa Day corner: energy grant",        "C37", "tiles.spaCards"],
    ["Inputs", "B38", "VIP Lounge: pool seed per lap",       "C38", "tiles.vipSeed"],
    // --- Inputs: builder costs ---
    ["Inputs", "B41", "Base level-1 cost (builder 1)",       "C41", "_costBase"],
    ["Inputs", "B42", "Level cost growth (x per level)",     "C42", "_ticketGrowth"],
    ["Inputs", "B43", "Boxes per level upgrade",             "C43", "box.boxesPerTicketCard"],
    // --- Inputs: prediction & wager ---
    ["Inputs", "B46", { prefix: "Wager participation" },     "C46", "prediction.participation"],
    ["Inputs", "B49", { prefix: "Wager tier 1" },            "C49", "prediction.wagerSafe"],
    ["Inputs", "B50", { prefix: "Wager tier 2" },            "C50", "prediction.wagerConfident"],
    ["Inputs", "B51", { prefix: "Wager tier 3" },            "C51", "prediction.wagerMax"],
    ["Inputs", "B52", "Base accuracy (no clues)",            "C52", "prediction.baseAccuracy"],
    ["Inputs", "B53", "Accuracy gain per clue",              "C53", "prediction.accuracyPerClue"],
    ["Inputs", "B54", "Max accuracy (cap)",                  "C54", "prediction.maxAccuracy"],
    ["Inputs", "B55", "Average odds of the chosen option",   "C55", "prediction.avgOdds"],
    ["Inputs", "B56", { prefix: "Clue album size" },         "C56", "prediction.clueAlbumSize"],
    // --- Tuning: the five relative knobs ---
    ["Tuning", "B6",  { prefix: "Earn rate knob" },          "C6",  "knobs.earn"],
    ["Tuning", "B7",  { prefix: "Builder cost knob" },       "C7",  "knobs.ticketCost"],
    ["Tuning", "B8",  { prefix: "Energy supply knob" },      "C8",  "knobs.cardSupply"],
    ["Tuning", "B9",  "Session frequency knob",              "C9",  "knobs.sessionFreq"],
    ["Tuning", "B10", "Wager appetite knob",                 "C10", "knobs.wagerAppetite"],
    // --- MysteryBox: the guaranteed first item ---
    ["MysteryBox", "B6", "Coins",                            "C6",  "box.item1Coins"],
    // --- what the workbook predicts, kept so a run can be checked against it ---
    ["Board",       "B14", "TOTAL per roll",                 "D14", "reference.coinsPerPull"],
    ["Archetypes",  "B11", "Board coins per day",            "D11", "reference.coinsPerDayEngaged"],
    ["Progression", "B11", "Total days (engaged)",           "C11", "reference.totalDays"],
    ["Progression", "B12", "Average episodes/day",           "C12", "reference.episodesPerDay"],
  ],

  /* Dashes and stray whitespace differ between Excel, Google Sheets and hand-typing, and none
     of that is a real layout change. */
  norm(s) {
    return String(s == null ? "" : s)
      .replace(/[‐-―−]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  },

  labelMatches(actual, expected) {
    const a = this.norm(actual);
    if (expected && typeof expected === "object" && expected.prefix)
      return a.startsWith(this.norm(expected.prefix));
    return a === this.norm(expected);
  },
  labelText(expected) {
    return expected && typeof expected === "object" && expected.prefix
      ? `${expected.prefix}…` : String(expected);
  },

  set(obj, path, value) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) cur = (cur[parts[i]] = cur[parts[i]] || {});
    cur[parts[parts.length - 1]] = value;
  },

  /* Read a labelled table that runs down column B until it hits a terminator or a blank.
     Both the deck and the box's second item are shaped this way, and both may legitimately
     gain or lose rows, so the row count is discovered rather than asserted. */
  readTable(wb, sheet, firstRow, cols, stopAt) {
    const out = [], errs = [];
    for (let r = firstRow; r < firstRow + 200; r++) {
      const name = wb.label(sheet, "B" + r);
      if (!name) break;
      if (this.norm(name) === this.norm(stopAt)) break;
      const row = { name: name.trim() };
      for (const [key, col] of Object.entries(cols)) {
        const v = wb.number(sheet, col + r);
        if (v == null) { errs.push(`${sheet}!${col}${r} ("${name}" → ${key}) is not a number.`); }
        else row[key] = v;
      }
      out.push(row);
    }
    return { rows: out, errs };
  },

  /* The whole job. Returns {ok, errors[], warnings[], version, economy}.
     `currentVersion` is what is already loaded — passing it enables the same-version refusal. */
  fromWorkbook(wb, filename, currentVersion) {
    const errors = [], warnings = [];
    const fail = () => ({ ok: false, errors, warnings, version: null, economy: null });

    /* --- 1. every sheet present --- */
    const missing = this.REQUIRED_SHEETS.filter(s => !wb.has(s));
    if (missing.length) {
      errors.push(`Missing sheet${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. This does not look like an economy workbook.`);
      return fail();                              // nothing below can be trusted
    }

    /* --- 2. version --- */
    const version = wb.label(this.VERSION_CELL.sheet, this.VERSION_CELL.ref);
    if (!version) {
      errors.push(`${this.VERSION_CELL.sheet}!${this.VERSION_CELL.ref} is empty — it must carry the model name and version, e.g. "Economy Model v3 - 240 builders / 240 episodes".`);
      return fail();
    }
    if (currentVersion && this.norm(version) === this.norm(currentVersion)) {
      errors.push(`"${version}" is already loaded. Bump the version in ${this.VERSION_CELL.sheet}!${this.VERSION_CELL.ref} before re-importing, so it is clear which model the game is running.`);
      return fail();
    }

    /* --- 3. every labelled field --- */
    const draft = JSON.parse(JSON.stringify(ECONOMY_DEFAULT));
    for (const [sheet, labelRef, expected, valueRef, path] of this.FIELDS) {
      const label = wb.label(sheet, labelRef);
      if (!this.labelMatches(label, expected)) {
        errors.push(`${sheet}!${labelRef} should read "${this.labelText(expected)}" but reads "${label || "(empty)"}" — the workbook layout has moved.`);
        continue;                                 // don't read a value we can't trust
      }
      const v = wb.number(sheet, valueRef);
      if (v == null) { errors.push(`${sheet}!${valueRef} ("${label}") is not a number.`); continue; }
      this.set(draft, path, v);
    }

    /* --- 4. the deck --- */
    const deckHeaders = [["B4", "Card"], ["C4", "Weight"], ["D4", "Coins"], ["E4", "Energy"], ["F4", "Clues"], ["G4", "To VIP pool"]];
    for (const [ref, want] of deckHeaders)
      if (!this.labelMatches(wb.label("Deck", ref), want))
        errors.push(`Deck!${ref} should read "${want}" but reads "${wb.label("Deck", ref) || "(empty)"}".`);
    /* Column E still PRINTS "Energy"; the game reads it as tickets. Same rule as the Inputs
       rows above — the header assertion is unchanged, the destination moved. */
    const deckT = this.readTable(wb, "Deck", 5, { weight: "C", coins: "D", tickets: "E", clues: "F", vip: "G" }, "Total weight");
    errors.push(...deckT.errs);
    if (!deckT.rows.length) errors.push("Deck has no cards.");
    if (deckT.rows.some(r => r.weight < 0)) errors.push("Deck has a negative weight.");
    if (deckT.rows.reduce((a, r) => a + (r.weight || 0), 0) <= 0) errors.push("Deck weights sum to zero — nothing could ever be drawn.");
    /* The workbook has no column for it, so the teleport card is identified by name. That is
       fragile enough to be worth asserting rather than assuming. */
    const advance = deckT.rows.filter(r => /advance/i.test(r.name));
    if (advance.length !== 1)
      errors.push(`Deck must contain exactly one card whose name contains "Advance" (the teleport to Start); found ${advance.length}.`);
    deckT.rows.forEach(r => { if (/advance/i.test(r.name)) r.advance = true; });

    /* --- 5. the mystery box's second item --- */
    for (const [ref, want] of [["B9", "Outcome"], ["C9", "Weight"], ["D9", "Amount"]])
      if (!this.labelMatches(wb.label("MysteryBox", ref), want))
        errors.push(`MysteryBox!${ref} should read "${want}" but reads "${wb.label("MysteryBox", ref) || "(empty)"}".`);
    const boxT = this.readTable(wb, "MysteryBox", 10, { weight: "C", amount: "D" }, "Total weight");
    errors.push(...boxT.errs);
    /* THE ONE PLACE THE TWO VOCABULARIES MEET: sheet word on the left, game kind on the right.
       A workbook's "Energy" row is the game's ticket drop. Both spellings are accepted so a
       sheet updated to say "Ticket" also imports, and the loop below iterates the SHEET-side
       names so the error message names the word a designer will actually find in their file. */
    const KINDS = { coins: "coins", energy: "tickets", ticket: "tickets", tickets: "tickets", clues: "clues" };
    const REQUIRED = ["coins", "energy", "clues"];
    boxT.rows.forEach(r => { r.kind = KINDS[this.norm(r.name)]; });
    const unknown = boxT.rows.filter(r => !r.kind).map(r => r.name);
    if (unknown.length) errors.push(`Mystery Box item 2 has outcome${unknown.length > 1 ? "s" : ""} the game cannot pay out: ${unknown.join(", ")}. Only Coins, Energy (read as tickets) and Clues are understood.`);
    for (const k of REQUIRED)
      if (!boxT.rows.some(r => r.kind === KINDS[k])) errors.push(`Mystery Box item 2 is missing its "${k}" outcome.`);
    if (boxT.rows.reduce((a, r) => a + (r.weight || 0), 0) <= 0) errors.push("Mystery Box item-2 weights sum to zero.");

    if (errors.length) return fail();

    /* --- 6. assemble, now that every input is known good --- */
    draft.version = version.trim();
    draft.filename = filename || null;
    draft.loadedAt = new Date().toISOString();
    draft.plotTwist = deckT.rows.map(r => ({
      name: r.name, weight: r.weight, coins: r.coins, tickets: r.tickets, clues: r.clues,
      vip: r.vip, ...(r.advance ? { advance: true } : {}),
    }));
    draft.box.item2 = boxT.rows.map(r => ({ name: r.name, kind: r.kind, weight: r.weight, amount: r.amount }));

    const anchors = {
      episodesSeries1: draft.structure.episodesPerSeries,
      daysSeries1: draft._anchors.daysSeries1,
      totalEpisodes: draft.structure.totalEpisodes,
      totalDays: draft._anchors.totalDays,
    };
    /* The workbook prints the solved exponent AND the anchors it came from. Recompute it and
       compare: a mismatch means someone typed over the formula, which is exactly the kind of
       silent edit that makes a spreadsheet and a game disagree. Not fatal — the printed value
       still wins, since that is what the workbook's own pacing tables were built from. */
    const solved = Economy.solveExponent(anchors);
    if (solved != null && Math.abs(solved - draft._exponent) > 1e-6)
      warnings.push(`Inputs!C17 reads ${draft._exponent.toFixed(9)}, but its four pacing anchors solve to ${solved.toFixed(9)}. Using the printed value; check that the formula in C17 was not overwritten.`);

    draft.costCurve = [{
      from: 1, kind: "power",
      base: draft._costBase, ticketGrowth: draft._ticketGrowth, exponent: draft._exponent,
      bIndex: "global", baseMode: "absolute", anchors,
    }];
    delete draft._anchors; delete draft._exponent; delete draft._costBase; delete draft._ticketGrowth;
    delete draft._dead;   // energy rows: gated for layout, never installed

    const curveErrs = Economy.validateCurve(draft.costCurve);
    if (curveErrs.length) { errors.push(...curveErrs); return fail(); }

    /* --- 7. sanity, not structure: things that parse but would break a run --- */
    /* The workbook still speaks in builders and levels; the game reads them as episodes and
       tickets. The labels are asserted verbatim above, so these messages name the workbook's
       word and the game's meaning together — a designer has to find the cell, not the concept. */
    if (draft.structure.ticketsPerEpisode < 1) errors.push("Levels per builder (Inputs!C13) must be at least 1 — it is how many tickets fill one episode.");
    if (draft.structure.totalEpisodes < 1) errors.push("Total builders (Inputs!C12) must be at least 1 — it is the number of episodes in the run.");
    if (draft.cards.sessionsPerDay <= 0) errors.push("Sessions per day must be above zero.");
    /* The deck's own invariants. ticketsPerPack < 1 is the new deadlock: with no tickets in a
       pack no episode could ever be completed, and unlike a bad price it fails silently. */
    /* Nothing checks a pack SIZE any more: it is derived from this count (Shoe.packSize — the
       52 numbered cards plus the jokers), so it cannot be out of range without this being. The
       two checks that used to live here compared draft.cards.packSize, which no longer exists;
       left in place they would have read undefined, compared false and passed everything. */
    if (draft.cards.ticketsPerPack < 1) errors.push("Tickets per pack must be at least 1 — with none, no episode can ever be completed.");
    if (draft.cards.regenMin <= 0) errors.push("Regen minutes per card must be above zero.");
    if (draft.prediction.maxAccuracy < draft.prediction.baseAccuracy)
      errors.push("Max accuracy is below base accuracy, so clues would make predictions worse.");
    if (errors.length) return fail();

    /* Warnings: legitimate, but a designer would want to know. */
    if (draft.structure.totalEpisodes > Episodes.count())
      warnings.push(`The model wants ${draft.structure.totalEpisodes} episodes but only ${Episodes.count()} exist, so later series stay locked until more content ships.`);
    if (draft.tiles.boardScale !== 1)
      warnings.push(`Board scale is ${draft.tiles.boardScale}. In this game it scales income AND ticket cost together, so it redenominates the currency without changing pacing.`);

    return { ok: true, errors, warnings, version: draft.version, economy: draft };
  },
};
