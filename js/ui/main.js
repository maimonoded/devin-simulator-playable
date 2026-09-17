"use strict";
/* Orchestration: turns user input into game.js calls, plays back the returned
   events with animation/timing, wires all buttons, and boots the app. */

/* Play a game.js event list: float → log → move → confetti → card → reshoot → reveal →
   collect → minigame → pause. card, reshoot, reveal, collect and minigame block the roll loop
   (and therefore auto-roll) until they finish. */
async function playEvents(events){
  for(const ev of events){
    /* renderHUD on a float too, not only on the blocking events below. A mystery box pays out
       entirely in floats, so without this the coin and energy counters sat still through the
       whole collection and only jumped at the end of the roll — which reads as "I collected
       it and nothing happened". */
    /* Before the floats: the box has to pop before its numbers can come out of the burst. */
    if(ev.boxOpen){ renderHUD(); await showBoxOpen(ev.boxOpen); }
    if(ev.float){ floatToken(ev.float.text,ev.float.color); renderHUD(); }
    if(ev.log) log(ev.log.icon,ev.log.msg);
    if(ev.move){ for(const p of ev.move.path){ state.pos=p; positionToken(); await sleep(ev.move.stepMs); } }
    if(ev.confetti) confetti();
    if(ev.dice) diceConfetti();
    if(ev.card){ renderHUD(); await showCard(ev.card); }
    /* The Reshoot corner's escape attempt: up to three throws of the coloured pair, then the
       outcome. Before `reveal` because it ENDS in one — a tile that carried both would want
       its own reveal last, after the throws. */
    /* renderHUD AFTER, unlike every other blocking event: the outcome is already in state
       before playback begins, so refreshing the HUD first would show the player the result of
       an attempt they have not watched yet. */
    if(ev.reshoot){ await showReshoot(ev.reshoot); renderHUD(); }
    if(ev.reveal){ renderHUD(); await showReveal(ev.reveal); }
    if(ev.collect){ renderHUD(); await showCollect(ev.collect); }
    /* Last of the blocking events: a mini-game takes the whole frame, so anything else this
       event carries should have been shown before it opens. */
    if(ev.minigame){ renderHUD(); await showMinigame(ev.minigame); }
    if(ev.pause) await sleep(ev.pause);
  }
}

async function roll(){
  if(state.animating||state.energy<state.mult) return;
  state.animating=true; renderAll();
  // try/finally: if anything below throws, the animating flag must still clear —
  // otherwise the board soft-locks with Roll permanently disabled.
  try{
    const mult=state.mult;
    spendRoll(mult);
    const {d1,d2,steps}=rollDice();
    await rollDiceAnim(d1,d2);          // click → reveal (cfg.diceRevealMs)
    await sleep(cfg.diceToMoveMs);      // reveal → token starts moving

    let passedStart=false;
    for(let s=0;s<steps;s++){
      state.pos=(state.pos+1)%40;
      if(state.pos===0) passedStart=true;
      positionToken();
    if(!use3d()){ const tok=$("#token"); tok.classList.remove("hop"); void tok.offsetWidth; tok.classList.add("hop"); }
      await sleep(cfg.tokenStepMs);
    }
    // pass-start (lap) reward if we crossed 0 but did not land there
    if(passedStart && state.pos!==0){
      const pass=applyPassStart(mult);
      floatToken("+"+fmt(pass),"var(--gold)"); log("⭐",`Passed Start · +<b>${fmt(pass)}</b> coins`);
    }
    await playEvents(resolveLandingEvents(mult));
  }catch(e){
    console.error("roll failed:",e);
    log("⚠️","<b>Something went wrong mid-roll</b> — board recovered.");
    clearOverlayFx();
  }finally{
    state.animating=false; renderAll();
  }
  /* AFTER the finally, not inside it: Unlock.payAll refuses while state.animating is true (a
     payment landing between a roll's events would render against a board the player cannot see),
     so the offer has to come once the roll is fully unwound. */
  await maybeOfferUnlock();
}

