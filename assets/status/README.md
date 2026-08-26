# Status — the player's standing, and the shelf that proves it

```
assets/status/
  status.js           STATUS_ZONES + STATUS_RANKS + STATUS_ITEMS
  items/*.webp        the art, one square per item
```

Read by [`js/status.js`](../../js/status.js); rendered by
[`js/ui/profile.js`](../../js/ui/profile.js), with the rank beside the avatar in the HUD.

## Points come from three places at once

| source | knob |
|---|---|
| the items owned | each item's `points` |
| watching | `cfg.statusPerEpisode` per episode watched |
| collecting | `cfg.statusPerCard` per card, `cfg.statusPerBoard` per set finished |

So a player who never spends a coin still climbs, and a player who buys the whole shelf still has
to watch the show to reach the top rank. **That split is the design** — status is the one number
both loops feed. `STATUS_RANKS` names the milestones; the first must be at 0.

## Every item is both bought and earned

| field | meaning |
|---|---|
| `price` | coins, spent from the profile screen |
| `earn` | a play milestone that hands it over free — `{episodes\|cards\|boards\|rolls: n}` |
| `box` | its weight in a box's status slot ([`js/boxes.js`](../../js/boxes.js)); 0 never drops |
| `points` | what owning it is worth on the track |
| `zone` | where it will hang — `wall`, `shelf`, `desk`, `wardrobe` |
| `blurb` | one line, shown under it |

An item with only one of `price`/`earn` is a content bug rather than a variant: the brief is that
everything is purchasable **and** everything is reachable by playing. The milestone is always
achievable by play alone; the price is what shortcuts it. Which route an item actually arrived by
is recorded (`bought` / `earned` / `found`) and shown, because those are different bragging
rights.

## A status item is framed

Wherever one appears — flying out of a box, on the profile shelf, in the DOM fallback — it wears a
**gold double frame with corner ticks**. No collection card of any tier wears one. That is the
whole of how the two are told apart, and it has to be, because they come out of the same box
seconds apart and are completely different things: a card is spent unlocking an episode, an item
goes on the shelf and stays.

Earning one plays its own beat ([`js/ui/statusup.js`](../../js/ui/statusup.js)): the item, the
points, and the track moving — with the rank turning over mid-animation when it turns over.
`cfg.statusBarMs` is how long the track takes and `cfg.statusUpMs` how long the result is held.

## Zones are for the room that is coming

`zone` is where the item will hang when the profile becomes a picture of the player's room rather
than a grid of it — a poster on the wall, a gown in the closet. The grid already groups by it, so
authoring for the room costs nothing today and the room will cost no re-authoring later.

## The art

Same pipeline as the cards (see [../cards/README.md](../cards/README.md)): Scenario at
992 × 992, resized to 320 and encoded to WebP. The style block puts a single object on a dark
plum-to-charcoal gradient, three-quarter from slightly above, with a golden rim light — so ten
unrelated objects still read as one set of merchandise. No text is generated.
