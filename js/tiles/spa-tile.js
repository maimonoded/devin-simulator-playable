"use strict";
/* Spa Day — a rest beat, and GDD §3.4 is explicit that it is NEVER a penalty.

   That matters more than it sounds. On a board where a plot twist can take money, a corner that
   also took something would make a quarter of the ring feel hostile; the Spa is the tile you are
   pleased to land on when nothing else went right. Energy only, topped up toward the cap and
   never reducing a purchased overflow (js/board-actor.js). */
class SpaTile extends Tile {
  get icon(){ return "💆"; }
  get corner(){ return true; }
  onLand(){
    const ev=this.gainEnergy(cfg.spaEnergy,"💆 +"+cfg.spaEnergy+"⚡");
    ev.log={icon:"💆",msg:`Spa Day · +<b>${cfg.spaEnergy}</b> energy`};
    return [ev,this.reveal("+"+cfg.spaEnergy+"⚡","Spa Day — energy restored",{positive:true,energy:true})];
  }
}
registerTile("spa",SpaTile);
