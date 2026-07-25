"use strict";
/* Persistence — tuning config and player progress are saved to localStorage so both
   survive a reload. Two independent slots, each with its own reset:
     pmdrama.cfg.v1    → cfg + deck + boxTable   (Reset config)
     pmdrama.state.v1  → run progress            (Reset user)
   Writes are debounced; every call is guarded so a blocked/full localStorage
   (private mode, some file:// setups) degrades to "just don't persist". */
const LS_CFG="pmdrama.cfg.v1";
const LS_STATE="pmdrama.state.v1";

let storageOK=(function(){
  try{ const k="pmdrama.probe"; localStorage.setItem(k,"1"); localStorage.removeItem(k); return true; }
  catch(e){ return false; }
})();

/* ---------------- config slot ---------------- */
function saveConfig(){
  if(!storageOK) return;
  try{ localStorage.setItem(LS_CFG,JSON.stringify({v:1,cfg,deck,boxTable})); }catch(e){ storageOK=false; }
}
function loadConfig(){
  if(!storageOK) return false;
  let raw; try{ raw=localStorage.getItem(LS_CFG); }catch(e){ return false; }
  if(!raw) return false;
  try{
    const d=JSON.parse(raw);
    // merge onto DEFAULTS so keys added in later versions still get their default
    if(d.cfg) cfg=Object.assign({},DEFAULTS,d.cfg);
    if(Array.isArray(d.deck)&&d.deck.length) deck=d.deck;
    if(Array.isArray(d.boxTable)&&d.boxTable.length) boxTable=d.boxTable;
    return true;
  }catch(e){ return false; }
}
function clearConfig(){ if(!storageOK) return; try{ localStorage.removeItem(LS_CFG); }catch(e){} }

/* ---------------- player slot ---------------- */
/* Explicit field list: transient bits (animating, tween baselines) are never persisted. */
function serializeState(){
  return {v:1,
    day:state.day, clock:state.clock, sessionsToday:state.sessionsToday,
    energy:state.energy, coins:state.coins, clues:state.clues, vip:state.vip,
    pos:state.pos, mult:state.mult, boardNum:state.boardNum,
    builder:state.builder.map(b=>({tier:b.tier})), boxes:[...state.boxes],
    epQueue:[...state.epQueue], epsWatched:state.epsWatched, epUnlockedCount:state.epUnlockedCount,
    boardsDone:state.boardsDone, predWins:state.predWins, predLoss:state.predLoss,
    streak:state.streak, bestStreak:state.bestStreak, rolls:state.rolls, predsMade:state.predsMade,
    seriesDone:state.seriesDone,
  };
}
function saveState(){
  if(!storageOK) return;
  try{ localStorage.setItem(LS_STATE,JSON.stringify(serializeState())); }catch(e){ storageOK=false; }
}
/* Overlays saved values onto a fresh state, so missing/new fields keep their defaults.
   Call after initState(). Returns true if a save was restored. */
function loadState(){
  if(!storageOK) return false;
  let raw; try{ raw=localStorage.getItem(LS_STATE); }catch(e){ return false; }
  if(!raw) return false;
  try{
    const d=JSON.parse(raw);
    if(typeof d!=="object"||d===null) return false;
    Object.keys(serializeState()).forEach(k=>{ if(k!=="v"&&d[k]!==undefined) state[k]=d[k]; });
    state.builder=Array.isArray(d.builder)&&d.builder.length
      ? d.builder.map(b=>({tier:Math.min(Math.max(0,b.tier|0),cfg.tiers)}))
      : freshBuilder();
    if(state.builder.length!==cfg.buildings) rebuildBuilder();
    state.boxes=new Set(Array.isArray(d.boxes)?d.boxes:[]);
    state.epQueue=Array.isArray(d.epQueue)?d.epQueue:[];
    state.energy=Math.min(state.energy,cfg.energyCap);
    state.animating=false;
    // tween baselines start where we left off, so the HUD doesn't count up from zero
    state.lastCoins=state.coins; state.lastClues=state.clues; state.lastEnergy=state.energy;
    return true;
  }catch(e){ return false; }
}
function clearState(){ if(!storageOK) return; try{ localStorage.removeItem(LS_STATE); }catch(e){} }

/* ---------------- debounced autosave ---------------- */
let _cfgT=null,_stateT=null;
function scheduleSaveConfig(){ if(!storageOK) return; clearTimeout(_cfgT); _cfgT=setTimeout(saveConfig,300); }
function scheduleSaveState(){ if(!storageOK) return; clearTimeout(_stateT); _stateT=setTimeout(saveState,300); }
/* Flush pending writes if the tab goes away mid-animation. */
window.addEventListener("beforeunload",()=>{ if(!storageOK) return; clearTimeout(_cfgT); clearTimeout(_stateT); saveConfig(); saveState(); });
