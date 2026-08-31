# Status — the track, and nothing else

```
assets/status/
  status.js           STATUS_ZONES + STATUS_RANKS + STATUS_MILESTONES
  called-it.webp      the trophy a correct prediction pays (GDD §7.4)
  items/*.webp        the deleted shelf's art. Read by nothing — see "What left this folder"
```

Read by [`js/status.js`](../../js/status.js); rendered by
[`js/ui/profile.js`](../../js/ui/profile.js), with the band and level beside the avatar in the
HUD, and drawn as a building at the board's centre by
[`js/ui/estate3d.js`](../estate/README.md).

**The Collectibles are not here.** They are cards — [`assets/cards/`](../cards/README.md) — and
`Cards.collectibleOf()` is what turns one into the object that stands on the Showcase. This
folder holds the *track* those objects climb, and one piece of art for the one thing a card
cannot be.

## What left this folder, and why it matters

`STATUS_ITEMS` used to live here: ten hand-authored objects — a mug, a signed poster, a framed
ticket — each with a `price`, an `earn` threshold and a `box` weight. They were a fifth inflow on
a track the doc says has four, and none of their three routes in is one §8.1 allows.

The question that ended them is the one to keep in mind before anything like them is proposed
again: **a player, looking at their shelf, asked which cards they had collected to earn the cup.**
There was no answer. The cup shared an id with nothing, was in no set, and completing a set had
not brought it any closer. §4.3 says a Collectible is what three copies of a card *become*, and
that sentence is the entire link between collecting and standing — so an object that arrives any
other way is not a reward, it is a second currency wearing the same frame.

The aspirational objects are ordinary cards now, twenty of the forty-eight (§4.1), interleaved
with the narrative cards through all four sets. They drop from boxes, they duplicate, they
convert on the third copy, and completing a set means owning both the memory and the trophy. The
art in `items/` is what the shelf used: square, cropped for a grid, and read by nothing since.
The new twenty were painted from scratch at card proportions and live in
[`assets/cards/s1/`](../cards/README.md) with every other card's.

## Status is a LEVEL that resets every Season

1 to `cfg.statusLevels` (thirty). Reaching the top **is** the Season gate (GDD §5.4), which is why
the curve lives in the economy model rather than in `cfg`.

## Four inflows, all of them derived — and nothing is bought

| inflow | knob |
|---|---|
| converting a card — its **third** copy | that rarity's `status`, then `trickle` per copy after |
| completing a set of twelve | `cfg.setBonusStatus` |
| watching an episode | `cfg.statusPerEpisode` |
| calling a prediction right | `cfg.statusPerPrediction` |

None of these is stored: each is already written down somewhere else, and a second copy would
drift. Nor is any of them for sale. Coins buy boxes and energy, and that is the whole shop —
there is no screen on which the track can be bought past, which is what makes reaching level 30
mean something.

The **one** stored number is `state.seasonFrom`: the lifetime total when this Season began.
Points this Season are the difference, which is how §5.3's reset takes Status to zero while the
collection, the Showcase and the prediction record all persist — nothing is deleted, the line
just moves.

## The trophies are the exception, and that is the point

A "Called it" (§7.4) is granted whole, one per episode, and it is the only Showcase piece in the
game **a box cannot contain**. That is exactly why it is worth having, and why granting it whole
is not the mistake the shelf was: the shelf's objects could also be bought, so owning one proved
nothing. A trophy can only be earned by calling that episode right.

`Status.trophyOf(id)` synthesises it from the episode list, so a trophy needs no content of its
own beyond the episode already having a title — `called-it.webp` is the only file here it reads,
and the same picture serves all eighteen. Points are `cfg.trophyStatus`. What is stored is which
episodes were called right, and nothing else.

## Bands and milestones

`STATUS_RANKS` names a band every five levels, and the first must open at level 1. `STATUS_MILESTONES`
pays at the same levels — a clue cache, energy or a pack — and the estate changes there too. That
alignment is deliberate: a milestone, a new title and a new house arriving together is one beat
instead of three.

A milestone pays once, and that record (`state.statusMilestones`) is the second stored thing:
"was this given" is not derivable from a level that only goes up. A clue cache is what couples
the two tracks — the Status track buying story progress is the reason climbing it is worth doing.

`Status.validate()` checks both lists at boot: the first band opening at level 1, bands strictly
ascending and none of them past the Season's last level, and every milestone landing inside the
Season and paying something that exists. A milestone that names a box tier nobody defines is the
one authoring mistake here that looks exactly like bad luck.

## Zones are for the room that is coming

`STATUS_ZONES` — wall, shelf, desk, wardrobe — is read by nothing today, and is kept on purpose.
It is where a piece will *hang* when the profile becomes a picture of the player's room rather
than a grid of it: a poster on the wall, a gown in the closet. Nothing is authored into a zone
now, because a Collectible's identity comes from its card and its set.

The same restraint applies one level up. **The player-curated Showcase of §5.2 is not built**, and
that is a decision rather than a gap. The doc's Showcase is a room other players *visit*, with
pieces chosen to be seen — and choosing what to show only means anything once someone can come
and look. There are no visits in this build, so what the profile shows is every Collectible the
player has converted, grouped by its set, with the trophies above them. Curation first would be
a settings screen impersonating a social feature.

## A Showcase piece is framed

Wherever one appears — flying out of a box, on the profile, in the DOM fallback — a Collectible
and a trophy wear the **gold double frame with corner ticks**, and the points are the hero. No
card in the album wears one, and that is the whole of how the two are told apart.

Note what is being told apart, because it is not two kinds of object: it is **two states of one
card**. The same status card is a gilt collection card in the album — a thing in a set, with a
rarity and a copy count — and a plaque the moment it converts, because that is when it stops
being progress and becomes something you own. One id, two faces.

Converting one plays its own beat ([`js/ui/statusup.js`](../../js/ui/statusup.js)): the
Collectible, the points, and the track moving — with the rank turning over mid-animation when it
turns over. `cfg.statusBarMs` is how long the track takes and `cfg.statusUpMs` how long the
result is held.

## The art

`called-it.webp` and the leftovers in `items/` came off the same pipeline as the cards (see
[../cards/README.md](../cards/README.md)): Scenario at 992 × 992, resized to 320 and encoded to
WebP, a single object on a dark plum-to-charcoal gradient, three-quarter from slightly above,
with a golden rim light. No text is generated.

**Card art is not that shape**, which is why the twenty status cards were repainted rather than
handed the old files: a card is 864 × 1152 and full-bleed, these are squares cropped for a grid.
That is the only reason `items/` is still on disk and nothing reads it — a picture that is the
wrong shape for the only surface left is not a picture that can be reused.
