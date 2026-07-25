"use strict";
/* Deck tile (Plot Twist) — draws a weighted card from the merged deck.
   The drawn card is shown on screen for cfg.deckCardMs before the rewards land.
   Cards can grant coins (or fine), energy, clues, seed the VIP pool, or advance to Start. */
class DeckTile extends Tile {
  get icon(){ return "🃏"; }
  onLand({pos,mult,bs}){
    const card=weighted(deck);
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
    if(card.energy){ floats.push(this.gainEnergy(card.energy)); parts.push("+"+card.energy+"⚡"); }
    if(card.clues){ floats.push(this.gainClues(card.clues)); parts.push("+"+card.clues+"🔍"); }
    if(card.vip) state.vip+=card.vip*bs;
    // a card is a loss only when it costs coins (e.g. Fine / Paparazzi)
    const positive=!(card.coins<0);
    // show the card first, then the rewards fly off the token
    return [logEv,
            this.card(card.name,parts.join("  "),{positive,energy:!!card.energy}),
            ...floats];
  }
}
registerTile("deck",DeckTile);
