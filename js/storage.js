"use strict";
/* Persistence — the economy model, tuning config and player progress are saved to localStorage
   so all three survive a reload. Three independent slots:
     pmdrama.econ.v3   → the imported economy model   (Reset economy / re-import)
     pmdrama.cfg.v3    → cfg + twistDeck + boxTable   (Reset config)
     pmdrama.state.v3  → run progress                 (Reset user)
   There is no server yet, so the browser IS the database: an imported workbook lives only
   here, which is why the slot keeps the version string and the filename it came from.
   Writes are debounced; every call is guarded so a blocked/full localStorage
   (private mode, some file:// setups) degrades to "just don't persist". */

/* ALL THREE SLOTS ARE v3, and each also refuses a payload whose own `v` is not 3.

   v3 is the suited deck: a saved shoe used to be bare integers and is now "s7"/"J1" strings, so
   a v2 payload's cards would every one of them fail Shoe.isLegal and be filtered away, leaving a
   run with an empty shoe rather than an error. The slot name moves with the card vocabulary.


   Belt AND braces, deliberately. The rework replaced dice with a card shoe, energy with cards
   and builders with tickets, so a v1 save describes a game that no longer exists. The danger is
   not that it fails to load — it is that it loads PARTLY: loadState()'s copy loop walks
   Object.keys(serializeState()) and silently ignores saved keys that are gone, so a v1 save
   would restore coins, day, clock, clues, vip, position, boxes and every streak counter and
   leave a run with an empty shoe, no tickets and a board position inherited from a dice game.
   Nothing would throw and nothing would log. A new slot name means the old payload is never
   found; the `v` check means a hand-edited or half-migrated one is refused rather than merged. */
const LS_ECON="pmdrama.econ.v3";
const LS_CFG="pmdrama.cfg.v3";
const LS_STATE="pmdrama.state.v3";
const SLOT_V=3;

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
  try{ localStorage.setItem(LS_ECON,JSON.stringify({v:SLOT_V,economy:e})); }catch(err){ storageOK=false; }
}
/* Restore an imported model. Returns the version string restored, or null. */
function loadEconomy(){
  if(!storageOK) return null;
  let raw; try{ raw=localStorage.getItem(LS_ECON); }catch(e){ return null; }
  if(!raw) return null;
  try{
    const d=JSON.parse(raw);
    if(!d||d.v!==SLOT_V||!d.economy||!d.economy.version) return null;
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
  try{ localStorage.setItem(LS_CFG,JSON.stringify({v:SLOT_V,econVersion:Economy.version(),cfg,plotTwist:twistDeck,boxTable})); }catch(e){ storageOK=false; }
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
    /* A pre-rework config would re-introduce every dead key (energyCap, the whole dice group)
       into cfg through the merge below, where nothing reads them and the drawer would still
       list any that kept a TUNING row. Refuse it outright. */
    if(!d||d.v!==SLOT_V) return false;
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
      if(Array.isArray(d.plotTwist)&&d.plotTwist.length) twistDeck=d.plotTwist;
      if(Array.isArray(d.boxTable)&&d.boxTable.length) boxTable=d.boxTable;
    }
    return true;
  }catch(e){ return false; }
}
function clearConfig(){ if(!storageOK) return; try{ localStorage.removeItem(LS_CFG); }catch(e){} }

