"use strict";
/* Persistence — the economy model, tuning config and player progress are saved to localStorage
   so all three survive a reload. Three independent slots:
     pmdrama.econ.v1   → the imported economy model   (Reset economy / re-import)
     pmdrama.cfg.v1    → cfg + the box tables         (Reset config)
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
  try{ localStorage.setItem(LS_CFG,JSON.stringify({v:2,econVersion:Economy.version(),cfg,deck,boxTable,boxTiers,deckBoxes})); }catch(e){ storageOK=false; }
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
    /* The box tables are NOT economy-owned — no workbook describes them yet — so they survive
       a model change the way the camera settings do. Guarded on shape rather than trusted: a
       tier list from an older build that is missing a tier would leave the store with a button
       that opens nothing. */
    if(Array.isArray(d.boxTiers)&&d.boxTiers.length===boxTiers.length
       && d.boxTiers.every(t=>t&&Array.isArray(t.table)&&t.table.length)) boxTiers=d.boxTiers;
    if(Array.isArray(d.deckBoxes)&&d.deckBoxes.length===deckBoxes.length) deckBoxes=d.deckBoxes;
    return true;
  }catch(e){ return false; }
}
function clearConfig(){ if(!storageOK) return; try{ localStorage.removeItem(LS_CFG); }catch(e){} }

