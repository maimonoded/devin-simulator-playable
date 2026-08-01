"use strict";
/* The player panel — opened from the avatar in the HUD.

   For now it holds one thing: the progress reset. It is here as well as in the tuning drawer
   because the drawer is a developer surface and is hidden entirely in ?view=mobile, where the
   avatar is the only route to it.

   Reset is deliberately two-tap. It wipes a run with no undo, and a single tap on a control
   that sits permanently in the HUD is too easy to hit by accident.

   Mounted in #sheetHost so it is bounded by the game window, like the album and the clue
   popup, rather than dimming the whole browser the way the page-level .scrim does. */

function openProfile(){
  const host=$("#sheetHost");
  const acc=(()=>{ const t=state.predWins+state.predLoss; return t?Math.round(state.predWins/t*100)+"%":"—"; })();
  host.innerHTML=`<div class="modal profileModal"><div class="top">
      <button class="sheetX" id="profileX" title="Close">✕</button>
      <div class="eyebrow">Player</div><h2>Day ${state.day}</h2></div>
    <div class="mbody">
      <div class="profileGrid">
        <div class="pstat"><div class="v">${fmt(state.coins)}</div><div class="l">Coins</div></div>
        <div class="pstat"><div class="v">${state.rolls}</div><div class="l">Rolls</div></div>
        <div class="pstat"><div class="v">${state.epsWatched}</div><div class="l">Episodes watched</div></div>
        <div class="pstat"><div class="v">${acc}</div><div class="l">Prediction accuracy</div></div>
        <div class="pstat"><div class="v">${Builders.doneCount()}/${Builders.count()}</div><div class="l">Builders done</div></div>
        <div class="pstat"><div class="v">${Clues.collected()}/${Clues.total()}</div><div class="l">Clues</div></div>
      </div>
      <button class="btn ghost wide danger" id="resetPlayer" style="margin-top:14px">🗑 Reset player progress</button>
      <div class="hint" id="resetHint" style="margin-top:8px">Wipes this run and reloads. Tuning values are kept.</div>
    </div></div>`;
  host.classList.add("show");

  const close=()=>{ host.classList.remove("show"); host.innerHTML=""; host.onclick=null; renderAll(); };
  $("#profileX").onclick=close;
  host.onclick=(e)=>{ if(e.target===host) close(); };

  /* Two taps, and the arming lapses — an armed destructive button left sitting there is a trap
     for whoever comes back to the tab later. */
  const btn=$("#resetPlayer"), hint=$("#resetHint");
  let armed=false, t=null;
  btn.onclick=()=>{
    if(!armed){
      armed=true;
      btn.textContent="⚠ Tap again to wipe this run";
      btn.classList.add("armed");
      hint.textContent="This cannot be undone.";
      t=setTimeout(()=>{
        armed=false; btn.textContent="🗑 Reset player progress"; btn.classList.remove("armed");
        hint.textContent="Wipes this run and reloads. Tuning values are kept.";
      },6000);
      return;
    }
    clearTimeout(t);
    resetPlayerAndReload();
  };
}

/* Clear the saved run and reload into a fresh one.
   The reload is what makes this safe rather than clever: every module re-boots from an empty
   slot, so there is no half-reset state to get wrong — no scene to rebuild, no queue to drain,
   no camera left pointing at a token that no longer exists.
   suppressUnloadSave() is essential: without it the beforeunload handler saves the still-live
   in-memory run on the way out and the wipe silently undoes itself. */
function resetPlayerAndReload(){
  clearState();
  suppressUnloadSave();
  location.reload();
}
