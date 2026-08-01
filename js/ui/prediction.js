"use strict";
/* Predict & watch — the bet, the playback, the result.
   Episode content comes from js/episodes.js; the outcome is decided by
   resolvePrediction() in js/game.js; the video is js/ui/player.js.
   Flow and betting rules are documented in episodes/README.md. */
let pending=null;

function closeEpisodeUi(){
  $("#scrim").classList.remove("show"); $("#scrim").innerHTML=""; pending=null;
}

/* A builder just completed, so an episode came with it. Ask rather than launch: banking several
   and watching them back to back is how the show is actually consumed, and interrupting a roll
   streak to sit through a video is not a choice the game should make for the player.

   Declining costs nothing — the id stays in state.epQueue, and the builders view grows a button
   for whatever is waiting there. */
function openEpisodeUnlock(id){
  const ep=Episodes.get(id);
  if(!ep){ toast(`⚠ Missing episode file for <b>${id}</b>`); return; }
  const queued=state.epQueue.length;
  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">Episode unlocked</div><h2>${ep.title}</h2></div>
    <div class="mbody">
      <div class="hint">Call what happens next, then watch it.${
        queued>1?` You have <b style="color:var(--pink)">${queued}</b> waiting.`:""}</div>
      <div class="foot" style="margin-top:14px">
        <button class="btn ghost" id="bingeLater" style="flex:1">Binge later</button>
        <button class="btn pink" id="watchNow" style="flex:2">Watch now</button>
      </div></div></div>`;
  $("#scrim").classList.add("show");
  /* Straight into the prediction — openPrediction replaces this modal's contents, so the two
     screens read as one flow rather than a dialog that spawns another dialog. */
  $("#watchNow").onclick=()=>openPrediction();
  $("#bingeLater").onclick=()=>{ closeEpisodeUi(); renderAll(); };
}

/* `wantId` lets the library start a prediction for a SPECIFIC unwatched episode instead of
   whatever is at the front of the queue. Omitted, it behaves as it always did. */
function openPrediction(wantId){
  /* A bet already placed is not re-bettable. Any attempt to open a prediction while one is
     sealed goes back to finishing that episode instead — including an attempt to bet on a
     DIFFERENT one, or the reveal could be dodged indefinitely by starting something else. */
  if(state.pendingReveal){
    const r=state.pendingReveal;
    if(wantId!=null&&wantId!==r.id)
      toast(`▶ Finish <b>${Episodes.titleOf(r.id)}</b> first — its result is still sealed`);
    return resumeReveal(r.id);
  }
  const id=wantId!=null?wantId:state.epQueue[0];
  if(id==null) return;
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
  $("#watchLater").onclick=()=>{ closeEpisodeUi(); renderAll(); };   // stays queued
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

/* Settle the bet, then hand over to the reveal.

   The outcome is resolved BEFORE playback — the video is the reveal, not the decider — which is
   exactly why walking out of the video forfeits the reveal rather than skipping to it. The bet
   is locked the moment this runs: coins have moved and the episode has left the queue, so there
   is no second wager to place. What is still owed is the ANSWER, and that lives in the footage.

   state.pendingReveal carries it, and is persisted: a sealed result survives a reload, so
   closing the tab mid-episode is not a way to duck a losing bet or to re-bet a won one. */
async function playEpisode(){
  const p=pending, ep=p.ep;
  const answerIdx=p.order[p.sel];        // displayed position → index in the episode file
  const odds=ep.answers[answerIdx].odds;
  const {won,payout}=resolvePrediction({wager:p.wager,odds,sel:answerIdx,correct:ep.correct,id:p.id,
                                        auto:typeof autoMode!=="undefined"&&autoMode!==null});
  state.pendingReveal={id:p.id,wager:p.wager,odds,won,payout};
  scheduleSaveState();
  await runReveal(state.pendingReveal);
}

/* Resume a bet that was placed but never watched to the end. No wager UI: that decision was
   made and paid for already. */
async function resumeReveal(id){
  const r=state.pendingReveal;
  if(!r||r.id!==id) return;
  pending=null;
  await runReveal(r);
}

/* Play until the episode actually finishes, then reveal. Leaving early keeps the seal on and
   offers to come back; the stored reveal is only cleared once it has been shown. */
async function runReveal(r){
  const ep=Episodes.get(r.id);
  if(!ep){ state.pendingReveal=null; closeEpisodeUi(); renderAll(); return; }
  const wagerLine=r.wager>0
    ? `You wagered <b style="color:var(--gold)">${fmt(r.wager)}</b> at \u00d7${r.odds.toFixed(1)}`
    : "Watching with no wager";
  const showPlayer=()=>{
    $("#scrim").innerHTML=`<div class="modal videoModal"><div class="top"><div class="eyebrow">Now playing</div><h2>${ep.title}</h2></div>
      <div class="mbody">${playerMarkup(r.id)}
      <div class="hint" style="text-align:center;margin-top:10px">${wagerLine}</div></div></div>`;
  };
  $("#scrim").classList.add("show");
  showPlayer();

  let completed=(await playVideo(r.id)).completed;
  while(!completed){
    const resume=await new Promise(done=>{
      $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">Paused</div><h2>${ep.title}</h2></div>
        <div class="mbody">
          <div class="hint">Your prediction is locked in — but the answer is in the episode, so the result stays sealed until you have watched it.</div>
          <div class="foot" style="margin-top:16px">
            <button class="btn ghost" id="epLater" style="flex:1">Leave it</button>
            <button class="btn pink" id="epResume" style="flex:2">Finish watching</button>
          </div></div></div>`;
      $("#epResume").onclick=()=>done(true);
      $("#epLater").onclick=()=>done(false);
    });
    if(!resume){
      log("\u23f8",`${ep.title} \u00b7 left before the end \u2014 result sealed`);
      closeEpisodeUi(); scheduleSaveState(); renderAll();
      return;                                   // pendingReveal deliberately survives
    }
    showPlayer();
    completed=(await playVideo(r.id)).completed;
  }

  state.pendingReveal=null;                     // watched: the answer is owed no longer
  scheduleSaveState();
  showEpisodeResult(ep,r);
}

