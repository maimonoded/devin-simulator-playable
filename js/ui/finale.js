"use strict";
/* Series-complete finale — state.seriesDone is already set by Builders.upgrade(),
   so this is pure celebration plus whatever comes next.

   What comes next depends on whether the episode library has another series in it. If it
   does, the run CONTINUES into it: coins, day, energy and the unwatched episode queue all
   carry over and only the builders are fresh, because a series boundary is a chapter break in
   the story, not a new save file. Only when the content runs out does the finale offer the
   full restart it used to always do. */
function seriesComplete(){
  confetti(); setTimeout(confetti,300); setTimeout(confetti,600);
  const totalEps=Builders.totalEpisodes();
  const here=Builders.series();
  const next=Economy.nextSeries();
  const acc=(()=>{const t=state.predWins+state.predLoss;return t?Math.round(state.predWins/t*100):0})();
  log("🏆",`<b>${(here&&here.name)||"SERIES"} COMPLETE.</b> ${totalEps} episodes across ${Builders.count()} builders in ${state.day-1} days.`);

  const cta=next
    ? `<button class="btn purple wide" id="nextSeries" style="margin-top:16px">Continue to ${next.name} →</button>
       <p class="hint" style="margin:8px 0 0;text-align:center">${next.builders} more builders · your coins and day carry over</p>`
    : `<button class="btn purple wide" id="newSeries" style="margin-top:16px">Start over</button>
       <p class="hint" style="margin:8px 0 0;text-align:center">That is every episode in the library — ${Episodes.count()} of them.</p>`;

  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">The finale</div><h2>${(here&&here.name)||"Series"} complete 🏆</h2></div>
    <div class="mbody"><div class="result"><div class="big" style="color:var(--gold)">${totalEps} episodes</div>
    <div style="margin-top:8px;color:var(--muted)">All ${Builders.count()} builders maxed in <b>${state.day-1}</b> days · ${state.epsWatched} watched · ${acc}% accuracy</div></div>
    ${cta}</div></div>`;
  $("#scrim").classList.add("show");

  if(next){
    $("#nextSeries").onclick=()=>{
      const s=Builders.advanceSeries();
      $("#scrim").classList.remove("show");
      buildBoard(); syncMultButton(); renderAll();
      log("🎬",`<b>${s.name}</b> begins · builders ${s.from}–${s.to}.`);
      toast(`🎬 ${s.name} — ${s.builders} builders`);
    };
  }else{
    $("#newSeries").onclick=()=>{
      $("#scrim").classList.remove("show");
      initState(); Economy.apply(); buildBoard(); syncMultButton(); renderAll();
      toast("🎬 New run — Day 1");
    };
  }
  renderAll();
}
