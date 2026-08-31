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
/* A CLUE, SHRINKING INTO THE SLOT IT FILLED.

   The player is shown a clue at full size and, separately, a bar in the toolbar moves. Those are
   two things changing in different places, and connecting them was left to the player. This
   flies the card from where it was read to the slot it fills, so the connection is shown.

   THE TRACKER IS STILL SHOWING THE OLD COUNT WHEN THIS RUNS, and that is not luck — playEvents
   calls renderHUD() before a card beat, not renderAll(), so renderEpTrack has not run since the
   clue banked. The empty slot the flight aims at is genuinely the one about to fill. Land, then
   render: reversing those two makes the card fly into a slot that is already full.

   position:fixed on a detached element, because the two ends live in different stacking contexts
   — the board's centre overlay and the toolbar — and an element animating BETWEEN those trees
   would be clipped by whichever it was parented to.

   Resolves on a timer like every other beat here: a transitionend never arrives in a background
   tab, and a flight that never resolves would hang the roll loop behind it. */
function flyCluesToTracker(fromEl, n){
  const bar = $("#epTrack") && $("#epTrack").querySelector(".etBar");
  const src = fromEl && fromEl.querySelector(".ccard");
  const ms  = Math.max(0, +cfg.clueFlyMs || 0);
  if(!bar || !src || !ms || document.hidden) return Promise.resolve();
  const empty = [...bar.querySelectorAll("i:not(.on)")].slice(0, Math.max(1, n | 0));
  if(!empty.length) return Promise.resolve();

  const a = src.getBoundingClientRect();
  const art = getComputedStyle(src.querySelector(".ccArt") || src).backgroundImage;
  empty.forEach((slot, k) => {
    const b = slot.getBoundingClientRect();
    const fly = document.createElement("div");
    fly.className = "clueFly";
    fly.style.cssText = `left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;` +
                        `--flyMs:${ms}ms`;
    /* The card's own photograph, so the thing that lands is the thing that was read. */
    if(art && art !== "none") fly.style.backgroundImage = art;
    else fly.style.background = "#15161a";
    document.body.appendChild(fly);
    /* nextPaint, not a bare rAF: the start and end transforms have to land in two different
       style recalcs or the transition never runs, and rAF is suspended in a hidden tab. */
    nextPaint(() => {
      const sx = b.width / a.width, sy = b.height / a.height;
      fly.style.transform =
        `translate(${b.left - a.left + (b.width - a.width) / 2}px,` +
        `${b.top - a.top + (b.height - a.height) / 2}px) scale(${sx},${sy})`;
      fly.style.opacity = ".85";
    });
    setTimeout(() => {
      fly.remove();
      slot.classList.add("on", "land");
      setTimeout(() => slot.classList.remove("land"), 360);
    }, ms + 20 + k * 60);
  });
  return sleep(ms + 80 + (empty.length - 1) * 60);
}

/* A CARD, SHRINKING INTO THE COLLECTION IT JOINED.

   The clue flight's argument applied to the other half of the draw. A card is held at full size
   in the middle of the board and then simply stops existing, while somewhere else entirely a
   counter moves. Flying it into the album button says the two were one event, and answers the
   question a collection game cannot afford to leave hanging: where did that just go.

   THE WHOLE CARD FLIES, not a picture of it. flyCluesToTracker builds a plain div and borrows the
   art, which is right for a slot eleven pixels wide -- at that size a frame is one pixel of noise.
   The album button is several times that, so this clones the face: frame, badge, count and all,
   and the thing that lands is recognisably the thing that was read.

   position:fixed for the same reason the clue flight uses it -- the centre overlay and the
   toolbar are different stacking contexts, and an element animating BETWEEN two trees would be
   clipped by whichever one it was parented to. Resolved on a timer for the same reason too: a
   transitionend never arrives in a background tab, and a flight that never resolves hangs the
   roll loop waiting behind it. */
