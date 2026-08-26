"use strict";
/* Clues — the gate on the story, and the evidence you bet on.

   GDD §6. A clue does two jobs that would normally need two systems, and doing them with one
   object is the whole idea: collect enough of an episode's clues and it UNLOCKS, and the ones
   you happen to hold are the EVIDENCE shown at the wager screen. Progress and information are
   the same currency, so there is never a moment where you are grinding one and ignoring the
   other.

   ---- specific, and per-episode ----

   `state.clues` is `{ "005": ["c3","c7"] }` — which clues, for which episode, not how many in
   total. That matters because the requirement (four) sits well below the authored pool (eight),
   so two players reach the same prediction holding DIFFERENT evidence. A counter could not
   express that, and without it "review the evidence" would show everyone the same screen.

   ---- a duplicate is possible, and that is the point ----

   A draw picks uniformly from the episode's eight. Four distinct ones therefore take about five
   draws, not four, and an unlucky run can take many more. That is what the catch-up valve
   (§6.7) exists for, and it is why a duplicate still pays coins — GDD §12's first rule about
   variance is that a duplicate must always convert to something.

   ---- nothing here is stored twice ----

   "Unlocked" is DERIVED: an episode is unlocked when the clues held for it reach the
   requirement. There is no flag, so there is nothing to drift. The clues are never cleared
   either — §6.4 calls them consumed at unlock, which they are in the sense that they buy that
   episode and nothing else, but the record has to survive or the evidence screen would be empty
   the moment it became reachable. */

