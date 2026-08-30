"use strict";
/* The two ends of the loop: a set finished, and the story finished.

   A SET is finished when all five of its episodes are unlocked — that is, when the last of its
   twenty-five cards lands. The album is then put away and a fresh set begins on the next five
   episodes: new cards to collect, the same board to roll around. The old album is KEPT; the
   collection is a history, and the album's board strip walks back through every finished set.

   THE STORY is finished when there is no next set, i.e. the episode library has run out. Only
   then is the run over.

   Both are reached from playEvents() via the {boardDone} event, so they block the roll loop
   the way every other reward does — except in an auto-play session, which must never be stopped
   by a modal. That run advances silently and keeps rolling. */

/* Returns a promise so playEvents can await it, like every other blocking beat. */
function showBoardComplete(){
  return new Promise(resolve=>{
    const n=Collection.num();
    const board=Collection.boardFor(n);
    const pool=Cards.poolSize();
    const hasNext=Collection.hasNextBoard();

    /* The batch balancing tool gets the advance without the ceremony. */
    const auto=typeof autoMode!=="undefined"&&autoMode==="session";
    if(auto){
      if(hasNext){ const b=Collection.advanceBoard(); if(b) log("📚",`<b>Set ${b.board}</b> begins · ${b.name}`); }
      else { state.seriesDone=true; log("🏆","<b>Every set collected.</b>"); }
      return resolve();
    }

    confetti(); setTimeout(confetti,300); setTimeout(confetti,600);
    log("📚",`<b>Set ${n} complete</b> · ${Collection.pages(n).length} episodes watched`);

    const cta=hasNext
      ? `<button class="btn purple wide" id="nextSet" style="margin-top:16px">Open Set ${n+1} →</button>
         <p class="hint" style="margin:8px 0 0;text-align:center">The story goes on.
            Your coins, your day and your collection all carry over.</p>`
      : `<button class="btn purple wide" id="endSet" style="margin-top:16px">Back to the board</button>
         <p class="hint" style="margin:8px 0 0;text-align:center">That is every set the library holds —
            ${Episodes.count()} episodes.</p>`;

    $("#scrim").innerHTML=`<div class="modal"><div class="top">
        <div class="eyebrow">Set complete</div><h2>${board.name} 🏆</h2></div>
      <div class="mbody">
        <div class="result"><div class="big" style="color:var(--gold)">${Collection.pages(n).length} of ${Collection.pages(n).length}</div>
          <div style="margin-top:8px;color:var(--muted)">Every episode watched ·
            <b>${Cards.owned()}</b>/${pool} cards held ·
            day <b>${state.day}</b></div></div>
        ${cta}</div></div>`;
    $("#scrim").classList.add("show");

    const done=()=>{ $("#scrim").classList.remove("show"); $("#scrim").innerHTML=""; renderAll(); resolve(); };
    if(hasNext){
      $("#nextSet").onclick=()=>{
        const b=Collection.advanceBoard();
        done();
        if(b){
          /* Nothing on the board itself changes — the tiles are the same forty. What changes is
             what the deck tile can hand out, which is the album. Rebuild anyway so the labels
             and the HUD are consistent with the new set. */
          buildBoard(); renderAll();
          log("📚",`<b>Set ${b.board}</b> begins · ${b.name}`);
          toast(`📚 Set ${b.board} — ${b.name}`);
        }
      };
    }else{
      state.seriesDone=true;
      $("#endSet").onclick=()=>{ done(); seriesComplete(); };
    }
  });
}

/* The story is over: every set collected, every episode unlocked. Pure celebration plus the
   offer of a fresh run — there is no more content to continue into.

   The card count comes from Cards, not Status. It read Status.cardsCollected(), which counted
   album slots and went away when the card inflow became Cards.statusPoints() — so the one screen
   the whole run ends on threw a TypeError and never drew at all. Cards is where ownership lives,
   and "collected" is a Collectible (§4.3): a card three copies deep. Nothing else here counts
   cards, so there was nothing to contradict it and nothing to notice until the run ended. */
function seriesComplete(){
  confetti(); setTimeout(confetti,300); setTimeout(confetti,600);
  const acc=(()=>{const t=state.predWins+state.predLoss;return t?Math.round(state.predWins/t*100):0})();
  const pts=Status.points(), rank=Status.rank(pts);
  log("🏆",`<b>THE COLLECTION IS COMPLETE.</b> ${Episodes.count()} episodes across ${state.boardsDone+1} sets in ${state.day-1} days.`);

  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">The finale</div>
      <h2>Collection complete 🏆</h2></div>
    <div class="mbody"><div class="result">
      <div class="big" style="color:var(--gold)">${Episodes.count()} episodes</div>
      <div style="margin-top:8px;color:var(--muted)">
        ${state.boardsDone+1} sets · ${Cards.collectibleCount()} collected ·
        ${state.epsWatched} watched · ${acc}% accuracy · finished as
        <b>${rank.icon} ${rank.name}</b></div></div>
    <button class="btn purple wide" id="newRun" style="margin-top:16px">Start over</button></div></div>`;
  $("#scrim").classList.add("show");
  $("#newRun").onclick=()=>{
    $("#scrim").classList.remove("show"); $("#scrim").innerHTML="";
    initState(); Economy.apply(); buildBoard(); syncMultButton(); renderAll();
    toast("🎬 New run — Day 1");
  };
  renderAll();
}

/* ---------------- a card set completed (GDD §4.4) ----------------

   Ten cards, and the last one landed. This is deliberately a SMALLER beat than a set of
   episodes finishing: it is a reward, not a chapter ending, and it never gated anything — so it
   holds the screen briefly, says what it paid, and gets out of the way.

   The coins and the status are already banked (Cards.claimSet) by the time this runs. Like every
   blocking beat it resolves on a timer as well as on a click, because a promise that never
   settles leaves state.animating stuck and the board soft-locked. */
function showSetComplete(paid){
  const set=paid.set;
  log("🗂",`<b>${set.name}</b> complete · +${fmt(paid.coins)} coins · +${paid.status} status`);
  /* The batch balancing tool takes the money and skips the moment, like every other beat. */
  if(typeof autoMode!=="undefined"&&autoMode==="session") return Promise.resolve();
  toast(`🗂 Set complete — <b>${set.name}</b>`);
  return new Promise(resolve=>{
    confetti();
    const el=$("#centerFx");
    el.className="centerfx show card win";
    el.innerHTML=`<div class="setDone">
        <div class="sdEyebrow">Set complete</div>
        <div class="sdName">${set.name}</div>
        <div class="sdRow">${set.cards.slice(0,5).map(c=>
          `<div class="sdChip">${cardFace(c,{owned:true,count:Cards.count(c.id),size:"sm"})}</div>`).join("")}</div>
        <div class="sdPaid">+${fmt(paid.coins)}🪙 · +${paid.status} status</div>
      </div>`;
    let done=false;
    const finish=()=>{ if(done) return; done=true;
      el.className="centerfx"; el.innerHTML=""; el.onclick=null; resolve(); };
    el.onclick=finish;
    setTimeout(finish,Math.max(600,cfg.setDoneMs||2600));
  });
}
