"use strict";
/* Economy configuration — every value here is editable live via the tuning drawer. */
const DEFAULTS={
  energyCap:30, regenMin:3, sessionsPerDay:2.5, secPerRoll:5, tokenStepMs:135,
  revealMs:1500, collectMinSec:10, collectMaxSec:20,
  /* THE DRAWN CARD, and its three timings are one beat in order:
       cardPullMs     the card lifts off the deck, arcs up and comes square to the camera.
                      The roll loop's promise resolves at exactly this mark.
       deckCardMs     it hangs there, still and readable. The one the drawer has always had —
                      and the ONLY one the flat DOM card uses, since it neither flies nor lands.
       cardToTableMs  it travels back down onto the deck it came off, and is gone.
     deckCardMs came down from 2000 when the pull arrived: the card is legible through the last
     of its flight and all of its landing now, so the still hold buys less than it used to and
     the whole beat still costs only ~0.7s more than the flat card did. */
  deckCardMs:1600, cardPullMs:620, cardToTableMs:480,
  /* The deck itself — the stack standing inside the ring (js/ui/shoe3d.js). 0 hides it and
     falls back to the flat card, which is also what a broken deck does on its own, so nothing
     downstream has to tell the two apart. WHERE it stands is a constant in that file and
     deliberately not a cfg key: cfg is persisted, so a position in here would keep whatever
     value a returning player's save was written with. */
  deck3d:1,
  vipRevealMs:1500, startRevealMs:800, autoCollectMs:600,
  /* These two are the episode video player's (js/ui/player.js), which is parked: still on disk,
     no longer in index.html, so nothing reads them right now. They are kept — with their drawer
     rows — because coins are meant to pay for episodes again in a later version, and a timing
     key that has to be reinvented is a timing key that comes back wrong. */
  fallbackSceneMs:1700, longPressMs:350,
  /* Bonus mini-games — the full-frame games in minigames/, opened through js/ui/minigame.js.
     Two deck cards open them, one each, which is what the train tile used to do before the deck
     draw took over its four tiles. bonusGames 0 falls back to the plain Collect popup, which is
     also what happens on its own if a game file fails to load — the card banks the coins before
     either opens, so a missing game costs presentation and never money.
     bonusLoadMs is the game's own opening animation.
     bonusMaxMs is a belt-and-braces ceiling on the whole thing: a wedged game must never
     soft-lock the roll loop, so the host closes it and pays out regardless once this elapses. */
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
     The train PAIR is spent again: the deck's one Bonus Game card pays trainSmall or trainLarge,
     so the names outlive the tile that coined them. trainLargeChance DOES decide which of the two
     turns up — it went dead for a while when the bonus was two separate cards and their weights
     decided it, which welded "how often is a bonus" to "how often is the big one"; one card
     unwelds them. trainEV is still DERIVED from all three (60 x 0.65 + 315 x 0.35 =
     149.25) as the number the spreadsheet is reconciled against. Both stay because the workbook
     carries them and Economy.apply() projects them (Economy.OWNED_CFG_KEYS); neither is in the
     drawer, since neither changes anything the player can feel. */
  stdBase:40, trainSmall:60, trainLarge:315, trainLargeChance:0.35, trainEV:149.25,
  startPass:100, startLand:100, spaEnergy:5, vipSeed:60,
  /* ---- the two bills (js/tiles/payroll-tile.js, js/tiles/overheads-tile.js) ----
     Payroll at index 3 and Studio Overheads at 23: the only tiles that take. Both are charged
     cost x boardScale x mult like every other value here, so a x5 roll pays five times the bill.

     MEASURED, NOT GUESSED. 400,000 rolls through the real resolveLandingEvents at stake x1 put
     the board at ~385 coins a lap before these tiles existed (~67 a roll over 5.7 rolls), and a
     single tile is landed on 0.142 times a lap — 5.7 landings spread over 40 tiles. So a bill
     of C costs 0.142 x C a lap, and this pair costs 0.142 x 320 = 46 a lap, ~12% of what the
     board pays. Re-measured after: 328 a lap, 57 a roll. The rest of that drop (~11 a lap) is
     the two tiles that stopped being standard payers, not the bills.

     WHY NOT MORE — AND THE SLACK IS NOW GONE. Items were meant to pace this run, not coins
     (see CLAUDE.md, "What actually paces the run"). An independent 80-seed simulation of the
     real spendRoll -> resolveLandingEvents -> Unlock.payStep loop, with each constraint waived
     in turn, measured what that margin actually is:

         rolls to all 18 episodes      coins alone   items alone   the run
         bills off (3/23 standard)        1,544         1,845        1,877
         bills on  (as shipped)           1,774         1,845        1,953

     Items led coins by 19.5% before these tiles and lead by **4.3%** now, against a 34-roll
     standard error — so the two constraints bind at nearly the same moment and which one
     actually binds varies by seed. The bills cost 230 rolls of coin pace, which is 77% of all
     the slack there ever was. **Any further bill makes coins the binding constraint**, and the
     whole content spine in content/ would have to be repriced to suit.

     Note the earlier figures in this comment do not reproduce: they came from a harness that
     zeroed the Reshoot fee and held the balance at 1e9, and the "~2,290 rolls" item baseline
     was wrong because the deck table sums to 115, not 100 — 22.6% of draws grant an item, so
     42 items take ~1,845 rolls. The table above is from an unmocked run and supersedes them.

     Overheads is the larger by two thirds: property costs more than people at this scale, and
     it arrives later in the lap, three tiles after the VIP Lounge empties its pool. */
  payrollCost:120, overheadsCost:200,
  boardScale:1,
  /* Builders are gone, but these three are still written by Economy.apply() from the model's
     structure and so have to exist. `tiers` is the level count the Economy panel prices the
     cost curve at, `buildings` is the current series' length, and `boxesPerUpgrade` priced a
     box drop that nothing triggers any more. The COST CURVE was never here — it is segmented
     and lives in js/economy.js, because no single formula holds for a whole run. */
  buildings:12, tiers:5, boxesPerUpgrade:1,
  /* Mystery box: item 1 is always this many coins, then one draw from boxTable. */
  boxCoins:60, boxItemGapMs:260,
  /* ---- the box throw ----
     Banked boxes are thrown onto the board when the player returns to it, in three phases: pull
     the camera out, rain the boxes down, put the camera back. NOTHING BANKS ONE TODAY — builder
     upgrades were the only source — so this never runs; it is kept whole, knobs and all, for
     whatever spawns the next box (see js/overlays/mystery-box.js).

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
     burst in the centre — the numbers have to appear where the box was. boxSpoilsMs is that
     hold, and with clues gone it is the last beat: nothing follows the numbers any more. */
  boxRiseMs:620, boxSwellMs:260, boxOpenScale:4.5, boxSpoilsMs:1200,
  /* ---- Reshoot, the jail corner (js/tiles/reshoot-tile.js) ----
     reshootThrows is how many free throws of the coloured pair a player gets to roll a double
     and escape. At three, 57.9% of visits fail — the tile is meant to be a drain.

     The fine for failing them all is a share of the CURRENT coin balance, drawn triangularly
     between these two bounds (see the tile). It is a PROPORTION rather than an amount because
     the cost curve runs from tens of coins to billions, and a flat fee would be ruinous early
     and unnoticeable late. It is deliberately NOT multiplied by the stake: the delay costs the
     same whatever you were betting, and scaling it would punish the stake twice.

     reshootThrowGapMs is the beat after a throw lands before the next one is thrown — the three
     throws have to read as three, or the player never sees themselves fail. reshootRevealMs is
     how long the outcome is held; it is its own key rather than cfg.revealMs because it lands
     after up to three throws and needs less dwell than a reveal that arrives cold.

     THE THREE BELOW ARE THE MODE'S OWN PACING (js/ui/fx.js showReshoot).
     reshootDelayMs is the delay BEAT: the clapperboard snapping shut over the board, held before
     a single die is thrown. The throws used to start immediately, which put coloured dice on the
     board with no warning — the announcement is what makes the corner legible, so it gets a knob
     rather than a hardcoded pause.
     The player then clicks the pink button once per throw, and the other two are the two ways a
     throw happens without them: reshootIdleMs is how long an un-clicked throw waits before it
     throws itself, so a player who wanders off mid-attempt never strands the board (the Collect
     popup's 10–20s window is the precedent). reshootAutoMs is the same thing under auto-roll,
     where nobody is at the keyboard at all — deliberately much shorter, because three throws at
     the idle window would park the loop for most of a minute on a tile it reaches every fortieth
     landing, with nothing to watch while it waits. */
  reshootThrows:3, reshootFineMin:0.001, reshootFineMax:0.02,
  reshootThrowGapMs:450, reshootRevealMs:1600,
  reshootDelayMs:1900, reshootIdleMs:12000, reshootAutoMs:700,
  /* Predictions, wagers and the clue edge are GONE from the game — nothing bets, and nothing
     reads Economy.accuracyFor() or Economy.wagerTiers() any more. These keys stay because the
     economy model still records the numbers and Economy.apply() projects all of them but
     minWager onto cfg (Economy.OWNED_CFG_KEYS); minWager is the floor wagerTiers() prices
     against. None of them has a drawer row now — there is nothing left to feel the difference.
     clueAlbumSize is the model's cosmetic album target, kept for the same reason. */
  minWager:100, accuracy:0.55, accuracyPerClue:0.04, accuracyMax:0.7, avgOdds:1.8,
  wagerSafe:0.05, wagerConfident:0.10, wagerMax:0.20, clueAlbumSize:300,
};
let cfg=Object.assign({},DEFAULTS);
/* Roll stakes in cycle order. One button steps through these and wraps, so the order here IS
   the order the player sees. A stake costs that much energy per roll and multiplies the coins. */
