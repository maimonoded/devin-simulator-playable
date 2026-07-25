# Episodes

One episode per builder. Completing **builder N** unlocks episode **NNN** — builder 1 → `001`,
builder 12 → `012`. Each episode is two files that share the id:

```
episodes/
  001.js     the prediction (question, answers, correct answer)
  001.mp4    the video           ← not wired up yet; drop files in when ready
```

The id is the whole identity: `003` is builder 3's episode and its video path is always
`episodes/003.mp4`. Nothing inside the file repeats that.

## Prediction file schema

```js
Episodes.add({
  "id": "001",                       // must match the filename
  "title": "The Inheritance",        // shown as the episode name
  "question": "Does Sofia accept the inheritance?",
  "answers": [                       // 2+ options, in display order
    { "text": "Yes — and moves in", "odds": 1.6 },
    { "text": "No, she walks away",  "odds": 2.6 }
  ],
  "correct": 0                       // 0-based index into answers
});
```

| Field | Meaning |
|---|---|
| `id` | Three-digit string, matches the filename. Determines which builder unlocks it and where the video lives. |
| `title` | Episode name in the modal, toast and activity log. |
| `question` | The prediction prompt. |
| `answers[].text` | Option label. |
| `answers[].odds` | Payout multiplier if that option is picked **and** it's right — a wager of 500 at ×2.4 returns 1,200. Longer odds should go on less likely answers. |
| `correct` | Index of the true answer. Decides win/loss in manual play. |

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

## How the correct answer is used

- **Manual play** — you win only if your pick matches `correct`. Payout is `wager × odds`.
- **Auto-play** — the outcome is modelled with `cfg.accuracy` (default 65%) instead, so batch
  runs measure the economy without depending on which option a script happens to click.

The result screen names the true answer when you get it wrong.
