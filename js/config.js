"use strict";
/* Economy configuration — every value here is editable live via the tuning drawer. */
const DEFAULTS={
  energyCap:30, regenMin:3, sessionsPerDay:2.5, secPerRoll:5, tokenStepMs:135,
  revealMs:1500, collectMinSec:10, collectMaxSec:20,
  deckCardMs:2000, vipRevealMs:1500, premiereStepMs:90, startRevealMs:800, autoCollectMs:600,
  /* The Scoop's teleport (js/tiles/scoop-tile.js) is one step, not a walk, so this is the
     whole journey rather than a per-tile speed. */
  scoopStepMs:260,
  /* The two corners that hand something over. galaTier is the floor on the Gala's
     guaranteed card — GDD 3.4's "Rare or better" in the tier vocabulary the collection
     speaks today; premiereBox is the free pack for landing on Start. */
  galaTier:"gold", premiereBox:"silver",
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
     draws its own, so they drift apart instead of syncing up over a lap.

     npcs SHIPS OFF, and off means the models are never fetched — the cast is about a megabyte of
     GLB and scenery nobody has switched on should not be on the critical path of a first load.
     NPC3D loads them the first time it ticks with this true, so turning it on in the drawer
     still works without a reload. Note the usual caveat about changing a default: saveConfig
     writes the WHOLE cfg, so anyone who has already played has npcs:1 in their save and keeps
     it — this is the shipped default for a fresh install, not a switch that reaches backwards.
     Reset config, or the toggle itself, is the way back for an existing player. */
  npcs:0, npcHeight:0.75, npcStepMs:900, npcPauseMinMs:400, npcPauseMaxMs:2600,
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
  /* ---- the collection ----
     The shape of one turn of the loop: episodesPerBoard episodes on a board, each unlocked by
     collectiblesPerEpisode named cards. Nothing here states the pool size — 5 x 5 makes it 25,
     and it is DERIVED from the requirements in assets/cards/cards.js (see js/collection.js).
     So changing either number is only half the job: the board has to be re-authored to match,
     and Collection.validate() is what says whether it has been.

     dupCoins is what a card you already hold is worth instead, multiplied by that tier's `dup`
     (CARD_TIERS) — a duplicate diamond pays eight times a duplicate silver. */
  episodesPerBoard:5, collectiblesPerEpisode:5, dupCoins:40,
  /* ---- status ----
     Points per unit of play, on top of the points the owned items carry themselves. This is
     what makes the track climb for a player who never spends a coin. statusPriceScale moves
     every shop price at once without editing the ten of them.

     statusBarMs is how long the track takes to move when an item is earned and statusUpMs how
     long the result is held afterwards — the beat blocks the roll loop, so both are pacing and
     both belong in the drawer. */
  statusPerEpisode:2, statusPerCard:1, statusPerBoard:10, statusPriceScale:1,
  statusBarMs:900, statusUpMs:1500,
  /* What a box's `coins` outcome pays when its table row does not name an amount. */
  boxCoins:60,
  /* Still projected by js/economy.js, which counts a series in "builders" — which is now simply
     its episode count. Nothing in the game reads these; they are the model's bookkeeping. */
  buildings:12, tiers:5, boxesPerUpgrade:1,
  /* ---- opening a box ----
     Every box is opened the moment it is won (js/boxes.js, js/ui/pack.js) — none of them sit on
     a tile any more, so there is no throw to tune and no gold box to pick out from across the
     board. What is left is the popup's pacing.

     packAutoOpenMs is the promise the loop is built on: the player may tap the box to open it,
     and if they do not it opens itself after this. Five seconds is long enough to feel like a
     choice and short enough that an idle session keeps moving.
     packFlipMs is the card's flip, packRevealMs how long it is then held, packItemGapMs the
     beat between two cards out of the same box, and packCloseMs the wait after the last one.
     So a Diamond Box (items: 3) costs at worst
     packAutoOpenMs + 3 x (packFlipMs + packRevealMs + packItemGapMs) + packCloseMs,
     which is why the big tiers are bought rather than landed on.
     packDupMs is the extra beat a duplicate holds while its coin consolation lands. */
  packAutoOpenMs:5000, packFlipMs:420, packRevealMs:1500, packItemGapMs:420,
  packCloseMs:600, packDupMs:900,
  /* The box itself, as an object on the board. packBoxSize is its edge in tiles, packSwellMs the
     strain before it bursts and packPopScale how far it inflates first. packCardSize is a
     revealed card's height in tiles and packCardGap how far apart two of them sit — both are the
     same units the board is measured in, because the cards hang in the world beside it. */
  packBoxSize:2.3, packSwellMs:300, packPopScale:1.55, packCardSize:2.2, packCardGap:1.25,
  /* Prediction. accuracy is the no-clue floor; each clue banked this cycle adds
     accuracyPerClue up to accuracyMax (Economy.accuracyFor). */
  minWager:100, accuracy:0.55, accuracyPerClue:0.04, accuracyMax:0.7, avgOdds:1.8,
  /* Wagers are a share of the player's balance, not a flat amount — three tiers, Confident
     being the one the economy model's projections assume (Economy.wagerTiers). minWager is
     the floor underneath all three. clueAlbumSize is the cosmetic album target. */
  wagerSafe:0.05, wagerConfident:0.10, wagerMax:0.20, clueAlbumSize:300,
  /* ---- clues (js/clues.js) ----
     cluesPerEpisode is how many of an episode's authored eight it takes to unlock it —
     GDD 6.2 wants that FIXED within a Season and stepped between them, which is
     clueSeasonStep. clueStuckDays is the catch-up valve (6.7): after this many days on
     the same episode the requirement decays by one a day, so an unlucky run of duplicate
     clues cannot wall a player out of the story. dupClueCoins is what a duplicate pays,
     because a draw that pays nothing reads as the game misfiring. */
  cluesPerEpisode:4, clueSeasonStep:0, clueStuckDays:3, dupClueCoins:150,
};
let cfg=Object.assign({},DEFAULTS);
/* Roll stakes in cycle order. One button steps through these and wraps, so the order here IS
   the order the player sees. A stake costs that much energy per roll and multiplies the coins. */
