"use strict";
/* Shared base for anything that can pay the player and present a result:
     Tile    (js/tiles/)    — one per board index, resolves when landed on
     Overlay (js/overlays/) — sits on top of a tile, resolves before it
   Reward + presentation logic lives here once so neither side duplicates it.
   Nothing in here touches the DOM: the gain* helpers mutate state and return
   playback events, which ui/main.js playEvents() renders. */
class BoardActor {
  /* ---- rewards ---- */
  gainCoins(amount,text,color){
    state.coins+=amount;
    return {float:{text:text??"+"+fmt(amount),color:color||"var(--gold)"}};
  }
  /* Cards for the shoe. Tops up TOWARD cfg.packSize and never reduces a shoe already above it —
     a bought pack merges onto whatever was left, so being over the cap is the ordinary state of
     affairs, not an edge case. Shoe.dealFree applies the same rule and deals from the current
     pack's tail, so free cards still carry their share of the tickets.

     opts.uncapped routes to Shoe.dealExtra instead, for a grant that must always pay (the Spa).
     The count actually dealt comes back on the event as `dealt` — an inert field playEvents
     ignores — because callers overriding `text` used to build their log line and their reveal
     from what they ASKED for, and on a full shoe the board then announced cards it had not
     given. Report ev.dealt, never n. */
  gainCards(n,text,opts){
    const got=(opts&&opts.uncapped)?Shoe.dealExtra(n):Shoe.dealFree(n);
    return {dealt:got,float:{text:text??"+"+got+"🃏",color:"var(--teal)"}};
  }
  /* Tickets have no cap. Awarding goes through Tickets.award so the ticket card, the mystery
     box and the store all fill placeholders by exactly the same rule — three paths that could
     otherwise disagree about when an episode unlocks. */
  gainTickets(n,text){
    /* awardFree, not award: a box or a Plot Twist card is a ticket from outside a pack, so it
       has to walk the cost curve itself — see Tickets.awardFree. */
    const r=Tickets.awardFree(n);
    return {float:{text:text??"+"+n+"🎟",color:"var(--pink)"},ticketAward:r};
  }
  /* Feeds both counters: the album total and the per-prediction flow that buys accuracy. */
  gainClues(n,text){
    state.clues+=n; state.cycleClues+=n;
    return {float:{text:text??"+"+n+"🔍",color:"var(--teal)"}};
  }

  /* ---- presentation event builders (all block the roll loop) ---- */
  /* Center-of-board reveal. opts: {positive, shower, ms}
       positive → confetti + pop, otherwise the sad droop
       shower   → "cards" | "tickets" | null, the rain layered on top. A STRING rather than the
                  old boolean, because there are now two kinds of thing to rain and the shower
                  should be made of what was actually won.
       ms       → hold time override (defaults to cfg.revealMs) */
  reveal(big,sub,opts){
    const o=opts||{};
    return {reveal:{big,sub,positive:!!o.positive,shower:o.shower||null,ms:o.ms}};
  }
  /* Popup with a Collect button; auto-closes after a random
     cfg.collectMinSec–collectMaxSec if the player doesn't click. */
  collect(big,sub){ return {collect:{big,sub}}; }
  /* Full-frame bonus mini-game (minigames/, rendered by js/ui/minigame.js).
       game    — which file to open, by key in MINIGAMES
       amount  — the coins ALREADY paid by gainCoins. The game is handed the number so it can
                 present it; it never decides it, and it never adds coins of its own.
       opts    — {outcome:"win"|"blocked", label} passed through to the game verbatim.
     Falls back to the Collect popup when cfg.bonusGames is off or the file won't load, so a
     missing mini-game costs presentation, never money. */
  minigame(game,amount,opts){
    const o=opts||{};
    /* Anything else in opts (a prize ladder, a tier index, whatever the next game needs) rides
       along untouched and is forwarded verbatim — the host does not need to learn each game's
       payload, and `big`/`sub` keep the Collect-popup fallback readable. */
    return {minigame:Object.assign({},o,{game,amount,outcome:o.outcome||"win",label:o.label||"",
                                         big:"+"+fmt(amount),sub:o.label||""})};
  }
  /* Plot Twist card held on screen for cfg.deckCardMs. opts: {positive, shower}
     Note this is the PLOT TWIST card (the six board tiles), not the card the player pulls from
     the shoe — those are two different decks. See js/config.js. */
  card(name,big,opts){
    const o=opts||{};
    return {card:{name,big,positive:!!o.positive,shower:o.shower||null}};
  }
}
