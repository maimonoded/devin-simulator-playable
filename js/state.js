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
    /* Boxes EARNED but not yet on the board. Upgrades bank them here rather than dropping them
       straight onto tiles, because the player is looking at the builders screen when they buy —
       a box appearing on a board they cannot see is a reward nobody witnesses. They are thrown
       on when the player returns to the board (setBuildersView in js/ui/main.js). */
    pendingBoxes:0,
    /* epQueue is what is still UNWATCHED, and it shrinks as episodes are watched. Which
       episodes exist at all is NOT stored — it is derived from the completed builders, since
       the episode id is the builder number (Builders.unlockedEpisodeIds). */
    epQueue:[], epsWatched:0, boardsDone:0,
    /* A bet that was locked in but whose episode was never watched to the end. Holds the
       already-decided outcome so it can be revealed later, and is PERSISTED — otherwise
       closing the tab mid-episode would be a way to duck a losing bet or re-bet a won one.
       {id, wager, odds, won, payout} or null. */
    pendingReveal:null,
    predWins:0, predLoss:0, streak:0, bestStreak:0, rolls:0, predsMade:0,
    lastCoins:0, lastEnergy:cfg.energyCap, lastClues:0,
    animating:false, seriesDone:false,
  };
}
