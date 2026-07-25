"use strict";
/* Builder / series system — the game's coin sink and its episode-unlock engine.

   Owns the cost curve, the upgrade transaction, and series-completion detection.
   No DOM access: upgrade() mutates state and returns a result object that the UI
   announces (see uiUpgrade in js/ui/main.js). Rendering of the skyline and the
   builder list lives in js/ui/render.js and only reads through this API.

   Model: cfg.buildings builders, each with cfg.tiers levels. Every level bought
   unlocks one story episode, so a full series is buildings × tiers episodes and
   maxing every builder ends the series. */
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
     Cost rises with the level being bought (tierGrowth) and with the builder's
     index (bldgGrowth), so later builders are pricier at every level. */
  cost(bIdx,tier){
    return cfg.baseCost*Math.pow(cfg.tierGrowth,tier)*Math.pow(cfg.bldgGrowth,bIdx)*cfg.boardScale;
  },
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

  /* ---------- series / episodes ---------- */
  totalEpisodes(){ return cfg.buildings*cfg.tiers; },
  unlockedEpisodes(){ return Math.min(state.epUnlockedCount,this.totalEpisodes()); },
  /* Queue the next episode title (titles cycle through EP_TITLES).
     The prediction flow in js/ui/overlays.js consumes the queue. */
  unlockEpisode(){
    const title=EP_TITLES[state.epUnlockedCount%EP_TITLES.length];
    state.epUnlockedCount++; state.epQueue.push(title);
    return title;
  },

  /* ---------- transaction ---------- */
  /* Buy one level on builder bIdx. Returns null if not allowed (maxed, too poor,
     series over, mid-animation), else what the UI should announce. */
  upgrade(bIdx){
    if(state.seriesDone||state.animating) return null;
    const b=state.builder[bIdx]; if(!b||b.tier>=cfg.tiers) return null;
    const cost=this.cost(bIdx,b.tier); if(state.coins<cost) return null;
    state.coins-=cost; b.tier++;
    const spawned=OVERLAY_TYPES.mysteryBox.spawn(cfg.boxesPerUpgrade);
    const title=this.unlockEpisode();
    const seriesDone=this.allMaxed();
    if(seriesDone) state.seriesDone=true;
    return {cost, level:b.tier, title, builderDone:this.isMaxed(bIdx), seriesDone, spawned};
  },
};