/* ---------------- player slot ---------------- */
/* Explicit field list: transient bits (animating, tween baselines) are never persisted. */
function serializeState(){
  return {v:SLOT_V,
    day:state.day, clock:state.clock, sessionsToday:state.sessionsToday,
    coins:state.coins, clues:state.clues, cycleClues:state.cycleClues, vip:state.vip,
    pos:state.pos, boardNum:state.boardNum, series:state.series,
    /* The shoe is saved as CONCRETE CARDS, in order. Not a count and not a seed: a seed only
       re-derives under an identical RNG, and a count cannot express how many tickets are still
       in there — which is the invariant the whole economy rests on. packTail is the undealt
       remainder free cards are coming out of, and it has to persist for the same reason. */
    shoe:[...state.shoe], packTail:[...state.packTail], ticketsPriced:state.ticketsPriced,
    /* [tile, contents] pairs — the contents were decided when the box was placed, so they have
       to survive a reload or a gold box would reopen as something else. */
    tickets:[...state.tickets], boxes:[...state.boxes],
    pendingTickets:state.pendingTickets, pendingBoxes:state.pendingBoxes,
    epQueue:[...state.epQueue], epsWatched:state.epsWatched,
    pendingReveal:state.pendingReveal?{...state.pendingReveal}:null,
    predWins:state.predWins, predLoss:state.predLoss,
    streak:state.streak, bestStreak:state.bestStreak, pulls:state.pulls, predsMade:state.predsMade,
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
    /* BEFORE the copy loop, not after: the loop below silently ignores saved keys that no
       longer exist, so a v1 save does not fail — it half-restores into a game with different
       rules. Drop it and start clean. */
    if(d.v!==SLOT_V){ clearState(); return false; }
    Object.keys(serializeState()).forEach(k=>{ if(k!=="v"&&d[k]!==undefined) state[k]=d[k]; });
    /* THE ORDER OF THESE THREE IS LOAD-BEARING. The series index is restored and clamped first,
       then Economy.apply() sets cfg.episodesInSeries from it, and only then is the ticket row
       sized and clamped. Move the row restore earlier and it is sized against the previous
       series. A save from a longer content library must also not leave the run pointing at a
       series that no longer has episodes. */
    const playable=Economy.playableSeries().length;
    if(!(state.series>=0&&state.series<playable)) state.series=0;
    Economy.apply();
    const per=Tickets.perEpisode();
    state.tickets=Array.isArray(d.tickets)&&d.tickets.length
      ? d.tickets.map(t=>Math.min(Math.max(0,t|0),per))
      : Tickets.fresh();
    if(state.tickets.length!==Tickets.count()) Tickets.reshape();
    /* The shoe restores as concrete cards, filtered to legal values the same way epQueue is
       filtered below — a hand-edited save must not be able to put a 99 or an object in the
       shoe and have pull() hand it to the move loop. NO CAP CLAMP: a bought pack merged onto
       leftovers legitimately exceeds cfg.packSize, and trimming here would delete a purchase. */
    state.shoe=(Array.isArray(d.shoe)?d.shoe:[]).filter(c=>Shoe.isLegal(c));
    state.packTail=(Array.isArray(d.packTail)?d.packTail:[]).filter(c=>Shoe.isLegal(c));
    state.ticketsPriced=Math.max(0,Math.floor(+d.ticketsPriced||0));
    state.pendingTickets=Math.max(0,Math.floor(+d.pendingTickets||0));
    /* Saves from before contents were decided at spawn stored bare tile indices. Accept both:
       a number becomes a box with nothing known about it, and onLand draws for it then — which
       is exactly what the old code did. */
    state.boxes=new Map((Array.isArray(d.boxes)?d.boxes:[])
      .map(e=>Array.isArray(e)?[e[0],e[1]]:[e,null])
      .filter(([i])=>Number.isInteger(i)&&i>=0&&i<40));
    /* Boxes earned but never placed survive a reload — they are owed, so losing them would be
       losing a reward. They land on the next drop. */
    state.pendingBoxes=Math.max(0,Math.floor(+d.pendingBoxes||0));
    // queue holds episode ids; drop anything unknown (e.g. saves from when it held titles)
    const rawQueue=Array.isArray(d.epQueue)?d.epQueue:[];
    state.epQueue=rawQueue.filter(x=>Episodes.has(x));
    /* A sealed reveal is only worth restoring if its episode still exists and it still carries
       a decided outcome — anything else would leave the player stuck being told to finish an
       episode that cannot play. */
    const pr=d.pendingReveal;
    state.pendingReveal=(pr&&typeof pr==="object"&&Episodes.has(pr.id)&&typeof pr.won==="boolean")
      ? {id:pr.id,wager:+pr.wager||0,odds:+pr.odds||1,won:!!pr.won,payout:+pr.payout||0}
      : null;
    /* Nothing to restore for the library: Tickets.unlockedEpisodeIds() derives it from the
       placeholder counts just restored above. That is what makes a save work across a content
       change — a run that had four episodes unlocked and three of them watched still shows
       four, where a stored list would have needed migrating and a fallback to the queue showed
       only the one unwatched. Which of the row's episodes are watched is derived from epQueue
       and pendingReveal for the same reason. */
    state.animating=false;
    // tween baselines start where we left off, so the HUD doesn't count up from zero
    state.lastCoins=state.coins; state.lastClues=state.clues;
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
