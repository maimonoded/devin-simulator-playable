"use strict";
/* Store — where the loop is paid to go faster.

   ---- GDD §8.4, and it is a standing constraint ----

   **REAL MONEY BUYS MONEY, AND ONLY MONEY BUYS PACKS.** The dollar prices in here are on coins
   and on nothing else; packs and energy are bought with coins. That is not a preference — a paid
   loot box sitting beside a wagering mechanic draws regulatory attention well beyond either
   alone, and the separation costs the design nothing, because coins still buy everything.

   The dollar prices are labels regardless: nothing is charged and there is no payment path. This
   is an economy simulator, and the money side of it is what is being modelled, not transacted.

   ---- three things on sale ----

     PACKS.   The three from js/config.js (§4.5), each with its own drop table. A pack bought
              here is exactly a pack landed on: both go through openBoxEvents(), so the odds, the
              episode unlock and the set-complete check cannot drift apart between the two.
              Buying opens it immediately, like everything else.
              The INSIDER's price climbs with every one bought since the last unlock (§6.5) and
              resets when an episode lands — which is what caps sprint speed by design.
     COINS.   Instant grants, and the only thing with a dollar price.
     ENERGY.  Instant grants, for coins, and deliberately far larger than cfg.energyCap —
              overflow is legitimate and nothing may clamp energy downward (see CLAUDE.md). */

const STORE_PACKS={
  /* The ONLY dollar prices in the game (§8.4). */
  coins:[{amt:10000,usd:0.99},{amt:100000,usd:4.99},{amt:1000000,usd:19.99}],
  /* Energy is bought with coins, like everything that is not money itself. */
  energy:[{amt:100,cost:3000},{amt:1000,cost:25000},{amt:10000,cost:200000}],
};

function openStore(){
  if(state.animating||autoMode!==null) return;   // would fight the roll's own overlays
  renderStore();
}

function renderStore(){
  const coinPacks=STORE_PACKS.coins.map(p=>
    `<button class="pack" data-kind="coins" data-amt="${p.amt}">
       <span class="pkIco">🪙</span><span class="pkAmt">${fmt(p.amt)}</span>
       <span class="pkUsd">$${p.usd.toFixed(2)}</span></button>`).join("");
  const energyPacks=STORE_PACKS.energy.map(p=>{
    const can=state.coins>=p.cost;
    return `<button class="pack${can?"":" cant"}" data-kind="energy" data-amt="${p.amt}"
       data-cost="${p.cost}" ${can?"":"disabled"}>
       <span class="pkIco">⚡</span><span class="pkAmt">${fmt(p.amt)}</span>
       <span class="pkUsd">🪙 ${fmtShort(p.cost)}</span></button>`;
  }).join("");

  const boxes=Boxes.tiers().map(t=>{
    const price=Boxes.priceOf(t.key);
    const can=Boxes.affordable(t.key);
    /* The Insider says WHY it costs what it costs. A price that climbs without explaining
       itself reads as a bug; one that says "because you have bought two" reads as a rule. */
    const note=t.clue==="fresh"
      ? `<div class="boxNote">+ a clue you don't have${
          state.insiderBought?` · ${state.insiderBought} bought since the last unlock`:""}</div>`
      : "";
    return `<div class="boxCard tier-${t.key}">
        <img class="boxArt" src="${t.art}" alt="">
        <div class="boxName">${t.name}</div>
        <div class="boxItems">${t.items} card${t.items>1?"s":""}</div>
        <div class="boxOdds">${boxOddsHtml(t)}</div>
        ${note}
        <div class="boxBuys">
          <button class="btn pink boxBuy${can?"":" cant"}" data-coins="${t.key}"
             ${can?"":"disabled"}>🪙 ${fmtShort(price)}</button>
        </div>
      </div>`;
  }).join("");

  $("#scrim").innerHTML=`<div class="modal storeModal">
    <div class="top"><div class="eyebrow">Store</div><h2>Top up your run</h2></div>
    <div class="mbody">
      <div class="pkGroup">🎁 Packs <span class="pkNote">opened the moment you buy them</span></div>
      <div class="boxRow">${boxes}</div>
      <div class="pkGroup">🪙 Coins</div>
      <div class="packs">${coinPacks}</div>
      <div class="pkGroup">⚡ Energy</div>
      <div class="packs">${energyPacks}</div>
      <div class="hint" style="margin-top:12px;text-align:center">Energy can go past the ${cfg.energyCap}⚡ cap.
        Coins are the only thing with a dollar price — and those are labels; nothing is charged.</div>
      <button class="btn purple wide" id="closeStore" style="margin-top:12px">Done</button>
    </div></div>`;
  $("#scrim").classList.add("show");

  $("#scrim").querySelectorAll(".pack").forEach(b=>b.onclick=()=>{
    const amt=+b.dataset.amt;
    if(b.dataset.kind==="coins"){
      state.coins+=amt; toast(`🪙 <b>+${fmt(amt)}</b> coins`); log("🛒",`Store · +<b>${fmt(amt)}</b> coins`);
    }else{
      const cost=+b.dataset.cost;
      if(state.coins<cost) return;
      state.coins-=cost;
      /* Straight assignment, not grantEnergy: a purchase is allowed to exceed the cap and this
         is the one place that is deliberate. See CLAUDE.md, "Energy may exceed the cap". */
      state.energy+=amt;
      toast(`⚡ <b>+${fmt(amt)}</b> energy`);
      log("🛒",`Store · +<b>${fmt(amt)}</b> energy for ${fmt(cost)} coins`);
    }
    renderStore(); renderAll();
  });
  $("#scrim").querySelectorAll(".boxBuy").forEach(b=>b.onclick=()=>buyBox(b.dataset.coins));
  $("#closeStore").onclick=closeStore;
}
function closeStore(){ $("#scrim").classList.remove("show"); $("#scrim").innerHTML=""; renderAll(); }

