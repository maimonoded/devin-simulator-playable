"use strict";
/* The card shoe — what the player pulls from. Replaces the dice.

   A PACK is cfg.packSize cards: the numbers 1..12 four times over, plus exactly
   cfg.ticketsPerPack ticket cards, shuffled. A number is how many tiles the token moves; a
   ticket ("T") moves nothing and fills a ticket slot instead.

   THE SHOE IS A REAL SHOE — an array of concrete card values, not a count and not a seed plus a
   draw index. Two reasons, both learned the hard way elsewhere in this repo:
     · a seed only re-derives the same cards under an identical RNG, so the tests' withRandom
       and any future change to rand() would silently re-deal a player's remaining cards;
     · a bare count cannot express "2 tickets left among 37 cards", which IS the ticket-density
       invariant. You have to be able to look at the shoe and see the tickets in it.

   THE INVARIANT: exactly cfg.ticketsPerPack tickets per cfg.packSize cards obtained, however
   they were obtained. Buying deals a whole pack. Free regen deals cards ONE AT A TIME off
   state.packTail — the undealt remainder of a pack minted earlier — so a trickle of free cards
   carries its proper share of tickets and a session boundary cannot round them away. There is
   no path in this file that mints a loose card outside a pack.

   CARDS MAY EXCEED THE CAP. This is the old "energy may exceed the cap" rule (CLAUDE.md), and
   the rework makes it matter far more, not less: energy only overflowed via the store, but a
   bought pack merges onto whatever is left of the previous one, so overflow is the ordinary
   path. dealFree() tops up TOWARD cfg.packSize and never reduces; buyPack() never clamps at
   all. Nothing anywhere may clamp the shoe downward.

   No DOM, no presentation. js/ui/shoe3d.js draws it. */
/* ---------------------------------------------------------------------------
   THE CARD VOCABULARY

   A card is a short string, not a number: a suit letter plus a rank, or a joker.

       "s7"   the 7 of Stars          s  star     ⭐  the Walk of Fame
       "h13"  the 13 of Hearts        h  heart    ❤️  love and romance
       "d1"   the 1 of Diamonds       d  diamond  💎  the real stone, not the flat pip
       "m9"   the 9 of Masks          m  mask     🎭  the drama itself
       "J1"   Victoria, the Joker     J  joker    the two leads of the show
       "J2"   Simon, the Joker

   A pack is four suits of 1–13 (52 cards) plus the jokers. The RANK is how many tiles the token
   moves, so a card is worth 1 to 13. A joker moves nothing: it is the ticket.

   THE 52 ARE FIXED AND THE JOKERS ARE ADDED ON TOP, so the pack SIZE follows the joker count
   rather than competing with it: two jokers make the natural 54, and the shipped ten make 62.
   Nothing here assumes two, and nothing downstream may — read jokerCount(), never a constant.
   There are five of each lead at ten, since mintPack deals them round-robin from JOKERS.

   Strings rather than {suit, rank} objects because the shoe is persisted verbatim and read by
   eye in a saved payload — ["s7","J1","m13"] says what it is, where a list of objects is four
   times the size and a list of bare numbers cannot say which suit it was. Rank is parsed on
   demand rather than cached; it is a slice and a parseInt on a two-character string, and the
   alternative is two representations of the same card that can disagree. */
const SUITS = ["s", "h", "d", "m"];
const RANKS = 13;

