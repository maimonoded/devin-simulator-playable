"use strict";
/* Payroll (index 3) — the crew gets paid whether the week's footage was any good or not.

   One of the board's TWO BILLS, and with Studio Overheads (index 23) the only tiles here that
   take rather than pay. It sits three tiles after Start, so the money the lap just paid in is
   the money this takes back out: revenue in, costs out.

   It charges cost x boardScale x mult like every other value on this board, so a x5 roll earns
   five times as much and pays five times the bill and the tile keeps mattering at every stake.
   The bill is a FLAT number rather than a share of the balance — the opposite of the Reshoot
   fee, and deliberately: a crew's wages are a cost of doing business at the size you are, not a
   cut of what you are holding. Balance the two against each other in the drawer, not here.

   THE BALANCE IS THE GUARD (the same shape js/tiles/reshoot-tile.js uses for its fee): what is
   taken is the bill or the balance, whichever is smaller, measured against a balance floored at
   zero. So a player sitting on nothing pays nothing, an overdrawn one is not charged again, and
   there is no separate "don't go below zero" clamp anywhere that could be forgotten.

   NO BLOCKING REVEAL, on purpose. The two bills are landed on 0.28 times a lap between them —
   one roll in twenty, about as often as the Spa — and every blocking beat is paid for again by
   auto-roll on every run. The corners stop the board to show you something you WON; stopping it
   to tell a player they have lost money they had no say in is a punishment on top of a
   punishment, and this one is seen a great many times. A red float and a log line say it, which
   is exactly how the deck's Fine card and the Reshoot fee say the same thing. What separates
   this bill from the other one is its face, its wording and its size, not a pause. */
class PayrollTile extends Tile {
  get icon(){ return "👷"; }
  /* Printed on the tile, the way a standard tile prints what it pays — a bill you can see
     coming down the board is a bill you can spend against. The base cost, not the staked one:
     valueLabel takes no multiplier, and stdBase's label makes the same promise. */
  valueLabel(){ return "−"+Math.round(cfg.payrollCost); }

  onLand({mult,bs}){
    const due=Math.round(cfg.payrollCost*bs*mult);
    const paid=Math.min(Math.max(0,state.coins),due);
    const ev=this.gainCoins(-paid,paid?"👷 −"+fmt(paid):"👷 nothing to pay","var(--bad)");
    ev.log=paid
      ? {icon:"👷",msg:`<b>Payroll</b> · the crew gets paid whatever you shot · −<b>${fmt(paid)}</b> coins`}
      : {icon:"👷",msg:`<b>Payroll</b> · nothing in the account · the crew goes unpaid this week`};
    return [ev];
  }
}
registerTile("payroll",PayrollTile);