function flyCardToAlbum(fromEl){
  const btn = $("#albumBtn");
  const src = fromEl && fromEl.querySelector(".ccard");
  const ms  = Math.max(0, +cfg.cardFlyMs || 0);
  if(!btn || !src || !ms || document.hidden) return Promise.resolve();
  const a = src.getBoundingClientRect(), b = btn.getBoundingClientRect();
  /* A button scrolled out of the layout measures zero, and scaling to zero is a card that
     vanishes on the spot -- worse than no flight at all, because it reads as a dropped frame. */
  if(!a.width || !b.width) return Promise.resolve();

  const fly = document.createElement("div");
  fly.className = "cardFly";
  fly.style.cssText = `left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;` +
                      `--flyMs:${ms}ms`;
  /* The clone is SIZED IN PIXELS before it leaves. `.centerfx.card .ccard` is what gave it its
     width, and that selector does not reach document.body -- so an unsized clone would snap to
     its default the instant it was appended, and the flight would start from the wrong card. */
  const clone = src.cloneNode(true);
  clone.style.width = a.width + "px";
  clone.style.height = a.height + "px";
  clone.style.margin = "0";
  fly.appendChild(clone);
  document.body.appendChild(fly);

  /* nextPaint, not a bare rAF: the start and end transforms have to land in two different style
     recalcs or the transition never runs, and rAF is suspended in a hidden tab. */
  nextPaint(() => {
    /* Centre onto centre, then scale to sit INSIDE the button rather than cover it. The default
       transform-origin is the element's middle, which is what makes those two the same move. */
    const s = Math.min(b.width / a.width, b.height / a.height) * 0.8;
    fly.style.transform =
      `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px,` +
      `${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(${s})`;
    fly.style.opacity = ".25";
  });
  setTimeout(() => {
    fly.remove();
    /* The button takes the hit, so the flight lands ON something instead of ending at nothing. */
    btn.classList.add("land");
    setTimeout(() => btn.classList.remove("land"), 420);
  }, ms + 20);
  return sleep(ms + 40);
}

/* ---------- THE HUD TRACK: HELD, THEN RUN ----------

   Status is banked while the event list is being BUILT, and playEvents renders the HUD before it
   opens a card. So the bar had already finished moving by the time the player was looking at the
   card that paid for it: the effect arrived before its cause, and the one number the whole loop
   feeds moved while there was something else on screen to look at.

   So it is pinned for the duration of a card beat and run afterwards, against a screen with
   nothing left on it -- three moves in the order the events actually happened: the card flies
   into the collection, the bar fills, the pill lights up.

   THE PIN IS A DISPLAYED VALUE, NEVER A STORED ONE. Status.points() stays the truth throughout;
   renderStatusChip simply draws an older reading of it while the hold is up. Nothing here can
   drift, because there is no second copy of the number to drift from. */
let hudHold = null, hudHoldTimer = null, hudAnim = null;

/* THE ONE CLOCK EVERY STATUS SURFACE READS. There are two of them — the HUD pill and the estate
   plaque at the middle of the board — and they carry the same level, the same band and the same
   bar. Two surfaces reading the live total independently is how they end up disagreeing at the
   same instant, which is worse than neither of them moving.

   The live total most of the time; an older reading while a card beat holds it; an interpolated
   one while the beat's bar is running. Never a stored number: Status.points() stays the truth
   throughout and these are only ever values to DRAW.

   Both live here rather than in render.js because index.html loads fx.js first and a file may
   only use globals defined above it (CLAUDE.md). estate3d.js is a module and reads them off the
   global scope for the same reason it reads Status and cfg. */
function statusShownPoints(){
  return hudAnim != null ? hudAnim : (hudHold != null ? hudHold : Status.points());
}
/* Whether the number on screen is one of those stand-ins — which is what tells renderStatusChip
   not to claim the move as settled, or to fire the little bump that competes with the beat. */
function statusPinned(){ return hudHold != null || hudAnim != null; }

/* Pin the chip at WHAT IT IS ALREADY SHOWING. state.lastStatus is exactly that -- the value the
   chip was last drawn with -- so the pin needs no reading of its own and cannot disagree with
   what is on screen. Only for a beat that actually pays: pinning on a clue would freeze the HUD
   for nothing. */
