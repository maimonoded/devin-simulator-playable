# TODO

Things we know about and have deliberately not done yet. Each entry says what is wrong, why it
was deferred, and what "done" looks like — so picking one up doesn't mean re-deriving it.

Most of these came out of mapping `economy model v3.xlsx` onto the code. Where the spreadsheet
and the game disagree about the SHAPE of a mechanic (not just a number), the disagreement is
recorded here rather than silently resolved.

**This is the `collectible_version` branch**, now rebuilt to the Game Design Document: one draw
system with many pools, clues as the story gate, a 150-card Season catalogue, Status as a level,
and the Status Estate at the board's centre. Items written against the builder loop are marked
*(builder loop)* and are about `main`, not about this branch — they are kept because the two
branches are alternatives and whichever wins inherits this list.

---

## Prediction

### ~~The correct answer is always the shortest-odds one~~ — GONE, by removing the odds

In all 18 episode files `correct` points at the lowest-odds answer, and the odds travelled with
the answer through the shuffle — so tapping the lowest number won 100% of the time at mean odds
1.674. A guaranteed +67.4% per bet against a model built around +0.23.

**GDD §7.3 removed the mechanism.** Odds are flat: every answer pays `Economy.flatMultiplier()`,
and `answers[].odds` is read by nothing. There is no number beside an answer to read a tell off.

The *authoring* habit underneath it survives — the correct answer is still usually the most
plausible-sounding one — but that is now a question of how well the questions are written rather
than an arithmetic exploit. **Still worth doing:** make the correct answer sometimes the
counter-intuitive one across the library, and fix the `episode-prediction-questions` skill that
generates these files, or episode 19 arrives with the same habit.

### ~~Wager sizing is in the wrong unit~~ — DONE
The model has three tiers as a share of balance (safe 5 / confident 10 / max 20) and the 20% cap
is explicitly the anti-bankruptcy guard. The game had one absolute slider to 100% of the balance.

`Economy.wagerTiers(balance)` prices the three, `cfg.minWager` is the floor under all of them,
and the prediction screen offers exactly those three buttons — Confident preselected, because it
is the tier the workbook's projections assume.

**Still undecided: participation** — see the auto-policy note below.

### What should clues do in MANUAL play?
Clues are wired end to end: they are the gate (four of an episode's eight unlock it) and they set
the modelled accuracy (`Economy.accuracyFor(Clues.countFor(id))`), and the wager screen shows the
ones you hold under **Review the evidence**. But accuracy only decides the outcome in **auto**
runs — a manual pick still wins on its merits (`sel === correct`), which is the right call for a
game and leaves the model's accuracy curve half-used.

What the player gets today is *information*: the evidence is on screen, and reading it is
supposed to be what makes the guess better. Whether that is enough is the open question.

Options: accuracy only ever models auto runs (today); holding more than the required four buys a
hint or eliminates an answer; clues grant a re-roll on a loss. A design decision, not a config
change.

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

It is now the *only* dead knob. `avgOdds` used to be the other one; it is the **flat payout
multiplier** now (GDD §7.3), read on every prediction a human makes as well as every one the
batch tool settles — which is about as honest a call site as a number gets.

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
The large bonus is presented as a three-rung ladder (`minigames/gala-match3.html`). It lives on a
**pool row** now rather than on a tile of its own — the `bonus` table's "The good table" carries
`game` and `ladder`, so the amount there is a ceiling and the winning rung is picked before the
game opens. The model has only ONE number for it, so the design is: **top rung = `cfg.trainLarge`, the two lower rungs are
exactly 1/3 and 2/3 of it, and the winning rung is an even pick of the three.**

An even pick of 1/3, 2/3 and 1 averages **2/3**. So:

| | model | board |
|---|---|---|
| one large bonus | 315 | **2/3 of the row's ceiling** |
| per arrival landing | 149.25 (`Economy.trainEV`) | `Economy.trainRealEV` |

That is a **25% cut** to the arrivals' output. It is deliberate and measured rather than hidden —
both numbers are computed and the tests assert the gap — but it is not reconciled with the
spreadsheet, and the row's `amount` in `assets/pools/pools.js` was raised to 690 by hand to
compensate rather than by anything the model says.

**Done when:** either the ladder is anchored on its MEAN instead of its top (multiply all three
rungs by 1.5 — the top rung becomes 472 and the EV returns to exactly 315), or the workbook gains
real cells for the three rungs and their odds, and `EconomyImport` learns to read them.

### Advance-to-Start pays double what the model prices
`Tile.advanceToStart` pays `startPass + startLand` (200) and re-seeds the Gala pot. The workbook
says the Advance card "collects the pass bonus" and prices it at 100.

On this branch it has two callers again: the Premiere corner's own landing, and the Mixed pool's
`move: "start"` row — which is the plot-twist deck's Advance card, back as a table row.

### ~~Board composition is not configurable~~ — DONE
The ring is data now: `assets/board/board.js` declares each Season's tiles and
`js/board-model.js` reads it, with nothing assuming 40. `Inputs!C20–C24` still describes the OLD
mix (26 standard / 4 train / 6 deck / 4 corner) rather than GDD §3.1's (20 standard / 6 NPC /
4 arrival / 6 twist / 4 corner), so the importer still has no landing point — but the landing
point now exists on the code side, which is the half that used to be missing.

