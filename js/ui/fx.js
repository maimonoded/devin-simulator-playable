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
/* Things raining down, for the moment a reward lands.

   One shower per kind of thing, because the shower should be made of what you just won — that
   was the whole point of the box's coin/clue pair and it now covers cards and tickets too. */
function rainFx(cls, glyph, n, big) {
  for (let i = 0; i < n; i++) {
    const d = document.createElement("div"); d.className = cls; d.textContent = glyph;
    d.style.left = Math.random() * 100 + "vw";
    d.style.fontSize = rand(big ? 22 : 15, big ? 40 : 28).toFixed(0) + "px";
    d.style.setProperty("--drift", rand(-110, 110).toFixed(0) + "px");
    d.style.animation = `fxfall ${rand(1.4, 2.5)}s cubic-bezier(.35,.05,.6,1) ${Math.random() * 0.5}s forwards`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 3200);
  }
}
function coinShower(big){ rainFx("coinfx", "🪙", big ? 26 : 18, big); }
function cardShower(){ rainFx("cardfx", "🃏", 16, true); }
function ticketShower(){ rainFx("ticketfx", "🎟", 16, true); }
/* One place that turns a reveal/card event's `shower` string into the right rain. */
function playShower(kind){
  if(kind==="cards") cardShower();
  else if(kind==="tickets") ticketShower();
}

/* Opening a mystery box: it floats to the middle of the screen, swells and pops, and what was
   inside rains down. Blocks the roll loop until the box is gone and the clue sheet (if there was
   one) has been dismissed.

   The clue sheet is on its own timer measured from the START of the whole beat, so it can be
   tuned to slide in while the confetti is still falling rather than queueing politely after it.
   That is why this owns the sheet rather than leaving it to the payout event's ev.clue.

   Resolves — never rejects — on every path, including no WebGL and auto-play. */
async function showBoxOpen(b){
  const auto=typeof autoMode!=="undefined"&&autoMode==="session";
  /* The batch balancing tool takes the reward without the ceremony, like everything else. */
  if(auto) return b.clue?showClue(b.clue):undefined;

  /* 1-2 · fly to the middle and pop */
  await ((use3d()&&window.Board3D&&Board3D.available)
    ? Board3D.openBox(b.tile)
    : sleep(Math.max(0,cfg.boxRiseMs||0)+Math.max(0,cfg.boxSwellMs||0)));

  confetti();
  if(b.coins) coinShower(b.coins>=(cfg.boxCoins||0)*2);     // a bigger haul rains harder
  if(b.tickets) ticketShower();

  /* 3 · the winnings, where the box just was. A float over the token is too small and too far
     from where the player is looking after a burst in the middle of the board. */
  const clueMs=Math.max(0,cfg.boxCluePopupMs||0);
  const hold=b.clue?Math.max(cfg.boxSpoilsMs||0,clueMs):Math.max(0,cfg.boxSpoilsMs||0);
  showBoxSpoils(b,hold);

  /* 4 · then, and only then, the clue sheet — counted from the moment the numbers appeared. */
  if(b.clue){ await sleep(clueMs); await showClue(b.clue); }
  else await sleep(hold);
}

/* What the box held, centred where it popped. Not a blocking modal — it fades on its own while
   the caller waits, so the clue sheet can arrive over it rather than after an empty pause. */
function showBoxSpoils(b,ms){
  const el=$("#centerFx");
  const rows=[];
  if(b.coins) rows.push(`<div class="spoilRow"><span class="spoilIco">🪙</span><span class="spoilAmt">+${fmt(b.coins)}</span></div>`);
  if(b.tickets) rows.push(`<div class="spoilRow"><span class="spoilIco">🎟</span><span class="spoilAmt teal">+${b.tickets}</span></div>`);
  if(b.clue&&b.clue.count) rows.push(`<div class="spoilRow"><span class="spoilIco">🔍</span><span class="spoilAmt teal">+${b.clue.count}</span></div>`);
  if(!rows.length) return;
  el.className="centerfx show spoils";
  el.innerHTML=`<div class="spoilTop">Mystery Box</div>${rows.join("")}`;
  setTimeout(()=>{
    /* Only clear if nothing else has taken the panel over in the meantime — a reveal from the
       tile underneath can land while this is still up. */
    if(el.classList.contains("spoils")){ el.className="centerfx"; el.innerHTML=""; }
  },Math.max(200,ms));
}

/* The pulled card, held face up in the middle of the screen for cfg.pullRevealMs. Awaited by
   pull(), so it paces the whole turn either way.

   Two presentations behind one call: on the 3D board the card flies off the deck to the centre
   (js/ui/shoe3d.js), otherwise a flat DOM card fades up in the middle. The fallback is not just
   for cfg.shoe3d = 0 — it also covers the card model failing to load.

   It asks whether the 3D deck FAILED, not whether it has arrived. Those differ for the few
   hundred ms the model takes to download, and keying off "arrived" is what used to make the
   fallback flash on every page load. A pull in that window is animated by the 3D deck a
   fraction late rather than by the DOM card.

   RESOLVES ON A TIMER, NOT ON A FRAME. Whichever presentation runs, this settles at
   cfg.pullRevealMs from a setTimeout. The tween loop is driven by requestAnimationFrame, which
   a background tab suspends — and the pull is the core loop, so a frame-driven resolve would
   leave pull() awaiting forever with state.animating stuck true and the board soft-locked. */
async function pullCardAnim(card){
  if(use3d() && cfg.shoe3d && window.Board3D && Board3D.shoeFailed && !Board3D.shoeFailed()){
    await Board3D.pullCard(card);
    return;
  }
  showFlatCard(card);
  await sleep(Math.max(0,cfg.pullRevealMs));
  const el=$("#centerFx");
  if(el.classList.contains("pullcard")){ el.className="centerfx"; el.innerHTML=""; }
}
/* The fallback presentation: the card's face, centred, with no 3D involved.

   The SAME canvas the 3D board textures — CardArt owns the deck's look, and the two
   presentations must not drift into being two different decks. Appended rather than drawn to,
   so the painted override repaints it in place here too. */
function showFlatCard(card){
  const el=$("#centerFx");
  const ticket=(typeof Shoe!=="undefined"&&Shoe.isTicket(card));
  el.className="centerfx show pullcard"+(ticket?" ticket":"");
  el.innerHTML="";
  const wrap=document.createElement("div");
  wrap.className="pcard";
  wrap.appendChild(CardArt.face(card));
  const sub=document.createElement("div");
  sub.className="csub";
  sub.textContent=ticket?"Ticket!":"Move "+Shoe.rank(card);
  el.appendChild(wrap); el.appendChild(sub);
}
/* Center-of-board win/loss reveal. Holds for r.ms (or cfg.revealMs) before resolving, so the
   roll loop (and auto-play) waits for it. Wins get confetti, losses a sad droop. */
function showReveal(r){
  const el=$("#centerFx");
  el.className="centerfx show "+(r.positive?"win":"lose");
  el.innerHTML=`<div class="cico">${r.positive?"🎉":"😢"}</div>
    <div class="cbig">${r.big}</div><div class="csub">${r.sub||""}</div>`;
  if(r.positive) confetti();
  playShower(r.shower);   // rain made of whatever was won
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
  /* A box caught mid-flight has to be cleaned up too — and more importantly its promise settled,
     since roll()'s finally is what clears state.animating. */
  if(typeof use3d==="function"&&use3d()&&window.Board3D&&Board3D.available) Board3D.cancelBoxFx();
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
  playShower(c.shower);
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
