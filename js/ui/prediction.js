"use strict";
/* Predict & watch — the bet, the playback, the result.
   Episode content comes from js/episodes.js; the outcome is decided by
   resolvePrediction() in js/game.js; the video is js/ui/player.js.
   Flow and betting rules are documented in episodes/README.md. */
let pending=null;

function openPrediction(){
  if(!state.epQueue.length) return;
  const id=state.epQueue[0];
  const ep=Episodes.get(id);
  if(!ep){ toast(`⚠ Missing episode file for <b>${id}</b>`); return; }
  // answers are shuffled every time, so the correct index in the file isn't a tell
  const order=shuffle(ep.answers.map((_,i)=>i));
  const minW=Math.max(0,cfg.minWager);
  const canBet=Economy.canWager(state.coins);
  /* Three tiers priced off the balance, not a free slider — the model sizes a bet as a share
     of what the player holds, and Confident is the one its projections assume. */
  const tiers=Economy.wagerTiers(state.coins);
  const startTier=canBet?Economy.DEFAULT_TIER:null;
  pending={id,ep,order,sel:null,tier:startTier,
           wager:canBet?Economy.wagerTier(startTier,state.coins).amount:0};
  const optHtml=order.map((src,idx)=>{ const a=ep.answers[src];
    return `<button class="opt" data-idx="${idx}"><span>${a.text}</span><span class="odds">×${a.odds.toFixed(1)}</span></button>`;
  }).join("");
  /* Every tier reads the same while the balance is small enough that minWager is doing the
     clamping. Say so rather than showing three identical buttons with no explanation. */
  const allFloored=tiers.every(t=>t.amount===tiers[0].amount);
  const wagerHtml=canBet
    ? `<div class="tierRow">${tiers.map(t=>
         `<button class="tier${t.key===startTier?" sel":""}" data-tier="${t.key}">
            <span class="tierName">${t.label}</span>
            <span class="tierPct">${Math.round(t.pct*100)}%</span>
            <span class="tierAmt">${fmt(t.amount)}🪙</span></button>`).join("")}</div>
       <div class="hint" style="margin-top:6px">You hold <b>${fmt(state.coins)}</b>🪙 · a tier is a share of that${
         allFloored?`, but all three are at the <b>${fmt(minW)}</b>🪙 minimum until you hold more`:""}</div>`
    : `<div class="hint" style="margin-top:10px">You need <b style="color:var(--gold)">${fmt(minW)}</b>🪙 to place a bet and hold only <b>${fmt(state.coins)}</b>🪙. Watch it without a wager, or come back once you've earned more.</div>`;
  /* "Watch later" keeps the modal from being a dead end. "Skip & watch" is now ALWAYS offered:
     the model expects a stake on 95% of predictions, which only means anything if declining is
     a choice the player actually has. See Economy.apply(). */
  const footHtml=`<button class="btn ghost" id="watchLater" style="flex:1">Watch later</button>
       <button class="btn ghost" id="skipPred" style="flex:1">Skip &amp; watch</button>${
         canBet?`<button class="btn pink" id="commitPred" style="flex:2" disabled>Lock in prediction</button>`:""}`;
  /* Clues banked since the last prediction are spent on this one. They set the accuracy the
     economy model uses, so say what they bought — otherwise the only clue feedback a player
     ever gets is a number going up in the HUD. */
  const clueHtml=state.cycleClues>0
    ? `<div class="hint" style="margin:6px 0 2px">
         <b style="color:var(--teal)">${state.cycleClues}🔍</b> banked since your last prediction —
         they lift the modelled accuracy to <b>${Math.round(Economy.accuracyFor(state.cycleClues)*100)}%</b>, and are spent here.</div>`
    : `<div class="hint" style="margin:6px 0 2px">No clues banked — modelled accuracy sits at its floor of
         <b>${Math.round(Economy.accuracyFor(0)*100)}%</b>. Mystery Boxes are where clues come from.</div>`;
  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">Predict before you watch</div><h2>${ep.title}</h2></div>
    <div class="mbody"><div style="font-size:14px;color:var(--muted);margin-bottom:4px">${ep.question}</div>
    ${clueHtml}
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
  /* Skipping settles nothing: wager 0 means resolvePrediction leaves coins, streak and the
     win counter alone, so the arbitrary sel can't score. */
  $("#skipPred").onclick=()=>{ pending.wager=0; pending.tier=null; pending.sel=pending.sel??0; playEpisode(); };
  if(canBet){
    $("#scrim").querySelectorAll(".tier").forEach(b=>b.onclick=()=>{
      $("#scrim").querySelectorAll(".tier").forEach(x=>x.classList.remove("sel"));
      b.classList.add("sel");
      pending.tier=b.dataset.tier;
      pending.wager=Economy.wagerTier(pending.tier,state.coins).amount; });
    $("#commitPred").onclick=()=>playEpisode();
  }
}

/* Settle the bet, play the episode, then reveal the result.
   The outcome is resolved BEFORE playback — the video is the reveal, not the decider. */
async function playEpisode(){
  const p=pending, ep=p.ep;
  const answerIdx=p.order[p.sel];        // displayed position → index in the episode file
  const odds=ep.answers[answerIdx].odds;
  $("#scrim").innerHTML=`<div class="modal videoModal"><div class="top"><div class="eyebrow">Now playing</div><h2>${ep.title}</h2></div>
    <div class="mbody">${playerMarkup(p.id)}
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
