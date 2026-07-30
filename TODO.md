# TODO

Things we know about and have deliberately not done yet. Each entry says what is wrong, why it
was deferred, and what "done" looks like — so picking one up doesn't mean re-deriving it.

Most of these came out of mapping `economy model v3.xlsx` onto the code. Where the spreadsheet
and the game disagree about the SHAPE of a mechanic (not just a number), the disagreement is
recorded here rather than silently resolved.

---

## Prediction

### The correct answer is always the shortest-odds one
**Live exploit, content bug, no code change needed.**

In all 18 episode files `correct` points at the lowest-odds answer. Display order is shuffled
(`js/ui/prediction.js`), but each answer's odds travel with it, so the shortest odds is still
visibly identifiable — and always right.

A player who always taps the lowest number wins **100%** of the time at mean odds **1.674**, a
guaranteed **+67.4%** per bet. The wager slider goes to the full balance, so 1,000 coins
compounds to ~9.3M across the 18 episodes. The economy model is built around a +0.23 edge.

Root cause is authoring, not logic: odds were written to express *how plausible an answer is*,
and the correct answer is naturally the most plausible-sounding. That makes the odds a label
reading "pick me".

**Done when:** the correct answer is sometimes the longshot across the library, *and* the
`episode-prediction-questions` skill that generates these files is fixed — otherwise episode 19
arrives with the same bug.

### Wager sizing is in the wrong unit
The model has three tiers as a % of balance (safe 5 / confident 10 / max 20) and a 95%
participation rate. The 20% cap is explicitly the anti-bankruptcy guard.

The code has one absolute slider from `cfg.minWager` to **100% of the balance**, no cap, no
participation concept. The model's risk figure (a 3-miss streak costing 48.8% of balance) does
not describe the game at all.

**Done when:** wagering is a percentage of balance with a real cap, or the model is re-derived
against an absolute wager. Not both.

### What should clues do in MANUAL play?
Clues are wired: they accumulate in `state.cycleClues`, set the accuracy via
`Economy.accuracyFor`, and are spent and reset by `resolvePrediction`. But accuracy only decides
the outcome in **auto** runs — a manual pick still wins on its merits (`sel === correct`), which
is the right call for a game and leaves the model's accuracy curve half-used.

Options: accuracy only ever models auto runs (today); clues buy a hint or narrow the options;
clues grant a re-roll on a loss. This is a design decision, not a config change.

### Prediction is unreachable from the balancing tool
`openPrediction()` has exactly one caller — the Predict & watch button. An auto-play run
executes zero predictions, so the model's prediction EV (80.23 per prediction, 324 coins/day
engaged) can never be observed in the tool built to validate it.

Deliberately left as-is for now. **Done when:** auto-play runs predictions under a stated policy
for wager tier, participation and clue spend.

---

## Session & time

### Auto-play cannot span days
`advanceSession()` is only called by the Next session button. An auto run drains one energy bar
and stops, so the model's headline pacing (59.4 days for all 240, 13.4 for series 1) is not
measurable in-engine.

Deliberately left as-is — the auto loop should not silently burn game-days. **Done when:**
there is an explicit multi-day batch mode, separate from the two current auto toggles.

### No daily energy allowance
The model caps energy at 240/day as the brake on its "Fastest 5%" cohort. `advanceSession()`
implements `MIN(energyCap × sessionsPerDay, 1440 / regenMin)` — the model's first two terms —
and has no third. At default settings both agree at 75/day, so the gap is invisible until
`sessionsPerDay` is pushed up: at 12.5 the code gives 375/day against the model's 240.

`economy.energy.dailyAllowance` is imported and stored, and currently read by nothing.

### No player archetypes
The model's Archetypes and Projection sheets rest on a cohort dimension (casual 0.6× / engaged
1.0× / fastest 5.0× session multipliers) that has no trace in the code. Three cohorts means
three hand-edited runs.

### Login rewards are unmodelled income
`LOGIN_REWARDS` in `js/content.js` pays ~4,650 coins/week ≈ **664 coins/day**, about 9% on top
of the model's 7,344 engaged board coins/day. The solved cost exponent is calibrated without
them, so the game runs permanently ~9% ahead of what the sheet predicts, compounding over the
60-day horizon.

