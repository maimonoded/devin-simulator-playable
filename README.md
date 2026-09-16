# Harbour Heights — the collectible version

*(branch `collectible_version`. `main` runs a different loop — you buy builders with coins and
each finished builder unlocks an episode. The two are alternatives being compared; this branch
is not to be merged until one is chosen.)*

A Monopoly-GO-style board used to model a short-drama app's economy. You roll around a 40-tile
ring, and everything you get out of it is a **card**. Some cards are evidence that unlocks the
next episode, some are the collection, and a few are the ones that carry your **status** — which
is what rebuilds the house standing in the middle of the board.

```bash
./start.sh                # → http://localhost:8125/index.html
./stop.sh                 # stop it again
```

All three scripts (`start`, `stop`, `restart`) take a port: `./start.sh 8126`.

---

## What the game is, in four parts

### 1. Dice spend energy, not coins

**Energy is the only thing a roll costs.** You start with 100 against a cap of 40, and a session
is over when you can't pay for the next roll — that is the whole session shape the economy is
being tuned against. **Next session** advances the clock by the greater of a full refill
(`regenMin` minutes per energy point) and one session slot, refills you, and pays a login reward
on each day rollover.

Rolls have a **stake**, stepped through with the ×1 button: 1, 2, 3, 5, 10. The stake is the
energy the roll costs *and* the multiplier on what it pays, so playing harder means fewer rolls
per session and a bigger swing on each of them. Coins never buy a roll — they buy boxes.

Energy bought in the store is deliberately allowed to sit **above** the cap; nothing in the code
may clamp it downward.

### 2. Every landing draws a card

There are no bespoke tile behaviours left for the twenty-plus ordinary tiles. **A tile points at
a weighted table and a landing draws one row from it** — money, a collection card, a clue,
energy, a move, or flavour that pays nothing on purpose. Four corners are the exception: the
Premiere pays on pass and hands over a free box, Spa Day is energy and never a penalty, the Gala
pays out everything the twists took plus a guaranteed card, and the Scoop teleports you onto a
random character tile and triggers it.

Boxes are the only route to anything collectible, and they are not a dialog: the box arrives over
the middle of the board, you tap it, and the cards fly out and hang in the air. Three tiers —
Standard, Premium, Insider — bought with coins in the store or won on the board, and the same
code path opens both, so a box bought is exactly a box landed on.

### 3. Cards → status, and status is the point

A Season has **48 cards** — 29 Common, 12 Rare, 6 Epic, 1 Legendary — laid out in **4 sets of
twelve**. Twenty of those forty-eight are **status cards**: the watch, the necklace, the villa.

The rule that makes a duplicate worth pulling: **the third copy of a card converts it** into its
Collectible — the object that carries status and stands in your showcase. Copies past the third
trickle coins instead.

Status is a level, **1 to 30, and it resets every Season**. Four things raise it, and every one
of them is earned rather than bought:

- converting a card into its Collectible
- completing one of the four sets
- watching an episode
- calling a prediction right

Nothing in the store has a price in status points. Milestones every five levels pay a clue cache,
energy, or a box.

### 4. Clues → the next episode, and the arc turns over

Each episode authors **eight clues**; holding any **four** of them unlocks it. Two players can
therefore arrive at the same episode holding different evidence — and those same clues are what
you read before you bet, because unlocking an episode and betting on it use one object for both
jobs. A duplicate clue pays coins, and if you have been stuck for a few days the requirement
eases by one.

An unlocked episode is watched by **predicting what happens next**: you stake coins on an answer,
the video plays, and the result pays out. Episodes are watched in story order. When all five of
an arc are watched, **the arc turns over onto the next five** — that is the "unlock the next
series" step, and it is gated on clues and watching, never on coins.

Finishing a set of twelve pays its **display piece**, the set's rarest Collectible. A set is a
target and never a gate.

---

## The building in the middle of the board

The board's centre is a house that **builds itself**. There is no buy button, no coin cost and no
timer — the estate has **six tiers, one per status band**, and it upgrades the moment your status
level crosses into the next one. Your title and your house change in the same beat.

Each tier is an **open dollhouse** — no roof, near walls removed — because the camera looks down
at it and because the floors are eventually where collected things will stand. A promotion is
covered by a cloud that rolls in and out, so the swap happens where it is thickest and the new
building reads as weather rather than as an asset popping in.

A sign at the front of the plot carries your rank and the same progress bar as the HUD pill. Both
read one value, deliberately: two surfaces each computing status for themselves is how they end
up disagreeing at the same instant.

---

## The loop, in one pass

```
roll  (costs energy × your stake)
  → land → DRAW one row from that tile's pool
      → money · a COLLECTION CARD · a CLUE · energy · a move · flavour
  → a clue        → filed against its episode; 4 of 8 unlocks it
  → a card        → banked; the 3rd copy CONVERTS it into a Collectible
  → a Collectible → status points → a level → a band → THE HOUSE GROWS
  → a box         → tap it; it opens on the board
  4 clues        → episode UNLOCKS → predict & watch → status
  5 watched      → the ARC turns over onto the next five episodes
  12 of a set    → its display piece
```

## Where to look

- **[CLAUDE.md](CLAUDE.md)** — the architecture: script load order, the event-list rule that keeps
  logic out of the DOM, the pool engine, the economy model, and every subsystem's own README.
- **[TODO.md](TODO.md)** — what is known to be unfinished.
- `node tests/run.js` — the zero-dependency test runner. Run it after touching any DOM-free layer.
