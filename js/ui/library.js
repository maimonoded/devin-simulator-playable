"use strict";
/* The library — every series, season and episode, what you own and what the next one costs.

   It is a STREAMING APP'S SHELF, not a list of prices: a billboard for the series you are in,
   then one horizontally-scrolling rail per season of poster cards. That shape is the point. A
   price list makes the content look like a checkout; a shelf makes it look like something worth
   paying for, which is the whole reason the coins exist.

   FULL SCREEN, deliberately. It mounts into #sheetHost like the other panels, but wears
   .libMode so the host stops centring a narrow modal and lets the page fill the board window
   instead. In ?view=mobile that window IS the screen, so the library is the phone screen —
   which is how a streaming app looks and how this one has to.

   Three things it shows and nothing else decides:
     - what you HOLD          Items.all()
     - what is PAYABLE        Unlock.current() — exactly one thing, because the drama is
                              serialised and the spine is one ordered line (js/unlock.js)
     - what is PLAYABLE       Unlock.isUnlocked("episode", id)
   Paying happens in js/ui/unlock-panel.js and playing in js/ui/player.js. This file owns the
   shelf and hands off; it never touches coins, items or state.paid. */

/* Cards are art first. A missing file is not an error — the posters are generated assets and a
   new episode will not have one the day it is written — so an <img> that fails to load just
   uncovers the lettered plate underneath it. Same contract as a tile with no model: absent art
   changes nothing but the picture. See assets/library/README.md. */
function libArt(kind,id,cls){
  const src=Catalog.artFor(kind,id);
  return `<img class="${cls}" src="${src}" alt="" loading="lazy" decoding="async"
               onerror="this.classList.add('missing')">`;
}

/* ---------- state of one spine target ----------
   "open"   already paid for
   "next"   IS Unlock.current() — the one thing on the whole page that can be paid
   "locked" everything else: reachable later, but not yet */
function libState(kind,id){
  if(Unlock.isUnlocked(kind,id)) return "open";
  const cur=Unlock.current();
  return (cur&&cur.key===Catalog.key(kind,id))?"next":"locked";
}

/* ---------- price, as chips ----------
   A cost the player can cover reads as met; one they are short of reads held/needed, which is
   the only number that tells them what to go and look for. */
function libCostChips(step){
  if(!step) return "";
  const out=[];
  if(step.coins){
    const met=state.coins>=step.coins;
    out.push(`<span class="libChip${met?" met":""}">🪙 ${fmtShort(step.coins)}</span>`);
  }
  Object.entries(step.items||{}).forEach(([itemId,need])=>{
    const def=Catalog.getItem(itemId), held=Items.count(itemId);
    out.push(`<span class="libChip${held>=need?" met":""}" title="${def?def.name:itemId}">`+
             `${def?def.icon:"❓"} ${Math.min(held,need)}/${need}</span>`);
  });
  return out.join("");
}

/* Everything a target still owes, summed across the steps it has not paid.

   The card shows this rather than just the next step, because the question a locked card has to
   answer is "what will it take to get there", and on a three-step episode the next step alone
   understates that by two thirds. The PANEL still works a step at a time — that is the thing you
   are actually paying — so the card says the total and labels it as one. */
function libTotalCost(kind,id){
  const out={coins:0,items:{}};
  Unlock.price(kind,id).slice(Unlock.stepsPaid(kind,id)).forEach(step=>{
    out.coins+=step.coins||0;
    Object.entries(step.items||{}).forEach(([it,n])=>{ out.items[it]=(out.items[it]||0)+n; });
  });
  return out;
}

/* Where a target is in its own price: "Step 2 of 3", or nothing when it is a single payment. */
function libStepNote(kind,id){
  const total=Unlock.stepCount(kind,id);
  if(total<=1) return "";
  return `Step ${Math.min(Unlock.stepsPaid(kind,id)+1,total)} of ${total}`;
}

