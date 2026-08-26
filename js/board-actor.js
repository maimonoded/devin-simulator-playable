"use strict";
/* Shared base for anything that can pay the player and present a result:
     Tile    (js/tiles/)    — one per board index, resolves when landed on
     Overlay (js/overlays/) — sits on top of a tile, resolves before it
   Reward + presentation logic lives here once so neither side duplicates it.
   Nothing in here touches the DOM: the gain* helpers mutate state and return
   playback events, which ui/main.js playEvents() renders. */
/* THE one rule about energy, in one place: top up TOWARD the cap, and never reduce a balance
   already above it. Store energy packs are far larger than cfg.energyCap and that overflow is
   legitimate, so a naive `Math.min(cap, energy + n)` silently deletes a purchase. Every path
   that adds energy goes through here — BoardActor.gainEnergy below, Boxes.dropEnergy, and the
   session refill in js/game.js. See CLAUDE.md, "Energy may exceed the cap". */
function grantEnergy(n){
  state.energy=Math.max(state.energy,Math.min(cfg.energyCap,state.energy+n));
}

class BoardActor {
  /* ---- rewards ---- */
  gainCoins(amount,text,color){
    state.coins+=amount;
    return {float:{text:text??"+"+fmt(amount),color:color||"var(--gold)"}};
  }
  /* Tops up toward the cap, but never reduces a balance already above it
     (store purchases are allowed to overflow the cap). See grantEnergy below. */
  gainEnergy(n,text){
    grantEnergy(n);
    return {float:{text:text??"+"+n+"⚡",color:"var(--teal)"}};
  }
  /* Feeds both counters: the album total and the per-prediction flow that buys accuracy. */
  gainClues(n,text){
    state.clues+=n; state.cycleClues+=n;
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
  /* Full-frame bonus mini-game (minigames/, rendered by js/ui/minigame.js).
       game    — which file to open, by key in MINIGAMES
       amount  — the coins ALREADY paid by gainCoins. The game is handed the number so it can
                 present it; it never decides it, and it never adds coins of its own.
       opts    — {outcome:"win"|"blocked", label} passed through to the game verbatim.
     Falls back to the Collect popup when cfg.bonusGames is off or the file won't load, so a
     missing mini-game costs presentation, never money. */
  minigame(game,amount,opts){
    const o=opts||{};
    /* Anything else in opts (a prize ladder, a tier index, whatever the next game needs) rides
       along untouched and is forwarded verbatim — the host does not need to learn each game's
       payload, and `big`/`sub` keep the Collect-popup fallback readable. */
    return {minigame:Object.assign({},o,{game,amount,outcome:o.outcome||"win",label:o.label||"",
                                         big:"+"+fmt(amount),sub:o.label||""})};
  }
  /* Drawn card held on screen for cfg.deckCardMs. opts: {positive, energy} */
  card(name,big,opts){
    const o=opts||{};
    return {card:{name,big,positive:!!o.positive,energy:!!o.energy}};
  }
}
