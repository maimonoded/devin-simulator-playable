"use strict";
/* The collection — the game's progression engine, and what replaced the builders.

   A BOARD is one turn of the loop: cfg.episodesPerBoard episodes, each unlocked by owning
   cfg.collectiblesPerEpisode named cards. Own all of them and the board is done, the album is
   put away and a fresh set of cards begins on the next board's episodes.

   Content is assets/cards/cards.js. This file owns the maths and the state, touches no DOM,
   and — like js/builders/builders.js before it — is the only thing that knows what "unlocked"
   means.

   ---- three things are derived, not stored ----

   1. THE POOL of a board is the union of its episodes' `needs`. Nothing declares "25 cards";
      the requirements do. A card that can drop but is never wanted, or a requirement naming a
      card that does not exist, is therefore a validate() error rather than a silent hole.

   2. WHICH EPISODES ARE UNLOCKED is read off the albums, not kept in a list. An episode is
      unlocked when every card on its page is owned, and albums are kept per board forever, so
      a board finished twenty boards ago still reports its episodes. This is the same reasoning
      the old Builders.unlockedEpisodeIds() used, and it is what makes an old save work.

   3. WHICH BOARD AN EPISODE BELONGS TO is its position in Episodes.ids(): board n covers the
      slice [(n-1) * perBoard, n * perBoard). So the loop runs exactly as long as there are
      episode files, and running out of them is what ends the run.

   ---- what IS stored ----

   state.albums   { "1": { "char:simon@gold": 2, ... }, "2": { ... } }
   state.boardNum which board is being collected now

   Counts, not a set: a duplicate is a real event the game pays for (js/boxes.js), and knowing
   a card came up three times is the difference between "collected" and "collected, twice over".

   ---- boards past the authored ones ----

   Only board 1 is authored. boardFor(n) past that returns the last authored board re-pointed
   at board n's episodes, so the loop never dead-ends on missing content and authoring board 2
   for real is an entry in cards.js rather than a code change. A derived board reuses the
   template's art, which is honest about what it is: the same cast, a new set to collect. */