/* The same total in words, for a tooltip — a chip row is unreadable as hover text. */
function libCostWords(kind,id){
  const t=libTotalCost(kind,id), bits=[];
  if(t.coins) bits.push(`${fmt(t.coins)} coins`);
  Object.entries(t.items).forEach(([it,n])=>{
    const d=Catalog.getItem(it);
    bits.push(`${n} × ${d?d.name:it} (have ${Items.count(it)})`);
  });
  return bits.length?`needs ${bits.join(", ")}`:"free";
}

/* ---------- the bag ----------
   The only place an inventory is visible, so it is not a footnote. Items the player has none of
   are still listed for the series being played: "you need three of these and have none" is the
   thing worth knowing, and an empty bag that shows nothing teaches nobody what to collect. */
function libBag(){
  const cur=Unlock.current();
  const series=cur?Catalog.series().find(s=>Catalog.key("series",s.id)===(cur.kind==="series"?cur.key:Catalog.ancestorsOf(cur.kind,cur.id)[0]?.key)):null;
  const defs=series?Catalog.itemsOf(series.id):[];
  const held=Items.all();
  const rows=(defs.length?defs:held.map(h=>h.item)).map(def=>{
    const n=Items.count(def.id);
    return `<span class="libItem${n?"":" none"}" title="${def.name}">${def.icon}<b>${n}</b></span>`;
  });
  return rows.length?`<div class="libBag">${rows.join("")}</div>`:"";
}

/* ---------- the billboard ----------
   The series you are in, at full width, with the one payable thing on top of it. */
function libHero(series){
  const cur=Unlock.current();
  const inThis=cur&&(cur.kind==="series"?cur.id===series.id
                    :Catalog.ancestorsOf(cur.kind,cur.id)[0]?.id===series.id);
  const step=inThis?Unlock.nextStep(cur.kind,cur.id):null;
  const def=inThis?(cur.kind==="episode"?Catalog.getEpisode(cur.id)
                   :cur.kind==="season"?Catalog.getSeason(cur.id):series):null;
  const cta=inThis&&def
    ? `<div class="libCta" data-kind="${cur.kind}" data-id="${cur.id}">
         <div class="libCtaHead">Next to unlock · <b>${def.title}</b></div>
         <div class="libCtaRow">${libCostChips(step)}
           <button class="libCtaBtn">${Unlock.canPay(cur.kind,cur.id)?"Unlock":"See what it needs"}</button></div>
         ${libStepNote(cur.kind,cur.id)?`<div class="libCtaNote">${libStepNote(cur.kind,cur.id)}</div>`:""}
       </div>`
    : `<div class="libCtaNote">Everything here is unlocked.</div>`;
  const p=Unlock.progress();
  return `<section class="libHero">
      ${libArt("series",series.id,"libHeroArt")}
      <div class="libHeroShade"></div>
      <div class="libHeroIn">
        <div class="libKicker">Series ${series.id} · ${p.episodes}/${p.total} episodes</div>
        <h1 class="libHeroTitle">${series.title}</h1>
        <p class="libHeroBlurb">${series.blurb}</p>
        ${cta}
      </div>
    </section>`;
}

/* ---------- one episode card ---------- */
function libCard(ep,n){
  const st=libState("episode",ep.id);
  const watched=state.watched.includes(ep.id);
  const badge=st==="open"?(watched?`<span class="libBadge seen">✓ Watched</span>`:`<span class="libBadge play">▶</span>`)
            : st==="next"?`<span class="libBadge next">Unlock</span>`
            : `<span class="libBadge lock">🔒</span>`;
  /* Price on EVERY locked card, not only the payable one: you cannot save toward something you
     cannot see the price of, and the props are collected long before the episode that wants
     them. An unlocked card shows nothing — it is paid for, and a price on it is noise. */
  const steps=Unlock.stepCount("episode",ep.id)-Unlock.stepsPaid("episode",ep.id);
  const foot=st==="open"?""
    : `<div class="libCardCost">${libCostChips(libTotalCost("episode",ep.id))}`+
      (steps>1?`<span class="libSteps">over ${steps} steps</span>`:"")+`</div>`;
  return `<button class="libCard is-${st}" data-kind="episode" data-id="${ep.id}"
                  title="${ep.blurb||ep.title}${st==="open"?"":" — "+libCostWords("episode",ep.id)}">
      <span class="libCardArt">${libArt("episode",ep.id,"libPoster")}
        <span class="libPlate">${n}</span>${badge}</span>
      <span class="libCardName"><b>${n}.</b> ${ep.title}</span>
      ${foot}
    </button>`;
}

