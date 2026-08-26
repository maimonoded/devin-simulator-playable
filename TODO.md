# TODO

Things we know about and have deliberately not done yet. Each entry says what is wrong, why it
was deferred, and what "done" looks like — so picking one up doesn't mean re-deriving it.

Most of these came out of mapping `economy model v3.xlsx` onto the code. Where the spreadsheet
and the game disagree about the SHAPE of a mechanic (not just a number), the disagreement is
recorded here rather than silently resolved.

**This is the `collectible_version` branch**, where builders are gone and the coin sink is boxes
and the status shelf. Items written against the builder loop are marked *(builder loop)* and are
about `main`, not about this branch — they are kept because the two branches are alternatives and
whichever wins inherits this list.

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

### ~~Prediction is unreachable from the balancing tool~~ — MOSTLY DONE
An auto-play run used to execute zero predictions, so the model's prediction EV (80.23 per
prediction, 324 coins/day engaged) could never be observed in the tool built to validate it.

It now runs them. `autoWatch()` in `js/ui/main.js` settles every playable episode with no modal
and no video: the stake is `Economy.DEFAULT_TIER` (Confident, the one the workbook assumes), the
outcome is `resolvePrediction`'s auto path (`Economy.accuracyFor(state.cycleClues)`, which the
clue cards raise), and the payout is priced at `cfg.avgOdds` — the model's own average, and that
knob's first honest call site.

It had to happen: on this branch a set is finished when its episodes have been **watched**, so a
batch run that never watched would fill set 1 and then roll forever.

**Still undecided: participation.** `prediction.participation` is 0.95 in the model and is
deliberately not projected onto `cfg`, because for a human it is an outcome rather than an input.
An auto policy is the one place where it *would* be an input — today `autoWatch` stakes on 100%
of predictions it can afford, where the model expects 95%. **Done when:** the auto policy skips
the stake on `1 - participation` of them.

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

It is now the *only* dead knob: `avgOdds` was the other one, and `autoWatch()` gave it an honest
call site — the auto-play session prices its payouts at the model's average, which is exactly
what an average is for when nobody has picked an answer.

---

## Board & tiles

### ~~The train is parameterised from the opposite end~~ — DONE
The model's shape won. `cfg.trainSmall` / `cfg.trainLarge` / `cfg.trainLargeChance` are now real
tuning keys, projected by `Economy.apply()` and editable in the drawer; the 5-rung `TRAIN_MULT`
ladder is deleted. `Economy.trainDraw()` picks one of the two outcomes and
[js/tiles/train-tile.js](js/tiles/train-tile.js) pays it directly.

`cfg.trainEV` survives as a **derived** number (`Economy.trainEV()`), kept in step by `apply()`.
Nothing pays from it — it exists so the spreadsheet has one figure to be reconciled against, which
is why it is no longer in the drawer.

What made the decision concrete: each of the two outcomes now opens its own bonus mini-game
([minigames/](minigames/README.md)), so the two-outcome shape is something the player *sees*, not
just a distribution.

### The large bonus's prize ladder pays 2/3 of what the model says
The large bonus is presented as a three-rung ladder (`minigames/gala-match3.html`). The model has
only ONE number for it, so the design is: **top rung = `cfg.trainLarge`, the two lower rungs are
exactly 1/3 and 2/3 of it, and the winning rung is an even pick of the three.**

An even pick of 1/3, 2/3 and 1 averages **2/3**. So:

| | model | board |
|---|---|---|
| one large bonus | 315 | **210** |
| per train landing | 149.25 (`Economy.trainEV`) | **112.5** (`Economy.trainRealEV`) |

That is a **25% cut** to the train's output, which slows the builder curve. It is deliberate and
measured rather than hidden — both numbers are computed and the tests assert the gap — but it is
not reconciled with the spreadsheet.

**Done when:** either the ladder is anchored on its MEAN instead of its top (multiply all three
rungs by 1.5 — the top rung becomes 472 and the EV returns to exactly 315), or the workbook gains
real cells for the three rungs and their odds, and `EconomyImport` learns to read them.

### Advance-to-Start pays double what the model prices
`Tile.advanceToStart` pays `startPass + startLand` (200) and re-seeds the VIP pool. The workbook
says the Advance card "collects the pass bonus" and prices the Premiere row at 100.

On this branch it moves **one** row, not two: the deck's Advance card went with the plot-twist
deck, so the Premiere corner is the only caller left. That makes it a smaller decision here than
on `main`, where the two shared the helper.

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

## The collection *(this branch)*

### The drop tables are not in the economy model
`boxTiers` and `deckBoxes` live in `js/config.js` and are hand-tuned. Nothing in
`economy model v3.xlsx` describes them, so `Economy.apply()` does not own them and
`loadConfig()` treats them like camera settings — they survive a model change rather than being
replaced by it (see "Known dead config" in CLAUDE.md).

That means the one thing this loop's pacing actually depends on — how often a card drops, and at
which tier — is the one thing the workbook cannot say. Days-to-finish a set is
`25 / (cards per roll)`, and cards per roll is a deck-tile landing (6 of 40) times the box's card
weight, with duplicates making the tail much longer than the mean suggests.

**Done when:** the workbook grows a Box tab with per-tier item counts and drop weights, the
importer reads it, and `Economy.OWNED_CFG_KEYS` grows `boxTiers`/`deckBoxes` — at which point the
guard in `loadConfig()` that refuses a wrong-shaped stored tier list can be dropped, because the
model would be the source of truth again.

