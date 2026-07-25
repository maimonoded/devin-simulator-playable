"use strict";
/* Modal flows: prediction → episode playback → result, and the series-complete finale. */
let pending=null;
function openPrediction(){
  if(!state.epQueue.length) return;
  const id=state.epQueue[0];
  const ep=Episodes.get(id);
  if(!ep){ toast(`⚠ Missing episode file for <b>${id}</b>`); return; }
  pending={id,ep,sel:null,wager:Math.min(cfg.avgWager,state.coins)};
  const maxW=Math.max(0,Math.floor(state.coins));
  const optHtml=ep.answers.map((a,idx)=>`<button class="opt" data-idx="${idx}"><span>${a.text}</span><span class="odds">×${a.odds.toFixed(1)}</span></button>`).join("");
  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">Predict before you watch</div><h2>${ep.title}</h2></div>
    <div class="mbody"><div style="font-size:14px;color:var(--muted);margin-bottom:4px">${ep.question}</div>
    ${optHtml}
    <div class="wagerRow"><span style="font-size:12px;color:var(--muted)">Wager</span>
      <input type="range" id="wSlide" min="0" max="${maxW}" step="10" value="${pending.wager}">
      <span class="wagerVal" id="wVal">${fmt(pending.wager)}</span></div>
    <div class="hint" style="margin-top:4px">Skip = watch with no wager. Clues held: <b style="color:var(--teal)">${state.clues}🔍</b> (your edge)</div>
    <div class="foot"><button class="btn ghost" id="skipPred" style="flex:1">Skip &amp; watch</button>
    <button class="btn pink" id="commitPred" style="flex:2" disabled>Lock in prediction</button></div></div></div>`;
  $("#scrim").classList.add("show");
  $("#scrim").querySelectorAll(".opt").forEach(b=>b.onclick=()=>{
    $("#scrim").querySelectorAll(".opt").forEach(x=>x.classList.remove("sel"));
    b.classList.add("sel"); pending.sel=+b.dataset.idx; $("#commitPred").disabled=false; });
  $("#wSlide").oninput=(e)=>{ pending.wager=+e.target.value; $("#wVal").textContent=fmt(pending.wager); };
  $("#skipPred").onclick=()=>{ pending.wager=0; pending.sel=pending.sel??0; playEpisode(); };
  $("#commitPred").onclick=()=>playEpisode();
}
async function playEpisode(){
  const p=pending, ep=p.ep; const odds=ep.answers[p.sel].odds;
  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">Now playing</div><h2>${ep.title}</h2></div>
    <div class="mbody"><div class="scene"><div class="play">🎬</div><div class="sceneBar" id="sBar"></div></div>
    <div class="hint" style="text-align:center;margin-top:10px">${p.wager>0?`You wagered <b style="color:var(--gold)">${fmt(p.wager)}</b> at ×${odds.toFixed(1)}`:"Watching with no wager"}</div></div></div>`;
  const {won,payout}=resolvePrediction({wager:p.wager,odds,sel:p.sel,correct:ep.correct,
                                        auto:typeof autoMode!=="undefined"&&autoMode!==null});
  await sleep(60); const bar=$("#sBar"); bar.style.transition="width 1.6s linear"; bar.style.width="100%";
  await sleep(1700);
  // name the true answer when the player got it wrong
  const truth=ep.answers[ep.correct]?.text||"";
  const truthHtml=won?"":`<div style="margin-top:8px;font-size:12px;color:var(--muted)">The answer was <b style="color:var(--teal)">${truth}</b></div>`;
  let resultHtml="";
  if(p.wager>0){
    if(won){ resultHtml=`<div class="result"><div class="big win">You called it! 🎉</div><div style="margin-top:6px">+<b style="color:var(--gold)">${fmt(payout)}</b> coins · streak ${state.streak}</div></div>`; confetti(); }
    else { resultHtml=`<div class="result"><div class="big lose">Not this time</div><div style="margin-top:6px;color:var(--muted)">Lost your <b>${fmt(p.wager)}</b> wager · streak reset</div>${truthHtml}</div>`; }
  }else{
    resultHtml=`<div class="result"><div class="big" style="color:var(--teal)">${won?"You'd have been right ✓":"You'd have been wrong ✗"}</div><div style="margin-top:6px;color:var(--muted)">No wager placed</div>${truthHtml}</div>`;
  }
  log(won?"✅":"❌",`${ep.title} · ${p.wager>0?(won?`won +${fmt(payout)}`:`lost ${fmt(p.wager)}`):"watched (no wager)"}`);
  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">Episode complete</div><h2>${ep.title}</h2></div>
    <div class="mbody">${resultHtml}<button class="btn purple wide" id="closeEp" style="margin-top:16px">Back to the board</button></div></div>`;
  $("#closeEp").onclick=()=>{ $("#scrim").classList.remove("show"); pending=null; renderAll(); };
  renderAll();
}

/* Finale — state.seriesDone is already set by Builders.upgrade(); this is pure celebration. */
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
