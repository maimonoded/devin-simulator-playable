"use strict";
/* Visual effects & small DOM outputs: floats, activity log, toasts, confetti, dice faces, number tween. */
/* One turn can pay out several times on the SAME tile — a two-item mystery box plus the tile's
   own payout is three floats, all projecting to one point. Stacked, they render as a single
   illegible smear and the player cannot tell what they actually collected. Each float in a
   burst therefore steps down a row; the counter resets once the previous one has faded, so a
   normal single payout is unaffected. */
const FLOAT_LIFE_MS=1000, FLOAT_STEP_PX=21;
let _floatSlot=0, _floatLast=0;
function floatSlot(){
  const now=performance.now();
  if(now-_floatLast>FLOAT_LIFE_MS) _floatSlot=0;   // screen is clear again
  _floatLast=now;
  return _floatSlot++;
}
function floatAt(pos,text,color){
  const el=document.createElement("div"); el.className="float"; el.textContent=text;
  el.style.color=color||"var(--gold)";
  const slot=floatSlot();
  if(typeof use3d==="function"&&use3d()){
    // project the tile into screen space and drop the float into the scene wrapper
    const p=Board3D.screenPosOf(pos,0.5);
    const host=$("#boardScene");
    if(!p||!host) return;
    el.style.left=p.x+"px"; el.style.top=(p.y+slot*FLOAT_STEP_PX)+"px";
    host.appendChild(el);
  }else{
    const board=$("#board"),p=gridPos(pos);
    el.style.left=((p.c+0.5)/11)*100+"%";
    el.style.top=`calc(${((p.r+0.3)/11)*100}% + ${slot*FLOAT_STEP_PX}px)`;
    board.appendChild(el);
  }
  setTimeout(()=>el.remove(),FLOAT_LIFE_MS);
}
function floatToken(text,color){ floatAt(state.pos,text,color); }
function log(icon,html){
  const l=$("#log"); const tod=((state.clock%1440)+1440)%1440;
  let h=Math.floor(tod/60),m=Math.floor(tod%60),ap=h<12?"a":"p",h12=h%12||12;
  const d=document.createElement("div"); d.className="logi";
  d.innerHTML=`<span class="tm">D${state.day} ${h12}:${String(m).padStart(2,"0")}${ap}</span><span>${icon} ${html}</span>`;
  l.prepend(d); while(l.children.length>60) l.lastChild.remove();
}
function toast(msg){ const t=document.createElement("div"); t.className="toast"; t.innerHTML=msg;
  $("#toasts").appendChild(t); setTimeout(()=>{t.style.opacity="0";t.style.transition="opacity .4s";setTimeout(()=>t.remove(),400)},1900); }
function confetti(){ const cols=["#ffcb5c","#8b6dff","#2dd4bf","#ff6fa5"];
  for(let i=0;i<40;i++){ const c=document.createElement("div"); c.className="confetti";
    c.style.left=Math.random()*100+"vw"; c.style.background=cols[i%4];
    c.style.animation=`fall ${rand(1.4,2.4)}s ease-in ${Math.random()*0.3}s forwards`;
    document.body.appendChild(c); setTimeout(()=>c.remove(),2800); } }
/* Tumbling dice, layered on top of the regular confetti for wins that include energy. */
function diceConfetti(){
  for(let i=0;i<18;i++){
    const d=document.createElement("div"); d.className="dicefx"; d.textContent="🎲";
    d.style.left=Math.random()*100+"vw";
    d.style.fontSize=rand(16,30).toFixed(0)+"px";
    d.style.setProperty("--drift",rand(-90,90).toFixed(0)+"px");
    d.style.animation=`dicefall ${rand(1.5,2.6)}s cubic-bezier(.35,.05,.6,1) ${Math.random()*0.45}s forwards`;
    document.body.appendChild(d); setTimeout(()=>d.remove(),3200);
  }
}
/* Show the roll for cfg.diceRevealMs, then land on the real numbers. Awaited by roll(), so
   it paces the whole turn either way.

   Two presentations behind one call. On the 3D board the dice are thrown onto the middle of
   the board (js/ui/dice3d.js); otherwise the DOM pair shakes with its faces scrambling. The
   fallback is not just for cfg.board3d = 0 — it also covers die.glb failing to load.

   It asks whether the model FAILED, not whether it has arrived: a throw made while the file is
   still downloading is queued by Dice3D and appears when it lands, and the promise resolves on
   cfg.diceRevealMs either way, so the turn is paced correctly. Falling back on "not arrived
   yet" would instead shake a DOM pair that syncDiceMode is deliberately keeping hidden. */
