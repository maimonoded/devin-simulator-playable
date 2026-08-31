"use strict";
/* Board layout — pure data + geometry, no DOM.

   The layout itself is CONTENT and lives in assets/board/board.js; this file is the engine that
   reads it. GDD §3.1 wants the count, the shape and every tile's type loaded from a data file so
   a new Season — or a live-ops variant — is an entry there rather than a change here.

   Nothing below assumes 40 tiles. A ring of N tiles is drawn on a square grid of side
   N/4 + 1, which is 11 for the shipped 40; the geometry generalises so a Season can be a
   different size without touching the renderer. N must divide by 4, which validate() enforces —
   a ring with unequal sides has no square to be drawn on. */

/* The Season being played. Not persisted here — state.season is the cursor, and this falls back
   to the first Season so the board is readable before initState() has run (Board3D.init() is
   called before boot()). */
function boardSeason(){
  const i = (typeof state !== "undefined" && state && state.season) | 0;
  return BOARD_SEASONS[i] || BOARD_SEASONS[0];
}
function boardTiles(){ const s = boardSeason(); return (s && s.tiles) || []; }
function boardSize(){ return boardTiles().length; }
/* Side length of the grid the ring is drawn on: N/4 tiles per side, plus the shared corner. */
function gridN(){ return boardSize() / 4 + 1; }

/* "npc:simon" → "npc". The whole tile identity is its type plus one optional argument. */
function tileType(i){ return String(boardTiles()[i] || "std").split(":")[0]; }
/* "npc:simon" → "simon", and null when the tile carries no argument. */
function tileArg(i){ const p = String(boardTiles()[i] || "").split(":"); return p.length > 1 ? p[1] : null; }
/* Which weighted pool this tile draws from, or null for the four corners — see js/pools.js. */
function tilePool(i){ return TILE_POOLS[tileType(i)] || null; }
/* Every index of a given type. The Scoop needs the NPC tiles; validate() needs the corners. */
function tilesOfType(type){
  const out = [];
  for (let i = 0; i < boardSize(); i++) if (tileType(i) === type) out.push(i);
  return out;
}

/* Tile index → grid cell.
   The board is drawn as a diamond, which maps the grid corners to the screen edges:
   (m,m)→bottom, (m,0)→left, (0,0)→top, (0,m)→right. Start sits at (m,m) so it faces the player
   at the bottom of the diamond; indices then run clockwise on screen. */
function gridPos(i){
  const m = gridN() - 1;                    // tiles per side
  if (i <= m)     return { r: m, c: m - i };        // bottom-right → bottom-left edge
  if (i <= 2 * m) return { r: m - (i - m), c: 0 };  // up the left edge
  if (i <= 3 * m) return { r: 0, c: i - 2 * m };    // across the top edge
  return { r: i - 3 * m, c: m };                    // down the right edge
}

/* Optional tile artwork. Drop assets/tiles/1.png to skin the first tile (index 0), 2.png for the
   next, and so on — the filename is 1-based, so it matches how the board reads to a human rather
   than the 0-based index used in code. Missing files are simply not used.
   3D models use the same numbering: assets/tiles/models/1.glb is Start. They are normalized on
   load by board3d.js, so a model need not arrive at a 1x1 footprint. */
const TILE_ART_DIR = "assets/tiles/";
const TILE_ART_EXT = ".png";
function tileImagePath(i){ return `${TILE_ART_DIR}${i + 1}${TILE_ART_EXT}`; }
const TILE_MODEL_DIR = "assets/tiles/models/";
function tileModelPath(i){ return `${TILE_MODEL_DIR}${i + 1}.glb`; }

/* Clockwise path from a tile to Start (a full lap when already on Start). */
function pathToStart(from){
  const n = boardSize(), path = [];
  const dist = (n - from) % n || n;
  let p = from;
  for (let s = 0; s < dist; s++){ p = (p + 1) % n; path.push(p); }
  return path;
}

/* Every problem at once, in the house style — a mis-authored board is content, and content is
   wrong in several places or not at all. Read by the tuning drawer and logged at boot. */
const BOARD_CORNERS = ["premiere", "spa", "gala", "scoop"];
function validateBoard(seasonIdx){
  const errs = [];
  const s = BOARD_SEASONS[seasonIdx == null ? ((typeof state !== "undefined" && state && state.season) | 0) : seasonIdx];
  if (!s || !Array.isArray(s.tiles)) return ["No board defined for this Season."];
  const t = s.tiles, n = t.length;
  if (n < 4) errs.push(`A board needs at least 4 tiles; this one has ${n}.`);
  if (n % 4) errs.push(`A board must divide by 4 so its four sides are equal; ${n} does not.`);
  const per = n / 4;
  BOARD_CORNERS.forEach((c, k) => {
    const at = k * per;
    const got = String(t[at] || "").split(":")[0];
    if (got !== c) errs.push(`Tile ${at} should be the "${c}" corner but is "${got}".`);
  });
  t.forEach((entry, i) => {
    const type = String(entry).split(":")[0];
    const isCorner = BOARD_CORNERS.includes(type);
    if (isCorner && i % per) errs.push(`"${type}" is a corner but sits at tile ${i}, which is not one.`);
    if (!isCorner && !TILE_POOLS[type]) errs.push(`Tile ${i} is "${type}", which is neither a corner nor a pool.`);
    if (type === "npc" && !String(entry).includes(":")) errs.push(`Tile ${i} is an NPC tile with nobody on it.`);
  });
  return errs;
}