/* ---------------- player slot ---------------- */
/* Explicit field list: transient bits (animating, tween baselines) are never persisted. */
function serializeState(){
  return {v:2,
    day:state.day, clock:state.clock, sessionsToday:state.sessionsToday,
    energy:state.energy, coins:state.coins, clues:state.clues, clueDay:state.clueDay, vip:state.vip,
    pos:state.pos, mult:state.mult, boardNum:state.boardNum, series:state.series, season:state.season,
    /* The collection, the finished sets and the shelf. All plain objects keyed by id, so they
       serialise as they stand — no Map to spread, and a card or item the content no longer
       defines simply sits there harmlessly until it is defined again. */
    cards:state.cards, setsDone:state.setsDone, status:state.status,
    seasonFrom:state.seasonFrom, seasonsDone:state.seasonsDone, statusMilestones:state.statusMilestones,
    trophies:state.trophies, insiderBought:state.insiderBought,
    epQueue:[...state.epQueue], epsWatched:state.epsWatched,
    pendingReveal:state.pendingReveal?{...state.pendingReveal}:null,
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
    /* The series index is restored before anything that depends on cfg.buildings: a save from
       a longer content library must not leave the run pointing at a series that no longer has
       episodes. */
    const playable=Economy.playableSeries().length;
    if(!(state.series>=0&&state.series<playable)) state.series=0;
    Economy.apply();
    /* THE COLLECTION. Sanitised rather than trusted: a board key has to be a positive integer
       a count has to be a positive integer, but the card IDS are deliberately NOT filtered
       against the current catalogue. A Season's cards are authored data that can be rewritten
       between versions, and throwing away a card because this build has not heard of it would
       quietly delete a collection. An unknown id is invisible in the collection (Cards.get
       returns null for it) and comes back the moment the content does. */
    state.cards={};
    const rawCards=(d.cards&&typeof d.cards==="object")?d.cards:{};
    Object.keys(rawCards).forEach(id=>{ const c=Math.floor(+rawCards[id]||0); if(c>0) state.cards[id]=c; });
    /* Finished sets: only keys this build's catalogue still defines. Unlike a card, a set that
       no longer exists is a bonus nothing can explain and a row the collection cannot draw. */
    state.setsDone={};
    const rawSets=(d.setsDone&&typeof d.setsDone==="object")?d.setsDone:{};
    Object.keys(rawSets).forEach(k=>{ if(Cards.setOf(k)) state.setsDone[k]=Math.max(1,Math.floor(+rawSets[k]||1)); });
    /* THE EVIDENCE. Sanitised the same way and for the same reason as the albums: the episode
       keys are checked but the CLUE IDS are not, because an episode's clue list is authored
       content that can be rewritten, and dropping a clue this build has not heard of would
       silently re-lock an episode the player had already bought.

       A save from before clues were per-episode has a NUMBER here. There is no honest way to
       spread a total across episodes, so it is dropped — better an obvious reset than an
       invented set of holdings that unlocks the wrong thing. */
    state.clues={}; state.clueDay={};
    const rawClues=(d.clues&&typeof d.clues==="object")?d.clues:{};
    Object.keys(rawClues).forEach(id=>{
      const held=Array.isArray(rawClues[id])?rawClues[id]:[];
      const out=[]; held.forEach(c=>{ if(typeof c==="string"&&c&&!out.includes(c)) out.push(c); });
      if(out.length) state.clues[id]=out;
    });
    const rawDay=(d.clueDay&&typeof d.clueDay==="object")?d.clueDay:{};
    Object.keys(state.clues).forEach(id=>{
      const day=Math.floor(+rawDay[id]);
      state.clueDay[id]=day>=1?day:1;
    });
    /* Clamped to a Season that actually exists: a save from a build with more Seasons than
       this one would otherwise leave the board empty and every tile undefined. */
    state.season=Math.min(Math.max(0,Math.floor(+d.season||0)),BOARD_SEASONS.length-1);
    state.boardNum=Math.max(1,Math.floor(+d.boardNum||1));
    /* THE SEASON BASELINE and the milestones already paid. The baseline is clamped at zero and
       the milestone keys are checked against this build's list — a milestone that no longer
       exists is a payment nothing can explain, and leaving it in would only suppress a real one
       if the levels were ever renumbered. */
    state.seasonFrom=Math.max(0,Math.floor(+d.seasonFrom||0));
    state.seasonsDone=Math.max(0,Math.floor(+d.seasonsDone||0));
    state.statusMilestones={};
    const rawMs=(d.statusMilestones&&typeof d.statusMilestones==="object")?d.statusMilestones:{};
    Object.keys(rawMs).forEach(k=>{
      if(STATUS_MILESTONES.some(m=>String(m.level)===String(k)))
        state.statusMilestones[String(k)]=Math.max(1,Math.floor(+rawMs[k]||1));
    });
    /* THE TROPHIES. Only episodes this build has files for — unlike a card, a trophy for an
       episode that does not exist is a Showcase row with no title to print on it. */
    state.trophies={};
    const rawT=(d.trophies&&typeof d.trophies==="object")?d.trophies:{};
    Object.keys(rawT).forEach(id=>{ if(Episodes.has(id)) state.trophies[id]=Math.max(1,Math.floor(+rawT[id]||1)); });
    /* THE SHELF. Only items this build defines — unlike a card, a status item that no longer
       exists is worth points nothing can explain, and the profile has nowhere to draw it. */
    state.status={};
    const rawStatus=(d.status&&typeof d.status==="object")?d.status:{};
    Object.keys(rawStatus).forEach(id=>{
      if(!Status.item(id)) return;
      const e=rawStatus[id]||{};
      state.status[id]={day:Math.max(1,Math.floor(+e.day||1)),
                        how:["bought","earned","found"].includes(e.how)?e.how:"earned"};
    });
    // queue holds episode ids; drop anything unknown (e.g. saves from when it held titles)
    const rawQueue=Array.isArray(d.epQueue)?d.epQueue:[];
    /* The queue is what is UNLOCKED AND UNWATCHED, so it can only ever hold episodes that are
       currently unlocked — an invariant worth enforcing here rather than trusting, because two
       things can break it between saves: raising cfg.cluesPerEpisode in the drawer, and a save
       written when episodes were unlocked by cards. Leaving a stale id in would offer a
       "Predict & watch" for an episode the player has not actually bought. */
    const unlocked=Clues.unlockedIds();
    state.epQueue=rawQueue.filter(x=>Episodes.has(x)&&unlocked.includes(x));
    /* A sealed reveal is only worth restoring if its episode still exists and it still carries
       a decided outcome — anything else would leave the player stuck being told to finish an
       episode that cannot play. */
    const pr=d.pendingReveal;
    state.pendingReveal=(pr&&typeof pr==="object"&&Episodes.has(pr.id)&&typeof pr.won==="boolean")
      ? {id:pr.id,wager:+pr.wager||0,odds:+pr.odds||1,won:!!pr.won,payout:+pr.payout||0,
         /* The reward was banked when the bet was locked, so it rides along and is announced
            when the reveal finally plays — a trophy arriving with no explanation is worse than
            one arriving late. */
         cardId:typeof pr.cardId==="string"?pr.cardId:null, trophy:!!pr.trophy}
      : null;
    /* Nothing to restore for the library: Collection.unlockedEpisodeIds() derives it from the
       evidence restored above. That is what makes an OLD save work — a run with four episodes
       unlocked and three of them watched still shows four, where a stored list would have
       needed migrating and a fallback to the queue showed only the one unwatched. */
    // no cap clamp on restore — purchased energy may legitimately exceed cfg.energyCap
    state.animating=false;
    // tween baselines start where we left off, so the HUD doesn't count up from zero
    state.lastCoins=state.coins; state.lastEnergy=state.energy;
    state.lastCards=Cards.owned(); state.lastStatus=Status.points();
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
