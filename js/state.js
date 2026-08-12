"use strict";
/* Run state — a single mutable object; logic in game.js mutates it, ui/ renders it. */
let state={};
function initState(){
  /* The shoe is minted AFTER the object is assigned, not inside the literal: Shoe.mintPack()
     advances state.ticketsPriced, and inside the literal `state` is still the PREVIOUS run —
     so the opening pack's rungs would be charged to the run being replaced and the new one
     would start at zero. */
  state={
    day:1, clock:9*60, sessionsToday:1,
    /* Two clue counters, because the model uses clues for two unrelated things:
         clues      — the album. A lifetime total, cosmetic, never spent.
         cycleClues — the flow. Banked since the last prediction, spent on the next one
                      (it buys accuracy, see Economy.accuracyFor) and reset to zero. */
    coins:0, clues:0, cycleClues:0, vip:0,
    /* The cards the player holds, in pull order — concrete values, not a count (js/shoe.js).
       packTail is the undealt remainder of the pack free cards are trickling out of; without
       it a partial regen would resume from a fresh shuffle and the two-tickets-per-pack
       invariant would die at every session boundary.
       ticketsPriced is the cost-curve pointer — how many rungs have been consumed. */
    shoe:[], packTail:[], ticketsPriced:0,
    pos:0, boardNum:1, series:0,
    /* tile index → what that box holds, decided when it was placed (js/overlays/mystery-box.js).
       A Map rather than a Set because the board shows a GOLD box on a tile holding clues. */
    /* One entry per episode placeholder in the series, holding 0..cfg.ticketsPerEpisode.
       WHICH of the row's episodes have been watched is deliberately NOT stored — it is derived
       from epQueue and pendingReveal (js/tickets.js). Derived state cannot drift. */
    tickets:Tickets.fresh(), boxes:new Map(),
    /* Tickets earned while their placeholder was already full. Banked rather than spilling into
       the next row's episodes, and never thrown away — they land when the row advances.
       KEYED BY JOKER TYPE (plus a `wild` pot for the box / Plot Twist / store tickets, which have
       no joker behind them), because a bare count forgets which lead paid for it and a banked J3
       would come back as a wildcard and land on episode 1. See Tickets._bank. */
    ticketBank:{wild:0},
    /* Boxes earned but with nowhere to go, because every eligible tile already had one. They
       land on the next drop rather than being silently eaten. */
    pendingBoxes:0,
    /* epQueue is what is still UNWATCHED, and it shrinks as episodes are watched. Which
       episodes exist at all is NOT stored — it is derived from the filled placeholders
       (Tickets.unlockedEpisodeIds). */
    epQueue:[], epsWatched:0,
    /* A bet that was locked in but whose episode was never watched to the end. Holds the
       already-decided outcome so it can be revealed later, and is PERSISTED — otherwise
       closing the tab mid-episode would be a way to duck a losing bet or re-bet a won one.
       {id, wager, odds, won, payout} or null. */
    pendingReveal:null,
    predWins:0, predLoss:0, streak:0, bestStreak:0, pulls:0, predsMade:0,
    lastCoins:0, lastClues:0,
    animating:false, seriesDone:false,
  };
  state.shoe=Shoe.mintPack();   // after the assignment above — see the note there
}
