"use strict";
/* Deck tile (Plot Twist) — the board's bonus tile (indices 5/15/25/35), which draws a weighted
   card from the deck. It is the only tile that draws one.
   The drawn card is shown on screen for cfg.deckCardMs before the rewards land.
   A card can pay coins (or fine), energy, a story ITEM, seed the VIP pool, advance to Start, or
   open one of the two bonus mini-games. The table and what each column means is in js/config.js. */
/* How many props each bonus hands over, before the stake multiplies them. Constants rather than
   cfg keys: they are part of what a bonus IS, and the item rate is the run's clock — a number
   this load-bearing should be changed in the file that explains it, next to a re-measured
   pacing note, not swept in the drawer.

   The large bonus is a LADDER of counts, one per rung, ascending alongside the coin rungs it is
   index-aligned with: the rung that pays the most coins also pays the most props, which is the
   only reading anybody has of a prize ladder. It replaces a flat 2. One entry per rung of
   Economy.trainLadder() — add a rung there and this has to grow with it; the tiles suite asserts
   the two line up rather than leaving a fourth rung silently propless.

   IT IS THE SAME NUMBER OF PROPS PER RUN, and that is why it could be changed at all.
   Economy.trainLadder() picks the winning rung with Math.floor(Math.random()*3) — uniform — so
   the mean of [1,2,3] is exactly the 2 the flat prize paid. The shape of the prize moved; its
   size did not, and the pacing table in CLAUDE.md still holds. Keep the mean at 2 if you retune
   this, or re-measure the run before you ship it — items are what the run is gated on. */
const BONUS_SMALL_ITEMS=1, BONUS_LARGE_LADDER=[1,2,3];

class DeckTile extends Tile {
  get icon(){ return "🃏"; }

  /* CHOOSE which prop a card is about to hand over, and grant NOTHING. Split out of drawItem()
     for the large bonus, which draws one identity per rung so all three can be SHOWN and then
     banks only the rung that landed. Everything else wants pick-and-bank in one call and uses
     drawItem() below, unchanged.

     WHICH item is decided here rather than in the deck table because items are themed per series
     (Catalog.itemsOf): a table naming ids would be naming a series the player may never reach.
     The series taken is the one being unlocked, since everything the spine still owes comes from
     it.

     WHICH prop, though, is weighted by what the run still owes (Unlock.demand) rather than drawn
     evenly across the set. Even was the obvious choice and the wrong one: the five props are
     asked for 11/11/9/7/4 times, so an even draw spends a quarter of the grind on props the
     player has already finished collecting. Weighted, a prop stops appearing once it is covered
     and the last one owed cannot be the one that never comes.

     It is still not a vending machine — the weights are the whole tail of the spine, not the
     next step, so the prop that turns up is usually for an episode several ahead. Banking the
     wrong one until its episode comes round is the mechanic; never getting it at all was not. */
  pickItem(){
    const cur=Unlock.current();
    if(!cur) return null;
    const anc=Catalog.ancestorsOf(cur.kind,cur.id);
    const seriesId=anc.length?anc[0].id:cur.id;     // a series target is its own series
    const set=Catalog.itemsOf(seriesId);
    if(!set.length) return null;
    const need=Unlock.demand(seriesId);
    /* Nothing outstanding — everything priced in items is already covered. Fall back to an even
       draw rather than returning nothing: the card still has to pay something. */
    const table=set.map(it=>({item:it,weight:need[it.id]||0}));
    const pool=table.some(r=>r.weight>0)?table:set.map(it=>({item:it,weight:1}));
    return weighted(pool).item;
  }

  /* Grant n of one item and say which it was, or null when there is nothing to grant.
     Pick, then bank, in one call — what every card except the large bonus wants. The signature,
     the return shape and the banking are all exactly what they were before pickItem() was split
     out of it: the flat item card below and the suites that pin the draw all read this one, and
     a split that moved the banking would have rewritten all of them for nothing. */
  drawItem(n){
    const item=this.pickItem();
    if(!item) return null;
    Items.add(item.id,n);
    return {item,count:n};
  }

