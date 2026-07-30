"use strict";
/* Persistence — the economy model, tuning config and player progress are saved to localStorage
   so all three survive a reload. Three independent slots:
     pmdrama.econ.v1   → the imported economy model   (Reset economy / re-import)
     pmdrama.cfg.v1    → cfg + deck + boxTable        (Reset config)
     pmdrama.state.v1  → run progress                 (Reset user)
   There is no server yet, so the browser IS the database: an imported workbook lives only
   here, which is why the slot keeps the version string and the filename it came from.
   Writes are debounced; every call is guarded so a blocked/full localStorage
   (private mode, some file:// setups) degrades to "just don't persist". */
const LS_ECON="pmdrama.econ.v1";
const LS_CFG="pmdrama.cfg.v1";
const LS_STATE="pmdrama.state.v1";

let storageOK=(function(){
  try{ const k="pmdrama.probe"; localStorage.setItem(k,"1"); localStorage.removeItem(k); return true; }
  catch(e){ return false; }
})();

/* ---------------- economy slot ---------------- */
/* Only an IMPORTED model is stored. The built-in default is in the code, so persisting it
   would just be a stale copy that shadows a future code change. */
function saveEconomy(){
  if(!storageOK) return;
  const e=Economy.model();
  if(!e.filename){ clearEconomy(); return; }
  try{ localStorage.setItem(LS_ECON,JSON.stringify({v:1,economy:e})); }catch(err){ storageOK=false; }
}
/* Restore an imported model. Returns the version string restored, or null. */
function loadEconomy(){
  if(!storageOK) return null;
  let raw; try{ raw=localStorage.getItem(LS_ECON); }catch(e){ return null; }
  if(!raw) return null;
  try{
    const d=JSON.parse(raw);
    if(!d||!d.economy||!d.economy.version) return null;
    // a stored curve still has to satisfy the open-ended-last-segment rule; a save from a
    // build whose validator was weaker must not be able to deadlock the game
    if(Economy.validateCurve(d.economy.costCurve).length) return null;
    Economy.install(d.economy);
    return Economy.version();
  }catch(e){ return null; }
}
function clearEconomy(){ if(!storageOK) return; try{ localStorage.removeItem(LS_ECON); }catch(e){} }

/* ---------------- config slot ---------------- */
/* Stamped with the economy version the values were edited against — see loadConfig. */
function saveConfig(){
  if(!storageOK) return;
  try{ localStorage.setItem(LS_CFG,JSON.stringify({v:1,econVersion:Economy.version(),cfg,deck,boxTable})); }catch(e){ storageOK=false; }
}
/* Overlay the saved tuning onto whatever the economy model just projected.
   The version stamp decides how much of it survives: tuning edited against the model that is
   still loaded is kept in full, but once a NEW model has been imported its numbers must win,
   or importing a workbook would silently do nothing for anyone who has played before. So on a
   version change the economy-owned keys (and the deck/box tables, which the model rebuilds
   wholesale) are dropped, while camera, presentation and environment settings carry over. */
function loadConfig(){
  if(!storageOK) return false;
  let raw; try{ raw=localStorage.getItem(LS_CFG); }catch(e){ return false; }
  if(!raw) return false;
  try{
    const d=JSON.parse(raw);
    const sameModel=d.econVersion===Economy.version();
    let saved=d.cfg||{};
    if(!sameModel){
      saved=Object.assign({},saved);
      Economy.OWNED_CFG_KEYS.forEach(k=>{ delete saved[k]; });
    }
    // merge onto the CURRENT cfg, not DEFAULTS: Economy.apply() has already run and its
    // projection is what a dropped key should fall back to
    cfg=Object.assign({},DEFAULTS,cfg,saved);
    if(sameModel){
      if(Array.isArray(d.deck)&&d.deck.length) deck=d.deck;
      if(Array.isArray(d.boxTable)&&d.boxTable.length) boxTable=d.boxTable;
    }
    return true;
  }catch(e){ return false; }
}
function clearConfig(){ if(!storageOK) return; try{ localStorage.removeItem(LS_CFG); }catch(e){} }

/* ---------------- player slot ---------------- */
/* Explicit field list: transient bits (animating, tween baselines) are never persisted. */
function serializeState(){
  return {v:1,
    day:state.day, clock:state.clock, sessionsToday:state.sessionsToday,
    energy:state.energy, coins:state.coins, clues:state.clues, cycleClues:state.cycleClues, vip:state.vip,
    pos:state.pos, mult:state.mult, boardNum:state.boardNum, series:state.series,
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
    /* The series index is restored before the builder array, because cfg.buildings depends on
       it: a save from a longer content library must not leave the run pointing at a series
       that no longer has episodes. */
    const playable=Economy.playableSeries().length;
    if(!(state.series>=0&&state.series<playable)) state.series=0;
    Economy.apply();
    state.builder=Array.isArray(d.builder)&&d.builder.length
      ? d.builder.map(b=>({tier:Math.min(Math.max(0,b.tier|0),Builders.maxTier())}))
      : Builders.fresh();
    if(state.builder.length!==Builders.count()) Builders.reshape();
    state.boxes=new Set(Array.isArray(d.boxes)?d.boxes:[]);
    // queue holds episode ids; drop anything unknown (e.g. saves from when it held titles)
    const rawQueue=Array.isArray(d.epQueue)?d.epQueue:[];
    state.epQueue=rawQueue.filter(x=>Episodes.has(x));
    // keep "unlocked" consistent with what survived, so the series bar doesn't
    // count episodes that no longer exist
    state.epUnlockedCount=Math.max(0,state.epUnlockedCount-(rawQueue.length-state.epQueue.length));
    // no cap clamp on restore — purchased energy may legitimately exceed cfg.energyCap
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
