"use strict";
/* Opening a box — the beat the whole collection loop hangs off.

   The contract the user asked for, exactly: the box arrives closed, the player may TAP it to
   open it, and if they do not it opens ITSELF after cfg.packAutoOpenMs (five seconds). Then
   what was inside is shown, one card at a time.

   THE MONEY IS ALREADY BANKED before this runs. js/boxes.js opened the box, added the cards,
   paid the coins and shelved the status item; the event carries a description of what happened
   so this can present it. That is the same split the bonus mini-games use, and it is why
   skipping the animation — an auto-play session, a mid-roll error, a closed tab — can never
   change what the player got.

   ---- IT IS NOT A DIALOG ----

   The box is a real object in the board's scene (js/ui/box3d.js): it arrives over the middle of
   the board, turns and bobs, and the player taps the mesh itself. It swells and bursts where it
   stood, and the cards fly out of the burst and hang in the air. The only DOM is a caption and
   the countdown bar — the two things a mesh cannot say — and neither is a panel or a scrim.

   The modal below is the FALLBACK, for cfg.board3d = 0, a machine with no WebGL, or a box model
   that failed to load. It is the same beat in a window, and it exists so that losing the scene
   costs presentation rather than the ability to open a box at all.

   Blocking either way: it returns a promise the roll loop awaits, and it resolves on every path.
   Auto-play session takes the fast path and sees nothing, exactly as it skips episode video and
   the bonus games. */

function showPack(res){
  const auto=typeof autoMode!=="undefined"&&autoMode==="session";
  if(auto) return Promise.resolve();     // the batch tool takes the reward, not the show
  if(typeof use3d==="function"&&use3d()&&window.Board3D&&Board3D.available&&Board3D.packReady())
    return showPackInScene(res);
  return showPackModal(res);
}

/* The box, in the world. Three beats: it waits, it bursts, the cards come out. */
async function showPackInScene(res){
  const tier=res.tier;
  try{
    packHud(`<b>${tier.name}</b> · tap it to open`,Math.max(0,cfg.packAutoOpenMs||0));
    await Board3D.presentBox(tier);
    packHud(`<b>${tier.name}</b>`,0);
    /* On the burst, not before it: the shower is made of what was inside, so it has to land on
       the frame the box actually goes. */
    confetti();
    const coins=Boxes.coinsIn(res), energy=Boxes.energyIn(res);
    if(coins) coinShower(coins>=(cfg.boxCoins||60)*3);
    if(energy) energyShower();
    await Board3D.revealDrops(res.drops,(d)=>{
      packHud(dropNote(d),0);
      renderHUD();
      /* The card is already banked, so the case board inside the ring shows it as it turns
         over — not on the next roll, which is what happened when renderAll() was the only
         thing that synced it. */
      renderCaseBoard();
    });
    const n=Boxes.newCardsIn(res);
    if(n) packHud(`<b>${packTitle(res)}</b>`,0), await sleep(Math.max(0,cfg.packCloseMs||0));
  }finally{
    packHudHide();
    Board3D.endPack();
    renderAll();
  }
}

/* The caption under the box, and the countdown. `ms` > 0 runs the bar; 0 clears it. */
function packHud(html,ms){
  const el=$("#packHud"); if(!el) return;
  $("#packHudText").innerHTML=html;
  el.classList.add("show");
  const fill=$("#packHudFill");
  if(!fill) return;
  fill.style.transition="none";
  fill.style.width="0%";
  if(ms>0){
    /* Next paint, or the transition is set and the width changed in the same style recalc and
       the bar simply jumps to full. */
    nextPaint(()=>{
      fill.style.transition=`width ${ms}ms linear`;
      fill.style.width="100%";
    });
  }
  el.classList.toggle("counting",ms>0);
}
function packHudHide(){
  const el=$("#packHud"); if(!el) return;
  el.classList.remove("show","counting");
  const fill=$("#packHudFill");
  if(fill){ fill.style.transition="none"; fill.style.width="0%"; }
}

