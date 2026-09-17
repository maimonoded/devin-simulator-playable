"use strict";
/* All read-only rendering of state → DOM. No state mutation here. */
/* Push timing configs into CSS custom properties so the animations match the sim's pacing.
   Token glide/hop stay just inside one cfg.tokenStepMs beat (capped at the original
   .13s/.14s so slow settings don't feel mushy); the dice shake spans its reveal window. */
function applyFxTiming(){
  const s=document.documentElement.style;
  s.setProperty("--stepDur",Math.min(130,cfg.tokenStepMs*0.96)+"ms");
  s.setProperty("--hopDur",Math.min(140,cfg.tokenStepMs)+"ms");
  s.setProperty("--shakeDur",Math.max(120,cfg.diceRevealMs)+"ms");
  // tile-art fit: tunable because the board's perspective makes the tile diamond's aspect
  // vary by position, so no one value suits every piece of art
  s.setProperty("--artScale",cfg.tileArtScale);
  s.setProperty("--artLift",cfg.tileArtLift+"%");
}
/* ---- optional tile artwork ----
   A tile uses assets/tiles/<i+1>.png when that file exists. Existence is probed by
   loading the image (fetch() is blocked on file://), and the result is cached per
   index so rebuilding the board doesn't re-probe. Tiles with no art are untouched,
   so a partly-filled assets/tiles/ mixes art and styled tiles happily.
   404s in the network log for absent files are expected. */
const tileArtStatus={};   // index → "ok" | "missing"

/* The art goes on a child element, not the tile's own background: a background is painted
   in the tile's local space and so gets rotated and sheared by the board's 3D transform.
   The child carries the same counter-rotation the icons use, so the picture faces the
   viewer upright. Inserted first so the coin label still paints above it. */
function paintTileArt(el,src){
  el.classList.add("hasArt");
  let art=el.querySelector(".art");
  if(!art){
    art=document.createElement("div");
    art.className="art";
    el.insertBefore(art,el.firstChild);
  }
  art.style.backgroundImage=`url("${src}")`;
}
function applyTileArt(el,i){
  if(tileArtStatus[i]==="missing") return;
  const src=tileImagePath(i);
  if(tileArtStatus[i]==="ok"){ paintTileArt(el,src); return; }
  const probe=new Image();
  probe.onload=()=>{
    tileArtStatus[i]="ok";
    // the board may have been rebuilt while the image loaded — re-find the tile
    const live=document.querySelector(`.tile[data-i="${i}"]`);
    if(live) paintTileArt(live,src);
  };
  probe.onerror=()=>{ tileArtStatus[i]="missing"; };
  probe.src=src;
}

/* Is the WebGL board in charge? cfg.board3d turns it on; Board3D.available goes false if
   WebGL couldn't start, in which case we fall back to the DOM board below. */
function use3d(){ return cfg.board3d && window.Board3D && Board3D.available; }

/* ---- DOM label layer for the 3D board ----
   Tile values and emoji stay as DOM text over the canvas: crisp at ~47px, and the drawer's
   live stdBase edits keep working by rewriting textContent. Positioned by projection. */
/* A tile with 3D art doesn't get an emoji too. The icon is a flat DOM sticker sitting over a
   lit, shadowed model — it covers the art it is meant to caption and reads as a different
   medium. The legacy CSS board has said the same thing since it gained artwork
   (.tile.hasArt .ico is display:none); this is that rule for the WebGL board. The coin value
   stays, because it is information the art cannot carry. */
function showIcon(i,def){
  if(!def.icon) return false;
  if(!(use3d() && window.Board3D)) return true;
  const skinned=(Board3D.hasModel&&Board3D.hasModel(i))||(Board3D.hasArt&&Board3D.hasArt(i));
  return !skinned;
}
/* Models load asynchronously, so a tile can gain its art after the label was built. */
function onTileModelled(i){
  const ico=document.querySelector(`#boardLabels .blabel[data-i="${i}"] .ico`);
  if(ico) ico.remove();
}
function buildBoardLabels(){
  const layer=$("#boardLabels"); if(!layer) return;
  layer.innerHTML="";
  for(let i=0;i<40;i++){
    const def=TILE_TYPES[tileType(i)];
    const el=document.createElement("div");
    el.className="blabel"; el.dataset.i=i;
    el.innerHTML=(showIcon(i,def)?`<span class="ico">${def.icon}</span>`:"")+
                 (def.valueLabel(i)?`<span class="val">${def.valueLabel(i)}</span>`:"");
    layer.appendChild(el);
  }
  syncBoardLabels();
}
function syncBoardLabels(){
  const layer=$("#boardLabels"); if(!layer||!use3d()) return;
  layer.querySelectorAll(".blabel").forEach(el=>{
    const p=Board3D.screenPosOf(+el.dataset.i);
    if(!p) return;
    el.style.left=p.x+"px"; el.style.top=p.y+"px";
  });
  syncVipBadge();
}

