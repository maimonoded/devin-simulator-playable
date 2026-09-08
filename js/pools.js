"use strict";
/* The draw — one system, many pools.

   Content is assets/pools/pools.js. This is the engine: it picks an outcome and says what it is.
   Turning that outcome into events the UI can play is js/tiles/pool-tile.js, because that is a
   landing and landings return event lists.

   GDD §3.2. Every tile draws; the tile only decides WHICH table. That is the whole of the tile
   system now, and the payoff is that a new tile type is a row in TILE_POOLS rather than a file
   in js/tiles/.

   ---- the one thing to be careful about ----

   A pool is a weighted table read by weighted() (js/util.js), which walks the rows subtracting a
   random slice of the total. It is therefore correct for any positive weights and silently wrong
   for a table whose weights sum to zero — it would always return the last row. validate() is
   what stops that reaching the board, and it runs at boot and in the tuning drawer rather than
   only in the tests, because a mis-authored pool looks exactly like bad luck. */

const POOL_KINDS = ["money", "card", "clue", "move", "energy", "event"];

const Pools = {
  keys(){ return Object.keys(POOLS); },
  table(key){ return POOLS[key] || null; },
  /* Which pool a tile type draws from, or null for the four corners — they are functions, not
     tables (§3.4), and a corner that drew from a pool would stop being a landmark. */
  keyFor(type){ return TILE_POOLS[type] || null; },

  /* One draw. Returns the row itself — the caller reads `kind` and whatever that kind carries.
     Null for a tile with no pool, which is the corners and is not an error. */
  draw(key){
    const t = this.table(key);
    if (!t || !t.length) return null;
    return weighted(t);
  },
  drawAt(i){ return this.draw(tilePool(i)); },

  /* What share of this pool is a given kind, 0-1. The drawer prints it, and the economy model
     will want it once it grows a tab for the pools — a weight means nothing without its total. */
  shareOf(key, kind){
    const t = this.table(key);
    if (!t || !t.length) return 0;
    const total = t.reduce((a, r) => a + (+r.weight || 0), 0);
    if (total <= 0) return 0;
    return t.filter(r => r.kind === kind).reduce((a, r) => a + (+r.weight || 0), 0) / total;
  },
  /* The same share across the whole BOARD, weighted by how many tiles point at each pool. This
     is the number that actually sets pacing — a 52% clue pool on six of forty tiles is a 7.8%
     clue rate per roll, and it is the second number that anyone tuning §6.6 needs. */
  boardShareOf(kind){
    const n = boardSize();
    if (!n) return 0;
    let acc = 0;
    for (let i = 0; i < n; i++){
      const key = tilePool(i);
      if (key) acc += this.shareOf(key, kind);
    }
    return acc / n;
  },

  /* Every problem at once. Nothing calls this in the game loop; boot() and the drawer do. */
  validate(){
    const errs = [];
    this.keys().forEach(key => {
      const t = this.table(key);
      if (!Array.isArray(t) || !t.length) return errs.push(`Pool "${key}" is empty.`);
      const total = t.reduce((a, r) => a + (+r.weight || 0), 0);
      if (!(total > 0)) errs.push(`Pool "${key}" has no positive weight, so every draw would return its last row.`);
      t.forEach((r, k) => {
        const where = `Pool "${key}" row ${k} ("${r.name || "unnamed"}")`;
        if (!r.name) errs.push(`${where} has no name — the log and the card face both print it.`);
        if (!(+r.weight > 0)) errs.push(`${where} has no weight, so it can never be drawn.`);
        if (!POOL_KINDS.includes(r.kind)) errs.push(`${where} has kind "${r.kind}", which is not one of ${POOL_KINDS.join(", ")}.`);
        if (r.kind === "money" && !(typeof r.amount === "number" && r.amount !== 0))
          errs.push(`${where} is money and needs a non-zero amount.`);
        if (r.kind === "energy" && !(+r.amount > 0)) errs.push(`${where} is energy and needs a positive amount.`);
        if (r.kind === "move" && !["start", "npc"].includes(r.to))
          errs.push(`${where} is a move and needs to: "start" or "npc".`);
      });
    });
    /* Every tile type the board actually uses has to have somewhere to draw from. */
    const seen = new Set();
    for (let i = 0; i < boardSize(); i++) seen.add(tileType(i));
    seen.forEach(type => {
      if (BOARD_CORNERS.includes(type)) return;
      const key = this.keyFor(type);
      if (!key) errs.push(`Tile type "${type}" is on the board but points at no pool.`);
      else if (!this.table(key)) errs.push(`Tile type "${type}" points at pool "${key}", which does not exist.`);
    });
    return errs;
  },
};
