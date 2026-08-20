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
      const rev=this.reveal("+"+fmt(g),"VIP Lounge — pool collected",{positive:true,ms:cfg.vipRevealMs});
      /* Open the treasure chest standing behind this corner, riding on the reveal so the two
         play together. THIS IS THE ONLY THING THAT OPENS IT.

         It used to watch state.vip and open on any change, which was worse than it sounds: the
         pool is seeded on roughly one landing in seven — every lap past Start, every arrival,
         every fine — and all of those happen with the token somewhere else, so the camera is
         somewhere else too and the far corner is off the top of the frame. Nine openings in ten
         played to an empty room, and the tenth was over before the player looked up.

         The pay-out is the beat worth showing: it is the only moment the player is standing at
         this corner, and it is what a chest full of gold actually depicts. Nothing on the empty
         branch below — the open model is heaped with coins, so opening it on a dry pool would
         show gold that was not paid. */
      rev.chest={ms:Math.max(0,+cfg.chestOpenMs||0)};
      return [ev,rev];
    }
    return [{float:{text:"🌟 empty",color:"var(--muted)"},
             log:{icon:"🌟",msg:"VIP Lounge · pool was empty"}},
            this.reveal("Empty","The lounge was deserted",{positive:false,ms:cfg.vipRevealMs})];
  }
}
registerTile("vip",VipTile);
