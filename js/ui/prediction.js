"use strict";
/* Predict & watch — the bet, the playback, the result.
   Episode content comes from js/episodes.js; the outcome is decided by
   resolvePrediction() in js/game.js; the video is js/ui/player.js.
   Flow and betting rules are documented in episodes/README.md. */
let pending=null;

function closeEpisodeUi(){
  $("#scrim").classList.remove("show"); $("#scrim").innerHTML=""; pending=null;
}

/* A set of cards just completed an episode's page, so an episode came with it. Ask rather than
   launch: banking several and watching them back to back is how the show is actually consumed,
   and interrupting a roll streak to sit through a video is not a choice the game should make
   for the player.

   Declining costs nothing — the id stays in state.epQueue, and the 🎬 button on the board
   carries whatever is waiting there.

   Returns a promise so playEvents can await it: the unlock is part of the roll's event list
   now, and the roll loop has to wait for the answer the way it waits for every other popup. */
function openEpisodeUnlock(id){
  return new Promise(resolve=>{
    const ep=Episodes.get(id);
    if(!ep){ toast(`⚠ Missing episode file for <b>${id}</b>`); return resolve(); }
    const queued=state.epQueue.length;
    $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">Episode unlocked</div><h2>${ep.title}</h2></div>
      <div class="mbody">
        <div class="hint">You have the evidence. Call what happens next, then watch it.${
          queued>1?` You have <b style="color:var(--pink)">${queued}</b> waiting.`:""}</div>
        <div class="foot" style="margin-top:14px">
          <button class="btn ghost" id="bingeLater" style="flex:1">Binge later</button>
          <button class="btn pink" id="watchNow" style="flex:2">Watch now</button>
        </div></div></div>`;
    $("#scrim").classList.add("show");
    /* Straight into the prediction — openPrediction replaces this modal's contents, so the two
       screens read as one flow rather than a dialog that spawns another dialog. The promise is
       settled either way: the roll loop is waiting on the DECISION, not on the episode. */
    $("#watchNow").onclick=()=>{ resolve(); openPrediction(id); };
    $("#bingeLater").onclick=()=>{ closeEpisodeUi(); renderAll(); resolve(); };
  });
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
  /* THE ORDERING RULE, ENFORCED IN ONE PLACE. Pages fill in whatever order the cards fall, but
     the drama is serialised — episode 2's question gives away episode 1. So whatever id the
     caller asked for, what actually plays is the next episode of the STORY, and only once its
     page is complete. Every entry point (the library, the 🎬 button, the album's Watch button,
     the "next episode" button on the result screen) comes through here, so none of them can
     disagree about what is playable. */
  const next=Collection.firstUnwatchedId();
  if(next==null){
    const blocked=Collection.blockedBy();
    if(blocked){
      const [have,need]=Clues.progressFor(blocked);
      toast(`🔒 <b>${Episodes.titleOf(blocked)}</b> comes first — <b>${have}/${need}</b> clues`);
    }
    return;
  }
  if(wantId!=null&&wantId!==next)
    toast(`▶ Episodes play in order — starting <b>${Episodes.titleOf(next)}</b>`);
  const id=next;
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
  /* ASK THE QUESTION OUT LOUD. The two options used to sit directly under the evidence panel
     with no heading, in the same slate as everything around them — and the only affirmative
     button on the screen shipped `disabled`, cleared solely by tapping one of them. A player
     who did not guess that saw a dead primary CTA and two panels that looked like content.
     Note the sibling branch below: the case where the button is REMOVED explains itself in a
     full sentence, while the case where it is disabled explained nothing. */
  const askHtml=`<div class="optAsk">What happens next?</div>`;
  const optHtml=order.map((src,idx)=>{ const a=ep.answers[src];
    /* No per-answer odds (GDD 7.3): they leaked the answer, and they made a guess about a story
       read as a betting market. Every option pays the same, so the only thing to weigh is what
       you think happens next. */
    return `<button class="opt" data-idx="${idx}"><span>${a.text}</span></button>`;
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
         canBet?`<button class="btn pink" id="commitPred" style="flex:2" disabled>Pick an answer first</button>`:""}`;
  /* REVIEW THE EVIDENCE (GDD §7.2). The clues that unlocked this episode are the clues you are
     reasoning from, and they are shown here in full — not as a count. That is the whole payoff
     of making the gate and the edge one object: the thing you spent four draws collecting is
     the thing you now read before betting.

     Two players arrive here holding different evidence, because four are needed out of eight.
     So this list is genuinely personal, and a count in the HUD could never have been. */
  const evidence=Clues.evidenceFor(id);
  const clueHtml=`<div class="evidence">
      <button class="evHead" id="evToggle" aria-expanded="false">
        <span>🔍 Review the evidence</span>
        <span class="evCount">${evidence.length} clue${evidence.length===1?"":"s"}</span>
      </button>
      <div class="evBody" id="evBody" hidden>
        ${evidence.length
          ? `<div class="evList">${evidence.map((c,k)=>`
               <button class="evRow" data-clue="${k}">
                 <span class="evThumb">${dropFace(Clues.dropFor(id,c),{size:"sm"})}</span>
                 <span class="evText">${c.text}</span>
               </button>`).join("")}</div>`
          : `<p class="hint" style="margin:0">Nothing on file for this one.</p>`}
        <p class="hint" style="margin:8px 0 0">Modelled accuracy with this much to go on:
          <b style="color:var(--teal)">${Math.round(Economy.accuracyFor(evidence.length)*100)}%</b>
          (the floor is ${Math.round(Economy.accuracyFor(0)*100)}%).</p>
      </div>
    </div>`;
  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">Predict before you watch</div><h2>${ep.title}</h2></div>
    <div class="mbody"><div style="font-size:14px;color:var(--muted);margin-bottom:4px">${ep.question}</div>
    ${clueHtml}
    ${askHtml}
    ${optHtml}
    ${wagerHtml}
    <div class="foot">${footHtml}</div></div></div>`;
  $("#scrim").classList.add("show");
  const evT=$("#evToggle"), evB=$("#evBody");
  if(evT) evT.onclick=()=>{
    const open=evB.hidden;
    evB.hidden=!open; evT.setAttribute("aria-expanded",String(open));
    evT.classList.toggle("open",open);
  };
  /* TAP A PIECE OF EVIDENCE TO LOOK AT IT PROPERLY.

     The thumbnail is a real clue card, but at evidence-row size its own sentence is 6px — which
     is why the row carries the text beside it rather than relying on the face. The card is there
     because a clue IS a card and this is the screen where you handle your evidence; the zoom is
     there because a card you cannot look at is a picture of a card.

     The layer is fixed at z-index 85: above .scrim (80) so it clears the modal it is opened
     from, below .confetti (90). It lives INSIDE #scrim, so closeEpisodeUi() takes it with the
     rest and there is nothing extra to tear down. */
  $("#scrim").querySelectorAll(".evRow").forEach(row=>row.onclick=()=>{
    const c=evidence[+row.dataset.clue];
    if(!c) return;
    const zoom=document.createElement("div");
    zoom.className="evZoom";
    zoom.innerHTML=dropFace(Clues.dropFor(id,c),{size:"lg"});
    zoom.onclick=()=>zoom.remove();
    $("#scrim").appendChild(zoom);
  });
  $("#scrim").querySelectorAll(".opt").forEach(b=>b.onclick=()=>{
    $("#scrim").querySelectorAll(".opt").forEach(x=>x.classList.remove("sel"));
    b.classList.add("sel"); pending.sel=+b.dataset.idx;
    /* The button says what it WANTS while it cannot be pressed, and what it DOES once it can.
       A disabled control that already carries its final label has no way to explain itself. */
    const commit=$("#commitPred");
    if(commit){ commit.disabled=false; commit.textContent="Lock in prediction"; } });
  $("#watchLater").onclick=()=>{ closeEpisodeUi(); renderAll(); };   // stays queued
  /* SKIPPING WITHOUT PICKING LEAVES sel NULL, AND THAT IS THE WHOLE POINT.

     This line used to read `pending.sel = pending.sel ?? 0`, under a comment explaining that a
     wager of 0 meant the substituted answer could not score. That was true once. It stopped
     being true when the record moved off the stake and onto the call — resolvePrediction now
     decides with `called = auto || sel != null` (js/game.js), precisely so a skip lands on
     neither side, because a null pick would otherwise read as a loss.

     The `?? 0` defeated that guard from the outside: index 0 is not null, so every skip became
     a real call on a coin flip. Measured over 400 skips with nothing picked: 194 wins, 206
     losses, 194 "Called it" trophies. The one button a stuck player can actually press was
     quietly gambling with their lifetime record — and paying out trophies for it.

     A skip AFTER picking still counts, which is deliberate (CLAUDE.md, GDD §7.4): the record
     counts a call, not a stake, and a player who declines the bet and calls it right has still
     called it right. So `pending.sel` is passed through exactly as the player left it. */
  $("#skipPred").onclick=()=>{ pending.wager=0; pending.tier=null; playEpisode(); };
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
  const answerIdx=p.sel==null?null:p.order[p.sel];   // displayed position → index in the file
  const res=resolvePrediction({wager:p.wager,sel:answerIdx,correct:ep.correct,id:p.id,
                               auto:typeof autoMode!=="undefined"&&autoMode!==null});
  /* The reward rides on the sealed reveal, because the reveal can outlive the tab: a correct
     call that was banked has to still be announced when the player comes back to finish the
     episode, or the trophy would arrive with no explanation. */
  /* `called` rides along because the result screen has to know whether there was a guess to
     judge. Without it a skip renders "You'd have been wrong" — a verdict on a choice the player
     never made. It is persisted with the rest of the reveal, so a sealed result still knows. */
  state.pendingReveal={id:p.id,wager:p.wager,odds:res.odds,won:res.won,payout:res.payout,
                       called:res.called,
                       cardId:res.reward.card?res.reward.card.id:null,
                       trophy:!!res.reward.trophy};
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
    ? `You wagered <b style="color:var(--gold)">${fmt(r.wager)}</b> at \u00d7${(+r.odds||Economy.flatMultiplier()).toFixed(1)}`
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
  /* Watching is one of the three things status is made of, so a milestone can fall due here
     as surely as it can after a card lands. */
  await afterCollect();
  showEpisodeResult(ep,r);
}

/* The win/loss screen. Split out so both a fresh bet and a resumed one end the same way. */
function showEpisodeResult(ep,r){
  const {won,payout,wager}=r;
  /* Undefined, not false, for a reveal sealed before `called` existed — those all went through
     the substituting skip, so they were scored as calls and should still read as ones. */
  const called=r.called!==false;
  // name the true answer when the player got it wrong
  const truth=ep.answers[ep.correct]?.text||"";
  const truthHtml=won?"":`<div style="margin-top:8px;font-size:12px;color:var(--muted)">The answer was <b style="color:var(--teal)">${truth}</b></div>`;
  let resultHtml="";
  if(wager>0){
    if(won){ resultHtml=`<div class="result"><div class="big win">You called it! \ud83c\udf89</div><div style="margin-top:6px">+<b style="color:var(--gold)">${fmt(payout)}</b> coins \u00b7 streak ${state.streak}</div></div>`; confetti(); }
    else { resultHtml=`<div class="result"><div class="big lose">Not this time</div><div style="margin-top:6px;color:var(--muted)">Lost your <b>${fmt(wager)}</b> wager \u00b7 streak reset</div>${truthHtml}</div>`; }
  }else if(!called){
    /* Watched without guessing. There is nothing to be right or wrong about, so the screen says
       what happened and shows the answer — which is the interesting part either way. */
    resultHtml=`<div class="result"><div class="big" style="color:var(--muted)">You sat this one out</div><div style="margin-top:6px;color:var(--muted)">No prediction, no wager \u2014 it counts for neither</div><div style="margin-top:8px;font-size:12px;color:var(--muted)">The answer was <b style="color:var(--teal)">${truth}</b></div></div>`;
  }else{
    resultHtml=`<div class="result"><div class="big" style="color:var(--teal)">${won?"You'd have been right \u2713":"You'd have been wrong \u2717"}</div><div style="margin-top:6px;color:var(--muted)">No wager placed</div>${truthHtml}</div>`;
  }
  /* GDD 7.4: THE COLLECTIBLE IS THE HEADLINE, not the coin number. Every prediction pays one —
     won, lost or skipped — so a round is never one that gave you nothing, and a correct call
     also pays the trophy, which is the only thing in the game a box cannot contain. */
  const card=r.cardId?Cards.get(r.cardId):null;
  const trophy=r.trophy?Status.trophyOf(r.id):null;
  const rewardHtml=(card||trophy)?`<div class="predSpoils">
      ${trophy?`<div class="psItem">${dropFace({kind:"status",item:trophy},{size:"sm"})}
                  <span class="psTag">Called it</span></div>`:""}
      ${card?`<div class="psItem">${cardFace(card,{owned:true,count:Cards.count(card.id),size:"sm"})}
                  <span class="psTag">${won?"Your reward":"Yours anyway"}</span></div>`:""}
    </div>`:"";
  log(won?"\u2705":"\u274c",`${ep.title} \u00b7 ${wager>0?(won?`won +${fmt(payout)}`:`lost ${fmt(wager)}`):"watched (no wager)"}${
    card?` \u00b7 ${card.name}`:""}${trophy?" \u00b7 <b>trophy</b>":""}`);
  /* The episode left the queue when the bet was locked, so what is left is what is still
     waiting. Offer the next one straight from here: a binge should not mean closing back to
     the board and hunting for the button again between every episode. */
  /* "Next episode" counts what can be watched NEXT, not what is merely unlocked: offering it
     when the next in story order is still uncollected would be a button that toasts a refusal. */
  const more=Collection.firstUnwatchedId()?state.epQueue.length:0;
  /* THE SET ENDS HERE, not when its last card landed. Collecting is the means; watching is the
     point — so the celebration is owed to whichever episode turns out to be the last one seen,
     which is always the one that just finished. */
  const setDone=Collection.boardFinished();
  const ctaHtml=setDone
    ? `<button class="btn purple wide" id="finishSet" style="margin-top:16px">That is the set \u2014 see it \ud83c\udfc6</button>`
    : more
    ? `<button class="btn pink wide" id="nextEp" style="margin-top:16px">Next episode \u2192
         <span class="badge" style="margin-left:8px">${more}</span></button>
       <button class="btn ghost wide" id="closeEp" style="margin-top:8px">Back to the board</button>`
    : `<button class="btn purple wide" id="closeEp" style="margin-top:16px">Back to the board</button>`;
  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">Episode complete</div><h2>${ep.title}</h2></div>
    <div class="mbody">${resultHtml}${rewardHtml}${ctaHtml}</div></div>`;
  if($("#closeEp")) $("#closeEp").onclick=()=>{ closeEpisodeUi(); renderAll(); };
  if(setDone) $("#finishSet").onclick=()=>{ closeEpisodeUi(); renderAll(); showBoardComplete(); };
  else if(more) $("#nextEp").onclick=()=>openPrediction();
  renderAll();
}
