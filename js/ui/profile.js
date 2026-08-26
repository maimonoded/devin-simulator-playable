"use strict";
/* The profile — the player's standing, and the shelf that proves it.

   Opened from the avatar in the HUD. Two jobs:

     1. THE STATUS TRACK. A rank, the points behind it, and how far the next one is. The points
        come from three places at once (js/status.js) and the breakdown is shown, because "why
        did that go up" is the question a bare number always provokes.

     2. THE ROOM. Ten things to own, grouped by where they will hang. Owned ones are lit;
        missing ones are silhouetted with BOTH ways to get them — the coin price, and the play
        milestone that hands it over free. Every item has both, deliberately, so the shelf is
        never gated behind spending.

   The grouping is by `zone` — wall, shelf, desk, closet — which is the shape the room will
   take when this becomes a picture of a room rather than a grid of it. Authoring for that
   costs nothing today; the zones are already in the content.

   Buying is the only thing here that writes state, and it goes through Status.buy() so the
   affordability rule lives in one place. The progress reset is here as well as in the tuning
   drawer because the drawer is a developer surface and is hidden in ?view=mobile, where the
   avatar is the only route to it. */

function openProfile(){ renderProfile(); }

function renderProfile(){
  const host=$("#sheetHost");
  const pts=Status.points(), rank=Status.rank(pts), next=Status.nextRank(pts);
  const lv=Status.level(pts), maxLv=Status.maxLevel();
  const pct=Math.round(Status.levelProgress(pts)*100);
  const acc=(()=>{ const t=state.predWins+state.predLoss; return t?Math.round(state.predWins/t*100)+"%":"—"; })();
  const [eps,epTotal]=Collection.boardProgress();

  const zones=Status.zones().map(z=>{
    const items=Status.itemsInZone(z.key);
    if(!items.length) return "";
    return `<div class="stZone">
        <div class="stZoneHead">${z.icon} ${z.name}
          <span class="stZoneCount">${items.filter(i=>Status.owns(i.id)).length}/${items.length}</span></div>
        <div class="stGrid">${items.map(statusItemHtml).join("")}</div>
      </div>`;
  }).join("");

  host.innerHTML=`<div class="modal profileModal"><div class="top">
      <button class="sheetX" id="profileX" title="Close">✕</button>
      <div class="eyebrow">Your profile · level ${lv} of ${maxLv}</div>
      <h2>${rank.icon} ${rank.name}</h2></div>
    <div class="mbody">
      <div class="rankBox">
        <div class="rankLine"><b>${fmt(pts)}</b> status this Season
          ${lv<maxLv?`<span class="rankNext">${fmt(Status.toNextLevel(pts))} to level ${lv+1}${
                next?` · ${next.icon} ${next.name} at ${next.from}`:""}</span>`
                :`<span class="rankNext">Season complete</span>`}</div>
        <div class="albumBar"><div class="albumFill" style="width:${pct}%"></div></div>
        <div class="rankWhy">
          <span>🏆 ${fmt(Status.itemPoints())} owned</span>
          <span>🎬 ${state.epsWatched} watched</span>
          <span>🃏 ${Status.cardsCollected()} cards</span>
          <span>📚 ${state.boardsDone} sets</span>
        </div>
      </div>

      <div class="profileGrid">
        <div class="pstat"><div class="v">${fmt(state.coins)}</div><div class="l">Coins</div></div>
        <div class="pstat"><div class="v">${state.rolls}</div><div class="l">Rolls</div></div>
        <div class="pstat"><div class="v">${state.epsWatched}</div><div class="l">Episodes watched</div></div>
        <div class="pstat"><div class="v">${acc}</div><div class="l">Prediction accuracy</div></div>
        <div class="pstat"><div class="v">${eps}/${epTotal}</div><div class="l">This set unlocked</div></div>
        <div class="pstat"><div class="v">${Status.ownedCount()}/${Status.items().length}</div><div class="l">Status items</div></div>
      </div>

      <div class="stRoom">${zones}</div>

      <button class="btn ghost wide danger" id="resetPlayer" style="margin-top:14px">🗑 Reset player progress</button>
      <div class="hint" id="resetHint" style="margin-top:8px">Wipes this run and reloads. Tuning values are kept.</div>
    </div></div>`;
  host.classList.add("show");

  const close=()=>{ host.classList.remove("show"); host.innerHTML=""; host.onclick=null; renderAll(); };
  $("#profileX").onclick=close;
  host.onclick=(e)=>{ if(e.target===host) close(); };

  host.querySelectorAll("button[data-buy]").forEach(b=>b.onclick=()=>{
    const r=Status.buy(b.dataset.buy);
    if(!r) return;
    toast(`⭐ <b>${r.item.name}</b> — +${r.item.points} status`);
    log("🛍",`Bought <b>${r.item.name}</b> · −${fmt(r.cost)} coins · +${r.item.points} status`);
    renderProfile();          // re-render: the rank, the coins and the shelf all just moved
    renderAll();
  });

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

/* One item on the shelf. Owned: lit, with how it was got. Missing: silhouetted, with the price
   AND the milestone — the two routes are the design, so both are always on screen. */
function statusItemHtml(item){
  const owned=Status.owns(item.id);
  const price=Status.priceOf(item);
  const can=Status.canBuy(item);
  const earn=Status.earnProgress(item);
  const earnLbl={episodes:"episodes watched",cards:"cards collected",
                 boards:"sets finished",rolls:"rolls"}[earn?earn.key:""]||"";
  const how={bought:"Bought",earned:"Earned",found:"Found in a box"}[Status.howGot(item.id)]||"Owned";
  return `<div class="stItem${owned?" got":""}">
      <div class="stArt" style="${cardArtCss(item.art)}"></div>
      <div class="stName">${item.name}</div>
      <div class="stPts">⭐ ${item.points}</div>
      ${owned
        ? `<div class="stHow">✓ ${how}</div>`
        : `<div class="stWays">
             <button class="stBuy${can?"":" cant"}" data-buy="${item.id}" ${can?"":"disabled"}>
               🪙 ${fmtShort(price)}</button>
             <div class="stEarn">${earn
               ? `or ${earn.have}/${earn.need} ${earnLbl}`
               : "or find it in a box"}</div>
           </div>`}
      <div class="stBlurb">${item.blurb||""}</div>
    </div>`;
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
