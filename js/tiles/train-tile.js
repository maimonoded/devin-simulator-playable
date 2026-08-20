"use strict";
/* Train tile — the board's two-bonus tile (indices 5/15/25/35).

   It pays ONE of exactly two outcomes, straight from the economy model: the small bonus most of
   the time, the large one at cfg.trainLargeChance. Which one it is, and what it is worth, is
   decided HERE and the coins are banked HERE — before anything is shown. Each outcome then opens
   its own bonus mini-game (minigames/), which is handed the finished number purely to present it.
   That is the whole contract: the engine owns the money, the mini-game owns the drama.

   The large bonus is shown as a three-rung prize ladder, so the tile also builds the ladder and
   picks the winning rung (Economy.trainLadder) — again before the game opens. The game reveals
   that result; it never rolls it. */
/* THE ART IS AN AIRPLANE AND THE TYPE IS STILL `train`. Only the copy moved — the tile type in
   js/board-model.js, the CSS class, the 3D palette key and the mini-game ids (`train-small` /
   `train-large`) all keep the old word, exactly as the `deck` tile type does: renaming them
   would reach the palette, the stylesheet and the game registry to buy nothing. What the player
   reads is the airplane; what the code is called is history. */
class TrainTile extends Tile {
  get icon(){ return "✈️"; }
  onLand({mult,bs}){
    const draw=Economy.trainDraw();
    const top=draw.base*bs*mult;
    if(draw.kind==="small"){
      const ev=this.gainCoins(top,"✈️ +"+fmt(top));
      ev.log={icon:"✈️",msg:`Flight bonus · +<b>${fmt(top)}</b> coins`};
      return [ev,this.minigame("train-small",top,{outcome:"win",label:"Flight bonus"})];
    }
    const lad=Economy.trainLadder(top);
    const c=lad.tiers[lad.winIndex];
    const ev=this.gainCoins(c,"✈️ +"+fmt(c));
    ev.log={icon:"✈️",msg:`<b>Big</b> flight bonus · +<b>${fmt(c)}</b> coins`};
    return [ev,this.minigame("train-large",c,
      {outcome:"win",label:"Big flight bonus",tiers:lad.tiers,winIndex:lad.winIndex})];
  }
}
registerTile("train",TrainTile);
