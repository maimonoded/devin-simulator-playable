"use strict";
/* The story — which episodes are in this arc, which are unlocked, which have been watched, and
   when the arc turns over.

   THE NAME IS A LEFTOVER AND THE FILE KNOWS IT. This module used to own the collection: cards
   were the gate, so "which cards do I have" and "which episodes are unlocked" were one question.
   GDD §6.1 split them. The cards moved to js/cards.js, the gate moved to js/clues.js, and what
   is left here is the ARC — a run of cfg.episodesPerBoard episodes — and the library derived
   from it. The global keeps its name because every surface in js/ui/ already talks to
   `Collection` about the library, and renaming seventy call sites would be churn, not clarity.

   ---- everything here is derived ----

   Three things in particular, and none of them is stored:

     which episodes are in an arc   its position in Episodes.ids()
     which are unlocked            Clues.unlockedIds()
     which have been watched       unlocked, and no longer waiting in state.epQueue

   So there is no flag to set and nothing to drift. The only stored thing is the arc CURSOR
   (state.boardNum) and the unwatched queue. */

const Collection = {
  /* ---------------- the arc ---------------- */
  perBoard() { return Math.max(1, Math.round(cfg.episodesPerBoard || 1)); },
  num() { return Math.max(1, state.boardNum | 0); },
  boardCount() { return Math.max(1, Math.ceil(Episodes.count() / this.perBoard())); },
  /* Arc n covers episodes [(n-1)*perBoard, n*perBoard) of the library, straight down
     Episodes.ids() — so the order of the episode files IS the order of the drama. */
  episodeIdsFor(n) {
    const per = this.perBoard(), from = (Math.max(1, n | 0) - 1) * per;
    return Episodes.ids().slice(from, from + per);
  },
  /* An arc has no authored identity: it is named after the episode it opens with, which is the
     only name a player would recognise. */
  boardFor(n) {
    const num = Math.max(1, n | 0), eps = this.episodeIdsFor(num);
    return { board: num, name: eps.length ? Episodes.titleOf(eps[0]) : `Set ${num}`, episodes: eps };
  },
  board() { return this.boardFor(this.num()); },
  /* One "page" per episode of the arc. The word survives because the album still turns them. */
  pages(n) { return this.episodeIdsFor(n || this.num()).map(ep => ({ ep })); },
  pageFor(ep, n) { return this.pages(n).find(p => p.ep === ep) || null; },

  /* ---------------- progress ----------------
     WHAT UNLOCKS AN EPISODE IS ITS CLUES (GDD §6.1). These read through to js/clues.js rather
     than counting anything here, and they stay on this object because every surface that draws
     a page asks the page, not the episode. */
  pageProgress(page) { return Clues.progressFor(page.ep); },
  pageReady(page) { return Clues.isUnlocked(page.ep); },
  episodeReady(ep) { return Clues.isUnlocked(ep); },
  /* Every episode of the arc unlocked. An EMPTY arc (the content has run out) is deliberately
     NOT complete — otherwise running out of episodes would read as a finished arc and advance
     forever. */
  boardComplete(n) {
    const pgs = this.pages(n);
    return pgs.length > 0 && pgs.every(p => this.pageReady(p));
  },
  /* Every episode unlocked AND watched — the gate for turning the arc over. Unlocking the last
     episode is not the end of an arc: the point of the clues is the episodes, so the arc holds
     until they have all been seen.

     An arc can therefore only ever finish on the last WATCH. A sealed reveal (bet locked, video
     unfinished) is deliberately not good enough — that episode is still owed. */
  boardFinished(n) {
    if (!this.boardComplete(n)) return false;
    if (state.pendingReveal) return false;
    return this.pages(n).every(p => !state.epQueue.includes(p.ep));
  },
  /* [watched, total] — what the case board counts down. */
  boardWatched(n) {
    const pgs = this.pages(n);
    return [pgs.filter(p => this.pageReady(p) && !state.epQueue.includes(p.ep)).length, pgs.length];
  },
  /* [unlocked, total] */
  boardProgress(n) {
    const pgs = this.pages(n);
    return [pgs.filter(p => this.pageReady(p)).length, pgs.length];
  },

  /* ---------------- the library ----------------
     One line, because "unlocked" has exactly one definition and it lives in js/clues.js. */
  unlockedEpisodeIds() { return Clues.unlockedIds(); },
  unlockedCount() { return this.unlockedEpisodeIds().length; },

  /* ---------------- watching, in order ----------------

     THE STORY IS SERIALISED AND THE CLUES ARE NOT. Which clues fall is luck, so episodes unlock
     in whatever order they unlock. Watching cannot work that way: a drama watched out of order
     spoils itself, and episode 2's prediction gives away episode 1.

     So unlocking and watching are two different gates:

       enough clues          → that episode is UNLOCKED — it exists, it is in the library
       every earlier episode → that episode is PLAYABLE — you may bet on it and watch it
       has been watched

     Both are derived. "Watched" is an unlocked episode that is no longer waiting in the queue
     (resolvePrediction takes it off when the bet is locked), so there is no third list to keep
     in step with the other two. */
  watchedIds() {
    const waiting = state.epQueue;
    return this.unlockedEpisodeIds().filter(id => !waiting.includes(id));
  },
  /* The next episode of the story, watched or not — what the player owes next whatever their
     clues look like. Null once every episode in the library has been watched. */
  nextStoryId() {
    const watched = this.watchedIds();
    for (const id of Episodes.ids()) if (!watched.includes(id)) return id;
    return null;
  },
  /* The next episode the player may actually watch: the next in story order, and only once it
     is unlocked. Null when the story is ahead of the clues — a normal state, not an error, and
     the UI says which episode is holding things up (blockedBy). */
  firstUnwatchedId() {
    const id = this.nextStoryId();
    return id != null && state.epQueue.includes(id) ? id : null;
  },
  /* The episode standing in the way, when one is. Null when nothing is blocked. */
  blockedBy() {
    const id = this.nextStoryId();
    return id != null && !state.epQueue.includes(id) ? id : null;
  },
  /* May this specific episode be watched right now? The library and the prediction flow both
     ask, so the answer is in one place. */
  canWatch(id) { return id != null && id === this.firstUnwatchedId(); },

  /* ---------------- claiming an unlock ----------------
     Because "unlocked" is derived, there is no moment at which an episode is marked unlocked —
     so a caller that has just banked some clues asks what changed by comparing before and after:

       const before = Collection.unlockSnapshot();
       ...clues land...
       const fresh  = Collection.claimUnlocked(before);

     claimUnlocked is what pushes the newly-unlocked episodes onto the unwatched queue, so an
     episode that was unlocked and already watched never comes back — it is not fresh. Passing
     an empty list would therefore re-queue everything; pass a real snapshot. */
  unlockSnapshot() { return this.unlockedEpisodeIds(); },
  claimUnlocked(before) {
    const had = before || [];
    const fresh = this.unlockedEpisodeIds().filter(id => !had.includes(id));
    fresh.forEach(id => { if (!state.epQueue.includes(id)) state.epQueue.push(id); });
    /* An unlock resets the Insider Pack's price (GDD 6.5). It lives here rather than in
       js/boxes.js because "an episode unlocked" happens exactly once, right here, and a counter
       reset hung off anything else would fire twice or not at all. */
    if (fresh.length) state.insiderBought = 0;
    return fresh;
  },

  /* ---------------- the turn of the loop ---------------- */
  hasNextBoard() { return this.episodeIdsFor(this.num() + 1).length > 0; },
  /* Move to the next arc. Nothing is thrown away — the clues stay on file and the collection is
     Season-wide — so this only moves the cursor. */
  advanceBoard() {
    if (!this.boardFinished()) return null;
    if (!this.hasNextBoard()) return null;
    state.boardNum = this.num() + 1;
    state.boardsDone = Math.max(0, state.boardsDone | 0) + 1;
    return this.board();
  },

  /* ---------------- validation ----------------
     Every problem at once, like the board and the pools. Read by the tuning drawer and logged at
     boot; nothing calls it in the game loop. */
  validate(n) {
    const errs = [], num = n || this.num(), eps = this.episodeIdsFor(num);
    if (!eps.length) errs.push(`Set ${num} has no episodes — the library has run out.`);
    if (eps.length && eps.length !== this.perBoard())
      errs.push(`Set ${num} has ${eps.length} episodes, cfg.episodesPerBoard says ${this.perBoard()}.`);
    eps.forEach(ep => {
      if (!Episodes.has(ep)) errs.push(`Set ${num} lists episode ${ep}, which has no file.`);
      else if (!Clues.authoredFor(ep).length)
        errs.push(`Set ${num}'s episode ${ep} has no clues, so it can never be unlocked.`);
    });
    return errs;
  },
};
