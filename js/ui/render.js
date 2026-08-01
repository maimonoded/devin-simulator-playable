"use strict";
/* All read-only rendering of state → DOM. No state mutation here
   (the builder-list upgrade buttons delegate to uiUpgrade in ui/main.js). */
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
  if(use3d()){ Board3D.setOverlays(OVERLAYS.flatMap(o=>o.all())); return; }
  document.querySelectorAll(".tile .ovl").forEach(b=>b.remove());
  OVERLAYS.forEach(o=>o.all().forEach(i=>{
    const el=document.querySelector(`.tile[data-i="${i}"]`);
    if(el){ const b=document.createElement("div"); b.className="ovl "+o.cssClass; b.textContent=o.icon; el.appendChild(b); }
  }));
}
/* Mystery boxes bought but not yet thrown onto the board.

   The pop is driven by comparing against the last number SHOWN rather than being fired from the
   upgrade handler, so every path that banks a box gets the same acknowledgement — including a
   reload that restores a pending count. It only fires on an increase: the drop to zero after a
   throw is the boxes leaving, and celebrating that would be backwards. */
let _boxShown = null;
function renderBoxCounter(){
  const el=$("#boxCounter"); if(!el) return;
  const n=Math.max(0,state.pendingBoxes|0);
  el.classList.toggle("on",n>0);
  $("#boxCount").textContent=n;
  if(_boxShown!==null&&n>_boxShown){
    el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
  }
  _boxShown=n;
}
/* The builders view's 2D layer: the page header, and one upgrade button per building on the
   page. The buildings themselves are 3D and live in js/ui/builders3d.js — this is only the
   part you press.

   Every button on the row is the same width and shows a COMPACT price (fmtShort), because the
   row has to fit cfg.builderPageSize of them across a phone whatever the economy charges:
   "2.5k" costs four characters where "2,500" costs five and "1,240,000" costs nine. */
