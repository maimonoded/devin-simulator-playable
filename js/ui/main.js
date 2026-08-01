"use strict";
/* Orchestration: turns user input into game.js calls, plays back the returned
   events with animation/timing, wires all buttons, and boots the app. */

/* Play a game.js event list: float → log → move → confetti → reveal → collect → pause.
   reveal and collect block the roll loop (and therefore auto-play) until they finish. */
async function playEvents(events){
  for(const ev of events){
    /* renderHUD on a float too, not only on the blocking three below. A mystery box pays out
       entirely in floats, so without this the coin and clue counters sat still through the
       whole collection and only jumped at the end of the roll — which reads as "I collected
       it and nothing happened". */
    if(ev.float){ floatToken(ev.float.text,ev.float.color); renderHUD(); }
    if(ev.log) log(ev.log.icon,ev.log.msg);
    if(ev.move){ for(const p of ev.move.path){ state.pos=p; positionToken(); await sleep(ev.move.stepMs); } }
    if(ev.confetti) confetti();
    if(ev.dice) diceConfetti();
    if(ev.card){ renderHUD(); await showCard(ev.card); }
    if(ev.reveal){ renderHUD(); await showReveal(ev.reveal); }
    if(ev.collect){ renderHUD(); await showCollect(ev.collect); }
    if(ev.clue){ renderHUD(); await showClue(ev.clue); }
    /* Last of the blocking three: a mini-game takes the whole frame, so anything else this
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
}

/* Upgrade button handler: apply in logic, announce in UI. */
function uiUpgrade(bIdx){
  const r=Builders.upgrade(bIdx); if(!r) return;
  log("🏗️",`Builder ${bIdx+1} → level ${r.level}/${Builders.maxTier()} · −<b>${fmt(r.cost)}</b>`);
  if(r.builderDone) log("🏗️",`<b>Builder ${bIdx+1} fully upgraded</b> (${Builders.doneCount()}/${Builders.count()} done)`);
  // episodes unlock only when a builder is completed
  if(r.title){
    toast(`🎬 Episode unlocked — <b>${r.title}</b>`);
    log("🎬",`Episode unlocked · <b>${r.title}</b>`);
  }
  if(r.seriesDone) seriesComplete();
  renderAll();
  /* Offer it the moment it unlocks — but only to a human, and only when the finale is not
     already on screen. An auto run must never be stopped by a modal (that is the rule the two
     auto modes are built on), and stacking this over seriesComplete() would bury the finale.
     Either way the id stays queued, so nothing is lost by not asking. */
  if(r.episodeId && !r.seriesDone && autoMode===null) openEpisodeUnlock(r.episodeId);
}

function nextSession(){
  const r=advanceSession();
  r.rewards.forEach(x=>log("🎁",`Day ${x.day} login reward · +<b>${fmt(x.amount)}</b> coins`));
  if(r.isNewDay) toast(`☀️ <b>Day ${state.day}</b> — welcome back`);
  log("⏭",`New session · energy refilled to <b>${Math.floor(state.energy)}</b>`);
  renderAll();
}

/* Two auto modes, each a toggle (click to start, click again to stop after the current roll):
     "roll"    — rolls only, nothing else. Stops when energy can't cover the multiplier.
     "session" — rolls AND spends coins on the cheapest upgrades (internal balancing tool).
   Only one can own the loop at a time. */
let autoMode=null;   // null | "roll" | "session"
async function runAuto(mode){
  if(autoMode===mode){ autoMode=null; renderAll(); return; }   // same button again → stop
  if(autoMode!==null||state.animating) return;                  // the other mode owns the loop
  autoMode=mode; renderAll();
  let outOfEnergy=false;
  try{
    while(autoMode===mode && !state.seriesDone){
      if(state.energy<state.mult){ outOfEnergy=true; break; }   // re-checked each pass: mult can change mid-run
      await roll();
      if(state.animating) break;   // a roll bailed out unexpectedly — don't spin
      if(mode==="session"){
        // opportunistically upgrade the cheapest available builder to keep the loop turning
        let up=Builders.cheapest();
        while(up && state.coins>=up.cost && !state.seriesDone){ uiUpgrade(up.b); up=Builders.cheapest(); }
      }
      await sleep(60);
    }
  }finally{
    autoMode=null;
    if(outOfEnergy) log("⏹",`${mode==="roll"?"Auto roll":"Auto-play"} stopped · needs <b>${state.mult}</b>⚡ for a ×${state.mult} roll, have <b>${Math.floor(state.energy)}</b>`);
    renderAll();
  }
}
const autoRoll=()=>runAuto("roll");
const autoPlay=()=>runAuto("session");
function stopAuto(){ if(autoMode!==null){ autoMode=null; renderAll(); } }

/* Builder button click. Upgrades stay clickable during auto-roll, so buying one is
   also how you take manual control: stop the loop, let the in-flight roll finish
   (Builders.upgrade refuses mid-animation), then buy. */
async function onUpgradeClick(bIdx){
  stopAuto();
  while(state.animating) await sleep(50);
  uiUpgrade(bIdx);
}

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
$("#autoBtn").onclick=autoPlay;
/* Builders view. The buildings are a separate 3D scene, so switching means moving the DOM
   overlay AND the scene the renderer draws — doing both here is what keeps them from ever
   disagreeing about which view is up. */
function setBuildersView(on){
  $("#boardScene").classList.toggle("showBuilders",!!on);
  if(use3d()&&window.Board3D&&Board3D.available) Board3D.setView(on?"builders":"board");
  renderAll();
  if(!on) deliverBoxes();
}
/* Boxes bought while the builders screen was up are thrown onto the board now that it is back.

   The state moves FIRST and the animation is decoration on top: spawn() picks the tiles and
   clears the pending count synchronously, so a reload, a view switch or a missing WebGL context
   mid-throw all leave the boxes correctly on the board rather than lost. The only thing that can
   be interrupted is the picture.

   Not awaited by anything: the player is back on the board and free to roll, and roll() blocks
   on state.animating rather than on this. */
function deliverBoxes(){
  const n=state.pendingBoxes|0;
  if(n<=0) return;
  const spawned=OVERLAY_TYPES.mysteryBox.spawn(n);
  /* Fewer free tiles than boxes: the rest stay banked for the next trip back, so a full board
     never silently eats a reward the player paid for. */
  state.pendingBoxes=Math.max(0,n-spawned.length);
  renderAll();
  if(!spawned.length) return;
  log("🎁",`<b>${spawned.length}</b> mystery box${spawned.length>1?"es":""} dropped on the board`);
  /* Auto-play session is the batch tool — thousands of upgrades, nobody watching. It gets the
     boxes without the show, exactly as it skips episode video and the bonus games. */
  if(autoMode==="session"||!use3d()||!window.Board3D||!Board3D.available) return;
  Board3D.throwOverlays(OVERLAYS.flatMap(o=>o.all()),spawned);
}
$("#buildersBtn").onclick=()=>setBuildersView(true);
$("#boardBtn").onclick=()=>setBuildersView(false);
/* Straight into the prediction for the earliest unwatched episode — same ordering rule the
   library enforces, so the two entry points can never disagree about what plays next. */
$("#bingeBtn").onclick=()=>openPrediction(Builders.firstUnwatchedId());
$("#libraryBtn").onclick=()=>openLibrary();
$("#albumBtn").onclick=()=>openAlbum();
$("#watchBtn").onclick=openPrediction;
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
  applyPhoneView(!!cfg.phoneView);   // after loadConfig, so a saved framing comes back
  if(restored) log("💾",`Session restored · Day <b>${state.day}</b> · ${fmt(state.coins)} coins · ${state.rolls} rolls so far.`);
  else log("✨","Welcome to <b>Harbour Heights</b>. Roll to earn, build to unlock, predict to win.");
  if(!storageOK) toast("⚠ Browser storage unavailable — progress won't be saved");
}
window.boot=boot;
/* Safety net: if the module never runs (blocked, 404, or opened from file://), boot anyway
   so the DOM board still comes up rather than leaving a blank page. */
setTimeout(()=>{ if(!window.__booted){ window.__booted=true; boot(); } },1500);