function holdStatusChip(c){
  if(!c || !(+c.status > 0) || hudHold != null) return;
  hudHold = state.lastStatus != null ? state.lastStatus : Status.points();
  /* A WATCHDOG, because a pin that is never released is a HUD quietly showing the wrong number
     for the rest of the session -- the exact class of bug this codebase treats as worse than a
     crash, since nothing about it looks broken. releaseStatusChip clears it on every normal
     path; nothing else has to remember to. */
  clearTimeout(hudHoldTimer);
  hudHoldTimer = setTimeout(() => {
    hudHold = null; hudAnim = null;
    renderStatusChip();
    /* Both surfaces read the pin, so both have to be let go. Restoring only the pill would leave
       the estate showing the older number for the rest of the session — the two disagreeing,
       which is the exact failure this whole mechanism exists to prevent. */
    if(window.Board3D && Board3D.available && Board3D.syncCase) Board3D.syncCase();
  }, 15000);
}

/* Let it go, and show it going. Resolves when the bar has landed, so the roll loop waits for
   this the way it waits for every other beat. */
function releaseStatusChip(){
  const from = hudHold;
  hudHold = null; clearTimeout(hudHoldTimer);
  if(from == null) return Promise.resolve();

  const to = Status.points();
  const el = $("#hLevelPill"), fill = $("#hRankFill");
  const auto = typeof autoMode !== "undefined" && autoMode === "session";
  const ms = Math.max(0, +cfg.hudStatusMs || 0);
  /* Nothing to watch, nobody watching, or no time to watch it in -- settle and move on. */
  if(!el || !fill || to <= from || auto || !ms || document.hidden){
    renderStatusChip(); return Promise.resolve();
  }

  /* The chip's own bump fires on state.lastStatus moving. Claim the move here so it does not
     also fire: a small pop competing with the highlight makes two vague animations out of one
     clear one. */
  state.lastStatus = to;

  const hold = Math.max(0, +cfg.hudStatusHoldMs || 0);
  const lvFrom = Status.level(from), lvTo = Status.level(to);
  const levelled = lvTo > lvFrom;
  const pct = p => Math.round(Status.levelProgress(p) * 100) + "%";

  el.classList.remove("bump");
  el.classList.add("gain");
  hudGainFloat(el, to - from);

  fill.style.transition = "none";
  fill.style.width = pct(from);

  const timers = [];
  const later = (fn, t) => timers.push(setTimeout(fn, t));

  /* ---- THE ESTATE, ON THE SAME CLOCK ----

     The plaque at the middle of the board carries this same bar, so it moves with the pill or the
     two contradict each other while the player is looking straight at them. It is a canvas
     texture on a plane, not a DOM node, so there is no CSS transition to hand the work to: the
     value is stepped on a timer and the band repainted underneath it.

     A TIMER RATHER THAN A FRAME LOOP, like everything else in this file — rAF is suspended in a
     background tab, and 40ms steps are indistinguishable from 60fps on a seven-pixel bar across
     the board while costing a third of the texture uploads. */
  /* paintEstateBar returns false when there is no sign to paint on — the painted fallback keeps
     its plaque inside the picture, and there is a window after a swap disposes one sign and
     before the next is built. Nothing is done about that on purpose: retrying as a full sync
     per step is the cost this exists to avoid, and the settle below lands the real number
     either way. The estate simply sits still for that beat. */
  const est = (p, pts) => {
    if(window.Board3D && Board3D.available && Board3D.paintEstateBar)
      Board3D.paintEstateBar(p, pts, true);
  };
  const p0 = Status.levelProgress(from), pEnd = Status.levelProgress(to);
  const half = levelled ? Math.max(1, Math.round(ms * 0.45)) : 0;
  const bTop = levelled ? Status.levelAt(lvFrom + 1) : 0;
  const base = levelled ? Status.levelAt(lvTo) : 0;
  const ease = t => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
  const t0 = Date.now();
  let flipped = false;
  const estTimer = setInterval(() => {
    const t = Date.now() - t0;
    if(!levelled){
      const e = ease(t / ms);
      hudAnim = from + (to - from) * e;
      est(p0 + (pEnd - p0) * e, hudAnim);
    }else if(t < half){
      const e = ease(t / half);
      hudAnim = from + (bTop - from) * e;
      /* Held just short of the boundary: at exactly bTop the level has already turned over, and
         the bar would read as the EMPTY start of the next level one step before the flip. */
      est(p0 + (1 - p0) * e, Math.min(hudAnim, bTop - 0.001));
    }else{
      if(!flipped){
        /* The level turns over. Name, LV, pips and the tier's art all change — that is a whole
           face, so it is a real sync rather than a band repaint. Exactly one of them per beat. */
        flipped = true;
        hudAnim = base;
        if(window.Board3D && Board3D.available && Board3D.syncCase) Board3D.syncCase();
      }
      const e = ease((t - half) / Math.max(1, ms - half));
      hudAnim = base + (to - base) * e;
      est(pEnd * e, hudAnim);
    }
    if(t >= ms) clearInterval(estTimer);
  }, 40);

  nextPaint(() => {
    if(!levelled){
      fill.style.transition = `width ${ms}ms cubic-bezier(.2,.9,.3,1)`;
      fill.style.width = pct(to);
      return;
    }
    /* A LEVEL CROSSED CANNOT BE ONE MOVE. The new level starts near empty, so animating straight
       to the new fraction runs the bar BACKWARDS across everything that was just earned. It fills
       to the top of the level they were in, the level turns over, and it fills again from the
       bottom of the new one -- the same two moves the conversion ribbon makes, for the same
       reason (js/ui/statusup.js). */
    const half = Math.max(1, Math.round(ms * 0.45));
    fill.style.transition = `width ${half}ms cubic-bezier(.3,.8,.4,1)`;
    fill.style.width = "100%";
    later(() => {
      const rank = Status.rank(to);
      const lvEl = $("#hLevel"), nmEl = $("#hRank"), ico = $("#hRankIco");
      if(lvEl) lvEl.textContent = lvTo;
      if(nmEl) nmEl.textContent = rank.name;
      /* className, not textContent: the icon is a background image on a span, and writing text
         into it would put a glyph back where a picture is meant to be. */
      if(ico){ ico.className = "ic i-rank i-rank-" + (rank.key || "extra"); ico.title = rank.name; }
      el.classList.add("levelled");
      fill.style.transition = "none"; fill.style.width = "0%";
      nextPaint(() => {
        fill.style.transition = `width ${ms - half}ms cubic-bezier(.2,.9,.3,1)`;
        fill.style.width = pct(to);
      });
    }, half + 40);
  });

  return new Promise(resolve => {
    /* On a timer like every other beat here. A transitionend never arrives in a background tab,
       and the whole point of this function is that the roll waits for it. */
    setTimeout(() => {
      timers.forEach(clearTimeout);
      clearInterval(estTimer);
      /* STATE FIRST, REPAINTS SECOND. The stand-in and the classes go before anything that can
         throw, so a failing repaint cannot leave the pin up or the pill stuck gold. */
      hudAnim = null;
      el.classList.remove("gain", "levelled");
      fill.style.transition = "";
      try{
        renderStatusChip();
        /* A full sync rather than a last paintBar: it puts the bar back to teal and is the one
           place the plaque is guaranteed to land on the real number however the beat was
           interrupted. paintBar has cleared the signature, so this cannot be gated out. */
        if(window.Board3D && Board3D.available && Board3D.syncCase) Board3D.syncCase();
      }catch(err){ /* the beat is over either way — never strand the roll loop behind it */ }
      resolve();
    }, ms + hold + 60);
  });
}

