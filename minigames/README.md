# Bonus mini-games

A **bonus mini-game** is a full-frame game a tile opens instead of a popup. Each one is a
self-contained page in this folder, opened in an `<iframe>` over the board by
[`js/ui/minigame.js`](../js/ui/minigame.js) and talked to with `postMessage`.

Today the board has two: the four **train** tiles (indices 5/15/25/35) pay one of exactly two
bonuses, and each bonus has its own game.

| Key | Bonus | File |
|---|---|---|
| `train-small` | the small bonus (`cfg.trainSmall`, 65% of landings) | [steal-the-spotlight.html](steal-the-spotlight.html) |
| `train-large` | the large bonus (`cfg.trainLarge`, 35% of landings) | [gala-match3.html](gala-match3.html) |

## The one rule

**A mini-game never decides money.** By the time it opens, [`js/tiles/train-tile.js`](../js/tiles/train-tile.js)
has already drawn the outcome from the economy model *and already banked the coins* with
`gainCoins`. The amount is handed over purely so the game can present it. This is the same
contract the Collect popup has always had — the popup was never anything but theatre over an
already-paid reward — it is just visible now that the theatre got bigger.

The consequence worth internalising: **a game's internal randomness must not touch the payout.**
`steal-the-spotlight.html` still has `DEMO_CHECKS` and `DEMO_CONSOLATION`, but they are reachable
only in standalone mode. Whether the rival blocks you is set from `SPEC.outcome`, not from
`Math.random()`.

If a game is switched off (`cfg.bonusGames = 0`), missing from the `MINIGAMES` registry, or fails
to load, the host falls back to the plain Collect popup. **A broken game costs presentation, never
coins.**

## The protocol

Same-origin `postMessage` both ways. Both sides check `e.origin` and the sender.

```
        host (js/ui/minigame.js)                    game (this folder)
              │  create <iframe>, src = the game        │
              │ ──────────────────────────────────────► │
              │                                          │  page loads
              │ ◄──────── {type:"bonus:ready"} ───────── │  (holds on its loading screen)
              │                                          │
              │ ─── {type:"bonus:open", …spec} ────────► │  now it knows the payout
              │                                          │  … the player plays …
              │ ◄──────── {type:"bonus:done"} ────────── │  player hit Collect
              │  resolve the promise, remove the iframe  │
```

**`bonus:open` payload**

| Field | Meaning |
|---|---|
| `amount` | the coins the engine has already paid. Display it; never add it to a balance the host owns. |
| `outcome` | `"win"` or `"blocked"` — the *shape* of the round, also engine-owned. |
| `label` | what the tile calls this bonus (`"Train bonus"`). |
| `coins` | the player's balance **before** the win. The tile banks the coins before the game opens, so this is `state.coins - amount` — which means a game that counts its pill up by `amount` on Collect lands exactly on the real total instead of one prize too high. |
| `tiers` | *(prize-ladder games only)* the rungs, ascending. Rendered as the ladder — never show amounts of your own, or the game promises one number and pays another. |
| `winIndex` | *(prize-ladder games only)* which rung the engine already paid. The game must **make that rung win**; see "Rigged by design" below. |
| `loadMs` | how long the game's own opening animation should run (`cfg.bonusLoadMs`). |
| `idleMs` | how long before the game plays its own round. **`0` for a human — picking is the player's decision and is never made for them, however long they take.** Only auto-roll sends a value, because there is nobody at the keyboard; it gets the same random `cfg.collectMinSec`–`collectMaxSec` window. |
| `trayMs` | paces the Collect tray's auto-close, always the random `collectMinSec`–`collectMaxSec` window. Collecting is an acknowledgement, not a decision — the coins were banked before the game opened — so this one does time out, exactly as the Collect popup always has. |

**A game must resolve.** The host awaits its promise inside `roll()`, and `roll()`'s `finally` is
the only thing that clears `state.animating` — a game that never posts `bonus:done` would leave
the board soft-locked with Roll disabled. The host therefore holds `cfg.bonusMaxMs` (90s) as a
hard ceiling and closes the game itself if that elapses. That backstop is what makes an untimed
pick safe: a player who walks away mid-round costs themselves nothing, because the coins are
already theirs and the board frees itself.

