"use strict";
/* Episode registry — content lives in episodes/NNN.js, one file per episode.
   Each of those files calls Episodes.add({...}) with a plain JSON-shaped object, so the
   content is data, not code (see episodes/README.md for the schema).

   The id is the whole identity: "003" is builder 3's episode and its video is
   episodes/003.mp4. Nothing else in the object repeats that. */
const Episodes={
  _byId:{},
  _ids:[],
  add(ep){
    if(!ep||!ep.id){ console.warn("Episodes.add: missing id",ep); return; }
    ep.difficulty=this.normalizeDifficulty(ep.difficulty);
    if(!this._byId[ep.id]) this._ids.push(ep.id);
    this._byId[ep.id]=ep;
  },
  /* difficulty is 1–10 (10 hardest). Missing or unusable → 1. Informational for now. */
  normalizeDifficulty(v){
    const n=typeof v==="string"?parseFloat(v):v;
    if(typeof n!=="number"||!isFinite(n)) return 1;
    return Math.min(10,Math.max(1,n));
  },
  difficultyOf(id){ const e=this.get(id); return e?e.difficulty:1; },
  get(id){ return this._byId[id]||null; },
  has(id){ return !!this._byId[id]; },
  ids(){ return this._ids.slice().sort(); },
  count(){ return this._ids.length; },
  /* "003" → 3 (its builder number, 1-based) */
  builderOf(id){ return parseInt(id,10); },
  /* Video path for an episode — always the id with an .mp4 extension. */
  videoFor(id){ return `episodes/${id}.mp4`; },
  /* Episode for a 0-based builder index. Builders beyond the available files
     cycle through them so a raised cfg.episodesInSeries still gets content. */
  idForBuilder(bIdx){
    const ids=this.ids(); if(!ids.length) return null;
    const want=String(bIdx+1).padStart(3,"0");
    return this.has(want)?want:ids[bIdx%ids.length];
  },
  titleOf(id){ const e=this.get(id); return e?e.title:id; },
};
