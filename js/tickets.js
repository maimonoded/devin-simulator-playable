"use strict";
/* Tickets — the game's progression, and what the builders used to be.

   cfg.ticketsPerEpisode tickets fill one episode placeholder; filling one unlocks one episode.
   The board shows cfg.episodeRowSize placeholders at a time (the ROW), and the row only moves
   on once every episode on it is both FULL and WATCHED. That is the pull-stop: with the row
   full the player has nothing to pull for and is sent to Predict & watch instead.

   Three rules are carried over from js/builders/builders.js unchanged, because each of them
   was load-bearing and none is obvious:

     · THE ROW IS DERIVED, NOT STORED. page() is the first row still holding unfinished work,
       computed from the ticket counts and the episode queue. A stored cursor could drift from
       the thing it was counting; a derived one cannot, and filling slots out of order can never
       skip a row.

     · EPISODES COME OFF THE FRONT OF THE STORY, whatever order slots filled in. Completing the
       third placeholder first still earns episode 001. It is a serialised drama — handing out
       episode 3 for slot 3 would spoil 1 and 2, and would break every downstream ordering rule
       (the library's NEXT tag, firstUnwatchedId, the binge chain).

     · WATCHEDNESS IS READ, NOT RECORDED. state.epQueue is what is still unwatched and
       state.pendingReveal is a bet already sealed against an episode that was never finished.
       Both are already persisted, so the row rule needs no new saved field — and a sealed bet
       must count as NOT yet watched, or ducking out mid-episode would advance the row.

   No DOM. award() mutates state and returns what the UI should announce. */
