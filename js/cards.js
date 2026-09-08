"use strict";
/* Cards — the Season catalogue, what you own of it, and what owning it is worth.

   Content is assets/cards/cards.js. This is the engine.

   ---- the collection is not a gate ----

   GDD §4. Cards used to unlock episodes; clues do that now (js/clues.js). What is left is a
   catalogue you are never finished with, and the freedom that buys is the whole point: a card
   can be rare without being a wall, a set can be a target without being a requirement, and a
   run of bad luck costs you Status rather than the story.

   §4.4 is explicit and worth defending: **a set NEVER gates anything.** Completing one pays a
   bonus and a display piece. A player who completes none is poorer, never stuck.

   ---- three copies convert ----

   §4.3, and it is the rule that makes a duplicate worth pulling. Copies of a card accumulate;
   the THIRD converts it into that card's Collectible, which is what pays Status by rarity. Past
   the third, copies trickle Status directly, so no pull is ever dead — GDD §12 lists that as one
   of three non-negotiable mitigations for a game where both tracks are random.

   Nothing about conversion is stored. `state.cards` is copies held, and converted is
   `count >= cfg.cardCopiesToConvert`. One number, one derivation, nothing to drift. The
   Collectible those copies convert INTO is not stored either — it is synthesised from the
   catalogue on demand (collectibleOf, below), the way a trophy is (js/status.js).

   ---- ownership is Season-wide and permanent ----

   Not per-arc, and not cleared by a Season reset (§5.3) — the Season's board, cards and cast
   change, and the collection carries. Which is why a card id has to be unique across Seasons
   and not merely within one; validate() refuses a clash, because the failure mode is two
   different cards silently merging into one pile. */

