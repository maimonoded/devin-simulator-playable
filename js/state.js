"use strict";
/* Run state — a single mutable object; logic in game.js mutates it, ui/ renders it. */
let state={};
function initState(){
  state={
    day:1, clock:9*60, sessionsToday:1,
    energy:cfg.energyCap, coins:0, vip:0,
    /* THE EVIDENCE. Episode id → the clue ids held for it: {"005": ["c3","c7"]}. Which clues,
       for which episode — not how many in total. The requirement (cfg.cluesPerEpisode) sits
       well below the eight each episode authors, so two players reach the same prediction
       holding DIFFERENT evidence; a counter could not express that. Whether an episode is
       unlocked is DERIVED from this and nothing else (js/clues.js). */
    clues:{},
    /* Episode id → the day its first clue landed. All the catch-up valve needs to measure
       from; see Clues.daysOn(). */
    clueDay:{},
    pos:0, mult:1, series:0,
    /* Which Season's board is being played — an INDEX into BOARD_SEASONS (assets/board/board.js),
       so 0 is Season 1. The board's size, shape and every tile's type come from there, which is
       why this has to be state rather than a constant: GDD 5.3's Season reset swaps the board,
       the card set and the cast in one move, and this is the cursor it moves. */
    season:0,
    /* Which board of the collection is being played. Board n covers episodes
       [(n-1)*cfg.episodesPerBoard, n*cfg.episodesPerBoard) of the library. */
    boardNum:1,
    /* THE COLLECTION. One album per board, keyed by board number, card id → how many held.
       Kept forever rather than cleared on a board change: the album is a history, and past
       boards are what Collection.unlockedEpisodeIds() reads their episodes off. */
    albums:{"1":{}},
    /* THE SHELF. Status item id → {day, how} — how being "bought" | "earned" | "found".
       js/status.js. */
    status:{},
    /* epQueue is what is still UNWATCHED, and it shrinks as episodes are watched. Which
       episodes exist at all is NOT stored — Collection.unlockedEpisodeIds() derives it from
       the albums, because a completed page can never un-complete. */
    epQueue:[], epsWatched:0, boardsDone:0,
    /* A bet that was locked in but whose episode was never watched to the end. Holds the
       already-decided outcome so it can be revealed later, and is PERSISTED — otherwise
       closing the tab mid-episode would be a way to duck a losing bet or re-bet a won one.
       {id, wager, odds, won, payout} or null. */
    pendingReveal:null,
    predWins:0, predLoss:0, streak:0, bestStreak:0, rolls:0, predsMade:0,
    lastCoins:0, lastEnergy:cfg.energyCap, lastCards:0, lastStatus:0,
    animating:false, seriesDone:false,
  };
}