  /* A bonus-game card. The engine owns the money exactly as the train tile did: the coins are
     banked and the winning rung picked HERE, before the game opens, and the game is handed
     finished numbers purely to present them. Any item the card carries is granted here too, for
     the same reason — the game shows it, it never decides it. That now covers the large game's
     whole prize ladder: which prop sits on each rung, how many, and which rung won are all
     settled below, and the page is handed a finished ladder to reveal.

     Nothing floats and the card shows no amount, unlike every other card: the number is the
     game's to reveal, and the large game's whole round is the player finding out which rung they
     got. The log line still carries both, because the log is the receipt and it is off screen in
     the player's view. */
  bonusGame(card,mult,bs){
    /* THE CARD SAYS "a bonus", NOT WHICH ONE. Economy.trainDraw() picks small or large from
       cfg.trainLargeChance, after the draw — so the deck decides how often a bonus happens and
       the model decides how rich it is, and the two can be retuned without touching each other.
       They used to be one lever: two cards at weights 8 and 4 meant the 65/35 split WAS the deck,
       and making bonuses rarer silently made the big one rarer too.

       "train-large" is the ladder game (minigames/gala-match3.html); the keys are MINIGAMES' in
       js/ui/minigame.js, and both they and the cfg values keep the name of the tile that coined
       them. */
    const large=Economy.trainDraw().kind==="large";
    const game=large?"train-large":"train-small";
    const top=(large?cfg.trainLarge:cfg.trainSmall)*bs*mult;
    const lad=large?Economy.trainLadder(top):null;
    /* ONE read of the winning rung, used for both the coins and the props. Deriving them from
       two separate reads of lad.winIndex is precisely how a payout and the receipt that names it
       drift apart. */
    const win=lad?lad.winIndex:-1;
    const coins=lad?lad.tiers[win]:top;
    this.gainCoins(coins);                          // banked; the float is the game's job

    /* BOTH bonuses pay a prop as well as coins. Only the big one used to, inherited from the
       Premiere Gala card — which made the small bonus, three draws in four, a plain coin card
       wearing a mini-game. A bonus that can only ever hand back money is not a bonus on a board
       whose real currency is props.

       The big one pays a LADDER of them, index-aligned with lad.tiers: each rung shows its own
       prop and its own count, so the rung the player is chasing is richer in the thing that
       actually paces the run and not only in coins. Every rung draws its own identity — three
       identical rungs would be a ladder in name only. Scaled by the stake like every other item
       grant (see CLAUDE.md, "What actually paces the run"), which is why the counts are
       multiplied here and not baked into BONUS_LARGE_LADDER.

       THE TRAP, and why pickItem() exists: drawItem() picks AND banks in one call, so drawing
       three rungs with it would quietly pay the player for two rungs they never matched — six
       props a round instead of two, on the currency the whole run is gated on. The ladder is
       built first and granted second, once, for `win`. Losing rungs are drawn to be LOOKED at.

       All three picks come off a single Unlock.demand() snapshot, since nothing is banked
       between them, so two rungs can name the same prop. That is correct and is left alone:
       demand is 11/11/9/7/4, and re-drawing until three came back distinct would quietly
       un-weight the draw the weighting exists to fix. The ladder must read fine with a repeat. */
    const chips=(item,count)=>(item&&count>0)?[{icon:item.icon,name:item.name,count}]:[];
    let items=[], tierItems=null, faceItem=null;
    if(lad){
      const rungs=BONUS_LARGE_LADDER.map(n=>({item:this.pickItem(),count:n*mult}));
      const w=rungs[win];
      if(w.item&&w.count>0) Items.add(w.item.id,w.count);   // the ONLY grant on this path
      tierItems=rungs.map(r=>chips(r.item,r.count));
      /* items IS tierItems[win] — the same array, not a copy. The contract says the flat field
         equals the winning rung, and sharing the reference makes that structurally true rather
         than something a later edit has to remember to keep true. */
      items=tierItems[win];
    }else{
      const got=this.drawItem(BONUS_SMALL_ITEMS*mult);
      if(got){ items=chips(got.item,got.count); faceItem=got.item.id; }
    }

    /* The receipt names the winning rung and nothing else — the props the player actually holds.
       Listing the rungs that lost would describe a bag they do not have, and the log is off
       screen in ?view=mobile, so it is the only place the round is written down. The rung is not
       named: "Front-Row Seat" and the rest are the game's copy (minigames/gala-match3.html), and
       the engine cannot say them without keeping a second copy of them. */
    const parts=[`+<b>${fmt(coins)}</b> coins`];
    items.forEach(c=>parts.push(`<b>${c.name}</b> ×${c.count}`));
    return [
      /* The face names the prop for the SMALL bonus and shows none for the large one.
         The large game's ladder displays a prop per rung BEFORE the first pick, so a medallion of
         the winning rung's prop on the card that opens the game hands the player the answer on
         the way in — and only sometimes, because two rungs can draw the same prop, which is
         worse than a tell that always works. This card already shows no coin amount for exactly
         that reason: what the rung paid is the game's to reveal. The prop is now equally the
         game's, so it goes the same way. */
      this.card(card.name,"",{positive:true,item:faceItem}),
      this.minigame(game,coins,Object.assign(
        {outcome:"win",label:card.name,
         /* Always an array, even when empty: a game should not have to guess whether the field
            it was sent is a list or missing. */
         items},
        /* tierItems rides INSIDE the ladder branch, with the rungs it is aligned to: the small
           game has no ladder to hang per-rung prizes on and must never be sent one. */
        lad?{tiers:lad.tiers,winIndex:win,tierItems}:{})),
      /* THE RECEIPT GOES LAST, and on this path only. Everywhere else the log leads, because it
         says what is about to be shown; here it would say what the game has not revealed yet.
         The count IS the answer now: the ladder pays BONUS_LARGE_LADDER[win]×mult, so "×2" names
         the middle rung outright, and playEvents() renders a log the instant it reaches it —
         2.7s before the gala opens, in a panel that stays on screen for the whole round. The old
         line was safe only because the count was the constant 2×mult and revealed nothing; this
         change turned an inert clause into a perfect tell. Moving it after the minigame event
         makes it a receipt for a round the player has already watched.
         The cost, stated: an error thrown inside the game loses this line, where before it was
         already written. The coins are banked either way — a lost log entry is cosmetic, a
         spoiled round is not. */
      {log:{icon:"🃏",msg:`Plot Twist · <b>${card.name}</b> · ${parts.join(" · ")}`}},
    ];
  }

