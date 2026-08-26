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
    const pool=Collection.poolSize(n);
    const hasNext=Collection.hasNextBoard();

    /* The batch balancing tool gets the advance without the ceremony. */
    const auto=typeof autoMode!=="undefined"&&autoMode==="session";
    if(auto){
      if(hasNext){ const b=Collection.advanceBoard(); if(b) log("📚",`<b>Set ${b.board}</b> begins · ${Collection.poolSize(b.board)} new cards`); }
      else { state.seriesDone=true; log("🏆","<b>Every set collected.</b>"); }
      return resolve();
    }

    confetti(); setTimeout(confetti,300); setTimeout(confetti,600);
    log("📚",`<b>Set ${n} complete</b> · ${pool} cards · ${Collection.pages(n).length} episodes unlocked`);

    const cta=hasNext
      ? `<button class="btn purple wide" id="nextSet" style="margin-top:16px">Open Set ${n+1} →</button>
         <p class="hint" style="margin:8px 0 0;text-align:center">A fresh set of ${pool} cards.
            Your coins, your day and your album all carry over.</p>`
      : `<button class="btn purple wide" id="endSet" style="margin-top:16px">Back to the board</button>
         <p class="hint" style="margin:8px 0 0;text-align:center">That is every set the library holds —
            ${Episodes.count()} episodes.</p>`;

    $("#scrim").innerHTML=`<div class="modal"><div class="top">
        <div class="eyebrow">Set complete</div><h2>${board.name} 🏆</h2></div>
      <div class="mbody">
        <div class="result"><div class="big" style="color:var(--gold)">${pool} of ${pool}</div>
          <div style="margin-top:8px;color:var(--muted)">Every card collected ·
            <b>${Collection.pages(n).length}</b> episodes unlocked ·
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
          log("📚",`<b>Set ${b.board}</b> begins · ${Collection.poolSize(b.board)} new cards to find`);
          toast(`📚 Set ${b.board} — ${Collection.poolSize(b.board)} new cards`);
        }
      };
    }else{
      state.seriesDone=true;
      $("#endSet").onclick=()=>{ done(); seriesComplete(); };
    }
  });
}

/* The story is over: every set collected, every episode unlocked. Pure celebration plus the
   offer of a fresh run — there is no more content to continue into. */
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
        ${state.boardsDone+1} sets · ${Status.cardsCollected()} cards ·
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
