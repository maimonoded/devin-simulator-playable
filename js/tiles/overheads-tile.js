"use strict";
/* Studio Overheads (index 23) — the lot, the power, the insurance. The bill that arrives
   whether or not a camera turned over.

   The second of the board's TWO BILLS (see js/tiles/payroll-tile.js, which carries the shared
   reasoning). It sits three tiles after the VIP Lounge, the tile that dumps the whole
   accumulated pool, so the biggest payout on the board is followed by the biggest bill.

   IT IS THE LARGER OF THE TWO, by about two thirds: property costs more than people at this
   scale, and it lands later in the lap, on a player who has just been paid. cfg.overheadsCost
   and cfg.payrollCost are both in the drawer's "Tile values" group so the pair can be tuned
   against each other; the arithmetic that sized them is in js/config.js.

   THE BALANCE IS THE GUARD: the charge is the bill or the balance, whichever is smaller, taken
   against a balance floored at zero — so nothing here can push a player below it, and an
   overdrawn balance (a deck fine can leave one) is not charged again.

   PRESENTATION: a float and a log line, no blocking reveal — the reasoning is in payroll-tile.js
   and applies to both. Where this tile differs is in what it says: Payroll is people and this is
   property, so the failure case is the lot running on credit rather than a crew going unpaid.
   The bigger number does the rest of the work. */
class OverheadsTile extends Tile {
  get icon(){ return "🏢"; }
  /* Printed on the tile like Payroll's and like a standard tile's payout: the base cost, before
     the stake multiplies it. */
  valueLabel(){ return "−"+Math.round(cfg.overheadsCost); }

  onLand({mult,bs}){
    const due=Math.round(cfg.overheadsCost*bs*mult);
    const paid=Math.min(Math.max(0,state.coins),due);
    const ev=this.gainCoins(-paid,paid?"🏢 −"+fmt(paid):"🏢 nothing to pay","var(--bad)");
    ev.log=paid
      ? {icon:"🏢",msg:`<b>Studio Overheads</b> · the lot, the power, the insurance · −<b>${fmt(paid)}</b> coins`}
      : {icon:"🏢",msg:`<b>Studio Overheads</b> · nothing in the account · the lot runs on credit`};
    return [ev];
  }
}
registerTile("overheads",OverheadsTile);
