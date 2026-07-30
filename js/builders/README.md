# Builder / series system

The **coin sink** and the **episode-unlock engine**. Coins earned on the board are spent here;
**completing a builder** unlocks one story episode, and maxing every builder ends the series.

All of it lives in [builders.js](builders.js) as a single `Builders` object (it's one system, not
a family of types — unlike [tiles](../tiles/README.md) and [overlays](../overlays/README.md),
which use registries). It never touches the DOM: `upgrade()` mutates state and returns a result
the UI announces.

## Model

- `cfg.buildings` builders (default 12), each with `cfg.tiers` levels (default 5).
- An episode unlocks **only on the level that completes a builder** — intermediate levels pay
  coins and spawn boxes but no episode. So a full series is `buildings` = **12 episodes**,
  each costing `tiers` upgrades to earn.
- Progress is `state.builder`: an array of `{tier}`, index 0 = "Builder 1".

## Cost curve

**The curve lives in [`js/economy.js`](../economy.js), not here.** `Builders.cost()` only
translates a series-local builder index into a global builder number and asks `Economy.costFor`.

```
cost(b, L) = base × levelGrowth^(L-1) × b^exponent × boardScale × costKnob
```

That is a **power law** in the builder index `b`, not an exponential — `b^0.0498` grows 1.31×
across 240 builders where a `1.05^b` exponential would grow 115,942×. Pacing comes from the
level ramp and the number of builders, not from later builders escalating. The exponent is
*derived* from four pacing anchors (60 episodes in 14 days, 240 in 60), which ride along in the
segment so it can be re-solved rather than guessed.

The curve is a **list of segments**, because no single formula holds for a whole run. Each owns
a builder range; `bIndex` says whether `b` keeps counting or restarts inside the segment, and
`baseMode` says whether the segment steps at the boundary or is solved to continue smoothly.
A segment may also be an explicit per-level table instead of a formula.

**The last segment must have no `to`.** `Economy.validateCurve()` enforces it — a bounded final
rule would leave builders past it unpriced and deadlock the game. See the header of
`js/economy.js` for the full contract.

## Series

A run is a sequence of series, ordered, defined by the economy model. `cfg.buildings` is the
*current* series' length and `state.series` says which one is being played. Builder indices in
this file are always local to that series; `Economy.globalOf()` converts to the global number
that the cost curve and the episode registry are keyed by — so series 2's first builder is
local 0, global 61, and unlocks episode `061`.

A series can never be longer than the episodes left for it, since completing a builder is what
unlocks one. `Economy.seriesShape()` hands each series what it can from the remaining pool;
series past the content wall come back with zero builders and stay locked.

`advanceSeries()` moves to the next one **without wiping the run** — coins, day, energy and the
unwatched episode queue all carry over, and only the builders are fresh.

## API

| Group | Methods |
|---|---|
| Shape | `count()`, `maxTier()`, `all()`, `fresh()`, `reshape()` |
| Queries | `tier(i)`, `isMaxed(i)`, `progress(i)` (0–1), `doneCount()`, `allMaxed()` |
| Cost | `cost(i, tier)`, `nextCost(i)` (null when maxed), `canAfford(i)`, `cheapest()` |
| Series | `totalEpisodes()`, `unlockedEpisodes()`, `unlockEpisode()` |
| Transaction | `upgrade(i)` |

`upgrade(i)` returns `null` when the purchase isn't allowed — maxed, not enough coins, series
already finished, or mid-animation — otherwise:

```js
{cost, level, title, builderDone, seriesDone, spawned}
```

`spawned` is the tile indices of mystery boxes placed by the purchase (see
[../overlays/README.md](../overlays/README.md)). `title` is the episode queued onto
`state.epQueue` — **`null` unless this purchase completed the builder** — which the prediction
flow consumes.

`reshape()` rebuilds the array after `buildings` / `tiers` change in tuning, preserving each
builder's progress where it still fits (levels clamp down to the new `tiers`).

## Who calls it

```
js/ui/render.js   renderBuilderCenter()  skyline: one tower per builder, height = progress(i)
                  renderBuilderList()    rows, level pips, cost buttons, series bar
js/ui/main.js     uiUpgrade(i)           calls upgrade(i), then toasts/logs the result
                  autoPlay()             spends via cheapest()
js/ui/overlays.js seriesComplete()       finale modal, reads count()/totalEpisodes()
js/state.js       initState()            seeds state.builder via fresh()
js/storage.js     load/save              persists the tier array, reshapes on count mismatch
js/ui/drawer.js   tuning + reset         calls reshape() when buildings/tiers change
```

## Notes

- **Episode unlocking lives here** because it's triggered by purchases. The queue is *drained*
  by the prediction flow in [../ui/overlays.js](../ui/overlays.js) — `unlockEpisode()` pushes,
  `resolvePrediction()` in [../game.js](../game.js) shifts.
- Read builder state through this API rather than poking `state.builder` / `cfg.tiers` directly,
  so the cost curve and completion rules stay in one place. `js/storage.js` is the one exception:
  it owns the persisted shape and maps the array directly.
