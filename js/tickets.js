"use strict";
/* Tickets — the game's progression, and what the builders used to be.

   cfg.ticketsPerEpisode tickets fill one episode placeholder; filling one unlocks one episode.
   The board shows cfg.episodeRowSize placeholders at a time (the ROW), and the row only moves
   on once every episode on it is both FULL and WATCHED. That is the pull-stop: with the row
   full the player has nothing to pull for and is sent to Predict & watch instead.

   ONE EPISODE PER JOKER, AND THAT IS WHAT MAKES THE ROW. There is a lead for each placeholder —
   Shoe.JOKERS — and a pulled joker fills ITS OWN slot, so all of the row's collections grow at
   once instead of one filling before the next begins. rowSize() therefore DERIVES from
   Shoe.jokerTypes(); there is no cfg.episodeRowSize any more, because two numbers saying how many
   episodes are on a row can disagree and one of them would win silently.

   Three rules carried over from js/builders/builders.js, and the third had to change:

     · THE ROW IS DERIVED, NOT STORED. page() is the first row still holding unfinished work,
       computed from the ticket counts and the episode queue. A stored cursor could drift from
       the thing it was counting; a derived one cannot, and filling slots out of order can never
       skip a row.

     · WATCHEDNESS IS READ, NOT RECORDED. state.epQueue is what is still unwatched and
       state.pendingReveal is a bet already sealed against an episode that was never finished.
       Both are already persisted, so the row rule needs no new saved field — and a sealed bet
       must count as NOT yet watched, or ducking out mid-episode would advance the row.

     · A SLOT NOW IS ITS EPISODE. It used to be that episodes came off the FRONT of the story
       whatever order slots filled in — completing the third placeholder still earned episode 001
       — because slots only ever filled left to right, so "front of the story" and "this slot's
       episode" were the same answer and the cheaper one was taken.

       Type routing makes filling out of order the NORMAL case, and the two answers come apart.
       Keeping the old rule breaks isWatched() SILENTLY: it asks whether idAt(i) has left the
       queue, and an episode that was never queued has trivially left it, so a slot completed out
       of order would read as watched and page() would advance the row over content nobody saw.
       So completeEpisode(i) queues the episode the slot STANDS FOR, and the ordering that used to
       be a happy accident is now an explicit gate — see watchableAt(). The label on the
       placeholder and the episode behind it are the same thing again, which is also the only way
       a row of four parallel collections can be honest about what it is collecting.

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
    /* The BANK is reshaped too. reshape() runs on every drawer edit and on loadState, so leaving
       it alone means a designer nudging episodesInSeries silently wipes banked tickets — and one
       of the ticket sources is a real-money purchase. Types that no longer have a slot (the cast
       shrank) fall back into the wildcard pot rather than being dropped on the floor. */
    const b=this._bank(), keep={wild:b.wild|0};
    for(let k=0;k<this.rowSize();k++) if(b[k]) keep[k]=b[k]|0;
    for(const k in b) if(k!=="wild"&&+k>=this.rowSize()) keep.wild+=b[k]|0;
    state.ticketBank=keep;
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
  /* A slot's episode counts as watched once it has left the unwatched queue AND no sealed bet is
     still outstanding against it.

     THE isFull() GUARD IS THE FIX FOR THE SILENT ONE. Without it an episode that was never
     unlocked at all satisfies "not in the queue" trivially, so an unfilled slot reads as watched
     and page() walks the row forward over content the player has never seen. That was unreachable
     while slots filled left to right; under type routing slot 3 completing first makes it the
     ordinary case. An empty slot is not watched — it has nothing to watch. */
  isWatched(i){
    if(!this.isFull(i)) return false;
    const id=this.idAt(i);
    return !!id && !state.epQueue.includes(id)
                && !(state.pendingReveal&&state.pendingReveal.id===id);
  },
  /* MAY THIS SLOT'S EPISODE BE WATCHED YET — the ordering rule, in one place.

     It is full, and every slot BEFORE it on the row is full and watched. That is the whole of
     "you cannot watch episode 2 before episode 1", and it is a real gate rather than the three
     independent copies of advice that used to re-derive it at their call sites (main.js,
     library.js, prediction.js each toasted a redirect). With four collections growing at once a
     player routinely holds several complete-but-unwatchable episodes, so this is walked
     constantly instead of almost never — which is exactly why it may only be written once. */
  watchableAt(i){
    if(!this.isFull(i)) return false;
    for(const k of this.pageSlots()){
      if(k>=i) break;
      if(!this.isFull(k)||!this.isWatched(k)) return false;
    }
    return true;
  },
  /* The episode id the player is allowed to watch next, or null. Callers ask this instead of
     deciding for themselves. */
  nextWatchableId(){
    for(const i of this.pageSlots())
      if(this.watchableAt(i)&&!this.isWatched(i)) return this.idAt(i);
    return null;
  },
  /* HOW MANY COULD BE WATCHED BACK TO BACK, starting now. Deliberately NOT the 🎬 badge's number,
     which counts everything waiting: with four collections filling in parallel the player
     routinely holds a complete episode 3 while 2 is still being collected, and 3 cannot be
     started — offering to binge it would be a promise the ordering gate then breaks.

     So: walk the row and stop at the first placeholder that is not full, because nothing past it
     is reachable however complete it looks. The watched ones on the way are simply not counted.
     This is watchableAt()'s rule read forwards rather than a second copy of it — a slot is
     watchable exactly when every slot before it is full and watched, so the run of full slots IS
     the run that will become watchable one after another as they are watched. */
  bingeableCount(){
    let n=0;
    for(const i of this.pageSlots()){
      if(!this.isFull(i)) break;
      if(!this.isWatched(i)) n++;
    }
    return n;
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
  /* DERIVED FROM THE CAST, never configured. One placeholder per lead, so adding a fifth joker
     adds a fifth episode to every row with no other edit. cfg.episodeRowSize is gone rather than
     defaulted: it is not economy-owned, so loadConfig merges it back out of every existing save,
     and any surviving read of it would let a stale save pin the row at five while a fresh install
     got four — the row length would then depend on whether you had played before. */
  rowSize(){ return Math.max(1,(typeof Shoe!=="undefined"&&Shoe.jokerTypes)?Shoe.jokerTypes():1); },
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
  /* Every episode id unlocked so far — what the library lists. DERIVED. Now that a slot IS its
     episode this is the ids of the FULL slots, rather than a prefix of the story taken off the
     front: those were the same list while slots filled left to right, and they are not once four
     collections fill at once. Walked in slot order, so the library still lists them in story
     order. Keep the dedupe — past the last content file Episodes.idForBuilder cycles, and
     without it the library grows duplicate rows. */
  unlockedEpisodeIds(){
    const out=[];
    for(let i=0;i<this.count();i++){
      if(!this.isFull(i)) continue;
      const id=this.idAt(i);
      if(id&&Episodes.has(id)&&!out.includes(id)) out.push(id);
    }
    return out;
  },
  /* THE ONE PLACE THAT DECIDES WHAT PLAYS NEXT, and therefore the one place the ordering rule
     lives. Every entry point — the play row, the binge button, the library, the result screen's
     "next episode" — asks this rather than picking for itself, so none of them can drift.

     Watchable first: the earliest complete episode whose predecessors on the row are done. Then
     the queue fallback, which is load-bearing for a different reason — it is the only way an
     episode queued before a series change stays reachable at all. */
  firstUnwatchedId(){
    const id=this.nextWatchableId();
    if(id) return id;
    /* THE FALLBACK MUST NOT DEFEAT THE GATE. It used to return the front of the queue outright,
       which handed back the very episode watchableAt had just refused — completing episode 3
       first would offer episode 3. Anything with a slot ON THIS ROW has already been considered
       above and turned down, so the fallback is now only for an episode ORPHANED by a series
       change: no slot here, so the ordering rule has nothing to say about it and it would
       otherwise be unreachable for ever. Null when nothing is watchable, which is honest — the
       row is not full either, so there is still something to pull for. */
    for(const q of state.epQueue){
      const slot=state.tickets.findIndex((_,i)=>this.idAt(i)===q);
      if(slot<0||!this.pageSlots().includes(slot)) return q;
    }
    return null;
  },
  /* Queue THIS SLOT'S episode — see the header for why it is no longer the front of the story.
     Guarded against double-queueing: award() only calls it on the transition into full, but
     _drainPending and a reshape can both re-enter, and a duplicate in epQueue would make the
     episode watchable twice and isWatched() flap. */
  completeEpisode(i){
    const id=this.idAt(i);
    if(!id||state.epQueue.includes(id)) return null;
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
  award(n,type){
    const filled=[], episodeIds=[];
    const per=this.perEpisode();
    /* What is owed: the n arriving now, plus everything banked while the row was full. Banked
       tickets keep their TYPE — see _bank — so a J3 banked yesterday still lands on episode 3. */
    const owed=this._bank();
    const t=(type==null||type<0)?null:type;
    if(t!=null) owed[t]=(owed[t]|0)+Math.max(0,Math.floor(n||0));
    else        owed.wild=(owed.wild|0)+Math.max(0,Math.floor(n||0));

    const put=slot=>{
      state.tickets[slot]=Math.min(per,this.held(slot)+1);
      filled.push(slot);
      if(this.isFull(slot)){ const id=this.completeEpisode(slot); if(id) episodeIds.push(id); }
    };
    /* Typed tickets first, each to its own slot; then wildcards to whatever is emptiest. Order
       matters: spending wildcards first could fill the very slot a typed ticket is waiting for,
       and the typed one would then have nowhere to go and bank — a ticket bought with real money
       stalling behind a free one. */
    const slots=this.pageSlots();
    for(let k=0;k<slots.length;k++){
      let want=owed[k]|0;
      while(want>0&&!this.isFull(slots[k])){ put(slots[k]); want--; }
      owed[k]=want;                                          // whatever did not fit stays banked
    }
    let wild=owed.wild|0;
    while(wild>0){
      /* A wildcard goes to the CLOSEST-TO-DONE unfilled slot, ties to the earliest — so it buys
         episodes rather than progress. Spreading them to the emptiest slot instead was tried and
         is wrong: fifteen wildcards over four collections lands 4/4/4/3 and completes NOTHING,
         where the same fifteen used to finish three episodes. A store grant that visibly unlocks
         nothing is the worst possible reading of a real-money purchase. Concentrating also keeps
         the row's own left-to-right order, which is the order they have to be watched in. */
      let best=null;
      for(const i of slots) if(!this.isFull(i)&&(best==null||this.held(i)>this.held(best))) best=i;
      if(best==null) break;                                  // row full — the rest stays banked
      put(best); wild--;
    }
    owed.wild=wild;
    this._setBank(owed);

    const seriesDone=this.allFull();
    if(seriesDone) state.seriesDone=true;
    return {filled, episodeIds, titles:episodeIds.map(id=>Episodes.titleOf(id)),
            seriesDone, banked:this.bankedCount()};
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
     it came off the shoe, so Shoe.mintPack already billed it.

     A FREE TICKET IS A WILDCARD, which is the other half of why it stays a separate entry point.
     Three of the four ticket sources — the mystery box, the Plot Twist backstage pass and the
     store's 5/25/100 grants — have no joker behind them, so there is no type to route by. Sending
     them to the emptiest slot keeps them useful without quietly restoring the old lowest-first
     fill for three quarters of the game's tickets. */
  awardFree(n){
    state.ticketsPriced=(state.ticketsPriced|0)+Math.max(0,Math.floor(n||0));
    return this.award(n,null);
  },

  /* ---------- the bank ----------
     Tickets that arrive with their slot already full wait HERE, keyed by type, plus a wildcard
     pot. It has to be per type: a bare count forgets which lead paid for it, and a J3 banked
     while episode 3 was full would come back as a wildcard and land on episode 1.

     Stored as a plain object of small integers so it serialises as itself. loadState sanitises
     it — an older save holds a NUMBER here, which is read as wildcards rather than dropped. */
  _bank(){
    const b=state.ticketBank;
    const out={wild:0};
    if(typeof b==="number") out.wild=Math.max(0,Math.floor(b)||0);
    else if(b&&typeof b==="object"){
      out.wild=Math.max(0,Math.floor(b.wild)||0);
      for(let k=0;k<this.rowSize();k++) out[k]=Math.max(0,Math.floor(b[k])||0);
    }
    return out;
  },
  _setBank(o){
    const out={wild:Math.max(0,o.wild|0)};
    for(let k=0;k<this.rowSize();k++) if(o[k]) out[k]=Math.max(0,o[k]|0);
    state.ticketBank=out;
  },
  bankedCount(){ const b=this._bank(); let n=b.wild|0;
    for(let k=0;k<this.rowSize();k++) n+=b[k]|0; return n; },
  /* Apply anything banked while the row was full. Safe to call at any time — award(0) with no
     type spends the bank and nothing else. */
  _drainPending(){ if(this.bankedCount()) this.award(0,null); },
};
