"use strict";
/* Store — opened from the button on the board's top-right.

   Three products, and ALL THREE are real money. Nothing in this store is bought with coins:
     🃏 a deck   — the pacing purchase. A free player waits for cards; a paying one buys them.
     🪙 coins    — a top-up for prediction wagers.
     🎟 tickets  — straight progress. Coins can never buy one.

   No IAP yet, so every button here simply grants. The prices are the tags they will carry.

   A bought deck MERGES onto whatever is left of the current one and reshuffles the lot
   (js/shoe.js), so the shoe legitimately ends up over cfg.packSize. Nothing may clamp it. */
const STORE_PACKS={ coins:[10000,100000,1000000], tickets:[5,25,100] };

function openStore(){
  if(state.animating||autoMode!==null) return;   // would fight the pull's own overlays
  const packs=(kind,amounts,icon)=>amounts.map(a=>
    `<button class="pack" data-kind="${kind}" data-amt="${a}">
       <span class="pkIco">${icon}</span><span class="pkAmt">${fmt(a)}</span></button>`).join("");
  const usd=Shoe.priceUsd().toFixed(2);
  $("#scrim").innerHTML=`<div class="modal storeModal">
    <div class="top"><div class="eyebrow">Store</div><h2>Top up your run</h2></div>
    <div class="mbody">
      <div class="pkGroup">🃏 Cards</div>
      <!-- NOTE: no backticks in this markup — it is inside a JS template literal. -->
      <div class="packs"><button class="pack wide" id="buyPack">
        <span class="pkIco">🃏</span><span class="pkAmt">${cfg.packSize} cards · $${usd}</span>
        <span class="pkNote">free until payments are wired up</span></button></div>
      <div class="hint" style="margin:6px 0 10px;text-align:center">${Shoe.count()} left · ${Shoe.ticketsLeft()} 🎟 still in the deck</div>
      <div class="pkGroup">🪙 Coins</div>
      <div class="packs">${packs("coins",STORE_PACKS.coins,"🪙")}</div>
      <div class="pkGroup">🎟 Tickets</div>
      <div class="packs">${packs("tickets",STORE_PACKS.tickets,"🎟")}</div>
      <div class="hint" style="margin-top:12px;text-align:center">Buy as many decks as you like — a new one shuffles into what's left, so the count can go past ${cfg.packSize}. Coins buy nothing here; they are for wagers.</div>
      <button class="btn purple wide" id="closeStore" style="margin-top:12px">Done</button>
    </div></div>`;
  $("#scrim").classList.add("show");
  const buy=$("#buyPack");
  if(buy) buy.onclick=()=>{
    const r=Shoe.buyPack();
    toast(`🃏 <b>+${cfg.packSize}</b> cards`);
    log("🛒",`Store · bought a deck ($${r.usd.toFixed(2)}) · ${r.size} cards in hand`);
    /* The riffle is owed, not played: the store is covering the board. It runs on the way out —
       see playDeckShuffle() in js/ui/main.js. */
    _shuffleOwed=true;
    renderAll(); openStore();          // re-open so the card count in the hint is current
  };
  $("#scrim").querySelectorAll(".pack[data-kind]").forEach(b=>b.onclick=()=>{
    const amt=+b.dataset.amt;
    if(b.dataset.kind==="coins"){
      state.coins+=amt; toast(`🪙 <b>+${fmt(amt)}</b> coins`); log("🛒",`Store · +<b>${fmt(amt)}</b> coins`);
    }else{
      /* Through Tickets.awardFree, the same call the mystery box and the Plot Twist card make:
         a bought ticket did not come out of a pack, so it walks the cost curve like any other
         free one — otherwise buying tickets would be a way to get cheap decks. Tickets bought
         while the row is full are banked, not lost. */
      const r=Tickets.awardFree(amt);
      toast(`🎟 <b>+${fmt(amt)}</b> ticket${amt>1?"s":""}`);
      log("🛒",`Store · +<b>${fmt(amt)}</b> tickets`);
      announceTickets(r);
    }
    renderAll();
  });
  $("#closeStore").onclick=()=>{
    $("#scrim").classList.remove("show"); $("#scrim").innerHTML=""; renderAll();
    if(_shuffleOwed) playDeckShuffle();     // the board is visible again
  };
}
