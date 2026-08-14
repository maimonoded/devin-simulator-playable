"use strict";
/* All read-only rendering of state → DOM. No state mutation here — the play controls delegate
   to js/ui/main.js. */
/* Push timing configs into CSS custom properties so the animations match the sim's pacing.
   Token glide/hop stay just inside one cfg.tokenStepMs beat (capped at the original
   .13s/.14s so slow settings don't feel mushy). */
function applyFxTiming(){
  const s=document.documentElement.style;
  s.setProperty("--stepDur",Math.min(130,cfg.tokenStepMs*0.96)+"ms");
  s.setProperty("--hopDur",Math.min(140,cfg.tokenStepMs)+"ms");
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
  return !(use3d() && window.Board3D && Board3D.hasModel && Board3D.hasModel(i));
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
}

function buildBoard(){
  applyFxTiming();
  document.body.classList.toggle("board3d",!!use3d());   // hides the legacy DOM board
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
  /* classAt/isGold rather than the flat cssClass: one overlay can look different tile to tile,
     which is how a box holding clues shows up gold before you land on it. */
  if(use3d()){
    Board3D.setOverlays(OVERLAYS.flatMap(o=>o.all().map(i=>({i,gold:!!(o.isGold&&o.isGold(i))}))));
    return;
  }
  document.querySelectorAll(".tile .ovl").forEach(b=>b.remove());
  OVERLAYS.forEach(o=>o.all().forEach(i=>{
    const el=document.querySelector(`.tile[data-i="${i}"]`);
    if(el){ const b=document.createElement("div"); b.className="ovl "+o.classAt(i); b.textContent=o.icon; el.appendChild(b); }
  }));
}
/* The board's own 2D chrome — the three things that outlived the builders view.

   They used to hang off renderBuilders(), which is gone with the view it drew. Keeping them in
   one named function rather than scattering them into renderAll() is what stops the next
   person wondering why the binge button is rendered from three different places. */
