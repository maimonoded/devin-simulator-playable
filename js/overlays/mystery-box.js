"use strict";
/* Mystery box — sits on a standard tile and opens before that tile pays out.

   NOTHING SPAWNS ONE YET. Builder upgrades used to bank them (cfg.boxesPerUpgrade each) and
   builders are gone; what places a box is a deck card, once the deck is written. The whole
   mechanism — banking, placement, the throw onto the board, the two-item open — is kept intact
   and unspawned so that card only has to call spawn().

   TWO items every box, which is what the economy model is balanced around:
     item 1  always coins (cfg.boxCoins)
     item 2  one weighted draw from the editable boxTable — coins or energy
   Two rewards means two playback events (an event carries one float and one log), separated by
   cfg.boxItemGapMs so they don't stack on top of each other.

   ITEM 2 IS DRAWN WHEN THE BOX IS PLACED, not when it is landed on. It used to matter visibly —
   a box holding clues was drawn gold, so it read as a target from across the board — and with
   clues gone every box looks alike again. The early draw stays because it is the honest place
   for it: it is the same weighted() call on the same table either way, so no expectation
   changes, and the next thing worth marking on the board has somewhere to be decided.

   One consequence worth knowing: a box carries the table as it was when it spawned. Editing the
   weights in the drawer changes the boxes placed after that, not the ones already on the board —
   which is correct, since the player has already been shown what those contain. */
class MysteryBoxOverlay extends Overlay {
  get stateKey(){ return "boxes"; }
  get icon(){ return "🎁"; }
  get cssClass(){ return "box"; }
  /* boxes only appear on plain tiles — never on corners or the card tiles */
  eligible(i){ return tileType(i)==="standard"; }
  /* What is inside, decided at placement. Stored on the board with the position. */
  roll(){ const d=weighted(boxTable); return {kind:d.kind,amount:d.amount,name:d.name}; }
  onLand(i,drop){
    const bs=cfg.boardScale;
    const c1=cfg.boxCoins*bs;
    const first=this.gainCoins(c1,"🎁 +"+fmt(c1));
    first.log={icon:"🎁",msg:`Mystery Box · <b>${fmt(c1)}</b> coins`};
    first.pause=cfg.boxItemGapMs;

    /* A box restored from a save made before contents were decided at spawn has nothing stored;
       draw for it now, which is exactly what the old code did anyway. */
    if(!drop) drop=this.roll();
    /* An unknown kind pays coins rather than nothing: a save made while the box table still had
       a third row (clues) must not open into an empty box. */
    let ev;
    if(drop.kind==="energy") ev=this.gainEnergy(drop.amount,"+"+drop.amount+"⚡");
    else { const c=drop.amount*bs; ev=this.gainCoins(c,"+"+fmt(c)); }
    ev.log={icon:"🎁",msg:`… and <b>${drop.name}</b>`};
    ev.pause=120;
    /* The opening goes FIRST and blocks: the box flies to the middle of the screen, swells and
       pops, and the confetti and showers fire on the pop. Only then do the floats run, so the
       numbers appear out of the burst rather than over a box that is still sitting there.

       It carries what is inside rather than the payouts themselves — the coins and energy were
       already banked above by gain*(). This is presentation deciding what to show, not what to
       pay, which is the same split the bonus mini-games use. */
    const open={boxOpen:{tile:i,coins:c1+(drop.kind==="energy"?0:drop.amount*bs),
                         energy:drop.kind==="energy"?drop.amount:0}};
    return [open,first,ev];
  }
}
registerOverlay("mysteryBox",MysteryBoxOverlay);