function showPackModal(res){
  return new Promise(resolve=>{
    const host=$("#sheetHost");
    const tier=res.tier;
    const openMs=Math.max(0,cfg.packAutoOpenMs||0);
    let done=false, timers=[], iv=null;
    const later=(fn,ms)=>{ timers.push(setTimeout(fn,ms)); };
    const finish=()=>{
      if(done) return; done=true;
      timers.forEach(clearTimeout); if(iv) clearInterval(iv);
      host.classList.remove("show"); host.innerHTML=""; host.onclick=null;
      resolve();
    };

    /* ---- phase 1: the closed box ---- */
    host.innerHTML=`<div class="modal packModal tier-${tier.key}">
        <div class="top"><div class="eyebrow">${tier.name}</div>
          <h2>${tier.items>1?`${tier.items} cards inside`:"One card inside"}</h2></div>
        <div class="mbody">
          <button class="packBox" id="packBox" title="Open it">
            <img class="packImg" src="${tier.art}" alt="">
            <span class="packGlow"></span>
          </button>
          <div class="packHint">Tap to open · opens itself in <b id="packCd">${Math.ceil(openMs/1000)}</b>s</div>
          <div class="packBar"><div class="packFill" id="packFill"></div></div>
        </div></div>`;
    host.classList.add("show");
    /* The bar is the countdown made visible — the number alone reads as a warning, the bar
       reads as an offer. Started on the next frame so the transition actually runs. */
    const fill=$("#packFill");
    fill.style.transition=`width ${openMs}ms linear`;
    nextPaint(()=>{ fill.style.width="100%"; });
    const cd=$("#packCd"), t0=performance.now();
    iv=setInterval(()=>{
      if(!cd||!cd.isConnected) return clearInterval(iv);
      cd.textContent=Math.max(0,Math.ceil((openMs-(performance.now()-t0))/1000));
    },200);

    let opened=false;
    const open=()=>{
      if(opened||done) return; opened=true;
      clearInterval(iv); iv=null;
      /* A tap cancels the auto-open timer rather than racing it — otherwise the box would
         "open" a second time under the cards already on screen. */
      timers.forEach(clearTimeout); timers=[];
      reveal();
    };
    $("#packBox").onclick=open;
    later(open,openMs);

    /* ---- phase 2: what was inside, one at a time ---- */
    function reveal(){
      const flip=Math.max(0,cfg.packFlipMs||0);
      const hold=Math.max(0,cfg.packRevealMs||0);
      const gap=Math.max(0,cfg.packItemGapMs||0);
      const dupMs=Math.max(0,cfg.packDupMs||0);
      const size=res.drops.length>2?"sm":res.drops.length>1?"md":"lg";

      host.innerHTML=`<div class="modal packModal open tier-${tier.key}">
          <div class="top"><div class="eyebrow">${tier.name}</div><h2 id="packTitle">Opening…</h2></div>
          <div class="mbody">
            <div class="packRow" id="packRow">${
              res.drops.map((_,k)=>`<div class="packSlot" data-k="${k}"></div>`).join("")}</div>
            <div class="packNote" id="packNote"></div>
            <button class="btn teal wide" id="packBtn" style="margin-top:14px;visibility:hidden">Collect</button>
          </div></div>`;
      confetti();
      /* The shower is made of what came out — coins for coins, dice for energy — so the burst
         itself already says something before the first card has turned over. */
      const coins=Boxes.coinsIn(res), energy=Boxes.energyIn(res);
      if(coins) coinShower(coins>=(cfg.boxCoins||60)*3);
      if(energy) energyShower();

      let t=0;
      res.drops.forEach((d,k)=>{
        const extra=(d.kind==="card"&&!d.isNew)?dupMs:0;
        later(()=>{
          const slot=host.querySelector(`.packSlot[data-k="${k}"]`);
          if(slot){ slot.innerHTML=dropFace(d,{size,flip:true}); }
          const note=$("#packNote");
          if(note) note.innerHTML=dropNote(d);
          renderHUD();
          /* And the board behind it. The card is already banked, so the case board inside the
             ring should show it the moment it is turned over here — not on the next roll, which
             is what happened while renderAll() was the only thing that synced it. */
          renderCaseBoard();
        },t+flip);
        t+=flip+hold+gap+extra;
      });
      later(()=>{
        const title=$("#packTitle");
        if(title) title.textContent=packTitle(res);
        const btn=$("#packBtn");
        if(btn){ btn.style.visibility="visible"; btn.onclick=finish; }
      },t);
      /* And it closes itself, because a popup that only a click can dismiss stalls an idle
         session — the same promise auto-roll is waiting on. */
      later(finish,t+Math.max(0,cfg.packCloseMs||0)+Math.max(0,cfg.collectMaxSec||10)*1000);
      host.onclick=(e)=>{ if(e.target===host) finish(); };
    }
  });
}

/* The line under the row — what the card that just turned over actually is. */
function dropNote(d){
  if(d.kind==="card"&&d.card){
    /* The three card beats, in the order they matter (GDD 4.3). The converting copy is the
       payoff and says what it earned; a plain duplicate says what it consoled. */
    if(d.converted) return `<b>${d.card.name}</b> — <b>collected!</b> +${d.status} status`;
    if(!d.isNew) return `<span class="dupNote">${d.card.name} ×${d.count} — <b>+${fmt(d.coins)}</b>🪙</span>`;
    const set=Cards.setForCard(d.card.id);
    return `<b>${d.card.name}</b> — ${set?set.name:""}`;
  }
  if(d.kind==="clue") return d.isNew
    ? `<b>A clue</b> on ${Episodes.titleOf(d.ep)}`
    : `<span class="dupNote">You knew that one — <b>+${fmt(d.coins)}</b>🪙</span>`;
  if(d.kind==="status") return `<b>${d.item.name}</b> — <b>+${d.item.points}</b> status`;
  if(d.kind==="coins") return `<b>+${fmt(d.amount)}</b> coins`;
  if(d.kind==="energy") return `<b>+${d.amount}</b> energy`;
  return "";
}
/* The headline once every card is face up. A card that CONVERTED outranks one that is merely
   new: three copies is the thing the player is actually collecting toward. */
function packTitle(res){
  const c=Boxes.convertedIn(res);
  if(c) return c===1?"1 card collected":`${c} cards collected`;
  const n=Boxes.newCardsIn(res);
  if(!n) return "Nothing new this time";
  return n===1?"1 new card":`${n} new cards`;
}
