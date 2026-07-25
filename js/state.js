"use strict";
/* Run state — a single mutable object; logic in game.js mutates it, ui/ renders it. */
let state={};
function freshBuilder(){ return Array.from({length:cfg.buildings},()=>({tier:0})); }
function initState(){
  state={
    day:1, clock:9*60, sessionsToday:1,
    energy:cfg.energyCap, coins:0, clues:0, vip:0,
    pos:0, mult:1, boardNum:1,
    builder:freshBuilder(), boxes:new Set(),
    epQueue:[], epsWatched:0, epUnlockedCount:0, boardsDone:0,
    predWins:0, predLoss:0, streak:0, bestStreak:0, rolls:0, predsMade:0,
    lastCoins:0, lastEnergy:cfg.energyCap, lastClues:0,
    animating:false, seriesDone:false,
  };
}
/* Re-shape the builder array after buildings/tiers change in tuning, keeping progress. */
function rebuildBuilder(){
  const old=state.builder; state.builder=freshBuilder();
  for(let i=0;i<state.builder.length&&i<old.length;i++) state.builder[i].tier=Math.min(old[i].tier,cfg.tiers);
}
