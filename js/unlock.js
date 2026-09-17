"use strict";
/* Items and unlocking — what the player owns, and what it costs to own the next thing.

   Logic only. It mutates state and returns plain values; js/ui/unlock-panel.js draws the step
   bar and js/ui/library.js draws the shelf. Nothing here produces board events either: an
   unlock happens in a modal the player opened, not as the consequence of a landing, so it has
   no place in the list playEvents() animates.

   ---- three flat fields, everything else derived ----

   The entire unlock is state.items, state.paid and state.watched (js/state.js). Nothing stores
   "episode 007 is unlocked", how many steps it has left, or which target is next — all of that
   is read back off the catalog and those three fields every time it is asked for.

   A stored answer and a derived one disagree the moment a content file is edited: a price that
   gains a step would leave a saved "unlocked" flag lying about an episode that is no longer
   paid for, and a stored "next target" would point at content that moved. Deriving costs a walk
   of two dozen entries and can never be wrong — the same trade js/economy.js makes when it
   solves a segment's base on every call rather than caching it.

   ---- granting ----

   Items arrive through Items.add and leave through Items.spend. Nothing writes state.items
   directly, for the reason BoardActor.gainCoins/gainEnergy exist: one place that knows how a
   balance is allowed to move is one place to fix when that rule changes.

   ---- all or nothing ----

   Items.spend and Unlock.payStep deduct everything or nothing. A part-paid step is the worst
   bug this file could have — the player is out the coins and the item, the step bar has not
   moved, and no amount of re-clicking gets either back. EconomyImport takes the same line with
   a workbook: validate the whole thing, install none of it unless it all passes. */

const Items = {

  count(itemId) {
    const n = Math.floor(+state.items[itemId] || 0);
    return n > 0 ? n : 0;
  },

  /* Grants n of an item and returns the new total.
     An id the catalog does not know is refused rather than banked: js/storage.js sanitises
     state.items against the catalog on load, so an unknown id would be granted now and vanish
     on the next reload. Better to be loud where the bad id actually is — a deck card or a
     mini-game naming an item that no longer exists. */
  add(itemId, n) {
    const add = Math.floor(+n || 0);
    if (!Catalog.getItem(itemId)) { console.warn(`Items: no such item "${itemId}" — nothing granted.`); return this.count(itemId); }
    if (add <= 0) return this.count(itemId);
    state.items[itemId] = this.count(itemId) + add;
    return state.items[itemId];
  },

  has(itemId, n) { return this.count(itemId) >= Math.max(1, Math.floor(+n || 1)); },

  /* Everything held, in the order the series were declared — an inventory that reshuffles
     itself as items are spent would be unreadable. Items at zero are not held, so they are
     not listed. */
  all() {
    const out = [];
    Catalog.series().forEach(s => {
      Catalog.itemsOf(s.id).forEach(item => {
        const count = this.count(item.id);
        if (count > 0) out.push({ item, count });
      });
    });
    return out;
  },

  /* Deducts a {itemId:n} map. Returns false and deducts NOTHING if any one of them is short. */
  spend(map) {
    const want = map || {};
    const ids = Object.keys(want);
    if (ids.some(id => this.count(id) < Math.max(0, Math.floor(+want[id] || 0)))) return false;
    ids.forEach(id => {
      const n = Math.max(0, Math.floor(+want[id] || 0));
      if (!n) return;
      const left = this.count(id) - n;
      if (left > 0) state.items[id] = left; else delete state.items[id];
    });
    return true;
  },
};

