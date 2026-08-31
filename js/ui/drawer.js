"use strict";
/* Tuning drawer — builds inputs from the TUNING schema + the box tables, binds live edits. */
function buildTuning(){
  const body=$("#tuningBody"); body.innerHTML="";
  TUNING.forEach(g=>{
    const wrap=document.createElement("div"); wrap.className="tgroup";
    wrap.innerHTML=`<h4>${g.group}</h4>`;
    g.items.forEach(([key,label,step,range])=>{
      const row=document.createElement("div"); row.className="trow";
      /* Three row shapes, in order of specificity:
           {choices} in the step slot -> a picker. The options are fetched now rather than
             listed in the schema, because the schema lives in config.js which loads before
             the manifest that defines them.
           {min,max} as a 4th entry  -> a slider, for values you tune by eye rather than by
             number: you want to sweep and watch, not guess and type.
           otherwise                 -> a plain number box. */
      if(step&&step.choices==="env"){
        const opts=envSceneNames().map(n=>
          `<option value="${n}"${n===cfg[key]?" selected":""}>${envSceneLabel(n)}</option>`).join("");
        row.innerHTML=`<label>${label}</label><select data-key="${key}" data-choice="1">${opts}</select>`;
      }else if(range){
        row.innerHTML=`<label>${label}</label><span class="tslider">
             <input type="range" min="${range.min}" max="${range.max}" step="${step}"
                    data-key="${key}" value="${cfg[key]}">
             <output data-out="${key}">${cfg[key]}</output></span>`;
      }else{
        row.innerHTML=`<label>${label}</label><input type="number" step="${step}" data-key="${key}" value="${cfg[key]}">`;
      }
      wrap.appendChild(row);
    });
    body.appendChild(wrap);
  });
  /* The pack tables — the three packs, and what each row's weight is worth in the draw.
     This replaced the deck and mystery-box editors: neither table is read by the game any more
     (js/config.js says why they are still there), and packs are where every card, coin and
     point of energy now comes from. Percentages are shown alongside the raw weight because a
     weight only means something against the column's total.

     NO DOLLAR PRICE. GDD 8.4: real money buys Money, and only Money buys packs — the tiers
     stopped carrying a `usd` when that landed, and this line still printing one is what took
     the whole boot down with it, because buildTuning() runs before renderAll(). */
  boxTiers.forEach((t,ti)=>{
    const wrap=document.createElement("div"); wrap.className="tgroup";
    const total=t.table.reduce((a,r)=>a+r.weight,0)||1;
    const price=Boxes.priceOf(t.key);
    wrap.innerHTML=`<h4>${t.icon} ${t.name} · ${t.items} draw${t.items>1?"s":""}${
        t.clue==="fresh"?" + a clue":""}</h4>
      <p class="hint" style="margin:0 0 8px">Bought for 🪙 ${fmt(price)}${
        t.escalates?` (×${(1+(+cfg.insiderStep||0)).toFixed(2)} per one bought since the last unlock)`:""},
      and one of the ${Math.round((deckBoxes.find(d=>d.key===t.key)||{weight:0}).weight)}%
      of packs the Premiere hands over that come out this tier.</p>`;
    const tb=document.createElement("table"); tb.className="ttable";
    tb.innerHTML=`<tr><th>Drop</th><th>Weight</th><th>%</th><th>Amount</th></tr>`;
    t.table.forEach((r,i)=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${r.name}</td>
        <td><input data-bt="${ti}" data-bi="${i}" data-f="weight" value="${r.weight}"></td>
        <td class="tpct">${(r.weight/total*100).toFixed(1)}%</td>
        <td>${r.amount!=null?`<input data-bt="${ti}" data-bi="${i}" data-f="amount" value="${r.amount}">`:"—"}</td>`;
      tb.appendChild(tr);
    });
    wrap.appendChild(tb); body.appendChild(wrap);
  });
  /* Which tier a deck tile hands over. Its own table, because it is a different question from
     what is inside one. */
  const dwrap=document.createElement("div"); dwrap.className="tgroup";
  dwrap.innerHTML=`<h4>Deck tile · which box</h4>
    <p class="hint" style="margin:0 0 8px">Landing on a 🎁 tile hands over one box. Mostly Silver,
    so the paid tiers stay worth paying for.</p>`;
  const dt=document.createElement("table"); dt.className="ttable";
  dt.innerHTML=`<tr><th>Tier</th><th>Weight</th></tr>`;
  deckBoxes.forEach((d,i)=>{ const tr=document.createElement("tr");
    tr.innerHTML=`<td>${(Boxes.tier(d.key)||{name:d.key}).name}</td>
      <td><input data-db="${i}" data-f="weight" value="${d.weight}"></td>`;
    dt.appendChild(tr); });
  dwrap.appendChild(dt); body.appendChild(dwrap);
  /* The collection, checked. A mis-authored board is the one failure invisible in play, so the
     drawer prints what Collection.validate() found rather than leaving it to the console. */
  const cwrap=document.createElement("div"); cwrap.className="tgroup";
  const bad=Collection.validate().concat(Cards.validate());
  cwrap.innerHTML=`<h4>Set ${Collection.num()} · ${Collection.boardFor(Collection.num()).name}</h4>
    <p class="hint" style="margin:0 0 8px">
      ${Collection.pages().length} episodes · <b>${Cards.owned()}</b>/<b>${Cards.poolSize()}</b>
      cards held, <b>${Cards.convertedCount()}</b> converted ·
      <b>${Cards.completedSets().length}</b>/${Cards.sets().length} sets done.</p>
    ${bad.length
      ? `<p class="hint" style="color:var(--pink);margin:0"><b>${bad.length} problem${bad.length>1?"s":""}:</b></p>
         <ul style="margin:6px 0 0 16px;padding:0;font-size:12px;color:var(--muted)">
           ${bad.map(x=>`<li>${x}</li>`).join("")}</ul>`
      : `<p class="hint" style="color:var(--teal);margin:0">✓ Every card is wanted exactly once.</p>`}`;
  body.appendChild(cwrap);
  /* The board and the pools, checked the same way and for the same reason. The two draw rates
     are printed because a weight means nothing without its total: a 52% clue pool on six of
     forty tiles is a 10% clue rate per roll, and it is the second number anyone tuning pacing
     needs (GDD 6.6). */
  const pwrap=document.createElement("div"); pwrap.className="tgroup";
  const pbad=validateBoard().concat(Pools.validate()).concat(Clues.validate());
  const rolls=40, per=k=>(Pools.boardShareOf(k)*rolls).toFixed(1);
  pwrap.innerHTML=`<h4>Board · ${boardSeason().name}</h4>
    <p class="hint" style="margin:0 0 8px">
      ${boardSize()} tiles ·
      ${Object.keys(TILE_POOLS).map(t=>`${tilesOfType(t).length} ${t}`).join(" · ")} ·
      4 corners</p>
    <p class="hint" style="margin:0 0 8px">Per 40 rolls: <b>${per("card")}</b> cards ·
      <b>${per("clue")}</b> clues · <b>${(Pools.boardShareOf("money")*100).toFixed(0)}%</b> of
      landings pay money. An episode costs <b>${Clues.baseRequired()}</b> of the
      ${Clues.authoredFor(Episodes.ids()[0]).length} clues it authors, so roughly
      <b>${(Clues.expectedDraws()).toFixed(1)}</b> clue draws.</p>
    ${pbad.length
      ? `<p class="hint" style="color:var(--pink);margin:0"><b>${pbad.length} problem${pbad.length>1?"s":""}:</b></p>
         <ul style="margin:6px 0 0 16px;padding:0;font-size:12px;color:var(--muted)">
           ${pbad.map(x=>`<li>${x}</li>`).join("")}</ul>`
      : `<p class="hint" style="color:var(--teal);margin:0">✓ Every tile has somewhere to draw from.</p>`}`;
  body.appendChild(pwrap);
  // the loaded economy model: provenance, its cost curve, its series, and the import button
  buildEconomyPanel(body);
  // resets — config and player progress are separate storage slots, reset independently
  const zone=document.createElement("div"); zone.className="tgroup";
  zone.innerHTML=`<h4>Saved data</h4>
    <p class="hint" style="margin:0 0 8px">${storageOK
      ? "Tuning values and your run are saved in this browser automatically."
      : "⚠ Browser storage unavailable — nothing will persist between reloads."}</p>`;
  const rb=document.createElement("button"); rb.className="resetB"; rb.textContent="↺ Reset config to defaults";
  rb.onclick=resetDefaults; zone.appendChild(rb);
  const ru=document.createElement("button"); ru.className="resetB danger"; ru.textContent="🗑 Reset user progress";
  ru.onclick=()=>armUserReset(ru); zone.appendChild(ru);
  body.appendChild(zone);

  // live bindings
  /* Pickers hold strings, so they bind separately — the numeric path parseFloats and would
     reject every value a picker can produce. */
  body.querySelectorAll("select[data-key]").forEach(sel=>sel.onchange=(e)=>{
    cfg[e.target.dataset.key]=e.target.value;
    onCfgChange();
  });
  body.querySelectorAll("input[data-key]").forEach(inp=>inp.oninput=(e)=>{
    const key=e.target.dataset.key; let v=parseFloat(e.target.value); if(isNaN(v))return;
    /* The two that shape a board have to stay whole numbers — half an episode is not a thing,
       and Collection derives the pool from them. Nothing needs reshaping afterwards: the pool,
       the pages and the unlocks are all derived, so the next read is already correct. */
    if(["episodesPerBoard","collectiblesPerEpisode"].includes(key)){ v=Math.max(1,Math.round(v)); cfg[key]=v; }
    else cfg[key]=v;
    const out=body.querySelector(`output[data-out="${key}"]`); if(out) out.textContent=v;
    onCfgChange();
  });
  body.querySelectorAll("input[data-bt]").forEach(inp=>inp.oninput=(e)=>{
    const t=+e.target.dataset.bt,i=+e.target.dataset.bi,f=e.target.dataset.f;
    let v=parseFloat(e.target.value); if(isNaN(v))return;
    boxTiers[t].table[i][f]=v; onCfgChange(); });
  body.querySelectorAll("input[data-db]").forEach(inp=>inp.oninput=(e)=>{
    const i=+e.target.dataset.db,f=e.target.dataset.f;
    let v=parseFloat(e.target.value); if(isNaN(v))return;
    deckBoxes[i][f]=v; onCfgChange(); });
}
function syncTuningInputs(){
  document.querySelectorAll("#tuningBody input[data-key]").forEach(inp=>{ inp.value=cfg[inp.dataset.key]; });
  document.querySelectorAll("#tuningBody select[data-key]").forEach(sel=>{ sel.value=cfg[sel.dataset.key]; });
}
function onCfgChange(){ // recompute per-tile labels + energy cap clamp + token speed
  /* Nothing prints a value today — a pooled tile draws, so a number on it would be a lie
     (js/tiles/pool-tile.js). The refresh stays because valueLabel() is still the registry's
     way for a tile type to say something about itself, and a future one may. */
  document.querySelectorAll("#board .tile .val").forEach(el=>{
    const i=+el.closest(".tile").dataset.i; el.textContent=TILE_TYPES[tileType(i)].valueLabel(i); });
  // the 3D board keeps its labels in a DOM layer over the canvas
  document.querySelectorAll("#boardLabels .blabel").forEach(el=>{
    const i=+el.dataset.i; const v=el.querySelector(".val");
    if(v) v.textContent=TILE_TYPES[tileType(i)].valueLabel(i); });
  // note: energy is NOT clamped to a lowered cap — store purchases may exceed it
  applyFxTiming();
  // the environment reads cfg live: env3d toggles it, envMargin re-frames the camera
  if(window.Board3D&&Board3D.available&&Board3D.applyEnv) Board3D.applyEnv();
  scheduleSaveConfig();
  renderAll();
}
/* Reset config only — player progress (coins, cards, day) is untouched.
   "Defaults" means the LOADED ECONOMY, not the values hardcoded in config.js: the model is
   what the game is meant to be balanced to, so an imported workbook survives this button and
   only hand edits are discarded. Economy.apply() runs after DEFAULTS so it wins on the keys
   it owns, while camera and presentation settings fall back to the code's defaults. */
function resetDefaults(){ cfg=Object.assign({},DEFAULTS);
  deck=JSON.parse(JSON.stringify(defDeck)); boxTable=JSON.parse(JSON.stringify(defBox));
  boxTiers=JSON.parse(JSON.stringify(defBoxTiers)); deckBoxes=JSON.parse(JSON.stringify(defDeckBoxes));
  clearConfig();
  Economy.apply();
  buildTuning(); buildBoard(); onCfgChange(); toast("↺ Config reset to the loaded economy"); }

/* Reset user only — tuning values stay as they are. Two clicks to confirm. */
let _armed=null;
function armUserReset(btn){
  if(_armed===btn){ clearTimeout(_armed._t); _armed=null; return resetUser(); }
  _armed=btn; btn.textContent="⚠ Click again to wipe progress";
  btn._t=setTimeout(()=>{ _armed=null; btn.textContent="🗑 Reset user progress"; },6000);
}
function resetUser(){
  clearState(); initState();
  $("#scrim").classList.remove("show"); $("#scrim").innerHTML="";
  $("#log").innerHTML="";
  buildTuning(); buildBoard(); syncMultButton(); renderAll();
  log("🗑","<b>Progress reset</b> — new run, Day 1.");
  toast("🗑 User progress reset"); }
