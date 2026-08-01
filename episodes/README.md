# Episodes

One episode per completed builder — but **not that builder's episode**. Episodes are handed out
in story order: the first builder you finish earns `001` whichever one it was, the second earns
`002`, and so on. Builders are bought in whatever order the player can afford, and a serialised
drama watched out of order spoils itself. Each episode is two files that share the id:

```
episodes/
  001.js     the prediction (question, answers, correct answer)
  001.mp4    the video, played after the bet is locked in
```

The id is the whole identity: `003` is the third episode of the story and its video path is
always `episodes/003.mp4`. Nothing inside the file repeats that.

## Prediction file schema

```js
Episodes.add({
  "id": "001",                       // must match the filename
  "title": "Six Months on the Street",   // shown as the episode name
  "question": "Why is Simon really living on the street?",
  "answers": [                       // 2+ options, in display order
    { "text": "He's undercover, building a case against his own uncle", "odds": 1.82 },
    { "text": "His family forced him out and seized everything he owned", "odds": 2.22 }
  ],
  "correct": 0,                      // 0-based index into answers
  "difficulty": 4                    // optional, 1–10 (default 1)
});
```

| Field | Meaning |
|---|---|
| `id` | Three-digit string, matches the filename. Its position in the story, and where the video lives. |
| `title` | Episode name in the modal, toast and activity log. |
| `question` | The prediction prompt. |
| `answers[].text` | Option label. |
| `answers[].odds` | Payout multiplier if that option is picked **and** it's right — a wager of 500 at ×2.4 returns 1,200. Longer odds should go on less likely answers. |
| `correct` | Index of the true answer **as listed in this file**. Decides win/loss in manual play. The game reshuffles the answer order on every showing, so the correct answer doesn't sit in a predictable position — you don't need to vary it across files. |
| `difficulty` | **Optional.** How hard the call is, `1`–`10` (10 = hardest). **Defaults to `1`** when absent. Values outside the range are clamped. Informational for now — nothing in the game reads it yet; available as `Episodes.difficultyOf(id)`. |

The payload is plain JSON wrapped in one `Episodes.add(...)` call. That wrapper is what lets the
game run straight from `file://` by double-clicking `index.html` — browsers block `fetch()` of
`.json` on file URLs, so the data is delivered as a script instead. The object itself is
JSON-valid, so these can be converted to real `.json` files if the project ever gets a server.

## Adding an episode

1. Create `episodes/013.js` following the schema above.
2. Add `<script src="episodes/013.js"></script>` to [../index.html](../index.html), with the
   other episode scripts.
3. Drop `episodes/013.mp4` alongside it when the video exists.

Episodes are handed out in order as builders are completed, so the count that matters is how
many episode files exist, not which builder finished. If `cfg.buildings` is raised above the
number of files, later completions cycle back through the existing ones rather than failing.

## Watch now, or binge later

Completing a builder unlocks an episode and pops **Watch now / Binge later**
(`openEpisodeUnlock`, `js/ui/prediction.js`). Declining costs nothing: the id stays in
`state.epQueue`, and the builders view grows a 🎬 button above the upgrade row, badged with how
many are waiting, which drops straight into the prediction for the one at the front. That button
is the only route back to a banked episode in the mobile layout, where the side panel's
**Predict & watch** is not on screen.

Two guards on that popup, both in `uiUpgrade` (`js/ui/main.js`):

- **Never during an auto mode.** A modal would stall the loop, which is the one thing the two
  auto modes are built not to do.
- **Never over the finale.** `seriesComplete()` owns the screen when a series ends; the episode
  is still queued and still reachable from the 🎬 button.

The result screen offers **Next episode →** with a count while the queue is not empty, so a
binge does not mean closing back to the board between every one.

## The library

The 🎞 button on the board opens every episode unlocked so far (`js/ui/library.js`). It appears
once there is something in it.

**The list is derived, not stored.** `Builders.unlockedEpisodeIds()` is the first N episodes,
where N is how many builders have been completed (`unlockedCount()` — plus every builder of a
series already behind you, since a series cannot be left until all of it is maxed).

**Episodes come off the FRONT of the story, not from the builder that paid for them.** Builders
are bought in whatever order the player can afford; the drama is serialised. Completing builder
3 before 1 and 2 still earns **episode 1**. So the unlocked set is always a prefix of the
library — which is what makes the ordering rule below meaningful.

**A first viewing always starts at the earliest unwatched episode.** Tapping episode 5 in the
library when 4 is unwatched plays 4, with a toast saying so, and the row that will actually play
is tagged `NEXT`. `Builders.firstUnwatchedId()` is the single answer both the library and the 🎬
button use, so the two entry points cannot disagree. **Rewatching is unrestricted** — the
constraint is only about seeing something for the first time.

