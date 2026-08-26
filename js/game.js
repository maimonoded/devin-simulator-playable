"use strict";
/* Game logic — mutates state, never touches the DOM.
   Functions that used to animate mid-logic now return ordered event lists;
   ui/main.js plays them back (floats, log lines, token moves, confetti, pauses).
   Event fields (any subset per event, played in this order):
     float:{text,color} · log:{icon,msg} · move:{path:[tileIdx,...],stepMs} · confetti:true · pause:ms */

/* The collection, and what unlocks an episode, live in js/collection.js. */

/* ---------- rolling ---------- */
function rollDice(){ const d1=Math.floor(rand(1,7)),d2=Math.floor(rand(1,7)); return {d1,d2,steps:d1+d2}; }
function spendRoll(mult){ state.energy-=mult; state.rolls++; }

/* Lap bonus when passing (not landing on) Start. Returns the coin amount. */
function applyPassStart(mult){
  const pass=cfg.startPass*cfg.boardScale*mult; state.coins+=pass;
  state.vip+=cfg.vipSeed*cfg.boardScale;
  return pass;
}

/* Resolve whatever the token landed on. Mutates state fully; returns events for the UI to play.
   Per-type landing behavior lives in js/tiles/; nothing tile-specific belongs in this function.

   There is no overlay layer any more. Boxes used to sit on tiles and resolve before them; they
   are now handed over and opened on the spot (js/tiles/deck-tile.js, js/boxes.js), so a tile
   index has exactly one thing on it again. */
function resolveLandingEvents(mult){
  const i=state.pos;
  return TILE_TYPES[tileType(i)].onLand({pos:i,mult,bs:cfg.boardScale}).slice();
}

/* ---------- prediction ---------- */
/* Deducts the wager, resolves the outcome, applies payout + streak/accuracy counters,
   and consumes the queued episode.
   Manual play is a real prediction: you win only if sel matches the episode's correct
   answer. Auto runs can't meaningfully "pick", so they fall back to the modelled
   cfg.accuracy — that keeps batch economy runs independent of what a script clicks. */
function resolvePrediction({wager,odds,sel,correct,auto,id}){
  if(wager>0) state.coins-=wager;
  state.predsMade++;
  /* Clue CARDS banked since the last prediction buy accuracy, then are spent — the economy
     model treats them as a per-cycle flow, not a balance. Only a new clue card counts (a
     duplicate pays coins), and they only decide the outcome in auto runs; a human's pick still
     decides a manual one. See TODO.md. */
  const accuracy=Economy.accuracyFor(state.cycleClues);
  const cluesSpent=state.cycleClues;
  state.cycleClues=0;
  const won=auto?chance(accuracy):sel===correct;
  state.epsWatched++;
  /* Remove THIS episode, not whichever happens to be at the front. The library can start a
     prediction for any unwatched episode, so blindly shifting would mark the wrong one watched
     and leave the played one queued forever. No id given → the old front-of-queue behaviour. */
  if(id!=null){ const k=state.epQueue.indexOf(id); if(k>=0) state.epQueue.splice(k,1); }
  else state.epQueue.shift();
  let payout=0;
  if(wager>0){
    if(won){ payout=wager*odds; state.coins+=payout; state.predWins++; state.streak++; state.bestStreak=Math.max(state.bestStreak,state.streak); }
    else { state.predLoss++; state.streak=0; }
  }
  return {won,payout,accuracy,cluesSpent};
}

/* ---------- time ---------- */
/* Advance the clock to the next session, refill energy, grant login rewards on day change. */
function advanceSession(){
  const refill=(cfg.energyCap-state.energy)*cfg.regenMin;
  const gap=Math.max(refill, 1440/cfg.sessionsPerDay);
  const regened=Math.floor(gap/cfg.regenMin);
  // refills to the cap, but never drains a purchased overflow balance (js/board-actor.js)
  grantEnergy(regened);
  state.clock+=gap;
  const newDay=Math.floor(state.clock/1440)+1;
  const rewards=[];
  if(newDay>state.day){
    for(let d=state.day;d<newDay;d++){ const rw=LOGIN_REWARDS[d%7]*cfg.boardScale; state.coins+=rw; rewards.push({day:d+1,amount:rw}); }
    state.day=newDay; state.sessionsToday=1;
  } else { state.sessionsToday++; }
  return {isNewDay:rewards.length>0, rewards};
}
