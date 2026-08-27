# Every card face in Harbour Heights

> **See them, don't read about them:** run `python3 serve.py` and open
> **[/docs/card-specimens.html](card-specimens.html)**.
>
> That page is a **living specimen sheet** — it renders through the game's own `cardFace()` and
> `dropFace()` under the game's own stylesheets, so it shows exactly what a player sees and it
> cannot go stale. A folder of exported PNGs would be wrong the first time anyone touched a
> border colour. This is wrong never. Everything below describes what is on that page.

---

## The one rule: two independent axes

| axis | decides | values |
|---|---|---|
| **family** | the **frame and the ground** | `collection` · `clue` · `status` |
| **rarity** | the **badge** and the **halo** | Common · Rare · Epic · Legendary |

Neither ever decides the other. That is what lets an Epic collection card and a status item come
out of the same box seconds apart and be unmistakable — and it is why a Common and a Legendary
are recognisably the *same kind of object*, differing in how loudly they announce themselves.

**Rarity does not touch the frame.** It used to, and that was a bug in disguise: a Common wore a
slate border and an Epic a purple one, which put four different-looking frames inside one family
and made an ordinary card read as *broken* rather than as *ordinary*.

Both halves have to move together whenever a face changes — the DOM path
([`js/ui/cardface.js`](../js/ui/cardface.js) + `.fam-*` / `.rar-*` in
[`css/collection.css`](../css/collection.css)) and the canvas path
([`js/ui/box3d.js`](../js/ui/box3d.js), which paints the card that flies out of a box in the 3D
scene). A card that looks like two different things in the two places it appears is not a
collection.

---

## Family 1 · Collection — 150 a Season

**Gilt border, fine inner rule, warm plum-brown ground.** Not the blue-black the rest of the app
uses. That warmth does as much work as the gold: a clue is *cool cream paper*, a collection card
is a *warm gilded object*, and that separates them in a row of thumbnails where a border is two
pixels wide.

| rarity | in a Season | drop weight | converts for | each copy after | duplicate coins | badge |
|---|---|---|---|---|---|---|
| Common | 90 | 60% | 10 | 2 | ×1 | `#8fa3c9` slate |
| Rare | 38 | 25% | 30 | 6 | ×3 | `#4f9dff` blue |
| Epic | 18 | 12% | 100 | 20 | ×8 | `#b06bff` violet |
| Legendary | 4 | 3% | 400 | 80 | ×25 | `#ffcb5c` gold |

Legendary also gets a slow shimmer across the sheen, because the rarest thing on screen should be
the one that moves.

### The three states, and the gap between them is the reward loop

| state | face | why |
|---|---|---|
| **Locked** | silhouetted, dashed border, padlock — **but still named and badged** | you can see *what* is missing and how hard it will be. A collection you cannot see the shape of is not a collection |
| **Held** | full art, corner chip reads `1/3`, `2/3` | the chip is the progress bar. No second UI needed |
| **Converted ★** | the gilt **lights up**, chip becomes a star | the third copy turns the card into its Collectible (GDD §4.3). It stops being progress and becomes a thing you own, so the frame is where that is said |
| **Duplicate** | gold band across the middle: `DUPLICATE +120` | only on a copy that did *not* convert. The converting copy gets a **teal** band instead, saying what it earned — stamping DUPLICATE across the best moment the collection has would be exactly backwards |

### Most cards have no painted art, on purpose

**119 of 150.** All 18 Epics and all 4 Legendaries are painted; so are 9 lower-rarity cards that
reuse the evidence images. The rest fall back to a **procedural face** — a two-stop gradient
hashed off the card id, so the same card is the same colours every time and different from its
neighbours.

§4.2 calls an Epic *"the pull that makes a pack memorable"*. Painted art earns its place there,
not across ninety Commons that exist to be converted.

---

## Family 2 · Clue — 8 per episode

**The one face built to be READ.** Everything else on a card is looked at; a clue is a sentence
you have to reason from before betting, so it gets four signals at once rather than one:

