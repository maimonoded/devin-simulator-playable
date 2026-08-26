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

   This is a dispatch and nothing else, and it stays that way. Four of the board's eight types
   are one class drawing from a weighted pool (js/tiles/pool-tile.js) and the four corners are
   the only bespoke behaviours left (GDD 3.4) — so "what a tile does" is answered in js/tiles/
   and in assets/pools/pools.js, never here.

   The guard is for a board naming a type nobody registered. validateBoard() and Pools.validate()
   both report that at boot; landing on it mid-roll should be a quiet nothing, not a thrown
   error that leaves state.animating stuck and the Roll button dead. */
function resolveLandingEvents(mult){
  const i=state.pos;
  const tile=TILE_TYPES[tileType(i)];
  if(!tile) return [];
  return tile.onLand({pos:i,mult,bs:cfg.boardScale}).slice();
}

/* ---------- prediction ---------- */
/* Deducts the wager, resolves the outcome, applies payout + streak/accuracy counters,
   and consumes the queued episode.
   Manual play is a real prediction: you win only if sel matches the episode's correct
   answer. Auto runs can't meaningfully "pick", so they fall back to the modelled
   cfg.accuracy — that keeps batch economy runs independent of what a script clicks. */
function resolvePrediction({wager,sel,correct,auto,id}){
  if(wager>0) state.coins-=wager;
  state.predsMade++;
  /* The evidence held for THIS episode buys the accuracy — not a running balance, and not
     whatever happened to be banked since the last bet. That is the whole reason the gate and the
     edge are one object (GDD 6.1): the clues that unlocked this episode are the clues you are
     reasoning from, so two players who unlocked it holding different evidence are genuinely
     making different bets.

     It only decides the outcome in AUTO runs; a human's pick still decides a manual one. The
     clues are not cleared — see js/clues.js on why "consumed" does not mean deleted. */
  const held=id!=null?Clues.countFor(id):0;
  const accuracy=Economy.accuracyFor(held);
  const cluesSpent=held;
  const won=auto?chance(accuracy):sel===correct;
  state.epsWatched++;
  /* Remove THIS episode, not whichever happens to be at the front. The library can start a
     prediction for any unwatched episode, so blindly shifting would mark the wrong one watched
     and leave the played one queued forever. No id given → the old front-of-queue behaviour. */
  if(id!=null){ const k=state.epQueue.indexOf(id); if(k>=0) state.epQueue.splice(k,1); }
  else state.epQueue.shift();
  /* FLAT ODDS (GDD 7.3): the multiplier is the same whichever answer was picked, so it comes
     from the model rather than from the answer. */
  const odds=Economy.flatMultiplier();
  let payout=0;
  if(wager>0&&won){ payout=Math.round(wager*odds); state.coins+=payout; }
  /* THE RECORD COUNTS A CALL, NOT A STAKE. A correct prediction pays Status (GDD 5.1) and goes
     on the lifetime record whether or not there was money on it — "Skip & watch" is always
     offered (see CLAUDE.md on `participation`), and a player who takes it and calls it right
     has still called it right. A skip with no answer picked is not a call at all, so it counts
     as neither: sel is null there, and a null would otherwise read as a loss. */
  const called=auto||sel!=null;
  if(called){
    if(won){ state.predWins++; state.streak++; state.bestStreak=Math.max(state.bestStreak,state.streak); }
    else { state.predLoss++; state.streak=0; }
  }
  /* GDD 7.4. EVERY prediction pays a Collectible — won, lost or skipped — so a bet is never a
     round that gave you nothing, and the collectible rather than the coin number is the headline.
     A CORRECT call pays a better one and a trophy unique to that episode, which is the only thing
     in the game that cannot come out of a box. */
  const reward={card:null,trophy:null};
  if(id!=null){
    reward.card=Cards.drawAndAdd(won?(cfg.predRewardFloor||null):null);
    if(won) reward.trophy=Status.grantTrophy(id);
  }
  return {won,payout,odds,accuracy,cluesSpent,called,reward};
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