/* ---- the VIP pool, over the tile that pays it ----
   It used to be a pill in the HUD, three inches from the thing it describes. The pool is the one
   balance tied to a PLACE: it builds up on the VIP Lounge and is collected by landing there, so
   floating it over that tile says what it is and where to go for it in one move, and the HUD goes
   back to being the balances you carry.

   It rides in #boardLabels, the DOM layer that already sits over the canvas and already gets
   re-positioned every frame the camera moves — so it follows the board for free rather than
   needing its own projection. Built from JS because index.html is not ours to edit right now;
   it is one element and it belongs to this function.

   Hidden at zero: an empty pool is not a target, and a badge reading 0 over a corner is noise.
   Hidden on the legacy CSS board too, which has no screenPosOf to place it with — there the HUD
   pill stays, which is why that hiding is conditional rather than a flat CSS rule. */
const VIP_BADGE_LIFT=30;          // px above the tile's centre, clear of the piece standing on it
function syncVipBadge(){
  const layer=$("#boardLabels"); if(!layer) return;
  let el=$("#vipBadge");
  const on=use3d()&&state.vip>0;
  if(!on){ if(el) el.style.display="none"; return; }
  if(!el){
    el=document.createElement("div");
    el.className="vipBadge"; el.id="vipBadge";
    /* The coin icon with the emoji behind it: the PNG is a generated asset and a board that has
       not got it yet should still show a coin rather than a gap. */
    el.innerHTML=`<img src="assets/ui/coin.png" alt="" onerror="this.remove()"><b>0</b>`;
    layer.appendChild(el);
  }
  el.style.display="";
  el.querySelector("b").textContent=fmt(state.vip);
  const p=Board3D.screenPosOf(20);
  if(!p) return;
  /* CLAMPED INTO THE FRAME, not simply placed. cfg.camFollow keeps the camera on the token, so
     the VIP corner is off-screen most of the time — placed honestly the badge spends the run
     above the top edge of the canvas, clipped, which would make moving it out of the HUD a
     downgrade. Pinned to the edge it stays readable AND still points at where the pool is: it
     sits over the tile when the tile is in view, and drifts to the side it went off on when it
     is not. Same idea as a map marker that hugs the edge rather than vanishing. */
  const r=layer.getBoundingClientRect(), m=26;
  const x=Math.max(m,Math.min(r.width-m,p.x));
  const y=Math.max(m,Math.min(r.height-m,p.y-VIP_BADGE_LIFT));
  el.style.left=x+"px"; el.style.top=y+"px";
  el.classList.toggle("off", x!==p.x||y!==p.y-VIP_BADGE_LIFT);
}

/* SHOW the DOM pair only when the 3D dice can't replace them. If cfg.dice3d is off, or
   die.glb never loaded, rollDiceAnim falls back to shaking them and they have to be on screen.
   They stay in the DOM either way — setDice() keeps them truthful and this only toggles
   visibility, so nothing downstream has to guard against a missing #die1.

   The test asks whether the 3D dice are EXPECTED to handle the throw, not whether they have
   finished downloading. Those differ for the few hundred ms die.glb takes to arrive, and
   keying off "downloaded" is what made the DOM pair flash on every single load: boot ran while
   the model was still in flight, showed the fallback, then hid it again the moment the file
   landed. Nothing is lost by waiting — Dice3D.throwDice queues a throw made before the model
   arrives and still resolves on time, so a roll in that window is animated by the 3D dice a
   fraction late rather than by the DOM pair.

   Called again from onDiceReady(), which now fires on BOTH outcomes: on success to keep the
   pair hidden, and on failure to bring it back, since at that point nothing else will draw
   a die. */
function syncDiceMode(){
  const dice3dWorks=use3d()&&cfg.dice3d&&window.Board3D&&Board3D.diceFailed&&!Board3D.diceFailed();
  document.body.classList.toggle("dice2d",!dice3dWorks);
}
function onDiceReady(){ syncDiceMode(); }

