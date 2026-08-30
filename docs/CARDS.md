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
| **rarity** | the **star badge** and the **halo** | ★ · ★★ · ★★★ · ★★★★ |

Neither ever decides the other. That is why a Common and a Legendary are recognisably the *same
kind of object*, differing only in how loudly they announce themselves — and why a card in the
album and the Collectible it becomes on its third copy can share an id and still be told apart
at a glance.

**The family is a FACE, not a kind of content.** One card can wear two of them: a card is `collection`
in the album, where it is a thing in a set with a rarity and a copy count, and `status` the
moment it converts, where it is a thing you own outright and what matters is what it was worth.
Getting this backwards produced a whole parallel system — ten "status items" that belonged to no
set and converted from nothing — and it is why the ranking below is written down.

**Rarity does not touch the frame.** It used to, and that was a bug in disguise: a Common wore a
slate border and an Epic a purple one, which put four different-looking frames inside one family
and made an ordinary card read as *broken* rather than as *ordinary*.

**The badge counts stars rather than naming a rarity.** *Is an Epic better than a Rare?* is a
question you have to have learnt the answer to; ★★★ beside ★★ is not a question at all. `rank` in
`CARD_RARITIES` **is** the star count — which is why it runs 1–4 with no gaps — and `name` /
`short` survive only for the places that speak in prose: the tuning drawer, this document, a
`title` attribute for a mouse or a screen reader.

**The three families are ranked by how much the player wants them.** They are not three
decorations on one idea, and the ranking was inverted until recently: the clue — the card the
whole game is played for — was the plainest object in the box, sitting beside status plaques that
glowed. What follows is the corrected order.

Both halves have to move together whenever a face changes — the DOM path
([`js/ui/cardface.js`](../js/ui/cardface.js) + `.fam-*` / `.rar-*` in
[`css/collection.css`](../css/collection.css)) and the canvas path
([`js/ui/box3d.js`](../js/ui/box3d.js), which paints the card that flies out of a box in the 3D
scene). A card that looks like two different things in the two places it appears is not a
collection.

---

## Family 1 · Collection — 48 a Season

**Gilt border, fine inner rule, warm plum-brown ground.** Not the blue-black the rest of the app
uses. That warmth does as much work as the gold: a clue is a *cold grey photograph*, a collection
card is a *warm gilded object*, and that separates them in a row of thumbnails where a border is
two pixels wide.

| rarity | in a Season | drop weight | converts for | each copy after | duplicate coins | badge |
|---|---|---|---|---|---|---|
| ★ Common | 29 | 60% | 10 | 2 | ×1 | `#8fa3c9` slate |
| ★★ Rare | 12 | 25% | 30 | 6 | ×3 | `#4f9dff` blue |
| ★★★ Epic | 6 | 12% | 100 | 20 | ×8 | `#b06bff` violet |
| ★★★★ Legendary | 1 | 3% | 400 | 80 | ×25 | `#ffcb5c` gold |

**Four sets of twelve, and both kinds of card in every one** (§4.1): seven narrative cards — the
blanket, the registrar's face — and five aspirational objects — the watch, the necklace, the
villa. Same rarities, same drops, same conversion; the only difference is what they are a picture
of. Finishing a set means owning both the memory and the trophy.

The catalogue was 150 in fifteen sets until recently, and the count is what broke the loop rather
than a matter of taste: against 150 cards a given Common came up **0.67 times** in a demo run, so
the third copy — which is the whole of §4.3 — essentially never happened.

Legendary also gets a slow shimmer across the sheen, because the rarest thing on screen should be
the one that moves.

### The three states, and the gap between them is the reward loop

| state | face | why |
|---|---|---|
| **Locked** | silhouetted, dashed border, padlock — **but still named and badged** | you can see *what* is missing and how hard it will be. A collection you cannot see the shape of is not a collection |
| **Held** | full art, corner chip reads `1/3`, `2/3` | the chip is the progress bar. No second UI needed |
| **Converted ★** | the gilt **lights up**, chip becomes a star | the third copy turns the card into its Collectible (GDD §4.3). It stops being progress and becomes a thing you own, so the frame is where that is said |
| **Duplicate** | gold band across the middle: `DUPLICATE +120` | only on a copy that did *not* convert. The converting copy gets a **teal** band instead, saying what it earned — stamping DUPLICATE across the best moment the collection has would be exactly backwards |

### Every card is painted, and `art` is optional anyway

**All 48 are painted**, the twenty aspirational objects included — drawn at card proportions
rather than inherited from the old shelf's 320 × 320 squares.

The **procedural face** is still there and still matters: a two-stop gradient hashed off the card
id, so the same card is the same colours every time and different from its neighbours. It is what
a Season looks like between being authored and being drawn, which is the order those two jobs
happen in — the game is never broken by a card nobody has painted yet, only plainer.

§4.2 calls an Epic *"the pull that makes a pack memorable"*, and that is where painted art earns
its place first when the two do come apart.

---

## Family 2 · Clue — 8 per episode

**A case photograph, and the card the player is actually playing for.** Four clues buy the next
episode, and the episode is the point of the game — so this is the face that has to look like
something worth having.

