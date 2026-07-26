"use strict";
/* Store — instant top-ups, opened from the button on the board's top-right.
   Energy packs deliberately exceed cfg.energyCap: overflow is legitimate and nothing
   may clamp energy downward (see CLAUDE.md). */
const STORE_PACKS={ coins:[10000,100000,1000000], energy:[100,1000,10000] };

function openStore(){
  if(state.animating||autoMode!==null) return;   // would fight the roll's own overlays
  const packs=(kind,amounts,icon)=>amounts.map(a=>
    `<button class="pack" data-kind="${kind}" data-amt="${a}">
       <span class="pkIco">${icon}</span><span class="pkAmt">${fmt(a)}</span></button>`).join("");
  $("#scrim").innerHTML=`<div class="modal storeModal">
    <div class="top"><div class="eyebrow">Store</div><h2>Top up your run</h2></div>
    <div class="mbody">
      <div class="pkGroup">🪙 Coins</div>
      <div class="packs">${packs("coins",STORE_PACKS.coins,"🪙")}</div>
      <div class="pkGroup">⚡ Energy</div>
      <div class="packs">${packs("energy",STORE_PACKS.energy,"⚡")}</div>
      <div class="hint" style="margin-top:12px;text-align:center">Buy as many as you like — energy can go past the ${cfg.energyCap}⚡ cap.</div>
      <button class="btn purple wide" id="closeStore" style="margin-top:12px">Done</button>
    </div></div>`;
  $("#scrim").classList.add("show");
  $("#scrim").querySelectorAll(".pack").forEach(b=>b.onclick=()=>{
    const amt=+b.dataset.amt;
    if(b.dataset.kind==="coins"){
      state.coins+=amt; toast(`🪙 <b>+${fmt(amt)}</b> coins`); log("🛒",`Store · +<b>${fmt(amt)}</b> coins`);
    }else{
      state.energy+=amt; toast(`⚡ <b>+${fmt(amt)}</b> energy`); log("🛒",`Store · +<b>${fmt(amt)}</b> energy`);
    }
    renderAll();
  });
  $("#closeStore").onclick=()=>{ $("#scrim").classList.remove("show"); $("#scrim").innerHTML=""; renderAll(); };
}
