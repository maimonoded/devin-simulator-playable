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
    /* Before the floats: the box has to pop before its numbers can come out of the burst. */
    if(ev.boxOpen){ renderHUD(); await showBoxOpen(ev.boxOpen); }
    if(ev.float){ floatToken(ev.float.text,ev.float.color); renderHUD(); }
    if(ev.log) log(ev.log.icon,ev.log.msg);
    if(ev.move){ for(const p of ev.move.path){ state.pos=p; positionToken(); await sleep(ev.move.stepMs); } }
    if(ev.confetti) confetti();
    /* A ticket may be awarded from inside a played event (the Plot Twist card, the mystery
       box), so the announcement rides along with it rather than being fired by a button. */
    if(ev.ticketAward){ renderHUD(); announceTickets(ev.ticketAward); }
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

/* One pull: take a card off the shoe, show it, then act on it.

   A TICKET CARD RETURNS EARLY — it must not fall through to resolveLandingEvents(). The token
   does not move, so the landing would re-resolve the tile it is already standing on AND consume
   any mystery box sitting there (resolveLandingEvents runs overlays first), handing out a free
   re-collect on every ticket. Skipping the move loop is not enough; the return is the fix. */
async function pull(){
  if(state.animating||Shoe.isEmpty()||Tickets.rowFull()||state.seriesDone) return;
  state.animating=true; renderAll();
  // try/finally: if anything below throws, the animating flag must still clear —
  // otherwise the board soft-locks with Pull permanently disabled.
  try{
    const card=Shoe.pull();
    if(card==null) return;
    await pullCardAnim(card);           // tap → card face up (cfg.pullRevealMs)
    await sleep(cfg.pullToMoveMs);      // face up → token starts moving

    if(Shoe.isTicket(card)){
      /* The DOM half of the joker celebration; Shoe3D owns the 3D half (the card comes up big,
         punches, spins, and is collected by the row). Fired here rather than inside the flight
         because this is the moment it has arrived at full size and the player is looking at it.
         Skipped for the batch balancing tool, which runs thousands of pulls with nobody at the
         keyboard and would otherwise spend every one of them building forty divs. */
      if(autoMode!=="session" && typeof confetti==="function") confetti();
      log("🎟","Pulled a <b>ticket</b>");
      const tev=ticketPullEvents(card);
      await playEvents(tev);
      /* The award rides on the event list already (js/tiles/README.md, `ticketAward`), so it is
         read back off it rather than threaded out through a second return value. */
      const award=(tev[0]||{}).ticketAward;
      /* HOLD THE TURN OPEN UNTIL THE CELEBRATION IS OVER — the one place the pull deliberately
         waits on presentation, and the exception that proves the rule above it.

         Everything else about a card's second beat is off the critical path on purpose. A joker
         is different in kind: it is not the card being tidied away, it IS the reward, and it is
         the only one the game shows rather than tells. Without this the auto loop comes back
         round 60ms after pull() returns and the next card puts the celebration away mid-hold —
         so the louder it got, the less of it anyone actually saw.

         Skipped for the batch balancing tool, which takes the fast path through videos, box
         throws and bonus games for the same reason: nobody is watching, and a second and a bit
         per ticket is real money across a run of thousands. */
      if(autoMode!=="session" && use3d() && window.Board3D && Board3D.available && Board3D.cardStageClear)
        await Board3D.cardStageClear(cfg.jokerHoldMs + cfg.cardToTableMs + 600);
      /* AND IF THAT WAS THE FIFTH, the collection takes a bow. Awaited on purpose — this is the
         one presentation the turn waits for, because a moment the player can miss is the whole
         complaint it exists to answer. Its promise is timer-backstopped inside Shoe3D, so a
         backgrounded tab still settles it and pull()'s finally still clears state.animating. */
      const done=(award&&award.filled||[]).filter(i=>Tickets.isFull(i));
      if(done.length) await celebrateCollection(done[done.length-1]);
      return;                           // ← see the header. Not a break, not a skip: a return.
    }

    let passedStart=false;
    const steps=Shoe.rank(card);        // the rank is the move; the suit is only ever art
    for(let s=0;s<steps;s++){
      state.pos=(state.pos+1)%40;
      if(state.pos===0) passedStart=true;
      positionToken();
    if(!use3d()){ const tok=$("#token"); tok.classList.remove("hop"); void tok.offsetWidth; tok.classList.add("hop"); }
      await sleep(cfg.tokenStepMs);
    }
    // pass-start (lap) reward if we crossed 0 but did not land there
    if(passedStart && state.pos!==0){
      const pass=applyPassStart(1);
      floatToken("+"+fmt(pass),"var(--gold)"); log("⭐",`Passed Start · +<b>${fmt(pass)}</b> coins`);
    }
    await playEvents(resolveLandingEvents(1));
  }catch(e){
    console.error("pull failed:",e);
    log("⚠️","<b>Something went wrong mid-pull</b> — board recovered.");
    clearOverlayFx();
  }finally{
    state.animating=false; renderAll();
    /* UNCONDITIONAL: an error path still owes the prompt, and swallowing it would leave an
       unlocked episode with nothing ever offering it. */
    flushUnlockOwed();
  }
}

