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
  onLand(i){
    const bs=cfg.boardScale;
    const c1=cfg.boxCoins*bs;
    const first=this.gainCoins(c1,"🎁 +"+fmt(c1));
    first.log={icon:"🎁",msg:`Mystery Box · <b>${fmt(c1)}</b> coins`};
    first.pause=cfg.boxItemGapMs;

    const drop=weighted(boxTable);
    let ev,clue=null;
    if(drop.kind==="coins"){ const c=drop.amount*bs; ev=this.gainCoins(c,"+"+fmt(c)); }
    else if(drop.kind==="energy"){ ev=this.gainEnergy(drop.amount,"+"+drop.amount+"⚡"); }
    else {
      /* Clues are the game's only collectible, so this one stops the board and says WHAT was
         found rather than floating a number past. Slots fill in order (js/clues.js), so the
         ones to name are those between the album's fill BEFORE this drop and after it — not
         simply the last `amount`, which on a full album would re-announce clues already owned. */
      const had=Math.min(Clues.total(),Math.floor(state.clues));
      ev=this.gainClues(drop.amount,"+"+drop.amount+"🔍");
      const now=Math.min(Clues.total(),Math.floor(state.clues));
      const names=[];
      for(let k=had;k<now;k++) names.push(Clues.nameOf(k));
      clue={names,count:drop.amount};
    }
    ev.log={icon:"🎁",msg:`… and <b>${drop.name}</b>`};
    ev.pause=120;
    /* The opening goes FIRST and blocks: the box flies to the middle of the screen, swells and
       pops, and the confetti and showers fire on the pop. Only then do the floats run, so the
       numbers appear out of the burst rather than over a box that is still sitting there.

       It carries what is inside rather than the payouts themselves — the coins and clues were
       already banked above by gain*(). This is presentation deciding what to show, not what to
       pay, which is the same split the bonus mini-games use. */
    const open={boxOpen:{tile:i,coins:c1+(drop.kind==="coins"?drop.amount*bs:0),
                         energy:drop.kind==="energy"?drop.amount:0, clue}};
    return [open,first,ev];
  }
}
registerOverlay("mysteryBox",MysteryBoxOverlay);
