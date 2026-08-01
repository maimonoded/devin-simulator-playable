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
  /* One episode per completed builder, so this IS the completed-builder count. It used to be a
     separate counter on state, which could only ever drift from the thing it was counting. */
  unlockedEpisodes(){ return Math.min(this.doneCount(),this.totalEpisodes()); },

  /* How many episodes have been earned: one per completed builder, plus every builder of the
     series already behind us (a series cannot be left until all of it is maxed). */
  unlockedCount(){
    let n=0;
    const cur=(state.series|0);
    Economy.seriesShape().forEach((s,i)=>{ if(i<cur) n+=s.builders; });
    return n+this.doneCount();
  },

  /* Every episode id unlocked so far — what the library lists.

     DERIVED, not stored, and taken off the FRONT of the story rather than matched to whichever
     builder was completed. Builders can be finished in any order; the episodes are one
     serialised drama, so finishing builder 3 first still earns episode 1. What a builder
     completion buys is "the next episode", not "its own episode".

     That means the unlocked set is always a prefix of the library, which is also what makes
     the ordering rule in firstUnwatchedId meaningful. */
  unlockedEpisodeIds(){
    const out=[], n=this.unlockedCount();
    for(let k=0;k<n;k++){
      const id=Episodes.idForBuilder(k);
      if(id&&Episodes.has(id)&&!out.includes(id)) out.push(id);
    }
    return out;
  },
  /* The earliest episode still unwatched, in album order.

     A first viewing always starts here, whichever row the player actually tapped in the
     library: the episodes are one serialised story, so watching 5 before 4 spoils 4. Rewatching
     is unrestricted — the constraint is only about seeing something for the first time.

     Album order, not queue order: state.epQueue is push-order of unlocks, which diverges from
     episode number as soon as builders are completed out of order. Falls back to the queue's
     front so a queued episode from a previous series is still reachable. */
  firstUnwatchedId(){
    for(const id of this.unlockedEpisodeIds()) if(state.epQueue.includes(id)) return id;
    return state.epQueue.length?state.epQueue[0]:null;
  },

  /* Queue the NEXT episode in the story. Called from upgrade() once a builder is maxed, so
     doneCount() already includes it and unlockedCount()-1 is the episode just earned.

     Deliberately NOT this builder's own episode: builders are bought in whatever order the
     player can afford, and a serialised drama watched out of order spoils itself. Completing
     builder 3 before 1 and 2 still earns episode 1.
     The queue holds ids; the prediction flow in js/ui/prediction.js looks them up. */
  unlockEpisode(){
    const id=Episodes.idForBuilder(this.unlockedCount()-1);
    if(!id) return null;
    /* Only the UNWATCHED queue is recorded. Which episodes exist at all is derived from the
       builders — see unlockedEpisodeIds(). */
    state.epQueue.push(id);
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
    const episodeId=builderDone?this.unlockEpisode():null;
    const seriesDone=this.allMaxed();
    if(seriesDone) state.seriesDone=true;
    return {cost, level:b.tier, episodeId, title:episodeId?Episodes.titleOf(episodeId):null,
            builderDone, seriesDone, spawned};
  },
};
