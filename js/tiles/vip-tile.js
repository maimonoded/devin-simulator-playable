"use strict";
/* VIP Lounge corner — collects the whole VIP pool (seeded by laps/cards), or nothing if empty.
   Dwells for cfg.vipRevealMs before play continues. */
class VipTile extends Tile {
  get icon(){ return "🌟"; }
  get corner(){ return true; }
  onLand(){
    if(state.vip>0){
      const g=state.vip; state.vip=0;
      const ev=this.gainCoins(g,"🌟 +"+fmt(g));
      ev.log={icon:"🌟",msg:`VIP Lounge · collected pool of <b>${fmt(g)}</b>`};
      return [ev,this.reveal("+"+fmt(g),"VIP Lounge — pool collected",{positive:true,ms:cfg.vipRevealMs})];
    }
    return [{float:{text:"🌟 empty",color:"var(--muted)"},
             log:{icon:"🌟",msg:"VIP Lounge · pool was empty"}},
            this.reveal("Empty","The lounge was deserted",{positive:false,ms:cfg.vipRevealMs})];
  }
}
registerTile("vip",VipTile);