1. **Cream paper ground** (`#f2e8d0`) — no art at all
2. **Dashed warm border**, and the card **sits crooked** (−1.1°)
3. **Typewriter face** (Courier), dark ink on paper
4. **A strip of tape** across the top edge

Its badge slot carries a *state*, not a rarity: teal **EVIDENCE** when it is new, **KNOWN** when
you already held it (and then it pays coins instead).

**Clues have no rarity.** A clue is `{id, text}` in `episodes/NNN.js` — there is no tier to show.

---

## Family 3 · Status — the Showcase

Gold too, now that collection cards are — so it is told apart by **shape**, not colour:

- a **heavier border** (4px against 2px)
- a **gold-brown ground** rather than plum
- **corner ticks** on the inner frame, which nothing else in the game wears

The ticks are the real signal. Brackets on a frame read as *something hung on a wall*, which is
exactly what a Showcase piece is. Its badge carries a point value — **STATUS +10** — because a
status item is granted whole rather than converted.

**Status items have no rarity either.** They carry `points`, not a tier.

---

## The payouts that are not cards

Coins, energy, and the unknown-card slot share the card silhouette so a box's contents read as
**one row of things** rather than as cards plus a paragraph. Plain navy ground, a big glyph, no
frame.

The **unknown card** — a dashed slot with a `?` — is a **defensive fallback, not a screen you
should reach in normal play**. Every live call site passes a card straight out of the catalogue or
out of the save's own record, so it renders only if something hands `cardFace()` a null. It exists
so that a content bug draws as a labelled empty slot instead of throwing mid-roll and leaving
`state.animating` stuck with Roll dead.

---

## Nothing is lost when the content changes

A save is a bag of id strings — `{"folded-blanket": 3}` — and it outlives any particular version
of the catalogue. Rename a card, re-cut a set, ship a Season that reshuffles an older one, and a
held id stops resolving.

Deleting it is not an option: it would silently destroy pulls the player earned. But **keeping it
without knowing what it was is nearly as bad**, because everything a card is worth — its Status on
conversion, its trickle, its duplicate coins — is read off its rarity. An unresolvable card would
fall back to Common, and a converted Legendary would go from 400 points to 10 without a word.

So the save carries a record. `state.cardMeta` remembers each card's **rarity, name and set** at
the moment it was banked:

| | |
|---|---|
| **The catalogue always wins** while it can answer | this is a fallback, not a second source of truth, so "derive, don't store" still holds on every normal path |
| **Value is preserved** | a forgotten Legendary is still a Legendary: 400 on conversion, 80 a copy after |
| **Identity is preserved** | it keeps its name and its rarity badge, and is flagged `lost` so a caller can say so rather than let it pass as ordinary |
| **It does not inflate the Season** | `Cards.owned()` counts the catalogue, so a kept card never pads your `x/150` |
| **It is visible** | the collection gets a final **"Kept · from other content"** page. A card that is kept but appears nowhere is indistinguishable from one that was thrown away |
| **Old saves are covered** | a save written before the record existed has it re-derived on load, so a collection is protected before the next card is banked, not after |
| **It degrades** | an unreadable record falls back to the commonest rarity rather than being dropped — a card remembered by name is worth more than one not remembered at all |

The asymmetry with the rest of the save is deliberate. **Status items and completed sets *are*
filtered** against the current build: a card is a *held object* whose value is that you have it,
so keeping it costs nothing. An item and a set are *scores*, and a score nothing can account for
is corruption.

---

## Where each is defined

| | |
|---|---|
| the 150 cards, rarities, art paths | [`assets/cards/cards.js`](../assets/cards/cards.js) |
| ownership, conversion, sets, drawing | [`js/cards.js`](../js/cards.js) |
| clue text, per episode | [`episodes/NNN.js`](../episodes/README.md) |
| Showcase items | [`assets/status/status.js`](../assets/status/README.md) |
| the DOM face | [`js/ui/cardface.js`](../js/ui/cardface.js) · [`css/collection.css`](../css/collection.css) |
| the in-scene face | [`js/ui/box3d.js`](../js/ui/box3d.js) |