function renderBoardChrome(){
  /* Episodes banked by "Binge later" — the only way back to them in the mobile layout, since
     the side panel's Predict & watch button is not on screen there.
     A sealed reveal counts as something waiting: the bet is placed and the result is owed, so
     the button has to stay reachable even when the queue itself is empty. */
  const queued=state.epQueue.length+(state.pendingReveal?1:0);
  const binge=$("#bingeBtn");
  if(binge){
    binge.style.display=queued?"flex":"none";
    $("#bingeCount").textContent=queued;
  }
  /* The library button only exists once there is something in the library. */
  const lib=$("#libraryBtn");
  if(lib) lib.classList.toggle("on",Tickets.unlockedEpisodeIds().length>0);
  /* The album dot marks clues banked for the NEXT prediction — the ones about to be spent —
     rather than the lifetime total, which only ever grows and would leave the dot on forever. */
  const adot=$("#albumDot");
  if(adot) adot.classList.toggle("on",state.cycleClues>0);
  /* The ticket placeholders live in the 3D scene, not the DOM. */
  if(use3d()&&window.Board3D&&Board3D.available&&Board3D.setTicketSlots) Board3D.setTicketSlots();
}
function renderHUD(){
  $("#hDay").textContent="Day "+state.day;
  const tod=((state.clock%1440)+1440)%1440; let h=Math.floor(tod/60),m=Math.floor(tod%60);
  const ap=h<12?"AM":"PM"; let h12=h%12; if(h12===0)h12=12;
  $("#hClock").textContent=`${h12}:${String(m).padStart(2,"0")} ${ap}`;
  tweenNumber($("#hCoins"),state.lastCoins,state.coins,v=>fmt(v)); state.lastCoins=state.coins;
  /* The album is a lifetime total with a target the model names (clueAlbumSize), so show it as
     progress toward that rather than as a bare number climbing forever. Past the target it
     stops reading as a fraction — the collection is simply complete. */
  tweenNumber($("#hClues"),state.lastClues,state.clues,
              v=>state.clues>=cfg.clueAlbumSize?fmt(v):`${fmt(v)}/${fmt(cfg.clueAlbumSize)}`);
  state.lastClues=state.clues;
  $("#hVip").textContent=fmt(state.vip);
  /* Cards left in the shoe. The COUNT is never clamped — a bought pack merges onto whatever was
     left, so being over the cap is normal — but the BAR is, or an over-cap shoe would render a
     fill wider than its own track. */
  $("#hCards").textContent=Shoe.count();
  $("#hCardCap").textContent=cfg.packSize;
  $("#hCfill").style.width=Math.max(0,Math.min(100,(Shoe.count()/cfg.packSize)*100))+"%";
}
function renderStats(){
  $("#sEps").textContent=state.epsWatched;
  const tot=state.predWins+state.predLoss;
  $("#sAcc").textContent=tot? Math.round(state.predWins/tot*100)+"%":"—";
  $("#sStreak").textContent=state.streak;
  /* Same pair of calls as the profile sheet (js/ui/profile.js) — change one and the other has
     to change with it or the two surfaces disagree. */
  $("#sBoards").textContent=Tickets.doneCount()+"/"+Tickets.count();
  $("#sRolls").textContent=state.pulls;
  $("#sSessions").textContent=state.sessionsToday;
}
function renderStory(){
  const n=state.epQueue.length;
  $("#epBadge").style.display=n?"inline-block":"none";
  $("#epBadge").textContent=n+" ready";
  $("#watchBtn").disabled=!n||state.animating;
  $("#storyHint").innerHTML= n? `<b style="color:var(--pink)">${n}</b> episode${n>1?"s":""} unlocked — place your prediction before watching.`
                              : `Collect ${Tickets.perEpisode()} tickets to unlock the next episode.`;
}
function renderAll(){ renderHUD();renderOverlays();renderBoardChrome();renderStats();renderStory();
  scheduleSaveState();
  const autoBusy=autoMode!==null;
  /* Three reasons a pull is impossible, and all three must agree with the two gates in
     js/ui/main.js (pull()'s own guard and runAuto's per-pass re-check) — teach one and not the
     others and either the button lies about a loop still running, or auto-pull spins against a
     stopped board. */
  const rowFull=Tickets.rowFull();
  const cantRoll=state.animating||Shoe.isEmpty()||rowFull||state.seriesDone;
  /* Pull IS the auto-pull control (hold to start, tap to stop), so while auto-pull owns the
     loop it has to stay live to act as Stop — otherwise there'd be no way out. The session
     loop still locks it, since that mode owns the loop instead. */
  const rollIsAuto=autoMode==="roll";
  const rollBtn=$("#rollBtn");
  rollBtn.disabled=rollIsAuto?false:(autoBusy||cantRoll);
  /* A full row is not a dead end, it is the game asking you to watch. Say so on the button and
     let it route into the prediction rather than greying out — a disabled Pull with no
     explanation reads as a soft-lock, and this is now the ONLY stop condition in the game. */
  rollBtn.innerHTML=rollIsAuto?"⏸ Stop auto pull"
                   :rowFull&&!state.animating?"🎬 Watch to continue"
                   :Shoe.isEmpty()&&!state.animating?"🃏 Out of cards"
                   :"🃏 Pull";
  if(rowFull&&!state.animating&&!autoBusy&&!state.seriesDone) rollBtn.disabled=false;
  rollBtn.classList.toggle("auto",rollIsAuto);
  rollBtn.classList.toggle("needsWatch",rowFull&&!rollIsAuto);
  // the running mode's own button stays clickable so it can act as Stop; the other is locked out
  [["#autoBtn","session","▶ Auto-play session","⏸ Stop auto-play"]].forEach(([sel,mode,idle,active])=>{
    const b=$(sel), mine=autoMode===mode;
    b.innerHTML=mine?active:idle;
    b.disabled=mine?false:(autoBusy||cantRoll);
  });
  $("#nextBtn").disabled=state.animating;
  $("#storeBtn").disabled=state.animating||autoBusy;   // would fight the pull's own overlays
  /* The same expression advanceSession() uses to derive the gap. They are deliberately not
     shared — but if you change one, change the other, or the hint quietly reports a wait the
     button does not honour. */
  const gap=Math.max(Math.max(0,cfg.packSize-Shoe.count())*cfg.cardRegenMin, 1440/cfg.sessionsPerDay);
  $("#nextHint").textContent=`advances ${(gap/60).toFixed(1)} h · deals up to ${cfg.packSize}🃏`;
}