1. **A black-and-white case photograph**, full bleed, grain over the top
2. **The sentence on a cream slip** laid over it — typewriter, dark ink on paper
3. The card **sits crooked** (−1.1°) and the slip is tilted *the other way* (+0.9°), so the two
   angles read as two pieces of paper rather than one crooked one
4. **A strip of tape** across the top edge, holding it to the board

The slip is not decoration. A clue is the only face in the game carrying a line of prose, and
prose laid straight over a photograph is the one thing that reliably becomes unreadable.

Its badge slot carries a *state*, not a rarity: teal **EVIDENCE** when it is new, **KNOWN** when
you already held it (and then it pays coins instead).

### Twelve photographs, shared, chosen by hash

144 authored clues would need 144 photographs — more than they would ever be looked at. Eight
identical photographs down one episode's evidence board would read as a bug. So `Cards.clueArt()`
hashes the episode id plus the clue id into a library of **twelve** deliberately generic case
photos in [`assets/cards/clues/`](../assets/cards/clues), listed as `CLUE_ART` in the catalogue.

Same trick as the procedural card faces, and for the same reason. Two consequences worth knowing:
nothing is stored, so a clue keeps its photograph across reloads and across saves; and adding a
thirteenth photograph reshuffles which clue shows what, which is exactly why none of them
illustrates a specific clue.

**Clues have no rarity.** A clue is `{id, text}` in `episodes/NNN.js` — there is no tier to show.

---

## Family 3 · Status — a Collectible, and a trophy

**A plaque, and the number is the hero.** Two things wear it, and only two: a **Collectible** —
what a card becomes on its third copy (§4.3) — and a **"Called it" trophy**, one per episode.
Those are the pieces that go on the Showcase rather than into the album, and nobody reads what a
Showcase piece *is*; they read what it was *worth*. So `+50` is set large across the middle in
gold, and the picture is pushed back behind it to a stamp at 34% opacity.

That also settles the confusion that mattered: a face built around a number cannot be mistaken
for a photograph (a clue) or for art in a set (a collection card), whichever way the light falls.

It keeps two things from the old treatment:

- a **heavier border** (4px against 2px), gold, over a **gold-brown ground**
- **corner ticks** on the inner frame, which nothing else in the game wears — brackets read as
  *something hung on a wall*, which is exactly what a Showcase piece is

And it loses one: the **halo is gone**. It was the loudest thing on screen, and it was shouting
for the card the player cares least about looking at.

**The plaque wears no star badge**, and a Collectible does have a rarity — `collectibleOf()`
carries it, and it is what set the points. It is simply not what this face is about: by the time
a card converts, the player has seen its stars three times in the album. What is new is the
number.

**This face is a state, not a shelf.** The plaque used to belong to ten hand-authored objects
that shared an id with no card and could be bought outright, which made it look like a second
family of content. It is the far side of a conversion now: the same card, gilt in the album while
it is still progress, plaqued the moment it becomes something owned. The only piece here that is
not a card is the trophy — and that is exactly why it is worth having, since it is the one
Showcase piece a box cannot contain (§7.4).

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
| **It does not inflate the Season** | `Cards.owned()` counts the catalogue, so a kept card never pads your `x/48` |
| **It is visible** | the collection gets a final **"Kept · from other content"** page. A card that is kept but appears nowhere is indistinguishable from one that was thrown away |
| **Old saves are covered** | a save written before the record existed has it re-derived on load, so a collection is protected before the next card is banked, not after |
| **It degrades** | an unreadable record falls back to the commonest rarity rather than being dropped — a card remembered by name is worth more than one not remembered at all |

The asymmetry with the rest of the save is deliberate. **Completed sets and trophies *are*
filtered** against the current build — a `setsDone` key no set answers to, a trophy for an
episode that no longer ships. A card is a *held object* whose value is that you have it, so
keeping it costs nothing. A finished set and a called episode are *scores*, and a score nothing
can account for is corruption.

The old shelf's slot is **dropped on load** rather than filtered, because there is nothing left to
filter it against: `Status` has no items, and a Collectible is derived from a card. Nor is it
migrated — the shelf's ids belonged to no card, so there is no card to award. The aspirational
objects were re-authored into the catalogue as new cards with new ids, which is the honest
outcome: a mug that was bought for coins was never a Collectible, and the ledger should not
pretend it was one.

---

## Where each is defined

| | |
|---|---|
| the 48 cards, rarities, art paths | [`assets/cards/cards.js`](../assets/cards/cards.js) |
| ownership, conversion, sets, drawing | [`js/cards.js`](../js/cards.js) |
| a Collectible, and which are held | `Cards.collectibleOf()` / `collectibleIds()` — derived, nothing stored |
| a set's display piece | `Cards.setCentrepiece()` — the set's rarest card's Collectible |
| clue text, per episode | [`episodes/NNN.js`](../episodes/README.md) |
| the trophies | `Status.trophyOf()` — derived from the episode list ([`js/status.js`](../js/status.js)) |
| the status TRACK the plaques feed | [`assets/status/status.js`](../assets/status/README.md) — bands and milestones, no items |
| the DOM face | [`js/ui/cardface.js`](../js/ui/cardface.js) · [`css/collection.css`](../css/collection.css) |
| the in-scene face | [`js/ui/box3d.js`](../js/ui/box3d.js) |
