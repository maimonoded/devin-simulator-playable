"use strict";
/* Deck tile (Plot Twist) — hands over a collectible box, and the player opens it on the spot.

   This tile used to draw a plot-twist card: coins, a fine, energy, or Advance to Start. It is
   now the game's only source of cards, so what it hands over is a BOX (js/boxes.js) and every
   one of those old outcomes still exists — as rows in the box's table. Coins and energy come
   out of a box rather than off a card, which is the same income wearing a different hat.

   Which tier lands here is weighted (cfg's deckBoxes): mostly Silver, so a Gold off a tile is
   a good turn and a Diamond is a story. That is deliberate — the paid tiers in the store have
   to stay worth paying for.

   The tile itself decides nothing about what is inside. openBoxEvents() opens it, banks it and
   returns the events; this file only says WHICH box. */
class DeckTile extends Tile {
  get icon(){ return "🎁"; }
  onLand(){ return openBoxEvents(Boxes.drawTier()); }
}
registerTile("deck",DeckTile);