const MULTIPLIERS=[1,2,3,5,10];
/* ---- the economy model's own tables ----
   Both are still written by Economy.apply() from the loaded workbook, and both are still saved
   and restored, because they are what the MODEL says the deck tile and the mystery box pay.
   Neither is read by the game any more: the deck tile hands over a box (js/tiles/deck-tile.js)
   and a box's contents come from boxTiers below. They are kept rather than deleted so an
   imported workbook still round-trips, and so the numbers the collection loop replaced can be
   compared against it. See "Known dead config" in CLAUDE.md. */
let deck=[
  {name:"Small coins",weight:40,coins:30,energy:0,clues:0,vip:0},
  {name:"Medium coins",weight:15,coins:80,energy:0,clues:0,vip:0},
  {name:"Windfall",weight:5,coins:300,energy:0,clues:0,vip:0},
  {name:"Small energy",weight:15,coins:0,energy:2,clues:0,vip:0},
  {name:"Insider tip",weight:10,coins:50,energy:0,clues:0,vip:0},
  {name:"Fine / Paparazzi",weight:10,coins:-80,energy:0,clues:0,vip:80},
  {name:"Advance to Start",weight:5,coins:0,energy:0,clues:0,vip:0,advance:true},
];
let boxTable=[
  {name:"Coins",weight:33,amount:60,kind:"coins"},
  {name:"Energy",weight:33,amount:3,kind:"energy"},
  {name:"Clues",weight:33,amount:2,kind:"clues"},
];