### The duplicate rate is unmodelled, and it is most of the run
A pool of 25 drawn uniformly needs ~95 draws to complete by the coupon-collector expectation,
not 25. So roughly three quarters of every set is duplicates paying `cfg.dupCoins × tier.dup`.
That is a large, deliberate coin faucet that no cell in the workbook accounts for.

**Done when:** the model prices a set in draws rather than in cards, and the duplicate refund is
a line in it. Until then `dupCoins` is a feel number, not a modelled one.

### Only board 1 is authored
`Collection.boardFor(n)` past the last authored board re-points board 1's requirements at board
n's episodes, so the loop never dead-ends — but sets 2 and 3 are set 1's cast and clues wearing
different episode numbers. Fine for a simulator, wrong for a game.

**Done when:** `assets/cards/cards.js` has a real entry per set, with its own cast and its own
clue lines. It is content, not code: nothing in `js/collection.js` changes.

### Status points and the shelf are not in the model either
`statusPerEpisode`, `statusPerCard`, `statusPerBoard`, the ten items' prices and their points are
all hand-set. The shelf is now the main coin sink that is not a box, so its prices are what decide
whether coins have anywhere to go late in a run — exactly the question the cost curve used to
answer for builders.

**Done when:** the workbook has a Status tab and `Economy.apply()` projects it, the same way the
cost curve is projected today.

### The store's dollar prices buy nothing
The three box tiers and the coin/energy packs carry `$` labels, and tapping one grants the goods
without charging anything — it is a simulator, and there is no payment path. But the labels are
also not derived from anything: they are not in the model, so ARPU cannot be read off a run.

**Done when:** the model carries a price list and a conversion assumption, and the store reports
what a run would have cost.

---

## Economy plumbing

### The five relative knobs are stored but only one is wired
`economy.knobs` holds all five (earn, builderCost, energySupply, sessionFreq, wagerAppetite).
Only `builderCost` is read, by `Economy.costFor`. The other four are imported and ignored.

`cfg.boardScale` cannot stand in for the earn knob: it scales income **and** builder cost
together, so it is a pure currency redenomination with no pacing effect.

**Done when:** each knob has a decided call site, and it is stated whether `boardScale` survives
alongside them.

### ~~Box income is delayed here~~ — GONE ON THIS BRANCH *(builder loop)*
Nothing sits on a tile any more, so there is no placement to saturate and no delay between
earning a box and collecting it: a box is handed over and opened on the spot. The analysis below
is kept because it is about `main`'s loop, and because the simulation in it is the sort of thing
that is annoying to re-derive.

### Box income is delayed here, guaranteed in the model — but it is NOT capped *(builder loop)*
The model's Builder-net column credits 889.6 coins/builder (5 boxes × 80 coins + 1 energy, the
energy valued at `coinsPerRoll / (1 - energyPerRoll)` = 97.9). In the code a box is a marker on
a **free standard tile** — 26 slots, no stacking (`state.boxes` is a Set), and `spawn` silently
drops any it cannot place.

**An earlier note here claimed saturation was guaranteed at 240 builders. Simulation against
the real board model says otherwise, with about 3× of margin.** Boxes are consumed as fast as
they appear: landing is uniform over 40 tiles, so collections per builder are `rolls × B/40`
and spawns are 5, giving an equilibrium of `B = 40 × 5 / 22.43 ≈ 8.9` boxes on the board. Three
240-builder runs agree — mean 8.5 on the board, peak 14 of 26, **0 dropped**, 1191 of 1200
collected.

Saturation needs more than `22.43 × 26/40 = 14.6` spawns per builder. At the shipped
`boxesPerUpgrade = 1` we spawn 5. Raising it to 3 is where drops begin (306 lost of 3600); at 4
it is severe (1309 of 4800).

What is real is **delay, not loss**: ~9 boxes are in flight at any moment, so a box is collected
some rolls after the upgrade that granted it, and a run ends with ~9 never collected — a 0.8%
shortfall against the model's credit, which is a timing artifact rather than a leak.

**Done when:** someone decides whether that 0.8% tail matters. If `boxesPerUpgrade` is ever
raised above 2, this stops being academic and `spawn` needs a queue instead of a silent drop.

### The importer cannot produce the curve the game now ships
This got sharper. `ECONOMY_DEFAULT` is now **six segments**, fitted to economy model v3.12's
phased pacing. But `EconomyImport` still only knows the v3 layout — one `_costBase`, one
`_levelGrowth`, one `_exponent` solved from four anchors — so it can only ever build a
**single** segment. Importing any workbook today therefore *downgrades* the curve to one power
law and throws the phased pacing away.

v3.12 itself does not import at all: five Inputs labels moved (B14–B17 became a rate schedule,
B41 became a net total rather than a level-1 base), so the structural gate refuses it. Two
smaller problems ride along: `Guide!B2` was never bumped off the v3 string, and "Episodes in
series 1" — the 60 that `structure.episodesPerSeries` needs — lost its numeric cell and now
survives only as prose.

**Done when:** the workbook grows a segment table (`from`, `to`, `base`, `exponent`, and
optionally `bIndex`/`baseMode` or explicit levels) and the importer reads it as a discovered
table, the way it already reads the deck. Then the six shipped segments come from the
spreadsheet rather than from a fit checked into `js/economy.js`.

Until then the built-in model and the importable model are deliberately different shapes, and
`tests/suites/08-economy.js` writes the v3 constants into its stub workbook rather than lifting
them from `ECONOMY_DEFAULT`.

### No server — the browser is the database
An imported model lives only in `localStorage` (`pmdrama.econ.v1`), so it is per-browser and
per-machine, and clearing site data loses it. The slot keeps the version string and the source
filename so at least it is identifiable. Revisit when there is a backend.
