"use strict";
/* Game logic — mutates state, never touches the DOM.
   Functions that used to animate mid-logic now return ordered event lists;
   ui/main.js plays them back (floats, log lines, token moves, confetti, pauses).
   Event fields (any subset per event, played in this order):
     float:{text,color} · log:{icon,msg} · move:{path:[tileIdx,...],stepMs} · confetti:true ·
     dice:true · pause:ms
   plus the BLOCKING ones, which hold the roll loop (and so auto-roll) until they finish:
     card · reveal · collect · minigame · boxOpen ·
     reshoot:{throws:[{d1,d2}],won,energy,finePct,fine}
       — the Reshoot corner's escape attempt. Every field is a result that has ALREADY been
         applied to state; the UI throws the dice again for the player's benefit and decides
         nothing. The full table, with each field's meaning, is in js/tiles/README.md. */

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
  // an overlay may pay out more than once, so it may hand back an array (see js/overlays/overlay.js)
  OVERLAYS.forEach(o=>{ if(o.has(i)){ const e=o.consume(i); if(e) ev.push(...[].concat(e)); } });
  ev.push(...TILE_TYPES[tileType(i)].onLand({pos:i,mult,bs:cfg.boardScale}));
  return ev;
}

/* ---------- time ---------- */
/* Advance the clock to the next session, refill energy, grant login rewards on day change. */
function advanceSession(){
  const refill=(cfg.energyCap-state.energy)*cfg.regenMin;
  const gap=Math.max(refill, 1440/cfg.sessionsPerDay);
  const regened=Math.floor(gap/cfg.regenMin);
  // refills to the cap, but never drains a purchased overflow balance
  state.energy=Math.max(state.energy,Math.min(cfg.energyCap,state.energy+regened));
  state.clock+=gap;
  const newDay=Math.floor(state.clock/1440)+1;
  const rewards=[];
  if(newDay>state.day){
    for(let d=state.day;d<newDay;d++){ const rw=LOGIN_REWARDS[d%7]*cfg.boardScale; state.coins+=rw; rewards.push({day:d+1,amount:rw}); }
    state.day=newDay; state.sessionsToday=1;
  } else { state.sessionsToday++; }
  return {isNewDay:rewards.length>0, rewards};
}
