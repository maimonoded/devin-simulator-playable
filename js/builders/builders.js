"use strict";
/* Builder / series system — the game's coin sink and its episode-unlock engine.

   Owns the cost curve, the upgrade transaction, and series-completion detection.
   No DOM access: upgrade() mutates state and returns a result object that the UI
   announces (see uiUpgrade in js/ui/main.js). Rendering of the skyline and the
   builder list lives in js/ui/render.js and only reads through this API.

   Model: cfg.buildings builders, each with cfg.tiers levels. Completing a builder
   (taking it to its last level) unlocks one story episode — intermediate levels pay
   no episode — so a full series is cfg.buildings episodes, and maxing every builder
   both unlocks the last episode and ends the series.

   A run is a sequence of SERIES (js/economy.js owns the list and its order). cfg.buildings is
   the current series' length; state.series says which one is being played. Builder indices
   here are always local to that series, and are translated to a GLOBAL builder number for the
   two things that span the whole run: the cost curve and the episode registry. So series 2's
   first builder is local 0, global 61, and unlocks episode 061. */
const Builders={
  /* ---------- shape ---------- */
  count(){ return cfg.buildings; },
  maxTier(){ return cfg.tiers; },
  all(){ return state.builder; },
  fresh(){ return Array.from({length:cfg.buildings},()=>({tier:0})); },
  /* Re-shape after buildings/tiers change in tuning, keeping progress where it still fits. */
  reshape(){
    const old=state.builder; state.builder=this.fresh();
    for(let i=0;i<state.builder.length&&i<old.length;i++)
      state.builder[i].tier=Math.min(old[i].tier,cfg.tiers);
  },

  /* ---------- queries ---------- */
  tier(i){ const b=state.builder[i]; return b?b.tier:0; },
  isMaxed(i){ return this.tier(i)>=cfg.tiers; },
  progress(i){ return cfg.tiers?this.tier(i)/cfg.tiers:0; },
  doneCount(){ return state.builder.filter(b=>b.tier>=cfg.tiers).length; },
  allMaxed(){ return state.builder.every(b=>b.tier>=cfg.tiers); },

  /* ---------- cost curve ----------
     Owned by js/economy.js, which holds a segmented curve rather than one formula — see the
     header there. `tier` is the 0-based level already bought, so the level being PAID for is
     tier+1, and the builder index is translated to its global number first. */
  cost(bIdx,tier){ return Economy.costFor(Economy.globalOf(bIdx),tier+1); },
  /* Price of this builder's next level, or null when it's maxed. */
  nextCost(bIdx){ return this.isMaxed(bIdx)?null:this.cost(bIdx,this.tier(bIdx)); },
  canAfford(bIdx){ const c=this.nextCost(bIdx); return c!=null&&state.coins>=c; },
  /* Cheapest available upgrade across all builders — used by auto-play. */
  cheapest(){
    let best=null;
    state.builder.forEach((b,i)=>{
      const c=this.nextCost(i);
      if(c!=null&&(best==null||c<best.cost)) best={b:i,tier:b.tier,cost:c};
    });
    return best;
  },

  /* ---------- paging ----------
     The builders view shows cfg.builderPageSize buildings at a time and only moves on once
     every building on the page is maxed. The page is therefore DERIVED — it is the first page
     that still has work in it, not a cursor the player moves. That means completing builders
     out of order can never skip a page, and nothing has to be persisted: the tiers already say
     where you are. The last page carries the remainder when the count does not divide evenly. */
  pageSize(){ return Math.max(1,Math.round(cfg.builderPageSize||1)); },
  pageCount(){ return Math.max(1,Math.ceil(this.count()/this.pageSize())); },
  page(){
    const size=this.pageSize(), pages=this.pageCount();
    for(let p=0;p<pages;p++){
      const from=p*size, to=Math.min(from+size,this.count());
      for(let i=from;i<to;i++) if(!this.isMaxed(i)) return p;
    }
    return pages-1;                    // everything maxed: hold on the last page
  },
  /* Builder indices on the current page — a short final page returns fewer than pageSize. */
  pageBuilders(){
    const size=this.pageSize(), from=this.page()*size;
    const out=[];
    for(let i=from;i<Math.min(from+size,this.count());i++) out.push(i);
    return out;
  },

  /* ---------- series / episodes ----------
     One episode per completed builder, so the series length is the builder count. */
  totalEpisodes(){ return cfg.buildings; },
  unlockedEpisodes(){ return Math.min(state.epUnlockedCount,this.totalEpisodes()); },
  /* Queue this builder's episode. Content lives in episodes/NNN.js, keyed by the GLOBAL
     builder number — series 2's first builder is global 61, so it unlocks "061".
     The queue holds ids; the prediction flow in js/ui/prediction.js looks them up. */
  unlockEpisode(bIdx){
    const id=Episodes.idForBuilder(Economy.globalOf(bIdx)-1);
    if(!id) return null;
    state.epUnlockedCount++; state.epQueue.push(id);
    return id;
  },
  /* Which series the run is in, and whether another one has content waiting. */
  series(){ return Economy.currentSeries(); },
  hasNextSeries(){ return !!Economy.nextSeries(); },
  /* Move to the next series: a fresh set of builders, but the run continues — coins, day,
     energy and the episode queue all carry over. Returns the series entered, or null when
     there is no more content. Finishing the last one leaves seriesDone set, which is what
     the finale reads. */
  advanceSeries(){
    const next=Economy.nextSeries();
    if(!next) return null;
    state.series=next.index;
    Economy.apply();                 // cfg.buildings becomes the new series' length
    state.builder=this.fresh();
    state.epUnlockedCount=0;
    state.seriesDone=false;
    return next;
  },

  /* ---------- transaction ---------- */
  /* Buy one level on builder bIdx. Returns null if not allowed (maxed, too poor,
     series over, mid-animation), else what the UI should announce.
     `title` is the unlocked episode — only set on the level that completes the
     builder, and null on every intermediate level. */
  upgrade(bIdx){
    if(state.seriesDone||state.animating) return null;
    const b=state.builder[bIdx]; if(!b||b.tier>=cfg.tiers) return null;
    const cost=this.cost(bIdx,b.tier); if(state.coins<cost) return null;
    state.coins-=cost; b.tier++;
    const spawned=OVERLAY_TYPES.mysteryBox.spawn(cfg.boxesPerUpgrade);
    const builderDone=this.isMaxed(bIdx);
    const episodeId=builderDone?this.unlockEpisode(bIdx):null;
    const seriesDone=this.allMaxed();
    if(seriesDone) state.seriesDone=true;
    return {cost, level:b.tier, episodeId, title:episodeId?Episodes.titleOf(episodeId):null,
            builderDone, seriesDone, spawned};
  },
};
