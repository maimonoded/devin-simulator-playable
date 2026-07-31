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

That is a **power law** in the builder index `b`, not an exponential — the shipped exponents
grow the price 1.43× across 240 builders where a `1.05^b` exponential would grow 115,942×.
Pacing comes from the level ramp and the number of builders, not from later builders escalating.

The curve is a **list of segments**, because no single formula holds for a whole run. Each owns
a builder range; `bIndex` says whether `b` keeps counting or restarts inside the segment, and
`baseMode` says whether the segment steps at the boundary or is solved to continue smoothly.
A segment may also be an explicit per-level table instead of a formula.

**The shipped curve is six segments**, fitted to economy model v3.12. That model does not ask
for one steady rate: it opens at 6 episodes/day, steps to 5 at day 5, then to 4 at day 15 easing
to 3.5 by day 60. The boundaries at builders 29 and 74 are where those steps land; the rest are
where one power law stops tracking the schedule within 1%.

The fit preserves the **sum** of prices over each segment, not the worst individual price —
days-to-finish is a cumulative total, so tracking the running sum is what keeps pacing honest.
The result reproduces the model's full run exactly, series 1 to within 12 minutes, and the
builder count at every day checkpoint. No single builder is more than 1% off the spreadsheet.
`tests/suites/08-economy.js` asserts all three.

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
js/ui/render.js   renderBuilders()       the builders view's 2D layer: page header + one
                                         upgrade button per building on the page
js/ui/builders3d.js  build()/update()    the buildings themselves, in their own 3D scene
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
