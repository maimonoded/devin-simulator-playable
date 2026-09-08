"use strict";
/* Episode registry — content lives in episodes/NNN.js, one file per episode.
   Each of those files calls Episodes.add({...}) with a plain JSON-shaped object, so the
   content is data, not code (see episodes/README.md for the schema).

   The id is the whole identity: "003" is the third episode of the story and its video is
   episodes/003.mp4. Nothing else in the object repeats that. It is also what decides which SET
   an episode belongs to — js/collection.js slices Episodes.ids() by cfg.episodesPerBoard — so
   the order of these files IS the order of the drama. */
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
  /* "003" → 3 (its 1-based place in the story). */
  numberOf(id){ return parseInt(id,10); },
  /* Video path for an episode — always the id with an .mp4 extension. */
  videoFor(id){ return `episodes/${id}.mp4`; },
  /* Episode for a 0-based position in the story. A position past the available files cycles
     back through them, so nothing that counts episodes can run off the end. */
  idForIndex(i){
    const ids=this.ids(); if(!ids.length) return null;
    const want=String(i+1).padStart(3,"0");
    return this.has(want)?want:ids[i%ids.length];
  },
  titleOf(id){ const e=this.get(id); return e?e.title:id; },
};