/* What a ticket card does: fills a placeholder and drops mystery boxes on the board.
   State first, animation second — dropBoxes() picks the tiles synchronously, so a reload or a
   lost WebGL context mid-throw still leaves the boxes correctly on the board. */
function ticketPullEvents(card){
  const ev=[];
  /* THE CARD DECIDES WHICH EPISODE, not the board's scarcity. Shoe.jokerIndex returns -1 for a
     joker this build does not know, and award() treats that as a wildcard rather than stuffing
     episode 1 — see the note on jokerIndex. Shoe3D.pullCard computes the same slot from the same
     rule so the card flies where the ticket lands; the two are only correct together. */
  const type=Shoe.jokerIndex(card);
  const award=Tickets.award(1,type);
  const lead=(typeof CardArt!=="undefined"&&CardArt.JOKERS[type]) ? CardArt.JOKERS[type].name : null;
  ev.push({float:{text:"+1🎟",color:"var(--pink)"},ticketAward:award,
           log:{icon:"🎟",msg:lead
             ? `<b>${lead}</b> collected · <b>${Tickets.doneCount()}/${Tickets.count()}</b> episodes`
             : `Ticket collected · <b>${Tickets.doneCount()}/${Tickets.count()}</b> episodes`}});
  dropBoxes(cfg.boxesPerTicketCard);
  return ev;
}

/* The series finale, owed until the board is still — see announceTickets. It is the one thing
   still deferred this way: a completed SERIES is a full-stop and does want a screen, where a
   completed episode does not (the play row's button already has it).
   Deliberately NOT persisted: a reload costs the celebration and nothing else, where persisting
   it would let a saved run owe a modal for ever. */
let _unlockOwed=null;
function flushUnlockOwed(){
  const owed=_unlockOwed; _unlockOwed=null;
  if(!owed||autoMode!==null) return;
  if(owed.finale) seriesComplete();
}

/* THE COLLECTION TAKES A BOW — five of one lead have filled a placeholder and bought an episode.
   The cards come back out, splay into a hand, hold, merge into the one episode, and drop home.

   The 3D half is Shoe3D.completeHand; this adds the DOM half — the card shower and a banner
   naming the episode. Deliberately NOT confetti: pull() already threw some when the joker landed
   and a second burst two seconds later reads as a stutter rather than a bigger moment.

   Skipped for the batch balancing tool, which takes the fast path through every other
   presentation for the same reason, and degrades to the banner alone when the 3D board is off or
   failed — so the moment is still announced, just not performed. */
async function celebrateCollection(slot){
  if(autoMode==="session") return;
  const id=Tickets.idAt(slot), title=id?Episodes.titleOf(id):null;
  /* PIN THE COUNT for the whole beat. The episode went into state.epQueue when the ticket
     landed, so without this the button would already read its new number while the card that
     delivers it is still on the board — announcing the arrival before it happens. */
  holdBingeCount(Math.max(0,state.epQueue.length-1));
  renderAll();
  if(typeof cardShower==="function") cardShower();
  if(title&&typeof showEpisodeReady==="function") showEpisodeReady(title);
  try{
    /* THE CARD FLIES ITSELF. completeHand's last beat now carries the merged card into the
       episode button inside the 3D scene (Board3D.elementWorldPos unprojects the button's rect),
       so there is no DOM leg and nothing to hand off. Four separate silent failures lived in that
       handoff — wrong coordinate frame, an empty cloned canvas, an animation with no duration,
       and a fallback with neither the right origin nor the right size — and every one of them
       looked identical: the cards simply vanished. */
    if(use3d()&&window.Board3D&&Board3D.available&&Board3D.completeHand)
      await Board3D.completeHand(slot,Tickets.perEpisode());
  }catch(e){ console.error("collection celebration failed:",e); }
  finally{
    /* ALWAYS released. A pinned badge that never came back would under-report the queue for the
       rest of the run, and the player would think episodes were being eaten. */
    releaseBingeCount(); renderAll();
  }
}

