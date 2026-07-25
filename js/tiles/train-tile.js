"use strict";
/* Train tile — variable coin bonus drawn from TRAIN_MULT, normalised so EV == cfg.trainEV.
   Presents a blocking Collect popup (auto-closes after cfg.collectMinSec–collectMaxSec). */
class TrainTile extends Tile {
  get icon(){ return "🚗"; }
  onLand({mult,bs}){
    const pick=weighted(TRAIN_MULT.map(x=>({weight:x.w,m:x.m})));
    const c=cfg.trainEV*(pick.m/trainMean)*bs*mult;
    const ev=this.gainCoins(c,"🚗 +"+fmt(c));
    ev.log={icon:"🚗",msg:`Train bonus · +<b>${fmt(c)}</b> coins`};
    return [ev,this.collect("+"+fmt(c),"Train bonus")];
  }
}
registerTile("train",TrainTile);
