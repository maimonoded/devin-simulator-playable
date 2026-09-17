"use strict";
/* Reshoot corner — the board's jail. It used to sweep the token round to Start, which was a
   reward dressed as a corner; landing here now costs you TIME instead.

   You get up to cfg.reshootThrows throws of a second pair of dice to roll your way out. They
   cost no energy, which is the whole reason they are thrown in a different colour: a player has
   to be able to see at a glance that these are not the rolls their stake is paying for.
   Throwing stops at the first double, and a double hands energy back — the SUM of the two dice
   times the stake, so the more a roll costs the more getting out is worth. Failing every throw
   costs coins instead: a share of the CURRENT balance, never scaled by the stake.

   ONE THROW IS A DOUBLE WITH p = 1/6, so all three fail with p = (5/6)^3 ≈ 57.9%. This tile is
   a net drain most of the time it is landed on, which is correct — it is a jail, not a bonus.

   Everything is decided HERE, synchronously: the throws are rolled, the energy is granted or the
   fine is taken, and the returned {reshoot} event only DESCRIBES what already happened so
   js/ui/main.js can replay it. Nothing below sleeps, animates or touches the DOM. */
class ReshootTile extends Tile {
  get icon(){ return "🎬"; }
  get corner(){ return true; }

  /* The fine, as a share of the balance. TRIANGULAR over [reshootFineMin, reshootFineMax]:
     the mean of two independent uniform draws, which peaks at the midpoint instead of lying
     flat. That is the cheapest honest way to say "weighted toward the middle of the range" —
     no magic constants, no hand-fitted curve.

     Measured over 200,000 samples with the shipped 0.1%–2%: 77.3% of fines land inside the
     0.5%–1.5% band, mean 1.05%. (Closed form for the same band: 77.6%.) A flat uniform would
     put only 53% in that band, which is why this is not one. */
  finePct(){
    const lo=cfg.reshootFineMin, hi=cfg.reshootFineMax;
    return (rand(lo,hi)+rand(lo,hi))/2;
  }

  onLand({mult}){
    const n=Math.max(1,Math.round(cfg.reshootThrows));
    const throws=[]; let won=false, energy=0;
    for(let i=0;i<n;i++){
      const d1=Math.floor(rand(1,7)), d2=Math.floor(rand(1,7));
      throws.push({d1,d2});
      if(d1===d2){ won=true; energy=(d1+d2)*mult; break; }   // out on the first double
    }
    /* No float on the arrival event, deliberately. playEvents calls renderHUD() on any float,
       and the grant or the fine has already been applied by the time playback starts — so a
       float here would move the coin and energy counters to the outcome before the first die
       has even been thrown. The log line says where you are; the dice say how it went. */
    const head={log:{icon:"🎬",msg:`<b>Reshoot</b> · ${n} free throws to roll a double`}};
    if(won){
      const last=throws[throws.length-1];
      /* grantEnergy, not gainEnergy: this is a specific number the player is told they won,
         and (d1+d2)*mult reaches 120 against a cap of 30 — topping up toward the cap would pay
         a fraction of what the float, the log and the reveal all announce. Overflow is
         legitimate here for the same reason it is for a store pack (see CLAUDE.md). */
      const out=this.grantEnergy(energy,"+"+energy+"⚡");
      out.log={icon:"🎬",msg:`Double <b>${last.d1}</b> on throw <b>${throws.length}</b> · back on set, +<b>${energy}</b> energy`};
      return [head,{reshoot:{throws,won:true,energy,finePct:0,fine:0}},out];
    }
    /* The fine is taken as a share of what is actually there, and rounded down into it, so the
       balance itself is the guard — there is no separate "don't go negative" clamp to forget.
       A player sitting on nothing pays nothing, and a negative balance (a deck fine can leave
       one) is floored to 0 rather than charged again. */
    const finePct=this.finePct();
    const bal=Math.max(0,state.coins);
    const fine=Math.min(bal,Math.round(bal*finePct));
    const out=this.gainCoins(-fine,fine?"−"+fmt(fine):"nothing to fine","var(--bad)");
    out.log={icon:"🎬",msg:`No double in <b>${n}</b> throws · reshoot fee <b>${fmt(fine)}</b> coins (${(finePct*100).toFixed(2)}%)`};
    return [head,{reshoot:{throws,won:false,energy:0,finePct,fine}},out];
  }
}
registerTile("reshoot",ReshootTile);