/* The win/loss screen. Split out so both a fresh bet and a resumed one end the same way. */
function showEpisodeResult(ep,r){
  const {won,payout,wager}=r;
  // name the true answer when the player got it wrong
  const truth=ep.answers[ep.correct]?.text||"";
  const truthHtml=won?"":`<div style="margin-top:8px;font-size:12px;color:var(--muted)">The answer was <b style="color:var(--teal)">${truth}</b></div>`;
  let resultHtml="";
  if(wager>0){
    if(won){ resultHtml=`<div class="result"><div class="big win">You called it! \ud83c\udf89</div><div style="margin-top:6px">+<b style="color:var(--gold)">${fmt(payout)}</b> coins \u00b7 streak ${state.streak}</div></div>`; confetti(); }
    else { resultHtml=`<div class="result"><div class="big lose">Not this time</div><div style="margin-top:6px;color:var(--muted)">Lost your <b>${fmt(wager)}</b> wager \u00b7 streak reset</div>${truthHtml}</div>`; }
  }else{
    resultHtml=`<div class="result"><div class="big" style="color:var(--teal)">${won?"You'd have been right \u2713":"You'd have been wrong \u2717"}</div><div style="margin-top:6px;color:var(--muted)">No wager placed</div>${truthHtml}</div>`;
  }
  log(won?"\u2705":"\u274c",`${ep.title} \u00b7 ${wager>0?(won?`won +${fmt(payout)}`:`lost ${fmt(wager)}`):"watched (no wager)"}`);
  /* The episode left the queue when the bet was locked, so what is left is what is still
     waiting. Offer the next one straight from here: a binge should not mean closing back to
     the board and hunting for the button again between every episode. */
  const more=state.epQueue.length;
  const ctaHtml=more
    ? `<button class="btn pink wide" id="nextEp" style="margin-top:16px">Next episode \u2192
         <span class="badge" style="margin-left:8px">${more}</span></button>
       <button class="btn ghost wide" id="closeEp" style="margin-top:8px">Back to the board</button>`
    : `<button class="btn purple wide" id="closeEp" style="margin-top:16px">Back to the board</button>`;
  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">Episode complete</div><h2>${ep.title}</h2></div>
    <div class="mbody">${resultHtml}${ctaHtml}</div></div>`;
  $("#closeEp").onclick=()=>{ closeEpisodeUi(); renderAll(); };
  if(more) $("#nextEp").onclick=()=>openPrediction(Builders.firstUnwatchedId());
  renderAll();
}
