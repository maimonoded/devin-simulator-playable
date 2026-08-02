"use strict";
/* Economy configuration — every value here is editable live via the tuning drawer. */
const DEFAULTS={
  energyCap:30, regenMin:3, sessionsPerDay:2.5, secPerRoll:5, tokenStepMs:135,
  revealMs:1500, collectMinSec:10, collectMaxSec:20,
  deckCardMs:2000, vipRevealMs:1500, premiereStepMs:90, startRevealMs:800, autoCollectMs:600,
  fallbackSceneMs:1700, longPressMs:350,
  /* Bonus mini-games — the full-frame games the train tile opens (minigames/, js/ui/minigame.js).
     bonusGames 0 falls back to the plain Collect popup, which is also what happens on its own if
     a game file fails to load. bonusLoadMs is the game's own opening animation. bonusMaxMs is a
     belt-and-braces ceiling on the whole thing: a wedged game must never soft-lock the roll loop,
     so the host closes it and pays out regardless once this elapses. */
  bonusGames:1, bonusLoadMs:2200, bonusMaxMs:90000,
  /* How long Roll has to be held before it hands the loop to auto-roll. Long enough that a
     slow tap never trips it, short enough not to feel stuck. */
  autoRollHoldMs:1000,
  tileArtScale:1.41, tileArtLift:20,
  board3d:1,                 /* 1 = WebGL board (js/ui/board3d.js), 0 = the old CSS-3D board */
  /* Environment (js/ui/env3d.js). envMargin is how much wider than the ring the camera
     frames: 1.12 is the bare board, and everything above that trades board size for
     visible ground. 1.7 is what it takes to see water around the modelled island — the
     island has to be wider than the board it holds, so the frame has to be wider again. */
  env3d:1, envMargin:1.7, envShadows:1, envDeckMargin:0.6, envScene:"texas-town",
  /* Follow camera. camZoom is the fraction of the board left in view; 1 is all of it.
     Desktop and phone need different numbers, not one shared value: a 9:16 frame is much
     narrower, so the same zoom that fills a wide pane leaves the board tiny in a tall one.
     camFollowMs is how long the camera takes to catch up with the token — it trails
     deliberately, so a hop reads as movement rather than the world sliding underneath a
     stationary piece. */
  camFollow:1, camZoom:0.85, camZoomPhone:0.5, camFollowMs:450, camDrag:1, phoneView:0,
  /* camBias pulls the camera's aim from the token toward the board centre: 0 aims straight
     at the token and puts sea at the edges, 1 never leaves the middle and so never follows.
     In between is the useful range — the token rides off-centre and the frame stays on the
     board. camEdgePad only bounds how far a manual drag may wander. */
  camBias:0.45, camEdgePad:0.5,
  /* How much of the half-frame the token may occupy before the camera gives ground back.
     1 lets it touch the edge; lower holds it further in. This is what stops camBias from
     pushing it off-screen at the left and right corners, where the projection is widest. */
  camTokenInset:0.7,
  /* Player piece height in tile units — a tile is 1. The model is scaled to this rather
     than to a footprint, since a piece reads by how tall it stands beside a tile. */
  tokenHeight:1.15,
  /* The cast walking the ring (assets/npcs/npcs.js, js/ui/npc3d.js) — scenery, no mechanic.
     npcHeight is in tile units like tokenHeight, and is deliberately UNDER it: a figure that
     walks in front of the token must never hide it, and the occlusion budget for something
     standing at its tile's centre is exactly the token's own height.
     npcLane is how far toward the board's middle they walk. The tile's centre is taken — art
     detail, the mystery box and the token all live there — so they use the inner edge, which
     is the one strip of every tile that is reliably clear.
     The pause is a RANGE because a fixed one makes three figures walk in formation; each step
     draws its own, so they drift apart instead of syncing up over a lap. */
  npcs:1, npcHeight:0.75, npcStepMs:900, npcPauseMinMs:400, npcPauseMaxMs:2600,
  npcLane:0.3, npcBob:0.05,
  diceRevealMs:500, diceToMoveMs:30,
  /* 3D dice. diceRevealMs doubles as the length of the throw, so the pacing knob that already
     existed keeps meaning the same thing: click to numbers-on-screen. The rest is the throw's
     shape — diceSize is the die's edge in tile units, diceSpread how far apart the pair lands,
     diceThrowFrom how far toward the camera it starts, diceArc how high it goes. */
  dice3d:1, diceSize:0.9, diceSpread:1.5, diceThrowFrom:4.0, diceArc:2.2,
  /* These mirror ECONOMY_DEFAULT in js/economy.js, so a fresh install already runs the
     shipped model and Economy.apply() is a no-op until a workbook is imported.
     The train pays the sheet's two-outcome pair directly: a small bonus most of the time,
     a large one at trainLargeChance. trainEV is DERIVED from those three
     (60 x 0.65 + 315 x 0.35 = 149.25) and kept in step by Economy.apply() and onCfgChange().
     Nothing pays a player from it — it is the number the economy model is checked against,
     which is why it is not in the drawer. */
  stdBase:40, trainSmall:60, trainLarge:315, trainLargeChance:0.35, trainEV:149.25,
  startPass:100, startLand:100, spaEnergy:5, vipSeed:60,
  boardScale:1,
  /* Builder shape. The COST CURVE is not here — it is segmented and lives in js/economy.js,
     because no single formula holds for a whole run. `buildings` is the current series'
     length, seeded by Economy.apply(). */
  buildings:12, tiers:5, boxesPerUpgrade:1,
  /* How many buildings the builders view shows at once. The page only advances once every
     building on it is maxed, so this is also the size of a "chunk" of the series. */
  builderPageSize:5,
  /* Mystery box: item 1 is always this many coins, then one draw from boxTable. */
  boxCoins:60, boxItemGapMs:260,
  /* ---- the box throw ----
     Boxes bought in the builders view are thrown onto the board when the player goes back to it,
     in three phases: pull the camera out, rain the boxes down, put the camera back.

     boxZoomOut is how far the camera pulls back (1 = not at all; 1.45 shows the whole ring).
     The three times are the three phases, so the whole thing costs
     boxZoomOutMs + boxThrowMs + boxZoomInMs whatever it is tuned to.

     boxThrowMs is the TOTAL for the throw, not one box: the last box lands exactly on it however
     many there are. Ten boxes in the same window means they overlap more, not that it runs ten
     times as long — otherwise a big buy would strand the player watching a downpour. */
  boxZoomOut:1.45, boxZoomOutMs:420, boxThrowMs:900, boxZoomInMs:420,
  /* ---- opening a box ----
     Landing on one lifts it off its tile, floats it to the middle of the view swelling as it
     goes, then pops it. boxRiseMs is the trip to the centre, boxSwellMs the last inflate before
     it goes, boxOpenScale how many times its board size it reaches.
     The pop is followed by the SPOILS: what was just won, held in the middle of the screen.
     Floats over the token are too small and too far from where the player is looking after a
     burst in the centre — the numbers have to appear where the box was.
     boxSpoilsMs is that hold, and boxCluePopupMs is counted from the moment the spoils appear,
     so the clue sheet follows the numbers rather than racing them. On a clue box the spoils stay
     up until the sheet arrives, so the two never leave a blank gap between them. */
  boxRiseMs:620, boxSwellMs:260, boxOpenScale:4.5, boxSpoilsMs:1200, boxCluePopupMs:2000,
  /* ---- the gold (clue) box ----
     A box is only a target if it can be picked out from across the board, and at tile size that
     is a matter of pixels: colour alone loses against a pale cream board. So the gold one is also
     bigger, self-lit, wrapped in a glow, and — the part that actually catches the eye — moving.
     boxGoldGlow 0 turns the halo off, boxGoldSpinMs is one full turn. */
  boxGoldScale:1.22, boxGoldGlow:0.7, boxGoldEmissive:0.45, boxGoldSpinMs:4200, boxGoldBob:0.09,
  /* A clue is the one drop worth stopping for — it is the only collectible in the game, so it
     gets a popup naming what was found rather than a float that scrolls past. Auto-closes after
     this long if the player doesn't tap Collect. */
  clueCollectMs:3000,
  /* Prediction. accuracy is the no-clue floor; each clue banked this cycle adds
     accuracyPerClue up to accuracyMax (Economy.accuracyFor). */
  minWager:100, accuracy:0.55, accuracyPerClue:0.04, accuracyMax:0.7, avgOdds:1.8,
  /* Wagers are a share of the player's balance, not a flat amount — three tiers, Confident
     being the one the economy model's projections assume (Economy.wagerTiers). minWager is
     the floor underneath all three. clueAlbumSize is the cosmetic album target. */
  wagerSafe:0.05, wagerConfident:0.10, wagerMax:0.20, clueAlbumSize:300,
};
let cfg=Object.assign({},DEFAULTS);
/* Roll stakes in cycle order. One button steps through these and wraps, so the order here IS
   the order the player sees. A stake costs that much energy per roll and multiplies the coins. */