const Unlock = {

  price(kind, id) { const t = Catalog.target(kind, id); return t ? t.price : []; },
  stepCount(kind, id) { return this.price(kind, id).length; },

  /* Clamped to the price it belongs to: a content edit that removes a step must leave the
     target finished, never paid past its own end. */
  stepsPaid(kind, id) {
    const paid = Math.floor(+state.paid[Catalog.key(kind, id)] || 0);
    return Math.max(0, Math.min(this.stepCount(kind, id), paid));
  },

  /* A [] price is 0 of 0 steps paid, so it is unlocked the moment it exists — which is how
     the first series and the first season are free without being a special case. */
  isUnlocked(kind, id) { return this.stepsPaid(kind, id) >= this.stepCount(kind, id); },
  nextStep(kind, id) { return this.price(kind, id)[this.stepsPaid(kind, id)] || null; },

  isAvailable(kind, id) {
    return Catalog.ancestorsOf(kind, id).every(a => this.isUnlocked(a.kind, a.id));
  },

  /* THE one thing that may be paid for. A parent always precedes its children on the spine, so
     the first unpaid entry is always available — there is no separate reachability test to get
     out of step with this one. */
  current() {
    return Catalog.spine().find(e => !this.isUnlocked(e.kind, e.id)) || null;
  },

  /* The shortfall on the next step. Always the same shape: coins 0 with no item keys means
     the step is affordable. */
  missing(kind, id) {
    const out = { coins: 0, items: {} };
    const step = this.nextStep(kind, id);
    if (!step) return out;
    out.coins = Math.max(0, step.coins - state.coins);
    Object.keys(step.items).forEach(it => {
      const short = step.items[it] - Items.count(it);
      if (short > 0) out.items[it] = short;
    });
    return out;
  },

  canPay(kind, id) {
    const cur = this.current();
    if (!cur || cur.key !== Catalog.key(kind, id)) return false;
    if (!this.nextStep(kind, id)) return false;
    const m = this.missing(kind, id);
    return m.coins === 0 && !Object.keys(m.items).length;
  },

  /* Pays one step. Coins and items move together or not at all; `step` in the result is the
     step object that was just charged, which is what the panel needs to show what it cost.
     Refuses — returning null, never a half-payment — when this is not the current target, when
     the price is not covered, or while the board is mid-animation, since a payment landing
     between a roll's events would be rendered against a state the player cannot see. */
  payStep(kind, id) {
    if (state.animating) return null;
    if (!this.canPay(kind, id)) return null;
    const step = this.nextStep(kind, id);
    if (step.coins > state.coins) return null;
    if (!Items.spend(step.items)) return null;
    state.coins -= step.coins;
    state.paid[Catalog.key(kind, id)] = this.stepsPaid(kind, id) + 1;
    return { kind, id, step, justUnlocked: this.isUnlocked(kind, id) };
  },

  /* ---------------- the whole remaining price ----------------
     `missing`/`canPay`/`payStep` are all about the NEXT step, which is what the library's title
     page pays. These three are about the whole thing, and exist for the moment the run is really
     about: when a player can cover every step an episode has left, that episode is theirs and
     the game should say so rather than making them pay it out in instalments. */

  /* Coins and items still owed across every unpaid step. Same shape as a step, so anything that
     can render a price can render this. */
  remaining(kind, id) {
    const out = { coins: 0, items: {} };
    this.price(kind, id).slice(this.stepsPaid(kind, id)).forEach(step => {
      out.coins += step.coins || 0;
      Object.entries(step.items || {}).forEach(([it, n]) => { out.items[it] = (out.items[it] || 0) + n; });
    });
    return out;
  },

  /* Could the player clear this target outright, right now? Note this asks about the WHOLE
     remainder, so it is strictly stronger than canPay() — on a three-step episode a player can
     often pay one step long before this turns true. */
  canPayAll(kind, id) {
    const cur = this.current();
    if (!cur || cur.key !== Catalog.key(kind, id)) return false;
    if (this.isUnlocked(kind, id)) return false;
    const need = this.remaining(kind, id);
    if (need.coins > state.coins) return false;
    return Object.entries(need.items).every(([it, n]) => Items.count(it) >= n);
  },

  /* Pay every remaining step at once. All-or-nothing across the WHOLE price, not step by step:
     the affordability is checked first, so this cannot charge two steps of a three-step episode
     and then fail on the third, which would leave the player poorer and still locked out.
     Returns the steps charged, or null. */
  payAll(kind, id) {
    if (state.animating) return null;
    if (!this.canPayAll(kind, id)) return null;
    const steps = [];
    /* payStep re-checks canPay each time, and each call moves stepsPaid, so this walks the
       remainder honestly rather than assuming what is left. canPayAll above is what guarantees
       none of these can refuse. */
    for (let guard = this.stepCount(kind, id); guard > 0 && !this.isUnlocked(kind, id); guard--) {
      const paid = this.payStep(kind, id);
      if (!paid) break;
      steps.push(paid.step);
    }
    return steps.length ? { kind, id, steps, justUnlocked: this.isUnlocked(kind, id) } : null;
  },

  /* Every episode fully paid for, in spine order — which is story order. */
  unlockedEpisodeIds() {
    return Catalog.spine()
      .filter(e => e.kind === "episode" && this.isUnlocked(e.kind, e.id))
      .map(e => e.id);
  },

  progress() {
    return { episodes: this.unlockedEpisodeIds().length, total: Catalog.episodeCount() };
  },

  /* What the REST of the run still asks for, per item id, after what the player already holds.
     Every unpaid step of every target in that series, not just the next one — an item is banked
     long before the episode that wants it, so "do I still need this" is a question about the
     whole tail of the spine.

     This exists because an even draw across a series' set is not the same as an even draw across
     its DEMAND. Series 001 asks for its five props 11/11/9/7/4 times; drawing each with p=0.2
     spends about a quarter of the grind on props the run has already finished with, and leaves
     the player watching a counter that is full go up again. Weighting the draw by what is still
     owed cannot deadlock and cannot overshoot — when an item is done it simply stops coming. */
  demand(seriesId) {
    const out = {};
    Catalog.spine().forEach(e => {
      const anc = Catalog.ancestorsOf(e.kind, e.id);
      const owner = anc.length ? anc[0].id : e.id;
      if (owner !== seriesId) return;
      const paid = this.stepsPaid(e.kind, e.id);
      e.price.slice(paid).forEach(step => {
        Object.entries(step.items || {}).forEach(([id, n]) => { out[id] = (out[id] || 0) + n; });
      });
    });
    /* Net off the shelf. A pile big enough for everything left is not demand any more. */
    Object.keys(out).forEach(id => {
      out[id] = Math.max(0, out[id] - Items.count(id));
      if (!out[id]) delete out[id];
    });
    return out;
  },
};