/* Buy a box and open it on the spot.

   The store modal is dismissed FIRST and put back afterwards: the pack popup mounts inside the
   board scene and the store's scrim covers the whole viewport, so leaving it up would open the
   box behind a dimmed sheet. Coming back to the store afterwards is what makes buying two in a
   row bearable. */
async function buyBox(key){
  const t=Boxes.tier(key);
  if(!t||state.animating) return;
  const price=Boxes.priceOf(key);
  /* Boxes.buyEvents spends AND opens: one place, so the store, a status milestone and any future
     source cannot disagree about what a pack costs or about the Insider's counter. */
  const ev=Boxes.buyEvents(key);
  if(!ev) return;
  log("🛒",`Store · <b>${t.name}</b> for ${fmt(price)} coins`);
  closeStore();
  /* Same flag the roll loop uses, so Roll and the store cannot both drive a popup at once. */
  state.animating=true; renderAll();
  try{ await playEvents(ev); }
  finally{ state.animating=false; renderAll(); }
  await afterCollect();
  renderStore();
}

/* The odds this pack pays, as the player would ask them: what are my chances of something good.
   Collapsed to four rows — the three rarity FLOORS and clues — because an eight-row table on a
   phone is not information, it is a wall.

   A floor is cumulative by definition (a "Rare or up" row can pay a Legendary), so the rows are
   read as "at least this", which is also how a player reads them. */
function boxOddsHtml(t){
  const total=t.table.reduce((a,r)=>a+r.weight,0)||1;
  const atLeast=(key)=>{
    const min=Cards.rarity(key).rank;
    return Math.round(t.table
      .filter(r=>r.kind==="card"&&Cards.rarity(r.floor||"common").rank>=min)
      .reduce((a,r)=>a+r.weight,0)/total*100);
  };
  const clue=Math.round(t.table.filter(r=>r.kind==="clue").reduce((a,r)=>a+r.weight,0)/total*100);
  const rows=[
    ["🟡",atLeast("legendary")],
    ["🟣",atLeast("epic")],
    ["🔵",atLeast("rare")],
    ["🔍",t.clue==="fresh"?100:clue],
  ];
  return rows.map(([ic,p])=>`<span class="oddsRow">${ic} ${p}%</span>`).join("");
}