const Cards = {
  /* ---------------- content ---------------- */
  seasonIdx() {
    const i = (typeof state !== "undefined" && state && state.season) | 0;
    return CARD_SEASONS[i] ? i : 0;
  },
  season(n) { return CARD_SEASONS[n == null ? this.seasonIdx() : n] || CARD_SEASONS[0] || null; },
  sets(n) { const s = this.season(n); return (s && s.sets) || []; },
  setOf(key, n) { return this.sets(n).find(s => s.key === key) || null; },
  /* Every card in the Season, in authored order. */
  all(n) { return this.sets(n).reduce((a, s) => a.concat(s.cards), []); },
  /* A card by id, anywhere in any Season — ownership outlives a Season, so a lookup has to too.

     ---- AND THEN THE SAVE, IF THE CATALOGUE CANNOT ANSWER ----

     A save is a bag of id strings and it outlives any particular version of
     assets/cards/cards.js. Rename a card, re-cut a set, ship a Season that reshuffles an older
     one, and a held id stops resolving. Dropping it would silently delete pulls the player
     earned; keeping it but not knowing what it WAS is nearly as bad, because everything a card
     is worth — its Status on conversion, its trickle, its duplicate coins — is read off its
     rarity, and an unresolvable card would quietly fall back to Common. A converted Legendary
     would go from 400 points to 10 without a word.

     So `state.cardMeta` remembers what the catalogue said at the moment each card was banked.
     THE CATALOGUE ALWAYS WINS while it can answer — this is a fallback, not a second source of
     truth, so "derive, don't store" still holds for every normal path. It is consulted only
     when the content is gone, which is exactly when there is nothing left to derive from. */
  get(id) {
    for (let n = 0; n < CARD_SEASONS.length; n++) {
      const hit = this.all(n).find(c => c.id === id);
      if (hit) return hit;
    }
    return this.remembered(id);
  },
  /* What the save knows about a card the catalogue no longer defines. `lost` marks it so a
     caller can say so rather than pretending it is ordinary. */
  remembered(id) {
    const m = (state.cardMeta || {})[id];
    if (!m) return null;
    return { id, name: m.name || id, rarity: m.r || CARD_RARITIES[0].key, sub: m.set || "", lost: true };
  },
  /* Everything held that this build's catalogue cannot explain. Nothing in the game loop needs
     it; the collection shows them so the player can see they were kept, not lost. */
  lostIds() {
    const known = new Set();
    CARD_SEASONS.forEach((s, n) => this.all(n).forEach(c => known.add(c.id)));
    return Object.keys(state.cards || {}).filter(id => !known.has(id));
  },
  lostCards() { return this.lostIds().map(id => this.remembered(id)).filter(Boolean); },
  /* Which set a card belongs to, and which Season — both derived, neither stored on the card,
     so moving a card between sets is a one-line edit in the catalogue. */
  setForCard(id) {
    for (let n = 0; n < CARD_SEASONS.length; n++) {
      const hit = this.sets(n).find(s => s.cards.some(c => c.id === id));
      if (hit) return hit;
    }
    return null;
  },
  rarities() { return CARD_RARITIES; },
  rarity(key) { return CARD_RARITIES.find(r => r.key === key) || CARD_RARITIES[0]; },
  rarityOf(id) { const c = this.get(id); return c ? this.rarity(c.rarity) : CARD_RARITIES[0]; },
  /* What a card pays the FIRST time you see it — a fraction of what converting it pays, so a
     Legendary still feels like a Legendary on the way in.

     This exists as its own function because TWO places must agree on it and they are far apart:
     add() reports it so the beat can show it, and statusPoints() DERIVES it so the track
     actually holds it. Status is never accumulated, only derived (CLAUDE.md), so a value that
     only add() knew about would flash on screen and then vanish on the next render. */
  /* WHAT ONE COPY IS WORTH — the same for all three of them.

     The three copies used to pay 25% / nothing / 100%: a nudge, a dead beat, and the payoff.
     That made the second copy the only thing in the game you could pull and be paid nothing
     for, which was survivable while it was invisible and absurd once the beat started stopping
     the board on it with an n-of-3 counter and a blank where the number should be.

     Three equal payments instead. A copy is a copy: each one did the same job of getting you
     one nearer, so each one is worth the same, and the rarity's `status` stays what it always
     meant — WHAT THE WHOLE COLLECTIBLE IS WORTH, now split across the copies that make it
     rather than loaded onto the last.

     Rounded per copy, so three of them can come to a point or two under `status` (a Common is
     3+3+3=9 against 10). Equality is the property that matters here and exactness is not: the
     drift is under 1% of a Season and it never favours the house by more than a rounding
     error. Copies PAST the third still trickle, which is unchanged. */
  copyStatus(r) {
    const rr = (r && r.key) ? r : this.rarity(r);
    const share = +cfg.statusCopyShare;
    /* Defaults to an even split when the knob is absent or nonsense, so the rarity table's
       `status` keeps meaning what the whole Collectible is worth. */
    const f = share > 0 ? share : 1 / this.copiesToConvert();
    return Math.round((rr.status || 0) * f);
  },
  /* Kept as the old name for anything still asking. Same number now — there is no longer a
     "first copy" rate distinct from any other copy's. */
  firstCopyStatus(r) { return this.copyStatus(r); },

  /* Coins every copy pays, scaled by the roll stake. state.mult is the multiplier the player is
     playing at; it persists between rolls, so it is still the right answer for a box opened in
     the store where no roll happened. Clamped at 1 so a corrupt save cannot zero it. */
  cardCoins() {
    return Math.round((+cfg.cardCoins || 0) * Math.max(1, +state.mult || 1) * (+cfg.boardScale || 1));
  },
  /* The badge every card face wears. Stars, not the rarity's name: ★★★ against ★★ needs no
     prior knowledge of which of "Epic" and "Rare" is the better word. Takes a rarity object or
     a key, so both paths can call it with whatever they are already holding. */
  stars(r) {
    const rr = (r && r.key) ? r : this.rarity(r);
    return "\u2605".repeat(Math.max(1, Math.min(9, rr.rank | 0)));
  },
  /* THE SAME COUNT, IN A DIFFERENT GLYPH. A trophy card wears cups where a memory wears stars,
     so the badge says WHICH KIND at a glance and still says how hard it was to get — one mark
     doing both jobs rather than a kind-label bolted next to a rarity-label. Counting is why the
     stars work at all ("is an Epic better than a Rare" is a question; three against two is not),
     and the count survives the swap. */
  cups(r) {
    const rr = (r && r.key) ? r : this.rarity(r);
    return "\ud83c\udfc6".repeat(Math.max(1, Math.min(9, rr.rank | 0)));
  },
  /* One of the twelve case photographs, chosen by hashing the seed — an episode id plus a clue
     id. Nothing is stored, so a clue keeps its photograph across reloads and across saves; see
     the note on CLUE_ART in assets/cards/cards.js for why they are generic. */
  clueArt(seed) {
    const f = CLUE_ART.files;
    let h = 0; const s = String(seed || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return CLUE_ART.dir + f[h % f.length] + ".webp";
  },
  /* Painted art, or null for the procedural face. Absent art is the NORM, not a gap: ninety
     Commons of generated art would cost more to make than they would ever be looked at. */
  artFor(card) {
    if (!card || !card.art) return null;
    for (let n = 0; n < CARD_SEASONS.length; n++) {
      if (this.all(n).some(c => c.id === card.id)) return (this.season(n).art || "") + card.art;
    }
    return null;
  },

  /* ---------------- ownership ---------------- */
  copiesToConvert() { return Math.max(1, Math.round(+cfg.cardCopiesToConvert || 1)); },
  /* THE TWO KINDS IN ONE CATALOGUE (§4.1). A set interleaves the MEMORY — a moment from the
     episodes — with the TROPHY, an aspirational object: the watch, the necklace, the villa.
     Twenty of the forty-eight are trophies, and they are marked in the catalogue rather than
     derived, because which kind a card is is an authoring decision and nothing about a silk
     scarf's id, rarity or set can be read to work it out.

     Absent means memory, so the field only appears on the twenty. That is deliberate: it keeps
     the common case unannotated and makes the annotation mean something. */
  isStatusCard(id) {
    const c = this.get(id);
    return !!(c && c.kind === "status");
  },
  count(id) { return Math.max(0, (state.cards || {})[id] | 0); },
  has(id) { return this.count(id) > 0; },
  converted(id) { return this.count(id) >= this.copiesToConvert(); },
  /* Distinct cards held / converted, this Season. The collection's two headline numbers. */
  owned(n) { return this.all(n).filter(c => this.has(c.id)).length; },
  convertedCount(n) { return this.all(n).filter(c => this.converted(c.id)).length; },
  poolSize(n) { return this.all(n).length; },

  /* Bank one copy. Mutates state and returns what the presentation needs to say about it —
     never what to pay, which has already been paid. THE ENGINE OWNS THE MONEY.

       isNew      first copy
       converted  this copy was the one that turned it into a Collectible
       coins      duplicate consolation, already added
       status     Status points, already earned by the conversion or the trickle */
  add(id, n) {
    const many = Math.max(1, Math.round(n || 1));
    if (!state.cards) state.cards = {};
    /* Remember what this card WAS, once, while the catalogue can still say. See get(). */
    this.remember(id);
    const before = this.count(id);
    state.cards[id] = before + many;
    const after = state.cards[id];
    const need = this.copiesToConvert();
    const r = this.rarityOf(id);
    const isNew = before === 0;
    const converted = before < need && after >= need;
    let coins = 0, status = 0;
    /* EVERY COPY THAT BUILT THE COLLECTIBLE PAYS THE SAME, including the one that completes it.
       Counted across the jump so add(id, 3) pays exactly what three separate calls would. */
    const building = Math.max(0, Math.min(after, need) - Math.min(before, need));
    if (building > 0) status += building * this.copyStatus(r);
    /* Copies past the conversion point trickle, and only those — counted across the whole jump
       so add(id, 5) pays exactly what five separate calls would. */
    const extra = Math.max(0, after - Math.max(before, need));
    if (extra > 0) status += extra * r.trickle;
    /* A copy that neither started the collection nor converted it still pays. That is the whole
       of §12's first rule: a duplicate always converts to something. */
    const paying = many - (isNew ? 1 : 0) - (converted ? 1 : 0);
    if (paying > 0) coins = Math.round(paying * (+cfg.dupCoins || 0) * r.dup * (+cfg.boardScale || 1));
    /* And EVERY copy pays a little money on top, at the stake the player is rolling at — so a
       x3 roll is worth three times as much on the cards it turns up, not only on the money. */
    coins += many * this.cardCoins();
    state.coins += coins;
    return { id, card: this.get(id), isNew, converted, count: after, coins, status, rarity: r };
  },

  /* Write the fallback record. Only for a card the catalogue currently defines — there is
     nothing to remember about one it cannot describe, and overwriting a good record with a
     guess would defeat the point. Idempotent, so calling it on every add costs nothing. */
  remember(id) {
    if (!state.cardMeta) state.cardMeta = {};
    let card = null;
    for (let n = 0; n < CARD_SEASONS.length && !card; n++) card = this.all(n).find(c => c.id === id) || null;
    if (!card) return null;
    const set = this.setForCard(id);
    state.cardMeta[id] = { r: card.rarity, name: card.name, set: set ? set.name : "" };
    return state.cardMeta[id];
  },

  /* ---------------- the Collectible (§4.3) ----------------

     "Three copies of a card convert into THAT CARD'S Collectible item. The item is the object
     that carries Status value and displays in the collection." The item had never been an
     object: conversion set a boolean, paid points by rarity, and left nothing to look at. So a
     player's Collectibles — the whole point of collecting — could not be listed, shown or put on
     a shelf, because there was nothing to put there.

     SYNTHESISED, NEVER STORED, exactly like a trophy (Status.trophyOf). Everything a Collectible
     is made of — its name, its art, what it is worth, which set it belongs to — is already in
     the catalogue, and the one fact that is not (do you have three?) is already the copy count.
     A stored item would be a second source of truth for something wholly derivable, and it would
     have to be migrated into every existing save. Conversion stays `count >= copiesToConvert()`.

     THE ITEM EXISTS WHETHER OR NOT IT HAS BEEN EARNED — collectibleOf() describes the card's
     Collectible, collectibleIds() says which ones the player actually holds. That split is what
     lets §4.4's set display piece be a piece the player has not converted, and lets a locked
     slot show what it would be. */
  collectibleOf(id) {
    const card = this.get(id);
    if (!card) return null;
    const r = this.rarity(card.rarity);
    /* A card the catalogue has forgotten still has a Collectible: get() falls through to the
       save's own record (see get()), so a converted Legendary from a retired Season keeps its
       name and its 400 points instead of quietly becoming an anonymous Common. setForCard()
       cannot answer for it, which is what `sub` on the remembered card is for. */
    const set = this.setForCard(id);
    return {
      id,
      name: card.name,
      art: this.artFor(card),
      /* WHAT THE COLLECTIBLE IS WORTH — the three copies added up, not the rarity's headline
         number. They are the same figure to within a rounding point (a Common's three 3s make 9
         against a status of 10), but only one of them is what the track actually received, and
         the plaque is read side by side with the copy that just paid. Two numbers for one event
         is worse than a number one lower. */
      points: this.copiesToConvert() * this.copyStatus(r),
      rarity: r,
      setKey: set ? set.key : "",
      setName: set ? set.name : (card.sub || ""),
    };
  },
  /* Every Collectible the player holds, in CATALOGUE order — iterated over the content and not
     over state.cards, because the object of the exercise is a display and a shelf that reorders
     itself as cards land is not a collection. Every Season, not just the current one: ownership
     outlives a Season reset (§5.3), and so does the Showcase.

     Cards the catalogue has forgotten come last, in whatever order the save holds them. There is
     no authored position left to put them in, and dropping them would make a shelf that silently
     shrinks when content is re-cut. */
  collectibleIds() {
    const need = this.copiesToConvert();
    const out = [];
    CARD_SEASONS.forEach((s, n) => this.all(n).forEach(c => { if (this.count(c.id) >= need) out.push(c.id); }));
    this.lostIds().forEach(id => { if (this.count(id) >= need) out.push(id); });
    return out;
  },
  collectibleCount() { return this.collectibleIds().length; },

  /* ---------------- drawing ----------------
     A rarity by weight (§4.2's 60/25/12/3), then uniform within it. `floor` is a pack's rarity
     guarantee: draws at that rarity or better, which is how §4.5's Premium and Insider packs
     differ from Standard without needing tables of their own.

     A rarity with nothing left in it falls DOWN to the next one rather than returning null — a
     draw that pays nothing is the one outcome a collection game cannot afford. */
  draw(floor) {
    const stocked = CARD_RARITIES.filter(r => this.all().some(c => c.rarity === r.key));
    if (!stocked.length) return null;
    const min = floor ? this.rarity(floor).rank : 0;
    /* THE FLOOR FALLS DOWN. A Season with nothing authored above the floor still has to hand
       something over: a draw that pays nothing is the one outcome a collection game cannot
       afford, and a pack whose guarantee is unmeetable is a bug in the content, not a reason to
       punish the player who opened it. */
    let usable = stocked.filter(r => r.rank >= min);
    if (!usable.length) usable = stocked;
    const pick = weighted(usable.map(r => ({ key: r.key, weight: r.weight }))) || usable[usable.length - 1];
    let pool = this.all().filter(c => c.rarity === pick.key);
    if (!pool.length) pool = this.all();
    if (!pool.length) return null;
    return pool[Math.floor(rand(0, pool.length))];
  },
  /* Draw one and bank it — the shape every source of cards actually wants. */
  drawAndAdd(floor) {
    const card = this.draw(floor);
    return card ? this.add(card.id, 1) : null;
  },

  /* ---------------- sets ----------------
     A set is complete when every card in it is OWNED. Not converted: thirty copies is a
     different game, and §4.4 describes a collection target, not an endurance one. */
  setProgress(key, n) {
    const s = this.setOf(key, n);
    if (!s) return [0, 0];
    return [s.cards.filter(c => this.has(c.id)).length, s.cards.length];
  },
  setComplete(key, n) {
    const [got, need] = this.setProgress(key, n);
    return need > 0 && got === need;
  },
  setClaimed(key) { return !!(state.setsDone || {})[key]; },
  /* Every set finished but not yet paid for. Derived, so the sweep is idempotent and a missed
     one is only a delayed toast. */
  unclaimedSets(n) {
    return this.sets(n).filter(s => this.setComplete(s.key, n) && !this.setClaimed(s.key));
  },
  /* §4.4's DISPLAY PIECE: the set's centrepiece, which is its rarest card's Collectible. It is
     the object §5.2 means by a "set centrepiece" — the one thing on the Showcase that says you
     finished a set rather than got lucky once, and the reason the set is worth chasing when it
     gates nothing.

     The RAREST card, not a new object of its own: a set that finished with a Legendary in it
     should be remembered by the Legendary. Ties go to the first authored, so the piece is stable
     the moment the catalogue is written rather than depending on which copy landed last.

     Earned by COMPLETING the set, so it does not ask whether that card has converted — the
     three-copy rule prices Status, and this is a display object, which is why claimSet() pays no
     extra points for it. The bonus is cfg.setBonusStatus and it always was. */
  setCentrepiece(key, n) {
    const s = this.setOf(key, n);
    if (!s || !s.cards.length) return null;
    let best = s.cards[0];
    s.cards.forEach(c => { if (this.rarity(c.rarity).rank > this.rarity(best.rarity).rank) best = c; });
    return this.collectibleOf(best.id);
  },
  /* Pay for one. Coins and Status, and a record that it has been paid — that record is the ONE
     thing about a set that has to be stored, because "was this bonus already given" is not
     derivable from a collection that only ever grows.

     `piece` rides on the result rather than being looked up again by the caller, because a set
     is claimed once and the announcement is the only moment the piece is ever handed over. */
  claimSet(key) {
    const s = this.setOf(key);
    if (!s || !this.setComplete(key) || this.setClaimed(key)) return null;
    if (!state.setsDone) state.setsDone = {};
    state.setsDone[key] = state.day | 0;
    const coins = Math.round((+cfg.setBonusCoins || 0) * (+cfg.boardScale || 1));
    state.coins += coins;
    return { key, set: s, coins, status: Math.round(+cfg.setBonusStatus || 0),
             piece: this.setCentrepiece(key) };
  },
  completedSets(n) { return this.sets(n).filter(s => this.setComplete(s.key, n)); },

  /* ---------------- what the collection is worth ----------------
     GDD §5.1's first inflow. Derived from the copies held and nothing else, so it can never
     disagree with the album. */
  statusPoints() {
    const need = this.copiesToConvert();
    let pts = 0;
    Object.keys(state.cards || {}).forEach(id => {
      const c = this.count(id);
      if (c <= 0) return;
      const r = this.rarityOf(id);
      /* The same rule add() pays by: every copy that built the Collectible is worth the same,
         and copies past it trickle. THIS IS THE AUTHORITY — status is derived and never
         accumulated (CLAUDE.md), so if this and add() disagree the beat shows one number and
         the track moves by another. They are two readings of one rule; change them together. */
      pts += Math.min(c, need) * this.copyStatus(r);
      if (c > need) pts += (c - need) * r.trickle;
    });
    Object.keys(state.setsDone || {}).forEach(() => { pts += Math.round(+cfg.setBonusStatus || 0); });
    return pts;
  },

  /* ---------------- validation ----------------
     Every problem at once. Composition is a BALANCE decision (§4.6's 90/38/18/4), and a typo in
     it is invisible in play — the game would simply feel slightly wrong for a whole Season. */
  validate() {
    const errs = [];
    const seen = new Map();
    CARD_SEASONS.forEach((s, n) => {
      if (!Array.isArray(s.sets) || !s.sets.length) return errs.push(`Season ${n + 1} has no sets.`);
      s.sets.forEach(set => {
        const where = `Season ${n + 1} set "${set.key}"`;
        if (!set.key) errs.push(`${where} has no key.`);
        if (!set.name) errs.push(`${where} has no name — the collection prints it.`);
        if (!Array.isArray(set.cards) || !set.cards.length) return errs.push(`${where} has no cards.`);
        set.cards.forEach(c => {
          const w = `${where} card "${c.id || "unnamed"}"`;
          if (!c.id) errs.push(`${w} has no id.`);
          if (!c.name) errs.push(`${w} has no name.`);
          if (!CARD_RARITIES.some(r => r.key === c.rarity)) errs.push(`${w} has rarity "${c.rarity}", which does not exist.`);
          /* Across Seasons, not within one: ownership outlives a Season reset, so a reused id
             would merge two different cards into one pile. */
          if (seen.has(c.id)) errs.push(`${w} reuses an id already used by ${seen.get(c.id)}.`);
          else seen.set(c.id, where);
          /* A typo'd kind is invisible in play: the card simply stops being a trophy, loses its
             longer beat and its n-of-3 counter, and looks like an ordinary memory card. Nothing
             throws and nothing is missing — exactly the failure this validator exists for. */
          if (c.kind !== undefined && c.kind !== "status")
            errs.push(`${w} has kind "${c.kind}"; the only kind is "status" (absent means a memory card).`);
        });
      });
    });
    const total = CARD_RARITIES.reduce((a, r) => a + r.weight, 0);
    if (total !== 100) errs.push(`Rarity weights sum to ${total}, not 100 — a row no longer reads as a percentage.`);
    CARD_RARITIES.forEach(r => {
      if (!(r.weight > 0)) errs.push(`Rarity "${r.key}" has no weight, so it can never drop.`);
      if (!CARD_SEASONS.some((s, n) => this.all(n).some(c => c.rarity === r.key)))
        errs.push(`Rarity "${r.key}" exists but no card is authored at it.`);
    });
    return errs;
  },
};