const Shoe = {
  SUITS,
  /* The joker ids, in order. Index 0 is the first-named lead. */
  JOKERS: ["J1", "J2"],
  /* Kept as a name for the ticket concept, but a ticket IS a joker now — see isTicket. */
  TICKET: "J1",

  /* ---------- how big a pack is ----------

     THE NUMBERED DECK IS A CONSTANT. Four suits of 1..13, once each, always — it is a real deck
     and the ranks are the game's whole step distribution, so they are not something a knob may
     quietly eat into.

     SO PACK SIZE IS DERIVED, NEVER SET. A pack is the 52 numbered cards PLUS however many jokers
     the economy asks for: ten jokers make a pack of 62, not a pack of 54 with the 12s and 13s
     knocked out to make room. One number is the input (the joker count) and the other follows
     from it, so the two can never disagree — and raising the joker count can no longer change
     how far the token moves, which is a coupling nothing at the call site would have shown you.

     cfg.packSize is this value CACHED, for everything downstream that reads a cap: the HUD, the
     free-card deal, advanceSession. Economy.apply() is what puts it there, and it is in
     OWNED_CFG_KEYS so a stale save cannot pin an old size. Nothing writes it by hand. */
  NUMBERED: SUITS.length * RANKS,
  jokerCount(){ return Math.max(0,Math.round(cfg.ticketsPerPack||0)); },
  packSize(){ return this.NUMBERED + this.jokerCount(); },

  /* One pack: every numbered card plus the jokers, shuffled. No trimming and no padding — there
     is nothing to reconcile any more, because the size is whatever this deals rather than a
     target it has to hit. Minting is also what walks the cost curve — see Economy.packPrice. */
  mintPack(){
    const tix=this.jokerCount();
    const cards=[];
    for(let r=1;r<=RANKS;r++) for(const su of SUITS) cards.push(su+r);
    for(let k=0;k<tix;k++) cards.push(this.JOKERS[k%this.JOKERS.length]);
    state.ticketsPriced=(state.ticketsPriced|0)+tix;
    return shuffle(cards);
  },

  /* ---------- reading a card ---------- */
  isTicket(card){ return typeof card==="string" && card[0]==="J"; },
  /* How many tiles this card moves the token. A joker moves nothing. */
  rank(card){ return this.isTicket(card)?0:(parseInt(String(card).slice(1),10)||0); },
  /* "star" | "heart" | "diamond" | "mask" | "joker" — the word the art layer keys off. */
  suitOf(card){
    if(this.isTicket(card)) return "joker";
    return {s:"star",h:"heart",d:"diamond",m:"mask"}[String(card)[0]] || "star";
  },
  /* Which joker: 0 or 1. Only meaningful for a joker. */
  jokerIndex(card){ return Math.max(0,this.JOKERS.indexOf(card)); },
  /* Is this a card this game knows how to deal with? The storage validator's rule, kept here
     so the shape is defined once. */
  isLegal(card){
    if(this.isTicket(card)) return this.JOKERS.includes(card);
    const su=String(card)[0], r=this.rank(card);
    return SUITS.includes(su) && r>=1 && r<=RANKS && String(card)===su+r;
  },

  /* ---------- queries ---------- */
  count(){ return state.shoe.length; },
  isEmpty(){ return state.shoe.length===0; },
  ticketsLeft(){ return state.shoe.filter(c=>this.isTicket(c)).length; },
  /* ---------- what a pack costs ----------

     TWO DIFFERENT PRICES, and keeping them apart is the point.

     priceUsd() is what the PLAYER pays: a deck is a real-money purchase, like tickets and
     unlike anything the board pays out. Coins cannot buy one. Until IAP is wired up the
     purchase simply goes through for free — see buyPack().

     modelPrice() is what the MODEL says a pack is worth in coins, straight off the cost curve.
     Nothing charges it any more, but it is not dead: it is the economy's own accounting of how
     far along the curve a run has got, it is what the Economy panel reports, and it is what a
     future IAP price would be sanity-checked against. Same split as `economy` vs `cfg` — the
     model's number and the live surface are allowed to disagree, as long as nobody confuses
     one for the other. */
  priceUsd(){ return +cfg.deckPriceUsd || 0; },
  modelPrice(){ return Economy.packPrice(state.ticketsPriced); },

  /* ---------- pulling ---------- */
  /* One card off the front, or null when the shoe is empty. Deliberately unguarded, the way
     spendRoll was: every caller gates on isEmpty() first, and the null return is the backstop. */
  pull(){
    if(!state.shoe.length) return null;
    const card=state.shoe.shift();
    state.pulls++;
    return card;
  },

  /* ---------- getting more cards ---------- */
  /* n free cards, dealt off the current pack's undealt tail. This is where energy regen used
     to live, and it is the game's clock.

     Tops up TOWARD the cap and never reduces — a shoe already over cfg.packSize (from a bought
     pack merged onto leftovers) legitimately gets nothing here rather than being trimmed.
     Returns how many were actually dealt. */
  dealFree(n){
    const want=Math.max(0,Math.floor(n||0));
    const room=Math.max(0,Math.round(cfg.packSize||1)-state.shoe.length);
    const take=Math.min(want,room);
    for(let k=0;k<take;k++){
      if(!state.packTail.length) state.packTail=this.mintPack();
      state.shoe.push(state.packTail.shift());
    }
    if(take) state.shoe=shuffle(state.shoe);
    return take;
  },

  /* Buy one pack. MERGES onto whatever is left and reshuffles the whole shoe — never assigns,
     never clamps. A ticket still sitting in the remainder is therefore never destroyed by
     buying, which is the whole reason this merges rather than replaces.

     IT COSTS NOTHING RIGHT NOW, and that is deliberate rather than unfinished: a deck is a
     real-money product and there is no IAP yet, so the purchase completes and the player is not
     charged. It takes no coins — coins have never been able to buy a deck. When IAP lands, the
     charge goes in front of this call, not inside it: this function's job is to hand over the
     cards, and a payment that failed should mean it is never reached.

     Always succeeds, so callers no longer branch on affordability. */
  buyPack(){
    state.shoe=shuffle(state.shoe.concat(this.mintPack()));
    return {usd:this.priceUsd(), size:state.shoe.length};
  },
};
