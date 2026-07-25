"use strict";
/* Standard tile — pays its printed coin value (position-weighted, rises around the board). */
class StandardTile extends Tile {
  valueLabel(i){ return String(Math.round(cfg.stdBase*stdWeights[i])); }
  onLand({pos,mult,bs}){
    const c=cfg.stdBase*stdWeights[pos]*bs*mult;
    return [this.gainCoins(c)];
  }
}
registerTile("standard",StandardTile);
