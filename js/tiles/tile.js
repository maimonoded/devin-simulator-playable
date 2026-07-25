"use strict";
/* Tile base class + registry. Every tile type lives in its own js/tiles/*-tile.js file,
   extends Tile, and self-registers via registerTile(). game.js dispatches landings through
   TILE_TYPES; ui/render.js reads icon/corner/valueLabel from the same registry.

   Rewards and presentation builders (gainCoins/gainEnergy/gainClues, reveal/collect/card)
   are inherited from BoardActor in js/board-actor.js and shared with overlays.

   onLand(ctx) contract: ctx={pos,mult,bs}. Mutates state synchronously and returns an
   ordered event list for ui/main.js playEvents() — {float, log, move, confetti, dice,
   card, reveal, collect, pause}. */
class Tile extends BoardActor {
  constructor(type){ super(); this.type=type; }
  get icon(){ return ""; }          // shown on the board tile
  get corner(){ return false; }     // corner tiles get the highlighted .corner style
  valueLabel(i){ return ""; }       // small per-tile label (standard tiles: coin value)
  onLand(ctx){ return []; }

  /* ---- board movement — tile-specific, not shared with overlays ---- */
  /* Land-on-Start payout: pass + landing extra, and seed the VIP pool. Returns the coin amount. */
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
function registerTile(type,cls){ TILE_TYPES[type]=new cls(type); }