`state.epQueue` is the only thing persisted here, and it holds what is still **unwatched**. It
shrinks as episodes are watched, so it can never be the library: a run with four unlocked and
three watched would show one. That is exactly the bug a stored `epUnlocked` list was added to
fix — and deriving instead fixes it without the list, without a migration, and without a second
counter that can drift from the builders it counts.

A row does one of two things, because the two states are genuinely different:

| Row | Tap does |
|---|---|
| **NEW** (still in `epQueue`) | the full flow — prediction, wager, result |
| watched | the video alone: no prediction, no wager, no clue spend, no queue change |

Betting on an episode whose ending you already know is not a bet, which is why a replay skips
straight to playback. `openPrediction(id)` takes an optional id so the library can start a
first viewing for **any** unwatched episode, and `resolvePrediction({id})` removes that id
rather than shifting the front of the queue — without it, playing episode 3 from the library
would mark episode 1 watched.

## Watching an episode

Clicking **Predict & watch** (or 🎬, or **Watch now**) opens the prediction modal, and the flow is:

1. **Pick an answer.** Options are reshuffled every showing (see `correct` above).
2. **Pick a wager tier.** Three buttons — **Safe**, **Confident**, **Max** — each a share of
   what you currently hold (`cfg.wagerSafe/wagerConfident/wagerMax`, 5% / 10% / 20%).
   Confident is preselected because it is the tier the economy model's projections assume.
   `cfg.minWager` (default 100) is a **floor under all three**, never a ceiling, so early on
   every tier reads the same until your balance clears it — the modal says so when it happens.
   - There is no free slider. The model sizes a bet as a share of the balance, and a bet the
     player can set to anything makes its "average wager" meaningless.
   - **Watch later** closes the modal and leaves the episode queued. **Skip & watch** watches
     with no wager and is *always* available — the model expects a stake on 95% of predictions
     (`participation`), which only means something if declining is a real choice.
   - If you hold less than `cfg.minWager` the tiers are replaced by an explanation, and
     Skip & watch is the way through.
3. **The outcome is resolved at this point**, before playback — the video is the reveal.
4. **The video plays**, then the win/loss screen appears.

### Leaving mid-episode

The video is the reveal, so walking out of it **forfeits the reveal rather than skipping to
it**. Closing the player offers *Finish watching* / *Leave it*; the result only appears once
the episode has actually played to the end.

The bet is already locked at that point — coins have moved and the episode has left the queue —
so there is no second wager. `state.pendingReveal` holds the decided outcome and is
**persisted**, which is the point: closing the tab mid-episode must not be a way to duck a
losing bet or re-bet a won one. On return:

- any attempt to open a prediction, **including on a different episode**, resumes the sealed
  one instead (otherwise the reveal could be dodged forever by starting something else)
- the library tags that row **FINISH** and any row resumes it
- the 🎬 button stays visible even with an empty queue, because a result is still owed

A missing or broken video resolves as *completed*: there is nothing to walk out of, and
withholding the result then would punish the player for a file that never loaded.

### How the correct answer is used

- **Manual play and auto-roll** — you win only if your pick matches `correct`.
  Payout is `wager × odds`.
- **Auto-play session** — the outcome is modelled with `cfg.accuracy` (default 65%) instead,
  so batch runs measure the economy without depending on which option a script clicks.

The result screen names the true answer when you get it wrong.

## The video player

Implemented by `playVideo()` in [../js/ui/fx.js](../js/ui/fx.js); the markup lives in
`playEpisode()` in [../js/ui/overlays.js](../js/ui/overlays.js).

| Behavior | Detail |
|---|---|
| **Autoplay** | Starts on its own, with sound. If the browser blocks autoplay-with-audio it retries muted and shows a "tap for sound" badge. |
| **No seeking** | The player has no `controls`, so there's no seek UI. Forward seeks are additionally snapped back to the furthest point actually watched; rewinding is allowed. The right-click menu is suppressed. |
| **Pause / resume** | Click the video. The frame dims and a ▶ glyph appears while paused. |
| **Progress** | A bar along the bottom plus an `m:ss / m:ss` readout. |
| **2× speed** | Press and hold the video (after `cfg.longPressMs`, default 350) for a temporary 2×, or use the **2× speed** button below it, which latches until clicked again. A gold `2×` chip shows while boosted. |
| **No exit** | Once playback starts there's no way out but to watch — the wager is already settled. |
| **Auto-play session** | Skips playback entirely: it reads the length from metadata, logs `Auto-play watched <title> · m:ss of footage (playback skipped)`, and moves on. Auto-roll does *not* skip. |
| **Missing video** | An episode with no `.mp4` (or a load error) falls back to the 🎬 placeholder for `cfg.fallbackSceneMs` (default 1700) and still reaches the result screen. |

Videos are portrait 9:16, so the modal sizes the player by height (`min(68vh, 620px)`) rather
than the usual fixed modal width.

`*.mp4` is in [../.gitignore](../.gitignore) — the footage is large and stays out of git.
