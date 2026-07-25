"use strict";
/* Tuning drawer — builds inputs from the TUNING schema + deck/box tables, binds live edits. */
function buildTuning(){
  const body=$("#tuningBody"); body.innerHTML="";
  TUNING.forEach(g=>{
    const wrap=document.createElement("div"); wrap.className="tgroup";
    wrap.innerHTML=`<h4>${g.group}</h4>`;
    g.items.forEach(([key,label,step])=>{
      const row=document.createElement("div"); row.className="trow";
      row.innerHTML=`<label>${label}</label><input type="number" step="${step}" data-key="${key}" value="${cfg[key]}">`;
      wrap.appendChild(row);
    });
    body.appendChild(wrap);
  });
  // deck table
  const dwrap=document.createElement("div"); dwrap.className="tgroup";
  dwrap.innerHTML=`<h4>Merged deck (Chance + Chest)</h4>`;
  const dt=document.createElement("table"); dt.className="ttable";
  dt.innerHTML=`<tr><th>Card</th><th>Wt</th><th>Coins</th><th>⚡</th><th>🔍</th><th>VIP</th></tr>`;
  deck.forEach((c,i)=>{ const tr=document.createElement("tr");
    tr.innerHTML=`<td>${c.name}</td>
      <td><input data-d="${i}" data-f="weight" value="${c.weight}"></td>
      <td><input data-d="${i}" data-f="coins" value="${c.coins}"></td>
      <td><input data-d="${i}" data-f="energy" value="${c.energy}"></td>
      <td><input data-d="${i}" data-f="clues" value="${c.clues}"></td>
      <td><input data-d="${i}" data-f="vip" value="${c.vip}"></td>`;
    dt.appendChild(tr); });
  dwrap.appendChild(dt); body.appendChild(dwrap);
  // box table
  const bwrap=document.createElement("div"); bwrap.className="tgroup";
  bwrap.innerHTML=`<h4>Mystery Box drop table</h4>`;
  const bt=document.createElement("table"); bt.className="ttable";
  bt.innerHTML=`<tr><th>Drop</th><th>Weight</th><th>Amount</th></tr>`;
  boxTable.forEach((c,i)=>{ const tr=document.createElement("tr");
    tr.innerHTML=`<td>${c.name}</td>
      <td><input data-b="${i}" data-f="weight" value="${c.weight}"></td>
      <td><input data-b="${i}" data-f="amount" value="${c.amount}"></td>`;
    bt.appendChild(tr); });
  bwrap.appendChild(bt); body.appendChild(bwrap);
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
  body.querySelectorAll("input[data-key]").forEach(inp=>inp.oninput=(e)=>{
    const key=e.target.dataset.key; let v=parseFloat(e.target.value); if(isNaN(v))return;
    if(["buildings","tiers"].includes(key)){ v=Math.max(1,Math.round(v)); cfg[key]=v; rebuildBuilder(); }
    else cfg[key]=v;
    onCfgChange();
  });
  body.querySelectorAll("input[data-d]").forEach(inp=>inp.oninput=(e)=>{
    const i=+e.target.dataset.d,f=e.target.dataset.f; let v=parseFloat(e.target.value); if(isNaN(v))return;
    deck[i][f]=v; onCfgChange(); });
  body.querySelectorAll("input[data-b]").forEach(inp=>inp.oninput=(e)=>{
    const i=+e.target.dataset.b,f=e.target.dataset.f; let v=parseFloat(e.target.value); if(isNaN(v))return;
    boxTable[i][f]=v; onCfgChange(); });
}
function syncTuningInputs(){ document.querySelectorAll("#tuningBody input[data-key]").forEach(inp=>{ inp.value=cfg[inp.dataset.key]; }); }
function onCfgChange(){ // recompute per-tile labels (stdBase) + energy cap clamp + token speed
  document.querySelectorAll(".tile.standard .val").forEach(el=>{
    const i=+el.closest(".tile").dataset.i; el.textContent=TILE_TYPES.standard.valueLabel(i); });
  state.energy=Math.min(state.energy,cfg.energyCap);
  applyFxTiming();
  scheduleSaveConfig();
  renderAll();
}
/* Reset config only — player progress (coins, builders, day) is untouched. */
function resetDefaults(){ cfg=Object.assign({},DEFAULTS);
  deck=JSON.parse(JSON.stringify(defDeck)); boxTable=JSON.parse(JSON.stringify(defBox));
  clearConfig();
  rebuildBuilder(); buildTuning(); buildBoard(); onCfgChange(); toast("↺ Config reset to defaults"); }

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
  buildTuning(); buildBoard(); syncMultButtons(); renderAll();
  log("🗑","<b>Progress reset</b> — new run, Day 1.");
  toast("🗑 User progress reset"); }
