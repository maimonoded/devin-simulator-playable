"use strict";
/* Tuning drawer — builds inputs from the TUNING schema + deck/box tables, and binds live edits.
   Also owns the HUD's debug button and its panel, at the bottom of this file. */
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
  // deck table
  const dwrap=document.createElement("div"); dwrap.className="tgroup";
  /* Two columns do not mean what a number in them looks like it means, so the hint spells them
     out: ⚡ 1 would otherwise read as "one energy" when it means "pay 1…mult", and a bonus card's
     Coins is 0 because the economy prices that payout. Bonus itself is shown, not edited — it is
     a MINIGAMES key, and the binding below parseFloats every input it finds. */
  dwrap.innerHTML=`<h4>Deck · drawn on the four bonus tiles</h4>
    <p class="hint" style="margin:0 0 8px">Weights are out of the table's total, which ships at
    100 — so a weight is a percentage of draws. <b>⚡</b> is a flag, not an amount: an energy card
    pays a random 1…roll multiplier. <b>🎁</b> is how many story items to grant, drawn from the
    series being unlocked. A <b>Bonus</b> row opens that mini-game and pays the economy's train
    pair (Tile values), not its Coins column.</p>`;
  const dt=document.createElement("table"); dt.className="ttable";
  dt.innerHTML=`<tr><th>Card</th><th>Wt</th><th>Coins</th><th>⚡</th><th>VIP</th><th>🎁</th><th>Bonus</th></tr>`;
  deck.forEach((c,i)=>{ const tr=document.createElement("tr");
    tr.innerHTML=`<td>${c.name}</td>
      <td><input data-d="${i}" data-f="weight" value="${c.weight}"></td>
      <td><input data-d="${i}" data-f="coins" value="${c.coins}"></td>
      <td><input data-d="${i}" data-f="energy" value="${c.energy}"></td>
      <td><input data-d="${i}" data-f="vip" value="${c.vip}"></td>
      <td><input data-d="${i}" data-f="items" value="${c.items||0}"></td>
      <td>${c.game||"—"}</td>`;
    dt.appendChild(tr); });
  dwrap.appendChild(dt); body.appendChild(dwrap);
  // box table
  const bwrap=document.createElement("div"); bwrap.className="tgroup";
  const bt=document.createElement("table"); bt.className="ttable";
  bwrap.innerHTML=`<h4>Mystery Box · item 2 of 2</h4>
    <p class="hint" style="margin:0 0 8px">Item 1 is always coins (Tile values → Mystery box).
    This table is the second draw. It had a third row, clues, until the album was removed —
    the two left renormalise, so these weights are an even split whatever they add up to.</p>`;
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
    /* Every numeric row is now a plain assignment. `buildings` and `tiers` used to be special-
       cased here — rounded up to a whole number and then handed to Builders.reshape() — but both
       rows went with the builders, and the two keys are written by Economy.apply() alone. */
    const key=e.target.dataset.key; let v=parseFloat(e.target.value); if(isNaN(v))return;
    cfg[key]=v;
    const out=body.querySelector(`output[data-out="${key}"]`); if(out) out.textContent=v;
    onCfgChange();
  });
  body.querySelectorAll("input[data-d]").forEach(inp=>inp.oninput=(e)=>{
    const i=+e.target.dataset.d,f=e.target.dataset.f; let v=parseFloat(e.target.value); if(isNaN(v))return;
    deck[i][f]=v; onCfgChange(); });
  body.querySelectorAll("input[data-b]").forEach(inp=>inp.oninput=(e)=>{
    const i=+e.target.dataset.b,f=e.target.dataset.f; let v=parseFloat(e.target.value); if(isNaN(v))return;
    boxTable[i][f]=v; onCfgChange(); });
}
function syncTuningInputs(){
  document.querySelectorAll("#tuningBody input[data-key]").forEach(inp=>{ inp.value=cfg[inp.dataset.key]; });
  document.querySelectorAll("#tuningBody select[data-key]").forEach(sel=>{ sel.value=cfg[sel.dataset.key]; });
}
function onCfgChange(){ // recompute per-tile labels (stdBase) + energy cap clamp + token speed
  /* Every tile that prints a value, not just the standard ones — the two bills print their
     price too, and scoping this to .tile.standard left their labels stale after an edit while
     the 3D layer below updated correctly. Asking the registry for each tile's own label means
     a future tile that prints something is covered without touching this line again. */
  document.querySelectorAll(".tile .val").forEach(el=>{
    const i=+el.closest(".tile").dataset.i;
    el.textContent=TILE_TYPES[tileType(i)].valueLabel(i); });
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
/* Reset config only — player progress (coins, energy, the day) is untouched.
   "Defaults" means the LOADED ECONOMY, not the values hardcoded in config.js: the model is
   what the game is meant to be balanced to, so an imported workbook survives this button and
   only hand edits are discarded. Economy.apply() runs after DEFAULTS so it wins on the keys
   it owns, while camera and presentation settings fall back to the code's defaults. */
function resetDefaults(){ cfg=Object.assign({},DEFAULTS);
  deck=JSON.parse(JSON.stringify(defDeck)); boxTable=JSON.parse(JSON.stringify(defBox));
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
