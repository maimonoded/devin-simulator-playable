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
      /* The saved tables are filtered on the way back in, exactly as Economy.apply() filters the
         model's. The economy version has NOT changed — clues were removed from the game, not
         from the workbook — so a config saved before that change comes back carrying a clue row
         in the box table and a dead `clues` field on every card. Without this, a returning
         player's boxes would still draw a payout the game has no concept of. */
      if(Array.isArray(d.deck)&&d.deck.length)
        deck=d.deck.map(c=>{ const card=Object.assign({},c); delete card.clues; return card; });
      if(Array.isArray(d.boxTable)&&d.boxTable.length){
        const rows=d.boxTable.filter(r=>r.kind!=="clues");
        // never filter down to nothing: weighted() on an empty table draws nothing at all
        if(rows.length) boxTable=rows;
      }
    }
    return true;
  }catch(e){ return false; }
}
function clearConfig(){ if(!storageOK) return; try{ localStorage.removeItem(LS_CFG); }catch(e){} }

/* ---------------- player slot ---------------- */
/* Explicit field list: transient bits (animating, tween baselines) are never persisted. */
function serializeState(){
  return {v:2,
    day:state.day, clock:state.clock, sessionsToday:state.sessionsToday,
    energy:state.energy, coins:state.coins, vip:state.vip,
    pos:state.pos, mult:state.mult, boardNum:state.boardNum,
    /* [tile, contents] pairs — the contents were decided when the box was placed, so they have
       to survive a reload or a box would reopen as something else. */
    boxes:[...state.boxes], pendingBoxes:state.pendingBoxes,
    rolls:state.rolls,
    /* The unlock ledger — see js/state.js. Everything else about an unlock is derived, so these
       three fields are the entire save: what is owned, what has been paid, what has been seen. */
    items:Object.assign({},state.items), paid:Object.assign({},state.paid),
    watched:[...state.watched],
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
    /* A v1 save carries builders, clues, an episode queue and a sealed prediction. None of
       those exist any more, and the loop above only copies keys serializeState() still names,
       so they are simply dropped — an old run comes back as its coins, day, position and
       boxes. Nothing has to migrate. */
    /* Saves from before contents were decided at spawn stored bare tile indices. Accept both:
       a number becomes a box with nothing known about it, and onLand draws for it then — which
       is exactly what the old code did. */
    state.boxes=new Map((Array.isArray(d.boxes)?d.boxes:[])
      .map(e=>Array.isArray(e)?[e[0],e[1]]:[e,null])
      .filter(([i])=>Number.isInteger(i)&&i>=0&&i<40));
    /* Boxes earned but never thrown survive a reload — they are paid for, so losing them would
       be losing a reward. They land on the next return to the board (deliverBoxes). */
    state.pendingBoxes=Math.max(0,Math.floor(+d.pendingBoxes||0));
    /* The unlock ledger is checked against the catalog on the way in, the way the episode queue
       used to drop ids it did not recognise. Content is a set of hand-edited data files that can
       change between two runs, and an item or a paid step whose id has gone is a number nothing
       can ever spend, show or finish. A count is clamped to the price it belongs to as well — a
       price that LOST a step must not leave a target paid past its own end. */
    state.items={};
    Object.keys(d.items||{}).forEach(id=>{
      const n=Math.floor(+d.items[id]||0);
      if(n>0&&Catalog.getItem(id)) state.items[id]=n;
    });
    state.paid={};
    Object.keys(d.paid||{}).forEach(key=>{
      const at=key.indexOf(":"); if(at<0) return;
      const t=Catalog.target(key.slice(0,at),key.slice(at+1));
      if(!t) return;
      const n=Math.min(t.price.length,Math.floor(+d.paid[key]||0));
      if(n>0) state.paid[key]=n;
    });
    state.watched=(Array.isArray(d.watched)?d.watched:[])
      .filter((id,i,a)=>Catalog.getEpisode(id)&&a.indexOf(id)===i);
    // no cap clamp on restore — purchased energy may legitimately exceed cfg.energyCap
    state.animating=false;
    // tween baselines start where we left off, so the HUD doesn't count up from zero
    state.lastCoins=state.coins; state.lastEnergy=state.energy;
    return true;
  }catch(e){ return false; }
}
function clearState(){ if(!storageOK) return; try{ localStorage.removeItem(LS_STATE); }catch(e){} }

/* ---------------- debounced autosave ---------------- */
let _cfgT=null,_stateT=null;
function scheduleSaveConfig(){ if(!storageOK) return; clearTimeout(_cfgT); _cfgT=setTimeout(saveConfig,300); }
function scheduleSaveState(){ if(!storageOK) return; clearTimeout(_stateT); _stateT=setTimeout(saveState,300); }
/* Flush pending writes if the tab goes away mid-animation. */
/* Reset-then-reload has to stop this handler putting the run straight back: clearState()
   empties the slot, then unload would immediately re-save the still-live in-memory state and
   the reset would appear to do nothing. */
let _skipUnloadSave=false;
function suppressUnloadSave(){ _skipUnloadSave=true; }
window.addEventListener("beforeunload",()=>{
  if(!storageOK||_skipUnloadSave) return;
  clearTimeout(_cfgT); clearTimeout(_stateT); saveConfig(); saveState();
});
