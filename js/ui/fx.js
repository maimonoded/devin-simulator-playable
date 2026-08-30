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
/* Coins and energy raining down, for the moment a box pops (js/ui/pack.js).

   Separate from diceConfetti on purpose: the shower should be made of the thing you just won.
   The dice shower stays what an energy win looks like everywhere else (spa) — this pair is for
   the box, where the whole point of the beat is showing WHAT was inside. */
function rainFx(cls, glyph, n, big) {
  for (let i = 0; i < n; i++) {
    const d = document.createElement("div"); d.className = cls; d.textContent = glyph;
    d.style.left = Math.random() * 100 + "vw";
    d.style.fontSize = rand(big ? 22 : 15, big ? 40 : 28).toFixed(0) + "px";
    d.style.setProperty("--drift", rand(-110, 110).toFixed(0) + "px");
    d.style.animation = `dicefall ${rand(1.4, 2.5)}s cubic-bezier(.35,.05,.6,1) ${Math.random() * 0.5}s forwards`;
    document.body.appendChild(d); setTimeout(() => d.remove(), 3200);
  }
}
function coinShower(big){ rainFx("coinfx", "🪙", big ? 26 : 18, big); }
function energyShower(){ rainFx("energyfx", "⚡", 16, true); }

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
/* Tear down any blocking overlay/popup — used to recover from a mid-roll error.
   A bonus mini-game has to be closed through its own handle rather than by emptying its host:
   dropping the iframe alone would leave the promise the roll loop is awaiting unresolved, and
   that is the soft-lock. bonusOpen lives in js/ui/minigame.js, which loads after this file. */
function clearOverlayFx(){
  const el=$("#centerFx"); el.className="centerfx"; el.innerHTML="";
  const sc=$("#scrim"); sc.onclick=null; sc.classList.remove("show"); sc.innerHTML="";
  /* The in-scene sheet is the box popup and the album, and the box popup blocks the roll loop
     the same way the Collect popup does — so it clears here too. Its promise is settled by the
     timers it set, which are cleared when the host is emptied and the popup's own auto-close
     resolve() short-circuits on the `done` flag. */
  const sh=$("#sheetHost"); if(sh){ sh.onclick=null; sh.classList.remove("show"); sh.innerHTML=""; }
  if(bonusOpen) bonusOpen.finish();
  /* A box caught mid-open has to be cleaned up too — and more importantly its promise settled,
     since roll()'s finally is what clears state.animating. */
  if(typeof packHudHide==="function") packHudHide();
  if(typeof use3d==="function"&&use3d()&&window.Board3D&&Board3D.available&&Board3D.cancelPack)
    Board3D.cancelPack();
}
/* A BIGGER CONFETTI, for the beat that earns one. confetti() is 40 pieces in one wave, which is
   right for an ordinary win and reads as a shrug when the moment is the third copy of a trophy.
   Three staggered waves from a wider spread, so it is still falling while the player reads the
   card rather than finishing before they have looked up. */
function bigConfetti(){
  confetti();
  setTimeout(confetti, 220);
  setTimeout(confetti, 480);
}

/* A card, held on the board's centre.

   THREE FACES, in order of how much the drop knows about itself:

     `drop`        — any box-drop shape, drawn by dropFace(): a clue's contact sheet, a card,
                     a Collectible's plaque. This is what lets a clue landed ON A TILE look
                     exactly like the same clue pulled out of a BOX, which it did not for a
                     long time — see the note in js/tiles/pool-tile.js drawClue().
     `collectible` — a card from the collection, drawn by cardFace(): the same face the album
                     and the box popup use. A card that looked like two different things in the
                     two places it appears is not a collection (CLAUDE.md).
     neither       — the generic panel, which is what a pool row's flavour outcome gets.

   dropFace() and cardFace() both live in js/ui/cardface.js, which loads AFTER this file. That
   is fine and already relied on: these are called at roll time, not at parse time.

   ---- WHAT THE CAPTION SAYS, AND HOW LONG IT SAYS IT FOR ----

   THE STATUS NUMBER IS THE HEADLINE. A card's face says what it is; the caption says what it
   was WORTH, because status is the thing the player is actually accumulating and it used to be
   a word in a log line. It is the number Cards.add already banked, not one computed here.

   The three beats differ because the three things differ (§4.1, §4.3):

     memory card   cfg.cardHoldMs      the moment is the picture; two seconds is enough
     status card   cfg.statusHoldMs    a trophy, so it also counts itself out of three — the
                                       whole reason to want another copy is legible on the card
     …its third    cfg.cardConvertMs   the copy that converts it into a Collectible. This is
                                       what a trophy was collected FOR, so it gets the big
                                       celebration
     a clue        cfg.clueHoldMs      the only face carrying a SENTENCE, and a sentence has to
                                       be read. Longest by default, and the only one that can be
                                       HELD: tapping it stops the clock and waits for Collect,
                                       because seven seconds is a guess about reading speed and
                                       the player is the one who knows

   THE AUTO-PLAY SESSION TAKES THE FAST PATH, exactly as showCollect does. That mode is the
   batch balancing tool with nobody at the keyboard, and these holds are now long enough that a
   long run would spend most of its wall clock looking at cards it is not showing anyone. */
