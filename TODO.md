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

A player who always taps the lowest number wins **100%** of the time at mean odds **1.674** — a
risk-free **+67.4%** on every coin staked. The wager tiers are what stop that running away: Max
stakes 20% of the balance, so a flawless run compounds 1,000 coins to about **9,600** across the
18 episodes rather than to millions. That makes the exploit survivable, not acceptable — the
economy model is built around a +0.23 edge, and a bet that cannot lose is not a prediction.

Root cause is authoring, not logic: odds were written to express *how plausible an answer is*,
and the correct answer is naturally the most plausible-sounding. That makes the odds a label
reading "pick me".

**Done when:** the correct answer is sometimes the longshot across the library, *and* the
`episode-prediction-questions` skill that generates these files is fixed — otherwise episode 19
arrives with the same bug.

### ~~Wager sizing is in the wrong unit~~ — DONE
The model's shape won. A bet is one of three tiers priced as a share of the balance — safe 5 /
confident 10 / max 20 — `Economy.wagerTiers()` sizes them against what the player is holding,
and `cfg.minWager` is the floor under all three. The 20% rung is now the anti-bankruptcy guard
the workbook always said it was, so the model's risk figure (a 3-miss streak costing 48.8% of
balance) describes the game rather than a slider that could stake everything.

`prediction.participation` did **not** come across, and deliberately: the model's 95% is an
outcome for a human rather than an input, so the game owes it the choice instead — Skip & watch
is always offered. The one place participation would be a real input is an auto-play policy,
which is where the balancing-tool item below picks it up.

### What should clues do in MANUAL play?
Clues are wired: they accumulate in `state.cycleClues`, set the accuracy via
`Economy.accuracyFor`, and are spent and reset by `resolvePrediction`. But accuracy only decides
the outcome in **auto** runs — a manual pick still wins on its merits (`sel === correct`), which
is the right call for a game and leaves the model's accuracy curve half-used.

Options: accuracy only ever models auto runs (today); clues buy a hint or narrow the options;
clues buy a second guess after a loss. This is a design decision, not a config change.

### Prediction is unreachable from the balancing tool
`openPrediction()` is only ever reached from a human tap — Watch, the library, or Pull once the
row is full. Neither auto mode opens it, so an auto run executes zero predictions and the model's
prediction EV (80.23 per prediction, 324 coins/day engaged) can never be observed in the tool
built to validate it.

The row wall makes that more than a missing measurement. `runAuto()` breaks with
`stopReason === "row"` the moment every placeholder on the row is full, because there is nothing
left to pull for — so the balancing tool halts every five episodes waiting for somebody to watch
them. A whole-series run is not something that can be left going.

Deliberately left as-is for now. **Done when:** auto-play runs predictions under a stated policy
for wager tier, participation and clue spend.

Two of those three already exist to be pointed at: `Economy.wagerTiers(balance)` gives the policy
a tier to name (Confident is `Economy.DEFAULT_TIER`, the one the workbook assumes), and the clue
spend is `Economy.accuracyFor(state.cycleClues)`. Participation is the undecided one — 0.95 in
the model, unprojected on purpose, and an input only here.

---

## Session & time

### Auto-play cannot span days
`advanceSession()` has exactly one caller, the Next session button, so an auto run never moves
the clock — and it never pauses for cards either: when the shoe empties, auto-play buys its own
pack (without that it earns coins forever and models nothing). A session run therefore ends on
the row wall rather than on an empty deck, having advanced the day counter by zero.

That is the right behaviour for a loop nobody is watching, and it means the model's headline
pacing — 59.6 days for all 240, 12.0 for series 1 — is still not measurable in-engine.

**Done when:** there is an explicit multi-day batch mode, separate from the two current auto
toggles.

### The model's daily allowance came out rather than in
The workbook's third brake on its "Fastest 5%" cohort is a hard cap of 240 energy a day
(`Inputs!C7`). Nothing in the game answers to it: `EconomyImport` still asserts that label so an
inserted row is caught, but lands the value on `_dead` and deletes it before assembly, so it can
never be read.

What the code has instead is a ceiling that falls out of `advanceSession()`:
`min(packSize × sessionsPerDay, 1440 / cardRegenMin)`. At defaults that is **125 cards a day**,
the first term binding; the regen term only takes over once `sessionsPerDay` is pushed past 9.6,
and then it caps at 480. 125 cards is five ticket cards, and with the Plot Twist's Backstage pass
and the mystery box's ticket on top a run that never buys a pack measures about **two episodes a
day** — half the model's 4.03.

So the free rate is not a translation of the model's cap; it is a different number doing a
different job, and the other half of the model's pace has to come from bought packs — which is
the item below.

