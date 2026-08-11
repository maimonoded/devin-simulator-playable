"use strict";
/* Tuning drawer — builds inputs from the TUNING schema + the Plot Twist / box tables,
   binds live edits. */
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
  // Plot Twist table — the six board tiles, NOT the deck the player pulls from
  const dwrap=document.createElement("div"); dwrap.className="tgroup";
  dwrap.innerHTML=`<h4>Plot Twist cards (the six board tiles)</h4>`;
  const dt=document.createElement("table"); dt.className="ttable";
  /* The header and the data-f field move together — the binding at the bottom of this function
     writes by field name, so a column relabelled without repointing its input edits the wrong
     property and the change silently does nothing. */
  dt.innerHTML=`<tr><th>Card</th><th>Wt</th><th>Coins</th><th>🎟</th><th>🔍</th><th>VIP</th></tr>`;
  twistDeck.forEach((c,i)=>{ const tr=document.createElement("tr");
    tr.innerHTML=`<td>${c.name}</td>
      <td><input data-d="${i}" data-f="weight" value="${c.weight}"></td>
      <td><input data-d="${i}" data-f="coins" value="${c.coins}"></td>
      <td><input data-d="${i}" data-f="tickets" value="${c.tickets}"></td>
      <td><input data-d="${i}" data-f="clues" value="${c.clues}"></td>
      <td><input data-d="${i}" data-f="vip" value="${c.vip}"></td>`;
    dt.appendChild(tr); });
  dwrap.appendChild(dt); body.appendChild(dwrap);
  // box table
  const bwrap=document.createElement("div"); bwrap.className="tgroup";
  const bt=document.createElement("table"); bt.className="ttable";
  bwrap.innerHTML=`<h4>Mystery Box · item 2 of 2</h4>
    <p class="hint" style="margin:0 0 8px">Item 1 is always coins (set above). This table is the
    second draw — and the game's only source of clues.</p>`;
  bt.innerHTML=`<tr><th>Drop</th><th>Weight</th><th>Amount</th></tr>`;
  boxTable.forEach((c,i)=>{ const tr=document.createElement("tr");
    tr.innerHTML=`<td>${c.name}</td>
      <td><input data-b="${i}" data-f="weight" value="${c.weight}"></td>
      <td><input data-b="${i}" data-f="amount" value="${c.amount}"></td>`;
    bt.appendChild(tr); });
  bwrap.appendChild(bt); body.appendChild(bwrap);
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
    /* parseFloat above accepts 2.5 — these keys are counts, and a fractional one flows straight
       into the ticket arithmetic. Round them, then re-shape the run to the new size. */
    if(["episodesInSeries","ticketsPerEpisode","episodeRowSize"].includes(key)){
      v=Math.max(1,Math.round(v)); cfg[key]=v; Tickets.reshape(); }
    else cfg[key]=v;
    const out=body.querySelector(`output[data-out="${key}"]`); if(out) out.textContent=v;
    onCfgChange();
  });
  body.querySelectorAll("input[data-d]").forEach(inp=>inp.oninput=(e)=>{
    const i=+e.target.dataset.d,f=e.target.dataset.f; let v=parseFloat(e.target.value); if(isNaN(v))return;
    twistDeck[i][f]=v; onCfgChange(); });
  body.querySelectorAll("input[data-b]").forEach(inp=>inp.oninput=(e)=>{
    const i=+e.target.dataset.b,f=e.target.dataset.f; let v=parseFloat(e.target.value); if(isNaN(v))return;
    boxTable[i][f]=v; onCfgChange(); });
}
function syncTuningInputs(){
  document.querySelectorAll("#tuningBody input[data-key]").forEach(inp=>{ inp.value=cfg[inp.dataset.key]; });
  document.querySelectorAll("#tuningBody select[data-key]").forEach(sel=>{ sel.value=cfg[sel.dataset.key]; });
}
function onCfgChange(){ // recompute per-tile labels (stdBase) + token speed
  document.querySelectorAll(".tile.standard .val").forEach(el=>{
    const i=+el.closest(".tile").dataset.i; el.textContent=TILE_TYPES.standard.valueLabel(i); });
  // the 3D board keeps its labels in a DOM layer over the canvas
  document.querySelectorAll("#boardLabels .blabel").forEach(el=>{
    const i=+el.dataset.i; const v=el.querySelector(".val");
    if(v) v.textContent=TILE_TYPES[tileType(i)].valueLabel(i); });
  /* note: the shoe is NOT trimmed to a lowered packSize. A bought pack merges onto whatever was
     left, so a shoe over the cap is the ordinary state of affairs — clamping here would delete
     cards the player paid for. This "do nothing" is one of the four enforcement sites of that
     rule; the others are BoardActor.gainCards, the advanceSession regen, and loadState. */
  applyFxTiming();
  // the environment reads cfg live: env3d toggles it, envMargin re-frames the camera
  if(window.Board3D&&Board3D.available&&Board3D.applyEnv) Board3D.applyEnv();
  scheduleSaveConfig();
  renderAll();
}
/* Reset config only — player progress (coins, builders, day) is untouched.
   "Defaults" means the LOADED ECONOMY, not the values hardcoded in config.js: the model is
   what the game is meant to be balanced to, so an imported workbook survives this button and
   only hand edits are discarded. Economy.apply() runs after DEFAULTS so it wins on the keys
   it owns, while camera and presentation settings fall back to the code's defaults. */
function resetDefaults(){ cfg=Object.assign({},DEFAULTS);
  twistDeck=JSON.parse(JSON.stringify(defTwistDeck)); boxTable=JSON.parse(JSON.stringify(defBox));
  clearConfig();
  Economy.apply();
  Tickets.reshape(); buildTuning(); buildBoard(); onCfgChange(); toast("↺ Config reset to the loaded economy"); }

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
  buildTuning(); buildBoard(); renderAll();
  log("🗑","<b>Progress reset</b> — new run, Day 1.");
  toast("🗑 User progress reset"); }