/* Offer the current target the moment the player can clear it OUTRIGHT — every remaining step,
   not just the next one. Once per target: closing it means no, and the library is always there.

   It PAUSES auto-roll, and resumes it — without touching autoMode at all.

   runAuto's loop is `while(autoMode==="roll"){ await roll(); … }`, and roll() awaits this. So
   while the popup is up, roll() has not returned and the loop is simply parked mid-iteration;
   when the popup closes, roll() returns and the next roll happens. An episode becoming
   affordable is the one moment in a run worth interrupting, and this interrupts it without the
   loop ever having to be stopped and restarted.

   Setting autoMode=null here and calling autoRoll() again afterwards was the obvious version and
   it is broken: the resumed call starts a SECOND runAuto whose loop races the first, and the
   first one's `finally{ autoMode=null }` then kills the second as it unwinds. Auto-roll would
   stop one roll after the player pressed Unlock, looking like the popup had broken it. Do not
   reintroduce an explicit stop here. */
const _offeredUnlock=new Set();
async function maybeOfferUnlock(){
  if(typeof Unlock==="undefined"||typeof openUnlockReady!=="function") return;
  const cur=Unlock.current();
  if(!cur||_offeredUnlock.has(cur.key)) return;
  if(!Unlock.canPayAll(cur.kind,cur.id)) return;
  _offeredUnlock.add(cur.key);
  await openUnlockReady(cur.kind,cur.id);
  renderAll();
}

function nextSession(){
  const r=advanceSession();
  r.rewards.forEach(x=>log("🎁",`Day ${x.day} login reward · +<b>${fmt(x.amount)}</b> coins`));
  if(r.isNewDay) toast(`☀️ <b>Day ${state.day}</b> — welcome back`);
  log("⏭",`New session · energy refilled to <b>${Math.floor(state.energy)}</b>`);
  renderAll();
}

/* One auto mode, a toggle (hold Roll to start, tap it to stop after the current roll):
     "roll" — rolls only, nothing else. Stops when energy can't cover the multiplier.

   It used to be one of two. "Auto-play session" was the same loop plus a pass that bought the
   cheapest builder upgrade each turn; with builders gone the two modes were the same thing
   under different names, so only this one is left. autoMode stays a string rather than becoming
   a boolean because everything that reads it (js/ui/store.js, js/ui/minigame.js, renderAll)
   asks WHICH mode owns the loop, and a second mode is plausible again later. */
let autoMode=null;   // null | "roll"
async function runAuto(mode){
  if(autoMode===mode){ autoMode=null; renderAll(); return; }   // same control again → stop
  if(autoMode!==null||state.animating) return;
  autoMode=mode; renderAll();
  let outOfEnergy=false;
  try{
    while(autoMode===mode){
      if(state.energy<state.mult){ outOfEnergy=true; break; }   // re-checked each pass: mult can change mid-run
      await roll();
      if(state.animating) break;   // a roll bailed out unexpectedly — don't spin
      await sleep(60);
    }
  }finally{
    autoMode=null;
    if(outOfEnergy) log("⏹",`Auto roll stopped · needs <b>${state.mult}</b>⚡ for a ×${state.mult} roll, have <b>${Math.floor(state.energy)}</b>`);
    renderAll();
  }
}
const autoRoll=()=>runAuto("roll");

/* ---------------- wiring ---------------- */
/* ?view=mobile: reparent the HUD and the store button INTO the board scene, so the whole game
   screen is one element — a 2D layer sitting on the WebGL canvas — instead of chrome arranged
   in a frame around it. The play controls are already in there (index.html), so this is what
   makes the set complete.

   Done here rather than in boot(): boot() is called by the deferred board module, i.e. after
   first paint, and the HUD would visibly jump from the page flow into the scene. This file is
   a classic script at the end of <body>, so it runs while the parser is still blocking paint.
   Reparenting is safe — nothing reads these through their parent, only by id. */
