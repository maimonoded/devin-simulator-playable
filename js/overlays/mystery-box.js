"use strict";
/* Mystery box — spawned on standard tiles by builder upgrades (cfg.boxesPerUpgrade each).
   Landing on one opens it before the tile pays out.

   TWO items every box, which is what the economy model is balanced around:
     item 1  always coins (cfg.boxCoins)
     item 2  one weighted draw from the editable boxTable — coins, energy or clues
   Item 2 is the only source of clues in the game, so its weight is what sets the clue rate
   a prediction runs on. Two rewards means two playback events (an event carries one float
   and one log), separated by cfg.boxItemGapMs so they don't stack on top of each other. */
class MysteryBoxOverlay extends Overlay {
  get stateKey(){ return "boxes"; }
  get icon(){ return "🎁"; }
  get cssClass(){ return "box"; }
  /* boxes only appear on plain tiles — never on corners, trains or decks */
  eligible(i){ return tileType(i)==="standard"; }
  onLand(){
    const bs=cfg.boardScale;
    const c1=cfg.boxCoins*bs;
    const first=this.gainCoins(c1,"🎁 +"+fmt(c1));
    first.log={icon:"🎁",msg:`Mystery Box · <b>${fmt(c1)}</b> coins`};
    first.pause=cfg.boxItemGapMs;

    const drop=weighted(boxTable);
    let ev,dice=false;
    if(drop.kind==="coins"){ const c=drop.amount*bs; ev=this.gainCoins(c,"+"+fmt(c)); }
    else if(drop.kind==="energy"){ ev=this.gainEnergy(drop.amount,"+"+drop.amount+"⚡"); dice=true; }
    else { ev=this.gainClues(drop.amount,"+"+drop.amount+"🔍"); }
    ev.log={icon:"🎁",msg:`… and <b>${drop.name}</b>`};
    ev.dice=dice;   // energy drops get the dice shower
    ev.pause=120;
    return [first,ev];
  }
}
registerOverlay("mysteryBox",MysteryBoxOverlay);