const MULTIPLIERS=[1,2,3,5,10];
/* The deck the four bonus tiles draw from — MIRRORED in ECONOMY_DEFAULT (js/economy.js), which
   is what actually reaches the game: Economy.apply() rebuilds this table from the model at boot.
   Editing one copy alone changes nothing. A card's vocabulary:

     coins   paid as coins x boardScale x mult; negative is a fine
     energy  a FLAG, not an amount — an energy card pays a random 1…mult, so what the stake
             costs is what it can hand back (js/tiles/deck-tile.js)
     vip     seeded into the VIP pool, at board scale
     items   how many story items to grant, drawn from the series being unlocked
     game    opens that bonus mini-game (the keys are MINIGAMES' in js/ui/minigame.js); its
             coins come from the economy's train pair, not from the `coins` column
     advance walks the token to Start

   The weights total 100, so a column IS a percentage of draws. What the shape is buying:
   coins stay the bulk of the table (54) because they are the run's main currency; energy is
   14, generous because it buys the rolls that earn the coins; the fine is 9 and Advance 4, the
   two cards that are there for the swing rather than the payout. An ITEM is 7 — every fourteenth
   card, against the ~42 items series 001 asks for over a run of several hundred draws, so it
   still reads as a find and not as a dispenser. The two bonus games are 8 and 4: roughly the
   model's 65/35 small-to-large split, now decided here instead of by cfg.trainLargeChance, and
   rare enough that a full-frame game stays an event. The gala also carries an item, which is the
   second way items reach the player. */
