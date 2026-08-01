"use strict";
/* The clue album screen — every clue in the collection, owned ones revealed.

   Reads Clues (js/clues.js), which derives ownership from state.clues. Nothing here writes
   state: the album is a view of a number that already exists, so opening it can never change
   the run.

   Sets are collapsed to a strip of cards rather than one flat 300-slot grid: a flat grid is
   unreadable at album size and gives no sense of progress, where "3 of 5 in The Family" does.
   Unowned slots are shown as silhouettes rather than hidden, because a collection you cannot
   see the shape of is not a collection.

   It mounts in #sheetHost, INSIDE the board scene — not in the page-level #scrim, which is
   position:fixed and would dim the whole browser window. The album is part of the game, so it
   is bounded by the game's window. */

function openAlbum(){
  const total=Clues.total(), got=Clues.collected();
  const pct=total?Math.round(got/total*100):0;
  const sets=Clues.sets().map(s=>{
    const [n,size]=Clues.setProgress(s);
    const meta=Clues.setMeta(s);
    const done=Clues.setComplete(s);
    const from=s*Clues.setSize();
    const slots=Array.from({length:size},(_,k)=>{
      const i=from+k, owned=Clues.has(i);
      return `<div class="clue${owned?" got":""}" title="${owned?Clues.nameOf(i).replace(/"/g,"&quot;"):"Not collected"}">
          <span class="clueIco">${owned?"🔍":"·"}</span>
          <span class="clueName">${owned?Clues.nameOf(i):"—"}</span>
        </div>`;
    }).join("");
    return `<div class="clueSet${done?" done":""}">
        <div class="clueSetHead"><span>${meta.icon} ${meta.name}</span>
          <span class="clueSetCount">${n}/${size}${done?" ✓":""}</span></div>
        <div class="clueGrid">${slots}</div>
      </div>`;
  }).join("");

  const host=$("#sheetHost");
  host.innerHTML=`<div class="modal albumModal"><div class="top">
      <button class="sheetX" id="albumX" title="Close">✕</button>
      <div class="eyebrow">Clue album</div><h2>${got} of ${total}</h2></div>
    <div class="mbody">
      <div class="albumBar"><div class="albumFill" style="width:${pct}%"></div></div>
      <div class="hint" style="margin:6px 0 10px">${
        got?`Every Mystery Box has a <b>1 in 3</b> chance of two clues. Clues also raise your next prediction's accuracy before they are spent.`
           :`Clues come from Mystery Boxes — one lands on the board with every builder upgrade.`}</div>
      <div class="albumScroll">${sets}</div>
      <button class="btn ghost wide" id="albumClose" style="margin-top:12px">Close</button>
    </div></div>`;
  host.classList.add("show");
  const close=()=>{ host.classList.remove("show"); host.innerHTML=""; host.onclick=null; renderAll(); };
  $("#albumClose").onclick=close;
  $("#albumX").onclick=close;
  /* Tapping the dimmed board outside the card closes it, the way a sheet should. */
  host.onclick=(e)=>{ if(e.target===host) close(); };
}