const Tickets={
  /* ---------- shape ---------- */
  count(){ return cfg.episodesInSeries; },
  perEpisode(){ return Math.max(1,Math.round(cfg.ticketsPerEpisode||1)); },
  all(){ return state.tickets; },
  fresh(){ return Array.from({length:cfg.episodesInSeries},()=>0); },
  /* Re-shape after episodesInSeries/ticketsPerEpisode change in tuning, keeping what still fits. */
  reshape(){
    const old=state.tickets||[]; state.tickets=this.fresh();
    for(let i=0;i<state.tickets.length&&i<old.length;i++)
      state.tickets[i]=Math.min(old[i]|0,this.perEpisode());
  },

  /* ---------- queries ---------- */
  held(i){ const t=state.tickets[i]; return t?t:0; },
  isFull(i){ return this.held(i)>=this.perEpisode(); },
  progress(i){ return this.perEpisode()?this.held(i)/this.perEpisode():0; },
  doneCount(){ return state.tickets.filter(t=>t>=this.perEpisode()).length; },
  allFull(){ return state.tickets.every(t=>t>=this.perEpisode()); },
  /* The episode id a slot stands for, by POSITION in the series — which is what the row rule
     asks about. Not the same question as "which episode did filling this slot unlock". */
  idAt(i){ return Episodes.idForBuilder(Economy.globalEpisodeOf(i)-1); },
  /* A slot's episode counts as watched once it has left the unwatched queue AND no sealed bet
     is still outstanding against it. */
  isWatched(i){
    const id=this.idAt(i);
    return !!id && !state.epQueue.includes(id)
                && !(state.pendingReveal&&state.pendingReveal.id===id);
  },

  /* ---------- price ----------
     Owned by js/economy.js: the same segmented curve that used to price builder levels now
     prices tickets. `held` is how many this episode already has, so the ticket being PAID for
     is held+1, and the slot index is translated to its global episode number first. */
  cost(i,held){ return Economy.costFor(Economy.globalEpisodeOf(i),held+1); },
  nextCost(i){ return this.isFull(i)?null:this.cost(i,this.held(i)); },

  /* ---------- the row ----------
     Ported from Builders.page() with ONE deliberate change: a row is finished when every
     episode on it is full AND watched, where a builder page only needed every builder maxed.
     The last row of a series is genuinely SHORT when the content runs out — three placeholders,
     not five — so nothing may assume a full row. */
  rowSize(){ return Math.max(1,Math.round(cfg.episodeRowSize||1)); },
  rowCount(){ return Math.max(1,Math.ceil(this.count()/this.rowSize())); },
  page(){
    const size=this.rowSize(), rows=this.rowCount();
    for(let p=0;p<rows;p++){
      const from=p*size, to=Math.min(from+size,this.count());
      for(let i=from;i<to;i++) if(!this.isFull(i)||!this.isWatched(i)) return p;
    }
    return rows-1;                     // everything done: hold on the last row
  },
  /* Slot indices on the current row — a short final row returns fewer than rowSize. */
  pageSlots(){
    const size=this.rowSize(), from=this.page()*size, out=[];
    for(let i=from;i<Math.min(from+size,this.count());i++) out.push(i);
    return out;
  },
  /* Every placeholder on the row is full. THIS IS THE PULL-STOP — there is nothing left to
     pull for until the row's episodes have been watched. */
  rowFull(){ return this.pageSlots().every(i=>this.isFull(i)); },

  /* ---------- series / episodes ---------- */
  totalEpisodes(){ return cfg.episodesInSeries; },
  /* How many episodes have been earned: one per full placeholder, plus every episode of the
     series already behind us (a series cannot be left until all of it is full). */
  unlockedCount(){
    let n=0;
    const cur=(state.series|0);
    Economy.seriesShape().forEach((s,i)=>{ if(i<cur) n+=s.episodes; });
    return n+this.doneCount();
  },
  /* Every episode id unlocked so far — what the library lists. DERIVED, and taken off the FRONT
     of the story rather than matched to whichever placeholder was filled. Keep the dedupe: past
     the last content file Episodes.idForBuilder cycles, so without it the library grows
     duplicate rows. */
  unlockedEpisodeIds(){
    const out=[], n=this.unlockedCount();
    for(let k=0;k<n;k++){
      const id=Episodes.idForBuilder(k);
      if(id&&Episodes.has(id)&&!out.includes(id)) out.push(id);
    }
    return out;
  },
  /* The earliest episode still unwatched, in album order. The queue fallback is load-bearing:
     it is the only way an episode queued before a series change stays reachable. */
  firstUnwatchedId(){
    for(const id of this.unlockedEpisodeIds()) if(state.epQueue.includes(id)) return id;
    return state.epQueue.length?state.epQueue[0]:null;
  },
  /* Queue the NEXT episode in the story. Called once per placeholder completed, so doneCount()
     already includes it and unlockedCount()-1 is the episode just earned. Deliberately NOT the
     slot's own episode — see the header. */
  completeEpisode(){
    const id=Episodes.idForBuilder(this.unlockedCount()-1);
    if(!id) return null;
    state.epQueue.push(id);
    return id;
  },
  series(){ return Economy.currentSeries(); },
  hasNextSeries(){ return !!Economy.nextSeries(); },
  /* Move to the next series: fresh placeholders, but the run continues — coins, day, the shoe
     and the episode queue all carry over. */
  advanceSeries(){
    const next=Economy.nextSeries();
    if(!next) return null;
    state.series=next.index;
    Economy.apply();                   // cfg.episodesInSeries becomes the new series' length
    state.tickets=this.fresh();
    state.seriesDone=false;
    this._drainPending();
    return next;
  },

  /* ---------- awarding ---------- */
  /* Put n tickets on the board, lowest unfilled placeholder on the CURRENT ROW first.

     NO state.animating GUARD, unlike Builders.upgrade(). Tickets are awarded from inside
     playEvents() while a pull is still animating, so a guard copied across from the old
     transaction would make every ticket silently do nothing.

     Tickets that arrive with the row already full are BANKED rather than spilling into the next
     row's episodes: the row is a wall the player has to watch their way through, and a ticket
     bought with real money must not quietly jump it — nor be thrown away. They land when the
     row advances. */
  award(n){
    const filled=[], episodeIds=[];
    let left=Math.max(0,Math.floor(n||0))+this._pending();
    state.pendingTickets=0;
    const per=this.perEpisode();
    while(left>0){
      const slot=this.pageSlots().find(i=>!this.isFull(i));
      if(slot==null){ state.pendingTickets=left; break; }   // row full — bank the rest
      state.tickets[slot]=Math.min(per,this.held(slot)+1);
      left--;
      filled.push(slot);
      if(this.isFull(slot)){ const id=this.completeEpisode(); if(id) episodeIds.push(id); }
    }
    const seriesDone=this.allFull();
    if(seriesDone) state.seriesDone=true;
    return {filled, episodeIds, titles:episodeIds.map(id=>Episodes.titleOf(id)),
            seriesDone, banked:state.pendingTickets|0};
  },
  /* A ticket that did NOT come out of a pack — a mystery box, a Plot Twist card, the store.

     It still walks the cost curve. Every ticket in a pack was priced when the pack was minted,
     so if free tickets did not advance the pointer too, a run would reach episode 240 having
     paid for only the fraction that happened to arrive in packs — the game would finish for
     roughly half what the model says it costs, and days-to-finish would stop meaning anything.
     Advancing here instead makes a free ticket raise the price of what remains, which is the
     same total spend by a different route.

     Named rather than a flag on award(), because the distinction is about where a ticket CAME
     FROM and that is not something award() can see. The ticket card calls award() directly:
     it came off the shoe, so Shoe.mintPack already billed it. */
  awardFree(n){
    state.ticketsPriced=(state.ticketsPriced|0)+Math.max(0,Math.floor(n||0));
    return this.award(n);
  },
  _pending(){ return Math.max(0,Math.floor(state.pendingTickets||0)); },
  /* Apply anything banked while the row was full. Safe to call at any time. */
  _drainPending(){ if(this._pending()) this.award(0); },
};