  onLand({pos,mult,bs}){
    const card=weighted(deck);
    const logEv={log:{icon:"🃏",msg:`Plot Twist · <b>${card.name}</b>`}};

    if(card.advance){
      return [
        logEv,
        this.card(card.name,"Advance to Start",{positive:true}),
        ...this.advanceToStart(pos,mult,cfg.tokenStepMs*2/3,"Plot Twist — Advance to Start"),
      ];
    }
    if(card.game) return this.bonusGame(card,mult,bs);

    // apply the card's effects (mutates now), collecting the float events for playback
    /* `got` is hoisted out of the items branch below only so the card event can name the prop
       that was drawn: the face shows WHICH one, and nothing but the tile knows. */
    const floats=[]; const parts=[]; let got=null;
    if(card.coins){
      /* A fine is floored at the balance, exactly as the two bills and the Reshoot fee are.
         This card used to be the one sink on the board with no guard: at ×10 a Fine drawn on an
         empty balance took coins to −800, and every tile that charges afterwards then had to
         decide what an overdrawn player owes. Now nothing on the board can push coins below
         zero, so there is one rule instead of three and a half. A gain is not clamped. */
      const raw=card.coins*bs*mult;
      const c=raw<0?-Math.min(Math.max(0,state.coins),-raw):raw;
      floats.push(this.gainCoins(c,(c>0?"+":"")+fmt(c),c>0?"var(--gold)":"var(--bad)"));
      parts.push((c>0?"+":"")+fmt(c)); }
    /* Energy is the one reward drawn rather than printed: a random 1…mult, so what the stake
       costs is the most it can hand back and a 1x roll always gets exactly one. gainEnergy is
       the only way to grant it — it tops up toward the cap without ever pulling a store purchase
       back down to it. */
    if(card.energy){ const e=Math.floor(rand(1,mult+1));
      floats.push(this.gainEnergy(e)); parts.push("+"+e+"⚡"); }
    if(card.items){
      /* Scaled by the stake, exactly as coins are. Without this a ×5 roll cost five energy and
         paid five times the coins but the same one prop — so every stake above ×1 bought the
         same coins per session and a fifth of the items, and the whole multiplier was a trap on
         a run that is gated by items rather than by money. */
      got=this.drawItem(card.items*mult);
      if(got){
        floats.push({float:{text:got.item.icon+" +"+got.count,color:"var(--gold)"}});
        parts.push(got.item.icon+" "+got.item.name+(got.count>1?" ×"+got.count:""));
      }else{
        /* Nothing left on the spine, so there is no series whose props are worth finding. The
           card still has to pay: a find with nothing to find is worth the board's own unit of
           value instead of a blank card the player will read as a bug. */
        const c=cfg.stdBase*bs*mult*card.items;
        floats.push(this.gainCoins(c)); parts.push("+"+fmt(c));
      }
    }
    if(card.vip) state.vip+=card.vip*bs;
    // a card is a loss only when it costs coins (e.g. Fine / Paparazzi)
    const positive=!(card.coins<0);
    // show the card first, then the rewards fly off the token
    return [logEv,
            this.card(card.name,parts.join("  "),
                      {positive,energy:!!card.energy,item:got?got.item.id:null}),
            ...floats];
  }
}
registerTile("deck",DeckTile);
