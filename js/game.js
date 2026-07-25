"use strict";
/* Game logic — mutates state, never touches the DOM.
   Functions that used to animate mid-logic now return ordered event lists;
   ui/main.js plays them back (floats, log lines, token moves, confetti, pauses).
   Event fields (any subset per event, played in this order):
     float:{text,color} · log:{icon,msg} · move:{path:[tileIdx,...],stepMs} · confetti:true · pause:ms */

/* ---------- builders / upgrades ---------- */
function upgradeCost(bIdx,tier){ return cfg.baseCost*Math.pow(cfg.tierGrowth,tier)*Math.pow(cfg.bldgGrowth,bIdx)*cfg.boardScale; }
function builderCost(bIdx){ const b=state.builder[bIdx]; return b.tier>=cfg.tiers?null:upgradeCost(bIdx,b.tier); }
function cheapestUpgrade(){ let best=null; state.builder.forEach((b,i)=>{ const c=builderCost(i); if(c!=null&&(best==null||c<best.cost)) best={b:i,tier:b.tier,cost:c}; }); return best; }
function buildersDone(){ return state.builder.filter(b=>b.tier>=cfg.tiers).length; }

/* Buy one level on builder bIdx. Returns null if not allowed, else a result the UI announces. */
function applyUpgrade(bIdx){
  if(state.seriesDone||state.animating) return null;
  const b=state.builder[bIdx]; if(!b||b.tier>=cfg.tiers) return null;
  const cost=upgradeCost(bIdx,b.tier); if(state.coins<cost) return null;
  state.coins-=cost; b.tier++;
  const spawned=OVERLAY_TYPES.mysteryBox.spawn(cfg.boxesPerUpgrade);
  // every level upgrade unlocks a new episode
  const title=EP_TITLES[state.epUnlockedCount%EP_TITLES.length];
  state.epUnlockedCount++;
  state.epQueue.push(title);
  const seriesDone=state.builder.every(x=>x.tier>=cfg.tiers);
  if(seriesDone) state.seriesDone=true;
  return {cost, level:b.tier, title, builderDone:b.tier>=cfg.tiers, seriesDone, spawned};
}

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
   Overlays (js/overlays/) resolve first since they sit on top of the tile; per-type landing
   behavior lives in js/tiles/. Nothing tile-specific belongs in this function. */
function resolveLandingEvents(mult){
  const ev=[]; const i=state.pos;
  OVERLAYS.forEach(o=>{ if(o.has(i)){ const e=o.consume(i); if(e) ev.push(e); } });
  ev.push(...TILE_TYPES[tileType(i)].onLand({pos:i,mult,bs:cfg.boardScale}));
  return ev;
}

/* ---------- prediction ---------- */
/* Deducts the wager, resolves the outcome (first 4 predictions of a run always win),
   applies payout + streak/accuracy counters, consumes the queued episode. */
function resolvePrediction(wager,odds){
  if(wager>0) state.coins-=wager;
  const rigged=state.predsMade<4;
  state.predsMade++;
  const won=rigged?true:chance(cfg.accuracy);
  state.epsWatched++; state.epQueue.shift();
  let payout=0;
  if(wager>0){
    if(won){ payout=wager*odds; state.coins+=payout; state.predWins++; state.streak++; state.bestStreak=Math.max(state.bestStreak,state.streak); }
    else { state.predLoss++; state.streak=0; }
  }
  return {won,payout};
}

/* ---------- time ---------- */
/* Advance the clock to the next session, refill energy, grant login rewards on day change. */
function advanceSession(){
  const refill=(cfg.energyCap-state.energy)*cfg.regenMin;
  const gap=Math.max(refill, 1440/cfg.sessionsPerDay);
  const regened=Math.floor(gap/cfg.regenMin);
  state.energy=Math.min(cfg.energyCap,state.energy+regened);
  state.clock+=gap;
  const newDay=Math.floor(state.clock/1440)+1;
  const rewards=[];
  if(newDay>state.day){
    for(let d=state.day;d<newDay;d++){ const rw=LOGIN_REWARDS[d%7]*cfg.boardScale; state.coins+=rw; rewards.push({day:d+1,amount:rw}); }
    state.day=newDay; state.sessionsToday=1;
  } else { state.sessionsToday++; }
  return {isNewDay:rewards.length>0, rewards};
}
