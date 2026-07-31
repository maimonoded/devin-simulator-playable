# Episodes

One episode per builder. Completing **builder N** unlocks episode **NNN** — builder 1 → `001`,
builder 12 → `012`. Each episode is two files that share the id:

```
episodes/
  001.js     the prediction (question, answers, correct answer)
  001.mp4    the video, played after the bet is locked in
```

The id is the whole identity: `003` is builder 3's episode and its video path is always
`episodes/003.mp4`. Nothing inside the file repeats that.

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
| `id` | Three-digit string, matches the filename. Determines which builder unlocks it and where the video lives. |
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

Episodes are matched to builders by number. If `cfg.buildings` is raised above the number of
episode files, builders past the end cycle back through the existing ones rather than failing.

## Watching an episode

Clicking **Predict & watch** opens the prediction modal, and the flow is:

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
