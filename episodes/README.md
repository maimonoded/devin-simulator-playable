# Episodes

One episode per filled placeholder. A placeholder takes `cfg.ticketsPerEpisode` tickets (5), and
tickets arrive from four places — the shoe's ticket cards, mystery boxes, the Plot Twist deck's
backstage pass, and the store — so which slot a ticket lands in is never something the player
aims at. Episodes are handed out in **story order** regardless: the first placeholder filled
earns `001`, the second `002`, and so on. A serialised drama watched out of order spoils itself,
so the id an episode carries is the story's, never the slot's. Each episode is two files that
share the id:

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

The payload is plain JSON wrapped in one `Episodes.add(...)` call. Everything but the board is
classic `<script>` tags sharing globals, and `fetch()` of a local file is off-limits there — so
the content is delivered as a script rather than as a `.json` nothing could load. The object
itself is JSON-valid, so these convert to real `.json` files the day the app grows something that
can read them.

## Adding an episode

1. Create `episodes/019.js` following the schema above.
2. Add `<script src="episodes/019.js"></script>` to [../index.html](../index.html), with the
   other episode scripts.
3. Drop `episodes/019.mp4` alongside it when the video exists.

Episodes are handed out in order as placeholders fill, so the count that matters is how many
episode files exist, not which placeholder finished. If `cfg.episodesInSeries` is raised above the
number of files, later completions cycle back through the existing ones rather than failing.

## A full row stops the game

The board shows `cfg.episodeRowSize` placeholders at a time — the **row** — and the row only
moves on once every episode on it is both **full and watched** (`Tickets.page()`, `js/tickets.js`).
Fill them all and there is nothing left to pull for, so **Pull** stops being Pull: it reads
*🎬 Watch to continue* and opens the prediction for the earliest unwatched episode rather than
greying out. A disabled button with no explanation reads as a soft-lock — and this is the one
stop the player cannot buy past: an empty shoe is a deck away, a full row is not.

**Watchedness is read, not recorded.** An episode counts as watched once it has left
`state.epQueue` *and* no sealed bet is still outstanding against it (`state.pendingReveal`). Both
were already persisted, so the row rule needs no new saved field — and a sealed bet has to count
as **not** yet watched, or walking out mid-episode would advance the row and step around the wall.

Tickets that arrive with the row full are **banked** in `state.pendingTickets` and land the moment
it advances. They are neither lost nor spilled into the next row's episodes: the row is a wall the
player has to watch their way through, and a ticket bought with real money must not quietly jump
it — nor be thrown away.

## Watch now, or binge later

Filling a placeholder unlocks an episode and pops **Watch now / Binge later**
(`openEpisodeUnlock`, `js/ui/prediction.js`). Declining costs nothing: the id stays in
`state.epQueue`, and the board carries a 🎬 button badged with how many are waiting, which drops
straight into the prediction for the earliest unwatched one. That button is the only route back
to a banked episode in the mobile layout, where the side panel's **Predict & watch** is not on
screen.

Two guards on that popup, both in `announceTickets` (`js/ui/main.js`), which is the one place all
three ticket sources — the card, the box and the store — come together to announce themselves:

- **Never during an auto mode.** A modal would stall the loop, which is the one thing the two
  auto modes are built not to do.
- **Never over the finale.** `seriesComplete()` owns the screen when a series ends; the episode
  is still queued and still reachable from the 🎬 button.

The result screen offers **Next episode →** with a count while the queue is not empty, so a
binge does not mean closing back to the board between every one.

## The library

The 🎞 button on the board opens every episode unlocked so far (`js/ui/library.js`). It appears
once there is something in it.

**The list is derived, not stored.** `Tickets.unlockedEpisodeIds()` is the first N episodes of the
story, where N is how many placeholders have been filled (`unlockedCount()` — plus every episode
of a series already behind you, since a series cannot be left until all of it is full).

**Episodes come off the FRONT of the story, not from the placeholder that paid for them.** A
ticket fills the lowest unfilled slot on the row and the episode it earns is the next one in the
drama, not that slot's. So the unlocked set is always a prefix of the library — which is what
makes the ordering rule below meaningful.

**A first viewing always starts at the earliest unwatched episode.** Tapping episode 5 in the
library when 4 is unwatched plays 4, with a toast saying so, and the row that will actually play
is tagged `NEXT`. `Tickets.firstUnwatchedId()` is the single answer the library, the 🎬 button and
a full row's **Watch to continue** all use, so the entry points cannot disagree. **Rewatching is
unrestricted** — the constraint is only about seeing something for the first time.

`state.epQueue` is the only thing persisted here, and it holds what is still **unwatched**. It
shrinks as episodes are watched, so it can never be the library: a run with four unlocked and
three watched would show one. That is exactly the bug a stored `epUnlocked` list was added to
fix — and deriving instead fixes it without the list, without a migration, and without a second
counter that can drift from the placeholders it counts.

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

Clicking **Predict & watch** (or 🎬, or **Watch now**, or **Pull** once the row is full) opens the
prediction modal, and the flow is:

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

Clues banked since the last prediction (`state.cycleClues`) are spent here, and the modal says
what they bought: the modelled accuracy they lift, or the floor it sits at when there are none.
Otherwise the only feedback a clue ever gives is a number climbing in the HUD.

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
- the row it belongs to stays put, because a sealed episode is not a watched one

A missing or broken video resolves as *completed*: there is nothing to walk out of, and
withholding the result then would punish the player for a file that never loaded.

### How the correct answer is used

- **Manual play** — you win only if your pick matches `correct`. Payout is `wager × odds`.
- **Inside an auto loop** — the outcome is modelled instead, from
  `Economy.accuracyFor(state.cycleClues)`: a 55% floor, plus 4 points per clue banked this cycle,
  capped at 70%. Neither auto mode opens a prediction on its own, so this is what a batch economy
  run measures — and it measures it without depending on which option a script happened to click.

The result screen names the true answer when you get it wrong.

## The video player

Markup and behaviour both live in [../js/ui/player.js](../js/ui/player.js): callers render
`playerMarkup(id)` into a modal, then await `playVideo(id)`.

| Behavior | Detail |
|---|---|
| **Autoplay** | Starts on its own, with sound. If the browser blocks autoplay-with-audio it retries muted and shows a "tap for sound" badge. |
| **No seeking** | The player has no `controls`, so there's no seek UI. Forward seeks are additionally snapped back to the furthest point actually watched; rewinding is allowed. The right-click menu is suppressed. |
| **Pause / resume** | Click the video. The frame dims and a ▶ glyph appears while paused. |
| **Progress** | A bar along the bottom plus an `m:ss / m:ss` readout. |
| **2× speed** | Press and hold the video (after `cfg.longPressMs`, default 350) for a temporary 2×, or use the **2× speed** button below it, which latches until clicked again. A gold `2×` chip shows while boosted. |
| **No exit** | Once playback starts there's no way out but to watch — the wager is already settled. |
| **Auto-play session** | Skips playback entirely: it reads the length from metadata, logs `Auto-play watched <title> · m:ss of footage (playback skipped)`, and moves on. Auto-pull does *not* skip — it is simulating a real viewing session. |
| **Missing video** | An episode with no `.mp4` (or a load error) falls back to the 🎬 placeholder for `cfg.fallbackSceneMs` (default 1700) and still reaches the result screen. |

Videos are portrait 9:16, so the modal sizes the player by height (`min(68vh, 620px)`) rather
than the usual fixed modal width.

`*.mp4` is in [../.gitignore](../.gitignore) — the footage is large and stays out of git.