/* ---------------- debug ----------------
   Development only. Presentation beats normally need a whole collection (or a particular
   landing) to see even once, which makes them nearly impossible to tune. This fires them on
   demand. Add entries as they are needed — go-to-jail, land-on-bonus, pass-start. */
const DEBUG_ACTIONS=[
  { label:"🎬 Collection complete", run:async()=>{
      /* The first not-yet-full placeholder, topped up to one short so the beat has a real slot
         to complete into — the animation reads the row, so faking it would not exercise it. */
      const slot=Tickets.pageSlots().find(i=>!Tickets.isFull(i));
      if(slot==null){ toast("🐞 Every episode on the row is already complete"); return; }
      const per=Tickets.perEpisode();
      state.tickets[slot]=Math.max(0,per-1);
      const k=Tickets.pageSlots().indexOf(slot);
      await pullJoker(Shoe.JOKERS[k%Shoe.JOKERS.length]);
    } },
];
/* Put a specific card on the front of the shoe and pull it, so a debug beat goes through the
   REAL path — same award, same animation, same ordering — rather than a parallel one that can
   drift from it. */
async function pullJoker(card){
  if(state.animating) return;
  state.shoe.unshift(card);
  await pull();
}
function openDebugMenu(){
  const el=$("#debugMenu");
  if(!el) return;
  const open=el.classList.toggle("show");
  if(!open) return;
  el.innerHTML="";
  DEBUG_ACTIONS.forEach(a=>{
    const b=document.createElement("button");
    b.className="debugItem"; b.textContent=a.label;
    b.onclick=async()=>{ el.classList.remove("show"); try{ await a.run(); }catch(e){ console.error("debug action failed:",e); } };
    el.appendChild(b);
  });
}

/* Announce what a ticket award did. Called from playEvents (the card and the box) and from the
   store, so all three paths say the same thing in the same order. */
function announceTickets(r){
  if(!r) return;
  /* LOGGED, NOT TOASTED. The celebration already names the episode on the board — the banner in
     showEpisodeReady — so a toast saying the same sentence puts it on screen twice, over the top
     of the animation that was the point. The log keeps the record. */
  r.titles.filter(Boolean).forEach(t=>log("🎬",`Episode unlocked · <b>${t}</b>`));
  if(r.banked) log("🎟",`<b>${r.banked}</b> ticket${r.banked>1?"s":""} banked — watch this row to spend them`);
  /* DEFERRED, not skipped — see _unlockOwed. */
  if(r.seriesDone){ _unlockOwed={finale:true}; return; }
  renderAll();
  /* Offer it the moment it unlocks — but only to a human, and only when the finale is not
     already on screen. An auto run must never be stopped by a modal (that is the rule the two
     auto modes are built on), and stacking this over seriesComplete() would bury the finale.
     Either way the id stays queued, so nothing is lost by not asking. */
  const id=r.episodeIds&&r.episodeIds[0];
  /* NO POPUP. Unlocking an episode used to end in a Watch now / Binge later dialog. It was
     first fired immediately (covering the celebration), then deferred until the board settled —
     and neither is right, because the choice it offers no longer needs asking: the episode goes
     into the play row's button, the card is SEEN flying into it, and the button is how you watch.
     A modal after all that interrupts the run to ask a question the screen has just answered.
     The id is in state.epQueue and the button is on screen, so nothing is lost by not asking. */
}

function nextSession(){
  const r=advanceSession();
  r.rewards.forEach(x=>log("🎁",`Day ${x.day} login reward · +<b>${fmt(x.amount)}</b> coins`));
  if(r.isNewDay) toast(`☀️ <b>Day ${state.day}</b> — welcome back`);
  /* "dealt N, now M" rather than "refilled to the cap": the shoe can already be over the cap
     from a bought pack, in which case a session deals nothing and "refilled" would be a lie. */
  log("⏭",`New session · +<b>${r.cards}</b> card${r.cards===1?"":"s"} · <b>${Shoe.count()}</b> in hand`);
  renderAll();
}

/* Two auto modes, each a toggle (click to start, click again to stop after the current pull):
     "roll"    — pulls only, nothing else. Stops when the shoe runs dry or the row fills.
     "session" — pulls AND buys packs with the coins it earns (internal balancing tool).
   Only one can own the loop at a time. The name "roll" is kept because it is also the
   #rollBtn's id and the class the CSS keys off; renaming it is churn for no gain. */
