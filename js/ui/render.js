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
  /* The card flip is one beat of the box popup's pacing, so it comes from the same knob the
     popup schedules by rather than being a number in the stylesheet that drifts from it. */
  s.setProperty("--flipMs",Math.max(60,cfg.packFlipMs||420)+"ms");
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
  if(!use3d() || !window.Board3D) return true;
  /* EITHER kind of art replaces the icon — a model on the slab, or a picture printed on it.
     Checking only for a model left the 💬 sitting on top of the portrait tiles. */
  const arted=(Board3D.hasModel && Board3D.hasModel(i)) || (Board3D.hasArt && Board3D.hasArt(i));
  return !arted;
}
/* Art loads asynchronously — a model or a tile PNG — so a tile can gain it after the label was
   built. Both paths call this. */
function onTileModelled(i){
  const ico=document.querySelector(`#boardLabels .blabel[data-i="${i}"] .ico`);
  if(ico) ico.remove();
}
function buildBoardLabels(){
  const layer=$("#boardLabels"); if(!layer) return;
  layer.innerHTML="";
  for(let i=0;i<boardSize();i++){
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
  if(use3d()){ Board3D.build(); buildBoardLabels(); renderCaseBoard(); return; }
  const board=$("#board");
  board.querySelectorAll(".tile").forEach(t=>t.remove());
  for(let i=0;i<boardSize();i++){
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
/* The case board — the current set, standing inside the ring. It is geometry in the board's own
   scene (js/ui/estate3d.js), not a DOM layer, so there is nothing to position here: this only asks
   it to redraw, and it decides for itself whether anything actually changed.

   The legacy CSS board has no scene to put it in and so has no case board; the album button is
   the route to the same information there. */
/* Kept under the old name because renderAll() and the pack flow both call it; what stands in
   the ring is the Status Estate now (js/ui/estate3d.js). */
function renderCaseBoard(){
  if(use3d()&&window.Board3D&&Board3D.available&&Board3D.syncCase) Board3D.syncCase();
}
/* Tapping the estate opens the PROFILE — called from js/ui/board3d.js, which is the only place
   that knows a press was a tap rather than a pan. The estate is a picture of the Status track,
   so what is behind it is the track. */
function onEstateTap(){
  if(state.animating) return;
  openProfile();
}

function renderHUD(){
  $("#hDay").textContent="Day "+state.day;
  const tod=((state.clock%1440)+1440)%1440; let h=Math.floor(tod/60),m=Math.floor(tod%60);
  const ap=h<12?"AM":"PM"; let h12=h%12; if(h12===0)h12=12;
  $("#hClock").textContent=`${h12}:${String(m).padStart(2,"0")} ${ap}`;
  tweenNumber($("#hCoins"),state.lastCoins,state.coins,v=>fmt(v)); state.lastCoins=state.coins;
  /* TROPHIES — the count, not a fraction. "How many have I called right" is the question; how
     many episodes exist is the profile's business, and a denominator here would also leak how
     much story is left. Derived from state.trophies via Status, so it can never drift. */
  const tro=Status.trophyIds().length;
  tweenNumber($("#hTrophies"),state.lastTrophies,tro,v=>String(Math.round(v)));
  state.lastTrophies=tro;
  /* COLLECTIBLES — cards taken to three copies. A count, not a fraction, for the same reason
     the trophies are: "how many have I got" is the question a top bar answers, and the
     denominator lives in the profile where there is room to mean something. Derived from
     state.cards, so it cannot drift from the album. */
  const col=Cards.collectibleCount();
  tweenNumber($("#hCollect"),state.lastCollect,col,v=>String(Math.round(v)));
  state.lastCollect=col;
  /* The Gala pot and the collection counter are NOT in the HUD. The pot is a number the player
     can do nothing about, and the collection duplicated the status track without being the
     thing that ends a Season. Both are still visible where they can be acted on — the log and
     the reveal for the pot, the album for the collection. */
  renderEnergy();
  renderStatusChip();
}

/* ENERGY, ON THE ROLL BUTTON.
   It is a cost, not a balance: it only matters in the instant you are deciding whether to roll,
   which is exactly where the button is. The bar under the label is the same fraction the HUD
   pill used to show. Nothing here writes the button's innerHTML — the label is its own span,
   because the auto-roll swap rewrites that and would otherwise delete the readout. */
function renderEnergy(){
  const v=$("#rollEnergy"); if(!v) return;
  v.textContent=Math.floor(state.energy);
  const cap=$("#rollEnergyCap"); if(cap) cap.textContent="/"+cfg.energyCap;
  const f=$("#rollEfill");
  /* Energy may legitimately EXCEED the cap — store packs are far larger than it — so the bar
     clamps at 100% while the number keeps telling the truth. See CLAUDE.md. */
  if(f) f.style.width=Math.max(0,Math.min(100,(state.energy/Math.max(1,cfg.energyCap))*100))+"%";
}
/* The status track, beside the avatar. The band's title and how far through the LEVEL — the
   profile is one tap away for the detail, so what belongs here is only "where am I and am I
   moving". The bar is the level rather than the band because a level moves several times a
   session and a band moves once every five; a bar that never visibly fills is not a bar. */
function renderStatusChip(){
  const el=$("#hLevelPill"); if(!el) return;
  /* PINNED? Then draw an older reading of the truth, and leave state.lastStatus alone.
     A card beat holds the chip so the bar cannot finish moving before the player has been shown
     the card that moved it — status is banked while the event list is built, which is well
     before the beat opens. releaseStatusChip (js/ui/fx.js) runs the bar afterwards and calls
     this again to settle on the real number. Nothing is stored: Status.points() is the truth
     throughout, and the pin is only ever a value to DRAW. */
  const pinned=typeof statusPinned==="function"&&statusPinned();
  const pts=typeof statusShownPoints==="function"?statusShownPoints():Status.points();
  const rank=Status.rank(pts), lv=Status.level(pts);
  /* The LEVEL is the value and the band is its label, which is the right way round for a pill:
     the number moves several times a session, the band once every five levels. */
  $("#hLevel").textContent=lv;
  $("#hRank").textContent=rank.name;
  /* The band's own artwork, swapped by class — six files, one per rung. textContent would put a
     glyph back inside a span that is now a background image and nothing would show. */
  const ri=$("#hRankIco");
  if(ri){ ri.className="ic i-rank i-rank-"+(rank.key||"extra"); ri.title=rank.name; }
  $("#hRankFill").style.width=Math.round(Status.levelProgress(pts)*100)+"%";
  /* Pop when the number moves, since the chip is small and easy to miss. Not while pinned —
     the release owns that move and gives it a louder one than this. */
  if(!pinned&&state.lastStatus!==pts){
    el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
    state.lastStatus=pts;
  }
  const owed=Status.toNextLevel(pts);
  el.title=`Level ${lv}/${Status.maxLevel()} · ${fmt(pts)} status · ${
    owed?`${fmt(owed)} to level ${lv+1}`:"Season complete"}`;
}
function renderStats(){
  $("#sEps").textContent=state.epsWatched;
  const tot=state.predWins+state.predLoss;
  $("#sAcc").textContent=tot? Math.round(state.predWins/tot*100)+"%":"—";
  $("#sStreak").textContent=state.streak;
  const [eps,epTotal]=Collection.boardProgress();
  $("#sSet").textContent=eps+"/"+epTotal;
  $("#sRolls").textContent=state.rolls;
  $("#sSessions").textContent=state.sessionsToday;
}
/* The board's two buttons that carry state: the album, and the way into an episode. */
function renderNav(){
  /* The album dot marks clues banked for the NEXT prediction — the ones about to be spent —
     rather than the lifetime total, which only ever grows and would leave the dot on forever. */
  const adot=$("#albumDot");
  /* Lit while there is evidence to read for the episode that is next up. */
  const nextEp=Collection.firstUnwatchedId();
  if(adot) adot.classList.toggle("on",!!nextEp&&Clues.countFor(nextEp)>0);
  /* Episodes: unwatched ones waiting, plus a sealed reveal, which is owed even with an empty
     queue. The badge is the count; the button hides when there is nothing at all. */
  const queued=state.epQueue.length+(state.pendingReveal?1:0);
  const epsBtn=$("#episodesBtn");
  if(epsBtn){
    epsBtn.classList.toggle("on",queued>0);
    $("#episodesDot").textContent=queued;
    $("#episodesDot").style.display=queued?"flex":"none";
    epsBtn.disabled=!(queued>0||Collection.unlockedEpisodeIds().length>0);
  }
}
function renderStory(){
  const n=state.epQueue.length;
  const playable=Collection.firstUnwatchedId();
  const blocked=Collection.blockedBy();
  $("#epBadge").style.display=n?"inline-block":"none";
  $("#epBadge").textContent=n+" ready";
  /* Unlocked is not the same as watchable: the drama is serialised, so the button is only live
     when the next episode of the STORY is the one that has been collected. */
  $("#watchBtn").disabled=!playable||state.animating;
  /* GDD §12's third non-negotiable: a progress bar to the next unlock, visible at all times.
     Whatever is holding the story up — the blocked episode, or simply the next one — this says
     how many clues it still wants, so the narrative track is never a black box. */
  const waiting=blocked||Clues.currentId();
  const [got,need]=waiting?Clues.progressFor(waiting):[0,0];
  const short=Math.max(0,need-got);
  $("#storyHint").innerHTML= playable
    ? `<b style="color:var(--pink)">${n}</b> episode${n>1?"s":""} ready — place your prediction before watching.`
    : blocked
      ? `<b style="color:var(--gold)">${Episodes.titleOf(blocked)}</b> comes next and needs
         <b>${short}</b> more clue${short===1?"":"s"} — episodes are watched in order.`
      : waiting
        ? `<b style="color:var(--gold)">${Episodes.titleOf(waiting)}</b> needs
           <b style="color:var(--pink)">${short}</b> more clue${short===1?"":"s"} — talk to the cast.`
        : "Every episode in this set has been watched.";
}
/* Reflect state.mult on the stake button (needed after a restore or user reset). */
function syncMultButton(){ $("#multBtn").textContent="×"+state.mult; }
/* THE OBJECTIVE TRACKER — what the player is chasing, how close, and whether they can act.

   The side panel answered this in prose and ?view=mobile hides the side panel, so on a phone the
   game never said what the clues were FOR. A clue landed, a card flashed, and the reason was
   nowhere. This is the between-rolls glance every collection game needs.

   TWO STATES, and the actionable one wins. If an episode can be watched right now that is the
   only thing worth saying, and the strip becomes a button that opens it. Otherwise it tracks the
   episode the clues are actually buying — Clues.currentId(), the first one still locked, which
   is where every clue goes by rule (js/clues.js) — with a segment per clue the episode wants.

   THE EPISODE NUMBER LEADS. "Six Months on the Street" is a name; "EP 4" is a position, and
   position is what tells you where you are in eighteen. */
function renderEpTrack(){
  const el=$("#epTrack"); if(!el) return;
  const ready=Collection.firstUnwatchedId();
  const id=ready||Clues.currentId();
  if(!id){
    el.className="epTrack done";
    el.innerHTML=`<span class="etTitle">Every episode watched — the Season's story is finished</span>`;
    el.disabled=true;                       // nothing left to open
    delete el.dataset.ep;
    return;
  }
  const num=Episodes.numberOf(id);
  const title=Episodes.titleOf(id);
  /* ALWAYS TAPPABLE NOW, and what it opens depends on what it is showing: the episode you can
     watch, or the case file for the one the clues are buying. It was disabled while collecting —
     which made the row a sign rather than a control, and left the evidence with no way in at all
     outside the wager screen (openEvidence had no caller: it was written for this and orphaned
     when the case panels were replaced). `ep` rides on the element so the handler does not have
     to recompute which episode the row was about. */
  el.disabled=false;
  el.dataset.ep=id;
  el.dataset.mode=ready?"watch":"evidence";

  /* THE METER FOR WHAT IS STILL BEING COLLECTED, whether or not something is ready to watch.

     The two states used to be exclusive: ready won, and the clue progress vanished. But clues
     keep landing while an episode sits unwatched, so the player was left with no idea how close
     the next unlock was for as long as they had something to watch — which, once the story gets
     going, is most of the time. Both facts are true at once and both belong on the row.

     Null when everything is unlocked: there is nothing left to collect toward, and an empty
     meter would be a promise the Season cannot keep. */
  const nextId=Clues.currentId();
  const meter=(()=>{
    if(nextId==null) return "";
    const [have,need]=Clues.progressFor(nextId);
    let bar="";
    for(let i=0;i<need;i++) bar+=`<i class="${i<have?"on":""}"></i>`;
    /* When it IS the thing being tracked, the meter needs no label — the title is right there.
       When something else is ready, it does: "EP 5" is what stops the bar reading as progress
       toward the episode the row is offering. */
    return ready
      ? `<span class="etNext">EP ${Episodes.numberOf(nextId)}</span><span class="etBar">${bar}</span>`
      : `<span class="etBar">${bar}</span><span class="etCount"><b>${have}/${need}</b></span>`;
  })();

  if(ready){
    /* ONLY ONE EPISODE IS EVER WATCHABLE. The drama is serialised, so however many are unlocked
       the next in story order is the only one openPrediction will open — naming one is correct,
       not a simplification. The title goes when something else needs the room: you are one tap
       from a screen with the title on it. */
    el.className="epTrack ready";
    el.innerHTML=`<span class="etNum">EP ${num}</span>
      <span class="etTitle">${title}</span>
      <span class="etState"><b>Ready</b> — tap</span>
      ${meter}`;
    return;
  }
  el.className="epTrack";
  el.innerHTML=`<span class="etNum">EP ${num}</span>
    <span class="etTitle">${title}</span>
    ${meter}`;
}

function renderAll(){ renderHUD();renderNav();renderStats();renderStory();renderEpTrack();renderCaseBoard();
  scheduleSaveState();
  const autoBusy=autoMode!==null;
  const cantRoll=state.animating||state.energy<state.mult||state.seriesDone;
  /* Roll IS the auto-roll control (hold to start, tap to stop), so while auto-roll owns the
     loop it has to stay live to act as Stop — otherwise there'd be no way out. The session
     loop still locks it, since that mode owns the loop instead. */
  const rollIsAuto=autoMode==="roll";
  const rollBtn=$("#rollBtn");
  rollBtn.disabled=rollIsAuto?false:(autoBusy||cantRoll);
  /* The LABEL only — the energy readout and its bar are siblings and must survive the swap. */
  const rollLabel=$("#rollLabel");
  /* innerHTML, not textContent. The label carries an ICON SPAN now (assets/icons/dice.webp), and
     textContent would have replaced it with a string the first time the button rendered — the
     die would simply never have appeared, in a way that looks like a missing asset rather than
     a wrong assignment. The pause state keeps a glyph because there is no art for it: it is a
     transient control state, not a thing in the game. */
  if(rollLabel) rollLabel.innerHTML=rollIsAuto
    ? "\u23f8 Stop auto roll"
    : `<span class="ic i-dice"></span>Roll`;
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
