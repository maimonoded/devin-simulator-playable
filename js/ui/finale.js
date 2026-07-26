"use strict";
/* Series-complete finale — state.seriesDone is already set by Builders.upgrade(),
   so this is pure celebration plus the offer to start over. */
function seriesComplete(){
  confetti(); setTimeout(confetti,300); setTimeout(confetti,600);
  const totalEps=Builders.totalEpisodes();
  log("🏆",`<b>SERIES COMPLETE.</b> ${totalEps} episodes across ${Builders.count()} builders in ${state.day-1} days.`);
  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">The finale</div><h2>Series complete 🏆</h2></div>
    <div class="mbody"><div class="result"><div class="big" style="color:var(--gold)">${totalEps} episodes</div>
    <div style="margin-top:8px;color:var(--muted)">All ${Builders.count()} builders maxed in <b>${state.day-1}</b> days · ${state.epsWatched} watched · ${(()=>{const t=state.predWins+state.predLoss;return t?Math.round(state.predWins/t*100):0})()}% accuracy</div></div>
    <button class="btn purple wide" id="newSeries" style="margin-top:16px">Start a new series</button></div></div>`;
  $("#scrim").classList.add("show");
  $("#newSeries").onclick=()=>{ $("#scrim").classList.remove("show"); initState(); buildBoard(); syncMultButtons(); renderAll(); toast("🎬 New series — Day 1"); };
  renderAll();
}