let autoMode=null;   // null | "roll" | "session"
async function runAuto(mode){
  if(autoMode===mode){ autoMode=null; renderAll(); return; }   // same button again → stop
  if(autoMode!==null||state.animating) return;                  // the other mode owns the loop
  autoMode=mode; renderAll();
  let stopReason=null;
  try{
    while(autoMode===mode && !state.seriesDone){
      /* Re-checked every pass, not once: the shoe empties mid-run and the row fills mid-run.
         These two conditions must match pull()'s own guard and render.js's cantRoll — teach
         one and not the others and the buttons lie about a loop that is still going. */
      if(Tickets.rowFull()){ stopReason="row"; break; }
      if(Shoe.isEmpty()){
        /* The balancing tool buys its own cards — without this it stops at the first empty
           shoe and models nothing. Decks are real money now, so what it models is the SPENDING
           player: the upper bound on how fast a run can go when cards are never the constraint.
           A human's auto-pull stops instead and is told why. */
        if(mode==="session") Shoe.buyPack();
        else { stopReason="cards"; break; }
      }
      await pull();
      if(state.animating) break;   // a pull bailed out unexpectedly — don't spin
      await sleep(60);
    }
  }finally{
    autoMode=null;
    const what=mode==="roll"?"Auto pull":"Auto-play";
    if(stopReason==="cards") log("⏹",`${what} stopped · the deck is empty — wait for cards, or buy a deck ($${Shoe.priceUsd().toFixed(2)})`);
    if(stopReason==="row") log("⏹",`${what} stopped · all ${Tickets.pageSlots().length} episodes ready — watch them to keep pulling`);
    renderAll();
  }
}
const autoRoll=()=>runAuto("roll");
const autoPlay=()=>runAuto("session");
function stopAuto(){ if(autoMode!==null){ autoMode=null; renderAll(); } }

/* The riffle: the deck already on the table and the one just bought, shuffled into one.

   PLAYED WHEN THE BOARD IS ACTUALLY VISIBLE, which is the whole reason it is a separate step.
   Buying from the store happens with a modal over the board, so the shuffle is owed and paid on
   the way out; buying from the play row has nothing in the way, so it plays at once. Same rule
   the mystery boxes follow — a reward animated behind a panel is a reward nobody sees.

   Deliberately NOT persisted: the cards are already in the shoe (Shoe.buyPack merges before any
   of this), so a reload mid-store costs a flourish and nothing else. Persisting it would mean a
   saved run could owe an animation forever.

   Blocks the pull loop while it runs, so a card cannot fly off a deck that is mid-riffle. */
let _shuffleOwed=false;
async function playDeckShuffle(){
  _shuffleOwed=false;
  /* The batch balancing tool buys constantly and nobody is watching — same fast path it takes
     for the box throw, the bonus games and the episode video. */
  if(autoMode==="session"||!use3d()||!window.Board3D||!Board3D.available) return;
  state.animating=true; renderAll();
  try{ await Board3D.shuffleDeck(); }
  catch(e){ console.error("deck shuffle failed:",e); }
  finally{ state.animating=false; renderAll(); }
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
/* Pull is one button with three modes: tap it to pull once, hold it to hand the loop over to
   auto-pull, tap it again to stop. And when the ticket row is full it is the way INTO the
   prediction — a full row is the game asking you to watch, not a dead end, so the button
   redirects rather than greying out. That matters more than it did: with dice and energy gone
   this is the only stop condition left in the game.

   Pointer events rather than click, because the tap and the hold have to be told apart before
   the click would fire. The hold is cancelled if the pointer leaves the button, so sliding off
   is the way to back out without pulling. */
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
    if(autoMode==="roll") autoRoll();        // tap while auto-pulling = stop
    else if(wasTap){
      // a full row means "go and watch", not "nothing happens"
      if(Tickets.rowFull()&&!state.seriesDone) openPrediction(Tickets.firstUnwatchedId());
      else pull();
    }
  });
  btn.addEventListener("pointerleave",endHold);
  btn.addEventListener("pointercancel",endHold);
})();
$("#autoBtn").onclick=autoPlay;
/* Tapping a ticket placeholder on the board.

   A completed placeholder draws a play triangle, so it has to actually BE a button — an
   affordance that does nothing reads as a broken game, and once the row is full it is the only
   thing on screen that looks like the way forward.

   The ordering rule is the library's, verbatim rather than re-derived: any unwatched episode
   starts the EARLIEST unwatched one, because the story is serialised and jumping ahead spoils
   what was skipped — and it SAYS so, or being handed a different episode than the one you
   pressed just reads as a bug. A sealed bet always resumes on its own episode, whichever slot
   was tapped, because the result is owed on that one. Board3D calls this through a global so
   the module does not have to know what a prediction is. */