if(typeof VIEW_MOBILE!=="undefined"&&VIEW_MOBILE){
  const scene=$("#boardScene");
  if(scene) [$(".hud"),$(".storeBtn")].forEach(el=>{ if(el) scene.appendChild(el); });
}
/* Roll is one button with two modes: tap it to roll once, hold it to hand the loop over to
   auto-roll, tap it again to stop. Auto-roll used to be its own button; folding it into Roll
   keeps the primary action in one place, which matters most in the 9:16 phone framing where
   the control row is tight.

   Pointer events rather than click, because the tap and the hold have to be told apart before
   the click would fire. The hold is cancelled if the pointer leaves the button, so sliding off
   is the way to back out without rolling. */
(function wireRoll(){
  const btn=$("#rollBtn");
  let holdT=null, startedAuto=false;
  const endHold=()=>{ clearTimeout(holdT); holdT=null; btn.classList.remove("holding"); };
  btn.addEventListener("pointerdown",e=>{
    if(e.button!==0||btn.disabled) return;
    if(autoMode==="roll") return;            // already running: the tap stops it, on release
    startedAuto=false;
    btn.style.setProperty("--holdMs",cfg.autoRollHoldMs+"ms");   // CSS fills over the same time
    btn.classList.add("holding");
    holdT=setTimeout(()=>{ endHold(); startedAuto=true; autoRoll(); },cfg.autoRollHoldMs);
  });
  btn.addEventListener("pointerup",e=>{
    if(e.button!==0) return;
    /* endHold() nulls holdT, and the timer callback calls it too — so a hold that already
       fired leaves holdT null and correctly does NOT also roll once on release. */
    const wasTap=holdT!==null;
    endHold();
    /* Letting go of the hold that just STARTED auto-roll must not immediately stop it again:
       by now autoMode is already "roll", so without this the mode would flick on and off in
       one gesture. Only a fresh press counts as the stop. */
    if(startedAuto){ startedAuto=false; return; }
    if(autoMode==="roll") autoRoll();        // tap while auto-rolling = stop
    else if(wasTap) roll();
  });
  btn.addEventListener("pointerleave",endHold);
  btn.addEventListener("pointercancel",endHold);
})();
/* Banked mystery boxes, thrown onto the board.

   Called once from boot(), after loadState(), so boxes banked in a save land on the board the
   run comes back to. Nothing banks one any more — builder upgrades did, and they are gone — so
   in a fresh run this is a no-op. It is kept whole, and called from somewhere, because it is
   the seam a deck card will use: state.pendingBoxes goes up, this puts them on the board.

   The state moves FIRST and the animation is decoration on top: spawn() picks the tiles and
   clears the pending count synchronously, so a reload or a missing WebGL context mid-throw
   still leaves the boxes correctly on the board rather than lost. The only thing that can be
   interrupted is the picture.

   Not awaited by anything: the player is free to roll, and roll() blocks on state.animating
   rather than on this. */
function deliverBoxes(){
  const n=state.pendingBoxes|0;
  if(n<=0) return;
  const spawned=OVERLAY_TYPES.mysteryBox.spawn(n);
  /* Fewer free tiles than boxes: the rest stay banked for the next delivery, so a full board
     never silently eats a reward the player earned. */
  state.pendingBoxes=Math.max(0,n-spawned.length);
  renderAll();
  if(!spawned.length) return;
  log("🎁",`<b>${spawned.length}</b> mystery box${spawned.length>1?"es":""} dropped on the board`);
  if(!use3d()||!window.Board3D||!Board3D.available) return;
  Board3D.throwOverlays(OVERLAYS.flatMap(o=>o.all()),spawned);
}
$("#avatarBtn").onclick=()=>openProfile();
$("#libBtn").onclick=openLibrary;
$("#storeBtn").onclick=openStore;
$("#nextBtn").onclick=nextSession;
/* 9:16 preview. The class goes on .stage and CSS reshapes .boardScene; Board3D's
   ResizeObserver re-fits the camera to the new box by itself. cfg.phoneView persists it,
   so the framing you were testing survives a reload. */
