"use strict";
/* Board layout (fixed 40 tiles) — pure data + geometry, no DOM. */
const CORNERS={0:"start",10:"spa",20:"vip",30:"reshoot"};
/* The four bonus tiles. They used to pay a train bonus and open a mini-game; they now draw a
   card from the deck, which is the only place a card comes from. The six chance tiles that
   used to do the drawing (3/8/13/18/23/28) went back to being plain tiles — so a card is a
   rarer, bigger event, and the board has one bonus per edge rather than two kinds of them.
   (Two of those six, 3 and 23, are the bills below; the other four are standard.) */
const DECKS=new Set([5,15,25,35]);
/* The studio's two standing bills — the only tiles on the board that take rather than pay.
   (js/tiles/payroll-tile.js, js/tiles/overheads-tile.js.)

   WHERE THEY SIT IS THE DESIGN. They are 20 apart, so the player meets one about every half
   lap, and each sits three tiles AFTER one of the two tiles that pay out: Start at 0 and the
   VIP Lounge at 20, which dumps the whole accumulated pool. Revenue in, costs out. They also
   clear the card tiles at 5/15/25/35 and Reshoot at 30, so nothing can charge a player twice
   within three tiles. Moving either index gives that rhythm up.

   A map rather than a Set because the two are different tiles, the way CORNERS is a map: the
   index says which bill, and the type name is then the model's filename too (tileModelPath). */
const BILLS={3:"payroll",23:"overheads"};
function tileType(i){ if(CORNERS[i])return CORNERS[i]; if(BILLS[i])return BILLS[i];
                      if(DECKS.has(i))return"deck"; return"standard"; }
/* standard tile coin weights rise around the board (mean 1) */
const stdWeights={}; (function(){
  const stds=[]; for(let i=0;i<40;i++) if(tileType(i)==="standard") stds.push(i);
  let raw=stds.map(i=>0.6+ (i/39)*1.0); const mean=raw.reduce((a,b)=>a+b,0)/raw.length;
  stds.forEach((i,k)=>stdWeights[i]=raw[k]/mean);
})();
/* Tile index → 11×11 grid cell.
   The board is drawn as a diamond (CSS rotateX(52deg) rotateZ(45deg)), which maps the grid
   corners to the screen edges: (10,10)→bottom, (10,0)→left, (0,0)→top, (0,10)→right.
   Start sits at (10,10) so it faces the player at the bottom of the diamond; indices then run
   clockwise on screen — Start (bottom) → Spa (left) → VIP (top) → Reshoot (right). */
function gridPos(i){
  if(i<=10) return {r:10,c:10-i};        // bottom-right → bottom-left edge
  if(i<=20) return {r:10-(i-10),c:0};    // up the left edge
  if(i<=30) return {r:0,c:i-20};         // across the top edge
  return {r:i-30,c:10};                  // down the right edge
}
/* ---- what a tile is made of ----

   ONE MODEL FOR THE WHOLE RING. Every tile used to carry its own building
   (assets/tiles/models/1.glb … 40.glb), and 35 of those 40 files were byte-identical anyway —
   the ring read as clutter rather than as a board. So every tile that is not a card tile now
   draws the same piece, and the only things that stand out are the four corners and the four
   card tiles. The numbered files are still on disk and nothing loads them.

   THE CARD TILES CARRY A FACE. Tiles 5/15/25/35 are where the deck is drawn, and a portrait
   laid flat on the tile says "this is where the story happens" in a way a planter cannot. They
   take NO model, which is what lets board3d fall through to the tile-art path and texture the
   slab's top face instead.

   Who is on which tile is DATA. Swapping Carl for the cousin is one word here, not a renamed
   file — and the faces keep their own names in assets/tiles/faces/ so the mapping stays
   readable. A tile with no entry falls back to the old numbered convention
   (assets/tiles/<i+1>.png), which is what the legacy CSS board has always used. */
const TILE_FACES={5:"simon",15:"victoria",25:"carl",35:"grandma"};
const TILE_FACE_DIR="assets/tiles/faces/";
const TILE_ART_DIR="assets/tiles/";
const TILE_ART_EXT=".png";
function tileFace(i){ return TILE_FACES[i]||null; }
function tileImagePath(i){
  const who=tileFace(i);
  return who?`${TILE_FACE_DIR}${who}${TILE_ART_EXT}`:`${TILE_ART_DIR}${i+1}${TILE_ART_EXT}`;
}
/* The one piece the ring is built from — plus the tiles that earn a model of their own: the
   four corners and the two bills. Start, the Spa, the VIP Lounge, Reshoot, Payroll and Studio
   Overheads each do something the other 34 do not, and a board where the things you steer
   toward (or away from) look like the paving between them is a board with no landmarks.

   A NAMED TILE'S MODEL IS NAMED AFTER ITS TYPE, so CORNERS and BILLS above are the whole
   mapping and there is no second list to keep in step: renaming a corner renames its file, and
   a fifth corner or a third bill would need no code here at all. That is the same bargain
   TILE_FACES makes.

   Returns null for a card tile, which is not "missing" — it is the signal to draw that tile's
   face instead, and board3d.js reads null as "no model". A named tile's file that is not on disk
   is a different thing again and is fine: the loader keeps the plain slab, which is the
   documented contract for every absent model — payroll.glb and overheads.glb are generated
   separately from this code and the board has to render correctly before they land. */
const TILE_MODEL_DIR="assets/tiles/models/";
const TILE_MODEL_STD=`${TILE_MODEL_DIR}standard.glb`;
function tileModelPath(i){
  if(tileFace(i)) return null;
  const named=CORNERS[i]||BILLS[i];
  return named?`${TILE_MODEL_DIR}${named}.glb`:TILE_MODEL_STD;
}

/* Clockwise path from one tile to another, as the list of tiles stepped ONTO — so the tile you
   start on is not in it and the tile you arrive at is last. A path to where you already stand is
   a full lap, not an empty list, because the board only moves one way and "go there" means go
   there the long way round. */
function pathBetween(from,to){ const path=[]; const dist=((to-from)%40+40)%40||40; let p=from;
  for(let s=0;s<dist;s++){ p=(p+1)%40; path.push(p); } return path; }
/* Clockwise path from a tile to Start (a full lap when already on Start). */
function pathToStart(from){ return pathBetween(from,0); }
/* The next tile of a given type, clockwise from here — the one you would reach first. */
function nextTileOfType(from,type){
  for(let s=1;s<=40;s++){ const i=(from+s)%40; if(tileType(i)===type) return i; }
  return null;
}