window.onSlotTap=function(slot){
  if(state.animating||autoMode!==null) return;
  const id=Tickets.idAt(slot);
  if(!id) return;
  if(!Tickets.isFull(slot)){
    const per=Tickets.perEpisode();
    toast(`🎟 <b>${Tickets.held(slot)}/${per}</b> tickets — keep pulling to unlock this one`);
    return;
  }
  if(state.pendingReveal) return openPrediction(state.pendingReveal.id);
  if(!state.epQueue.includes(id)) return openLibrary();   // already watched — offer the rewatch
  const next=Tickets.firstUnwatchedId()||id;
  if(next!==id) toast(`▶ Episodes play in order — starting <b>${Episodes.titleOf(next)}</b>`);
  openPrediction(next);
};
/* Drop mystery boxes on the board — one per ticket earned.

   The state moves FIRST and the animation is decoration on top: spawn() picks the tiles and
   clears the pending count synchronously, so a reload or a missing WebGL context mid-throw
   still leave the boxes correctly on the board rather than lost. The only thing that can be
   interrupted is the picture.

   Not awaited by anything: pull() blocks on state.animating, not on this. */
function dropBoxes(n){
  const want=Math.max(0,(n|0))+(state.pendingBoxes|0);
  if(want<=0) return;
  const spawned=OVERLAY_TYPES.mysteryBox.spawn(want);
  /* Fewer free tiles than boxes: the rest stay banked for the next drop, so a full board never
     silently eats a reward the player earned. */
  state.pendingBoxes=Math.max(0,want-spawned.length);
  renderAll();
  if(!spawned.length) return;
  log("🎁",`<b>${spawned.length}</b> mystery box${spawned.length>1?"es":""} dropped on the board`);
  /* Auto-play session is the batch tool — thousands of pulls, nobody watching. It gets the
     boxes without the show, exactly as it skips episode video and the bonus games. */
  if(autoMode==="session"||!use3d()||!window.Board3D||!Board3D.available) return;
  /* Thrown FROM the card when there is one on the stage — which on the path that matters, a
     joker, there always is: the boxes go while it is still held up. So the reward is seen to
     come out of the ticket that earned it instead of dropping from nowhere. Null on every other
     path (and if the card has already been collected), and throwOverlays falls back to the
     drop-from-above it has always done. */
  Board3D.throwOverlays(
    OVERLAYS.flatMap(o=>o.all().map(i=>({i,gold:!!(o.isGold&&o.isGold(i))}))),spawned,
    Board3D.cardWorldPos&&Board3D.cardWorldPos());
}
/* Straight into the prediction for the earliest unwatched episode — same ordering rule the
   library enforces, so the two entry points can never disagree about what plays next. */
$("#bingeBtn").onclick=()=>openPrediction(Tickets.firstUnwatchedId());
$("#libraryBtn").onclick=()=>openLibrary();
$("#albumBtn").onclick=()=>openAlbum();
$("#avatarBtn").onclick=()=>openProfile();
$("#debugBtn").onclick=openDebugMenu;
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
  /* initState() mints the opening shoe and reads cfg.packSize to size it, so loadConfig must
     precede it — initialising the shoe first would size every fresh run from DEFAULTS rather
     than from an imported model. Do not reorder these three. */
  loadConfig();
  initState();
  const restored=loadState();   // overlay saved progress, if any
  buildBoard(); buildTuning(); renderAll();
  applyPhoneView(!!cfg.phoneView);   // after loadConfig, so a saved framing comes back
  if(restored) log("💾",`Session restored · Day <b>${state.day}</b> · ${fmt(state.coins)} coins · ${state.pulls} pulls so far.`);
  else log("✨","Welcome to <b>Harbour Heights</b>. Pull to move, collect tickets, predict to win.");
  if(!storageOK) toast("⚠ Browser storage unavailable — progress won't be saved");
}
window.boot=boot;
/* Safety net: if the module never runs (blocked, 404, or opened from file://), boot anyway
   so the DOM board still comes up rather than leaving a blank page. */
setTimeout(()=>{ if(!window.__booted){ window.__booted=true; boot(); } },1500);
