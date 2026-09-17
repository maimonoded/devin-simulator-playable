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
/* Coins and energy raining down, for the moment a mystery box pops.

   Separate from diceConfetti on purpose: the shower should be made of the thing you just won.
   The dice shower stays what an energy win looks like everywhere else (spa, deck) — this pair is
   for the box, where the whole point of the beat is showing WHAT was inside. */
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

/* Opening a mystery box: it floats to the middle of the screen, swells and pops, and what was
   inside rains down. Blocks the roll loop until the box is gone.

   Three steps: rise and pop, the shower of what was inside, then the winnings held for
   cfg.boxSpoilsMs. There was a fourth — a clue sheet on its own timer — and clues are gone, so
   the hold is now the whole tail of the beat rather than a floor under the sheet's timing.

   Resolves — never rejects — on every path, including no WebGL. */
async function showBoxOpen(b){
  /* 1-2 · fly to the middle and pop */
  await ((use3d()&&window.Board3D&&Board3D.available)
    ? Board3D.openBox(b.tile)
    : sleep(Math.max(0,cfg.boxRiseMs||0)+Math.max(0,cfg.boxSwellMs||0)));

  confetti();
  if(b.coins) coinShower(b.coins>=(cfg.boxCoins||0)*2);     // a bigger haul rains harder
  if(b.energy) energyShower();

  /* 3 · the winnings, where the box just was. A float over the token is too small and too far
     from where the player is looking after a burst in the middle of the board. */
  const hold=Math.max(0,cfg.boxSpoilsMs||0);
  showBoxSpoils(b,hold);
  await sleep(hold);
}

/* What the box held, centred where it popped. Not a blocking modal — it clears on its own timer
   while the caller waits out the same hold, and it checks it still owns the panel before doing
   so: a reveal from the tile underneath can land on top of it while it is up. */
