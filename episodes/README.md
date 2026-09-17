# Episodes

> **This folder is the VIDEOS now, and the `NNN.js` files are parked.** Episode titles, blurbs
> and prices moved into `content/seasons/*.js`, which is what the catalog reads; `js/episodes.js`
> and the per-episode files are off `index.html` entirely. They are kept because they hold the
> prediction data (question, answers, odds) that the removed prediction system used, and because
> each `question` is the best one-line summary of what happens in that episode — the library's
> poster art was briefed from them.
>
> **To add episode 019 you edit a season file, not this folder** — except for dropping in
> `019.mp4`. The prediction schema below documents the parked files; the live schema is in
> `content/seasons/001-1.js`.

Each episode is two files that share the id:

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

## How an episode is unlocked

An episode's price is declared in its season file as an ordered list of **steps**, and paying
all of them unlocks it. A step is `{ coins, items: {itemId: n} }`; either field may be left out,
and an empty list means free. The same shape prices a season and a series, so all three levels
sit on one ordered spine (`Catalog.spine()`) and exactly one of them is payable at a time —
`Unlock.current()`. See [js/catalog.js](../js/catalog.js) and [js/unlock.js](../js/unlock.js).

The authored curve teaches the mechanic before it gates on it: episodes 001–005 are one step of
coins only, 006–012 add an item, 013–018 run to three steps and two items. **Items are the real
constraint** — the coins arrive in roughly 1,620 rolls and the items in roughly 2,290, so the
deck's item-card weight is what paces the run. The note at the top of
[content/seasons/001-1.js](../content/seasons/001-1.js) has the arithmetic.

Unlocking is what makes an episode playable: the library plays it through
[js/ui/player.js](../js/ui/player.js), which is the same player this repo has always had.

**The videos are gitignored** (`*.mp4`), so a fresh clone has none and every episode takes the
player's placeholder path — a pulsing 🎬 held for `cfg.fallbackSceneMs`. That is the player
working, not the unlock failing.

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
