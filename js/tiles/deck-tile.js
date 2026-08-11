"use strict";
/* Deck tile (Plot Twist) — draws a weighted card from `twistDeck`.

   NOT the deck the player pulls from. This is the six board tiles at 3/8/13/18/23/28 and its
   own weighted table; the pull deck is js/shoe.js. The tile type is still spelled "deck" in
   js/board-model.js for historical reasons — see the note in js/config.js.

   The drawn card is shown on screen for cfg.deckCardMs before the rewards land. Cards can grant
   coins (or fine), a ticket, clues, seed the VIP pool, or advance to Start. */
class DeckTile extends Tile {
  get icon(){ return "🃏"; }
  onLand({pos,mult,bs}){
    const card=weighted(twistDeck);
    const logEv={log:{icon:"🃏",msg:`Plot Twist · <b>${card.name}</b>`}};

    if(card.advance){
      return [
        logEv,
        this.card(card.name,"Advance to Start",{positive:true}),
        ...this.advanceToStart(pos,mult,cfg.tokenStepMs*2/3,"Plot Twist — Advance to Start"),
      ];
    }

    // apply the card's effects (mutates now), collecting the float events for playback
    const floats=[]; const parts=[];
    if(card.coins){ const c=card.coins*bs*mult;
      floats.push(this.gainCoins(c,(card.coins>0?"+":"")+fmt(c),card.coins>0?"var(--gold)":"var(--bad)"));
      parts.push((card.coins>0?"+":"")+fmt(c)); }
    if(card.tickets){ floats.push(this.gainTickets(card.tickets)); parts.push("+"+card.tickets+"🎟"); }
    if(card.clues){ floats.push(this.gainClues(card.clues)); parts.push("+"+card.clues+"🔍"); }
    if(card.vip) state.vip+=card.vip*bs;
    // a card is a loss only when it costs coins (e.g. Fine / Paparazzi)
    const positive=!(card.coins<0);
    // show the card first, then the rewards fly off the token
    return [logEv,
            this.card(card.name,parts.join("  "),{positive,shower:card.tickets?"tickets":null}),
            ...floats];
  }
}
registerTile("deck",DeckTile);
