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
    /* Which ARC of the story is being played. Arc n covers episodes
       [(n-1)*cfg.episodesPerBoard, n*cfg.episodesPerBoard) of the library. */
    boardNum:1,
    /* THE COLLECTION. Card id → how many COPIES are held, Season-wide and permanent — not per
       arc, and not cleared by a Season reset (GDD 5.3). Whether a card has converted into its
       Collectible is derived from the count (js/cards.js), so there is one number here and
       nothing to drift.

       setsDone is the ONE thing about a set that has to be stored: "was this bonus already
       paid" is not derivable from a collection that only ever grows. Set key → the day. */
    cards:{}, setsDone:{},
    /* WHAT EACH HELD CARD WAS, at the moment it was banked: {id:{r,name,set}}. A save is a bag
       of id strings and outlives any version of the catalogue, so when content is rewritten a
       held id can stop resolving — and everything a card is worth is read off its rarity. This
       is what stops a converted Legendary quietly becoming a Common. The catalogue always wins
       while it can answer; this is only consulted when it cannot (js/cards.js get/remember). */
    cardMeta:{},
    /* Insider Packs bought since the last episode unlocked — what its price escalates on
       (GDD 6.5). Reset by Collection.claimUnlocked(). */
    insiderBought:0,
    /* THE SHELF. Status item id → {day, how} — how being "bought" | "earned" | "found".
       js/status.js. Collectibles granted whole, and the seed of the Showcase (GDD 5.2). */
    status:{},
    /* STATUS IS A LEVEL, and this is the only thing about it that is stored: the lifetime points
       at the moment this Season began. Points THIS Season are the difference, which is how 5.3's
       reset takes Status to zero while the collection, the Showcase and the prediction record
       all persist — nothing is deleted, the line just moves. */
    seasonFrom:0, seasonsDone:0,
    /* THE TROPHIES (GDD 7.4). Episode id → the day it was called right. One per episode, unique,
       and the only thing in the game that cannot come out of a box — which is exactly why it is
       worth having. Showcase pieces, not catalogue cards. */
    trophies:{},
    /* Milestone level → the day it was paid. Stored because "was this given" is not derivable
       from a level that only goes up. */
    statusMilestones:{},
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
