"use strict";
/* The album — one page per episode, and the empty slots are the point.

   A collection you cannot see the shape of is not a collection, so a page shows all
   cfg.collectiblesPerEpisode slots whether you hold them or not: owned cards in full, missing
   ones silhouetted but NAMED, because "Simon, Gold" is a different thing to chase than "Simon,
   Silver" and the player has to be able to tell which one is still out there.

   Paged rather than one long grid. The board is five episodes and each one is a set of five —
   that structure is the progression, and a flat grid of twenty-five throws it away. The page
   you land on is the first UNFINISHED one, so opening the album answers "what am I working on"
   without a tap.

   Past boards are still here. Albums are kept forever (js/collection.js), so the board strip
   at the top walks back through every finished set — the collection is a history, not a
   scoreboard that resets.

   Nothing here writes state. The album is a view of the albums and the requirements, so opening
   it can never change a run. The one exception is the Watch button, which is a route into the
   prediction flow rather than a change of its own. */

/* Which board and page are on screen. Deliberately NOT persisted: it is where you are looking,
   not where you are. Reset to the current board and its first unfinished page on each open. */
let albumBoard=null, albumPage=0;

function openAlbum(){
  albumBoard=Collection.num();
  const pages=Collection.pages(albumBoard);
  albumPage=Math.max(0,pages.findIndex(p=>!Collection.pageReady(p,albumBoard)));
  if(albumPage<0) albumPage=0;
  renderAlbum();
}

function renderAlbum(){
  const host=$("#sheetHost");
  const n=albumBoard, board=Collection.boardFor(n);
  const pages=Collection.pages(n);
  const pool=Collection.poolSize(n), got=Collection.collected(n);
  const pct=pool?Math.round(got/pool*100):0;
  const [eps,epTotal]=Collection.boardProgress(n);

  /* The board strip: every board that has been started, current one last. One button when
     there is only one, which is the normal case early on. */
  const boards=[];
  for(let b=1;b<=Collection.num();b++) boards.push(b);
  const strip=boards.length>1
    ? `<div class="albBoards">${boards.map(b=>{
         const done=Collection.boardComplete(b);
         return `<button class="albBoard${b===n?" sel":""}${done?" done":""}" data-b="${b}">
             ${done?"✓":""} Set ${b}</button>`;
       }).join("")}</div>`
    : "";

  const page=pages[albumPage];
  const body=page?albumPageHtml(page,n):
    `<div class="hint" style="margin:20px 0;text-align:center">This set has no episodes —
       the library has run out. That is the end of the story, for now.</div>`;

  host.innerHTML=`<div class="modal albumModal"><div class="top">
      <button class="sheetX" id="albumX" title="Close">✕</button>
      <div class="eyebrow">Set ${n} · ${board.name}</div><h2>${got} of ${pool} cards</h2></div>
    <div class="mbody">
      ${strip}
      <div class="albumBar"><div class="albumFill" style="width:${pct}%"></div></div>
      <div class="hint" style="margin:6px 0 10px">
        <b style="color:var(--pink)">${eps}</b>/${epTotal} episodes unlocked ·
        ${Clues.total()?`<b style="color:var(--teal)">${fmt(Clues.total())}</b> clues filed`
                     :`clue cards lift your next prediction`}</div>
      ${body}
      <div class="albNav">
        <button class="btn ghost albArrow" id="albPrev" ${albumPage<=0?"disabled":""}>‹</button>
        <div class="albDots">${pages.map((p,i)=>{
          const ready=Collection.pageReady(p,n);
          return `<button class="albDot${i===albumPage?" sel":""}${ready?" done":""}"
             data-p="${i}" title="Episode ${p.ep}"></button>`;
        }).join("")}</div>
        <button class="btn ghost albArrow" id="albNext" ${albumPage>=pages.length-1?"disabled":""}>›</button>
      </div>
      <button class="btn ghost wide" id="albumClose" style="margin-top:10px">Close</button>
    </div></div>`;
  host.classList.add("show");

  const close=()=>{ host.classList.remove("show"); host.innerHTML=""; host.onclick=null; renderAll(); };
  $("#albumClose").onclick=close;
  $("#albumX").onclick=close;
  host.onclick=(e)=>{ if(e.target===host) close(); };

  const go=(i)=>{ albumPage=Math.max(0,Math.min(pages.length-1,i)); renderAlbum(); };
  $("#albPrev").onclick=()=>go(albumPage-1);
  $("#albNext").onclick=()=>go(albumPage+1);
  host.querySelectorAll(".albDot").forEach(b=>b.onclick=()=>go(+b.dataset.p));
  host.querySelectorAll(".albBoard").forEach(b=>b.onclick=()=>{
    albumBoard=+b.dataset.b; albumPage=0; renderAlbum();
  });
  const watch=$("#albWatch");
  if(watch) watch.onclick=()=>{ close(); openPrediction(page.ep); };
}

/* One page: the episode it unlocks, and its slots. */
function albumPageHtml(page,n){
  const [got,need]=Collection.pageProgress(page,n);
  const ready=Collection.pageReady(page,n);
  const ep=Episodes.get(page.ep);
  const unwatched=state.epQueue.includes(page.ep);
  const slots=page.needs.map(id=>{
    const card=Collection.cardOf(id,n);
    const owned=Collection.has(id,n);
    return `<div class="albSlot">${cardFace(card,{owned,count:Collection.countOf(id,n),size:"sm"})}</div>`;
  }).join("");
  /* The page's own status line does the work the dots cannot: what this set of five BUYS, and —
     when the cards are all in but the story is not ready for it — which episode comes first.
     The drama is serialised, so a complete page is not automatically a watchable one. */
  const blocked=ready&&unwatched&&!Collection.canWatch(page.ep)?Collection.blockedBy():null;
  const foot=!ready
    ? `<div class="albNeed">${need-got} more to unlock <b>“${ep?ep.title:page.ep}”</b></div>`
    : blocked
    ? `<div class="albNeed">🔒 Collected — but
         <b>“${Episodes.titleOf(blocked)}”</b> has to be watched first</div>`
    : unwatched
    ? `<button class="btn pink wide" id="albWatch">▶ Predict &amp; watch “${ep?ep.title:page.ep}”</button>`
    : `<div class="albDone">✓ Unlocked and watched</div>`;
  return `<div class="albPage${ready?" ready":""}">
      <div class="albHead">
        <span class="albEp">Episode ${page.ep}</span>
        <span class="albTitle">${ep?ep.title:"—"}</span>
        <span class="albCount${ready?" done":""}">${got}/${need}${ready?" ✓":""}</span>
      </div>
      <div class="albGrid">${slots}</div>
      <div class="albFoot">${foot}</div>
    </div>`;
}
