"use strict";
/* The profile — the player's standing, and the Collectibles that prove it.

   Opened from the avatar in the HUD. Two jobs:

     1. THE STATUS TRACK. A rank, the points behind it, and how far the next one is. The points
        come from several places at once (js/status.js) and the breakdown is shown, because "why
        did that go up" is the question a bare number always provokes.

     2. THE COLLECTIBLES. GDD §4.3: the third copy of a card CONVERTS it into that card's
        Collectible, which "displays in the collection" — this is that display. Grouped by the
        set each came from, counted against the set's size, so the number says how far into a
        set you are as well as what you have.

   ---- NOTHING HERE IS FOR SALE ----

   There used to be a shelf of ten invented items with a coin price under each. §2.2 is that
   money buys packs and nothing else, and what a player owns should be what they pulled and
   converted, so the shelf and its buy buttons are gone with the items. This screen only shows.

   The one thing on it that writes state is the progress reset, which is here as well as in the
   tuning drawer because the drawer is a developer surface and is hidden in ?view=mobile, where
   the avatar is the only route to it. */

function openProfile(){ renderProfile(); }

function renderProfile(){
  const host=$("#sheetHost");
  const pts=Status.points(), rank=Status.rank(pts), next=Status.nextRank(pts);
  const lv=Status.level(pts), maxLv=Status.maxLevel();
  const pct=Math.round(Status.levelProgress(pts)*100);
  const acc=(()=>{ const t=state.predWins+state.predLoss; return t?Math.round(state.predWins/t*100)+"%":"—"; })();
  const [eps,epTotal]=Collection.boardProgress();

  /* THE TROPHIES (GDD §7.4). Shown above the Collectibles and apart from them, because they are
     the one thing here a pack cannot contain — every card below was pulled, and this row is only
     ever earned by calling an episode right. A locked slot per unwatched episode would spoil the
     running order, so only what has been won is drawn, with the count carrying the rest. */
  const won=Status.trophyIds();
  const trophies=won.length?`<div class="stZone">
      <div class="stZoneHead">🎯 Called it
        <span class="stZoneCount">${won.length}/${Episodes.count()}</span></div>
      <div class="stGrid">${won.map(id=>{
        const t=Status.trophyOf(id);
        return `<div class="stItem" title="${t.name.replace(/"/g,"&quot;")}">
            <div class="stArt" style="${cardArtCss(t.art)}"></div>
            <div class="stName">${Episodes.titleOf(id)}</div>
            <div class="stSub">+${t.points} status</div>
          </div>`;
      }).join("")}</div>
    </div>`:"";

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
        <!-- THE UNIT HAS TO BE ON IT. This read "183 collectibles" — the number is POINTS and
             the label is the SOURCE, so it announced a hundred and eighty-three Collectibles to
             a player holding three. "0 episodes watched" sitting beside it made it worse, since
             that one IS a plausible count and there was nothing to tell the reader the row above
             was not. The tile below is where the actual count lives. -->
        <div class="rankWhy">${Status.breakdown().map(b=>
          `<span>${BREAKDOWN_ICON[b.key]||"⭐"} ${b.name.toLowerCase()} · <b>${fmt(b.points)}</b> pts</span>`).join("")}</div>
      </div>

      <div class="profileGrid">
        <div class="pstat"><div class="v">${fmt(state.coins)}</div><div class="l">Coins</div></div>
        <div class="pstat"><div class="v">${state.rolls}</div><div class="l">Rolls</div></div>
        <div class="pstat"><div class="v">${state.epsWatched}</div><div class="l">Episodes watched</div></div>
        <div class="pstat"><div class="v">${acc}</div><div class="l">Prediction accuracy</div></div>
        <div class="pstat"><div class="v">${eps}/${epTotal}</div><div class="l">This set unlocked</div></div>
        <div class="pstat"><div class="v">${Cards.collectibleCount()}/${Cards.poolSize()}</div>
          <div class="l">Collectibles</div></div>
      </div>

      ${trophies}
      <div class="stRoom">${collectibleZones()}</div>

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

/* One icon per inflow on the status breakdown. Keyed loosely and with a fallback, because the
   list of inflows is js/status.js's to change and a missing key must cost an icon, not print
   "undefined" across the profile. */
const BREAKDOWN_ICON={cards:"🃏",trophies:"🏆",watched:"🎬",called:"🎯"};

/* THE COLLECTIBLES, grouped by set.

   Only what has been CONVERTED is drawn. The album is where the empty slots live — a set drawn
   here as a row of silhouettes with one card among them would be the album with less information
   in it — and the count in the zone head already says how much of the set is missing.

   Grouped in the order the ids arrive, which is catalogue order, so the zones read down the
   Season the way the album does. A set the current catalogue no longer holds still gets its own
   zone: a Collectible outlives the Season it came from (js/cards.js), and one that quietly
   vanished off the profile would read as a bug rather than as a Season ending. */
function collectibleZones(){
  const ids=Cards.collectibleIds();
  if(!ids.length) return `<div class="hint">No Collectibles yet — collecting
      ${Cards.copiesToConvert()} copies of a card converts it, and it lands here.</div>`;

  const order=[], bySet=new Map();
  ids.forEach(id=>{
    const c=Cards.collectibleOf(id);
    /* get() already falls through to the save's own record of a card, so a null here is an id
       nothing in the build or the save can explain. There is nothing to draw for it. */
    if(!c) return;
    if(!bySet.has(c.setKey)){ bySet.set(c.setKey,[]); order.push(c.setKey); }
    bySet.get(c.setKey).push(c);
  });

  return order.map(key=>{
    const mine=bySet.get(key);
    const set=Cards.setOf(key);
    /* A Collectible off a set this build no longer holds keeps the name its save remembered,
       and falls back to a heading rather than to an empty one — a zone with no title reads as
       broken, where "a retired set" reads as the Season having moved on. */
    return `<div class="stZone">
        <div class="stZoneHead">🗂 ${set?set.name:(mine[0].setName||"From a retired set")}
          <span class="stZoneCount">${mine.length}/${set?set.cards.length:mine.length}</span></div>
        <div class="stGrid">${mine.map(collectibleHtml).join("")}</div>
      </div>`;
  }).join("");
}

/* One Collectible. The two axes hold here as they do on a card face (CLAUDE.md): the gold — the
   frame, the points — is the family, and the STARS are the rarity and decide nothing else. The
   points are set as the hero the way the status face sets them, because what a Collectible is
   worth is the reason it is on this screen.

   The stars sit on their own line with the rarity's name rather than beside ⭐: two different
   stars in one line read as one muddled glyph, and ⭐ is already this screen's word for status
   everywhere else. The name is spelled out because this is one of the surfaces that speaks in
   prose — a card face never does. */
function collectibleHtml(c){
  /* The rarity read both ways — the object or its key — exactly as Cards.stars() reads it. */
  const r=(c.rarity&&c.rarity.key)?c.rarity:Cards.rarity(c.rarity);
  const copies=Cards.count(c.id);
  return `<div class="stItem" title="${String(c.name).replace(/"/g,"&quot;")} · ${r.name}">
      <div class="stArt" style="${c.art?cardArtCss(c.art):cardProcCss(c)}"></div>
      <div class="stName">${c.name}</div>
      <div class="stPts">⭐ ${fmt(c.points)}</div>
      <div class="stHow">✓ ${copies} copies</div>
      <div class="stBlurb">${Cards.stars(r)} ${r.name}</div>
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
