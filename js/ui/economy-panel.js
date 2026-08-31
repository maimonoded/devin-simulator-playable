"use strict";
/* The Economy panel in the tuning drawer: what model is loaded, what its curve looks like,
   and the button that swaps it for a new workbook.

   Importing is deliberately all-or-nothing. js/economy-import.js checks the whole workbook
   first and returns every problem it found; nothing is installed unless that list is empty.
   A half-applied economy would be far worse than a refused one — the numbers would be a
   silent mix of two models and no one would know which. */

/* Draw the panel into the drawer body. Called by buildTuning(). */
function buildEconomyPanel(body){
  const e=Economy.model();
  const wrap=document.createElement("div"); wrap.className="tgroup";
  wrap.innerHTML=`<h4>Economy model</h4>
    <p class="hint" style="margin:0 0 8px">
      <b style="color:var(--gold)">${e.version}</b><br>
      ${e.filename
        ? `from <b>${e.filename}</b>${e.loadedAt?` · loaded ${new Date(e.loadedAt).toLocaleString()}`:""}`
        : "built in — no workbook has been imported yet"}
    </p>`;

  /* Cost curve, read-only: it is segmented data, not a scalar, so the number-box rows the
     drawer builds from TUNING cannot represent it. */
  const ct=document.createElement("table"); ct.className="ttable";
  ct.innerHTML=`<tr><th>Builders</th><th>Rule</th><th>Lvl 1 cost</th><th>Lvl ${cfg.tiers} cost</th></tr>`;
  e.costCurve.forEach(seg=>{
    const from=seg.from||1;
    const span=seg.to==null?`${from} →`:`${from}–${seg.to}`;
    const rule=seg.kind==="explicit"
      ? `explicit table (${(seg.levels||[]).length} rows)`
      : `${Math.round(seg.base)} × ${seg.levelGrowth}<sup>L−1</sup> × b<sup>${seg.exponent.toFixed(4)}</sup>`;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${span}${seg.to==null?' <span class="hint">(open-ended)</span>':""}</td><td>${rule}</td>
      <td>${fmt(Math.round(Economy.costFor(from,1)))}</td>
      <td>${fmt(Math.round(Economy.costFor(from,cfg.tiers)))}</td>`;
    ct.appendChild(tr);
  });
  wrap.appendChild(ct);
  const anchors=e.costCurve[0]&&e.costCurve[0].anchors;
  if(anchors) wrap.insertAdjacentHTML("beforeend",
    `<p class="hint" style="margin:6px 0 0">Exponent solved from the pacing anchors:
     ${anchors.episodesSeries1} episodes in ${anchors.daysSeries1} days,
     ${anchors.totalEpisodes} in ${anchors.totalDays}.</p>`);

  /* Series: what the model asks for vs what the episode library can actually supply. */
  const shape=Economy.seriesShape();
  const st=document.createElement("table"); st.className="ttable";
  st.innerHTML=`<tr><th>Series</th><th>Builders</th><th>Global #</th><th></th></tr>`;
  shape.forEach(s=>{
    const cur=s.index===state.series;
    const short=s.builders<s.declared;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${s.name}${cur?' <b style="color:var(--gold)">◀ here</b>':""}</td>
      <td>${s.builders}${short?` <span class="hint">of ${s.declared}</span>`:""}</td>
      <td>${s.builders?`${s.from}–${s.to}`:"—"}</td>
      <td class="hint">${s.builders?"":"needs episodes"}</td>`;
    st.appendChild(tr);
  });
  wrap.appendChild(st);
  wrap.insertAdjacentHTML("beforeend",
    `<p class="hint" style="margin:6px 0 0">A series can only be as long as the episodes left
     for it — ${Episodes.count()} exist. The rest stay locked until more content ships.</p>`);

  /* Import + reset */
  const msg=document.createElement("div"); msg.id="econMsg"; msg.style.margin="10px 0 0";
  const file=document.createElement("input");
  file.type="file"; file.accept=".xlsx"; file.id="econFile"; file.style.display="none";
  const load=document.createElement("button");
  load.className="resetB"; load.textContent="📄 Load economy from .xlsx";
  load.onclick=()=>file.click();
  file.onchange=()=>{ const f=file.files&&file.files[0]; file.value=""; if(f) importEconomyFile(f); };
  wrap.append(load,file);
  if(e.filename){
    const rst=document.createElement("button");
    rst.className="resetB"; rst.textContent="↺ Back to the built-in model";
    rst.onclick=()=>{ Economy.reset(); clearEconomy(); afterEconomyChange(); toast("↺ Built-in economy restored"); };
    wrap.appendChild(rst);
  }
  wrap.appendChild(msg);
  body.appendChild(wrap);
}

/* Read, validate, install. Any failure leaves the running economy exactly as it was. */
async function importEconomyFile(f){
  econMessage(`Reading <b>${f.name}</b>…`,"muted");
  let res;
  try{
    const wb=await Xlsx.read(await f.arrayBuffer());
    /* Only a previous IMPORT blocks a re-import. The built-in default carries the same version
       string as the workbook it was transcribed from, and refusing the very first load because
       of that would be nonsense — nothing has been imported yet. */
    res=EconomyImport.fromWorkbook(wb,f.name,Economy.isImported()?Economy.version():null);
  }catch(err){
    console.error("economy import failed:",err);
    return econMessage(`<b>Could not read ${f.name}</b><br>${err&&err.message?err.message:err}`,"bad");
  }
  if(!res.ok){
    /* Every problem at once. Fixing a spreadsheet one error per attempt is miserable. */
    return econMessage(
      `<b>${f.name} was not loaded — ${res.errors.length} problem${res.errors.length>1?"s":""}:</b>
       <ul style="margin:6px 0 0 16px;padding:0">${res.errors.map(x=>`<li>${x}</li>`).join("")}</ul>`,"bad");
  }
  Economy.install(res.economy);
  /* A new model means a new series shape, so the run may be pointing past the end of it. */
  if(state.series>=Economy.playableSeries().length) state.series=0;
  Economy.apply();
  saveEconomy(); saveConfig();
  afterEconomyChange();
  const warn=res.warnings.length
    ? `<ul style="margin:6px 0 0 16px;padding:0">${res.warnings.map(x=>`<li>${x}</li>`).join("")}</ul>`:"";
  econMessage(`<b style="color:var(--teal)">Loaded ${res.version}</b><br>from ${f.name}${warn}`,"ok");
  log("📄",`Economy loaded · <b>${res.version}</b> (${f.name})`);
  toast(`📄 Economy loaded — <b>${res.version}</b>`);
}

/* Rebuild everything that reads the economy. buildTuning() redraws this panel too, so the
   message it just wrote has to be re-applied by the caller if it should survive. */
function afterEconomyChange(){
  const keep=$("#econMsg")?$("#econMsg").innerHTML:"";
  buildTuning(); buildBoard(); onCfgChange(); renderAll();
  if(keep&&$("#econMsg")) $("#econMsg").innerHTML=keep;
}

function econMessage(html,kind){
  const el=$("#econMsg"); if(!el) return;
  const color=kind==="bad"?"var(--pink)":kind==="ok"?"var(--teal)":"var(--muted)";
  el.innerHTML=`<div class="hint" style="color:${color};line-height:1.5">${html}</div>`;
}
