"use strict";
/* Visual effects & small DOM outputs: floats, activity log, toasts, confetti, dice faces, number tween. */
function floatAt(pos,text,color){
  const board=$("#board"),p=gridPos(pos);
  const el=document.createElement("div"); el.className="float"; el.textContent=text;
  el.style.color=color||"var(--gold)";
  el.style.left=((p.c+0.5)/11)*100+"%"; el.style.top=((p.r+0.3)/11)*100+"%";
  board.appendChild(el); setTimeout(()=>el.remove(),1000);
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
/* Shake the dice for cfg.diceRevealMs (faces scrambling so the result isn't spoiled),
   then land on the real roll. Awaited by roll(), so it paces the whole turn. */
async function rollDiceAnim(d1,d2){
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
/* ---------------- episode video ---------------- */
function mmss(s){ if(!isFinite(s)||s<0) s=0; const m=Math.floor(s/60); return m+":"+String(Math.floor(s%60)).padStart(2,"0"); }
/* Play an episode's video inside the already-open modal. Resolves when it ends.
   No controls attribute, so the browser offers no seek UI; forward seeks are snapped
   back to the furthest point actually watched. Click toggles pause/resume.
   Episodes with no video file fall back to the 🎬 placeholder for cfg.fallbackSceneMs. */
function playVideo(id){
  return new Promise(resolve=>{
    const wrap=$("#vWrap"), v=$("#epVideo");
    let done=false, maxTime=0;
    const finish=()=>{ if(done) return; done=true; try{ v&&v.pause(); }catch(e){} resolve(); };
    /* no video (or it failed to load) → keep the old placeholder behaviour */
    const fallback=()=>{
      if(done) return;
      if(wrap) wrap.innerHTML=`<div class="scene"><div class="play">🎬</div><div class="sceneBar" id="sBar"></div></div>`;
      const bar=$("#sBar");
      if(bar){ requestAnimationFrame(()=>{ bar.style.transition=`width ${cfg.fallbackSceneMs}ms linear`; bar.style.width="100%"; }); }
      setTimeout(finish,cfg.fallbackSceneMs);
    };
    if(!v){ fallback(); return; }

    /* Auto-play session is a batch economy tool — don't sit through 90s of footage.
       Read the length from metadata, log that the episode was watched, and move on.
       (Auto-roll deliberately does NOT skip: it simulates a real viewing session.) */
    if(typeof autoMode!=="undefined"&&autoMode==="session"){
      const title=Episodes.titleOf(id);
      let settled=false;
      const skip=(secs)=>{
        if(settled) return; settled=true;
        const len=isFinite(secs)&&secs>0?` · ${mmss(secs)} of footage`:"";
        log("⏩",`Auto-play watched <b>${title}</b>${len} (playback skipped)`);
        try{ v.pause(); v.removeAttribute("src"); v.load(); }catch(e){}   // abort the download
        finish();
      };
      if(isFinite(v.duration)&&v.duration>0) return skip(v.duration);
      v.addEventListener("loadedmetadata",()=>skip(v.duration));
      v.addEventListener("error",()=>skip(NaN));
      setTimeout(()=>skip(v.duration),2000);        // don't hang if metadata never arrives
      return;
    }

    v.addEventListener("error",fallback);
    v.addEventListener("ended",finish);
    v.addEventListener("contextmenu",e=>e.preventDefault());   // hide download / speed menu

    const fill=$("#vFill"), time=$("#vTime");
    v.addEventListener("timeupdate",()=>{
      if(v.currentTime>maxTime) maxTime=v.currentTime;
      const d=v.duration;
      if(isFinite(d)&&d>0){
        if(fill) fill.style.width=Math.min(100,(v.currentTime/d)*100)+"%";
        if(time) time.textContent=`${mmss(v.currentTime)} / ${mmss(d)}`;
      }
    });
    // block seeking ahead of what's actually been watched
    v.addEventListener("seeking",()=>{
      if(v.currentTime>maxTime+0.5) v.currentTime=maxTime;
    });

    /* Speed: press-and-hold the video for a temporary 2×, plus a latching 2× button.
       Effective rate is 2 whenever either is active. */
    const speedBtn=$("#speedBtn"), chip=$("#vSpeed");
    let latched=false, holding=false, pressTimer=null, suppressClick=false;
    const applyRate=()=>{
      const fast=latched||holding;
      v.playbackRate=fast?2:1;
      if(chip) chip.style.display=fast?"block":"none";
      if(speedBtn) speedBtn.classList.toggle("on",latched);
    };
    if(speedBtn) speedBtn.onclick=()=>{ latched=!latched; applyRate(); };
    wrap.addEventListener("pointerdown",()=>{
      if(done) return;
      pressTimer=setTimeout(()=>{
        holding=true;
        suppressClick=true;   // a hold must not also toggle pause
        applyRate();
      },cfg.longPressMs);
    });
    const endHold=()=>{
      clearTimeout(pressTimer);
      if(holding){ holding=false; applyRate(); }
    };
    ["pointerup","pointerleave","pointercancel"].forEach(e=>wrap.addEventListener(e,endHold));

    // click anywhere on the video toggles pause/resume (unless it was a hold)
    wrap.onclick=()=>{
      if(done) return;
      if(suppressClick){ suppressClick=false; return; }
      if(v.paused){ v.play().catch(()=>{}); wrap.classList.remove("paused"); }
      else { v.pause(); wrap.classList.add("paused"); }
    };

    // autoplay with sound; if the browser blocks it, retry muted and offer to unmute
    v.play().catch(()=>{
      v.muted=true;
      v.play().catch(fallback);
      const badge=$("#vSound");
      if(badge){
        badge.style.display="block";
        badge.onclick=(e)=>{ e.stopPropagation(); v.muted=false; badge.style.display="none"; };
      }
    });
  });
}

/* Tear down any blocking overlay/popup — used to recover from a mid-roll error. */
function clearOverlayFx(){
  const el=$("#centerFx"); el.className="centerfx"; el.innerHTML="";
  const sc=$("#scrim"); sc.onclick=null; sc.classList.remove("show"); sc.innerHTML="";
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
