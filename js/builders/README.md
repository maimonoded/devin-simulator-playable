# Builder / series system

The **coin sink** and the **episode-unlock engine**. Coins earned on the board are spent here;
every level bought unlocks one story episode, and maxing every builder ends the series.

All of it lives in [builders.js](builders.js) as a single `Builders` object (it's one system, not
a family of types — unlike [tiles](../tiles/README.md) and [overlays](../overlays/README.md),
which use registries). It never touches the DOM: `upgrade()` mutates state and returns a result
the UI announces.

## Model

- `cfg.buildings` builders (default 12), each with `cfg.tiers` levels (default 5).
- A full series is `buildings × tiers` = **60 episodes**.
- Progress is `state.builder`: an array of `{tier}`, index 0 = "Builder 1".

## Cost curve

```
cost(builderIndex, tier) = baseCost × tierGrowth^tier × bldgGrowth^builderIndex × boardScale
```

Two independent growth factors: `tierGrowth` (1.8) makes each *level* of a builder pricier, and
`bldgGrowth` (1.05) makes *later builders* pricier at every level. So Builder 1 Lvl 1 costs
1,200 while Builder 12 Lvl 5 costs ~21,545. All five values are live-tunable in the drawer's
"Builders & series" group.

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
`state.epQueue`, which the prediction flow consumes.

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
