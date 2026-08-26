"use strict";
/* The pool tile — four of the board's eight types, and one class.

   GDD §3.2: a landing draws one row from this tile's pool (assets/pools/pools.js, engine in
   js/pools.js) and the row's `kind` says what happens. The tile itself decides nothing except
   WHICH table, which is why std, npc, arrival and twist are four registrations of this file
   rather than four files.

   The kinds, and what each one costs the player's attention:

     money   a float. Most landings. Never blocks — the board keeps moving.
     card    a float for a duplicate, a held card for one you did not have. That gap IS the
             reward: see js/boxes.js drawCardEvents().
     clue    a float. Phase 3 makes clues per-episode evidence; today they feed the two
             counters described in CLAUDE.md under "Clues are two different things".
     energy  a float.
     move    the only kind that relocates the token — to Start, or the Scoop's teleport.
     event   flavour. Pays nothing on purpose: a pool with no empty rows forces every landing
             to hand something over, and the economy inflates to fill the space (§3.2).

   Nothing here is bespoke to a pool. A new pool is a table; a new KIND is a case below, and
   Pools.validate() already refuses a kind it does not know. */
class PoolTile extends Tile {
  constructor(type,icon){ super(type); this._icon=icon; }
  get icon(){ return this._icon; }
  /* No printed value. A standard tile used to print what it paid because it always paid the
     same thing; it draws now, and a number on it would be a lie. */
  valueLabel(){ return ""; }

  onLand(ctx){
    const row=Pools.drawAt(ctx.pos);
    /* Only reachable if the board names a type with no pool, which Pools.validate() reports at
       boot. Landing on it is then a quiet no-op rather than a thrown error mid-roll. */
    if(!row) return [];
    return this.resolve(row,ctx);
  }

  resolve(row,ctx){
    switch(row.kind){
      case "money":  return this.drawMoney(row,ctx);
      case "card":   return this.drawCard(row,ctx);
      case "clue":   return this.drawClue(row,ctx);
      case "energy": return this.drawEnergy(row,ctx);
      case "move":   return this.drawMove(row,ctx);
      default:       return this.drawEvent(row,ctx);
    }
  }

  /* A loss is only bearable because it goes SOMEWHERE. What a plot twist takes feeds the Gala
     pot (§3.4) — the corner that pays it all back — so the money leaves the balance without
     leaving the game, and the twist that took it is the reason the Gala is worth reaching.
     Never below zero: a player with nothing to lose loses nothing. */
  drawMoney(row,ctx){
    const amt=Math.round(row.amount*ctx.bs*ctx.mult);
    if(amt>0&&row.game) return this.drawBonusGame(row,amt);
    if(amt>=0){
      const ev=this.gainCoins(amt);
      ev.log={icon:this.icon,msg:`${row.name} · +<b>${fmt(amt)}</b> coins`};
      return [ev];
    }
    const take=Math.min(state.coins,-amt);
    state.coins-=take; state.vip+=take;
    return [{float:{text:"-"+fmt(take),color:"var(--pink)"},
             log:{icon:this.icon,msg:`${row.name} · -<b>${fmt(take)}</b> coins, into the Gala pot`}}];
  }

  /* A money row may name a full-frame bonus game (minigames/, js/ui/minigame.js). It is the
     only presentation a pool row can ask for, and it changes nothing about the money: THE
     ENGINE OWNS IT. The coins are banked here, before the game is opened, and the game is handed
     a finished number purely to reveal. A missing or broken game degrades to the Collect popup,
     so it can never cost a player anything.

     `ladder` makes the row's amount a CEILING rather than a payout: the game shows three rungs
     and one of them wins, which is how the old large train bonus read. The rung is picked here,
     for the same reason the money is — the game reveals a result, it never rolls one. */
  drawBonusGame(row,top){
    let amt=top, extra={};
    if(row.ladder){
      const lad=Economy.trainLadder(top);
      amt=lad.tiers[lad.winIndex];
      extra={tiers:lad.tiers,winIndex:lad.winIndex};
    }
    const ev=this.gainCoins(amt,this.icon+" +"+fmt(amt));
    ev.log={icon:this.icon,msg:`${row.name} · +<b>${fmt(amt)}</b> coins`};
    return [ev,this.minigame(row.game,amt,Object.assign({outcome:"win",label:row.name},extra))];
  }

  drawCard(row,ctx){ return drawCardEvents(row.name,this.icon); }

  drawClue(row,ctx){
    const ev=this.gainClues(1);
    ev.log={icon:"🔍",msg:`${row.name} · a <b>clue</b>`};
    return [ev];
  }

  drawEnergy(row,ctx){
    const n=Math.max(1,Math.round(row.amount));
    const ev=this.gainEnergy(n);
    ev.log={icon:"⚡",msg:`${row.name} · +<b>${n}</b> energy`};
    return [ev];
  }

  drawMove(row,ctx){
    if(row.to==="npc") return teleportToNpc(row.name,ctx);
    return [{float:{text:"🎭 To Start!",color:"var(--pink)"},
             log:{icon:"🎭",msg:`${row.name} · <b>advance to Start</b>`}},
            ...this.advanceToStart(ctx.pos,ctx.mult,cfg.premiereStepMs,row.name)];
  }

  drawEvent(row,ctx){
    return [{float:{text:row.name,color:"var(--muted)"},
             log:{icon:this.icon,msg:row.flavour?`${row.name} · ${row.flavour}`:row.name}}];
  }
}

/* The four pooled types. The icons only show on tiles with no artwork (js/ui/render.js
   showIcon), so they are a fallback, not the design. */
registerTile("std",     PoolTile, "🪙");
registerTile("npc",     PoolTile, "💬");
registerTile("arrival", PoolTile, "🚗");
registerTile("twist",   PoolTile, "🃏");