**Done when:** the workbook's tile-mix cells match the Season's types and `EconomyImport` writes
them into a board entry.

### ~~Standard tiles are position-weighted here and flat in the model~~ — GONE
`stdWeights` printed a mean-1 ramp of 22…56 coins across the standard indices. Every landing
draws from a weighted pool now (GDD §3.2), so a tile has no printed value at all and `stdWeights`
is deleted. The model's flat `stdBase` is correspondingly unread — see "Known dead config" in
CLAUDE.md.

### The Gala is a jackpot here and a smooth rebate in the model
The pot only pays out when the token lands on the Gala corner (p = 0.025/roll). Same long-run EV,
completely different variance, and the model has no pool balance at all.

What changed on this branch is that the pot is now *fed by the player's losses* as well as by a
per-lap seed: a negative Plot Twist takes coins and puts them in the Gala (GDD §3.4). That makes
the variance load-bearing rather than incidental — the Gala is the reason a twist is bearable —
but it also means the model's smooth rebate is further from the felt shape than it was.

**Done when:** the workbook prices the twist's take and the Gala's payout as one loop, or the
Gala is re-derived as a rebate and the twists stop feeding it.

---

## The collection *(this branch)*

### The drop tables and the pools are not in the economy model
`boxTiers` and `deckBoxes` live in `js/config.js`, and the four weighted pools live in
`assets/pools/pools.js`. Neither is described by `economy model v3.xlsx`, so `Economy.apply()`
does not own them and `loadConfig()` treats the tier list like a camera setting — it survives a
model change rather than being replaced by it.

That means the two things this loop's pacing actually depends on — how often a **card** drops and
how often a **clue** does — are the two things the workbook cannot say. Days-to-unlock an episode
is `Clues.expectedDraws()` (about five draws for four of eight) divided by the board's clue rate,
and the board's clue rate is `Pools.boardShareOf("clue")`, which is authored by hand.

GDD §4.6 says as much: these are "a coherent starting shape for the simulation to tune, not tuned
values". The tuning drawer prints both the per-pool and the per-board share so at least the two
numbers are visible.

**Done when:** the workbook grows a Pools tab and a Packs tab, the importer reads them, and
`Economy.OWNED_CFG_KEYS` grows them — at which point the identity guard in `loadConfig()` can be
dropped, because the model would be the source of truth again.

### The duplicate rate is unmodelled, and it is most of the run
A Season catalogue of 150 drawn by rarity needs far more than 150 draws to complete — and GDD
§4.3 makes that *deliberate*, because the third copy of a card is what converts it into a
Collectible. So duplicates are not waste here; they are the mechanism. But the workbook has no
cell for any of it: not the conversion, not the trickle past the third copy, not the coin refund
on a copy that did neither.

That coin refund is a large faucet — `cfg.dupCoins × rarity.dup`, up to ×25 on a Legendary — and
nothing in the model accounts for it.

**Done when:** the model prices a Season in DRAWS rather than in cards, with conversion and the
duplicate refund as lines in it. Until then `dupCoins` is a feel number.