function showBoxSpoils(b,ms){
  const el=$("#centerFx");
  const rows=[];
  if(b.coins) rows.push(`<div class="spoilRow"><span class="spoilIco">🪙</span><span class="spoilAmt">+${fmt(b.coins)}</span></div>`);
  if(b.energy) rows.push(`<div class="spoilRow"><span class="spoilIco">⚡</span><span class="spoilAmt teal">+${b.energy}</span></div>`);
  if(!rows.length) return;
  el.className="centerfx show spoils";
  el.innerHTML=`<div class="spoilTop">Mystery Box</div>${rows.join("")}`;
  setTimeout(()=>{
    /* Only clear if nothing else has taken the panel over in the meantime — a reveal from the
       tile underneath can land while this is still up. */
    if(el.classList.contains("spoils")){ el.className="centerfx"; el.innerHTML=""; }
  },Math.max(200,ms));
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
/* `style` names a non-standard throw — today only "reshoot", the jail corner's free throws,
   which are coloured so they cannot be mistaken for the roll the stake paid for. It reaches
   both presentations: board3d.js tints the 3D pair, and setDice below puts a class on the DOM
   pair so css/board.css owns that look. Omitted is the normal pair. */
async function rollDiceAnim(d1,d2,style){
  if(use3d() && cfg.dice3d && Board3D.diceFailed && !Board3D.diceFailed()){
    setDice(d1,d2,style);            // keep the DOM pair truthful for anything still reading it
    await Board3D.throwDice([d1,d2],style);
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
    setDice(Math.floor(rand(1,7)),Math.floor(rand(1,7)),style);
    await sleep(Math.min(tick,left));
  }
  setDice(d1,d2,style);                            // reveal
  a.classList.remove("roll"); b.classList.remove("roll");
}
function setDice(a,b,style){
  const faces={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  [["#die1",a],["#die2",b]].forEach(([sel,v])=>{ const d=$(sel);
    /* The throw's colour is a class, not an inline style, so both looks live in css/board.css.
       Set on EVERY call rather than only on a coloured throw: this runs on each scramble tick
       and on the reveal, so the normal pair is guaranteed to come back uncoloured without
       anyone having to remember to clean up after the jail. */
    d.classList.toggle("reshoot",style==="reshoot");
    d.innerHTML="";
    for(let k=0;k<9;k++){ const p=document.createElement("div"); p.className="pip"+(faces[v].includes(k)?"":" off"); d.appendChild(p);} });
}
/* ---------------- the Reshoot corner's escape attempt ----------------

   Blocking, like reveal/collect/card, so the roll loop — and therefore auto-roll — waits it out
   instead of rolling over it.

   NOTHING IS DECIDED HERE. js/tiles/reshoot-tile.js rolled these throws, granted the energy or
   took the fine, and handed the finished result over on the event; this only shows it. The
   button below REVEALS r.throws[i], it does not roll it — the same contract the bonus games
   have (js/ui/minigame.js): the engine owns the money, the presentation owns the drama. A click
   that could change the outcome would have broken it.

   THREE PARTS, and the first one is the whole point:

     1 · THE DELAY. A clapperboard snaps shut over the middle of the board and holds for
         cfg.reshootDelayMs before a single die is thrown. This used to go straight to coloured
         dice arriving from nowhere; a player has to be told they are stuck, and why, before the
         mechanic starts. It is a film set — the take went wrong and the day is being re-shot.
     2 · THE THROWS, one per click of a pink button standing where the playbar was. The normal
         controls are hidden for the duration — most of all the STAKE, because these throws are
         free and the multiplier does not scale them, so a stake button still sitting there
         would be a lie. The pink is COLORS.dice.reshoot, the colour the dice are thrown in, so
         the button and what it puts on the board read as one thing and neither can be mistaken
         for the gold Roll the turn's energy actually paid for.
     3 · THE OUTCOME, the same centre reveal as before.

   IT SETTLES EXACTLY ONCE ON EVERY PATH. roll()'s finally in js/ui/main.js is the only thing
   that clears state.animating, so a promise left pending soft-locks the board with Roll
   disabled forever. Being an async function is half of that — its promise settles once by
   construction — and `cancelled` is the other half: teardown() wakes whatever wait is parked
   and every step re-checks the flag, so a torn-down beat runs off the end of the function
   rather than parking on a promise nobody will resolve. Paths covered: every throw clicked, a
   double ending it early, nobody ever clicking (the idle timer), auto-roll (its own, much
   shorter one), a hidden tab (both timers are setTimeout, which a background tab throttles but
   still fires), and clearOverlayFx() tearing it down because a roll died.

   AND THE CONTROLS COME BACK ON ALL OF THEM, for the same reason: teardown() runs in a finally,
   and clearOverlayFx() clears the class too. It hides the playbar with a class on <body> rather
   than by setting display on three elements, because renderAll() re-renders their disabled
   state constantly and can land anywhere inside this beat — a class it knows nothing about is
   the one thing it cannot fight, and one line puts all three back. */

/* The live beat, so clearOverlayFx() can tear one down after a mid-roll error. The same handle
   the bonus games keep (bonusOpen, js/ui/minigame.js), for the same reason. */
let reshootOpen=null;

/* The mode's markup, filled into the static #reshootUI host. Built here rather than sitting in
   index.html so the host empties back to nothing on teardown — #centerFx and #bonusHost are the
   precedent. `total` is what the player is promised, not how many throws the tile actually
   needed: getting out on the first of three is still "Throw 1 of 3".

   The button is LAST, below the countdown, so it lands on the same spot Roll occupies — the
   bar it replaces is pinned to the same bottom edge, and the control a player is already
   reaching for should not move when the mode changes. */
function reshootMarkup(total){
  return `<div class="rsSlate">
      <div class="rsClap">
        <div class="rsClapTop"></div>
        <div class="rsClapBody">
          <div class="rsCut">CUT!</div>
          <div class="rsWhy">That take is unusable.</div>
        </div>
      </div>
      <div class="rsScene">The day is being re-shot</div>
    </div>
    <div class="rsBar">
      <div class="rsTag">🎬 Reshoot · production halted</div>
      <div class="rsHint">These throws are <b>free</b> — they cost no energy.
        Roll a <b>double</b> to get back on set and win the energy back.
        Miss all ${total} and the day costs you.</div>
      <div class="rsCd">throws itself in <b id="rsCdN">–</b>s</div>
      <button class="btn pink rsThrow" id="rsThrowBtn">🎬 Throw 1 of ${total}</button>
    </div>`;
}

async function showReshoot(r){
  const host=$("#reshootUI");
  /* No host — a stale index.html, or a page built without it. Play the old automatic replay
     rather than nothing at all: the promise still settles and the money is untouched. Exactly
     what showMinigame does when #bonusHost is missing. */
  if(!host) return showReshootAuto(r);

  const n=r.throws.length;
  /* Math.max against n as well as the floor of 1: the drawer can be edited mid-roll, and
     "Throw 3 of 2" would be worse than a stale total. */
  const total=Math.max(n,Math.max(1,Math.round(cfg.reshootThrows)));

  let cancelled=false, wake=null, cdIv=null;
  let btn=null, cdRow=null, cdN=null;
  const timers=new Set();
  const at=(ms,fn)=>{ const t=setTimeout(()=>{ timers.delete(t); fn(); },ms); timers.add(t); return t; };
  const cancel=(t)=>{ if(t){ clearTimeout(t); timers.delete(t); } };
  const stopCd=()=>{ if(cdIv){ clearInterval(cdIv); cdIv=null; } };
  /* Every wait below parks on `wake`, and this is the only thing that resolves one. Calling it
     twice is a no-op, which is what lets a click and its own idle timer race safely. */
  const nudge=()=>{ const w=wake; wake=null; if(w) w(); };
  const hold=(ms)=>new Promise(res=>{
    if(cancelled||!(ms>0)) return res();
    wake=res; at(ms,nudge);
  });
  const teardown=()=>{
    cancelled=true;
    timers.forEach(clearTimeout); timers.clear(); stopCd();
    host.classList.remove("show"); host.innerHTML="";
    document.body.classList.remove("reshooting","reshootAuto");
    reshootOpen=null;
    nudge();
  };
  /* Resolves when the player clicks, when the idle timer gives up on them, when auto-roll's own
     shorter one fires, or when the beat is torn down — whichever comes first, once. */
  const waitForThrow=()=>new Promise(res=>{
    if(cancelled) return res();
    /* Nobody is at the keyboard in auto-roll, so it throws for itself after a short gap. It
       deliberately does NOT take the idle window: three throws at twelve seconds each would
       park the loop for most of a minute, and unlike the bonus game's collect tray there is
       nothing to look at while it waits. The idle window is for a human who wandered off
       mid-attempt — cfg.collectMinSec/collectMaxSec is the precedent for having one at all. */
    const auto=typeof autoMode!=="undefined"&&autoMode==="roll";
    /* FLOORED, never zero. A window of 0 used to arm no timer at all, so a throw nobody clicked
       parked forever — state.animating stuck true and the board soft-locked with Roll gone. A
       drawer sitting at 0 is a tuning value, not a licence to hang. */
    const ms=Math.max(250,(auto?cfg.reshootAutoMs:cfg.reshootIdleMs)||0);
    let idle=null;
    const go=()=>{
      /* Cancel our own timer. Without this a click left its setTimeout pending, and when it
         later fired it called nudge() — resolving whichever wait was parked BY THEN, which is
         the NEXT throw. The player clicked once and two throws went past. */
      cancel(idle);
      if(btn) btn.onclick=null; stopCd(); if(cdRow) cdRow.classList.remove("live"); nudge();
    };
    wake=res;
    if(btn) btn.onclick=go;
    idle=at(ms,go);
    /* A countdown only where there is one to read — auto-roll's gap is under a second. */
    if(cdN&&cdRow&&ms>=2000){
      const t0=performance.now();
      cdRow.classList.add("live");
      cdN.textContent=String(Math.ceil(ms/1000));
      cdIv=setInterval(()=>{
        cdN.textContent=String(Math.max(0,Math.ceil((ms-(performance.now()-t0))/1000)));
      },250);
    }else if(cdRow) cdRow.classList.remove("live");
  });
  reshootOpen={finish:teardown};

  try{
    /* The class is what hides the playbar (css/board.css). Set before the markup, so the normal
       controls are never on screen at the same time as the slate. */
    document.body.classList.add("reshooting");
    /* Auto-roll keeps the Roll button, because Roll IS the stop control — CLAUDE.md states the
       invariant, and hiding it mid-beat left a running loop with no way out. The library and
       stake buttons still go: the point of the mode is that the stake is not in play. */
    if(typeof autoMode!=="undefined"&&autoMode==="roll") document.body.classList.add("reshootAuto");
    host.innerHTML=reshootMarkup(total);
    host.classList.add("show");
    btn=host.querySelector("#rsThrowBtn");
    cdRow=host.querySelector(".rsCd");
    cdN=host.querySelector("#rsCdN");
    /* The button is the only thing below that is dereferenced without a guard, so this is the
       one place it is worth checking for: with no button there is nothing to click, and the
       automatic replay is a better answer than a throw that would reach roll()'s catch. */
    if(!btn) return showReshootAuto(r);

    /* 1 · the delay. Nothing is thrown until this has had its full hold on screen. */
    await hold(Math.max(0,cfg.reshootDelayMs||0));
    if(cancelled) return;
    const slate=host.querySelector(".rsSlate");
    if(slate) slate.classList.add("out");
    const bar=host.querySelector(".rsBar");
    if(bar) bar.classList.add("in");

    /* 2 · the throws. The click decides WHEN, never WHAT: r.throws[i] was rolled by the tile.
       No float over the token any more — the button carries the count, and a float saying the
       same thing from the other end of the screen only split the player's attention. */
    for(let i=0;i<n;i++){
      btn.disabled=false;
      /* One text node, no markup: .btn is an inline-flex with an 8px gap, so an element around
         the number would have the row space it out as a third item. */
      btn.textContent=`🎬 Throw ${i+1} of ${total}`;
      await waitForThrow();
      if(cancelled) return;
      btn.disabled=true; btn.textContent="🎲 Rolling…";
      const t=r.throws[i];
      await rollDiceAnim(t.d1,t.d2,"reshoot");
      if(cancelled) return;
      log("🎬",`Throw <b>${i+1}</b> · ${t.d1} + ${t.d2}${t.d1===t.d2?" — <b>double, you're out!</b>":" — no double"}`);
      await hold(Math.max(0,cfg.reshootThrowGapMs));
      if(cancelled) return;
    }

    /* 3 · the outcome. The bar stays up underneath it — the mode is not over until the player
       has been told how it went — but with nothing left to click. */
    btn.disabled=true;
    btn.textContent=r.won?"🎬 That's a wrap":"🎬 The day is lost";
    stopCd(); if(cdRow) cdRow.classList.remove("live");
    if(r.won) await showReveal({big:"+"+r.energy+"⚡",sub:`Double ${r.throws[n-1].d1} — back on set`,
                                positive:true,energy:true,ms:cfg.reshootRevealMs});
    else await showReveal({big:r.fine?"−"+fmt(r.fine):"—",
                           sub:`No double in ${n} · reshoot fee, ${(r.finePct*100).toFixed(2)}% of your coins`,
                           positive:false,ms:cfg.reshootRevealMs});
  }finally{
    teardown();
  }
}

/* The beat as it played before there was a button to press: every throw on a timer, nothing to
   click. Kept as the fallback for a page with no #reshootUI, so a missing element costs the
   mode's staging and never the promise the roll loop is waiting on. */
async function showReshootAuto(r){
  const n=r.throws.length;
  for(let i=0;i<n;i++){
    const t=r.throws[i];
    floatToken(`🎬 ${i+1} of ${cfg.reshootThrows}`,"var(--pink)");
    await rollDiceAnim(t.d1,t.d2,"reshoot");
    log("🎬",`Throw <b>${i+1}</b> · ${t.d1} + ${t.d2}${t.d1===t.d2?" — <b>double, you're out!</b>":" — no double"}`);
    await sleep(Math.max(0,cfg.reshootThrowGapMs));
  }
  if(r.won) return showReveal({big:"+"+r.energy+"⚡",sub:`Double ${r.throws[n-1].d1} — back on set`,
                               positive:true,energy:true,ms:cfg.reshootRevealMs});
  return showReveal({big:r.fine?"−"+fmt(r.fine):"—",
                     sub:`No double in ${n} · reshoot fee, ${(r.finePct*100).toFixed(2)}% of your coins`,
                     positive:false,ms:cfg.reshootRevealMs});
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
  /* #sheetHost is the in-scene modal host — the profile sheet, the library and the unlock panel
     all mount in it, and whatever is up sits over the board and has to go for the same reason
     the page-level scrim does.

     The library is told to close rather than just having its markup erased, so its own open
     flag and route go with it — otherwise the next renderLibrary() would draw a page into a
     host that is no longer showing. */
  /* The ready-to-unlock popup hands a promise to roll()'s tail, so it is closed through its own
     close() rather than by wiping the host — erasing the markup would settle nothing. */
  if(typeof _readyClose==="function") _readyClose();
  if(typeof closeLibrary==="function") closeLibrary();
  const sh=$("#sheetHost"); if(sh){ sh.onclick=null; sh.classList.remove("show"); sh.innerHTML=""; }
  if(bonusOpen) bonusOpen.finish();
  /* The Reshoot beat, for the same reason: it is waiting on a click that is about to stop being
     clickable, and roll()'s finally is what clears state.animating. finish() is its teardown, so
     it also puts the playbar back. The class is cleared again unconditionally below because a
     hidden playbar that never returns is the same class of bug as an unsettled promise, and this
     function is the last line of defence for both. */
  if(reshootOpen) reshootOpen.finish();
  document.body.classList.remove("reshooting");
  /* A box caught mid-flight has to be cleaned up too — and more importantly its promise settled,
     since roll()'s finally is what clears state.animating. */
  /* cancelBoxFx tears the deck down too (Board3D), so a card caught in flight goes and — the
     part that actually matters — whoever is awaiting the pull or the stage is settled. */
  if(typeof use3d==="function"&&use3d()&&window.Board3D&&Board3D.available) Board3D.cancelBoxFx();
}
/* ---------------- the drawn card ----------------

   THE CARD IS THE REVEAL for the four bonus tiles, so it blocks the roll loop (and therefore
   auto-roll) exactly as showReveal and showCollect do. Two presentations of one event:

     · THE PULL — a card lifts off the deck standing inside the board ring, comes square to the
       camera to be read, and is dealt onto the discard spot beside the deck. js/ui/shoe3d.js.
     · THE FLAT CARD — the same composed face (js/ui/card-art.js) dropped into the DOM over the
       middle of the board, for when there is no 3D board, no deck, or WebGL never came up.

   NOTHING IS DECIDED HERE. js/tiles/deck-tile.js drew the card and banked every coin, point of
   energy and item before playEvents() reached this — the same contract showReshoot and the
   bonus games have. A pull that never renders has already paid.

   NOTHING HERE WAITS FOR A CLICK, which is what makes auto-roll safe through a card tile: both
   paths resolve on timers alone, and the 3D one is pointedly resolved by setTimeout rather than
   from the frame loop, so a backgrounded tab still settles it. */

/* The deck is up and working. cfg.deck3d is the drawer's toggle; shoeFailed() is "definitively
   broken" and NOT "not built yet" — keying off the second is what made the flat card flash on
   every page load in the branch this came from. */
function canPullCard(){
  return typeof use3d==="function" && use3d() && cfg.deck3d
      && window.Board3D && Board3D.available
      && Board3D.shoeFailed && !Board3D.shoeFailed();
}
function showCard(c){ return canPullCard() ? pullCardAnim(c) : flatCard(c); }

/* The pull, in the board's own scene. Two awaits, and the split matters:
     · pullCard() resolves when the card is PRESENTED — up, big and readable. That is when the
       confetti belongs, not when it is still a sliver leaving the deck.
     · shoeWhenClear() covers the hold and the trip back down onto the deck. We wait for it because in
       this game the card IS the turn's reveal and nothing should start over the top of it; the
       timeout is the whole point of that call, since a dropped frame loop must not strand the
       roll loop. Overshoot it generously — resolving twice is harmless, never resolving is not. */
async function pullCardAnim(c){
  /* THE TILE LABELS COME DOWN FOR THE BEAT. _setOverlay buys the card priority inside the GL
     scene, but #boardLabels is a DOM layer ABOVE the canvas (css/board.css) and cannot be
     reached from in there — so the tile numbers were painted straight across the card's artwork
     and its value line. A body class rather than style.display, exactly as body.reshooting does
     it, so syncBoardLabels() repositioning them every frame has nothing to fight.

     The playbar deliberately STAYS. It overlaps the card's bottom edge less now that the card is
     fitted to the frame, and Roll is auto-roll's only stop control — the same reason the Reshoot
     mode keeps it. A reveal you cannot interrupt is worse than one with a button near it.

     try/finally because this runs mid-turn: leaving the class on would hide the tile numbers for
     the rest of the session. */
  document.body.classList.add("carding");
  try{
    await Board3D.pullCard(c);
    if(c.positive) confetti();
    if(c.energy) diceConfetti();
    await Board3D.shoeWhenClear(cfg.deckCardMs + cfg.cardToTableMs + 600);
  } finally { document.body.classList.remove("carding"); }
}

/* The flat card, held for cfg.deckCardMs. The face is the same canvas the board's card wears,
   so the two presentations cannot drift apart. CardArt always draws something — a missing PNG
   costs a card its painting and never its name or its number — but the markup fallback below is
   kept anyway: a card is drawn mid-turn, and throwing here would take the game down rather than
   lose a picture. */
function flatCard(c){
  const el=$("#centerFx");
  el.className="centerfx show card "+(c.positive?"win":"lose");
  let ok=false;
  try{
    const box=document.createElement("div");
    box.className="pcArt";
    box.appendChild(CardArt.face(c));
    el.innerHTML=""; el.appendChild(box);
    ok=true;
  }catch(e){ console.warn("CardArt unavailable, drawing the plain card:",e); }
  if(!ok){
    el.innerHTML=`<div class="playcard">
      <div class="pcTop">Plot Twist</div>
      <div class="pcIco">🃏</div>
      <div class="pcName">${c.name}</div>
      ${c.big?`<div class="pcAmt">${c.big}</div>`:""}
    </div>`;
  }
  if(c.positive) confetti();
  if(c.energy) diceConfetti();
  return sleep(cfg.deckCardMs).then(()=>{ el.className="centerfx"; el.innerHTML=""; });
}
/* Blocking Collect popup. Resolves on click, or automatically after a random
   cfg.collectMinSec–collectMaxSec so an idle session keeps moving.

   There used to be a second, much faster window here for "auto-play session" — the batch
   balancing tool, which had nobody watching and could not afford 10–20s a popup. That mode
   went with the builders it existed to buy, and the one auto mode left is auto-ROLL, which
   simulates a real session and so takes the player-facing window like everyone else. That is
   also what js/ui/minigame.js does with the same decision, and the two have to agree.
   cfg.autoCollectMs is what is left of the fast path: dead, and listed as dead in CLAUDE.md. */
function showCollect(c){
  return new Promise(resolve=>{
    const secs=rand(Math.min(cfg.collectMinSec,cfg.collectMaxSec),
                    Math.max(cfg.collectMinSec,cfg.collectMaxSec));
    $("#scrim").innerHTML=`<div class="modal collectModal"><div class="top">
        <div class="eyebrow">Bonus</div><h2>${c.sub||"You won"}</h2></div>
      <div class="mbody"><div class="collectAmt">🪙 ${c.big}</div>
        <button class="btn roll wide" id="collectBtn" style="margin-top:16px">Collect</button>
        <div class="hint" style="text-align:center;margin-top:8px">auto-collects in <b id="collectCd">${Math.ceil(secs)}</b>s</div>
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