$("#phoneBtn").onclick=()=>{
  const on=!document.querySelector(".stage").classList.contains("phone");
  /* cfg.phoneView first: applyPhoneView re-fits the camera, and resize() reads this flag to
     pick the view's zoom. Setting it afterwards framed each view with the other's value. */
  cfg.phoneView=on?1:0;
  applyPhoneView(on);
  scheduleSaveConfig();
};
function applyPhoneView(on){
  /* ?view=mobile is already a full-screen phone frame, so it must never also wear the .phone
     preview class. The two are different framing systems and they fight: .stage.phone caps
     .boardScene at 360px and re-imposes a 9:16 box, which in mobile view showed up as a strip
     of page either side of the canvas — exactly the border this mode exists to remove. And it
     wins on specificity (three classes), so css/mobile.css cannot simply override it.
     cfg.phoneView is left alone: it is persisted, and board3d.js reads it alongside
     VIEW_MOBILE when picking the camera zoom. */
  if(typeof VIEW_MOBILE!=="undefined"&&VIEW_MOBILE) on=false;
  document.querySelector(".stage").classList.toggle("phone",on);
  $("#phoneBtn").classList.toggle("on",on);
  $("#phoneBtn").textContent=on?"🖥 Desktop view":"📱 Phone view";
  /* The two views use different zooms, so re-fit even when the box size happens not to
     change — the ResizeObserver would not fire in that case and the frustum would be stale. */
  if(use3d()&&window.Board3D&&Board3D.available) Board3D.resize();
}
/* One stake button instead of a row: each tap steps to the next multiplier and wraps.
   indexOf returning -1 for a stake that is no longer in the list (an old save, or a shortened
   MULTIPLIERS) lands on index 0, so a restore can never strand the player on a dead value. */
$("#multBtn").onclick=()=>{
  if(state.animating||autoMode!==null) return;   // can't change the stake mid-spin
  state.mult=MULTIPLIERS[(MULTIPLIERS.indexOf(state.mult)+1)%MULTIPLIERS.length];
  renderAll();
};
$("#drawerBtn").onclick=()=>$("#drawer").classList.add("open");
$("#closeDrawer").onclick=()=>$("#drawer").classList.remove("open");

/* ---------------- boot ----------------
   Not self-invoking: js/ui/board3d.js is an ES module, so it runs AFTER every classic script.
   It calls boot() once the scene is up, so the board exists before buildBoard() needs it. */
function boot(){
  /* Economy before config, config before state.
     The model is projected onto cfg first, then the saved tuning is overlaid on top of it —
     that ordering is what lets a newly imported workbook actually reach a returning player
     instead of being shadowed by their old save. js/storage.js loadConfig() explains the
     version gate that decides how much of the save survives. */
  loadEconomy();
  Economy.apply();
  loadConfig();                 // initState() reads cfg.energyCap, so this must precede it
  initState();
  const restored=loadState();   // overlay saved progress, if any
  buildBoard(); buildTuning(); setDice(3,4); syncMultButton(); renderAll();
  /* The debug menu's HUD button (js/ui/debug.js). Guarded rather than called outright, because
     that file is meant to be droppable: pulling its one <script> tag has to remove the tool, not
     break boot. */
  if(typeof buildDebugButton==="function") buildDebugButton();
  applyPhoneView(!!cfg.phoneView);   // after loadConfig, so a saved framing comes back
  /* After loadState, so boxes banked before the reload land rather than sitting in the save
     forever. Nothing banks one yet — see deliverBoxes — so this is usually a no-op. */
  deliverBoxes();
  if(restored) log("💾",`Session restored · Day <b>${state.day}</b> · ${fmt(state.coins)} coins · ${state.rolls} rolls so far.`);
  else log("✨","Welcome to <b>Harbour Heights</b>. Roll the dice, walk the board, collect the coins.");
  if(!storageOK) toast("⚠ Browser storage unavailable — progress won't be saved");
}
window.boot=boot;
/* Safety net: if the module never runs (blocked, 404, or opened from file://), boot anyway
   so the DOM board still comes up rather than leaving a blank page. */
setTimeout(()=>{ if(!window.__booted){ window.__booted=true; boot(); } },1500);
