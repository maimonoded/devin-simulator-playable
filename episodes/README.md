# Episodes

One episode per **page of the album**: collect the `cfg.collectiblesPerEpisode` cards its page
names and that episode unlocks. Which cards a page wants is authored data
([assets/cards/README.md](../assets/cards/README.md)), so which episode a set of five buys is a
content decision, not a rule in the code. Each episode is two files that share the id:

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
  "difficulty": 4,                   // optional, 1–10 (default 1)
  "clues": [                         // 8+ — what unlocks this episode, and the evidence for it
    { "id": "c1", "text": "A city-centre lock-up in his name is still paid up, in cash." },
    { "id": "c2", "text": "He turns down casual work that would need identification." }
    // …six more
  ]
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
| `clues[].id` | Unique within this episode. `state.clues` stores these ids, so **do not renumber them** in a shipped episode — a player's evidence is a list of them. |
| `clues[].text` | One short, concrete, in-world observation. It is printed verbatim on the wager screen under "Review the evidence", so write it to be *read*, not counted. |
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

## Writing the clues

`cfg.cluesPerEpisode` of them unlocks the episode — four of the eight each file authors. That
slack is the point (GDD §6.1): two players arrive at the same prediction holding **different**
evidence, which is why the clues are the wager screen's content and not a number in the HUD.

So write eight that could each stand alone:

- **Concrete and observed.** "There is a dictaphone in his coat, and the tapes are labelled by
  surname" — not "he seems to be investigating something".
- **Partial.** Each one narrows the answer without settling it. Any four together should make the
  correct answer feel earned; no single one should give it away.
- **True.** A clue that misleads is not a clue, it is a lie, and the player is betting money on
  it. Ambiguity is fine; falsehood is not.
- **Short.** One sentence. Eight of them are shown at once.

`Clues.validate()` refuses an episode with fewer clues than the requirement, a duplicate id or a
clue with no text, and prints the lot in the tuning drawer — an episode that can never unlock is
invisible in play, because it looks exactly like a long run of bad luck.

A **set** is `cfg.episodesPerBoard` consecutive episodes: set 1 is 001–005, set 2 is 006–010,
and so on straight down `Episodes.ids()`. So adding files extends the run by a set every five,
and running out of them is what ends it — `Collection.hasNextBoard()` is false, and the last set
completed is the finale. Only board 1's cards are authored; later sets reuse its requirements
over their own episodes until someone authors them.

**`013.js`–`018.js` are written but not loaded.** They have no `<script>` tag in `index.html`, so
the run is twelve episodes today. Adding the six tags extends it by a set and a bit; they carry
their clues already.

## Watch now, or binge later

Filling a page unlocks its episode and pops **Watch now / Binge later**
(`openEpisodeUnlock`, `js/ui/prediction.js`). Declining costs nothing: the id stays in
`state.epQueue`, and the 🎬 button in the play row is badged with how many are waiting and drops
straight into the prediction for the earliest. That button is the only route back to a banked
episode in the mobile layout, where the side panel's **Predict & watch** is not on screen.

The popup arrives as an `{unlock}` event in the roll's event list, which means two things:

- **Never during an auto mode.** `showUnlocks()` logs and toasts, then returns without a modal
  when `autoMode` is set — a modal would stall the loop, which is the one thing the two auto
  modes are built not to do.
- **It resolves on the DECISION, not on the episode.** Choosing "watch now" settles the promise
  the roll loop is waiting on and *then* opens the prediction, so the loop is never held open for
  the length of a video.

The result screen offers **Next episode →** with a count while the queue is not empty, so a
binge does not mean closing back to the board between every one.

## The library

The 🎬 button in the play row opens the library once nothing is waiting to be watched
(`js/ui/library.js`); while something is, it drops into that instead.

**The list is derived, not stored.** `Collection.unlockedEpisodeIds()` walks every album, oldest
set first, and returns the episodes whose page is complete. Albums are kept per set forever, so a
set finished twenty sets ago still reports its episodes — and a page can never un-complete, which
is what makes deriving safe.

**Pages can be completed out of order**, because which cards fall is luck — and that is exactly
why unlocking and watching are two different gates. See below.

**Episodes are watched in story order, full stop.** Filling page 2 before page 1 unlocks episode
2 — it is in the library and the album shows it collected — but it cannot be *watched* until
episode 1 has been collected and watched. Episode 2's prediction question gives away episode 1,
so a drama watched out of order spoils itself.

`Collection.firstUnwatchedId()` is the single answer: the next episode of the story, and only
once its page is complete. It returns **null** when the story is ahead of the collection, and
`Collection.blockedBy()` names the episode holding things up so every surface can say so — the
library tags the blocked row `🔒`, the album's page says which episode comes first, the case board
in the middle of the play area shows `🔒 EP 2`, and the side panel's hint names it outright.

`openPrediction()` enforces it in **one place**: whatever id a caller passes, what plays is
`firstUnwatchedId()`, and nothing plays when that is null. So the library, the 🎬 button, the
album's Watch button and the result screen's "next episode" cannot disagree about it.

**Rewatching is unrestricted** — the constraint is only about seeing something for the first
time.

**A set is finished when its episodes have been WATCHED**, not when its last card lands
(`Collection.boardFinished()`). Collecting is the means; the episodes are the point. So the
celebration and the turn to the next set are owed to whichever episode turns out to be the last
one seen, and they fire from the end of the prediction flow rather than from a box.

`state.epQueue` is the only thing persisted here, and it holds what is still **unwatched**. It
shrinks as episodes are watched, so it can never be the library: a run with four unlocked and
three watched would show one. That is exactly the bug a stored `epUnlocked` list was added to
fix — and deriving instead fixes it without the list, without a migration, and without a second
counter that can drift from the albums it counts.

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