async function rollDiceAnim(d1,d2){
  if(use3d() && cfg.dice3d && Board3D.diceFailed && !Board3D.diceFailed()){
    setDice(d1,d2);                  // keep the DOM pair truthful for anything still reading it
    await Board3D.throwDice([d1,d2]);
    return;
  }
  const a=$("#die1"),b=$("#die2");
  a.classList.add("roll"); b.classList.add("roll");
  const total=Math.max(0,cfg.diceRevealMs), t0=performance.now();
  const tick=Math.max(30,Math.min(70,total/3||30));
  let left;
  // scramble until the window is nearly up, clipping the last wait so the reveal lands on
  // cfg.diceRevealMs rather than overshooting a whole tick. The >25 floor avoids queueing
  // pointless sub-frame timers (which browsers clamp anyway).
  while((left=total-(performance.now()-t0))>25){
    setDice(Math.floor(rand(1,7)),Math.floor(rand(1,7)));
    await sleep(Math.min(tick,left));
  }
  setDice(d1,d2);                                  // reveal
  a.classList.remove("roll"); b.classList.remove("roll");
}
function setDice(a,b){
  const faces={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  [["#die1",a],["#die2",b]].forEach(([sel,v])=>{ const d=$(sel); d.innerHTML="";
    for(let k=0;k<9;k++){ const p=document.createElement("div"); p.className="pip"+(faces[v].includes(k)?"":" off"); d.appendChild(p);} });
}
/* Center-of-board win/loss reveal. Holds for r.ms (or cfg.revealMs) before resolving, so the
   roll loop (and auto-play) waits for it. Wins get confetti, losses a sad droop. */
function showReveal(r){
  const el=$("#centerFx");
  el.className="centerfx show "+(r.positive?"win":"lose");
  el.innerHTML=`<div class="cico">${r.positive?"🎉":"😢"}</div>
    <div class="cbig">${r.big}</div><div class="csub">${r.sub||""}</div>`;
  if(r.positive) confetti();
  if(r.energy) diceConfetti();   // energy wins get a dice shower on top
  return sleep(r.ms??cfg.revealMs).then(()=>{ el.className="centerfx"; el.innerHTML=""; });
}
/* Clue found. Blocking, like the train's Collect popup, because a clue is the only collectible
   in the game and the album is the only place it ever shows up again — a float would scroll
   past before the player read what they got.

   Mounted in #sheetHost, INSIDE the board scene, so it is framed by the game window rather than
   by the browser. Auto-closes after cfg.clueCollectMs; an auto-play session uses the same fast
   path the train popup does, so a batch run is never held up. */
function showClue(c){
  return new Promise(resolve=>{
    const auto=typeof autoMode!=="undefined"&&autoMode==="session";
    const ms=auto?Math.max(50,cfg.autoCollectMs):Math.max(0,cfg.clueCollectMs);
    const host=$("#sheetHost");
    const names=(c.names&&c.names.length?c.names:[]).map(n=>`<div class="clueFound">🔍 ${n}</div>`).join("");
    host.innerHTML=`<div class="modal clueModal"><div class="top">
        <div class="eyebrow">Clue found</div><h2>${c.count>1?`${c.count} new clues`:"A new clue"}</h2></div>
      <div class="mbody">
        ${names||`<div class="clueFound">🔍 +${c.count} for the album</div>`}
        <div class="hint" style="margin-top:8px">Filed in your album · raises your next prediction's accuracy</div>
        <button class="btn teal wide" id="clueBtn" style="margin-top:14px">Collect</button>
      </div></div>`;
    host.classList.add("show");
    let done=false;
    const finish=()=>{
      if(done) return; done=true;
      clearTimeout(t); host.classList.remove("show"); host.innerHTML=""; host.onclick=null;
      resolve();
    };
    const t=setTimeout(finish,ms);
    $("#clueBtn").onclick=finish;
    host.onclick=(e)=>{ if(e.target===host) finish(); };   // tapping outside dismisses it too
  });
}

/* Tear down any blocking overlay/popup — used to recover from a mid-roll error.
   A bonus mini-game has to be closed through its own handle rather than by emptying its host:
   dropping the iframe alone would leave the promise the roll loop is awaiting unresolved, and
   that is the soft-lock. bonusOpen lives in js/ui/minigame.js, which loads after this file. */
function clearOverlayFx(){
  const el=$("#centerFx"); el.className="centerfx"; el.innerHTML="";
  const sc=$("#scrim"); sc.onclick=null; sc.classList.remove("show"); sc.innerHTML="";
  // the in-scene sheet (clue popup, album) blocks the roll loop the same way, so it clears too
  const sh=$("#sheetHost"); if(sh){ sh.onclick=null; sh.classList.remove("show"); sh.innerHTML=""; }
  if(bonusOpen) bonusOpen.finish();
}
/* Drawn deck card, flipped onto the board centre and held for cfg.deckCardMs. */
function showCard(c){
  const el=$("#centerFx");
  el.className="centerfx show card "+(c.positive?"win":"lose");
  el.innerHTML=`<div class="playcard">
      <div class="pcTop">Plot Twist</div>
      <div class="pcIco">🃏</div>
      <div class="pcName">${c.name}</div>
      ${c.big?`<div class="pcAmt">${c.big}</div>`:""}
    </div>`;
  if(c.positive) confetti();
  if(c.energy) diceConfetti();
  return sleep(cfg.deckCardMs).then(()=>{ el.className="centerfx"; el.innerHTML=""; });
}
/* Blocking Collect popup (train tiles). Resolves on click, or automatically after a
   random cfg.collectMinSec–collectMaxSec so an idle session keeps moving.
   Auto-roll deliberately gets the same player-facing treatment — it simulates a real
   session. Only "auto-play session" (the internal balancing tool) self-collects fast,
   after cfg.autoCollectMs, so a train tile doesn't stall a long batch run. */
function showCollect(c){
  return new Promise(resolve=>{
    const auto=typeof autoMode!=="undefined"&&autoMode==="session";
    const secs=auto
      ? Math.max(0.05,cfg.autoCollectMs/1000)
      : rand(Math.min(cfg.collectMinSec,cfg.collectMaxSec),Math.max(cfg.collectMinSec,cfg.collectMaxSec));
    $("#scrim").innerHTML=`<div class="modal collectModal"><div class="top">
        <div class="eyebrow">Train bonus</div><h2>${c.sub||"You won"}</h2></div>
      <div class="mbody"><div class="collectAmt">🪙 ${c.big}</div>
        <button class="btn roll wide" id="collectBtn" style="margin-top:16px">Collect</button>
        <div class="hint" style="text-align:center;margin-top:8px">${auto
          ? "auto-collecting…"
          : `auto-collects in <b id="collectCd">${Math.ceil(secs)}</b>s`}</div>
      </div></div>`;
    $("#scrim").classList.add("show");
    confetti();
    let done=false;
    const cd=$("#collectCd"); const t0=performance.now();
    const iv=cd?setInterval(()=>{
      const left=Math.ceil(secs-(performance.now()-t0)/1000);
      cd.textContent=Math.max(0,left);
    },250):null;
    const finish=()=>{
      if(done) return; done=true;
      clearTimeout(to); if(iv) clearInterval(iv);
      $("#scrim").onclick=null;
      $("#scrim").classList.remove("show"); $("#scrim").innerHTML="";
      resolve();
    };
    const to=setTimeout(finish,secs*1000);
    $("#collectBtn").onclick=finish;
    // clicking the backdrop collects too, so a long auto-close never traps the player
    $("#scrim").onclick=(e)=>{ if(e.target===$("#scrim")) finish(); };
  });
}
function tweenNumber(el,from,to,fmtFn){
  const t0=performance.now(),dur=450;
  function step(now){ const k=Math.min(1,(now-t0)/dur); const v=from+(to-from)*(1-Math.pow(1-k,3));
    el.textContent=fmtFn(v); if(k<1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}
