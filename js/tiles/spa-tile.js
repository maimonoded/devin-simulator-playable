"use strict";
/* Spa corner — grants energy (cap-clamped). */
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
