"use strict";
/* Economy configuration — every value here is editable live via the tuning drawer. */
const DEFAULTS={
  energyCap:40,
  /* THE FIRST SESSION IS BIGGER THAN THE CAP, and that is allowed: CLAUDE.md's rule is that
     energy may exceed cfg.energyCap and nothing may clamp it downward. A new player starts with
     this much, which is about the hundred rolls that puts eight earned episodes inside session
     one; every session after that refills to the cap and the pace settles. Not economy-owned —
     no workbook describes it. */
  startEnergy:100, regenMin:3, sessionsPerDay:2.5, secPerRoll:5, tokenStepMs:135,
  revealMs:1500, collectMinSec:10, collectMaxSec:20,
  /* How long a card is held on the board's centre. Two values, because the two beats are not
     the same size: a card you did not have is news, and the THIRD copy — the one that converts
     it into its Collectible (GDD 4.3) — is the payoff the whole collection is aimed at, so it
     is allowed to sit there longer.

     A card lands on roughly a quarter of all rolls, so every 100ms here is about 25ms on the
     average roll. These are set deliberately long — the card IS the reward, and a reward that
     is gone before it has been read is not one. Turn them down here if the board starts to feel
     like it is waiting for you. */
  cardHoldMs:2000, statusHoldMs:2000, cardConvertMs:2000, clueHoldMs:2500,
  /* The conversion beat, in three moves: the card is held as a card, it turns edge-on and comes
     back as the plaque, and only then does the track run. Staged, because two things moving at
     once means neither is watched. */
  statusCardMs:620, statusFlipMs:460,
  /* A collected clue shrinking into the slot it filled on the objective tracker. */
  clueFlyMs:460,
  vipRevealMs:1500, premiereStepMs:90, startRevealMs:800, autoCollectMs:600,
  /* The Scoop's teleport (js/tiles/scoop-tile.js) is one step, not a walk, so this is the
     whole journey rather than a per-tile speed. */
  scoopStepMs:260,
  /* The two corners that hand something over. galaTier is the rarity FLOOR on the Gala's
     guaranteed card — GDD 3.4's "Rare or better", set one better than that because a corner
     reached once a lap should out-pay a tile; premiereBox is the free pack for landing on the
     Premiere. */
  galaTier:"epic", premiereBox:"standard",
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
  /* How far SHORT of the camera's aim point the dice land, as a fraction of the visible
     half-height. 0 lands dead centre, which is where the Estate stands and where the HUD
     reaches — on a phone the number was unreadable. A fraction rather than a distance so it
     holds at any zoom and on any pane. */
  diceDrop:0.35,
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
  /* ---- the arc ----
     How many episodes a set covers. Nothing about the CARDS is derived from it any more: cards
     stopped gating episodes (GDD 6.1), so a set is a run of the story and nothing else. */
  episodesPerBoard:5,
  /* ---- the collection (js/cards.js) ----
     cardCopiesToConvert is GDD 4.3's rule: the third copy of a card converts it into that
     card's Collectible, which is what pays Status. Copies past that trickle Status directly,
     so no pull is ever dead.

     dupCoins is what a copy that did NOT convert pays instead, multiplied by that rarity's
     `dup` (CARD_RARITIES) — a duplicate Legendary pays twenty-five times a duplicate Common.

     setBonus* is 4.4's set-completion reward. A set is a collection TARGET and never a gate,
     so this is generous and nothing anywhere depends on it having been earned. */
  cardCopiesToConvert:3, dupCoins:40, setBonusCoins:5000, setBonusStatus:250,
  /* GDD 6.5: every Insider Pack bought since the last episode unlocked costs this much more
     again, and the count resets when one lands. That is what caps sprint speed BY DESIGN —
     a player can always buy the next clue, and never buy ten of them cheaply. */
  insiderStep:0.6,
  /* ---- status (js/status.js, GDD 5) ----
     Status is a LEVEL, 1 to statusLevels, and it resets every Season. The two inflows priced
     here are the two the collection cannot pay for you: an episode WATCHED and a prediction
     CALLED RIGHT. The other two — converting a card and completing a set — are priced by the
     rarity table and setBonusStatus above. There is no fifth: the shelf of ten buyable status
     items is gone, because 8.1 pays a Collectible for converting a card and nothing else, and
     its ten objects are ordinary cards now.

     statusLevels / statusFirst / statusTotal describe the curve, which is built in
     js/economy.js beside the cost curve because 5.4 calls the Season gate "the single most
     important value in the game". THE TOTAL IS THE AUTHORITATIVE KNOB: the per-level costs ramp
     linearly from statusFirst and are solved so they sum to exactly statusTotal, so moving the
     total moves how long a Season takes and nothing else has to be re-derived. Like the rest of
     the economy-owned values these three mirror ECONOMY_DEFAULT, and why the gate is 4,000
     rather than 5.4's 30,000 is argued where the model holds it — js/economy.js.

     statusBarMs is how long the track takes to move when status is earned and statusUpMs how
     long the result is held afterwards — the beat blocks the roll loop, so both are pacing and
     both belong in the drawer. */
  statusPerEpisode:50, statusPerPrediction:150,
  statusLevels:30, statusFirst:25, statusTotal:5800,
  statusBarMs:900, statusUpMs:1500,
  /* What a box's `coins` outcome pays when its table row does not name an amount. */
  boxCoins:60,
  /* Still projected by js/economy.js, which counts a series in "builders" — which is now simply
     its episode count. Nothing in the game reads these; they are the model's bookkeeping. */
  buildings:18, tiers:5, boxesPerUpgrade:1,   /* the model's value; see OWNED_CFG_KEYS */
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
  /* The box itself, as an object on the board. packBoxSize is its edge in tiles and packSwellMs
     the strain before it bursts, packPopScale how far it inflates first.

     A REVEALED CARD IS MEASURED AGAINST THE VIEW, NOT THE BOARD. packCardScreen is its height
     as a fraction of what the camera can see, and packCardSpacing the space between two of them
     as a fraction of a card's width. packCardSize used to be a height in TILES, on the reasoning
     that the cards hang in the world beside the board. True about where they are, wrong about
     what they are — the board zooms to fit its ring, so on a phone 2.2 tiles came out around
     sixty pixels and a card out of a box was a fifth the size of the same card off a tile
     landing. A card is a thing you read.

     BOTH ARE NEW NAMES, AND THAT IS THE POINT. The first attempt kept `packCardGap` and simply
     changed what its number meant, tiles to a share of a card — and every save in existence
     still held 1.25, which as a share is seven times the intended gap. loadConfig merges saved
     values over DEFAULTS, so the old number silently won and the row came out a third of the
     size it should have been. A key whose UNITS change has to change its name; there is no
     version gate on presentation settings to catch it, unlike the economy-owned ones.

     packCardSize survives as the fallback for a run with no WebGL board to measure.
     packCardGap is dead and left to rot harmlessly in old saves. */
  packBoxSize:2.3, packSwellMs:300, packPopScale:1.55,
  packCardScreen:0.42, packCardSpacing:0.18, packCardSize:2.2,
  /* How long a completed CARD SET is held on screen. Shorter than a set of episodes
     finishing, on purpose: it is a reward, not a chapter ending. */
  setDoneMs:2600,
  /* A skip button on the video player that counts the episode as WATCHED — not as walked out
     of. A demo build is tested far more than it is played and the footage is 30-60s a go; this
     is the switch that takes it away for a real audience. */
  videoSkip:1,
  /* Prediction. accuracy is the no-clue floor; each clue banked this cycle adds
     accuracyPerClue up to accuracyMax (Economy.accuracyFor). */
  /* GDD 7.3: FLAT ODDS. Every answer pays the same multiplier, because per-answer odds leak the
     answer — a 1.5 against a 3.2 tells you which one the writers think is true before you have
     read either — and they make the screen read as a betting market rather than a guess. avgOdds
     is that multiplier: it was already the model's own average, and it was already what the
     auto-play session priced its payouts at. */
  minWager:100, accuracy:0.55, accuracyPerClue:0.04, accuracyMax:0.7, avgOdds:1.8,
  /* GDD 7.4: every prediction pays a Collectible, win or lose or skip, so a bet is never a
     round that gave you nothing. A CORRECT call also pays a trophy unique to that episode —
     predRewardFloor is the rarity floor on the card a correct call earns, and trophyStatus is
     what the trophy is worth on the Status track. */
  predRewardFloor:"rare", trophyStatus:120,
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
  /* A new card pays this FRACTION of what converting it pays, so the track moves on every pull
     and a Legendary still lands harder than a Common. cardCoins is what every copy pays in
     money, before the roll stake multiplies it. Neither is economy-owned — no workbook has a
     column for them. */
  /* What ONE copy of a card pays, as a share of what the whole Collectible is worth — and all
     three copies pay it, so three thirds come to the rarity's `status` value.

     A NEW NAME because the MEANING changed, not just the number. statusFirstCopy was the share
     the FIRST copy paid ON TOP of a full-value third copy; this is the share EVERY copy pays
     and there is no separate conversion payment. Reusing the old name would have let a saved
     0.25 quietly cut every card's worth by a quarter — the same trap packCardGap fell into, and
     presentation and collection knobs have no version gate to catch it. statusFirstCopy is dead
     and left to rot harmlessly in old saves. */
  statusCopyShare:1/3, statusFirstCopy:0.25, cardCoins:25,
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

/* ---- the packs (GDD 4.5) ----
   Three of them, and a pack is TWO things at once: how many cards it draws (`items`) and how the
   table those draws come from is weighted. Premium is not Standard with better odds — it is more
   draws against a table with a rarity floor on some of them, which is what makes the tiers feel
   different rather than merely priced differently.

   NO DOLLAR PRICES HERE. GDD 8.4 is a standing constraint: real money buys Money, and only Money
   buys packs. A paid loot box sitting beside a wagering mechanic draws regulatory attention well
   beyond either alone, and the separation costs the design nothing — the store still sells coins
   for dollars, and coins still buy everything.

   `kind` in a row is resolved by js/boxes.js:
     card    one card from the Season catalogue (js/cards.js). `floor` is a rarity GUARANTEE —
             the draw comes out at that rarity or better
     clue    one clue for the episode being worked on (js/clues.js)
     coins   `amount`, scaled by cfg.boardScale
     energy  `amount`, topped up toward the cap, never reducing a purchased overflow

   THERE IS NO `status` ROW ANY MORE. A box used to hand over a whole status item, which made it
   a second way to mint a Collectible — 8.1 says converting a card is the way. Each tier's status
   weight went to that tier's CARD rows, in proportion, so the totals and each tier's character
   are what they were: the pull that used to pay an object off the shelf now pays the card that
   object became.

   `clue: "fresh"` on the tier itself is the Insider's guarantee (6.5): one clue you do not
   already hold, on top of its draws. `escalates` makes its price climb with every Insider bought
   since the last unlock and reset when one lands — which is what caps sprint speed by design
   rather than by a cooldown. */
let boxTiers=[
  { key:"standard", name:"Standard Pack", icon:"\ud83c\udf81", rank:1, items:1, skin:"silver",
    art:"assets/boxes/silver.webp", coins:2500,
    table:[
      {name:"A card",       kind:"card",                 weight:53},
      {name:"Rare or up",   kind:"card",  floor:"rare",  weight:6},
      {name:"A clue",       kind:"clue",                 weight:21},
      {name:"Coins",        kind:"coins",  amount:120,   weight:12},
      {name:"Energy",       kind:"energy", amount:3,     weight:8},
    ]},
  { key:"premium", name:"Premium Pack", icon:"\ud83c\udf81", rank:2, items:3, skin:"gold",
    art:"assets/boxes/gold.webp", coins:12000,
    table:[
      {name:"A card",       kind:"card",                  weight:32},
      {name:"Rare or up",   kind:"card",  floor:"rare",   weight:26},
      {name:"Epic or up",   kind:"card",  floor:"epic",   weight:4},
      {name:"A clue",       kind:"clue",                  weight:22},
      {name:"Coins",        kind:"coins",  amount:400,    weight:10},
      {name:"Energy",       kind:"energy", amount:6,      weight:6},
    ]},
  { key:"insider", name:"Insider Pack", icon:"\ud83d\uddc2", rank:3, items:3, skin:"diamond",
    art:"assets/boxes/insider.webp", coins:20000, clue:"fresh", escalates:true,
    table:[
      {name:"A card",       kind:"card",                     weight:10},
      {name:"Rare or up",   kind:"card",  floor:"rare",      weight:40},
      {name:"Epic or up",   kind:"card",  floor:"epic",      weight:24},
      {name:"Legendary",    kind:"card",  floor:"legendary", weight:2},
      {name:"A clue",       kind:"clue",                     weight:14},
      {name:"Coins",        kind:"coins",  amount:1500,      weight:6},
      {name:"Energy",       kind:"energy", amount:12,        weight:4},
    ]},
];
/* Which pack the Premiere corner hands over. Mostly Standard, so a Premium off the board is a
   good turn and an Insider is a story — the bought tiers stay worth buying. */
let deckBoxes=[
  { key:"standard", weight:80 },
  { key:"premium",  weight:17 },
  { key:"insider",  weight:3 },
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
   ["videoSkip","Video: skip button (counts as watched)",1,{min:0,max:1}],
   ["longPressMs","Video: hold for 2× after (ms)",25],
   ["autoRollHoldMs","Roll: hold this long for auto-roll (ms)",100],
   ["bonusGames","Bonus mini-games (0/1)",1],
   ["bonusLoadMs","Bonus game: opening animation (ms)",100],
   ["bonusMaxMs","Bonus game: hard timeout (ms)",1000],
   ["cardHoldMs","Memory card held (ms)",100],
   ["statusHoldMs","Status card, not yet a Collectible (ms)",100],
   ["cardConvertMs","…and its third copy, out of a box (ms)",100],
   ["clueHoldMs","Clue card held — tap it to hold (ms)",100],
   ["clueFlyMs","Clue flies into the tracker (ms)",20],
   ["statusCardMs","Convert: card held before the turn (ms)",20],
   ["statusFlipMs","Convert: the turn itself (ms)",20],
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
   ["packCardScreen","Revealed card height (share of view)",0.01,{min:0.05,max:0.9}],
   ["packCardSpacing","Gap between cards (share of a card)",0.01,{min:0,max:1}],
   ["packCloseMs","4 · After the last card (ms)",50],
   ["setDoneMs","Card set complete: hold (ms)",100]]},
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
   ["diceDrop","Land below centre (0..1 of half-height)",0.05,{min:0,max:0.9}],
   ["diceSpread","How far apart they land",0.1,{min:0,max:5}],
   ["diceThrowFrom","Thrown from (tiles toward camera)",0.25,{min:0,max:10}],
   ["diceArc","Throw height",0.1,{min:0,max:8}]]},
 /* The collection. episodesPerBoard and collectiblesPerEpisode are the SHAPE of a board, and
    the board content has to match them — Collection.validate() is what checks that, and the
    Collection panel in this drawer prints what it finds. */
 {group:"The collection",items:[
   ["episodesPerBoard","Episodes per set",1,{min:1,max:20}],
   ["cardCopiesToConvert","Copies that convert a card",1,{min:1,max:10}],
   ["dupCoins","Duplicate card: coins (x its rarity)",5],
   ["setBonusCoins","Card set completed: coins",100,{min:0}],
   ["setBonusStatus","Card set completed: status",10,{min:0}],
   ["boxCoins","Box: coins when the row says none",10]]},
 {group:"Status",items:[
   ["statusPerEpisode","Status per episode watched",5],
   ["statusPerPrediction","Status per correct prediction",5],
   ["statusLevels","Levels in a Season",1,{min:2,max:99}],
   ["statusFirst","Status for level 2",10,{min:1}],
   ["statusTotal","Status for the whole Season",500,{min:100}],
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
   ["statusCopyShare","Each copy: share of the Collectible's worth",0.01,{min:0.01,max:1}],
   ["cardCoins","Any card: coins (x stake)",5,{min:0}],
   ["startEnergy","First session: energy granted",5,{min:0}],
   ["avgOdds","Payout multiplier (flat)",0.1],
   ["trophyStatus","Called-It trophy: status",10,{min:0}]]},
];