const MULTIPLIERS=[1,2,3,5,10];
let deck=[
  {name:"Small coins",weight:40,coins:30,energy:0,clues:0,vip:0},
  {name:"Medium coins",weight:15,coins:80,energy:0,clues:0,vip:0},
  {name:"Windfall",weight:5,coins:300,energy:0,clues:0,vip:0},
  {name:"Small energy",weight:15,coins:0,energy:2,clues:0,vip:0},
  /* No clue card: all clues come from the Mystery Box, so the box's weights alone
     set the rate a prediction runs on. */
  {name:"Insider tip",weight:10,coins:50,energy:0,clues:0,vip:0},
  {name:"Fine / Paparazzi",weight:10,coins:-80,energy:0,clues:0,vip:80},
  {name:"Advance to Start",weight:5,coins:0,energy:0,clues:0,vip:0,advance:true},
];
/* The mystery box's SECOND item. Item 1 is always cfg.boxCoins. */
let boxTable=[
  {name:"Coins",weight:33,amount:60,kind:"coins"},
  {name:"Energy",weight:33,amount:3,kind:"energy"},
  {name:"Clues",weight:33,amount:2,kind:"clues"},
];
const defDeck=JSON.parse(JSON.stringify(deck));
const defBox=JSON.parse(JSON.stringify(boxTable));

