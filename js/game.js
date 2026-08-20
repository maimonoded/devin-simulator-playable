"use strict";
/* Game logic — mutates state, never touches the DOM.
   Functions that used to animate mid-logic now return ordered event lists;
   ui/main.js plays them back (floats, log lines, token moves, confetti, pauses).
   Event fields (any subset per event, played in this order):
     float:{text,color} · log:{icon,msg} · move:{path:[tileIdx,...],stepMs} · confetti:true · pause:ms */

/* Tickets and episode unlocks live in js/tickets.js; the card shoe in js/shoe.js. */

/* ---------- pulling ----------
   The card comes off the shoe in js/shoe.js (which also counts the pull). A NUMBER card is a
   step count; a TICKET card moves nothing at all — see the ticket branch in pull() in
   js/ui/main.js, which must return before the landing is resolved. */

/* Lap bonus when passing (not landing on) Start. Returns the coin amount. */
function applyPassStart(mult){
  const pass=cfg.startPass*cfg.boardScale*mult; state.coins+=pass;
  state.vip+=cfg.vipSeed*cfg.boardScale;
  return pass;
}

/* Resolve whatever the token landed on. Mutates state fully; returns events for the UI to play.
   Overlays (js/overlays/) resolve first since they sit on top of the tile; per-type landing
   behavior lives in js/tiles/. Nothing tile-specific belongs in this function.

   `card` is the card that produced this landing, passed straight through to the tile. It is on
   the context rather than looked up because there is nowhere to look it up FROM: the shoe has
   already shifted it off and state keeps no "last card". The Spa is the first tile to read it
   (its grant is the card's rank) and it stays a general field rather than a Spa argument —
   any tile that wants to know how it was reached needs exactly this. Null is legitimate and
   means "resolved without a pull", which every tile that reads it must handle. */
function resolveLandingEvents(mult=1,card=null){
  const ev=[]; const i=state.pos;
  // an overlay may pay out more than once, so it may hand back an array (see js/overlays/overlay.js)
  OVERLAYS.forEach(o=>{ if(o.has(i)){ const e=o.consume(i); if(e) ev.push(...[].concat(e)); } });
  ev.push(...TILE_TYPES[tileType(i)].onLand({pos:i,mult,bs:cfg.boardScale,card}));
  return ev;
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
  /* Clues banked since the last prediction buy accuracy, then are spent — the economy model
     treats them as a per-cycle flow, not a balance. They only decide the outcome in auto runs;
     a human's pick still decides a manual one. See TODO.md. */
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
/* Advance the clock to the next session, deal free cards, grant login rewards on day change.

   THIS IS THE GAME'S CLOCK. A pack of 50 cards earns far more coins than the next pack costs,
   so coins alone never gate anything — the rate free cards arrive at is what sets episodes per
   day, exactly as the energy allowance used to.

   NO FRACTIONAL CREDIT IS CARRIED, and none is needed: `gap` is the MAX of the deficit's own
   refill time and one session slot, so gap/cardRegenMin is always at least the deficit itself.
   The entitlement therefore always covers the room in the shoe and a session always deals up to
   the cap — a carried remainder could never change the outcome. (The energy version had the
   same property. If the gap ever stops being derived from the deficit — real elapsed time, say —
   this stops being true and the remainder starts to matter.) */
function advanceSession(){
  const missing=Math.max(0,Math.round(cfg.packSize||1)-state.shoe.length);
  const gap=Math.max(missing*cfg.cardRegenMin, 1440/cfg.sessionsPerDay);
  // tops up toward the cap, but never trims a shoe already over it (a bought pack merges on top)
  const dealt=Shoe.dealFree(Math.floor(gap/cfg.cardRegenMin));
  state.clock+=gap;
  const newDay=Math.floor(state.clock/1440)+1;
  const rewards=[];
  if(newDay>state.day){
    for(let d=state.day;d<newDay;d++){ const rw=LOGIN_REWARDS[d%7]*cfg.boardScale; state.coins+=rw; rewards.push({day:d+1,amount:rw}); }
    state.day=newDay; state.sessionsToday=1;
  } else { state.sessionsToday++; }
  return {isNewDay:rewards.length>0, rewards, cards:dealt};
}