/* ---------- one season rail ---------- */
function libRail(season,idx){
  const st=libState("season",season.id);
  const eps=Catalog.episodesOf(season.id);
  /* A season nobody has opened still shows its episodes — you cannot want what you cannot see.
     The cards carry their own lock state, so the rail does not need to hide anything. */
  /* A locked season prices itself too, on the same total basis as the cards. "Opens after the
     one before it" says when; it does not say what it will cost when it does. */
  const seasonCost=Unlock.stepCount("season",season.id)?libCostChips(libTotalCost("season",season.id)):"";
  const note=st==="open"?""
    : `<span class="libRailNote${st==="next"?" next":""}">${st==="next"?"":"🔒 "}${
        seasonCost||"opens after the season before it"}</span>`;
  const head=`<div class="libRailHead">
      <h2>${season.title}</h2>${note}
    </div>`;
  const cards=eps.map((ep,i)=>libCard(ep,idx*eps.length+i+1)).join("");
  return `<section class="libRail is-${st}"${st==="next"?` data-kind="season" data-id="${season.id}"`:""}>
      ${head}<div class="libRow">${cards}</div>
      ${season.blurb?`<p class="libRailBlurb">${season.blurb}</p>`:""}
    </section>`;
}

/* ---------- a series with no content ----------
   Shown rather than hidden: an empty shelf at the bottom of the page is what tells the player
   the story goes on past what they can reach. It is never payable — there is nothing behind it
   yet — so it renders as a plate, not as a price. */
function libComingSoon(series){
  return `<section class="libSoon">
      ${libArt("series",series.id,"libSoonArt")}
      <div class="libSoonShade"></div>
      <div class="libSoonIn">
        <div class="libKicker">Series ${series.id}</div>
        <h2>${series.title}</h2>
        <p>${series.blurb}</p>
      </div>
    </section>`;
}

function libShelf(){
  const all=Catalog.series();
  const withContent=all.filter(s=>Catalog.seasonsOf(s.id).length);
  const empty=all.filter(s=>!Catalog.seasonsOf(s.id).length);
  const hero=withContent[0];
  const rails=hero?Catalog.seasonsOf(hero.id).map(libRail).join(""):"";
  return `<header class="libTop">
        <button class="libX" id="libX" title="Back to the board">✕</button>
        <div class="libTopTitle">Library</div>
        ${libBag()}
      </header>
      <div class="libScroll" id="libScroll">
        ${hero?libHero(hero):`<p class="libEmpty">No series have been written yet.</p>`}
        ${rails}
        ${empty.map(libComingSoon).join("")}
      </div>`;
}

/* ---------- the title page ----------
   Netflix does not price a thing in a modal over the shelf; it takes you TO the thing, and gives
   you a back button. So does this. Tapping a locked card routes the library to that target's own
   page — same full-screen frame, same file, one route variable — rather than dropping a centred
   dialog on top of a full-bleed page, which is what a modal always looks like here.

   It handles all three kinds, because all three are spine targets with the same shape of price.
   There is no second unlock surface: this IS the unlock surface. */
function libWhere(kind,id){
  if(kind==="series") return "Series "+id;
  if(kind==="season"){
    const se=Catalog.getSeason(id), all=Catalog.seasonsOf(se.series);
    return `Series ${se.series} · Season ${all.findIndex(x=>x.id===id)+1} of ${all.length}`;
  }
  const se=Catalog.seasonOfEpisode(id);
  const eps=se?Catalog.episodesOf(se.id):[];
  return se?`${se.title} · Episode ${eps.findIndex(e=>e.id===id)+1} of ${eps.length}`:"Episode";
}

/* Every step, with the ones already paid struck through. The bar says how far; this says what
   is actually being asked for, which a bar cannot. */
