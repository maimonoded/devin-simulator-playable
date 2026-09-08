"use strict";
/* The Gala — the jackpot, and the reason a plot twist is allowed to take money.

   GDD §3.4. Everything the twists confiscated is sitting in the pot (js/tiles/pool-tile.js
   drawMoney), along with a seed per lap. Landing here collects the lot AND pays a card of at
   least cfg.galaTier — the doc's "guaranteed Rare or better", which is what stops an empty pot
   from turning the board's biggest landmark into a shrug.

   The pot is `state.vip` and its seed is `cfg.vipSeed`: those are the economy workbook's names
   for it and js/economy-import.js asserts on the label, so the field keeps the old word while
   the tile carries the new one. See js/tiles/tile.js startLandingBonus(). */
class GalaTile extends Tile {
  get icon(){ return "🥂"; }
  get corner(){ return true; }
  onLand(ctx){
    const pot=Math.round(state.vip);
    const ev=[];
    if(pot>0){
      state.vip=0;
      const g=this.gainCoins(pot,"🥂 +"+fmt(pot));
      g.log={icon:"🥂",msg:`The Gala · the pot of <b>${fmt(pot)}</b> collected`};
      ev.push(g,this.reveal("+"+fmt(pot),"The Gala — the pot is yours",{positive:true,ms:cfg.vipRevealMs}));
    } else {
      ev.push({float:{text:"🥂 empty",color:"var(--muted)"},
               log:{icon:"🥂",msg:"The Gala · the pot was empty"}});
    }
    return ev.concat(drawCardEvents("The Gala","🥂",cfg.galaTier));
  }
}
registerTile("gala",GalaTile);