function buildBoard(){
  applyFxTiming();
  document.body.classList.toggle("board3d",!!use3d());   // hides the legacy DOM board
  syncDiceMode();
  if(use3d()){ Board3D.build(); buildBoardLabels(); return; }
  const board=$("#board");
  board.querySelectorAll(".tile").forEach(t=>t.remove());
  for(let i=0;i<40;i++){
    const t=tileType(i); const def=TILE_TYPES[t]; const p=gridPos(i);
    const el=document.createElement("div");
    el.className="tile "+(def.corner?"corner "+t:t);
    el.style.gridRow=p.r+1; el.style.gridColumn=p.c+1;
    el.dataset.i=i;
    const val=def.valueLabel(i);
    el.innerHTML=(def.icon?`<span class="ico">${def.icon}</span>`:"")+
      (val?`<span class="val">${val}</span>`:"");
    applyTileArt(el,i);            // skins the tile if assets/tiles/<i+1>.png exists
    board.appendChild(el);
  }
  positionToken(true);
}
function positionToken(instant){
  if(use3d()){ Board3D.setTokenTile(state.pos,instant); return; }
  const tok=$("#token"); const p=gridPos(state.pos);
  const left=((p.c+0.5)/11)*100, top=((p.r+0.5)/11)*100;
  if(instant) tok.style.transition="none"; else tok.style.transition="";
  tok.style.left=left+"%"; tok.style.top=top+"%";
  if(instant) requestAnimationFrame(()=>{tok.style.transition="";});
}
/* Draw every registered overlay's markers (mystery boxes today) on their tiles. */
function renderOverlays(){
  /* A flat list of tile indices. Boxes used to come in two looks — a gold one when it held
     clues — so this passed {i, gold} pairs; with clues gone every box looks the same and the
     flag carried nothing. classAt() (js/overlays/overlay.js) stays, because the legacy CSS
     board still lets one overlay style itself differently tile to tile. */
  if(use3d()){
    Board3D.setOverlays(OVERLAYS.flatMap(o=>o.all()));
    return;
  }
  document.querySelectorAll(".tile .ovl").forEach(b=>b.remove());
  OVERLAYS.forEach(o=>o.all().forEach(i=>{
    const el=document.querySelector(`.tile[data-i="${i}"]`);
    if(el){ const b=document.createElement("div"); b.className="ovl "+o.classAt(i); b.textContent=o.icon; el.appendChild(b); }
  }));
}
function renderHUD(){
  $("#hDay").textContent="Day "+state.day;
  const tod=((state.clock%1440)+1440)%1440; let h=Math.floor(tod/60),m=Math.floor(tod%60);
  const ap=h<12?"AM":"PM"; let h12=h%12; if(h12===0)h12=12;
  $("#hClock").textContent=`${h12}:${String(m).padStart(2,"0")} ${ap}`;
  tweenNumber($("#hCoins"),state.lastCoins,state.coins,v=>fmt(v)); state.lastCoins=state.coins;
  $("#hVip").textContent=fmt(state.vip);
  /* The pill only hides where the badge can take over — the legacy CSS board has no
     screenPosOf(), so there it stays the only place the pool is readable. */
  const vipPill=$("#hVip")?.closest(".pill");
  if(vipPill) vipPill.style.display=use3d()?"none":"";
  syncVipBadge();
  /* Energy is NOT here any more — it is on the Roll button, which is the only thing that spends
     it. See renderAll below. The pill's markup is still in index.html and hidden by a rule in
     css/panels.css; both come out together once that file is free to edit. */
}
function renderStats(){
  $("#sRolls").textContent=state.rolls;
  $("#sSessions").textContent=state.sessionsToday;
}
/* Reflect state.mult on the stake button (needed after a restore or user reset). */
function syncMultButton(){ $("#multBtn").textContent="×"+state.mult; }
function renderAll(){ renderHUD();renderOverlays();renderStats();
  scheduleSaveState();
  const autoBusy=autoMode!==null;
  const cantRoll=state.animating||state.energy<state.mult;
  /* Roll IS the auto-roll control (hold to start, tap to stop), so while auto-roll owns the
     loop it has to stay live to act as Stop — otherwise there'd be no way out. It is now the
     only auto mode, so autoBusy and rollIsAuto always agree; both stay because the disabled
     rule is about who owns the loop, not about how many modes there happen to be. */
  const rollIsAuto=autoMode==="roll";
  const rollBtn=$("#rollBtn");
  rollBtn.disabled=rollIsAuto?false:(autoBusy||cantRoll);
  /* The energy balance rides on Roll rather than sitting in the HUD, because Roll is the only
     thing that spends it and the number's whole job is to answer "can I press this again?".
     It also explains the disabled state in place: a greyed-out button with "⚡2 / 30" under it
     says why, where a greyed-out button next to a pill three inches away does not.
     `low` is the cost of THIS roll, not zero — at ×5 a balance of 4 is already too little. */
  const e=Math.floor(state.energy), low=state.energy<state.mult;
  rollBtn.innerHTML=(rollIsAuto?"⏸ Stop auto roll":"🎲 Roll")+
    `<i class="rollE${low?" low":""}">⚡ ${fmt(e)}<b>/${cfg.energyCap}</b></i>`;
  rollBtn.title=low?`Needs ${state.mult}⚡ for a ×${state.mult} roll — you have ${e}`
                   :`${e} of ${cfg.energyCap} energy · this roll costs ${state.mult}`;
  rollBtn.classList.toggle("auto",rollIsAuto);
  // the multiplier is the stake for the roll in flight — lock it mid-spin and during auto
  $("#multBtn").disabled=state.animating||autoBusy;
  syncMultButton();
  $("#nextBtn").disabled=state.animating;
  /* Both of these open something over the board, so both fight the roll's own overlays and both
     have to be locked out for the same window. The Library was missed when it was added: it
     stayed lit through an auto-roll and every tap on it did nothing, which reads as broken. */
  $("#storeBtn").disabled=state.animating||autoBusy;
  const lib=$("#libBtn"); if(lib) lib.disabled=state.animating||autoBusy;
  const gap=Math.max((cfg.energyCap-state.energy)*cfg.regenMin, 1440/cfg.sessionsPerDay);
  $("#nextHint").textContent=`advances ${(gap/60).toFixed(1)} h · refills to ${cfg.energyCap}⚡`;
}
