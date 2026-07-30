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

/* Hide the DOM pair only once the 3D dice can actually replace them. If cfg.dice3d is off, or
   die.glb never loaded, rollDiceAnim falls back to shaking them and they have to be on screen.
   They stay in the DOM either way — setDice() keeps them truthful and this only hides them, so
   nothing downstream has to guard against a missing #die1.

   Called again from onDiceReady() because the model arrives asynchronously: at boot the answer
   is "not ready", and without the second call the DOM dice would sit there for the whole
   session next to a perfectly good 3D pair. */
function syncDiceMode(){
  document.body.classList.toggle("dice3d",
    !!(use3d() && cfg.dice3d && window.Board3D && Board3D.diceReady && Board3D.diceReady()));
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
/* Skyline in the middle of the board — one tower per builder, height = its level. */
function renderBuilderCenter(){
  if(use3d()){ Board3D.setBuilders(); return; }
  const c=$("#builderCenter"); c.innerHTML="";
  const n=Builders.all().length;
  c.style.gap=n>6?"2%":"5%";
  Builders.all().forEach((b,i)=>{
    const done=Builders.isMaxed(i);
    const h=16+Builders.progress(i)*84;
    const d=document.createElement("div"); d.className="sky"+(done?" done":"");
    d.style.width=(n>6?(84/n):12)+"%";
    d.innerHTML=`<div class="skytower" style="height:${h}%">${done?'<span class="crownt">👑</span>':''}</div>`;
    c.appendChild(d);
  });
}
function renderBuilderList(){
  const list=$("#builderList"); list.innerHTML="";
  const tiers=Builders.maxTier();
  // clickable while auto-roll is running (buying stops it), but not during a manual roll
  const live=!state.animating||autoMode==="roll";
  Builders.all().forEach((b,i)=>{
    const done=Builders.isMaxed(i);
    const cost=Builders.nextCost(i);
    const afford=Builders.canAfford(i);
    let pips="";
    for(let t=1;t<=tiers;t++) pips+=`<div class="lvpip${b.tier>=t?' on':''}${done?' done':''}"></div>`;
    const row=document.createElement("div"); row.className="brow";
    const btn = done
      ? `<button class="upbtn max" disabled>MAX</button>`
      : `<button class="upbtn${afford?'':' cant'}" data-b="${i}" ${afford&&live?'':'disabled'}>
           <span class="uplvl">Lvl ${b.tier+1}</span><span class="upcost">🪙 ${fmt(cost)}</span></button>`;
    row.innerHTML=`<span class="bname">Builder ${i+1}</span>
      <div class="lvpips">${pips}</div>${btn}`;
    list.appendChild(row);
  });
  list.querySelectorAll(".upbtn[data-b]").forEach(bt=>bt.onclick=()=>onUpgradeClick(+bt.dataset.b));
  // series progress
  const totalEps=Builders.totalEpisodes(), doneEps=Builders.unlockedEpisodes();
  $("#seriesLbl").textContent=`Builders complete · ${Builders.doneCount()}/${Builders.count()}`;
  $("#seriesEps").textContent=`${doneEps} / ${totalEps} episodes`;
  $("#seriesFill").style.width=(totalEps?doneEps/totalEps*100:0)+"%";
  const dots=$("#seriesDots"); dots.innerHTML="";
  Builders.all().forEach((b,i)=>{
    const s=document.createElement("div");
    const frac=Builders.progress(i);
    const col=Builders.isMaxed(i)?"var(--gold)":(b.tier>0?"var(--purple)":"#20265a");
    s.style.cssText=`flex:1;height:6px;border-radius:3px;background:${col};opacity:${b.tier>0?0.5+0.5*frac:1}`;
    dots.appendChild(s);
  });
  // name the series once there is more than one with content, so the run has a sense of place
  const s=Builders.series(), many=Economy.playableSeries().length>1;
  $("#builderName").textContent=`${many&&s?`${s.name} · `:""}${Builders.count()} builders · pick any to upgrade`;
}
function renderHUD(){
  $("#hDay").textContent="Day "+state.day;
  const tod=((state.clock%1440)+1440)%1440; let h=Math.floor(tod/60),m=Math.floor(tod%60);
  const ap=h<12?"AM":"PM"; let h12=h%12; if(h12===0)h12=12;
  $("#hClock").textContent=`${h12}:${String(m).padStart(2,"0")} ${ap}`;
  tweenNumber($("#hCoins"),state.lastCoins,state.coins,v=>fmt(v)); state.lastCoins=state.coins;
  tweenNumber($("#hClues"),state.lastClues,state.clues,v=>fmt(v)); state.lastClues=state.clues;
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
/* Reflect state.mult on the multiplier buttons (needed after a restore or user reset). */
function syncMultButtons(){
  document.querySelectorAll(".mopt").forEach(b=>b.classList.toggle("on",+b.dataset.m===state.mult));
}
function renderAll(){ renderHUD();renderOverlays();renderBuilderCenter();renderBuilderList();renderStats();renderStory();
  scheduleSaveState();
  const autoBusy=autoMode!==null;
  const cantRoll=state.animating||state.energy<state.mult||state.seriesDone;
  $("#rollBtn").disabled=autoBusy||cantRoll;
  // the multiplier is the stake for the roll in flight — lock it mid-spin and during auto
  const lockMult=state.animating||autoBusy;
  document.querySelectorAll(".mopt").forEach(b=>b.disabled=lockMult);
  // the running mode's own button stays clickable so it can act as Stop; the other is locked out
  [["#autoRollBtn","roll","↻ Auto roll","⏸ Stop auto roll"],
   ["#autoBtn","session","▶ Auto-play session","⏸ Stop auto-play"]].forEach(([sel,mode,idle,active])=>{
    const b=$(sel), mine=autoMode===mode;
    b.innerHTML=mine?active:idle;
    b.disabled=mine?false:(autoBusy||cantRoll);
  });
  $("#nextBtn").disabled=state.animating;
  $("#storeBtn").disabled=state.animating||autoBusy;   // would fight the roll's own overlays
  const gap=Math.max((cfg.energyCap-state.energy)*cfg.regenMin, 1440/cfg.sessionsPerDay);
  $("#nextHint").textContent=`advances ${(gap/60).toFixed(1)} h · refills to ${cfg.energyCap}⚡`;
}