/* ---- the boxes ----
   Three tiers, and a tier is TWO things at once: how many draws it makes (`items`) and how the
   table those draws come from is weighted. A Diamond Box is not a Silver Box with better odds —
   it is three draws against a table weighted at the rare end, which is what makes the tiers feel
   different rather than merely priced differently.

   `kind` in a row is resolved by js/boxes.js:
     card    a character card at `tier`, drawn uniformly from that tier's slice of the pool
     clue    a clue card, drawn uniformly from the board's clues
     status  a status item nobody owns yet, by its own `box` weight (assets/status/status.js)
     coins   `amount`, scaled by cfg.boardScale
     energy  `amount`, topped up toward the cap, never reducing a purchased overflow

   `coins` and `usd` are the two prices in the store — the coin price is what play buys, the
   dollar price is what the simulated storefront charges. A tier with no `coins` cannot be
   bought with coins at all; today all three can. */
let boxTiers=[
  { key:"silver", name:"Silver Box", icon:"\ud83c\udf81", rank:1, items:1,
    art:"assets/boxes/silver.webp", coins:2500, usd:1.99,
    table:[
      {name:"Silver card", kind:"card", tier:"silver",  weight:44},
      {name:"Gold card",   kind:"card", tier:"gold",    weight:6},
      {name:"Diamond card",kind:"card", tier:"diamond", weight:0.6},
      {name:"Clue card",   kind:"clue",                 weight:28},
      {name:"Status item", kind:"status",               weight:1},
      {name:"Coins",       kind:"coins",  amount:120,   weight:12},
      {name:"Energy",      kind:"energy", amount:3,     weight:8},
    ]},
  { key:"gold", name:"Gold Box", icon:"\ud83c\udf81", rank:2, items:2,
    art:"assets/boxes/gold.webp", coins:12000, usd:7.99,
    table:[
      {name:"Silver card", kind:"card", tier:"silver",  weight:26},
      {name:"Gold card",   kind:"card", tier:"gold",    weight:26},
      {name:"Diamond card",kind:"card", tier:"diamond", weight:4},
      {name:"Clue card",   kind:"clue",                 weight:24},
      {name:"Status item", kind:"status",               weight:4},
      {name:"Coins",       kind:"coins",  amount:400,   weight:10},
      {name:"Energy",      kind:"energy", amount:6,     weight:6},
    ]},
  { key:"diamond", name:"Diamond Box", icon:"\ud83c\udf81", rank:3, items:3,
    art:"assets/boxes/diamond.webp", coins:45000, usd:24.99,
    table:[
      {name:"Silver card", kind:"card", tier:"silver",  weight:8},
      {name:"Gold card",   kind:"card", tier:"gold",    weight:30},
      {name:"Diamond card",kind:"card", tier:"diamond", weight:20},
      {name:"Clue card",   kind:"clue",                 weight:20},
      {name:"Status item", kind:"status",               weight:12},
      {name:"Coins",       kind:"coins",  amount:1500,  weight:6},
      {name:"Energy",      kind:"energy", amount:12,    weight:4},
    ]},
];
/* Which box a deck tile hands over. Mostly Silver, so a Gold off a tile is a good turn and a
   Diamond is a story — the paid tiers stay worth paying for. */
let deckBoxes=[
  { key:"silver",  weight:80 },
  { key:"gold",    weight:17 },
  { key:"diamond", weight:3 },
];

