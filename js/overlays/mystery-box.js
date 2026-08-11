"use strict";
/* Mystery box — dropped on standard tiles when a ticket is earned (cfg.boxesPerTicketCard each).
   Landing on one opens it before the tile pays out.

   TWO items every box, which is what the economy model is balanced around:
     item 1  always coins (cfg.boxCoins)
     item 2  one weighted draw from the editable boxTable — coins, a ticket, or clues.
             Note the loop that creates: a ticket drops a box, and a box can hold a ticket. It
             is bounded, not runaway — a box has to be LANDED on to pay out, and at a 1-in-3
             weight the geometric sum is only a 1.5x multiplier even if every box is collected.
   Item 2 is the only source of clues in the game, so its weight is what sets the clue rate
   a prediction runs on. Two rewards means two playback events (an event carries one float
   and one log), separated by cfg.boxItemGapMs so they don't stack on top of each other.

   ITEM 2 IS DRAWN WHEN THE BOX IS PLACED, not when it is landed on. That is what lets the board
   show a GOLD box on a tile holding clues — a box you can see is worth crossing to is a target,
   where an identical box on every tile is only an invisible bonus. Moving the draw earlier
   changes no expectation whatever: it is the same weighted() call on the same table, so the
   payout distribution and the clue rate are exactly what they were.

   One consequence worth knowing: a box carries the table as it was when it spawned. Editing the
   weights in the drawer changes the boxes placed after that, not the ones already on the board —
   which is correct, since the player has already been shown what those contain. */
class MysteryBoxOverlay extends Overlay {
  get stateKey(){ return "boxes"; }
  get icon(){ return "🎁"; }
  get cssClass(){ return "box"; }
  /* boxes only appear on plain tiles — never on corners, trains or decks */
  eligible(i){ return tileType(i)==="standard"; }
  /* What is inside, decided at placement. Stored on the board with the position. */
  roll(){ const d=weighted(boxTable); return {kind:d.kind,amount:d.amount,name:d.name}; }
  /* Clues are what make a box gold — see the header. */
  isGold(i){ const d=this.dataAt(i); return !!d&&d.kind==="clues"; }
  classAt(i){ return this.cssClass+(this.isGold(i)?" gold":""); }
  onLand(i,drop){
    const bs=cfg.boardScale;
    const c1=cfg.boxCoins*bs;
    const first=this.gainCoins(c1,"🎁 +"+fmt(c1));
    first.log={icon:"🎁",msg:`Mystery Box · <b>${fmt(c1)}</b> coins`};
    first.pause=cfg.boxItemGapMs;

    /* A box restored from a save made before contents were decided at spawn has nothing stored;
       draw for it now, which is exactly what the old code did anyway. */
    if(!drop) drop=this.roll();
    let ev,clue=null;
    if(drop.kind==="coins"){ const c=drop.amount*bs; ev=this.gainCoins(c,"+"+fmt(c)); }
    else if(drop.kind==="tickets"){ ev=this.gainTickets(drop.amount,"+"+drop.amount+"🎟"); }
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
                         tickets:drop.kind==="tickets"?drop.amount:0, clue}};
    return [open,first,ev];
  }
}
registerOverlay("mysteryBox",MysteryBoxOverlay);
