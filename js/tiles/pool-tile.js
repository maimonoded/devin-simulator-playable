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

  /* A clue lands on the episode currently being worked on, and a duplicate pays coins — both
     rules live in Clues.grant(), because every future source of clues (a milestone cache, an
     Insider pack) owes exactly the same behaviour. */
  /* A clue row may pay MORE THAN ONE, via `n` on the row (assets/pools/pools.js). That is the
     lever that sets story pacing in the demo build: two clues on a landing gets eight episodes
     into a first session without making clues so frequent that finding one stops meaning
     anything.

     Each is a separate Clues.grant(), not one draw counted twice, so the second can repeat the
     first — the pool of eight is what makes two players hold different evidence, and collapsing
     that would quietly undo it. If the first grant completes an episode the second goes to the
     NEXT one, because grant() always reads the first episode still locked. That falls out of
     the derivation rather than needing a case here.

     One float for the landing and one log LINE PER CLUE: the float is the beat, but the text of
     a clue is the thing worth reading, and summarising two into "+2" would throw it away. */
  /* THE CLUE ROW UNLOCKS EPISODES, so it owes the same snapshot-and-claim every other source
     does — which is why the grants happen inside bankedEvents() rather than beside it.

     Getting this wrong is silent and total, which is the reason for the noise here. "Unlocked"
     is derived from the clues, but "watched" is derived as UNLOCKED MINUS state.epQueue
     (Collection.watchedIds) — and only claimUnlocked pushes onto that queue. So a clue that
     completed an episode's four without claiming did not merely fail to announce it: the
     episode became unlocked and instantly read as ALREADY WATCHED. firstUnwatchedId() returned
     null, the 🎬 button stayed dark, and blockedBy() named the NEXT episode, which was not
     unlocked at all. The story quietly ate an episode per unlock, and nothing threw.

     bankedEvents also sweeps sets and conversions. Nothing here banks a card, so those find
     nothing — they are idempotent by design, and paying for one shared path is cheaper than a
     second place that has to remember the same three checks in the same order. */
  drawClue(row,ctx){
    const n=Math.max(1,Math.round(+row.n||1));
    let got=[];
    const {after}=bankedEvents(()=>{
      for(let i=0;i<n;i++){ const g=Clues.grant(); if(!g) break; got.push(g); }
      return {drops:[]};
    });
    if(!got.length) return [{float:{text:"🔍 —",color:"var(--muted)"},
                             log:{icon:"🔍",msg:`${row.name} · nothing left to work out`}},...after];

    const fresh=got.filter(g=>g.isNew);
    const dupCoins=got.reduce((a,g)=>a+(g.isNew?0:g.coins),0);
    const ev=[];
    /* The float says what the landing was worth as a whole. Clues lead when there are any,
       because that is what the player is here for; coins only speak when nothing was new. */
    if(fresh.length) ev.push({float:{text:"+"+fresh.length+"🔍",color:"var(--teal)"}});
    else ev.push({float:{text:"+"+fmt(dupCoins),color:"var(--gold)"}});

    /* A CLUE IS A CARD, AND IT GETS A CARD'S BEAT.

       It has its own family face — the contact sheet, the case photograph, the sentence typed
       on a cream slip (js/ui/cardface.js, .fam-clue in css/collection.css) — and CLAUDE.md ranks
       that family FIRST of the three, because four clues buy the next episode and the episode is
       the point of the game.

       For a long time none of that was ever drawn on this route. A clue pulled out of a BOX got
       the full face (js/ui/box3d.js). The same clue landed on a TILE — which is how most of them
       arrive — got a one-second "+1🔍" float and a line in the activity log. And ?view=mobile
       hides the activity log, so on a phone the most important reward in the game arrived
       completely invisibly: players reached the wager screen and found four clues they had never
       once seen. The face was built, the art was picked, and nothing called it.

       ONE BEAT FOR THE WHOLE LANDING, not one per clue. A clue row pays `n` of them, and n is 2
       on most rows — so a beat each meant two blocking cards back to back for a single roll. It
       is one landing and it reads as one event, so it gets one card, or one PAIR of cards when
       two arrived together. Measured: 43 clue beats a session became 24.

       Duplicates get a log line and a coin float, and never a card — the same split
       drawCardEvents() uses, because a clue you already hold is not worth stopping the board
       for. The logs go in FIRST so the activity panel is already written by the time the
       blocking beat opens. */
    got.forEach(g=>{
      if(!g.isNew){
        ev.push({log:{icon:"🔍",msg:`${row.name} · you knew that one · +<b>${fmt(g.coins)}</b> coins`}});
        return;
      }
      const [have,need]=Clues.progressFor(g.id);
      ev.push({log:{icon:"🔍",msg:`${row.name} · <i>${g.clue.text}</i> · <b>${have}/${need}</b> on ${Episodes.titleOf(g.id)}`}});
    });
    if(fresh.length)
      ev.push({card:{name:"A clue",positive:true,holdMs:cfg.clueHoldMs,
                     /* Clues.dropFor is the one builder — Boxes.dropClue() and the wager
                        screen's evidence board call it too, so all three draw an identical
                        face. `drops` is a list because a landing can turn up more than one. */
                     drops:fresh.map(g=>Clues.dropFor(g.id,g.clue,{isNew:true,coins:g.coins}))}});
    return [...ev,...after];
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