### The free-card rate is the game's only pacing gate, and coins walk straight past it
`cfg.cardRegenMin` is the clock. Cards arrive one per three game-minutes, `advanceSession()` is
the only thing that deals them free, and nothing else in the game is rationed — coins are not,
tickets bought with coins are not, and there is no energy any more. That leaves the free-card
rate as the only gate there is, and it is a gate with a road around it.

The road is the store. A pack is 50 cards at `Economy.packPrice(state.ticketsPriced)` — **397
coins** at the start of a run and 1,909 at the very end of the 240th episode, so 8 to 38 coins a
card — against a board that pays about **76 coins a pull**. A pack therefore funds the next
several, and a player who buys whenever the deck runs dry never waits for anything. Simulated
against the real board model, the whole 240-episode story takes ~15,800 pulls and 307 bought
packs, costs ~316k coins, earns ~1.21M along the way, and finishes ~900k coins up having
advanced the clock by **zero minutes**.

So the gate only paces the player who declines to spend — and that player is also the one sitting
on 10,500 unspent coins a day. This is not a "the pack is priced too low" problem that a bigger
number fixes: the price answers to `state.ticketsPriced`, which walks the cost curve, and the
curve deliberately grows only 1.43× across 240 episodes while board income stays flat. Nothing in
that shape can ever catch up.

**Done when:** it is decided what actually paces a run — a pack price that answers to how many
have been bought recently rather than only to how many rungs have been priced, a per-day purchase
limit, or a second sink large enough that coins stop being free. Until one of those exists,
days-to-finish is not a property of the economy; it is a property of how long somebody keeps
tapping.

### No player archetypes
The model's Archetypes and Projection sheets rest on a cohort dimension (casual 0.6× / engaged
1.0× / fastest 5.0× session multipliers) that has no trace in the code. Three cohorts means
three hand-edited runs.

### Login rewards are unmodelled income
`LOGIN_REWARDS` in `js/content.js` pays ~4,650 coins/week ≈ **664 coins/day**, about 9% on top
of the model's 7,344 engaged board coins/day. The solved cost exponent is calibrated without
them, so the game runs permanently ~9% ahead of what the sheet predicts, compounding over the
60-day horizon.

It is also conditional in a way the sheet cannot express: the ladder pays on a day rollover, and
days only turn over inside `advanceSession()`. A player who buys packs instead of taking sessions
collects none of it.

**Done when:** either the workbook gains a login-reward term (and the exponent is re-solved), or
the ladder comes out of the game.

### `cfg.secPerPull` is still dead
Imported from `Inputs!C9`, in the drawer, read by nothing. In-game time only moves in
`advanceSession()`, so there is no quantity to compare it against. The model uses it to derive
"active minutes per session" (3.01) against a 3–7 minute Dashboard target band.

Only the cfg key was renamed: the workbook's label still reads "Seconds per roll" and that is
the string the importer's layout gate asserts, so it stays spelled that way until the spreadsheet
is re-cut.

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

That is a **25% cut** to the train's output, which slows the ticket curve. It is deliberate and
measured rather than hidden — both numbers are computed and the tests assert the gap — but it is
not reconciled with the spreadsheet.

**Done when:** either the ladder is anchored on its MEAN instead of its top (multiply all three
rungs by 1.5 — the top rung becomes 472 and the EV returns to exactly 315), or the workbook gains
real cells for the three rungs and their odds, and `EconomyImport` learns to read them.

### Advance-to-Start pays double what the model prices
`Tile.advanceToStart` pays `startPass + startLand` (200) and re-seeds the VIP pool. The workbook
says the Advance card "collects the pass bonus" and prices the Premiere row at 100. Both the
Premiere corner and the Plot Twist deck's Advance card share that one helper, so the decision
moves two board rows together.

### Board composition is not configurable
`Inputs!C20–C24` (40 tiles: 26 standard / 4 train / 6 deck / 4 corner) matches the code exactly,
but the code's version is `const` data in `js/board-model.js` and the `40` itself is a literal in
half a dozen places — board-model's own weight loop and `pathToStart`, the overlay spawner, the
pull's step loop, the storage filter, the renderer. The importer therefore does not read those
cells. Changing the tile mix in the spreadsheet has no landing point.

### Standard tiles are position-weighted here and flat in the model
`js/board-model.js` builds a mean-1 ramp printing 22…56 coins across the 26 standard indices.
Uniform-landing EV is identical (40) so the model is not wrong, but it has no column for a
per-tile value and so cannot express which tiles are the good ones. Realized mean is **39.5**
because teleports over-weight the cheap early tiles — measured over a full run, and all but
unchanged by the move to cards: a step distribution of 1…12 leaves landing as uniform as a die
did.

### VIP is a jackpot here and a smooth rebate in the model
The pool only pays out when the token lands on index 20 — one landing in forty, and a ticket card
is a pull that lands nowhere at all. Same long-run EV, completely different variance, and the
model has no pool balance at all.

