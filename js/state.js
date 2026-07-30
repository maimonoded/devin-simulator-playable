"use strict";
/* Run state — a single mutable object; logic in game.js mutates it, ui/ renders it. */
let state={};
function initState(){
  state={
    day:1, clock:9*60, sessionsToday:1,
    /* Two clue counters, because the model uses clues for two unrelated things:
         clues      — the album. A lifetime total, cosmetic, never spent.
         cycleClues — the flow. Banked since the last prediction, spent on the next one
                      (it buys accuracy, see Economy.accuracyFor) and reset to zero. */
    energy:cfg.energyCap, coins:0, clues:0, cycleClues:0, vip:0,
    pos:0, mult:1, boardNum:1, series:0,
    builder:Builders.fresh(), boxes:new Set(),
    epQueue:[], epsWatched:0, epUnlockedCount:0, boardsDone:0,
    predWins:0, predLoss:0, streak:0, bestStreak:0, rolls:0, predsMade:0,
    lastCoins:0, lastEnergy:cfg.energyCap, lastClues:0,
    animating:false, seriesDone:false,
  };
}
