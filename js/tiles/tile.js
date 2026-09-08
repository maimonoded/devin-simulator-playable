"use strict";
/* Tile base class + registry.

   ---- one draw system, many pools ----

   There used to be a file per tile type, each with its own bespoke onLand(). GDD §3.2 replaced
   that with a single rule: EVERY landing draws one row from the weighted pool its tile points
   at. So js/tiles/pool-tile.js is now four of the board's eight types, and the four corners are
   the only tiles that still do something a table cannot describe (§3.4).

   The point of that is not tidiness. A new tile type, a seasonal board or a live-ops variant is
   a row in assets/pools/pools.js and an entry in assets/board/board.js — content, not code.

   Rewards and presentation builders (gainCoins/gainEnergy, reveal/collect/card) are
   inherited from BoardActor in js/board-actor.js.

   onLand(ctx) contract: ctx={pos,mult,bs}. Mutates state synchronously and returns an ordered
   event list for ui/main.js playEvents() — {float, log, move, confetti, dice, card, reveal,
   collect, pack, unlock, statusUp, boardDone, minigame, pause}. */
class Tile extends BoardActor {
  constructor(type){ super(); this.type=type; }
  get icon(){ return ""; }          // shown on the board tile
  get corner(){ return false; }     // corner tiles get the highlighted .corner style
  valueLabel(i){ return ""; }       // small per-tile label
  onLand(ctx){ return []; }

  /* ---- board movement — tile-specific, not shared with overlays ---- */
  /* The Premiere landing payout: pass + landing extra, and seed the Gala pot. Returns the coins.

     The pot is still `state.vip` and its config key is still `vipSeed`. That is deliberate: the
     economy workbook's label for it is "VIP Lounge: pool seed per lap" and js/economy-import.js
     asserts on that label, so renaming the field would break the import contract to rename a
     word the player never sees. The TILE is The Gala (js/tiles/gala-tile.js); the pot it pays
     out is the same pot. */
  startLandingBonus(mult){
    const bs=cfg.boardScale;
    const pass=cfg.startPass*bs*mult+cfg.startLand*bs*mult;
    state.coins+=pass; state.vip+=cfg.vipSeed*bs;
    return pass;
  }
  /* Walk the token to Start, collect the landing bonus, and reveal it.
     stepMs is the per-tile sweep speed; the arrival reveal uses the Start dwell time. */
  advanceToStart(fromPos,mult,stepMs,sub){
    const path=pathToStart(fromPos); state.pos=0;
    const pass=this.startLandingBonus(mult);
    return [
      {move:{path,stepMs:Math.round(stepMs)}},
      {float:{text:"+"+fmt(pass),color:"var(--gold)"},
       reveal:{big:"+"+fmt(pass),sub:sub||"Arrived at Start",positive:true,ms:cfg.startRevealMs}},
    ];
  }
}
const TILE_TYPES={};
/* Extra arguments are forwarded to the constructor, which is how four board types share one
   PoolTile class and still carry their own icon. */
function registerTile(type,cls,...args){ TILE_TYPES[type]=new cls(type,...args); }
