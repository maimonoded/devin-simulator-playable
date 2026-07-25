"use strict";
/* Orchestration: turns user input into game.js calls, plays back the returned
   events with animation/timing, wires all buttons, and boots the app. */

/* Play a game.js event list: float → log → move → confetti → reveal → collect → pause.
   reveal and collect block the roll loop (and therefore auto-play) until they finish. */
async function playEvents(events){
  for(const ev of events){
    if(ev.float) floatToken(ev.float.text,ev.float.color);
    if(ev.log) log(ev.log.icon,ev.log.msg);
    if(ev.move){ for(const p of ev.move.path){ state.pos=p; positionToken(); await sleep(ev.move.stepMs); } }
    if(ev.confetti) confetti();
    if(ev.dice) diceConfetti();
    if(ev.card){ renderHUD(); await showCard(ev.card); }
    if(ev.reveal){ renderHUD(); await showReveal(ev.reveal); }
    if(ev.collect){ renderHUD(); await showCollect(ev.collect); }
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
      positionToken(); const tok=$("#token"); tok.classList.remove("hop"); void tok.offsetWidth; tok.classList.add("hop");
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
  const r=applyUpgrade(bIdx); if(!r) return;
  toast(`🎬 Episode unlocked — <b>${r.title}</b>`);
  log("🎬",`Builder ${bIdx+1} → level ${r.level}/${cfg.tiers} · −<b>${fmt(r.cost)}</b> · unlocked <b>${r.title}</b>`);
  if(r.builderDone) log("🏗️",`<b>Builder ${bIdx+1} fully upgraded</b> (${buildersDone()}/${cfg.buildings} done)`);
  if(r.seriesDone) seriesComplete();
  renderAll();
}

function nextSession(){
  const r=advanceSession();
  r.rewards.forEach(x=>log("🎁",`Day ${x.day} login reward · +<b>${fmt(x.amount)}</b> coins`));
  if(r.isNewDay) toast(`☀️ <b>Day ${state.day}</b> — welcome back`);
  log("⏭",`New session · energy refilled to <b>${Math.floor(state.energy)}</b>`);
  renderAll();
}

/* Auto-play is a toggle: first click starts, second click stops after the current roll. */
let autoOn=false;
async function autoPlay(){
  if(autoOn){ autoOn=false; renderAll(); return; }
  if(state.animating) return;
  autoOn=true; renderAll();
  try{
    while(autoOn && state.energy>=state.mult){
      await roll();
      if(state.animating) break;   // a roll bailed out unexpectedly — don't spin
      // opportunistically upgrade the cheapest available builder to keep the loop turning
      let up=cheapestUpgrade();
      while(up && state.coins>=up.cost && !state.seriesDone){ uiUpgrade(up.b); up=cheapestUpgrade(); }
      await sleep(60);
    }
  }finally{
    autoOn=false; renderAll();
  }
}

/* ---------------- wiring ---------------- */
$("#rollBtn").onclick=roll;
$("#autoBtn").onclick=autoPlay;
$("#watchBtn").onclick=openPrediction;
$("#nextBtn").onclick=nextSession;
$("#flatBtn").onclick=()=>$("#board").classList.toggle("flat");
document.querySelectorAll(".mopt").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".mopt").forEach(x=>x.classList.remove("on")); b.classList.add("on");
  state.mult=+b.dataset.m; renderAll(); });
$("#drawerBtn").onclick=()=>$("#drawer").classList.add("open");
$("#closeDrawer").onclick=()=>$("#drawer").classList.remove("open");

/* ---------------- boot ---------------- */
loadConfig();                 // tuning values first — initState() reads cfg.energyCap
initState();
const restored=loadState();   // overlay saved progress, if any
buildBoard(); buildTuning(); setDice(3,4); syncMultButtons(); renderAll();
if(restored) log("💾",`Session restored · Day <b>${state.day}</b> · ${fmt(state.coins)} coins · ${state.rolls} rolls so far.`);
else log("✨","Welcome to <b>Harbour Heights</b>. Roll to earn, build to unlock, predict to win.");
if(!storageOK) toast("⚠ Browser storage unavailable — progress won't be saved");
