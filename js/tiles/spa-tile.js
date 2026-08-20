"use strict";
/* Spa corner — grants cards for the shoe, and THE CARD THAT GOT YOU HERE IS THE GRANT.

   Land on the Spa with a 7 and you get 7 cards. That is why `card` is threaded all the way
   from pull() through resolveLandingEvents into the landing context: this is the first tile
   whose payout depends on what was pulled rather than on where the token stopped.

   Three inputs, in the order they are checked:
     · a number card  → its rank, 1..13
     · a joker        → cfg.spaJokerCards, because a joker HAS no rank (it moves nothing, so
                        the rank is 0) and a grant of zero is not a corner
     · no card at all → cfg.spaCards, the old flat grant. Kept because it is economy-owned and
                        imported from the workbook, and because a landing resolved without a
                        card is exactly the case that has nothing else to read.

   IT ALWAYS PAYS — hence gainCards({uncapped:true}). The flat version dealt through dealFree,
   which tops up only TOWARD cfg.packSize and therefore dealt NOTHING to a shoe already at the
   cap: the ordinary state right after buying a pack. The corner announced a card it had not
   given, roughly two thirds of the time. See Shoe.dealExtra for why that is a separate method
   rather than a flag on dealFree.

   Everything shown is built from ev.dealt — what actually landed in the shoe — never from the
   number asked for. */
class SpaTile extends Tile {
  get icon(){ return "💆"; }
  get corner(){ return true; }
  /* How many cards this landing is worth. Exported as a method so the tests can ask directly
     rather than reaching through onLand. */
  grantFor(card){
    if(card==null) return Math.max(0,Math.round(cfg.spaCards||0));
    if(Shoe.isTicket(card)) return Math.max(0,Math.round(cfg.spaJokerCards||0));
    return Shoe.rank(card);
  }
  onLand({card}){
    const n=this.grantFor(card);
    const ev=this.gainCards(n,null,{uncapped:true});
    const got=ev.dealt;
    ev.float.text="💆 +"+got+"🃏";
    ev.log={icon:"💆",msg:`Spa Day · +<b>${got}</b> card${got===1?"":"s"}`};
    return [ev,this.reveal("+"+got+"🃏","Spa Day — the deck is topped up",{positive:true,shower:"cards"})];
  }
}
registerTile("spa",SpaTile);
