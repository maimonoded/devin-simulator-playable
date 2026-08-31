"use strict";
/* The Premiere — corner 0, and the tile everything else is measured from.

   GDD §3.4: Money on pass, large Money plus a FREE PACK on landing. Passing it is the lap
   bonus and lives in applyPassStart() (js/game.js), because passing is not a landing.

   The free pack is what makes the corner worth aiming at rather than merely walking over, and
   it is the same openBoxEvents() the store and every other source calls — one code path, so the
   drop odds, the episode unlock and the set-complete check cannot drift between them. */
class PremiereTile extends Tile {
  get icon(){ return "🎭"; }
  get corner(){ return true; }
  onLand({mult}){
    const c=this.startLandingBonus(mult);
    return [
      {float:{text:"🎭 +"+fmt(c),color:"var(--gold)"},
       log:{icon:"🎭",msg:`The Premiere · +<b>${fmt(c)}</b> coins and a pack on the house`}},
      this.reveal("+"+fmt(c),"The Premiere — the night is yours",{positive:true,ms:cfg.startRevealMs}),
      ...openBoxEvents(cfg.premiereBox||Boxes.drawTier()),
    ];
  }
}
registerTile("premiere",PremiereTile);