---

## Economy plumbing

### The five relative knobs are stored but only one is wired
`economy.knobs` holds all five (earn, ticketCost, cardSupply, sessionFreq, wagerAppetite).
Only `ticketCost` is read, by `Economy.costFor`. The other four are imported and ignored.

`cardSupply` is the one that has grown teeth: it is the knob that would scale the free-card rate,
which is the only pacing gate the game has. `cfg.boardScale` cannot stand in for the earn knob —
it scales income **and** ticket cost together, so it is a pure currency redenomination with no
pacing effect.

**Done when:** each knob has a decided call site, and it is stated whether `boardScale` survives
alongside them.

### `BOX_INCOME` no longer describes anything
The model's Builder-net column credits 889.6 coins per builder, and `tests/suites/08-economy.js`
carries that as `BOX_INCOME` and subtracts it per builder to reproduce the workbook's
days-to-finish. As a check on the FIT that is still sound — the workbook says 889.6 and the test
is asking whether the six segments reproduce the workbook. As a description of the game it is
now nonsense: the number was derived as 5 boxes × (80 coins + 1 energy) with the energy valued at
`coinsPerRoll / (1 - energyPerRoll)` = 97.9, and **there is no energy left to value**.

Re-deriving it is not a matter of swapping a card in for the energy, because three things moved
at once:

- a box's item 2 pays a **ticket**, and a ticket is worth a rung of the cost curve rather than a
  flat coin amount — 159 coins at rung 1, 1,145 at rung 1,200;
- granting a ticket does not advance `state.ticketsPriced` (only `Shoe.mintPack` does), so a free
  ticket takes a rung off the *top* of what a run ever pays. Over a full 240-episode run about
  568 of the 1,200 tickets arrive free — from the Plot Twist's Backstage pass and from boxes —
  and the player is billed for roughly 632 rungs, ~316k coins against the curve's own total of
  651k;
- boxes no longer arrive five to the episode. One drops per ticket **card**
  (`cfg.boxesPerTicketCard`), and only about half the tickets come off cards, so it is nearer
  **2.6 boxes per episode**.

**Done when:** the constant is re-derived in ticket terms — box coins plus the rung a free ticket
removes — and the pacing test says out loud whether it is asserting the workbook or the game.

### Box income is delayed, but nothing is lost
Related and settled, so it does not become a mystery again. A box is a marker on a **free
standard tile** — 26 slots, no stacking — and boxes are consumed about as fast as they appear:
landing is uniform over 40 tiles, so with ~63 moves and ~2.6 spawns per episode the equilibrium is
`40 × 2.6 / 63 ≈ 1.7` boxes on the board. Full 240-episode runs land just under that: mean 1.5,
peak 6 of the 26 eligible tiles, nothing ever queued. Raising `cfg.boxesPerTicketCard` to 5 still
places every box (peak about 20 of the 26); at 10 the board finally saturates.

Overflow is not a leak either. `dropBoxes()` banks whatever `spawn()` could not place in
`state.pendingBoxes` and drops it on the next award, so a full board delays a reward rather than
eating it. What is real is that delay: a box is collected some pulls after the ticket that
granted it, and a run ends with a couple still sitting there uncollected.

### The importer cannot produce the curve the game ships
`ECONOMY_DEFAULT` is **six segments**, fitted to the phased pacing that steps 6 → 5 → 4
episodes/day. But `EconomyImport` still only knows the v3 layout — one `_costBase`, one
`_ticketGrowth`, one `_exponent` solved from four anchors — so it can only ever build a
**single** segment. Importing any workbook today therefore *downgrades* the curve to one power
law and throws the phased pacing away.

The gap has narrowed from the spreadsheet's end without closing. The workbook now carries the six
segments natively, in a block on its Builder tab, so it and `js/economy.js` describe the curve the
same way — but there is no reader for that block, and the two lists are kept in step by hand,
which is exactly the arrangement that drifts. Everything the importer does read still speaks v3:
builders and levels, three energy rows routed to `_dead` for the layout gate alone, and the
pacing anchors at `Inputs!B14–B17` plus the level-1 base at `B41` that a rate-schedule model has
no reason to still print.

**Done when:** the workbook's segment table is read as a *discovered* table, the way the Plot
Twist deck and the box's second item already are. Then the six shipped segments come from the
spreadsheet rather than from a fit checked into `js/economy.js`.

Until then the built-in model and the importable model are deliberately different shapes, and
`tests/suites/08-economy.js` writes the v3 constants into its stub workbook rather than lifting
them from `ECONOMY_DEFAULT`.

### No server — the browser is the database
An imported model lives only in `localStorage` (`pmdrama.econ.v3`), so it is per-browser and
per-machine, and clearing site data loses it. The slot keeps the version string and the source
filename so at least it is identifiable. Revisit when there is a backend.