function libStepList(kind,id){
  const price=Unlock.price(kind,id), paid=Unlock.stepsPaid(kind,id);
  if(price.length<2) return "";
  return `<div class="libStepList">`+price.map((step,i)=>
    `<div class="libStepRow${i<paid?" done":i===paid?" now":""}">
       <span class="libStepNo">${i<paid?"✓":i+1}</span>
       <span class="libStepChips">${libCostChips(step)}</span>
     </div>`).join("")+`</div>`;
}

function libDetail(kind,id){
  const def=kind==="series"?Catalog.getSeries(id)
           :kind==="season"?Catalog.getSeason(id):Catalog.getEpisode(id);
  if(!def) return `<p class="libEmpty">Nothing here.</p>`;
  const st=libState(kind,id);
  const total=Unlock.stepCount(kind,id), paid=Unlock.stepsPaid(kind,id);
  const step=Unlock.nextStep(kind,id);
  const artKind=kind==="episode"?"episode":"series";
  const artId=kind==="episode"?id:(kind==="series"?id:Catalog.getSeason(id).series);

  let action;
  if(st==="open"){
    action=kind==="episode"
      ? `<button class="libPlay" data-play="${id}">▶ Play episode</button>
         <p class="libDetNote">${state.watched.includes(id)?"You have watched this one — it plays again from the start.":"Unlocked and ready."}</p>`
      : `<p class="libDetNote">Unlocked. Its episodes are on the shelf.</p>`;
  }else if(st==="next"){
    const payable=Unlock.canPay(kind,id);
    action=`<div class="libPayBox">
        ${total>1?`<div class="libStepHead">Step ${paid+1} of ${total}</div>`:""}
        <div class="libPayChips">${libCostChips(step)}</div>
        <button class="libPay" id="libPay" ${payable?"":"disabled"}>Unlock</button>
        ${payable?"":`<p class="libDetNote">${libShortfallWords(kind,id)}</p>`}
      </div>`;
  }else{
    const cur=Unlock.current();
    action=`<div class="libPayBox locked">
        <div class="libPayChips">${libCostChips(libTotalCost(kind,id))}</div>
        <p class="libDetNote">🔒 ${cur?`Unlock <b>${libTitleOf(cur.kind,cur.id)}</b> first — the story runs in order.`:"Not available yet."}</p>
      </div>`;
  }

  return `<div class="libDetail">
      <div class="libDetTop">
        ${libArt(artKind,artId,"libDetArt")}
        <div class="libDetShade"></div>
        <button class="libBack" id="libBack" title="Back to the library">←</button>
        <div class="libDetHead">
          <div class="libKicker">${libWhere(kind,id)}</div>
          <h1 class="libDetTitle">${def.title}</h1>
        </div>
      </div>
      <div class="libDetBody">
        ${def.blurb?`<p class="libDetBlurb">${def.blurb}</p>`:""}
        ${total?`<div class="libBar"><span style="width:${total?Math.round(paid/total*100):100}%"></span></div>
                 <div class="libBarNum">${paid}/${total}</div>`:""}
        ${action}
        ${libStepList(kind,id)}
      </div>
    </div>`;
}

/* What is missing, in words — the detail page has room for a sentence where a card has room
   for a chip. Coins are ceil'd for the same reason the panel's were: a 0.06 shortfall is real
   and "still needs 0" is the one thing a price may never say. */
function libShortfallWords(kind,id){
  const m=Unlock.missing(kind,id), bits=[];
  if(m.coins) bits.push(`${fmt(Math.max(1,Math.ceil(m.coins)))} more coins`);
  Object.entries(m.items).forEach(([it,n])=>{
    const d=Catalog.getItem(it);
    bits.push(`${n} more ${d?d.name:it}${n>1?"s":""}`);
  });
  return bits.length?`Still needs ${bits.join(" and ")}.`:"";
}

/* ---------- open / render / close ---------- */
let _libOpen=false;
/* null = the shelf; {kind,id} = that target's page. One variable IS the navigation. */
let _libRoute=null;

