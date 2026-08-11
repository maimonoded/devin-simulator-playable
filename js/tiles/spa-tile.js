"use strict";
/* Spa corner — grants cards for the shoe (the direct successor to its energy grant).

   cfg.spaCards is deliberately NOT the old cfg.spaEnergy of 5. Energy was spent at up to ten
   per roll, so five was a small top-up; a pull costs exactly one card and this corner comes
   round roughly every six pulls, so a five-card grant would hand back most of the pull cost
   forever and the deck would stop being a budget at all. */
class SpaTile extends Tile {
  get icon(){ return "💆"; }
  get corner(){ return true; }
  onLand(){
    const n=cfg.spaCards;
    const ev=this.gainCards(n,"💆 +"+n+"🃏");
    ev.log={icon:"💆",msg:`Spa Day · +<b>${n}</b> card${n===1?"":"s"}`};
    return [ev,this.reveal("+"+n+"🃏","Spa Day — the deck is topped up",{positive:true,shower:"cards"})];
  }
}
registerTile("spa",SpaTile);
