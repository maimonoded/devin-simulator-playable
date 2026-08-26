"use strict";
/* Store — where the loop is paid to go faster.

   Three things on sale, and the first is the point of it:

     BOXES.   The three tiers from js/config.js, each with its own drop table. A box bought
              here is exactly a box landed on: both go through openBoxEvents(), so the odds,
              the episode unlock and the board-complete check cannot drift apart between the
              two. Buying opens it immediately, like everything else.
     COINS.   Instant grants, unchanged.
     ENERGY.  Instant grants, and deliberately far larger than cfg.energyCap — overflow is
              legitimate and nothing may clamp energy downward (see CLAUDE.md).

   TWO PRICES ON EVERYTHING. A dollar price, which is the simulated storefront, and — for the
   boxes — a coin price, which is what play buys. That is the brief: everything is purchasable
   and everything is reachable by playing. The dollar prices are labels; nothing is charged and
   there is no payment path, because this is an economy simulator and the money side of it is
   what is being modelled, not transacted. */

const STORE_PACKS={
  coins:[{amt:10000,usd:0.99},{amt:100000,usd:4.99},{amt:1000000,usd:19.99}],
  energy:[{amt:100,usd:0.99},{amt:1000,usd:4.99},{amt:10000,usd:19.99}],
};

function openStore(){
  if(state.animating||autoMode!==null) return;   // would fight the roll's own overlays
  renderStore();
}

function renderStore(){
  const packs=(kind,list,icon)=>list.map(p=>
    `<button class="pack" data-kind="${kind}" data-amt="${p.amt}">
       <span class="pkIco">${icon}</span><span class="pkAmt">${fmt(p.amt)}</span>
       <span class="pkUsd">$${p.usd.toFixed(2)}</span></button>`).join("");

  const boxes=Boxes.tiers().map(t=>{
    const canCoins=t.coins>0&&state.coins>=t.coins;
    return `<div class="boxCard tier-${t.key}">
        <img class="boxArt" src="${t.art}" alt="">
        <div class="boxName">${t.name}</div>
        <div class="boxItems">${t.items} card${t.items>1?"s":""}</div>
        <div class="boxOdds">${boxOddsHtml(t)}</div>
        <div class="boxBuys">
          <button class="btn pink boxBuy" data-usd="${t.key}">$${t.usd.toFixed(2)}</button>
          ${t.coins>0?`<button class="btn ghost boxBuy${canCoins?"":" cant"}" data-coins="${t.key}"
             ${canCoins?"":"disabled"}>🪙 ${fmtShort(t.coins)}</button>`:""}
        </div>
      </div>`;
  }).join("");

  $("#scrim").innerHTML=`<div class="modal storeModal">
    <div class="top"><div class="eyebrow">Store</div><h2>Top up your run</h2></div>
    <div class="mbody">
      <div class="pkGroup">🎁 Boxes <span class="pkNote">opened the moment you buy them</span></div>
      <div class="boxRow">${boxes}</div>
      <div class="pkGroup">🪙 Coins</div>
      <div class="packs">${packs("coins",STORE_PACKS.coins,"🪙")}</div>
      <div class="pkGroup">⚡ Energy</div>
      <div class="packs">${packs("energy",STORE_PACKS.energy,"⚡")}</div>
      <div class="hint" style="margin-top:12px;text-align:center">Energy can go past the ${cfg.energyCap}⚡ cap.
        Dollar prices are labels — nothing is charged.</div>
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
    renderStore(); renderAll();
  });
  $("#scrim").querySelectorAll(".boxBuy").forEach(b=>b.onclick=()=>buyBox(b.dataset.usd||b.dataset.coins,!!b.dataset.coins));
  $("#closeStore").onclick=closeStore;
}
function closeStore(){ $("#scrim").classList.remove("show"); $("#scrim").innerHTML=""; renderAll(); }

/* Buy a box and open it on the spot.

   The store modal is dismissed FIRST and put back afterwards: the pack popup mounts inside the
   board scene and the store's scrim covers the whole viewport, so leaving it up would open the
   box behind a dimmed sheet. Coming back to the store afterwards is what makes buying two in a
   row bearable. */
async function buyBox(key,withCoins){
  const t=Boxes.tier(key);
  if(!t||state.animating) return;
  if(withCoins){
    if(!(t.coins>0&&state.coins>=t.coins)) return;
    state.coins-=t.coins;
    log("🛒",`Store · <b>${t.name}</b> for ${fmt(t.coins)} coins`);
  }else{
    log("🛒",`Store · <b>${t.name}</b> ($${t.usd.toFixed(2)})`);
  }
  closeStore();
  /* Same flag the roll loop uses, so Roll and the store cannot both drive a popup at once. */
  state.animating=true; renderAll();
  try{ await playEvents(openBoxEvents(key)); }
  finally{ state.animating=false; renderAll(); }
  await afterCollect();
  renderStore();
}

/* The odds this tier pays, as the player would ask them: what are my chances of a good card.
   Rows are collapsed to the four that matter — the three card tiers and clues — because a
   seven-row table on a phone is not information, it is a wall. */
function boxOddsHtml(t){
  const total=t.table.reduce((a,r)=>a+r.weight,0)||1;
  const pct=(f)=>Math.round(t.table.filter(f).reduce((a,r)=>a+r.weight,0)/total*100);
  const rows=[
    ["💎",pct(r=>r.kind==="card"&&r.tier==="diamond")],
    ["🥇",pct(r=>r.kind==="card"&&r.tier==="gold")],
    ["🥈",pct(r=>r.kind==="card"&&r.tier==="silver")],
    ["🔍",pct(r=>r.kind==="clue")],
  ];
  return rows.map(([ic,p])=>`<span class="oddsRow">${ic} ${p}%</span>`).join("");
}
