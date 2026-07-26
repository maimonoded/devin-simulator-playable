"use strict";
/* Modal flows: prediction → episode playback → result, and the series-complete finale. */
let pending=null;
function openPrediction(){
  if(!state.epQueue.length) return;
  const id=state.epQueue[0];
  const ep=Episodes.get(id);
  if(!ep){ toast(`⚠ Missing episode file for <b>${id}</b>`); return; }
  // answers are shuffled every time, so the correct index in the file isn't a tell
  const order=shuffle(ep.answers.map((_,i)=>i));
  const minW=Math.max(0,cfg.minWager);
  const canBet=state.coins>=minW&&minW>0;
  pending={id,ep,order,sel:null,wager:canBet?minW:0};
  const maxW=Math.max(minW,Math.floor(state.coins));
  const optHtml=order.map((src,idx)=>{ const a=ep.answers[src];
    return `<button class="opt" data-idx="${idx}"><span>${a.text}</span><span class="odds">×${a.odds.toFixed(1)}</span></button>`;
  }).join("");
  // betting is mandatory; only a player who can't afford the minimum gets a way out
  const wagerHtml=canBet
    ? `<div class="wagerRow"><span style="font-size:12px;color:var(--muted)">Wager</span>
         <input type="range" id="wSlide" min="${minW}" max="${maxW}" step="10" value="${minW}">
         <span class="wagerVal" id="wVal">${fmt(minW)}</span></div>
       <div class="hint" style="margin-top:4px">Minimum bet <b style="color:var(--gold)">${fmt(minW)}</b>🪙 · you hold <b>${fmt(state.coins)}</b>🪙</div>`
    : `<div class="hint" style="margin-top:10px">You need <b style="color:var(--gold)">${fmt(minW)}</b>🪙 to place a bet and hold only <b>${fmt(state.coins)}</b>🪙. Watch it without a wager, or come back once you've earned more.</div>`;
  // "Watch later" is always available so the modal is never a dead end;
  // "Skip & watch" only appears when the player can't afford the minimum bet.
  const footHtml=canBet
    ? `<button class="btn ghost" id="watchLater" style="flex:1">Watch later</button>
       <button class="btn pink" id="commitPred" style="flex:2" disabled>Lock in prediction</button>`
    : `<button class="btn ghost" id="watchLater" style="flex:1">Watch later</button>
       <button class="btn pink" id="skipPred" style="flex:2">Skip &amp; watch</button>`;
  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">Predict before you watch</div><h2>${ep.title}</h2></div>
    <div class="mbody"><div style="font-size:14px;color:var(--muted);margin-bottom:4px">${ep.question}</div>
    ${optHtml}
    ${wagerHtml}
    <div class="foot">${footHtml}</div></div></div>`;
  $("#scrim").classList.add("show");
  $("#scrim").querySelectorAll(".opt").forEach(b=>b.onclick=()=>{
    $("#scrim").querySelectorAll(".opt").forEach(x=>x.classList.remove("sel"));
    b.classList.add("sel"); pending.sel=+b.dataset.idx;
    const commit=$("#commitPred"); if(commit) commit.disabled=false; });
  $("#watchLater").onclick=()=>{   // leaves the episode queued for later
    $("#scrim").classList.remove("show"); $("#scrim").innerHTML=""; pending=null; renderAll(); };
  if(canBet){
    $("#wSlide").oninput=(e)=>{ pending.wager=+e.target.value; $("#wVal").textContent=fmt(pending.wager); };
    $("#commitPred").onclick=()=>playEpisode();
  }else{
    $("#skipPred").onclick=()=>{ pending.wager=0; pending.sel=pending.sel??0; playEpisode(); };
  }
}
async function playEpisode(){
  const p=pending, ep=p.ep;
  const answerIdx=p.order[p.sel];        // displayed position → index in the episode file
  const odds=ep.answers[answerIdx].odds;
  $("#scrim").innerHTML=`<div class="modal videoModal"><div class="top"><div class="eyebrow">Now playing</div><h2>${ep.title}</h2></div>
    <div class="mbody"><div class="vwrap" id="vWrap">
      <video id="epVideo" class="epVideo" playsinline preload="auto" src="${Episodes.videoFor(p.id)}"></video>
      <div class="vpause">▶</div>
      <div class="vsound" id="vSound">🔇 tap for sound</div>
      <div class="vspeed" id="vSpeed">2×</div>
      <div class="vbar"><div class="vfill" id="vFill"></div></div>
      <div class="vtime" id="vTime">0:00</div>
    </div>
    <div class="vctrl"><button class="btn ghost speedBtn" id="speedBtn">⏩ 2× speed</button></div>
    <div class="hint" style="text-align:center;margin-top:10px">${p.wager>0?`You wagered <b style="color:var(--gold)">${fmt(p.wager)}</b> at ×${odds.toFixed(1)}`:"Watching with no wager"}</div></div></div>`;
  const {won,payout}=resolvePrediction({wager:p.wager,odds,sel:answerIdx,correct:ep.correct,
                                        auto:typeof autoMode!=="undefined"&&autoMode!==null});
  await playVideo(p.id);   // resolves when the episode finishes (or the fallback elapses)
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

/* ---------------- store ---------------- */
/* Top-up packs. Energy packs deliberately exceed cfg.energyCap — buying is the one
   way to hold more than a session's worth, so nothing clamps them back down. */
const STORE_PACKS={ coins:[10000,100000,1000000], energy:[100,1000,10000] };
function openStore(){
  if(state.animating||autoMode!==null) return;
  const packs=(kind,amounts,icon)=>amounts.map(a=>
    `<button class="pack" data-kind="${kind}" data-amt="${a}">
       <span class="pkIco">${icon}</span><span class="pkAmt">${fmt(a)}</span></button>`).join("");
  $("#scrim").innerHTML=`<div class="modal storeModal">
    <div class="top"><div class="eyebrow">Store</div><h2>Top up your run</h2></div>
    <div class="mbody">
      <div class="pkGroup">🪙 Coins</div>
      <div class="packs">${packs("coins",STORE_PACKS.coins,"🪙")}</div>
      <div class="pkGroup">⚡ Energy</div>
      <div class="packs">${packs("energy",STORE_PACKS.energy,"⚡")}</div>
      <div class="hint" style="margin-top:12px;text-align:center">Buy as many as you like — energy can go past the ${cfg.energyCap}⚡ cap.</div>
      <button class="btn purple wide" id="closeStore" style="margin-top:12px">Done</button>
    </div></div>`;
  $("#scrim").classList.add("show");
  $("#scrim").querySelectorAll(".pack").forEach(b=>b.onclick=()=>{
    const amt=+b.dataset.amt;
    if(b.dataset.kind==="coins"){
      state.coins+=amt; toast(`🪙 <b>+${fmt(amt)}</b> coins`); log("🛒",`Store · +<b>${fmt(amt)}</b> coins`);
    }else{
      state.energy+=amt; toast(`⚡ <b>+${fmt(amt)}</b> energy`); log("🛒",`Store · +<b>${fmt(amt)}</b> energy`);
    }
    renderAll();
  });
  $("#closeStore").onclick=()=>{ $("#scrim").classList.remove("show"); $("#scrim").innerHTML=""; renderAll(); };
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