function renderBuilders(){
  const page=Builders.pageBuilders();
  // clickable while auto-roll is running (buying stops it), but not during a manual roll
  const live=!state.animating||autoMode==="roll";
  const bar=$("#buildersBar"); bar.innerHTML="";
  page.forEach(i=>{
    const done=Builders.isMaxed(i);
    const afford=Builders.canAfford(i);
    const b=document.createElement("button");
    b.className="upb"+(done?" max":afford?"":" cant");
    b.disabled=done||!afford||!live;
    b.dataset.b=i;
    b.innerHTML=done
      ? `<span class="upbName">#${i+1}</span><span class="upbCost">MAX</span>`
      : `<span class="upbName">#${i+1} · Lv${Builders.tier(i)+1}</span>
         <span class="upbCost">🪙 ${fmtShort(Builders.nextCost(i))}</span>`;
    bar.appendChild(b);
  });
  bar.querySelectorAll("button[data-b]").forEach(bt=>bt.onclick=()=>onUpgradeClick(+bt.dataset.b));

  const s=Builders.series(), many=Economy.playableSeries().length>1;
  const range=page.length?`${page[0]+1}–${page[page.length-1]+1}`:"—";
  $("#buildersHead").innerHTML=
    `<b>${many&&s?`${s.name} · `:""}Buildings ${range}</b>
     <span>${Builders.doneCount()}/${Builders.count()} complete · set ${Builders.page()+1} of ${Builders.pageCount()}</span>`;

  /* Episodes banked by "Binge later" — the only way back to them in the mobile layout, since
     the side panel's Predict & watch button is not on screen there. */
  /* A sealed reveal counts as something waiting: the bet is placed and the result is owed, so
     the button has to stay reachable even when the queue itself is empty. */
  const queued=state.epQueue.length+(state.pendingReveal?1:0);
  const binge=$("#bingeBtn");
  if(binge){
    binge.style.display=queued?"flex":"none";
    $("#bingeCount").textContent=queued;
  }
  /* The library button only exists once there is something in the library. */
  const lib=$("#libraryBtn");
  if(lib) lib.classList.toggle("on",Builders.unlockedEpisodeIds().length>0);
  /* The album dot marks clues banked for the NEXT prediction — the ones about to be spent —
     rather than the lifetime total, which only ever grows and would leave the dot on forever. */
  const adot=$("#albumDot");
  if(adot) adot.classList.toggle("on",state.cycleClues>0);

  /* The board shows nothing about builders any more, so the only hint that there is something
     to spend on is a dot on the button that takes you there. */
  const any=Builders.all().some((_,i)=>Builders.canAfford(i));
  $("#buildersDot").classList.toggle("on",any);
  if(use3d()&&window.Board3D&&Board3D.available&&Board3D.setBuilders) Board3D.setBuilders();
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
  $("#hEnergy").textContent=Math.floor(state.energy);
  $("#hEnergyCap").textContent=cfg.energyCap;
  $("#hEfill").style.width=Math.max(0,Math.min(100,(state.energy/cfg.energyCap)*100))+"%";
}
function renderStats(){
  $("#sEps").textContent=state.epsWatched;
  const tot=state.predWins+state.predLoss;
  $("#sAcc").textContent=tot? Math.round(state.predWins/tot*100)+"%":"—";
  $("#sStreak").textContent=state.streak;
  $("#sBoards").textContent=Builders.doneCount()+"/"+Builders.count();
  $("#sRolls").textContent=state.rolls;
  $("#sSessions").textContent=state.sessionsToday;
}
function renderStory(){
  const n=state.epQueue.length;
  $("#epBadge").style.display=n?"inline-block":"none";
  $("#epBadge").textContent=n+" ready";
  $("#watchBtn").disabled=!n||state.animating;
  $("#storyHint").innerHTML= n? `<b style="color:var(--pink)">${n}</b> episode${n>1?"s":""} unlocked — place your prediction before watching.`
                              : "Fully upgrade a builder to unlock the next episode.";
}
/* Reflect state.mult on the stake button (needed after a restore or user reset). */
function syncMultButton(){ $("#multBtn").textContent="×"+state.mult; }
function renderAll(){ renderHUD();renderOverlays();renderBuilders();renderBoxCounter();renderStats();renderStory();
  scheduleSaveState();
  const autoBusy=autoMode!==null;
  const cantRoll=state.animating||state.energy<state.mult||state.seriesDone;
  /* Roll IS the auto-roll control (hold to start, tap to stop), so while auto-roll owns the
     loop it has to stay live to act as Stop — otherwise there'd be no way out. The session
     loop still locks it, since that mode owns the loop instead. */
  const rollIsAuto=autoMode==="roll";
  const rollBtn=$("#rollBtn");
  rollBtn.disabled=rollIsAuto?false:(autoBusy||cantRoll);
  rollBtn.innerHTML=rollIsAuto?"⏸ Stop auto roll":"🎲 Roll";
  rollBtn.classList.toggle("auto",rollIsAuto);
  // the multiplier is the stake for the roll in flight — lock it mid-spin and during auto
  $("#multBtn").disabled=state.animating||autoBusy;
  syncMultButton();
  // the running mode's own button stays clickable so it can act as Stop; the other is locked out
  [["#autoBtn","session","▶ Auto-play session","⏸ Stop auto-play"]].forEach(([sel,mode,idle,active])=>{
    const b=$(sel), mine=autoMode===mode;
    b.innerHTML=mine?active:idle;
    b.disabled=mine?false:(autoBusy||cantRoll);
  });
  $("#nextBtn").disabled=state.animating;
  $("#storeBtn").disabled=state.animating||autoBusy;   // would fight the roll's own overlays
  const gap=Math.max((cfg.energyCap-state.energy)*cfg.regenMin, 1440/cfg.sessionsPerDay);
  $("#nextHint").textContent=`advances ${(gap/60).toFixed(1)} h · refills to ${cfg.energyCap}⚡`;
}