let deck=[
  {name:"Small coins",weight:19,coins:30,energy:0,vip:0,items:0},
  {name:"Prop from the set",weight:16,coins:0,energy:0,vip:0,items:1},
  {name:"Medium coins",weight:10,coins:80,energy:0,vip:0,items:0},
  {name:"Small energy",weight:10,coins:0,energy:1,vip:0,items:0},
  {name:"Insider tip",weight:7,coins:50,energy:0,vip:0,items:0},
  {name:"Fine / Paparazzi",weight:7,coins:-80,energy:0,vip:80,items:0},
  {name:"Windfall",weight:3,coins:300,energy:0,vip:0,items:0},
  {name:"Advance to Start",weight:3,coins:0,energy:0,vip:0,items:0,advance:true},
  /* ONE bonus card, not one per game. Which game it opens is decided AFTER the draw by
     Economy.trainDraw() (cfg.trainLargeChance), so the small/large split is a model number that
     can be retuned on its own — where two separate cards welded that ratio to two deck weights
     and made "how often is the big game" and "how often is a bonus at all" the same lever. */
  {name:"Bonus Game",weight:25,coins:0,energy:0,vip:0,items:0,game:"bonus"},
];
/* The mystery box's SECOND item. Item 1 is always cfg.boxCoins.
   There were three rows here — Coins, Energy and Clues, evenly weighted at 33 each. The clue
   row is gone with the album, and the two survivors keep their weights rather than being
   rewritten to 50/50: weighted() normalises by the total, so 33/33 IS an even split, and
   leaving the numbers alone keeps them comparable with the spreadsheet they came from. */