/* "+30", rising off the pill that just moved. The bar says how far along the level they now are;
   this says how much just arrived, which is the number the player is actually counting. Fixed
   rather than parented to the pill, because the HUD clips its own overflow. */
function hudGainFloat(el, n){
  if(!(n > 0)) return;
  const r = el.getBoundingClientRect();
  const f = document.createElement("div");
  f.className = "hudGain";
  f.textContent = "+" + fmt(Math.round(n));
  f.style.left = (r.left + r.width / 2) + "px";
  f.style.top  = r.top + "px";
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1300);
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

/* HOW MANY OF THE THREE YOU HAVE, AS THREE CARDS — a fan of slots, filled left to right.

   It used to read "2 of 3 collected". A sentence is something you parse; a hand of cards with a
   gap in it is something you SEE, and the gap is the whole point — it is the shape of what is
   still missing. Two filled and one empty says "one more" without using the word.

   The filled slots wear the card's own art, because that is literally what a second copy is:
   the same object again. Empty ones are a dashed outline over nothing, so they read as a place
   rather than as a card that failed to load.

   NOT FOR CLUES. The fan briefly counted an episode's clues too, and it was wrong to: the slots
   work here because they are literally the same object repeated — three Penthouse Keys, one
   missing — and an episode's four clues are four DIFFERENT pieces of evidence. Four identical
   blanks said "collect four of the same thing" about them, named no episode, and could not say
   whether the episode was watchable. That job belongs to the tracker on the board
   (renderEpTrack, js/ui/render.js), which is also there between rolls rather than for two and a
   half seconds. */
