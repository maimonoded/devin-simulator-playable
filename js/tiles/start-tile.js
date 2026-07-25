"use strict";
/* Start corner — landing here pays pass + landing extra and seeds the VIP pool,
   then dwells for cfg.startRevealMs before the next spin.
   (The lap bonus for merely passing Start lives in game.js applyPassStart.) */
class StartTile extends Tile {
  get icon(){ return "⭐"; }
  get corner(){ return true; }
  onLand({mult}){
    const c=this.startLandingBonus(mult);
    return [{float:{text:"⭐ +"+fmt(c),color:"var(--gold)"},
             log:{icon:"⭐",msg:`Landed on Start · +<b>${fmt(c)}</b> coins`}},
            this.reveal("+"+fmt(c),"Landed on Start",{positive:true,ms:cfg.startRevealMs})];
  }
}
registerTile("start",StartTile);
