"use strict";
/* Premiere corner — sweeps the token to Start at cfg.premiereStepMs per tile,
   then pays the landing bonus. */
class PremiereTile extends Tile {
  get icon(){ return "🎭"; }
  get corner(){ return true; }
  onLand({pos,mult}){
    return [
      {float:{text:"🎭 To Start!",color:"var(--pink)"},log:{icon:"🎭",msg:`The Premiere · <b>advance to Start</b>`}},
      ...this.advanceToStart(pos,mult,cfg.premiereStepMs,"The Premiere — swept to Start"),
    ];
  }
}
registerTile("premiere",PremiereTile);
