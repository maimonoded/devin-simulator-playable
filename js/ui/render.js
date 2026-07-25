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
}
function buildBoard(){
  applyFxTiming();
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
    board.appendChild(el);
  }
  positionToken(true);
}
function positionToken(instant){
  const tok=$("#token"); const p=gridPos(state.pos);
  const left=((p.c+0.5)/11)*100, top=((p.r+0.5)/11)*100;
  if(instant) tok.style.transition="none"; else tok.style.transition="";
  tok.style.left=left+"%"; tok.style.top=top+"%";
  if(instant) requestAnimationFrame(()=>{tok.style.transition="";});
}
/* Draw every registered overlay's markers (mystery boxes today) on their tiles. */
function renderOverlays(){
  document.querySelectorAll(".tile .ovl").forEach(b=>b.remove());
  OVERLAYS.forEach(o=>o.all().forEach(i=>{
    const el=document.querySelector(`.tile[data-i="${i}"]`);
    if(el){ const b=document.createElement("div"); b.className="ovl "+o.cssClass; b.textContent=o.icon; el.appendChild(b); }
  }));
}
function renderBuilderCenter(){
  const c=$("#builderCenter"); c.innerHTML="";
  const n=state.builder.length;
  const gap=n>6?"2%":"5%"; c.style.gap=gap;
  state.builder.forEach((b,i)=>{
    const done=b.tier>=cfg.tiers;
    const h=16+(b.tier/cfg.tiers)*84;
    const d=document.createElement("div"); d.className="sky"+(done?" done":"");
    d.style.width=(n>6?(84/n):12)+"%";
    d.innerHTML=`<div class="skytower" style="height:${h}%">${done?'<span class="crownt">👑</span>':''}</div>`;
    c.appendChild(d);
  });
}
function renderBuilderList(){
  const list=$("#builderList"); list.innerHTML="";
  state.builder.forEach((b,i)=>{
    const done=b.tier>=cfg.tiers;
    const cost=builderCost(i);
    const afford=cost!=null&&state.coins>=cost;
    let pips="";
    for(let t=1;t<=cfg.tiers;t++){
      const on=b.tier>=t;
      pips+=`<div class="lvpip${on?' on':''}${done?' done':''}"></div>`;
    }
    const row=document.createElement("div"); row.className="brow";
    const btn = done
      ? `<button class="upbtn max" disabled>MAX</button>`
      : `<button class="upbtn${afford?'':' cant'}" data-b="${i}" ${afford&&!state.animating?'':'disabled'}>
           <span class="uplvl">Lvl ${b.tier+1}</span><span class="upcost">🪙 ${fmt(cost)}</span></button>`;
    row.innerHTML=`<span class="bname">Builder ${i+1}</span>
      <div class="lvpips">${pips}</div>${btn}`;
    list.appendChild(row);
  });
  list.querySelectorAll(".upbtn[data-b]").forEach(bt=>bt.onclick=()=>uiUpgrade(+bt.dataset.b));
  // series progress
  const totalEps=cfg.buildings*cfg.tiers;
  const doneEps=Math.min(state.epUnlockedCount,totalEps);
  const bd=buildersDone();
  $("#seriesLbl").textContent=`Builders complete · ${bd}/${cfg.buildings}`;
  $("#seriesEps").textContent=`${doneEps} / ${totalEps} episodes`;
  $("#seriesFill").style.width=(doneEps/totalEps*100)+"%";
  const dots=$("#seriesDots"); dots.innerHTML="";
  state.builder.forEach((b)=>{
    const s=document.createElement("div");
    const frac=b.tier/cfg.tiers, col=b.tier>=cfg.tiers?"var(--gold)":(b.tier>0?"var(--purple)":"#20265a");
    s.style.cssText=`flex:1;height:6px;border-radius:3px;background:${col};opacity:${b.tier>0?0.5+0.5*frac:1}`;
    dots.appendChild(s);
  });
  $("#builderName").textContent=`${cfg.buildings} builders · pick any to upgrade`;
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
  $("#sBoards").textContent=buildersDone()+"/"+cfg.buildings;
  $("#sRolls").textContent=state.rolls;
  $("#sSessions").textContent=state.sessionsToday;
}
function renderStory(){
  const n=state.epQueue.length;
  $("#epBadge").style.display=n?"inline-block":"none";
  $("#epBadge").textContent=n+" ready";
  $("#watchBtn").disabled=!n||state.animating;
  $("#storyHint").innerHTML= n? `<b style="color:var(--pink)">${n}</b> episode${n>1?"s":""} unlocked — place your prediction before watching.`
                              : "Upgrade a landmark to unlock the next episode.";
}
/* Reflect state.mult on the multiplier buttons (needed after a restore or user reset). */
function syncMultButtons(){
  document.querySelectorAll(".mopt").forEach(b=>b.classList.toggle("on",+b.dataset.m===state.mult));
}
function renderAll(){ renderHUD();renderOverlays();renderBuilderCenter();renderBuilderList();renderStats();renderStory();
  scheduleSaveState();
  $("#rollBtn").disabled=state.animating||state.energy<state.mult||state.seriesDone;
  // autoBtn stays clickable while auto-play runs so it can act as a Stop button
  $("#autoBtn").disabled=autoOn?false:(state.animating||state.energy<state.mult||state.seriesDone);
  $("#autoBtn").innerHTML=autoOn?"⏸ Stop auto-play":"▶ Auto-play session";
  $("#nextBtn").disabled=state.animating;
  const gap=Math.max((cfg.energyCap-state.energy)*cfg.regenMin, 1440/cfg.sessionsPerDay);
  $("#nextHint").textContent=`advances ${(gap/60).toFixed(1)} h · refills to ${cfg.energyCap}⚡`;
}