const Clues = {
  /* ---------------- the authored content ---------------- */
  authoredFor(id) {
    const ep = Episodes.get(id);
    return (ep && Array.isArray(ep.clues)) ? ep.clues : [];
  },
  clueOf(id, clueId) { return this.authoredFor(id).find(c => c.id === clueId) || null; },

  /* ---------------- how many it takes ----------------
     Fixed within a Season and stepped between them (§6.2) — one knob, not a curve, because the
     thing that should get harder across Seasons is the requirement, not its shape. */
  baseRequired() {
    const step = (state.season | 0) * (+cfg.clueSeasonStep || 0);
    return Math.max(1, Math.round((+cfg.cluesPerEpisode || 1) + step));
  },
  /* THE CATCH-UP VALVE (§6.7). Once an episode has been the current one for cfg.clueStuckDays,
     the requirement decays by one a day. Invisible to anyone progressing normally — it only
     ever fires for a player the draw has been unkind to, and it can never fall below one. */
  requiredFor(id) {
    const base = Math.min(this.baseRequired(), this.authoredFor(id).length || this.baseRequired());
    const days = this.daysOn(id);
    const decay = Math.max(0, days - Math.max(0, Math.round(+cfg.clueStuckDays || 0)));
    return Math.max(1, base - decay);
  },
  /* How long this episode has been the one being worked on. Stamped by grant(), because a
     player with no clues at all for it has not been unlucky — they have just arrived. */
  daysOn(id) {
    const from = (state.clueDay || {})[id];
    if (from == null) return 0;
    return Math.max(0, (state.day | 0) - (from | 0));
  },

  /* ---------------- what is held ---------------- */
  heldFor(id) {
    const held = (state.clues || {})[id];
    return Array.isArray(held) ? held : [];
  },
  countFor(id) { return this.heldFor(id).length; },
  has(id, clueId) { return this.heldFor(id).includes(clueId); },
  /* The evidence, resolved to its text, in authored order — what §7.2's Review Evidence lists. */
  evidenceFor(id) {
    const held = this.heldFor(id);
    return this.authoredFor(id).filter(c => held.includes(c.id));
  },
  /* Lifetime clues collected, derived. The HUD's running total. */
  total() {
    return Object.keys(state.clues || {}).reduce((a, id) => a + this.countFor(id), 0);
  },

  /* ---------------- unlocking, derived ---------------- */
  isUnlocked(id) {
    const need = this.requiredFor(id);
    return this.authoredFor(id).length > 0 && this.countFor(id) >= need;
  },
  /* Every unlocked episode, in story order. */
  unlockedIds() { return Episodes.ids().filter(id => this.isUnlocked(id)); },
  progressFor(id) { return [this.countFor(id), this.requiredFor(id)]; },

  /* THE EPISODE A CLUE GOES TO: the first one in story order that is not unlocked yet.
     Clues therefore always push the story forward, and never arrive for something already
     bought. Null when every episode in the library is unlocked. */
  currentId() {
    for (const id of Episodes.ids()) if (!this.isUnlocked(id)) return id;
    return null;
  },

  /* ---------------- granting ----------------
     Returns {id, clue, isNew, coins} — or null when there is nothing left to unlock, which is
     a real state (the collection has caught up with the content) and not an error. The caller
     turns that into events; nothing here touches the DOM. */
  grant(opts) {
    const id = this.currentId();
    if (id == null) return null;
    const all = this.authoredFor(id);
    if (!all.length) return null;
    /* `fresh` is the Insider pack's guarantee (GDD 6.5): one clue you do not already hold, so
       the pack that costs the most is the one that can never be a dud. Everything else draws
       from the whole eight and may repeat — which is what makes holding four of eight a
       different hand from anyone else's. */
    let pool = all;
    if (opts && opts.fresh) {
      const missing = all.filter(c => !this.has(id, c.id));
      if (missing.length) pool = missing;
    }
    const clue = pool[Math.floor(rand(0, pool.length))];
    if (this.has(id, clue.id)) {
      /* A duplicate always converts to something (§12). It is the same rule a duplicate card
         follows, for the same reason: a draw that pays nothing reads as the game misfiring. */
      const coins = Math.round((+cfg.dupClueCoins || 0) * (+cfg.boardScale || 1));
      state.coins += coins;
      return { id, clue, isNew: false, coins };
    }
    if (!state.clues) state.clues = {};
    if (!Array.isArray(state.clues[id])) state.clues[id] = [];
    state.clues[id].push(clue.id);
    /* Stamp the day this episode started costing clues, so the valve has something to measure
       from. Only the first one stamps it. */
    if (!state.clueDay) state.clueDay = {};
    if (state.clueDay[id] == null) state.clueDay[id] = state.day | 0;
    return { id, clue, isNew: true, coins: 0 };
  },

  /* How many clue draws an episode actually costs, on average. A coupon-collector sum: with a
     pool of P and a requirement of R, the k-th new clue takes P/(P-k+1) draws. Four of eight is
     five draws, not four — which is the number anyone tuning §6.6's pacing needs, and the reason
     the catch-up valve exists at all. Printed in the tuning drawer. */
  expectedDraws(id) {
    const pool = this.authoredFor(id || Episodes.ids()[0]).length;
    const need = Math.min(this.baseRequired(), pool);
    let sum = 0;
    for (let k = 0; k < need; k++) sum += pool / (pool - k);
    return sum;
  },

  /* ---------------- validation ----------------
     Every problem at once, in the house style. Read at boot and by the tuning drawer, because
     an episode with too few clues to ever unlock is invisible in play — it looks like a long
     run of bad luck, and the player waits forever. */
  validate() {
    const errs = [];
    const need = this.baseRequired();
    Episodes.ids().forEach(id => {
      const cs = this.authoredFor(id);
      const where = `Episode ${id} ("${Episodes.titleOf(id)}")`;
      if (!cs.length) return errs.push(`${where} has no clues, so it can never be unlocked.`);
      if (cs.length < need)
        errs.push(`${where} has ${cs.length} clues but ${need} are needed to unlock it.`);
      const seen = new Set();
      cs.forEach((c, k) => {
        if (!c || !c.id) return errs.push(`${where} clue ${k} has no id.`);
        if (seen.has(c.id)) errs.push(`${where} has two clues called "${c.id}".`);
        seen.add(c.id);
        if (!c.text) errs.push(`${where} clue "${c.id}" has no text — the evidence screen prints it.`);
      });
    });
    return errs;
  },
};
