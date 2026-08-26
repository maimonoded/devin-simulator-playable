"use strict";
/* Orchestration: turns user input into game.js calls, plays back the returned
   events with animation/timing, wires all buttons, and boots the app. */

/* Play a game.js event list: float → log → move → confetti → card → reveal → collect → pack →
   unlock → set complete → pause. Everything from `card` down blocks the roll loop (and
   therefore auto-play) until it finishes. */
async function playEvents(events){
  for(const ev of events){
    /* renderHUD on a float too, not only on the blocking beats. A box pays out entirely in
       state changes, so without this the coin and card counters would sit still through the
       whole collection and only jump at the end of the roll — which reads as "I collected it
       and nothing happened". */
    if(ev.float){ floatToken(ev.float.text,ev.float.color); renderHUD(); }
    if(ev.log) log(ev.log.icon,ev.log.msg);
    if(ev.move){ for(const p of ev.move.path){ state.pos=p; positionToken(); await sleep(ev.move.stepMs); } }
    if(ev.confetti) confetti();
    if(ev.dice) diceConfetti();
    if(ev.card){ renderHUD(); await showCard(ev.card); }
    if(ev.reveal){ renderHUD(); await showReveal(ev.reveal); }
    if(ev.collect){ renderHUD(); await showCollect(ev.collect); }
    /* A box: closed, tapped or opened by its own timer, then its cards one at a time.
       Deliberately NOT renderHUD() first, unlike every other beat above. The cards are already
       banked by the time this runs, so refreshing the HUD here would tick the counter to 1/25
       while the box is still shut — the reveal spoiled by its own scoreboard. showPack calls
       renderHUD as each card turns over instead. */
    if(ev.pack){ await showPack(ev.pack); }
    /* …and only then what the cards bought, in the order they happened. */
    if(ev.setDone){ renderAll(); await showSetComplete(ev.setDone); }
    if(ev.statusUp){ renderAll(); await showStatusUp(ev.statusUp); }
    if(ev.unlock){ renderAll(); await showUnlocks(ev.unlock.ids); }
    if(ev.boardDone){ renderAll(); await showBoardComplete(); }
    /* Last of the blocking beats: a mini-game takes the whole frame, so anything else this
       event carries should have been shown before it opens. */
    if(ev.minigame){ renderHUD(); await showMinigame(ev.minigame); }
    if(ev.pause) await sleep(ev.pause);
  }
}

/* Episodes just unlocked by the cards that landed.

   The log and the toast always happen; the modal only for a human, because an auto run must
   never be stopped by one — that is the rule both auto modes are built on. Declining costs
   nothing: the ids are already on state.epQueue, and the 🎬 button on the board carries them. */
async function showUnlocks(ids){
  ids.forEach(id=>log("🎬",`Episode unlocked · <b>${Episodes.titleOf(id)}</b>`));
  if(!ids.length) return;
  toast(`🎬 Episode unlocked — <b>${Episodes.titleOf(ids[0])}</b>${ids.length>1?` +${ids.length-1} more`:""}`);
  if(autoMode!==null) return;
  /* Only offer to watch what can actually be watched. A page that fills out of order is a real
     unlock — it is in the library, and the album shows it collected — but the story is not ready
     for it, so pushing "watch now" would open a dialog whose button refuses. */
  const playable=Collection.firstUnwatchedId();
  if(!playable) return;
  await openEpisodeUnlock(playable);
}

/* Status milestones met by whatever just happened — a card collected, an episode watched, a
   set finished, a roll made. Idempotent (js/status.js), so calling it after every beat costs
   nothing and missing one only delays a toast. */
async function afterCollect(){
  const before=Status.points();
  const got=Status.sweep();
  if(got.length){
    got.forEach(i=>log("⭐",`Status · earned <b>${i.name}</b> · +${i.points}`));
    renderAll();
    /* The same beat a box's status drop gets — an item earned by playing is the same kind of
       thing as one found in a box, so it is shown the same way rather than as a toast that
       scrolls past. */
    await showStatusUp({items:got,from:before,to:Status.points()});
  }
  /* …and every LEVEL milestone the points just crossed (GDD 5.3). After the item sweep, because
     an item is worth points and can be the thing that crosses the level. */
  await afterMilestones();
}