function renderLibrary(){
  const host=$("#sheetHost");
  if(!_libOpen||!host) return;
  const scroll=$("#libScroll");
  const y=scroll?scroll.scrollTop:0;
  host.innerHTML=`<div class="libScreen">`+
    (_libRoute?libDetail(_libRoute.kind,_libRoute.id):libShelf())+
    `</div>`;
  /* Only the shelf keeps its place. A title page is a new screen and always opens at the top. */
  const back=$("#libScroll"); if(back&&!_libRoute) back.scrollTop=y;
  wireLibrary();
}

function wireLibrary(){
  /* ---- the title page ---- */
  const back=$("#libBack");
  if(back){
    back.onclick=()=>{ _libRoute=null; renderLibrary(); };
    const pay=$("#libPay");
    if(pay) pay.onclick=()=>{
      const r=_libRoute, res=Unlock.payStep(r.kind,r.id);
      if(!res) return;
      const what=libTitleOf(r.kind,r.id);
      log("🔓",res.justUnlocked?`Unlocked <b>${what}</b>`
                               :`Paid a step toward <b>${what}</b> (${Unlock.stepsPaid(r.kind,r.id)}/${Unlock.stepCount(r.kind,r.id)})`);
      if(res.justUnlocked){ confetti(); toast(`🔓 Unlocked — <b>${what}</b>`); }
      /* Stay on the page: the bar advances and the next step's price appears under it, so a
         player who can afford two steps pays them both without navigating anywhere. */
      renderLibrary();
      renderAll();
    };
    const play=$("[data-play]");
    if(play) play.onclick=()=>watchEpisode(play.dataset.play);
    return;
  }

  /* ---- the shelf ---- */
  $("#libX").onclick=closeLibrary;
  /* One delegated handler rather than one per card: the page is rebuilt whenever anything is
     paid for, and eighteen re-bound listeners per render is how a shelf starts leaking them. */
  const scroll=$("#libScroll");
  if(!scroll) return;
  scroll.onclick=async e=>{
    const el=e.target.closest("[data-kind][data-id]");
    if(!el) return;
    const kind=el.dataset.kind, id=el.dataset.id;
    /* An unlocked episode plays on the tap, the way a rail works everywhere else. Anything not
       yet paid for goes to its own page, which is where a price belongs. */
    if(kind==="episode"&&libState(kind,id)==="open"){ await watchEpisode(id); return; }
    _libRoute={kind,id};
    renderLibrary();
  };
}

function libTitleOf(kind,id){
  const d=kind==="series"?Catalog.getSeries(id):kind==="season"?Catalog.getSeason(id):Catalog.getEpisode(id);
  return d?d.title:id;
}

/* Play an unlocked episode. The player owns the whole experience once it is up (js/ui/player.js);
   this only puts it on screen, records that it was seen, and puts the shelf back afterwards.
   NOTE: the videos are gitignored and local-only, so on a machine without them every episode
   takes the player's own placeholder path — that is the player working, not this failing. */
async function watchEpisode(id){
  const ep=Catalog.getEpisode(id);
  if(!ep) return;
  const host=$("#sheetHost");
  host.classList.remove("libMode");
  host.innerHTML=`<div class="modal videoModal"><div class="top">
      <div class="eyebrow">${libTitleOf("season",Catalog.seasonOfEpisode(id)?.id||"")}</div>
      <h2>${ep.title}</h2></div>
    <div class="mbody">${playerMarkup(id)}</div></div>`;
  host.classList.add("show");
  log("🎞",`Watching <b>${ep.title}</b>`);
  await playVideo(id);
  if(!state.watched.includes(id)) state.watched.push(id);
  scheduleSaveState();
  /* Go back to whatever this interrupted. From the library that is the library; from the
     ready-to-unlock popup there is nothing to go back TO, and re-adding .libMode there would
     leave the host wearing a full-screen class over an empty page. */
  if(_libOpen){ host.classList.add("libMode"); renderLibrary(); }
  else { host.classList.remove("show","libMode"); host.innerHTML=""; renderAll(); }
}

