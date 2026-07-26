"use strict";
/* Shared base for anything that can pay the player and present a result:
     Tile    (js/tiles/)    — one per board index, resolves when landed on
     Overlay (js/overlays/) — sits on top of a tile, resolves before it
   Reward + presentation logic lives here once so neither side duplicates it.
   Nothing in here touches the DOM: the gain* helpers mutate state and return
   playback events, which ui/main.js playEvents() renders. */
class BoardActor {
  /* ---- rewards ---- */
  gainCoins(amount,text,color){
    state.coins+=amount;
    return {float:{text:text??"+"+fmt(amount),color:color||"var(--gold)"}};
  }
  /* Tops up toward the cap, but never reduces a balance already above it
     (store purchases are allowed to overflow the cap). */
  gainEnergy(n,text){
    state.energy=Math.max(state.energy,Math.min(cfg.energyCap,state.energy+n));
    return {float:{text:text??"+"+n+"⚡",color:"var(--teal)"}};
  }
  gainClues(n,text){
    state.clues+=n;
    return {float:{text:text??"+"+n+"🔍",color:"var(--teal)"}};
  }

  /* ---- presentation event builders (all block the roll loop) ---- */
  /* Center-of-board reveal. opts: {positive, energy, ms}
       positive → confetti + pop, otherwise the sad droop
       energy   → adds the dice shower on top
       ms       → hold time override (defaults to cfg.revealMs) */
  reveal(big,sub,opts){
    const o=opts||{};
    return {reveal:{big,sub,positive:!!o.positive,energy:!!o.energy,ms:o.ms}};
  }
  /* Popup with a Collect button; auto-closes after a random
     cfg.collectMinSec–collectMaxSec if the player doesn't click. */
  collect(big,sub){ return {collect:{big,sub}}; }
  /* Drawn card held on screen for cfg.deckCardMs. opts: {positive, energy} */
  card(name,big,opts){
    const o=opts||{};
    return {card:{name,big,positive:!!o.positive,energy:!!o.energy}};
  }
}