/* Status milestones, every five levels. Each pays once; the sweep is idempotent, so a missed
   one is a delayed reward and never a lost one. A pack milestone opens the box for real, which
   is why this awaits playEvents rather than announcing it. */
async function afterMilestones(){
  const paid=Status.milestoneSweep();
  for(const p of paid){
    const m=p.milestone;
    log("🏅",`Level <b>${m.level}</b> · ${m.blurb}`);
    renderAll();
    if(p.clues.length){
      p.clues.forEach(c=>log("🔍",`Clue cache · <i>${c.clue.text}</i>`));
      toast(`🏅 Level ${m.level} — <b>${p.clues.length} clue${p.clues.length>1?"s":""}</b>`);
      /* A clue cache can complete an episode, and the unlock owes the same beat it owes
         anywhere else — so it goes through the event list rather than round it. */
      const fresh=Collection.claimUnlocked(Collection.unlockedEpisodeIds()
        .filter(id=>state.epQueue.includes(id)||Collection.watchedIds().includes(id)));
      if(fresh.length) await playEvents([{unlock:{ids:fresh}}]);
    }
    if(p.energy) toast(`🏅 Level ${m.level} — <b>+${p.energy}</b> energy`);
    if(p.tier) await playEvents(openBoxEvents(p.tier));
  }
  if(paid.length) renderAll();
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
    /* Milestones this roll just met. Awaited, and inside the try, so the track's beat plays
       while the board is still locked — a reward that arrives after Roll is live again is a
       reward the player is already rolling through. */
    await afterCollect();
  }catch(e){
    console.error("roll failed:",e);
    log("⚠️","<b>Something went wrong mid-roll</b> — board recovered.");
    clearOverlayFx();
    /* The sweep is idempotent, so a roll that died still hands over what was earned — just
       without the ceremony, since the ceremony is what may have broken. */
    Status.sweep();
  }finally{
    state.animating=false;
    renderAll();
  }
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
     "session" — rolls AND spends the coins (internal balancing tool).
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
      if(mode==="session"){ await autoSpend(); await autoWatch(); }
      await sleep(60);
    }
  }finally{
    autoMode=null;
    if(outOfEnergy) log("⏹",`${mode==="roll"?"Auto roll":"Auto-play"} stopped · needs <b>${state.mult}</b>⚡ for a ×${state.mult} roll, have <b>${Math.floor(state.energy)}</b>`);
    renderAll();
  }
}
/* The session loop's coin sink, and the reason it is a balancing tool rather than a fast
   player: it converts every spare coin into progress, boxes first because those are what move
   the collection, then the status shelf.

   Packs go through Boxes.buyEvents() like every other purchase, so the batch run pays exactly
   what a human pays and draws against exactly the same tables — and showPack() takes its fast
   path in this mode, so nothing is watched. Cheapest first, mirroring the builder loop this
   replaced. */
async function autoSpend(){
  let t=Boxes.cheapest();
  while(t && !state.seriesDone && autoMode==="session"){
    /* Boxes.buyEvents spends AND opens, so the batch run pays exactly what a human pays — the
       Insider's escalation included, which is the whole point of modelling it. */
    const ev=Boxes.buyEvents(t.key);
    if(!ev) break;
    await playEvents(ev);
    t=Boxes.cheapest();
  }
  let item=Status.cheapestBuyable();
  while(item){
    const r=Status.buy(item.id);
    if(!r) break;
    log("🛍",`Bought <b>${r.item.name}</b> · −${fmt(r.cost)} coins · +${r.item.points} status`);
    item=Status.cheapestBuyable();
  }
  await afterCollect();
}
/* The balancing tool has to WATCH, or a set can never turn over: a set is finished when its
   episodes have been seen, and nobody is at the keyboard to see them.

   No modal, no video, no answer picked — resolvePrediction's `auto` path decides the outcome
   from the modelled accuracy (Economy.accuracyFor, which the clue cards raise), which is the
   whole point of the mode. The stake is the tier the workbook's projections assume, and the
   payout is priced at cfg.avgOdds: the model's own average, which is exactly what a projection
   of "what a bettor gets" is built on. That is this knob's first honest call site.

   Auto-play session only. Auto roll simulates a real player, and a real player chooses when to
   watch — which is why neither mode opens the prediction modal on its own. */