const Collection = {
  /* ---------------- shape ---------------- */
  perBoard() { return Math.max(1, Math.round(cfg.episodesPerBoard || 1)); },
  perEpisode() { return Math.max(1, Math.round(cfg.collectiblesPerEpisode || 1)); },
  tiers() { return CARD_TIERS; },
  tier(key) { return CARD_TIERS.find(t => t.key === key) || null; },
  tierRank(key) { const t = this.tier(key); return t ? t.rank : 0; },

  /* ---------------- card ids ----------------
     "char:simon@gold" / "clue:sign". The id is the identity everywhere — ownership, drop
     tables and requirements all key off this string, so parsing it lives in exactly one place. */
  parse(id) {
    const s = String(id || "");
    const colon = s.indexOf(":");
    if (colon < 0) return null;
    const kind = s.slice(0, colon);
    const rest = s.slice(colon + 1);
    const at = rest.indexOf("@");
    const who = at < 0 ? rest : rest.slice(0, at);
    const tier = at < 0 ? null : rest.slice(at + 1);
    if (!who) return null;
    return { kind, who, tier };
  },
  idFor(kind, who, tier) { return tier ? `${kind}:${who}@${tier}` : `${kind}:${who}`; },

  /* ---------------- boards ---------------- */
  authoredCount() { return CARD_BOARDS.length; },
  authored(n) { return CARD_BOARDS.find(b => b.board === n) || null; },
  /* The board's episodes, by position in the library. Short (or empty) once content runs out. */
  episodeIdsFor(n) {
    const per = this.perBoard(), from = (Math.max(1, n) - 1) * per;
    return Episodes.ids().slice(from, from + per);
  },
  /* Board n — authored, or derived from the last authored one. Never null: a board past the
     content still comes back with an empty page list, which is what boardComplete() reads. */
  boardFor(n) {
    const num = Math.max(1, n | 0);
    const own = this.authored(num);
    if (own) return own;
    const tpl = CARD_BOARDS[CARD_BOARDS.length - 1];
    if (!tpl) return { board: num, name: "The collection", art: "", characters: [], clues: [], episodes: [] };
    const ids = this.episodeIdsFor(num);
    return Object.assign({}, tpl, {
      board: num,
      name: ids.length ? Episodes.titleOf(ids[0]) : tpl.name,
      derivedFrom: tpl.board,
    });
  },
  num() { return Math.max(1, state.boardNum | 0); },
  board() { return this.boardFor(this.num()); },
  /* How many boards this library can hold, ever. */
  boardCount() { return Math.max(1, Math.ceil(Episodes.count() / this.perBoard())); },

  /* ---------------- pages ----------------
     One page per episode, in order: {ep, needs, index}. The requirement list comes from the
     board content, the episode id from the library slice — so a derived board wears the
     template's requirements over its own episodes. */
  pages(n) {
    const num = n || this.num();
    const b = this.boardFor(num), ids = this.episodeIdsFor(num);
    if (!b.episodes || !b.episodes.length) return [];
    return ids.map((ep, i) => {
      const src = b.episodes[i % b.episodes.length];
      return { ep, needs: (src.needs || []).slice(), index: i };
    });
  },
  pageFor(ep, n) { return this.pages(n).find(p => p.ep === ep) || null; },

  /* ---------------- cards ----------------
     A card id resolved against a board: name, art and what kind of thing it is. Returns null
     for an id the board cannot explain, which is what validate() reports and what the album
     draws as a broken slot rather than crashing on. */
  cardOf(id, n) {
    const p = this.parse(id);
    if (!p) return null;
    const b = this.boardFor(n || this.num());
    const base = b.art || "";
    if (p.kind === "char") {
      const c = (b.characters || []).find(x => x.id === p.who);
      if (!c || !this.tier(p.tier)) return null;
      return { id, kind: "char", who: c.id, tier: p.tier, name: c.name, sub: c.role,
               art: base + c.art, blurb: c.role };
    }
    if (p.kind === "clue") {
      const c = (b.clues || []).find(x => x.id === p.who);
      if (!c) return null;
      return { id, kind: "clue", who: c.id, tier: null, name: c.name, sub: "Clue",
               art: base + c.art, blurb: c.name };
    }
    return null;
  },
  /* Every card the board wants, in album order, deduplicated. THE pool — drops draw from it,
     the album counts against it, and it is derived from the requirements alone. */
  pool(n) {
    const out = [], seen = new Set();
    this.pages(n).forEach(pg => pg.needs.forEach(id => {
      if (!seen.has(id)) { seen.add(id); out.push(id); }
    }));
    return out;
  },
  poolSize(n) { return this.pool(n).length; },
  /* The pool narrowed to one kind, and for characters one tier. What a box draws from. */
  poolOf(kind, tier, n) {
    return this.pool(n).filter(id => {
      const p = this.parse(id);
      return p && p.kind === kind && (tier == null || p.tier === tier);
    });
  },

  /* ---------------- ownership ----------------
     One album per board, kept forever. albumOf() creates on demand so a board entered by any
     route (a fresh run, a restore, an advance) has somewhere to put its first card. */
  albumOf(n) {
    const k = String(n || this.num());
    if (!state.albums || typeof state.albums !== "object") state.albums = {};
    if (!state.albums[k]) state.albums[k] = {};
    return state.albums[k];
  },
  countOf(id, n) { return Math.max(0, this.albumOf(n)[id] | 0); },
  has(id, n) { return this.countOf(id, n) > 0; },
  /* Bank a card on the CURRENT board. Returns what the presentation needs to say about it:
     whether it was new, and how many are now held. Clue counters are fed here rather than by
     the caller, so every future source of cards gets them right for free. */
  add(id, n) {
    const many = Math.max(1, Math.round(n || 1));
    const album = this.albumOf(this.num());
    const before = Math.max(0, album[id] | 0);
    album[id] = before + many;
    const isNew = before === 0;
    const p = this.parse(id);
    if (isNew && p && p.kind === "clue") {
      /* A clue card still buys prediction accuracy, exactly as the mystery box's clues did:
         state.clues is the lifetime album total, state.cycleClues the flow spent on the next
         wager (Economy.accuracyFor). Only a NEW clue pays — a duplicate is coins, not insight. */
      state.clues++; state.cycleClues++;
    }
    return { isNew, count: album[id], id };
  },
  /* Distinct pool cards owned on a board — the album's headline number. */
  collected(n) {
    const num = n || this.num();
    return this.pool(num).filter(id => this.has(id, num)).length;
  },

  /* ---------------- progress ---------------- */
  /* [owned, needed] for one page. */
  pageProgress(page, n) {
    const num = n || this.num();
    const got = page.needs.filter(id => this.has(id, num)).length;
    return [got, page.needs.length];
  },
  pageReady(page, n) {
    const [got, need] = this.pageProgress(page, n);
    return need > 0 && got === need;
  },
  /* Which cards a page is still missing — what the album shows as empty slots. */
  pageMissing(page, n) {
    const num = n || this.num();
    return page.needs.filter(id => !this.has(id, num));
  },
  episodeReady(ep, n) {
    const p = this.pageFor(ep, n);
    return !!p && this.pageReady(p, n);
  },
  /* Every board page complete. An empty board (content exhausted) is NOT complete — otherwise
     running out of episodes would read as a finished board and advance forever. */
  boardComplete(n) {
    const num = n || this.num();
    const pgs = this.pages(num);
    return pgs.length > 0 && pgs.every(p => this.pageReady(p, num));
  },
  /* Every page collected AND every one of its episodes watched — the gate for turning the set
     over. Collecting the last card is not the end of a set: the point of the cards is the
     episodes, so the set holds until they have all been seen.

     A set can therefore only ever finish on the last WATCH, since an episode cannot be watched
     before it is collected. A sealed reveal (bet locked, video unfinished) is deliberately not
     good enough — that episode is still owed. */
  boardFinished(n) {
    const num = n || this.num();
    if (!this.boardComplete(num)) return false;
    if (state.pendingReveal) return false;
    return this.pages(num).every(p => !state.epQueue.includes(p.ep));
  },
  /* [episodes watched, episodes on this board] — what the case board counts down. */
  boardWatched(n) {
    const num = n || this.num(), pgs = this.pages(num);
    return [pgs.filter(p => this.pageReady(p, num) && !state.epQueue.includes(p.ep)).length, pgs.length];
  },
  /* [episodes unlocked, episodes on this board] */
  boardProgress(n) {
    const num = n || this.num(), pgs = this.pages(num);
    return [pgs.filter(p => this.pageReady(p, num)).length, pgs.length];
  },

  /* ---------------- the library ----------------
     Derived from every album, oldest board first, so the unlocked set is always a prefix-ish
     list in story order and past boards keep their episodes after the album moves on. */
  unlockedEpisodeIds() {
    const out = [];
    for (let n = 1; n <= this.num(); n++) {
      this.pages(n).forEach(p => {
        if (this.pageReady(p, n) && Episodes.has(p.ep) && !out.includes(p.ep)) out.push(p.ep);
      });
    }
    return out;
  },
  unlockedCount() { return this.unlockedEpisodeIds().length; },

  /* ---------------- watching, in order ----------------

     THE STORY IS SERIALISED AND THE COLLECTION IS NOT. Which cards fall is luck, so pages fill
     in whatever order they fill — page 2 can complete first. Watching cannot work that way: a
     drama watched out of order spoils itself, and episode 2's prediction gives away episode 1.

     So unlocking and watching are two different gates:

       a page fills          → that episode is UNLOCKED — it exists, it is in the library
       every earlier episode → that episode is PLAYABLE — you may bet on it and watch it
       has been watched

     Both are derived. "Watched" is an unlocked episode that is no longer waiting in the queue
     (resolvePrediction takes it off when the bet is locked), so there is no third list to keep
     in step with the other two. */
  watchedIds() {
    const waiting = state.epQueue;
    return this.unlockedEpisodeIds().filter(id => !waiting.includes(id));
  },
  /* The next episode of the story, watched or not — the one the player owes next whatever their
     album looks like. Null once every episode in the library has been watched. */
  nextStoryId() {
    const watched = this.watchedIds();
    for (const id of Episodes.ids()) if (!watched.includes(id)) return id;
    return null;
  },
  /* The next episode the player may actually watch: the next in story order, and only once its
     page is complete. Null when the story is ahead of the collection — which is a normal state,
     not an error, and the UI says which episode is holding things up (blockedBy). */
  firstUnwatchedId() {
    const id = this.nextStoryId();
    return id != null && state.epQueue.includes(id) ? id : null;
  },
  /* The episode standing in the way, when one is: unlocked episodes are waiting but the next in
     story order has not been collected yet. Null when nothing is blocked. */
  blockedBy() {
    const id = this.nextStoryId();
    return id != null && !state.epQueue.includes(id) ? id : null;
  },
  /* May this specific episode be watched right now? The library and the prediction flow both
     ask, so the answer is in one place. */
  canWatch(id) { return id != null && id === this.firstUnwatchedId(); },

  /* ---------------- claiming an unlock ----------------
     Because "unlocked" is derived, there is no moment at which an episode is marked unlocked —
     so a caller that has just banked some cards asks what changed by comparing before and
     after. Two calls around the bank, and no second source of truth to drift:

       const before = Collection.unlockSnapshot();
       ...cards land...
       const fresh  = Collection.claimUnlocked(before);

     claimUnlocked is what pushes the newly-unlocked episodes onto the unwatched queue, so an
     episode that was unlocked and already watched never comes back — it is not fresh. */
  unlockSnapshot() { return this.unlockedEpisodeIds(); },
  claimUnlocked(before) {
    const had = before || [];
    const fresh = this.unlockedEpisodeIds().filter(id => !had.includes(id));
    fresh.forEach(id => { if (!state.epQueue.includes(id)) state.epQueue.push(id); });
    return fresh;
  },

  /* ---------------- the turn of the loop ---------------- */
  /* Is there another board with episodes waiting behind this one? */
  hasNextBoard() { return this.episodeIdsFor(this.num() + 1).length > 0; },
  /* Put the album away and start the next set. The albums are KEPT — the collection is a
     history, not a scoreboard — so this only moves the cursor and opens a fresh page. */
  advanceBoard() {
    if (!this.boardFinished()) return null;
    if (!this.hasNextBoard()) return null;
    state.boardNum = this.num() + 1;
    state.boardsDone = Math.max(0, state.boardsDone | 0) + 1;
    this.albumOf(state.boardNum);
    return this.board();
  },

  /* ---------------- validation ----------------
     Every problem at once, like Economy.validateCurve — a board is content, and content is
     wrong in several places or not at all. Nothing calls this in the game loop; the tests and
     the tuning drawer do. */
  validate(n) {
    const num = n || this.num();
    const errs = [], b = this.boardFor(num), pgs = this.pages(num);
    const want = this.perEpisode();
    if (!pgs.length) errs.push(`Board ${num} has no episodes — the library has run out.`);
    if (pgs.length && pgs.length !== this.perBoard())
      errs.push(`Board ${num} has ${pgs.length} episodes, cfg.episodesPerBoard says ${this.perBoard()}.`);
    const seen = new Map();
    pgs.forEach(p => {
      if (p.needs.length !== want)
        errs.push(`Episode ${p.ep} needs ${p.needs.length} cards, cfg.collectiblesPerEpisode says ${want}.`);
      p.needs.forEach(id => {
        if (!this.cardOf(id, num)) errs.push(`Episode ${p.ep} wants "${id}", which board ${num} cannot explain.`);
        if (seen.has(id)) errs.push(`"${id}" is wanted by both ${seen.get(id)} and ${p.ep} — a card is spent once.`);
        else seen.set(id, p.ep);
      });
    });
    /* Everything the board can show has to be reachable, or it is art nobody can collect. */
    (b.characters || []).forEach(c => CARD_TIERS.forEach(t => {
      const id = this.idFor("char", c.id, t.key);
      if (!seen.has(id)) errs.push(`"${id}" exists on board ${num} but no episode wants it.`);
    }));
    (b.clues || []).forEach(c => {
      const id = this.idFor("clue", c.id);
      if (!seen.has(id)) errs.push(`"${id}" exists on board ${num} but no episode wants it.`);
    });
    return errs;
  },
};