let boxTable=[
  {name:"Coins",weight:33,amount:60,kind:"coins"},
  {name:"Energy",weight:33,amount:3,kind:"energy"},
];
const defDeck=JSON.parse(JSON.stringify(deck));
const defBox=JSON.parse(JSON.stringify(boxTable));

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
   ["collectMinSec","Collect popup auto-close min (s)",1],
   ["collectMaxSec","Collect popup auto-close max (s)",1],
   ["fallbackSceneMs","Episode w/o video: placeholder (ms)",100],
   ["longPressMs","Video: hold for 2× after (ms)",25],
   ["autoRollHoldMs","Roll: hold this long for auto-roll (ms)",100],
   ["bonusGames","Bonus mini-games (0/1)",1],
   ["bonusLoadMs","Bonus game: opening animation (ms)",100],
   ["bonusMaxMs","Bonus game: hard timeout (ms)",1000],
   ["boxItemGapMs","Mystery box: gap between its two items (ms)",20],
   ["cardPullMs","Deck: card lifts off the deck (ms)",20],
   ["deckCardMs","Deck: card held still on screen (ms)",100],
   ["cardToTableMs","Deck: card travels back to the deck (ms)",20],
   ["vipRevealMs","VIP: dwell before moving on (ms)",100],
   ["startRevealMs","Start: dwell on tile (ms)",50]]},
 {group:"Tile values (base coins)",items:[
   ["stdBase","Standard base coins (avg)",1],
   /* The train's small/large pair used to be edited here. The tile is gone, so the rows are —
      the cfg keys survive only as targets for Economy.apply(), and a drawer row for a number
      no square on the board reads is a row that lies about what it does. */
   ["boxCoins","Mystery box: item 1 coins",10],
   /* The only two rows here that COST the player. They are tuned against each other — the pair
      is one tax on income, not two unrelated fees — so they sit together and next to the
      payouts they are sized against. */
   ["payrollCost","Payroll: the crew's bill",10],
   ["overheadsCost","Studio Overheads: the lot's bill",10],
   ["startPass","Start pass bonus",10],["startLand","Start landing extra",10],
   ["spaEnergy","Spa Day energy grant",1],["vipSeed","VIP seed per lap",5],
   ["boardScale","Board scale",0.1],
   ["tileArtScale","Tile art: size ×",0.05],
   ["tileArtLift","Tile art: lift off tile (%)",1],
   ["board3d","3D board (0/1) — reload to apply",1]]},
 /* Its own group rather than five rows scattered between "Tile values" and "Presentation
    timing": the throws, the fine and the beat between them are one mechanic, and tuning a jail
    means moving them against each other. The mystery box's two groups set the same precedent. */
 {group:"Reshoot (the jail corner)",items:[
   ["reshootThrows","Free throws to roll a double",1,{min:1,max:6}],
   ["reshootFineMin","Fine: min share of the balance",0.0005,{min:0,max:0.5}],
   ["reshootFineMax","Fine: max share of the balance",0.0005,{min:0,max:0.5}],
   ["reshootThrowGapMs","Beat between throws (ms)",25],
   ["reshootRevealMs","Outcome held on screen (ms)",50],
   ["reshootDelayMs","Delay beat before the first throw (ms)",50],
   ["reshootIdleMs","Throw itself if nobody clicks (ms)",500],
   ["reshootAutoMs","Auto-roll: gap between throws (ms)",50]]},
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
   ["boxSpoilsMs","3 · Winnings held on screen (ms)",50]]},
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
 {group:"The deck",items:[
   /* The three timings are in Presentation timing with the rest of the pacing; this group is
      what the deck IS, not how fast it moves. There is one row because everything else about
      where the deck and the discard spot stand is a constant in js/ui/shoe3d.js — see the note
      on cfg being persisted in its header, and in DEFAULTS above. */
   ["deck3d","Deal from the deck on the board (0/1)",1]]},
 {group:"Dice",items:[
   /* The throw's length is cfg.diceRevealMs, over in Presentation timing — it is the same
      "click → numbers" window the DOM dice used, so it stays where it always was. */
   ["dice3d","Throw them on the board (0/1)",1],
   ["diceSize","Size — edge in tiles",0.05,{min:0.3,max:2}],
   ["diceSpread","How far apart they land",0.1,{min:0,max:5}],
   ["diceThrowFrom","Thrown from (tiles toward camera)",0.25,{min:0,max:10}],
   ["diceArc","Throw height",0.1,{min:0,max:8}]]},
];
/* Two whole groups used to close this list: "Builders & series" and "Prediction & wager".
   Both systems are gone, and their cfg keys are now written by Economy.apply() and read by
   nothing — so the rows went with the systems rather than staying on as sliders that move a
   number no one can feel. The loaded model is still on show in the drawer, read-only, in the
   Economy panel (js/ui/economy-panel.js). */