async function autoWatch(){
  let id=Collection.firstUnwatchedId(), n=0;
  while(id&&autoMode==="session"&&n++<200){
    const ep=Episodes.get(id);
    if(!ep) break;
    const wager=Economy.canWager(state.coins)
      ? Economy.wagerTier(Economy.DEFAULT_TIER,state.coins).amount : 0;
    const odds=Math.max(1,+cfg.avgOdds||1);
    const r=resolvePrediction({wager,odds,sel:ep.correct,correct:ep.correct,auto:true,id});
    log("🎬",`${ep.title} · ${wager
      ? (r.won?`won +${fmt(r.payout)}`:`lost ${fmt(wager)}`)
      : "watched, no wager"} (auto)`);
    id=Collection.firstUnwatchedId();
  }
  /* And the set turns over, silently — showBoardComplete's own auto path does the advance. */
  if(Collection.boardFinished()) await playEvents([{boardDone:{board:Collection.num()}}]);
  await afterCollect();
}
const autoRoll=()=>runAuto("roll");
const autoPlay=()=>runAuto("session");
function stopAuto(){ if(autoMode!==null){ autoMode=null; renderAll(); } }

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
/* The 🎬 button is both routes into an episode: straight into the earliest unwatched one when
   something is waiting, and the library otherwise. One button, because "watch the next one" and
   "watch one again" are the same intent from the player's side. */
$("#episodesBtn").onclick=()=>{
  /* Into the next episode when there IS one to watch, the library otherwise. A sealed reveal
     wins over both: that result is owed before anything else can start. */
  if(state.pendingReveal||Collection.firstUnwatchedId()) openPrediction();
  else openLibrary();
};
$("#albumBtn").onclick=()=>openAlbum();
/* Both halves of the player block open the profile — the avatar and the rank beside it are one
   control as far as the player is concerned. */
$("#avatarBtn").onclick=()=>openProfile();
$("#hStatus").onclick=()=>openProfile();
$("#watchBtn").onclick=()=>openPrediction();
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
  if(restored) log("💾",`Session restored · Day <b>${state.day}</b> · ${fmt(state.coins)} coins · ${Cards.owned()}/${Cards.poolSize()} cards · set ${Collection.num()}.`);
  else log("✨","Welcome to <b>Harbour Heights</b>. Roll to find cards, collect a set to unlock an episode, predict to win.");
  /* The board content is authored data, and a mis-authored board is the one failure that would
     be invisible in play — a card that can drop but is never wanted just looks like bad luck.
     Say so in the log rather than only in the tests. */
  [["Set "+Collection.num(),Collection.validate()],
   ["The board",validateBoard()],
   ["The pools",Pools.validate()],
   ["The clues",Clues.validate()],
   ["The collection",Cards.validate()],
   ["Status",Status.validate()]].forEach(([what,bad])=>{
    if(!bad.length) return;
    console.warn(what+":",bad);
    log("⚠️",`<b>${what} does not add up</b> — ${bad.length} problem${bad.length>1?"s":""}, see the console.`);
  });
  if(!storageOK) toast("⚠ Browser storage unavailable — progress won't be saved");
}
window.boot=boot;
/* Safety net: if the module never runs (blocked, 404, or opened from file://), boot anyway
   so the DOM board still comes up rather than leaving a blank page. */
setTimeout(()=>{ if(!window.__booted){ window.__booted=true; boot(); } },1500);