function cbSlots(art,have,need){
  const fill=art?`style="${cardArtCss(art)}"`:"";
  let out="";
  for(let i=0;i<need;i++)
    out+=`<span class="cbSlot${i<have?" on":""}" ${i<have?fill:""}></span>`;
  return `<div class="cbSlots" title="${have} of ${need} collected">${out}</div>`;
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
     status card   cfg.statusHoldMs    ALSO two. A trophy card is not a Collectible yet — it
                                       becomes one on its third copy — so copies one and two are
                                       cards like any other, and holding them longer spent five
                                       seconds on the state of not having finished. The slot fan
                                       is what makes them different, and a fan is read at a
                                       glance. Kept as its own knob rather than folded into
                                       cardHoldMs: the two are equal today by decision, not by
                                       being the same thing
     …its third    cfg.cardConvertMs   ALSO two. All three copies of a trophy are on screen for
                                       the same length now: a card is a card, and the third one
                                       being the one that converts is the CONVERSION BEAT's news
                                       to break, not this one's.

                                       On the tile route this does not fire at all — the
                                       conversion IS the statusUp, which opens on the card and
                                       turns it into the plaque (js/ui/statusup.js). It survives
                                       for the box route, where the pack popup shows the drop and
                                       the celebration follows it. Its own timings
                                       (statusCardMs, statusFlipMs, statusBarMs, statusUpMs) are
                                       separate and deliberately longer: that beat is not showing
                                       a card, it is showing a card BECOMING something
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
  /* HOW MANY CLUES THE NEXT EPISODE STILL WANTS — the same fan the cards use, and on a phone
     the ONLY place this is ever said. The desktop Story panel carries it in prose, and
     css/mobile.css hides that panel outright, so the player's-eye view had no answer to "how
     much further" for the currency the whole game runs on. GDD §12 calls a visible progress
     bar to the next unlock a non-negotiable; this is it, shown at the moment it changes. */
  const caption=clue
    ? `${pair?`<div class="cbLines">${drops.map(d=>`<p>${d.clue.text}</p>`).join("")}</div>`:""}
       <div class="cbHint" id="cbHint">Tap to keep ${pair?"them":"it"} open</div>`
    : `<div class="cbCap">
        ${pts>0?(trophy
          /* THE CUP IS THE SIZE OF THE THING IT MEANS. It was a text-sized emoji tucked in front
             of the number, in a caption with dead space either side of it — so the mark that says
             "this is a trophy, not a memory" was the smallest thing on a beat about winning one.
             It flanks the number now, at fifty pixels a side, filling exactly the space that was
             empty. Two cups rather than one because the number stays CENTRED: an award reads as
             an award when it is framed, and a single cup shunted to one side just looks adrift. */
          ? `<div class="cbAward"><span class="cbCup"></span>
               <div class="cbStat"><b>+${fmt(pts)}</b><i>status</i></div>
               <span class="cbCup"></span></div>`
          : `<div class="cbStat"><b>+${fmt(pts)}</b><i>status</i></div>`):""}
        ${c.collectible?cbSlots(Cards.artFor(c.collectible),Math.min(c.count,need),need):""}
        ${celebrate?`<div class="cbDone">⭐ Collected \u2014 it is a Collectible now</div>`
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
      /* The flight starts from the card while it is STILL ON SCREEN — its rect is read before
         the overlay is emptied, or there is nothing to measure and nowhere to fly from.

         A clue goes to the slot it filled on the tracker; every other card goes to the collection
         button, because that is where it now is. A card with no face — the plain playcard a twist
         hands over — flies nowhere, and flyCardToAlbum returns straight away for it.

         Guarded, because this is the only path that resolves the beat: a throw here would leave
         the promise pending and the roll loop stopped behind an empty overlay. */
      let flight=null;
      try{ flight=clue?flyCluesToTracker(el,drops.length):flyCardToAlbum(el); }
      catch(err){ flight=null; }
      el.className="centerfx"; el.innerHTML="";
      if(flight) flight.then(resolve); else resolve();
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
