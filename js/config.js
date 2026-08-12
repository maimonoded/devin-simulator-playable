"use strict";
/* Economy configuration — every value here is editable live via the tuning drawer. */
const DEFAULTS={
  /* The deck. ticketsPerPack is HOW MANY JOKERS ARE IN A PACK — the jokers are the tickets
     (js/shoe.js), so that one number is both and there is no second key to fall out of step with
     it. It is the ticket rate the whole economy runs on.

     packSize is DERIVED and appears here only so a fresh install has it before Economy.apply()
     runs: a pack is the 52 numbered cards plus the jokers, so ten jokers make 62. It is not in
     the tuning drawer — apply() runs on every drawer edit and would overwrite anything typed
     into it, and a control that silently reverts is worse than no control. Change the joker
     count instead and the size follows.

     BOTH ARE ECONOMY-OWNED. Editing them here alone changes nothing — Economy.apply() overwrites
     them from ECONOMY_DEFAULT.cards, so the model is the place to change the joker count and
     this list only has to agree (there is a test that says so).
     cardRegenMin is where energy regen went — minutes of game clock per free card, and now the
     game's only pacing gate. */
  packSize:64, ticketsPerPack:12, cardRegenMin:3, sessionsPerDay:2.5, secPerPull:5, tokenStepMs:135,
  revealMs:1500, collectMinSec:10, collectMaxSec:20,
  deckCardMs:2000, vipRevealMs:1500, premiereStepMs:90, startRevealMs:800, autoCollectMs:600,
  fallbackSceneMs:1700, longPressMs:350,
  /* Bonus mini-games — the full-frame games the train tile opens (minigames/, js/ui/minigame.js).
     bonusGames 0 falls back to the plain Collect popup, which is also what happens on its own if
     a game file fails to load. bonusLoadMs is the game's own opening animation. bonusMaxMs is a
     belt-and-braces ceiling on the whole thing: a wedged game must never soft-lock the roll loop,
     so the host closes it and pays out regardless once this elapses. */
  bonusGames:1, bonusLoadMs:2200, bonusMaxMs:90000,
  /* How long Pull has to be held before it hands the loop to auto-pull. Long enough that a
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
  /* The pull. pullRevealMs is tap → card face up (and doubles as the length of the 3D card's
     flight, so one knob still means "click to the number being readable"); pullToMoveMs is the
     beat between the card landing and the token setting off. */
  pullRevealMs:500, pullToMoveMs:30,
  /* WHERE things sit is NOT here. The deck, the pulled card and the ticket row are positioned
     by constants at the top of js/ui/shoe3d.js.

     Layout has one right answer per view and is not a balance knob — but the real reason is that
     cfg is PERSISTED. js/storage.js merges a saved config over the shipped defaults for every
     key the economy does not own, so a positional value living here would silently keep whatever
     was current the first time a player opened the game: changing the default would appear to do
     nothing at all for anyone who had already played. Timings stay tunable; positions do not.

     A pull is two beats: the card is PRESENTED in front of the camera for cfg.pullRevealMs —
     square to the view and much larger, which is the beat the player reads — it holds there for
     cardHoldMs, and is then DEALT down onto the table over cardToTableMs. BOTH the hold and the
     trip down start after the reveal has already resolved, so they run while the token is
     walking and cost no turn time at all — lengthen them freely, the pull is exactly as fast
     either way. */
  shoe3d:1, cardHoldMs:50, cardToTableMs:420,
  /* Pulling a JOKER — the ticket, and the only reward the board shows rather than tells. It
     presents at jokerScale times an ordinary card's size, punching past that and settling back,
     turns once on the way up, and then hangs for jokerHoldMs before the episode row collects it.
     jokerHoldMs is long next to cardHoldMs and that is free: like the hold it replaces it starts
     after the reveal has already resolved, so the token is walking through it and the turn is not
     a frame slower. jokerScale below 1 is ignored — see the clamp in js/ui/shoe3d.js. */
  jokerScale:1.5, jokerHoldMs:800,
  /* COMPLETING A COLLECTION — five of one lead fill a placeholder and unlock an episode. The
     collected cards come back out, splay into a hand, hold, then merge into the one episode they
     bought and drop home; the placeholder punches to slotPopScale as they land.
     Unlike the joker hold this one IS on the turn's critical path — pull() awaits it, because the
     whole point is that the moment cannot be missed. It costs ~1.9s once per five jokers, and
     auto-play session skips it entirely. handScale multiplies an ordinary card's presented size
     (PRESENT_SCALE), so 1.1 is a shade bigger than a pulled card, not eleven times. */
  handRiseMs:380, handFanMs:340, handHoldMs:420, handMergeMs:300, handSettleMs:420,
  handScale:1.1, slotPopMs:260, slotPopScale:1.16,
  /* Riffling a bought deck into the one on the table. Long enough to read as two decks becoming
     one; short enough that a player buying several in a row is not held up by it. */
  shuffleMs:900,
  /* These mirror ECONOMY_DEFAULT in js/economy.js, so a fresh install already runs the
     shipped model and Economy.apply() is a no-op until a workbook is imported.
     The train pays the sheet's two-outcome pair directly: a small bonus most of the time,
     a large one at trainLargeChance. trainEV is DERIVED from those three
     (60 x 0.65 + 315 x 0.35 = 149.25) and kept in step by Economy.apply() and onCfgChange().
     Nothing pays a player from it — it is the number the economy model is checked against,
     which is why it is not in the drawer. */
  stdBase:40, trainSmall:60, trainLarge:315, trainLargeChance:0.35, trainEV:149.25,
  /* spaCards is re-derived, NOT the old spaEnergy:5 renamed. Energy was spent at up to 10 per
     roll, so 5 was a small top-up; a pull costs exactly one card and the Spa corner comes round
     roughly every six pulls, so granting 5 would return most of the pull cost forever and the
     deck would stop being a budget at all. */
  startPass:100, startLand:100, spaCards:1, vipSeed:60,
  boardScale:1,
  /* Episode shape. The COST CURVE is not here — it is segmented and lives in js/economy.js,
     because no single formula holds for a whole run. `episodesInSeries` is the current series'
     length, seeded by Economy.apply(); `ticketsPerEpisode` is how many tickets fill one. */
  episodesInSeries:12, ticketsPerEpisode:5, boxesPerTicketCard:1,
  /* NO episodeRowSize. How many placeholders the board shows is ONE PER LEAD — Tickets.rowSize()
     reads Shoe.jokerTypes() — because each episode collects one joker type and a second number
     saying how many episodes are on a row could disagree with the cast. It is deleted rather than
     kept and ignored: it is not economy-owned, so loadConfig merges it back out of every existing
     save, and any surviving read would let a stale save pin the row at five while a fresh install
     got four — the row's length would depend on whether you had played before. */
  /* What a deck costs the player, in real money. A deck is an IAP, not a coin sink — coins buy
     nothing but prediction wagers now. Until the store is wired to a payment provider the
     purchase is free per click; this is the price tag it will carry. */
  deckPriceUsd:2.99,
  /* Mystery box: item 1 is always this many coins, then one draw from boxTable. */
  boxCoins:60, boxItemGapMs:260,
  /* ---- the box throw ----
     Boxes earned by a joker are thrown onto the board from the card that earned them, in three
     phases: pull the camera out, throw the boxes, put the camera back. With no card on the stage
     they fall from above instead, which is the older behaviour and still what every other path
     gets (js/ui/board3d.js, throwOverlays).

     boxZoomOut is how far the camera pulls back (1 = not at all; 1.45 shows the whole ring).
     The three times are the three phases, so the whole thing costs
     boxZoomOutMs + boxThrowMs + boxZoomInMs whatever it is tuned to.

     boxThrowMs is the TOTAL for the throw, not one box: the last box lands exactly on it however
     many there are. Ten boxes in the same window means they overlap more, not that it runs ten
     times as long — otherwise a big buy would strand the player watching a downpour.

     boxThrowScale is how many times its board size a box leaves the CARD at, shrinking to its
     resting size as it travels. It is a multiplier on the box's own size rather than an absolute
     one, so a gold box (boxGoldScale) stays proportionally bigger the whole way. Only the thrown
     path uses it; a box falling from above keeps its size, since there is no card for it to have
     come out of. */
  boxZoomOut:1.45, boxZoomOutMs:420, boxThrowMs:900, boxZoomInMs:420, boxThrowScale:4,
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
/* The PLOT TWIST card table — the six "deck" tiles at board indices 3/8/13/18/23/28.
   Named `twistDeck`, not `deck`: since the rework the word "deck" also means the 50-card pack
   the player PULLS from (js/shoe.js), and the two are unrelated. The board tile type is still
   spelled "deck" in js/board-model.js because renaming it would reach the 3D palette and the
   CSS for no gain — but nothing else borrows the word. */
let twistDeck=[
  {name:"Small coins",weight:40,coins:30,tickets:0,clues:0,vip:0},
  {name:"Medium coins",weight:15,coins:80,tickets:0,clues:0,vip:0},
  {name:"Windfall",weight:5,coins:300,tickets:0,clues:0,vip:0},
  {name:"Backstage pass",weight:15,coins:0,tickets:1,clues:0,vip:0},
  /* No clue card: all clues come from the Mystery Box, so the box's weights alone
     set the rate a prediction runs on. */
  {name:"Insider tip",weight:10,coins:50,tickets:0,clues:0,vip:0},
  {name:"Fine / Paparazzi",weight:10,coins:-80,tickets:0,clues:0,vip:80},
  {name:"Advance to Start",weight:5,coins:0,tickets:0,clues:0,vip:0,advance:true},
];
/* The mystery box's SECOND item. Item 1 is always cfg.boxCoins. */
let boxTable=[
  {name:"Coins",weight:33,amount:60,kind:"coins"},
  {name:"Ticket",weight:33,amount:1,kind:"tickets"},
  {name:"Clues",weight:33,amount:2,kind:"clues"},
];
const defTwistDeck=JSON.parse(JSON.stringify(twistDeck));
const defBox=JSON.parse(JSON.stringify(boxTable));

/* The train's five-rung TRAIN_MULT spread used to live here, normalised so its mean landed on
   cfg.trainEV. It is gone: the tile now pays the economy model's two-outcome pair directly
   (cfg.trainSmall / cfg.trainLarge / cfg.trainLargeChance), which is the shape the spreadsheet
   is written in and the shape the two bonus mini-games present. See TODO.md, "The train is
   parameterised from the opposite end" — this is that decision, resolved in the model's favour. */

/* Tuning drawer schema: [cfg key, label, input step] */
const TUNING=[
 {group:"Deck & sessions",items:[
   /* "Jokers" first in the label because that is what a designer looking at the deck sees — the
      two words name one number, and the drawer is where somebody goes to find it. There is no
      packSize row: it is derived from this one (52 + jokers), so a box for it would be a box
      that reverts on the next apply(). */
   ["ticketsPerPack","Jokers (tickets) per pack",1],
   ["cardRegenMin","Regen min / free card",1],
   ["sessionsPerDay","Sessions per day",0.1],["secPerPull","Seconds per pull",1],
   ["tokenStepMs","Token speed (ms / tile)",5]]},
 {group:"Presentation timing",items:[
   ["pullRevealMs","Pull tap → card face up (ms)",10],
   ["pullToMoveMs","Card up → token moves (ms)",5],
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
   ["spaCards","Spa Day card grant",1],["vipSeed","VIP seed per lap",5],
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
   ["boxThrowScale","Box: size leaving the card (x, 1 = none)",0.25,{min:1,max:10}],
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
   ["npcs","People on the board — off ships (0/1)",1],
   /* Capped at cfg.tokenHeight's default rather than at 2 like the piece: past that a figure
      starts hiding the token it walks in front of, which is the one thing this must not do. */
   ["npcHeight","Size — height in tiles",0.05,{min:0.2,max:1.15}],
   ["npcStepMs","One tile step (ms)",25,{min:200,max:3000}],
   ["npcPauseMinMs","Pause between steps — min (ms)",50,{min:0,max:6000}],
   ["npcPauseMaxMs","Pause between steps — max (ms)",50,{min:0,max:12000}],
   ["npcLane","Walk this far inside the tile centre",0.02,{min:0,max:0.45}],
   ["npcBob","Bob height while stepping (tiles)",0.01,{min:0,max:0.3}]]},
 {group:"Pull deck",items:[
   /* TIMINGS ONLY. Where the deck, the card and the ticket row sit is fixed in code — see the
      constants at the top of js/ui/shoe3d.js and the note in DEFAULTS above.
      The card's flight time is cfg.pullRevealMs, over in Presentation timing — it is the same
      "tap → the number is readable" window, so it stays where it always was. */
   ["shoe3d","Draw the deck on the board (0/1)",1],
   ["cardHoldMs","Card: held in front before it drops (ms)",10],
   ["cardToTableMs","Card: presented → on the table (ms)",20],
   ["jokerScale","Joker: how much bigger than a card (×)",0.1],
   ["jokerHoldMs","Joker: held up before the row takes it (ms)",50],
   ["shuffleMs","New deck: riffle shuffle (ms)",50]]},
 {group:"Episodes & tickets",items:[
   /* The cost curve is not here: it is segmented and belongs to the loaded economy model.
      The drawer shows it read-only in the Economy panel (js/ui/economy-panel.js). */
   ["deckPriceUsd","Deck price (real money, $)",0.5],
   ["boxesPerTicketCard","Boxes per ticket",1],["boxCoins","Box item 1: coins",10],
   ["episodesInSeries","Episodes in this series",1],["ticketsPerEpisode","Tickets per episode",1]]},
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