function openLibrary(){
  const host=$("#sheetHost");
  if(!host) return;
  _libOpen=true; _libRoute=null;         // always opens on the shelf
  host.classList.add("show","libMode");
  renderLibrary();
}

function closeLibrary(){
  const host=$("#sheetHost");
  _libOpen=false; _libRoute=null;
  if(!host) return;
  host.classList.remove("show","libMode");
  host.innerHTML="";
  renderAll();
}

/* ---------- "this one is yours now" ----------
   Fires the moment the player can clear the CURRENT target outright — every remaining step, not
   just the next one. That is why it can offer "Unlock & watch": by the time it appears there is
   nothing left to pay.

   An in-game popup, deliberately: it mounts in #sheetHost WITHOUT .libMode, so the host goes back
   to centring a narrow modal and the board stays visible around it. The library is the full-screen
   surface; this is a tap on the shoulder, not a place you go. */
function openUnlockReady(kind,id){
  const host=$("#sheetHost");
  const def=kind==="series"?Catalog.getSeries(id):kind==="season"?Catalog.getSeason(id):Catalog.getEpisode(id);
  if(!host||!def||!Unlock.canPayAll(kind,id)) return Promise.resolve();

  const isEp=kind==="episode";
  const artKind=isEp?"episode":"series";
  const artId=isEp?id:(kind==="series"?id:Catalog.getSeason(id).series);
  const total=libTotalCost(kind,id);
  const steps=Unlock.stepCount(kind,id)-Unlock.stepsPaid(kind,id);

  return new Promise(resolve=>{
    host.innerHTML=`<div class="modal readyModal">
        <button class="sheetX" id="readyX" title="Not now">✕</button>
        <div class="readyArt">${libArt(artKind,artId,"readyImg")}<div class="readyShade"></div>
          <div class="readyOn">
            <div class="libKicker">Ready to unlock</div>
            <h2 class="readyTitle">${def.title}</h2>
            <div class="readyWhere">${libWhere(kind,id)}</div>
          </div>
        </div>
        <div class="mbody">
          ${def.blurb?`<p class="readyBlurb">${def.blurb}</p>`:""}
          <div class="readyCost">
            <div class="readyCostHead">You have everything it asks for${steps>1?` — all ${steps} steps`:""}</div>
            <div class="readyChips">${libCostChips(total)}</div>
          </div>
          <div class="readyBtns">
            ${isEp?`<button class="readyGo watch" id="readyWatch">▶ Unlock &amp; watch</button>`:""}
            <button class="readyGo" id="readyPay">🔓 Unlock</button>
          </div>
          <div class="hint readyNote">You can always do this later from the library.</div>
        </div>
      </div>`;
    host.classList.add("show");

    let done=false;
    const close=()=>{
      if(done) return; done=true;
      host.classList.remove("show"); host.innerHTML=""; host.onclick=null;
      renderAll(); resolve();
    };
    /* Published so clearOverlayFx() can settle this rather than only erasing it — the caller
       awaits this promise, and a teardown that wiped the markup would leave roll() parked. */
    _readyClose=close;

    $("#readyX").onclick=close;
    host.onclick=(e)=>{ if(e.target===host) close(); };

    /* Pays the WHOLE remaining price. Unlock.payAll is all-or-nothing across every step, so this
       cannot half-buy the thing the popup just promised was affordable. */
    const buy=()=>{
      const res=Unlock.payAll(kind,id);
      if(!res) return null;
      log("🔓",`Unlocked <b>${def.title}</b>${res.steps.length>1?` (${res.steps.length} steps at once)`:""}`);
      confetti();
      return res;
    };
    $("#readyPay").onclick=()=>{ if(buy()){ toast(`🔓 Unlocked — <b>${def.title}</b>`); close(); } };
    const w=$("#readyWatch");
    if(w) w.onclick=async()=>{
      if(!buy()) return;
      /* Close first: watchEpisode mounts the player in this same host. */
      done=true; _readyClose=null;
      host.classList.remove("show"); host.innerHTML=""; host.onclick=null;
      await watchEpisode(id);
      resolve();
    };
  });
}
let _readyClose=null;
