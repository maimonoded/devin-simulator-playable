"use strict";
/* Mystery box — spawned on standard tiles by builder upgrades (cfg.boxesPerUpgrade each).
   Landing on one opens it before the tile pays out: a weighted draw from the editable
   boxTable granting coins, energy, or clues. */
class MysteryBoxOverlay extends Overlay {
  get stateKey(){ return "boxes"; }
  get icon(){ return "🎁"; }
  get cssClass(){ return "box"; }
  /* boxes only appear on plain tiles — never on corners, trains or decks */
  eligible(i){ return tileType(i)==="standard"; }
  onLand(){
    const drop=weighted(boxTable),bs=cfg.boardScale;
    let ev,dice=false;
    if(drop.kind==="coins"){ const c=drop.amount*bs; ev=this.gainCoins(c,"🎁 +"+fmt(c)); }
    else if(drop.kind==="energy"){ ev=this.gainEnergy(drop.amount,"🎁 +"+drop.amount+"⚡"); dice=true; }
    else { ev=this.gainClues(drop.amount,"🎁 +"+drop.amount+"🔍"); }
    ev.log={icon:"🎁",msg:`Mystery Box · <b>${drop.name}</b>`};
    ev.dice=dice;   // energy drops get the dice shower
    ev.pause=120;
    return ev;
  }
}
registerOverlay("mysteryBox",MysteryBoxOverlay);
