"use strict";
/* Overlay base class + registry.

   An overlay sits ON TOP of whatever tile it occupies, so it can't be a tile type
   (a board index has exactly one type, but may also carry overlays). Overlays resolve
   BEFORE the tile's own onLand(), and are consumed when collected.

   Each overlay owns a Set of board indices on `state`, named by stateKey — add that Set
   to initState() in js/state.js and to serializeState() in js/storage.js so it persists.

   Contract for subclasses:
     get stateKey()  → name of the Set on `state` holding occupied tile indices  (required)
     get icon()      → emoji drawn on the tile
     get cssClass()  → extra class on the marker element (styling lives in css/board.css)
     eligible(i)     → may an overlay be placed on tile i? (default: any tile)
     onLand(i)       → returns one playback event, an ARRAY of events, or null. Called after
                       the overlay has already been removed from the board by consume().
                       An event carries at most one float and one log, so an overlay that
                       pays out twice (the two-item mystery box) has to return two events
                       rather than trying to cram both rewards into one.
   Rewards/presentation helpers are inherited from BoardActor (js/board-actor.js). */
class Overlay extends BoardActor {
  constructor(name){ super(); this.name=name; }
  get stateKey(){ throw new Error("Overlay subclass must define stateKey"); }
  get icon(){ return "❓"; }
  get cssClass(){ return ""; }
  eligible(i){ return true; }
  onLand(i){ return null; }

  /* ---- shared placement/query logic ----
     The occupied tiles are a MAP, not a Set: an overlay may need to remember something about
     each tile it sits on, and the mystery box does — it decides what is inside when it is
     PLACED, so the board can show a gold box on a tile holding clues before the player gets
     there. Overlays that carry nothing just store null and behave exactly as before. */
  positions(){ return state[this.stateKey]; }
  has(i){ return this.positions().has(i); }
  all(){ return [...this.positions().keys()]; }
  dataAt(i){ return this.positions().get(i); }
  clear(){ this.positions().clear(); }
  /* What to remember about a tile when placing on it. Called once, at spawn. */
  roll(i){ return null; }
  /* Extra CSS class for this tile's marker (legacy board), so one overlay can have variants. */
  classAt(i){ return this.cssClass; }
  /* Place up to n overlays on random free eligible tiles. Returns the indices used. */
  spawn(n){
    const pos=this.positions(), free=[];
    for(let i=0;i<40;i++) if(this.eligible(i)&&!pos.has(i)) free.push(i);
    const out=[];
    for(let k=0;k<n&&free.length;k++){
      const t=free.splice(Math.floor(rand(0,free.length)),1)[0];
      pos.set(t,this.roll(t)); out.push(t);
    }
    return out;
  }
  /* Remove from the board and resolve. Returns the playback event, an array of them, or null.
     Whatever roll() stored is handed to onLand — read it BEFORE the delete. */
  consume(i){ const d=this.positions().get(i); this.positions().delete(i); return this.onLand(i,d); }
}
const OVERLAY_TYPES={};
const OVERLAYS=[];
function registerOverlay(name,cls){
  const inst=new cls(name);
  OVERLAY_TYPES[name]=inst; OVERLAYS.push(inst);
}