function showCard(c){
  const el=$("#centerFx");
  /* `drops` is the general case and `drop` the one-item shorthand every older caller uses. */
  const drops=c.drops&&c.drops.length?c.drops:(c.drop?[c.drop]:null);
  const clue=!!(drops&&drops[0].kind==="clue");
  const pair=clue&&drops.length>1;
  const trophy=!!c.statusCard;
  const converted=!!c.converted;
  const celebrate=trophy&&converted;
  el.className="centerfx show card "+(c.positive?"win":"lose")+(clue?" holdable":"");

  /* TWO CLUES FROM ONE LANDING STAND SIDE BY SIDE, and give up their slips to do it. At half
     width the sentence typed on the card is six-pixel Courier — so the cards become the
     ARTEFACT and the prose moves underneath at full width, which is the same division of labour
     the wager screen's evidence board already uses. One clue keeps its slip and needs none of
     this. */
  const face=drops
    ? (pair
        ? `<div class="cbPair">${drops.map(d=>dropFace(d,{size:"lg"})).join("")}</div>`
        : dropFace(drops[0],{size:"lg"}))
    : c.collectible
    ? cardFace(c.collectible,{owned:true,size:"lg",count:c.count,converted:c.converted})
    : `<div class="playcard">
      <div class="pcTop">${c.top||"Plot Twist"}</div>
      <div class="pcIco">🃏</div>
      <div class="pcName">${c.name}</div>
      ${c.big?`<div class="pcAmt">${c.big}</div>`:""}
    </div>`;

  /* A status of 0 draws nothing rather than "+0": the beat only fires on a first or a
     converting copy, both of which pay, but cfg.statusFirstCopy is tunable to zero and a
     triumphant nought is worse than silence. */
  const pts=Math.round(+c.status||0);
  const need=Math.max(1,Math.round(+c.need||1));
  const caption=clue
    ? `${pair?`<div class="cbLines">${drops.map(d=>`<p>${d.clue.text}</p>`).join("")}</div>`:""}
       <div class="cbHint" id="cbHint">Tap to keep ${pair?"them":"it"} open</div>`
    : `<div class="cbCap">
        ${pts>0?`<div class="cbStat"><b>+${fmt(pts)}</b><i>status</i></div>`:""}
        ${trophy?`<div class="cbProg"><b>${Math.min(c.count,need)}</b> of <b>${need}</b> collected</div>`:""}
        ${celebrate?`<div class="cbDone">⭐ Collected! It goes on your shelf</div>`
          :converted?`<div class="ccWon">Collected — that is the third copy</div>`:""}
      </div>`;
  el.innerHTML=face+caption;

  if(celebrate) bigConfetti();
  else if(c.positive) confetti();
  if(c.energy) diceConfetti();

  const auto=typeof autoMode!=="undefined"&&autoMode==="session";
  const ms=auto?Math.max(50,+cfg.autoCollectMs||50)
    :c.holdMs!=null?(+c.holdMs||0)
    :clue?(+cfg.clueHoldMs||0)
    :celebrate?(+cfg.cardConvertMs||0)
    :trophy?(+cfg.statusHoldMs||0)
    :(+cfg.cardHoldMs||0);

  return new Promise(resolve=>{
    let done=false,held=false;
    const finish=()=>{
      if(done) return; done=true;
      clearTimeout(to);
      el.className="centerfx"; el.innerHTML="";
      resolve();
    };
    const to=setTimeout(finish,Math.max(200,ms));
    /* HOLD TO READ. Only a clue, and only for a human — a batch run has nobody to click Collect
       and would sit here forever. The card is the hit target rather than the whole overlay, so
       a stray tap on the board behind it does not freeze the beat. */
    if(clue&&!auto){
      /* Either card of a pair holds the beat — they arrived together and they leave together. */
      el.querySelectorAll(".ccard").forEach(card=>card.onclick=()=>{
        if(done||held) return;
        held=true; clearTimeout(to);
        const hint=$("#cbHint"); if(hint) hint.remove();
        const b=document.createElement("button");
        b.className="btn roll cbCollect"; b.textContent="Collect";
        b.onclick=finish;
        el.appendChild(b);
      });
    }
  });
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
/* A number counting up to its new value.

   WRITES THE VALUE FIRST, THEN ANIMATES. The animation is a bare requestAnimationFrame, which is
   suspended in a background tab — and this is TEXT, not a style value, so a suspended frame loop
   means the counter shows whatever the markup shipped with until the tab is looked at again. It
   did exactly that: a restored session sat on the HUD's hardcoded "0/25" while the state behind
   it said eleven of a hundred and fifty.

   So the final value is written synchronously and unconditionally, and the tween is decoration
   over the top of a HUD that is already correct. See CLAUDE.md on rAF and background tabs. */
function tweenNumber(el,from,to,fmtFn){
  if(!el) return;
  el.textContent=fmtFn(to);
  if(from===to||(typeof document!=="undefined"&&document.hidden)) return;
  const t0=performance.now(),dur=450;
  function step(now){ const k=Math.min(1,(now-t0)/dur); const v=from+(to-from)*(1-Math.pow(1-k,3));
    el.textContent=fmtFn(k>=1?to:v); if(k<1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}