## Rigged by design

A game whose outcome is engine-decided **cannot** also be a fair draw. `gala-match3.html` is the
clear case: the engine picks the winning rung before the page opens, so if the twelve envelopes
were a real shuffle, some other symbol could reach three first and the game would pay a number
nobody banked.

So the envelopes are resolved in the order they are **opened**, not in advance:

```
buildPlan(target) → e.g. [🎭, ⭐, 🎟️, 🎭, ⭐, ⭐]
                          └── target ⭐ appears exactly 3x, its third LAST
                          └── every other symbol capped at 2, so none can complete
```

The plan is 4–7 envelopes long, drawn at random, so the round doesn't run to a fixed length. The
player chooses **which** envelope and **how long** it takes; the prize was already theirs before
the first one opened. That is the same bargain the Collect popup has always offered — it is just
visible now that the theatre got bigger.

The economy consequence of the ladder is written up in [TODO.md](../TODO.md): an even pick of
1/3, 2/3 and the top rung pays **2/3 of the top**, so the large bonus yields 210 where the model
says 315. `Economy.trainEV()` is the model's number and `Economy.trainRealEV()` is what the board
actually pays — compare them rather than assuming they agree.

## Standalone mode

Every game must keep working when opened on its own —
`http://localhost:8125/minigames/steal-the-spotlight.html` — because that is how they are authored
and tuned. With no `bonus:open` in the first few seconds the game runs in **demo mode**: its own
random payouts, and it loops forever instead of reporting back. `document.body.classList` gets
`hosted` in the embedded case, which is how demo-only affordances are hidden (Steal the Spotlight
uses it to drop the *Switch Opponent* button — hosted, that button would be a free re-draw of a
payout the engine has already committed to).

Note that a server is required either way: these are ES modules, so `file://` will not load them.
`python3 serve.py` and open the URL above.

## Why an iframe

The app is classic `<script>` tags sharing one global namespace and one CSS cascade
(see [CLAUDE.md](../CLAUDE.md)). A game like this one declares its own `$`, `fmt`, `scene`,
`camera`, `renderer`, `coins`, a `#collectBtn`, a `.float` class and a `*` reset — inlining any of
that is either a `SyntaxError` that kills the page (two top-level `const $`) or a silent repaint of
the whole app. A separate realm also keeps the file standalone-runnable, which is the point above.

The cost is one extra WebGL context while a game is open. That is fine and it is not what
CLAUDE.md's "one renderer" rule is about: that rule is about the *board and builders sharing one
persistent renderer*, not about a transient page. The context goes away with the iframe.

## Adding a game

1. Drop the page in this folder. Write it standalone-first; add the `bonus:ready` / `bonus:open` /
   `bonus:done` handshake and a `hosted` body class.
2. Import three from the importmap (`{"imports":{"three":"../vendor/three.module.js"}}`) rather
   than a CDN — the project vendors it and must run with no network.
3. Register it in `MINIGAMES` in [`js/ui/minigame.js`](../js/ui/minigame.js).
4. Return `this.minigame(key, amount, {outcome, label})` from the tile, *after* `gainCoins` has
   banked the amount.

Nothing else needs to change: the event flows through `playEvents()` like any other blocking event.

## Porting a three.js scene written against an older revision

The vendored build is **r169**. Two defaults changed after r128 and both are visible:

- **Colour management.** r155+ converts to sRGB on output. `THREE.ColorManagement.enabled = false`
  plus `renderer.outputColorSpace = THREE.LinearSRGBColorSpace` reproduces the old raw pipeline, so
  the art does not have to be re-graded.
- **Light units.** `useLegacyLights` is gone; intensities are physical. Multiplying ambient,
  hemisphere and directional intensities by π restores the old brightness — Steal the Spotlight
  keeps this as a single `LIGHT_SCALE` constant so it is one number to re-tune, not thirty.

Everything else in that file (BufferGeometry primitives, `Fog`, `MeshLambertMaterial`, shadow maps,
`Raycaster.setFromCamera`, `Vector3.project`, `Clock`) carried over unchanged.
