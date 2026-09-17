"use strict";
/* Run state — a single mutable object; logic in game.js mutates it, ui/ renders it. */
let state={};
function initState(){
  state={
    day:1, clock:9*60, sessionsToday:1,
    energy:cfg.energyCap, coins:0, vip:0,
    pos:0, mult:1, boardNum:1,
    /* tile index → what that box holds, decided when it was placed (js/overlays/mystery-box.js).
       A Map rather than a Set so a box can still be drawn differently by what it holds. */
    boxes:new Map(),
    /* Boxes EARNED but not yet on the board. Builder upgrades used to bank them here; nothing
       does yet — what places a box is a deck card, once the deck is written. The banking and
       the throw survive intact so that card has somewhere to land. */
    pendingBoxes:0,
    rolls:0,
    /* The unlock ledger (js/unlock.js) — the whole of it:
         items    itemId → how many are held. Granted through Items.add, never written here.
         paid     "kind:id" → how many steps of that price have been paid.
         watched  episode ids already played.
       What is unlocked, what may be paid for next, what a step still owes — none of that is
       stored. It is derived from these three and the catalog every time it is asked for, so
       editing a content file can never leave a stale flag behind claiming otherwise. */
    items:{}, paid:{}, watched:[],
    lastCoins:0, lastEnergy:cfg.energyCap,
    animating:false,
  };
}
