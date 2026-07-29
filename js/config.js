"use strict";
/* Economy configuration — every value here is editable live via the tuning drawer. */
const DEFAULTS={
  energyCap:30, regenMin:3, sessionsPerDay:2.5, secPerRoll:5, tokenStepMs:135,
  revealMs:1500, collectMinSec:10, collectMaxSec:20,
  deckCardMs:2000, vipRevealMs:1500, premiereStepMs:90, startRevealMs:800, autoCollectMs:600,
  fallbackSceneMs:1700, longPressMs:350,
  tileArtScale:1.41, tileArtLift:20,
  board3d:1,                 /* 1 = WebGL board (js/ui/board3d.js), 0 = the old CSS-3D board */
  /* Environment (js/ui/env3d.js). envMargin is how much wider than the ring the camera
     frames: 1.12 is the bare board, and everything above that trades board size for
     visible ground. 1.7 is what it takes to see water around the modelled island — the
     island has to be wider than the board it holds, so the frame has to be wider again. */
  env3d:1, envMargin:1.7, envShadows:1, envDeckMargin:0.6, envScene:"texas-town",
  diceRevealMs:500, diceToMoveMs:30,
  stdBase:40, trainEV:150, startPass:100, startLand:100, spaEnergy:5, vipSeed:25,
  boardScale:1,
  buildings:12, tiers:5, baseCost:1200, tierGrowth:1.8, bldgGrowth:1.05, boxesPerUpgrade:1,
  minWager:100, accuracy:0.65, avgOdds:1.8,
};
let cfg=Object.assign({},DEFAULTS);
let deck=[
  {name:"Small coins",weight:40,coins:30,energy:0,clues:0,vip:0},
  {name:"Medium coins",weight:15,coins:80,energy:0,clues:0,vip:0},
  {name:"Windfall",weight:5,coins:300,energy:0,clues:0,vip:0},
  {name:"Small energy",weight:15,coins:0,energy:2,clues:0,vip:0},
  {name:"Clue fragment",weight:10,coins:0,energy:0,clues:1,vip:0},
  {name:"Fine / Paparazzi",weight:10,coins:-50,energy:0,clues:0,vip:50},
  {name:"Advance to Start",weight:5,coins:0,energy:0,clues:0,vip:0,advance:true},
];
let boxTable=[
  {name:"Coins",weight:60,amount:200,kind:"coins"},
  {name:"Energy",weight:25,amount:3,kind:"energy"},
  {name:"Clues",weight:15,amount:1,kind:"clues"},
];
const defDeck=JSON.parse(JSON.stringify(deck));
const defBox=JSON.parse(JSON.stringify(boxTable));

/* train bonus spread — mean normalised to 1 so EV == trainEV exactly */
const TRAIN_MULT=[{m:0.5,w:30},{m:0.75,w:30},{m:1.0,w:20},{m:2.0,w:15},{m:4.0,w:5}];
const trainMean=TRAIN_MULT.reduce((a,x)=>a+x.m*x.w,0)/TRAIN_MULT.reduce((a,x)=>a+x.w,0);

/* Tuning drawer schema: [cfg key, label, input step] */
const TUNING=[
 {group:"Energy & sessions",items:[
   ["energyCap","Energy cap",1],["regenMin","Regen min / energy",1],
   ["sessionsPerDay","Sessions per day",0.1],["secPerRoll","Seconds per roll",1],
   ["tokenStepMs","Token speed (ms / tile)",5]]},
 {group:"Presentation timing",items:[
   ["diceRevealMs","Roll click → dice reveal (ms)",10],
   ["diceToMoveMs","Dice reveal → token moves (ms)",5],
   ["revealMs","Center reveal hold (ms)",100],
   ["collectMinSec","Train collect auto-close min (s)",1],
   ["collectMaxSec","Train collect auto-close max (s)",1],
   ["autoCollectMs","Train collect during auto-play (ms)",50],
   ["fallbackSceneMs","Episode w/o video: placeholder (ms)",100],
   ["longPressMs","Video: hold for 2× after (ms)",25],
   ["deckCardMs","Deck: card on screen (ms)",100],
   ["vipRevealMs","VIP: dwell before moving on (ms)",100],
   ["premiereStepMs","Premiere: sweep speed (ms / tile)",5],
   ["startRevealMs","Start: dwell on tile (ms)",50]]},
 {group:"Tile values (base coins)",items:[
   ["stdBase","Standard base coins (avg)",1],["trainEV","Train bonus EV",10],
   ["startPass","Start pass bonus",10],["startLand","Start landing extra",10],
   ["spaEnergy","Spa Day energy grant",1],["vipSeed","VIP seed per lap",5],
   ["boardScale","Board scale",0.1],
   ["tileArtScale","Tile art: size ×",0.05],
   ["tileArtLift","Tile art: lift off tile (%)",1],
   ["board3d","3D board (0/1) — reload to apply",1]]},
 {group:"Environment",items:[
   /* A choice rather than a number: the options are whatever assets/env/scene.js defines,
      so the drawer asks the manifest at build time instead of duplicating the list here —
      config.js is loaded before the manifest, so it could not name them anyway. */
   ["envScene","World",{choices:"env"}],
   ["env3d","Environment (0/1)",1],
   ["envMargin","Camera margin (board size ↔ ground)",0.05],
   ["envDeckMargin","Deck border beyond the board (tiles)",0.05],
   ["envShadows","Shadows (0/1) — reload to apply",1]]},
 {group:"Builders & series",items:[
   ["baseCost","Base cost (Builder 1, Lvl 1)",100],["tierGrowth","Level cost growth ×",0.05],
   ["bldgGrowth","Builder cost growth ×",0.05],["boxesPerUpgrade","Boxes per upgrade",1],
   ["buildings","Builders (all available)",1],["tiers","Levels per builder",1]]},
 {group:"Prediction & wager",items:[
   ["minWager","Minimum wager",10],["accuracy","Player accuracy (0–1)",0.01],["avgOdds","Avg odds (reference)",0.1]]},
];