### ~~Only board 1 is authored~~ — GONE, and replaced by a different gap
Sets used to be per-board card requirements, and sets 2 and 3 were set 1's cast wearing different
episode numbers. The catalogue is Season-wide now (150 cards, 15 sets of ten), so there is nothing
to re-author per set and the loop cannot dead-end.

**What replaced it:** only Season 1 is authored. `Status.advanceSeason()` is written and tested
and refuses to run, because `BOARD_SEASONS[1]` and `CARD_SEASONS[1]` do not exist — so reaching
level 30 holds at the gate rather than turning over. That is the honest behaviour, and it means
the Season reset is code without content.

**Done when:** a second Season exists — a board entry, a 150-card catalogue with fresh ids, and a
cast. It is content, not code: nothing in `js/status.js` or `js/cards.js` changes.

### Episodes 013–018 are written but not loaded
Six episode files exist, complete with their eight clues each, and have no `<script>` tag in
`index.html`. The run is twelve episodes. Adding the six tags extends it by a set and a bit.

**Done when:** someone decides whether the run should be 12 or 18, and the tags match.

### ~~Status points and the shelf are not in the model either~~ — DONE
`economy.status` now holds the Season's levels, its opening climb, its **total** — the Season
gate, which GDD §5.4 calls "the single most important value in the game" — and the two per-source
inflows the collection cannot pay for you. `Economy.apply()` projects them and
`OWNED_CFG_KEYS` owns them, so a model version bump replaces them rather than letting a stale
save outvote them.

**What is still hand-set:** the ten items' prices and their points, and the rarity table's
`status` / `trickle` / `dup` columns. Those are the *other* two inflows, and they live in content
files rather than in the model.

**Done when:** the workbook's Status tab covers the rarity ladder and the shelf too, and §5.4's
"expected daily contribution per archetype" is something the drawer can print rather than
something a person works out.

### The store's dollar prices buy nothing
Coins carry `$` labels and tapping one grants them without charging anything — it is a simulator,
and there is no payment path. GDD §8.4 narrowed this usefully: **coins are the only thing with a
dollar price now**, because real money must never buy packs directly. So there is exactly one
conversion to model rather than five.

But the labels are still not derived from anything: they are not in the model, so ARPU cannot be
read off a run.

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

---

## Status & the Season

### The Season gate is unreachable from the interface

GDD §5.2 gives the Status Level exactly one job — *"Gates the next Season"* — and §5.4 calls the
gate **"the single most important value in the game"**. `js/status.js` implements it correctly:
`seasonReady()` at the cap, and `advanceSeason()` moves `state.seasonFrom` so Status reads zero
while the collection, the Showcase and the lifetime record all persist (§5.3).

**Nothing in `js/ui/` ever calls it.** `grep -rn "seasonReady\|advanceSeason\|hasNextSeason"
js/ui/` returns nothing. Reaching level 30 shows "Season complete" on the profile and the run
simply stops there.

It is dormant rather than broken, for a legitimate reason: **only one Season is authored**
(`CARD_SEASONS.length === 1`, `BOARD_SEASONS.length === 1`), so `hasNextSeason()` is false and
`advanceSeason()` would refuse anyway. The profile now says so in as many words rather than
implying something waits behind the gate.

**Done looks like:** a second Season's content exists (a board entry, a card catalogue, a cast,
episodes), and reaching the cap plays a turnover beat — the Season's report card (§9's Season
Report Card is the obvious shape), then the new board. The engine side needs nothing; this is
content plus one screen.

**Worth knowing before starting:** the turnover is the one moment where "Status resets" and
"nothing is deleted" have to be visibly true at the same time. `state.seasonFrom` is what makes
that honest — the line moves, the record does not. A turnover screen that reads as *losing* the
Season is the failure mode.

### Episode 60 and the gate are supposed to land together

§8.2: *"Season gate and episode 60 land within a few days of each other for the engaged
archetype."* §8.3 names the failure it prevents: a player who runs out of episodes long before
the gate is *"left staring at a wall she cannot influence, which is the worst churn moment the
design can produce."*

This build satisfies it — measured, at 18 episodes and `statusTotal: 5800`, the last episode and
level 30 both land around session 6. **It is not self-maintaining.** Any change to the clue rate,
the episode count or the per-copy Status value moves the two independently, and the sim in
`tools/` is the only thing that will notice. Re-measure both numbers together after any of them
moves, not just the one that changed.