**Done when:** either the workbook gains a login-reward term (and the exponent is re-solved), or
the ladder comes out of the game.

### `cfg.secPerRoll` is still dead
Imported from `Inputs!C9`, in the drawer, read by nothing. In-game time only moves in
`advanceSession()`, so there is no quantity to compare it against. The model uses it to derive
"active minutes per session" (3.01) against a 3–7 minute Dashboard target band.

---

## Board & tiles

### The train is parameterised from the opposite end
Model: outcomes are the input (small 60 at 65%, large 315 at 35%), EV is derived → 149.25.
Code: EV is the input (`cfg.trainEV`), outcomes come from a hardcoded 5-rung `TRAIN_MULT`
ladder normalised so the mean is exactly `trainEV`.

`Economy.apply()` currently collapses the model's small/large pair into the EV, so **the money
matches but the felt shape does not** — the code is mostly-below-EV with a rare 3.72× jackpot at
5%, the model is a frequent two-outcome flip with a 2.11× top at 35%. There is no cfg key for a
small bonus, a large bonus, or a large-bonus chance, and `TRAIN_MULT` is not in the tuning
schema.

**Done when:** one shape wins. They cannot both survive.

### Advance-to-Start pays double what the model prices
`Tile.advanceToStart` pays `startPass + startLand` (200) and re-seeds the VIP pool. The workbook
says the Advance card "collects the pass bonus" and prices the Premiere row at 100. Both the
Premiere corner and the deck's Advance card share that one helper, so the decision moves two
board rows together.

### Board composition is not configurable
`Inputs!C20–C24` (40 tiles: 26 standard / 4 train / 6 deck / 4 corner) matches the code exactly,
but the code's version is `const` data in `js/board-model.js` with `40` written into three
separate loops. The importer therefore does not read those cells. Changing the tile mix in the
spreadsheet has no landing point.

### Standard tiles are position-weighted here and flat in the model
`js/board-model.js` builds a mean-1 ramp printing 22…56 coins across the 26 standard indices.
Uniform-landing EV is identical (40) so the model is not wrong, but it has no column for a
per-tile value and so cannot express which tiles are the good ones. Realized mean is ~39.6
because teleports over-weight the cheap early tiles.

### VIP is a jackpot here and a smooth rebate in the model
The pool only pays out when the token lands on index 20 (p = 0.025/roll). Same long-run EV,
completely different variance, and the model has no pool balance at all.

---

## Economy plumbing

### The five relative knobs are stored but only one is wired
`economy.knobs` holds all five (earn, builderCost, energySupply, sessionFreq, wagerAppetite).
Only `builderCost` is read, by `Economy.costFor`. The other four are imported and ignored.

`cfg.boardScale` cannot stand in for the earn knob: it scales income **and** builder cost
together, so it is a pure currency redenomination with no pacing effect.

**Done when:** each knob has a decided call site, and it is stated whether `boardScale` survives
alongside them.

### Box income is delayed and capped here, guaranteed in the model
The model's Builder-net column assumes all boxes pay out. In the code a box is a marker placed
on a **free standard tile** — 26 slots, no stacking (`state.boxes` is a Set), and `spawn`
silently drops any it cannot place. At 240 builders saturation is guaranteed, so realized box
income falls below the 889.6/builder the cost curve was netted against.

### Multi-segment cost curves have no UI
`Economy.costCurve` supports segments — a rule for builders 1–499, another from 500, `bIndex`
global-or-restart, `baseMode` absolute-or-continuous, and explicit per-level tables. It is
validated (the last segment must be open-ended) and tested, and the drawer displays it
read-only. But there is **no way to author a second segment except by editing code**, and the
v3 workbook has no segment table to import one from.

**Done when:** the workbook grows a segment table (`from`, `to`, `bIndex`, `baseMode`, params or
explicit levels) and the importer reads it.

### No server — the browser is the database
An imported model lives only in `localStorage` (`pmdrama.econ.v1`), so it is per-browser and
per-machine, and clearing site data loses it. The slot keeps the version string and the source
filename so at least it is identifiable. Revisit when there is a backend.