const defDeck=JSON.parse(JSON.stringify(deck));
const defBoxTiers=JSON.parse(JSON.stringify(boxTiers));
const defDeckBoxes=JSON.parse(JSON.stringify(deckBoxes));
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
   ["deckCardMs","Deck: card on screen (ms)",100],
   ["vipRevealMs","Gala: dwell before moving on (ms)",100],
   ["scoopStepMs","Scoop: teleport (ms)",20],
   ["premiereStepMs","Premiere: sweep speed (ms / tile)",5],
   ["startRevealMs","Premiere: dwell on tile (ms)",50]]},
 {group:"Tile values (base coins)",items:[
   ["stdBase","Standard base coins (avg)",1],
   /* The train's two outcomes, straight from the model. cfg.trainEV is derived from them
      and so is deliberately not editable here. */
   ["trainSmall","Train: small bonus",5],["trainLarge","Train: large bonus",5],
   ["trainLargeChance","Train: chance of the large bonus",0.05],
   ["startPass","Premiere pass bonus",10],["startLand","Premiere landing extra",10],
   ["spaEnergy","Spa Day energy grant",1],["vipSeed","Gala pot seed per lap",5],
   ["boardScale","Board scale",0.1],
   ["tileArtScale","Tile art: size ×",0.05],
   ["tileArtLift","Tile art: lift off tile (%)",1],
   ["board3d","3D board (0/1) — reload to apply",1]]},
 /* Opening a box. The one knob the loop is actually built on is packAutoOpenMs: the player
    may tap the box, and if they do not it opens itself after this. */
 {group:"Opening a box",items:[
   ["packAutoOpenMs","Opens itself after (ms)",250,{min:0,max:20000}],
   ["packFlipMs","1 · Card flip (ms)",20],
   ["packRevealMs","2 · Card held (ms)",50],
   ["packItemGapMs","3 · Gap between two cards (ms)",20],
   ["packDupMs","Duplicate: extra beat (ms)",50],
   ["packBoxSize","Box size (tiles)",0.05,{min:0.4,max:4}],
   ["packSwellMs","Swell before it bursts (ms)",20],
   ["packPopScale","How far it inflates (×)",0.05,{min:1,max:3}],
   ["packCardSize","Revealed card height (tiles)",0.1,{min:0.6,max:5}],
   ["packCardGap","Revealed cards: gap (tiles)",0.05,{min:0.2,max:4}],
   ["packCloseMs","4 · After the last card (ms)",50]]},
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
   ["npcs","People on the board — off ships (0/1)",1],
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
 /* The collection. episodesPerBoard and collectiblesPerEpisode are the SHAPE of a board, and
    the board content has to match them — Collection.validate() is what checks that, and the
    Collection panel in this drawer prints what it finds. */
 {group:"The collection",items:[
   ["episodesPerBoard","Episodes per board",1,{min:1,max:20}],
   ["collectiblesPerEpisode","Cards per episode",1,{min:1,max:12}],
   ["dupCoins","Duplicate card: coins (x its tier)",5],
   ["boxCoins","Box: coins when the row says none",10]]},
 {group:"Status",items:[
   ["statusPerEpisode","Points per episode watched",1],
   ["statusPerCard","Points per card collected",1],
   ["statusPerBoard","Points per board finished",1],
   ["statusPriceScale","Shop prices ×",0.05,{min:0.05,max:20}],
   ["statusBarMs","Earned: track moves (ms)",50],
   ["statusUpMs","Earned: held afterwards (ms)",50]]},
 {group:"Prediction & wager",items:[
   ["minWager","Minimum wager (floor under every tier)",10],
   ["wagerSafe","Wager tier 1 · Safe (share of balance)",0.01,{min:0,max:1}],
   ["wagerConfident","Wager tier 2 · Confident (the default)",0.01,{min:0,max:1}],
   ["wagerMax","Wager tier 3 · Max (share of balance)",0.01,{min:0,max:1}],
   ["accuracy","Accuracy with no clues",0.01,{min:0,max:1}],
   ["accuracyPerClue","Accuracy gained per clue",0.01,{min:0,max:0.2}],
   ["accuracyMax","Accuracy cap",0.01,{min:0,max:1}],
   ["clueAlbumSize","Clue album size (cosmetic target)",10,{min:1}],
   ["cluesPerEpisode","Clues needed to unlock an episode",1,{min:1}],
   ["clueSeasonStep","…and how many more each Season",1,{min:0}],
   ["clueStuckDays","Catch-up valve: days before it eases",1,{min:0}],
   ["dupClueCoins","Duplicate clue: coins",10,{min:0}],
   ["avgOdds","Avg odds (reference)",0.1]]},
];