/* The train's five-rung TRAIN_MULT spread used to live here, normalised so its mean landed on
   cfg.trainEV. It is gone: the tile now pays the economy model's two-outcome pair directly
   (cfg.trainSmall / cfg.trainLarge / cfg.trainLargeChance), which is the shape the spreadsheet
   is written in and the shape the two bonus mini-games present. See TODO.md, "The train is
   parameterised from the opposite end" — this is that decision, resolved in the model's favour. */

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
   ["autoRollHoldMs","Roll: hold this long for auto-roll (ms)",100],
   ["bonusGames","Bonus mini-games (0/1)",1],
   ["bonusLoadMs","Bonus game: opening animation (ms)",100],
   ["bonusMaxMs","Bonus game: hard timeout (ms)",1000],
   ["boxItemGapMs","Mystery box: gap between its two items (ms)",20],
   ["clueCollectMs","Clue popup: auto-close after (ms)",100],
   ["deckCardMs","Deck: card on screen (ms)",100],
   ["vipRevealMs","VIP: dwell before moving on (ms)",100],
   ["premiereStepMs","Premiere: sweep speed (ms / tile)",5],
   ["startRevealMs","Start: dwell on tile (ms)",50]]},
 {group:"Tile values (base coins)",items:[
   ["stdBase","Standard base coins (avg)",1],
   /* The train's two outcomes, straight from the model. cfg.trainEV is derived from them
      and so is deliberately not editable here. */
   ["trainSmall","Train: small bonus",5],["trainLarge","Train: large bonus",5],
   ["trainLargeChance","Train: chance of the large bonus",0.05],
   ["startPass","Start pass bonus",10],["startLand","Start landing extra",10],
   ["spaEnergy","Spa Day energy grant",1],["vipSeed","VIP seed per lap",5],
   ["boardScale","Board scale",0.1],
   ["tileArtScale","Tile art: size ×",0.05],
   ["tileArtLift","Tile art: lift off tile (%)",1],
   ["board3d","3D board (0/1) — reload to apply",1]]},
 /* The three phases of the box throw, each its own knob so the pacing can be tuned by feel
    rather than by one number that moves all of it at once. */
 {group:"Mystery box throw",items:[
   ["boxZoomOut","Camera zoom out (x, 1 = none)",0.05],
   ["boxZoomOutMs","1 · Zoom out (ms)",20],
   ["boxThrowMs","2 · Throwing the boxes, total (ms)",20],
   ["boxZoomInMs","3 · Zoom back in (ms)",20]]},
 {group:"Mystery box opening",items:[
   ["boxRiseMs","1 · Float to the centre (ms)",20],
   ["boxSwellMs","2 · Swell before the pop (ms)",20],
   ["boxOpenScale","Size it reaches (x board size)",0.25],
   ["boxSpoilsMs","3 · Winnings held on screen (ms)",50],
   ["boxCluePopupMs","4 · Clue sheet, after the winnings (ms)",50]]},
 {group:"Gold (clue) box",items:[
   ["boxGoldScale","Size vs a plain box (x)",0.02],
   ["boxGoldEmissive","Self-lit glow on the model",0.05],
   ["boxGoldGlow","Halo around it (0 = off)",0.05],
   ["boxGoldSpinMs","One full turn (ms)",100],
   ["boxGoldBob","Bob height (tile units)",0.01]]},
 {group:"Environment",items:[
   /* A choice rather than a number: the options are whatever assets/env/scene.js defines,
      so the drawer asks the manifest at build time instead of duplicating the list here —
      config.js is loaded before the manifest, so it could not name them anyway. */
   ["envScene","World",{choices:"env"}],
   ["env3d","Environment (0/1)",1],
   ["envMargin","Camera margin (board size ↔ ground)",0.05],
   ["envDeckMargin","Deck border beyond the board (tiles)",0.05],
   ["envShadows","Shadows (0/1) — reload to apply",1],
   ["camFollow","Follow the token (0/1)",1],
   ["camZoom","Camera zoom — desktop (1 = whole board)",0.05,{min:0.3,max:1}],
   ["camZoomPhone","Camera zoom — phone view",0.05,{min:0.3,max:1}],
   ["camFollowMs","Camera catch-up (ms)",50],
   ["camDrag","Drag the board to pan (0/1)",1],
   ["camBias","Aim: token ↔ board centre",0.05,{min:0,max:1}],
   ["camEdgePad","Drag range past board edge (tiles)",0.1,{min:0,max:3}],
   ["camTokenInset","Token must stay within frame ×",0.05,{min:0.1,max:1}]]},
 {group:"Player piece",items:[
   ["tokenHeight","Size — height in tiles",0.05,{min:0.2,max:2}]]},
 {group:"NPCs",items:[
   ["npcs","Walk the board (0/1)",1],
   /* Capped at cfg.tokenHeight's default rather than at 2 like the piece: past that a figure
      starts hiding the token it walks in front of, which is the one thing this must not do. */
   ["npcHeight","Size — height in tiles",0.05,{min:0.2,max:1.15}],
   ["npcStepMs","One tile step (ms)",25,{min:200,max:3000}],
   ["npcPauseMinMs","Pause between steps — min (ms)",50,{min:0,max:6000}],
   ["npcPauseMaxMs","Pause between steps — max (ms)",50,{min:0,max:12000}],
   ["npcLane","Walk this far inside the tile centre",0.02,{min:0,max:0.45}],
   ["npcBob","Bob height while stepping (tiles)",0.01,{min:0,max:0.3}]]},
 {group:"Dice",items:[
   /* The throw's length is cfg.diceRevealMs, over in Presentation timing — it is the same
      "click → numbers" window the DOM dice used, so it stays where it always was. */
   ["dice3d","Throw them on the board (0/1)",1],
   ["diceSize","Size — edge in tiles",0.05,{min:0.3,max:2}],
   ["diceSpread","How far apart they land",0.1,{min:0,max:5}],
   ["diceThrowFrom","Thrown from (tiles toward camera)",0.25,{min:0,max:10}],
   ["diceArc","Throw height",0.1,{min:0,max:8}]]},
 {group:"Builders & series",items:[
   /* The cost curve is not here: it is segmented and belongs to the loaded economy model.
      The drawer shows it read-only in the Economy panel (js/ui/economy-panel.js). */
   ["boxesPerUpgrade","Boxes per upgrade",1],["boxCoins","Box item 1: coins",10],
   ["buildings","Builders in this series",1],["tiers","Levels per builder",1]]},
 {group:"Prediction & wager",items:[
   ["minWager","Minimum wager (floor under every tier)",10],
   ["wagerSafe","Wager tier 1 · Safe (share of balance)",0.01,{min:0,max:1}],
   ["wagerConfident","Wager tier 2 · Confident (the default)",0.01,{min:0,max:1}],
   ["wagerMax","Wager tier 3 · Max (share of balance)",0.01,{min:0,max:1}],
   ["accuracy","Accuracy with no clues",0.01,{min:0,max:1}],
   ["accuracyPerClue","Accuracy gained per clue",0.01,{min:0,max:0.2}],
   ["accuracyMax","Accuracy cap",0.01,{min:0,max:1}],
   ["clueAlbumSize","Clue album size (cosmetic target)",10,{min:1}],
   ["avgOdds","Avg odds (reference)",0.1]]},
];
