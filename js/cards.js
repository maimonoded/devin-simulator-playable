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
   `count >= cfg.cardCopiesToConvert`. One number, one derivation, nothing to drift.

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
  firstCopyStatus(r) {
    const rr = (r && r.key) ? r : this.rarity(r);
    return Math.round((rr.status || 0) * Math.max(0, +cfg.statusFirstCopy || 0));
  },
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
    /* Copies past the conversion point trickle, and only those — counted across the whole jump
       so add(id, 5) pays exactly what five separate calls would. */
    const extra = Math.max(0, after - Math.max(before, need));
    let coins = 0, status = 0;
    if (converted) status += r.status;
    if (extra > 0) status += extra * r.trickle;
    /* THE FIRST COPY MOVES THE TRACK. Before this, a card you had never seen paid nothing at
       all — you could collect for an entire session and watch the status bar sit still, which
       is exactly backwards for the thing the bar is meant to reward. Conversion is still the
       payoff; this is the nudge that says the pull mattered. */
    if (isNew) status += this.firstCopyStatus(r);
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
  /* Pay for one. Coins and Status, and a record that it has been paid — that record is the ONE
     thing about a set that has to be stored, because "was this bonus already given" is not
     derivable from a collection that only ever grows. */
  claimSet(key) {
    const s = this.setOf(key);
    if (!s || !this.setComplete(key) || this.setClaimed(key)) return null;
    if (!state.setsDone) state.setsDone = {};
    state.setsDone[key] = state.day | 0;
    const coins = Math.round((+cfg.setBonusCoins || 0) * (+cfg.boardScale || 1));
    state.coins += coins;
    return { key, set: s, coins, status: Math.round(+cfg.setBonusStatus || 0) };
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
      /* Holding it at all pays the first-copy value — the same number add() reported when it
         landed. Derived from the count, so it survives a reload with nothing stored. */
      pts += this.firstCopyStatus(r);
      if (c >= need) pts += r.status + (c - need) * r.trickle;
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
