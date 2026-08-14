import * as THREE from "three";

/* The pull deck and the ticket placeholders — the two things that live INSIDE the board ring.

   Imported by js/ui/board3d.js, so it is a sibling module and adds no <script> tag: the project
   still has exactly one type="module" and the classic load order is still the dependency order.

   Four rules inherited from the dice module this replaces. They were learned the hard way and
   every one of them still applies:

     · THE PROMISE RESOLVES ON A setTimeout, NEVER FROM THE FRAME LOOP. requestAnimationFrame is
       suspended in a background tab, and the pull is the core loop — a frame-driven resolve
       means tabbing away mid-pull leaves pull() awaiting forever with state.animating stuck
       true and the board soft-locked with Pull disabled.
     · settle() forces the final pose, so the result is correct even if every frame was dropped.
     · A pull requested before the models arrived is still played, not swallowed.
     · "Failed" is distinct from "not loaded yet" — fx.js keys its flat-card fallback off failed(),
       and conflating the two is what used to make the fallback flash on every page load.

   COORDINATES. One world unit is one tile; the ring occupies the outer band of an 11x11 grid,
   so the interior is x,z within about ±4.5 and the board's centre is the origin. The camera is
   fixed at 45° azimuth, which means screen-across is u = (x−z)/√2 and larger (x+z) is LOWER on
   screen. Start sits at (+5,+5) — the bottom vertex of the diamond — so:
       the deck goes at (+d,+d): straight down-screen from the centre, nearest the player
       the row of placeholders runs along (1,−1)/√2: a straight horizontal line on screen
   Both anchors are bounded by what the follow camera actually keeps in frame. Past roughly 1.9
   the deck slides off the bottom edge while the token is in the far quadrant, which is why
   DECK_AT is chosen for that, not for how it looks with the token happening to sit near Start. */

/* ---------------------------------------------------------------------------
   WHERE EVERYTHING SITS — constants, deliberately NOT config.

   The deck, the discard spot and the ticket row are LAYOUT: they are where the game's furniture
   stands, and there is one right answer per view, found by looking at it. Nothing here is a
   balance knob, so nothing here belongs in cfg.

   That is not only a tidiness argument. cfg is PERSISTED, and js/storage.js merges a saved
   config over the shipped defaults for every key the economy does not own — so as long as these
   lived in cfg, changing one changed nothing for anybody who had already opened the game. The
   layout would silently keep whatever was current the first time they loaded it. Constants
   cannot be shadowed by a save.

   Timings stay in cfg (cfg.pullRevealMs and friends): pacing IS a tuning surface, and the
   drawer editing it live is the point. Position is not.

   Distances are in tiles, measured along the Start↔VIP diagonal from the board's centre:
   positive is UP-screen (toward VIP), negative is DOWN-screen (toward Start), and the deck is
   the one thing that sits below. Get that sign wrong and the row lands on top of the deck. */
/* THE DECK AND THE PULLED CARD STAND SIDE BY SIDE, as a pair.

   DECK_AT is the pair's DEPTH — how far down-screen from the board's centre both of them sit —
   and PAIR_GAP is how far apart they are along the screen's horizontal. The deck takes the left
   half of that gap and the discard the right, so the two straddle the same centre line the deck
   used to sit on alone and the pair reads as centred rather than as one thing pushed aside.

   Both anchors therefore share one depth: x + z = 2 * DECK_AT. That is what puts them level on
   screen. Moving apart uses (1,−1)/√2, the axis the 45° camera renders as horizontal — the same
   axis the episode row is laid out along. Increase (x − z) to go right.

   The pulled card used to rest at the board's dead centre, and that is what freed the middle of
   the board for the episode row to come down into. */
const DECK_AT = 1.75;            // depth of the deck+card pair, below centre, nearest the player
const PAIR_GAP = 1.15;           // deck ↔ pulled card, measured across the screen
const DECK_SCALE = 1.15;
/* HOW HIGH "ON THE TABLE" IS, and it is not zero. The board's surface is ENV_Y.deck = 0, and a
   card seated exactly there is swallowed by it — the floor wins, and a single card lying flat
   simply does not render. The discard has always known this and sat at 0.04; the DECK did not,
   because a fixed fourteen-slab stack was tall enough that nobody could tell its bottom card was
   buried. It shows the moment the stack is allowed to shrink to one. Shared, so the two things
   that lie on the board lie on it at the same height. */
const TABLE_Y = 0.04;
const CARD_SIZE = 0.95;
const CARD_ARC = 1.6;
const PRESENT_SCALE = 2.6;       // how big the card gets while it is being read
const PRESENT_LIFT = 3.0;        // toward the camera; under an ortho camera this only reorders
/* How far into a joker's flight the bloom starts — shape, not pacing, so it is a fraction here
   rather than a duration in cfg: it has to stay in proportion however long cfg.pullRevealMs is
   set to, and a millisecond value would drift out of step with the flight the moment one moved. */
const JOKER_BLOOM_AT = 0.15;
/* Overshoot-and-settle. Module level because both the joker's bloom and the completed hand's
   splay use it, and two copies of an easing curve drift. */
const backOut = k => { const c = 1.70158; const p = k - 1; return 1 + (c + 1) * p * p * p + c * p * p; };
/* THE COMPLETED HAND, per view. `gap` is how far apart the cards splay as a fraction of a card's
   presented width, `tilt` how far each is canted from the middle one. Shape, not pacing, so they
   are constants beside ROW/ROW_PHONE rather than cfg keys — cfg is persisted, so a saved config
   would shadow any change to them for anyone who had already played. The phone frame is far more
   zoomed (camZoomPhone 0.5), so the same spread walks the hand off the edge there. */
const HAND = { gap: 0.58, tilt: 0.16 };
const HAND_PHONE = { gap: 0.40, tilt: 0.13 };
/* The ticket row, per view. The 9:16 frame is far more zoomed in (cfg.camZoomPhone), so the
   same numbers walk the row over the board there — it needs to be shorter and tighter. */
/* Lowered and enlarged once the pulled card moved off the board's centre and in beside the deck:
   the middle is free, so the collections can come down into it and be read properly. `at` is
   measured UP-screen, so a smaller number sits lower. Four slots rather than five also bought
   room to grow — the width of a slot is its height times the face's own aspect (about 0.50), so
   `gap` has to stay ahead of `height * 0.50` or neighbours overlap. */
const ROW = { at: -0.45, gap: 1.38, height: 2.55 };
const ROW_PHONE = { at: 0.25, gap: 1.10, height: 1.90 };

/* ---------------------------------------------------------------------------
   HOW TALL THE DECK LOOKS — the one thing in this file that is a READOUT rather than layout.

   ONE STACK, ALWAYS. It used to be a fixed 14 slabs whatever the shoe held; it is now the card
   count, so a player can watch the thing they are spending run out. Two rules, and between them
   they are the whole design:

   1. IT IS FULL UNTIL YOU ARE INTO YOUR LAST PACK. One pack or twenty looks identical — a full
      deck. A shoe over cfg.packSize is ordinary rather than exceptional (Shoe.buyPack MERGES
      onto whatever was left), and there is nothing useful to say about the difference between
      plenty and more-than-plenty: the exact number is on the HUD, and the deck's job is the
      feeling of running low. Height only starts falling once falling means something.

      This replaces a version that drew extra packs as separate piles behind the open one. It
      was more precise and it was a mistake: two stacks of similar height a short step apart is
      exactly what a riffle looks like frozen half-way, and it got reported as a stuck shuffle
      the first time somebody bought a deck. Precision nobody asked for, bought with ambiguity
      in the one picture that had to stay legible.

   2. WHERE THE RESOLUTION GOES. Below a pack, a linear step would spend it evenly, which is
      exactly wrong: nobody needs to be told 62 cards became 57, and everybody needs to be told
      6 became 5. So the height is the fraction of a pack raised to DECK_CURVE (<1), bunching
      the steps toward empty — a step roughly every 4 cards near full, every 2 through the
      middle, and EVERY SINGLE CARD over the last handful, ending at one card lying flat.
      Fourteen distinct heights, with the urgency arriving when it is useful.

   Constants, not cfg, for the reason the header above gives: cfg is persisted, so anything in
   there would keep whatever value was current the first time a returning player loaded the
   game. Timings are a tuning surface; how the furniture looks is not. */
const DECK_MAX = 14;             // slabs at a full pack — and the ceiling, however big the shoe
const DECK_CURVE = 0.7;          // <1 spends the steps near empty, where they carry information
const EDGE_COLOR = 0xf4ecd8;     // the paper edge of the stack
const CARD_W = 0.66, CARD_H = 0.94, CARD_T = 0.026;
const SQ2 = Math.SQRT1_2;

export const Shoe3D = {
  _scene: null, _deck: null, _slots: null, _cards: [],
  _anims: [], _done: [], _flying: null, _discard: null, _failed: false, _slotSig: null,

  init(scene) {
    if (this._scene) return;
    try {
      this._scene = scene;
      this._deck = new THREE.Group();
      this._slots = new THREE.Group();
      scene.add(this._deck);
      scene.add(this._slots);
      this._buildDeck();
      this._buildGhost();
      /* The painted card art arrives after this runs. A texture built from a CardArt canvas can
         just be re-uploaded, but the PLACEHOLDER faces DRAW the joker into a canvas of their
         own, so they have to be rebuilt outright — invalidating the signature is what forces
         that. Without this the fan keeps the vector fallback for the whole session, which is
         exactly what it looked like. */
      CardArt.onReady(() => {
        if (this._backTex) this._backTex.needsUpdate = true;
        if (this._tex) this._tex.forEach(tx => { tx.needsUpdate = true; });
        this._slotSig = null;
        this.syncSlots();
      });
      /* NOT syncSlots() here. Board3D.init() runs before boot() calls initState(), so there is
         no state.tickets to read yet — and treating "too early" as "failed" is exactly the
         confusion the header warns about: it would latch _failed and leave the flat DOM card as
         the presentation for the whole session. renderAll() calls syncSlots the moment state
         exists, so the row appears on the first render either way. */
    } catch (e) {
      /* A broken deck must cost the picture and nothing else — fx.js falls back to a flat DOM
         card, and the game plays on. */
      console.warn("Shoe3D init failed:", e);
      this._failed = true;
    }
  },
  /* Which framing is up. ?view=mobile IS phone framing but deliberately never writes
     cfg.phoneView, so both have to be consulted — the same test board3d.js uses for its zoom. */
  _phone() { return !!(cfg.phoneView || (typeof VIEW_MOBILE !== "undefined" && VIEW_MOBILE)); },
  /* Definitively broken, as opposed to merely not built yet. */
  failed() { return this._failed || !this._scene; },

  /* ---------------- the deck ---------------- */
  /* Half the gap, stepped along the screen-horizontal axis. Negative is left. */
  _pairPos(side) {
    const h = (PAIR_GAP / 2) * side * SQ2;
    return new THREE.Vector3(DECK_AT + h, TABLE_Y, DECK_AT - h);
  },
  _anchorPos() { return this._pairPos(-1); },        // the deck, on the left

  /* How many cards are in the shoe, right now. Guarded because Board3D.init() — and therefore
     the first _buildDeck() — runs BEFORE boot() calls initState(), so there is no state.shoe to
     read yet; a full pack is the right thing to draw in that window, and the first frame after
     initState corrects it if the run was mid-shoe. */
  _count() {
    return (typeof Shoe !== "undefined" && typeof state !== "undefined" && Array.isArray(state.shoe))
      ? Shoe.count() : Math.round(cfg.packSize || 54);
  },
  /* Slabs depicting a shoe of n cards. 0 → nothing at all, 1 → a single card lying on the table,
     a full pack OR ANYTHING MORE → DECK_MAX. The clamp on frac is what makes one pack and twenty
     look the same; see the constants above for why the curve under it is not linear. */
  _slabs(n) {
    if (n <= 0) return 0;
    const full = Math.max(2, Math.round(cfg.packSize || 54));
    const frac = Math.min(1, (n - 1) / (full - 1));
    return 1 + Math.round((DECK_MAX - 1) * Math.pow(frac, DECK_CURVE));
  },
  /* World height of the top of the deck when the shoe holds n — where a card sits before it is
     pulled, and where the flying card has to start from. Absolute, not relative to the deck's
     base, because that is what pullCard() overwrites `from.y` with. */
  _topY(n) { return TABLE_Y + CARD_T * this._slabs(n) * 1.05 * DECK_SCALE; },

  /* Redraw the deck when, and only when, what it depicts has changed.
     PULLED EVERY FRAME RATHER THAN PUSHED FROM THE CALL SITES. The shoe changes on a pull, on a
     buy, on a session's free deal, on loadState and on a reset — five paths, and a readout that
     has to be notified by all five is a readout that is wrong after the sixth is added. This
     costs one string compare per frame and cannot fall out of sync. */
  /* Everything the drawn deck depends on: the count, and the pack size the curve is measured
     against (which a joker-count change moves). Nothing view-dependent is left in the stack, so
     the phone/desktop split that used to be in here would only cause a pointless rebuild. */
  _deckKey() { return `${this._count()}/${Math.round(cfg.packSize || 54)}`; },
  syncDeck() {
    if (!this._scene || this._failed) return;
    /* Never mid-riffle: shuffleDeck() owns the group until it squares up, and rebuilding under
       it would leave half a shuffle on the board. It rebuilds on its way out. */
    if (this._shuffling) return;
    if (this._deckKey() === this._deckSig) return;
    this._buildDeck();
  },

  _buildDeck() {
    const g = this._deck;
    while (g.children.length) g.remove(g.children[0]);
    /* Rebuilt every few pulls now rather than once a session, so the buffers it replaces have to
       go back. Materials only — the card-back TEXTURE is cached and shared, and three.js does
       not dispose a material's maps for it, which is exactly what makes this safe. */
    if (this._deckGeo) this._deckGeo.dispose();
    if (this._deckMats) this._deckMats.forEach(m => m.dispose());
    const s = DECK_SCALE;
    const back = new THREE.MeshBasicMaterial({ map: this._backTexture() });
    const edge = new THREE.MeshLambertMaterial({ color: EDGE_COLOR });
    const geo = new THREE.BoxGeometry(CARD_W, CARD_T, CARD_H);
    this._deckGeo = geo; this._deckMats = [back, edge];
    /* One stack, slabs straight onto the deck group — no pile sub-groups to reason about, which
       is also why shuffleDeck can riffle the deck group's children directly again. */
    const slabs = this._slabs(this._count());
    for (let k = 0; k < slabs; k++) {
      const m = new THREE.Mesh(geo, [edge, edge, back, edge, edge, edge]);
      m.position.y = CARD_T * k * 1.05 + CARD_T / 2;
      m.rotation.y = (k % 2 ? 0.03 : -0.02);
      m.castShadow = !!cfg.envShadows;
      g.add(m);
    }
    g.scale.setScalar(s);
    g.position.copy(this._anchorPos());
    this._deckScale = s;
    /* Turned to the fixed camera, like the token and the mystery box: a card has a front and no
       board edge to align with, so it should read from where the player is sitting. */
    g.rotation.y = THREE.MathUtils.degToRad(ENV_CAM.az);
    this._deckSig = this._deckKey();
  },

  /* ---------------- the ticket placeholders ---------------- */
  /* Redrawn whenever a ticket lands. The row length comes from Tickets.pageSlots(), which is
     SHORT on the last row of a series when the content runs out — never assume five. */
  syncSlots() {
    if (!this._scene || this._failed) return;
    /* Called from renderAll(), which can run before initState() has built the row. */
    if (typeof state === "undefined" || !Array.isArray(state.tickets)) return;
    /* REBUILD ONLY WHEN SOMETHING CHANGED. renderAll() runs on every float, every log line and
       every event in a pull, and each rebuild here paints five canvases and uploads five
       textures — enough to visibly stall the pull loop. The signature covers everything the
       faces draw, so a change the player can see always redraws and nothing else does. */
    const sig = Tickets.pageSlots().map(i =>
      `${i}:${Tickets.held(i)}:${Tickets.isWatched(i) ? 1 : 0}`).join("|")
      + `#${Tickets.perEpisode()}/${this._phone() ? "p" : "d"}`;
    if (sig === this._slotSig) return;
    this._slotSig = sig;
    const g = this._slots;
    while (g.children.length) { const c = g.children[0]; g.remove(c); c.traverse?.(o => o.material?.map?.dispose?.()); }
    const idx = (typeof Tickets !== "undefined") ? Tickets.pageSlots() : [];
    if (!idx.length) return;
    const per = Tickets.perEpisode();
    const row = this._phone() ? ROW_PHONE : ROW;
    const a = row.at, gap = row.gap;
    idx.forEach((slot, k) => {
      const off = (k - (idx.length - 1) / 2) * gap;
      /* Along (1,−1)/√2 — the axis that is horizontal on screen under the 45° camera. */
      const x = -a + off * SQ2, z = -a - off * SQ2;
      const held = Tickets.held(slot), full = Tickets.isFull(slot);
      const watched = full && Tickets.isWatched(slot);
      /* WHICH LEAD THIS PLACEHOLDER COLLECTS — its position on the row, which is the joker's own
         index. Passed in rather than derived inside the texture, because the row is a window into
         the series and the slot's series index is not its position on the row. */
      const map = this._slotTexture(slot + 1, held, per, full, watched, k);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
      /* Height is the fixed dimension and width follows the face's own aspect — the fan grows
         taller with cfg.ticketsPerEpisode, so a hardcoded pair would squash it. */
      /* World height of the whole fan. A sprite is camera-facing, so its height maps almost
         one-for-one onto screen vertical — which makes this the value that decides whether the
         row survives the camera aiming low (token near Start) without clipping the top of the
         frame. Tunable for exactly that reason. */
      const th = row.height;
      spr.scale.set(th * (map.userData.aspect || 0.5), th, 1);
      /* Seated on the board and growing UP from it, so the fan cannot ride out of the top of
         the frame as ticketsPerEpisode grows — the sprite's height is its whole extent. */
      spr.position.set(x, 0.14 + th / 2, z);
      /* The slot index rides on the sprite so a raycast hit can say WHICH episode was tapped
         without the picker needing to know how the row is laid out. */
      spr.userData.slot = slot;
      g.add(spr);
    });
  },
  /* A placeholder's face: the episode, and the jokers collected into it as a VERTICAL FAN.

     THE COLLECTED JOKERS STAY VISIBLE, as the cards themselves. A ticket is a card the player
     pulled, and a row of dots throws that away — the fan says "you are holding three of these"
     in the same language the pull did.

     Fanned DOWNWARD with a uniform offset, like a hand held in one place: each card shows a
     strip of itself and the last one is whole. Uniform and untilted on purpose — a real hand
     splays at angles, but this is a progress readout about 90px tall on screen, and any rotation
     turns it into noise. Aligned reads; scattered does not.

     Each card is cropped to the PORTRAIT rather than scaled whole. The visible strip of a fanned
     card is only the top third, so that strip has to carry the identity — a shrunk full card
     puts the head where nobody can see it and leaves a spotlight beam in the gap. Cropping to
     head-and-shoulders means every strip in the fan is a face.

     Empty slots stay as ghost outlines in the same positions, so 3/5 reads without counting.

     WHICH joker is now STATE rather than presentation. A placeholder collects one lead — the one
     at its position on the row — so the fan draws that lead `held` times and is telling the truth
     about what is in it. `lead` is passed in for that reason; deriving it here would mean this
     function knowing how the row window maps onto the series. */
  _slotTexture(n, held, per, full, watched, lead) {
    const CW = 112, CH = 157, STEP = 32;          // card, and how far each one drops
    const W = 170, HEAD = 42, PAD = 12;
    const H = HEAD + CH + STEP * Math.max(0, per - 1) + PAD;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");

    const body = full ? (watched ? "rgba(45,212,191,.94)" : "rgba(255,203,92,.97)") : "rgba(20,24,54,.90)";
    const ink = full && !watched ? "#3a2a00" : "#fff";
    x.fillStyle = body;
    x.strokeStyle = full && !watched ? "#fff3cf" : "rgba(255,255,255,.35)";
    x.lineWidth = 5;
    this._roundRect(x, 6, 5, W - 12, H - 10, 16);
    x.fill(); x.stroke();

    x.fillStyle = ink;
    x.textAlign = "center";
    x.font = "bold 25px system-ui,sans-serif";
    x.fillText(full && !watched ? "▶ WATCH" : `EP ${n} · ${held}/${per}`, W / 2, 30);

    const cx = (W - CW) / 2;
    for (let i = 0; i < per; i++) {
      const cy = HEAD + STEP * i;
      if (i < held) {
        x.save();
        x.shadowColor = "rgba(0,0,0,.55)"; x.shadowBlur = 7; x.shadowOffsetY = 2;
        this._roundRect(x, cx, cy, CW, CH, 9);
        x.fillStyle = "#fbf7ec"; x.fill();          // the card's own edge, under the art
        x.restore();
        x.save();
        this._roundRect(x, cx, cy, CW, CH, 9);
        x.clip();
        /* ONE LEAD PER PLACEHOLDER. This used to alternate the jokers by position, because the
           game recorded only that a slot held a ticket and never which of the two it was — so
           alternating depicted a typical fill rather than claiming a particular one. A slot now
           collects exactly one lead, so the fan is five of that lead and the claim is true. */
        const face = (typeof CardArt !== "undefined")
          && CardArt.face(Shoe.JOKERS[Math.max(0, lead | 0) % Shoe.JOKERS.length]);
        if (face) {
          /* Crop at the destination's aspect so nothing stretches, taken from the upper body. */
          const sh = face.height * 0.58, sw = sh * (CW / CH);
          x.drawImage(face, (face.width - sw) / 2, face.height * 0.10, sw, sh, cx, cy, CW, CH);
        } else { x.fillStyle = "#ff6fa5"; x.fillRect(cx, cy, CW, CH); }
        x.restore();
        this._roundRect(x, cx, cy, CW, CH, 9);
        x.lineWidth = 3; x.strokeStyle = "rgba(255,255,255,.92)"; x.stroke();
      } else {
        this._roundRect(x, cx, cy, CW, CH, 9);
        x.setLineDash([6, 5]);
        x.lineWidth = 2.5;
        x.strokeStyle = full && !watched ? "rgba(58,42,0,.4)" : "rgba(255,255,255,.25)";
        x.stroke();
        x.setLineDash([]);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    tex.userData = { aspect: W / H };
    return tex;
  },
  _roundRect(x, l, t, w, h, r) {
    x.beginPath();
    x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
    x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
  },

  /* ---------------- shuffling a new deck in ----------------

     Bought cards are already IN the shoe before a frame of this runs — Shoe.buyPack() merges and
     reshuffles synchronously, and this is decoration on top. Same rule as the mystery boxes: if
     the tab reloads or WebGL dies halfway through, the player still has every card they bought
     and only the picture was lost.

     What it shows is what actually happened: the deck already on the table, a second deck
     arriving beside it, the two riffled together, and one deck squared up again. That is
     literally Shoe.buyPack's contract — MERGE and reshuffle, never replace — so a player who
     wonders where their old cards went can watch the answer.

     Guarded against overlapping itself: a second buy mid-shuffle would otherwise clone the
     clones and leave a permanent double stack on the board. */
  shuffleDeck(){
    if (this.failed() || this._shuffling) return Promise.resolve();
    const ms = Math.max(1, +cfg.shuffleMs || 1);
    const off = 0.62;                        // how far apart the two piles stand
    const lift = 0.55;                       // how high the new deck drops in from
    const step = CARD_T * 1.05;
    const yAt = i => step * i + CARD_T / 2;

    /* Drawn at the new count first: Shoe.buyPack has already merged and reshuffled the whole
       shoe before a frame of this runs, so what is owed here is the picture of a shuffle rather
       than an accounting of which cards moved. */
    this.syncDeck();
    const g = this._deck;
    const A = g.children.slice();            // the deck already on the table
    if (!A.length) return Promise.resolve();
    /* The new deck. Cloned, so it shares geometry and material with the stack it is about to
       join — this is 14 more draw calls for under a second, not an asset. */
    const B = A.map(m => { const c = m.clone(); g.add(c); return c; });
    this._shuffling = true;

    const ease = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    const n = A.length;

    const finish = () => {
      if (!this._shuffling) return;
      this._shuffling = false;
      B.forEach(m => g.remove(m));
      this._buildDeck();                     // squared up, at the height the new count deserves
    };

    return new Promise(resolve => {
      const done = () => { finish(); this._done = this._done.filter(r => r !== done); resolve(); };
      this._done.push(done);
      this._anims.push({
        t: 0, dur: ms,
        step: k => {
          /* Three beats in one tween: split apart, riffle together, settle. */
          if (k < 0.30) {
            const e = ease(k / 0.30);
            A.forEach((m, i) => { m.position.set(-off * e, yAt(i), 0); m.rotation.z = -0.06 * e; });
            B.forEach((m, i) => {
              m.position.set(off * (2 - e), yAt(i) + lift * (1 - e), 0);
              m.rotation.z = 0.06 * e;
            });
          } else if (k < 0.75) {
            /* The riffle: the two piles come back to the middle and INTERLEAVE — A into the even
               slots, B into the odd ones — which is the only part of this that has to read as
               shuffling rather than stacking. */
            const e = ease((k - 0.30) / 0.45);
            const arc = Math.sin(e * Math.PI) * 0.10;
            A.forEach((m, i) => {
              m.position.set(-off * (1 - e), yAt(2 * i) * (0.6 + 0.4 * e) + arc, 0);
              m.rotation.z = -0.06 * (1 - e);
            });
            B.forEach((m, i) => {
              m.position.set(off * (1 - e), yAt(2 * i + 1) * (0.6 + 0.4 * e) + arc, 0);
              m.rotation.z = 0.06 * (1 - e);
            });
          } else {
            /* Settle: the doubled stack compresses back to one deck's height. */
            const e = ease((k - 0.75) / 0.25);
            const squash = 1 - 0.5 * e;
            A.forEach((m, i) => { m.position.set(0, yAt(2 * i) * squash, 0); m.rotation.z = 0; });
            B.forEach((m, i) => { m.position.set(0, yAt(2 * i + 1) * squash, 0); m.rotation.z = 0; });
          }
        },
        end: done,
      });
      /* The frame loop may never run — a backgrounded tab. The deck must not be left split. */
      setTimeout(done, ms + 400);
    });
  },

  /* ---------------- pulling ---------------- */
  /* THE DISCARD SPOT — a FIXED place on the board, not a place on the screen.

     Every card lands here, face up and flat, and the next one lands on top of it. Only the last
     card pulled is ever visible: as soon as a new one arrives the one underneath is taken out of
     the scene, so the pile is one card deep however long the session runs.

     Deliberately NOT the camera's aim point. That is where the mystery box flies, because a box
     is a momentary burst that has to be centre-screen wherever the camera happens to be looking.
     A pulled card is different: it is the board's memory of the last thing that happened, so it
     belongs at a place on the BOARD that the player learns, not at a place on the glass that
     moves with the token.

     The board's centre is the safest fixed point in the frame, and not by accident — it is
     exactly what cfg.camBias pulls the aim toward, so the more the camera follows the token the
     closer the centre sits to the middle of the view. */
  _discardPos() { return this._pairPos(1); },        // the pulled card, on the right

  /* THE EMPTY SLOT THE PULLED CARD LANDS IN.

     A ghost outline, shown only while there is no card on it. Without it the pair is lopsided
     before the first pull of a run — a deck sitting off to the left of nothing, which reads as a
     mistake rather than as a deck waiting to deal. It is also what makes the card's arrival land
     somewhere the eye already knows, instead of somewhere it has to find.

     Drawn rather than modelled: a dashed rounded rect on a canvas, the same language the episode
     placeholders use for a slot that has not been filled yet. */
  _buildGhost() {
    if (this._ghost || !this._scene) return;
    const c = document.createElement("canvas");
    c.width = 132; c.height = 188;
    const x = c.getContext("2d");
    this._roundRect(x, 6, 6, c.width - 12, c.height - 12, 14);
    x.fillStyle = "rgba(12,16,40,.42)"; x.fill();
    x.setLineDash([10, 8]); x.lineWidth = 6;
    x.strokeStyle = "rgba(255,235,190,.72)"; x.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * CARD_SIZE, CARD_H * CARD_SIZE),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;                       // lie flat on the table
    m.position.copy(this._discardPos());
    /* ABOVE the table height, not below it. Slipping it under a card so the card would cover it
       put a zero-thickness plane at y≈0.034, and the board's own ground wins there — the same
       swallowing that TABLE_Y exists to escape, and worse for a plane with no thickness at all.
       It never fights a real card because the two are never visible at the same time. */
    m.position.y += 0.010;
    /* Yaw applied after the flat rotation, so it squares to the camera like the card that will
       land on it. Order matters — rotation.set would undo the tilt. */
    m.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(ENV_CAM.az));
    this._scene.add(m);
    this._ghost = m;
  },
  /* Visible exactly when the slot is empty. Called wherever _discard changes. */
  _syncGhost() {
    if (!this._ghost) return;
    this._ghost.position.copy(this._discardPos());
    this._ghost.position.y += 0.010;
    this._ghost.visible = !this._discard;
  },

  /* Pull a card, in TWO BEATS.

       1. PRESENTED — it leaves the deck and comes up in front of the camera: big, square to
          the view, dead centre of the screen. This is the beat the player actually reads, and
          it owns the whole of cfg.pullRevealMs, so "tap → the number is readable" still means
          exactly what it always did. The promise resolves at the end of it.

       2. DEALT — it travels down onto the discard spot and lies flat on the table.

     Beat 2 costs NOTHING in pacing, and that is the point: it starts once the reveal has already
     resolved, so it runs while pull() is stepping the token around the board. The turn is exactly
     as long as it was when the card flew straight to the table.

     SQUARE TO THE CAMERA in beat 1, not flat on the board. The camera looks down at 38°, so a
     card lying flat is foreshortened to about 62% of its height — legible, but working against
     you in the half-second that matters. Turning it to face the view is most of why this reads
     better, more than the size does.

     CENTRED BY MOVING ALONG THE VIEW AXIS. The camera is orthographic, so sliding the card
     toward the camera does not change its size or its position on screen one pixel — it only
     puts it in front of everything else. That is what lets it sit dead centre over the board
     without hovering at some arbitrary height that reads as "stuck in the air". Size comes from
     scaling instead, which is why cardPresentScale exists.

     `view` is Board3D's LIVE camera target and camera. Read every frame on purpose: with
     camFollow on, the aim drifts while the card is in the air, and a pose computed once would
     let the card slide off-centre exactly when the player is trying to read it.

     A JOKER DOES NOT ARRIVE LIKE A 7 OF STARS. It is the prize the whole board exists to hand
     out, and pulling one used to look exactly like pulling a number. So it comes up BIGGER
     (cfg.jokerScale), PUNCHES past that size and settles back into it, TURNS once on the way up,
     and then hangs there for cfg.jokerHoldMs before the row collects it.

     ALL OF IT IS FREE. The flight is still cfg.pullRevealMs and the promise still resolves at
     exactly that mark, so the turn is not one frame slower than it was; the extra hold sits
     after resolve() alongside the existing one, where the token is already walking through it.
     The celebration is bought entirely out of time the pull was spending anyway. */
  /* ONE CARD ON THE STAGE AT A TIME — the invariant, enforced here rather than by hoping the
     callers are slow enough.

     Every card is presented at the SAME place (the middle of the screen), so a second one
     arriving while the first is still there lands on top of it. That used to be hidden by luck:
     a numbered card is off to the table about 470ms after the reveal resolves, and pull() rarely
     came back round faster than that. A joker holds for cfg.jokerHoldMs and then takes
     cfg.cardToTableMs to reach the row — well over a second of stage time after pull() has
     already returned — and the auto loop starts the next pull 60ms later. So the overlap stopped
     being a race nobody won and became the normal case.

     PUT AWAY, NOT DELETED. The outgoing card is sent where it was already going — the table, or
     the placeholder it filled — so the board ends up in exactly the state it would have reached
     on its own. Nothing is lost, no reward is skipped, and the fast path costs no time: this is
     what lets a player hammer Pull without the celebration ever queueing up behind itself. */
  _clearStage() {
    /* A celebration is on the stage in the same sense a card is — put it away first, or the
       hand goes on floating in front of the card that just interrupted it. */
    this.cancelHand();
    const prev = this._flying;
    if (!prev) return;
    /* Drop the tweens still driving it first, or they go on writing a pose onto a card that has
       already been put away — which is what would drag a settled discard back off the table. */
    this._anims = this._anims.filter(a => a.mesh !== prev);
    if (prev.userData.putAway) prev.userData.putAway();
    if (this._flying === prev) { this._scene.remove(prev); this._flying = null; this._stageCleared(); }
  },
  /* Resolves once the stage is clear — the joker's hold and its flight into the row included.
     pull() awaits this so a celebration is watched rather than trampled; see js/ui/main.js.

     ALWAYS RESOLVES. maxMs is not a nicety: state.animating is cleared in pull()'s finally, so a
     promise that never settled would soft-lock the board with Pull disabled forever, which is
     the one failure this file's header is most insistent about. Resolving twice is harmless. */
  whenClear(maxMs) {
    if (!this._flying) return Promise.resolve();
    return new Promise(res => {
      (this._clearWaiters || (this._clearWaiters = [])).push(res);
      setTimeout(res, Math.max(0, +maxMs || 4000));
    });
  },
  _stageCleared() {
    const w = this._clearWaiters;
    this._clearWaiters = null;
    if (w) w.forEach(r => r());
  },

  pullCard(card, view) {
    if (this.failed()) return Promise.resolve();
    /* Before anything else: whatever is still being presented goes where it was going. */
    this._clearStage();
    const ms = Math.max(1, +cfg.pullRevealMs || 1);
    const downMs = Math.max(1, +cfg.cardToTableMs || 1);
    const arc = CARD_ARC, size = CARD_SIZE, lift = PRESENT_LIFT;
    const from = this._anchorPos();
    /* The top of the open pack as it stood WITH this card still in it. Shoe.pull() has already
       taken it out of state by the time this runs, so the height to launch from is the one for
       count + 1 — otherwise a card takes off from inside a deck that has already shrunk by it.
       (It is the last card that makes this visible: the deck is empty behind it, and the card
       still has to leave the table rather than the air where a full deck used to be.) */
    from.y = this._topY(this._count() + 1);
    const yaw = THREE.MathUtils.degToRad(ENV_CAM.az);

    /* WHERE THIS CARD IS GOING, decided now rather than on arrival.

       A numbered card is a MOVE, so it is dealt to the table and stays there as the board's
       memory of the last turn. A joker is a TICKET, so it is collected into the episode row —
       it flies into the placeholder it fills and is absorbed by it. Sending a joker to the
       table instead would say the wrong thing twice over: it is not the last move, and the
       thing it actually did happened somewhere else on the board.

       THE SLOT IS THE CARD'S OWN, and it is read BEFORE the ticket is awarded because pull()
       awards after this animation is already under way. It used to be "the lowest unfilled
       placeholder", mirroring award()'s rule; now each lead collects into its own episode, so it
       is the slot at this joker's index. THE TWO RULES ARE STILL MIRRORED AND STILL UNENFORCED —
       change one without the other and every joker flies into a placeholder while its ticket
       lands in a different one, which the board shows and nothing reports.

       Falls back to the table when there is nowhere to fly: an unknown joker (index -1, a
       wildcard to award()), or a slot already full, in which case the ticket is banked. */
    const ticket = (typeof Shoe !== "undefined") && Shoe.isTicket(card);
    let slot;
    if (ticket && typeof Tickets !== "undefined") {
      const k = Shoe.jokerIndex(card);
      const row = Tickets.pageSlots();
      const s = (k >= 0 && k < row.length) ? row[k] : undefined;
      if (s != null && !Tickets.isFull(s)) slot = s;      // slot 0 is legitimate AND falsy
    }
    const table = this._discardPos();

    /* How big it gets, and how hard it lands. A number reads at PRESENT_SCALE and always has;
       a joker multiplies that by cfg.jokerScale. Clamped at 1 from below on purpose — a joker
       may be made as loud as a designer likes but never quieter than an ordinary card, which is
       the one setting that would make the prize look like a consolation. */
    const grow = PRESENT_SCALE * (ticket ? Math.max(1, +cfg.jokerScale || 1) : 1);

    /* Where "in front of the screen" is, right now. */
    const _p = new THREE.Vector3(), _d = new THREE.Vector3();
    const presentPos = () => {
      if (!view || !view.aim || !view.camera) return _p.set(table.x, table.y + lift, table.z);
      _d.copy(view.camera.position).sub(view.aim).normalize();
      return _p.copy(view.aim).addScaledVector(_d, lift);
    };
    /* Facing the camera: the face is the box's +Y, so the camera's own orientation turned a
       quarter turn about X puts that face square to the view. */
    const _q = new THREE.Quaternion();
    const faceQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const presentQuat = () => (view && view.camera)
      ? _q.copy(view.camera.quaternion).multiply(faceQuat)
      : _q.setFromEuler(new THREE.Euler(0, yaw, 0));
    const flatQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));

    const mesh = this._makeCard(card);
    mesh.position.copy(from);
    mesh.scale.setScalar(size);
    /* IN FRONT OF EVERYTHING, by not testing depth at all rather than by being nearer.

       While it is presented this card is a readout, not a prop: it is the one thing the player
       has to read in that half-second, and nothing on the board has any business covering it.
       Depth alone was not enough — the episode row is tall, camera-facing and sits near the
       middle of the frame, so it could land in front of the card and hide it outright.

       Restored to ordinary depth the moment it is dealt to the table, where it IS a prop and
       should sit under anything that passes over it. */
    this._setOverlay(mesh, true);
    this._scene.add(mesh);
    this._flying = mesh;

    /* Beat 2. Also backstopped by a timer: it is only decoration, but if the frame loop never
       runs — a backgrounded tab — the card must not be left hanging in front of the camera
       forever. Whichever gets there first wins; toTable is idempotent. */
    const dest = () => (slot != null && this.slotWorldPos(slot)) || table;

    const toTable = () => {
      if (mesh.userData.dead || mesh.userData.tabled) return;
      mesh.userData.tabled = true;
      if (this._flying === mesh) this._flying = null;

      /* A joker is absorbed by the placeholder it filled: it does not stay on the board, and it
         does NOT become the discard. The table goes on showing the last card that MOVED you,
         which is the thing that spot is for. */
      if (slot != null) {
        this._scene.remove(mesh);
        this.syncSlots();                  // the pip it just filled
        this._stageCleared();
        return;
      }
      mesh.position.copy(table);
      mesh.quaternion.copy(flatQuat);
      mesh.scale.setScalar(size);
      this._setOverlay(mesh, false);      // back to being part of the scene
      /* The one underneath is now completely hidden, so it is removed rather than left to
         accumulate — one card in the scene per discard spot, forever. Done at the END of the
         trip down, not at the start: until this card is actually on the table the old one is
         still what the player can see there. */
      if (this._discard && this._discard !== mesh) this._scene.remove(this._discard);
      this._discard = mesh;
      this._syncGhost();
      this._stageCleared();
    };
    /* How a LATER pull puts this card away without waiting for it — see _clearStage(). */
    mesh.userData.putAway = toTable;
    const startDown = () => {
      /* `dead` is the cancel case, and it matters BECAUSE of the hold: cancel() can now land in
         the gap between the reveal resolving and this firing, and without the guard a card
         already taken out of the scene would still be installed as the discard — blanking the
         spot the player is looking at, since installing it removes the card actually on the
         table. */
      if (mesh.userData.dead || mesh.userData.tabled || mesh.userData.falling) return;
      mesh.userData.falling = true;
      const p0 = mesh.position.clone(), q0 = mesh.quaternion.clone(), s0 = mesh.scale.x;
      /* A joker shrinks into its placeholder rather than settling flat on the table, so it reads
         as being COLLECTED by the row instead of discarded onto it. */
      const s1 = slot != null ? size * 0.18 : size;
      this._anims.push({
        mesh, t: 0, dur: downMs,
        step: k => {
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          mesh.position.lerpVectors(p0, dest(), e);
          mesh.quaternion.slerpQuaternions(q0, flatQuat, e);
          mesh.scale.setScalar(s0 + (s1 - s0) * e);
        },
        end: toTable,
      });
      setTimeout(toTable, downMs + 400);
    };

    return new Promise(resolve => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        /* Force the presented pose rather than trusting the tween to have got there: if the tab
           was backgrounded, no frame ran at all and the card is still sitting on the deck. */
        mesh.position.copy(presentPos());
        mesh.quaternion.copy(presentQuat());
        mesh.scale.setScalar(size * grow);
        this._done = this._done.filter(r => r !== finish);
        resolve();
        /* Beat 2 begins after a beat of stillness, so the card is readable at rest rather than
           only in motion. Both the hold and the drop sit AFTER resolve(), so neither one is on
           the turn's critical path — the token is already walking through them. Which is what
           lets a joker hang there for most of a second: it is the only reward in the game the
           player is shown rather than told, and it costs the turn nothing to let them look. */
        const hold = Math.max(0, +(ticket ? cfg.jokerHoldMs : cfg.cardHoldMs) || 0);
        if (hold) setTimeout(startDown, hold); else startDown();
      };
      const finish = settle;
      this._done.push(finish);
      /* Beat 1 — the picture. May be interrupted, dropped, or never run at all.

         THE PUNCH IS ON THE SCALE ALONE, never the position. easeOutBack overshoots its target
         by about a tenth and settles back onto it, which is the "it grows, then sits down into
         its size" the celebration is made of — but applied to the POSITION it would sail past
         the middle of the screen and slide back, and the one thing this beat owes the player is
         a card that is where they are looking. Position keeps the plain ease either way.

         THE SPIN IS IN THE CARD'S OWN PLANE — a rotation about its face normal (local +Y),
         applied after the orientation, so the face stays square to the camera through the whole
         turn. A tumble would be louder and would spend half the flight showing the card's back,
         which is the half the player is trying to read the joker in. */
      const _spin = new THREE.Quaternion(), _axis = new THREE.Vector3(0, 1, 0);
      this._anims.push({
        mesh, t: 0, dur: ms,
        step: k => {
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          mesh.position.lerpVectors(from, presentPos(), e);
          /* A joker is lobbed higher off the deck than a number — the same gesture, thrown. */
          mesh.position.y += Math.sin(e * Math.PI) * arc * (ticket ? 0.6 : 0.35);
          mesh.quaternion.slerpQuaternions(flatQuat, presentQuat(), e);
          if (ticket) mesh.quaternion.multiply(_spin.setFromAxisAngle(_axis, Math.PI * 2 * e));
          /* The bloom starts LATE (after JOKER_BLOOM_AT of the flight), and that delay is the
             whole reason it reads as a beat. easeOutBack is already past full size a third of
             the way through its own curve, so run over the flight entire the card is simply big
             before it has gone anywhere — a large card drifting to the middle, not a small one
             that becomes large. Held back, the order is: it leaves the deck a card, blooms and
             overshoots on the way up, and settles into its size as it arrives. */
          const s = ticket
            ? backOut(Math.max(0, (k - JOKER_BLOOM_AT) / (1 - JOKER_BLOOM_AT)))
            : e;
          mesh.scale.setScalar(size * (1 + (grow - 1) * s));
        },
        end: () => {},
      });
      /* The contract. Independent of the frame loop, so it holds in a background tab. */
      setTimeout(settle, ms);
    });
  },
  /* ---------------- completing a collection ----------------

     THE HAND YOU COLLECTED. Five jokers fill a placeholder and unlock an episode, and until now
     that moment showed nothing of its own — the fifth card flew in exactly like the other four
     and the player could miss the one thing the whole board is for. So the collection comes back
     out and takes a bow: the cards rise out of the placeholder, splay into a hand, hold, and then
     merge into the single episode they bought before dropping home.

     IT IS THE CARDS THEMSELVES, not a poster of them. `_makeCard` with the slot's own lead, which
     is the same expression the placeholder's fan draws — so this is the fan standing up rather
     than five cards the player never collected. _faceTexture memoises, so all `per` meshes share
     one face texture and one upload.

     FOUR RULES, and every one is a bug that was reasoned out rather than found:

       · THE PROMISE RESOLVES ON A TIMER. Backstopped by setTimeout, and the resolver goes on
         this._done so Shoe3D.cancel() — reached from clearOverlayFx on every error path —
         settles it. pull() awaits this inside playEvents, and its finally is what clears
         state.animating: a promise that only a frame could settle soft-locks a backgrounded tab.
       · finish() FORCES THE END STATE and is idempotent. A tab that never ran a frame still ends
         with the meshes gone, the row redrawn and the sprite back at its own scale.
       · THE SPRITE PUNCH NEEDS THE PAIRED LIFT. A sprite scales about its centre and the row's
         sprites are seated at 0.14 + height/2, so scaling one without lifting it by the same
         proportion grows it DOWN through the board.
       · THE ROW REBUILDS UNDER IT. syncSlots() replaces sprites whenever its signature changes
         (a ticket lands, CardArt finishes loading, the view flips), so the sprite and the
         destination are re-read every frame rather than captured. And slot 0 is a legitimate
         slot AND falsy — test != null, never truthiness. */
  completeHand(slot, per, view) {
    if (this.failed() || slot == null) return Promise.resolve();
    this.cancelHand();
    const n = Math.max(1, per | 0);
    const H = this._phone() ? HAND_PHONE : HAND;
    const riseMs = Math.max(1, +cfg.handRiseMs || 1), fanMs = Math.max(1, +cfg.handFanMs || 1);
    const holdMs = Math.max(0, +cfg.handHoldMs || 0), mergeMs = Math.max(1, +cfg.handMergeMs || 1);
    const homeMs = Math.max(1, +cfg.handSettleMs || 1), popMs = Math.max(1, +cfg.slotPopMs || 1);
    const total = riseMs + fanMs + holdMs + mergeMs + homeMs + popMs;

    const from = this.slotWorldPos(slot);
    if (!from) return Promise.resolve();
    /* The lead this placeholder collects is its POSITION on the row, not its series index. */
    const k = Math.max(0, Tickets.pageSlots().indexOf(slot));
    const face = Shoe.JOKERS[k % Shoe.JOKERS.length];

    const cards = [];
    for (let i = 0; i < n; i++) {
      const m = this._makeCard(face);
      m.position.copy(from);
      m.scale.setScalar(CARD_SIZE * 0.18);     // exactly where and how big the fifth card vanished
      this._setOverlay(m, true);
      this._scene.add(m);
      cards.push(m);
    }
    this._hand = cards;

    const grow = CARD_SIZE * PRESENT_SCALE * Math.max(0.2, +cfg.handScale || 1);
    const mid = (n - 1) / 2;
    const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
    const _right = new THREE.Vector3(), _spin = new THREE.Quaternion();
    const _axis = new THREE.Vector3(0, 1, 0);
    const faceQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const aimPos = () => {
      if (!view || !view.aim || !view.camera) return _p.copy(from).setY(from.y + PRESENT_LIFT);
      _d.copy(view.camera.position).sub(view.aim).normalize();
      return _p.copy(view.aim).addScaledVector(_d, PRESENT_LIFT);
    };
    const aimQuat = () => (view && view.camera)
      ? _q.copy(view.camera.quaternion).multiply(faceQ)
      : _q.setFromEuler(new THREE.Euler(0, THREE.MathUtils.degToRad(ENV_CAM.az), 0));
    /* Spread along the CAMERA's right vector, so the hand is horizontal on screen at any azimuth
       — a world axis would swing as the camera turns. */
    const right = () => (view && view.camera)
      ? _right.setFromMatrixColumn(view.camera.matrixWorld, 0)
      : _right.set(1, 0, 0);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      cards.forEach(m => {
        this._scene.remove(m);
        (Array.isArray(m.material) ? m.material : [m.material]).forEach(mt => mt && mt.dispose());
        m.geometry.dispose();                  // per-card geometry; the TEXTURES are shared, never disposed
      });
      this._hand = null;
      this._anims = this._anims.filter(a => !a.hand);
      this._restoreSlotScale();
      this.syncSlots();
      this._done = this._done.filter(r => r !== finish);
      /* Resolves WITH where the card ended up on screen — the launch point for the DOM leg. */
      if (this._handResolve) { const r = this._handResolve; this._handResolve = null; r(this._handFrom || null); }
    };

    return new Promise(resolve => {
      this._handResolve = resolve;
      this._done.push(finish);
      const push = (dur, step, end, delay) =>
        this._anims.push({ hand: true, t: -(delay || 0), dur: Math.max(1, dur), step, end });

      /* 1 · RISE — out of the placeholder and up to the middle of the view, still stacked. */
      push(riseMs, t => {
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const to = aimPos(), q = aimQuat();
        cards.forEach(m => {
          m.position.lerpVectors(from, to, e);
          m.quaternion.slerpQuaternions(m.quaternion, q, Math.min(1, e));
          m.scale.setScalar(CARD_SIZE * 0.18 + (grow - CARD_SIZE * 0.18) * e);
        });
      }, () => {
        /* 2 · SPLAY — the stack opens into a hand, overshooting and settling. */
        push(fanMs, t => {
          const e = backOut(t), c = aimPos(), q = aimQuat(), r = right();
          cards.forEach((m, i) => {
            const off = (i - mid) * H.gap * grow * e;
            m.position.copy(c).addScaledVector(r, off);
            m.quaternion.copy(q).multiply(_spin.setFromAxisAngle(_axis, (i - mid) * H.tilt * e));
            m.scale.setScalar(grow);
          });
        }, () => {
          /* 3 · HOLD — dead still, and the only place the shower fires. No confetti: pull()
             already threw some when the joker landed, and a second burst reads as a stutter. */
          push(holdMs || 1, () => {}, () => {
            /* 4 · MERGE — the outer cards slide behind the middle one and fade out. Five tickets
               in, one episode out, performed by the cards rather than by a cross-fade. */
            push(mergeMs, t => {
              const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
              const c = aimPos(), q = aimQuat(), r = right();
              cards.forEach((m, i) => {
                const off = (i - mid) * H.gap * grow * (1 - e);
                m.position.copy(c).addScaledVector(r, off);
                m.quaternion.copy(q).multiply(_spin.setFromAxisAngle(_axis, (i - mid) * H.tilt * (1 - e)));
                if (i !== Math.round(mid))
                  (Array.isArray(m.material) ? m.material : [m.material])
                    .forEach(mt => { if (mt) mt.opacity = 1 - e; });
              });
            }, () => {
              cards.forEach((m, i) => { if (i !== Math.round(mid)) m.visible = false; });
              const keep = cards[Math.round(mid)];
              /* 5 · HAND OFF. The survivor does NOT go back to the placeholder — it is being
                 COLLECTED, and the thing collecting it is the episode button, which is DOM. So
                 this is where the 3D half ends: its screen position is handed out and main.js
                 flies a DOM card from exactly there down into the button.

                 Dropping it home first was the earlier shape and read wrong: the card returned
                 to the row it had just left, and only then did a second card appear from the
                 same place and set off again. One journey, not two. */
              this._handFrom = (typeof Board3D !== "undefined" && Board3D.worldToScreen)
                ? Board3D.worldToScreen(keep.position) : null;
              push(1, () => {}, () => {
                keep.visible = false;
                this.syncSlots();
                /* 6 · PUNCH — the placeholder itself, which is the button about to be pressed. */
                const pop = Math.max(1, +cfg.slotPopScale || 1);
                push(popMs, t => {
                  const spr = this._slotSprite(slot);
                  if (!spr) return;
                  if (spr.userData.baseScale == null) {
                    spr.userData.baseScale = spr.scale.y;
                    spr.userData.baseY = spr.position.y;
                  }
                  const s = 1 + (pop - 1) * (1 - backOut(t));
                  const b = spr.userData.baseScale;
                  spr.scale.set(spr.scale.x / (spr.scale.y / b) * s, b * s, 1);
                  /* Paired lift, or scaling about the sprite's centre grows it down through
                     the board — it is seated at 0.14 + height/2, not at its base. */
                  spr.position.y = spr.userData.baseY + (b * (s - 1)) / 2;
                }, finish);
              });
            });
          });
        });
      });
      /* Independent of the frame loop, so a backgrounded tab still settles. */
      setTimeout(finish, total + 400);
    });
  },
  _slotSprite(slot) { return this.slotSprites().find(o => o.userData.slot === slot) || null; },
  _restoreSlotScale() {
    this.slotSprites().forEach(spr => {
      if (spr.userData.baseScale == null) return;
      const b = spr.userData.baseScale;
      spr.scale.set(spr.scale.x / (spr.scale.y / b), b, 1);
      spr.position.y = spr.userData.baseY;
      spr.userData.baseScale = null;
    });
  },
  /* Put a celebration away — a pull arriving mid-hand, or any error path. */
  cancelHand() { if (this._hand || this._handResolve) { this._anims = this._anims.filter(a => !a.hand); this._handFinish(); } },
  _handFinish() {
    const h = this._hand; this._hand = null;
    if (h) h.forEach(m => {
      this._scene.remove(m);
      (Array.isArray(m.material) ? m.material : [m.material]).forEach(mt => mt && mt.dispose());
      m.geometry.dispose();
    });
    this._restoreSlotScale();
    if (this._handResolve) { const r = this._handResolve; this._handResolve = null; r(this._handFrom || null); }
  },

  /* Where the card on the stage is, in world space, or null if nothing is presented.
     The mystery boxes a joker earns are thrown FROM here, so the reward visibly comes out of the
     card that paid for it rather than appearing from off-screen. Read at throw time rather than
     tracked: the card is at rest through its hold, which is exactly when the boxes go. */
  presentedPos() {
    return this._flying ? this._flying.getWorldPosition(new THREE.Vector3()) : null;
  },

  /* Wipe the discard spot entirely — a new run, not a new pull. */
  clearCard() {
    if (this._flying) { this._scene.remove(this._flying); this._flying = null; }
    if (this._discard) { this._scene.remove(this._discard); this._discard = null; }
    this._syncGhost();
    this._stageCleared();
  },
  /* Draw-over-everything, or ordinary depth.

     THREE FLAGS, AND ALL THREE ARE LOAD-BEARING — renderOrder alone does not do this, which is
     the trap. three.js draws every opaque object before ANY transparent one, and renderOrder
     only sorts within a pass. The ticket placeholders are transparent sprites, so an opaque card
     is always drawn before them however high its renderOrder; the only thing keeping it visible
     is its own depth write. Turn depthWrite off to "float" it and the sprites paint straight
     over the top instead.

     So while it is presented the card joins the TRANSPARENT pass (transparent), ignores the
     depth buffer (depthTest false), and sorts last within that pass (renderOrder). All three, or
     the episode row covers the one thing the player has to read.

     Materials are per-mesh here — each card builds its own face material — so flipping them
     cannot leak into another card. */
  _setOverlay(mesh, on) {
    mesh.renderOrder = on ? 900 : 0;
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => {
      if (!m) return;
      m.transparent = on;
      m.depthTest = !on;
      m.depthWrite = !on;
      m.needsUpdate = true;
    });
  },
  _makeCard(card) {
    const face = new THREE.MeshBasicMaterial({ map: this._faceTexture(card) });
    const back = new THREE.MeshBasicMaterial({ map: this._backTexture() });
    const edge = new THREE.MeshLambertMaterial({ color: 0xf4ecd8 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, CARD_T, CARD_H),
                             [edge, edge, face, back, edge, edge]);
    m.castShadow = !!cfg.envShadows;
    return m;
  },
  /* One texture per distinct card, kept for the session. CardArt caches the canvases, so this
     only has to stop three.js re-uploading the same pixels on every pull. */
  _faceTexture(card) {
    if (!this._tex) this._tex = new Map();
    if (!this._tex.has(card)) this._tex.set(card, this._tex4(CardArt.face(card)));
    return this._tex.get(card);
  },
  _backTexture() {
    if (!this._backTex) this._backTex = this._tex4(CardArt.back());
    return this._backTex;
  },
  _tex4(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  },
  /* Every placeholder sprite, for hit-testing. A full one draws a play triangle, so it is a
     button and has to actually be tappable — an affordance that does nothing reads as broken.
     Board3D.slotAt() raycasts these. */
  slotSprites() { return this._slots ? this._slots.children : []; },
  /* Where a given placeholder is standing, in world space — the target a joker flies to. */
  slotWorldPos(slot){
    const sp = this.slotSprites().find(o => o.userData.slot === slot);
    return sp ? sp.getWorldPosition(new THREE.Vector3()) : null;
  },

  /* ---------------- frame ---------------- */
  tick() {
    if (!this._scene || this._failed) return;
    /* The deck's seat is a constant, but its HEIGHT is the card count — see syncDeck() for why
       that is pulled here rather than pushed from the five places the shoe changes. A view
       switch changes which row constants apply, and the row is rebuilt from its signature. */
    if (this._phoneShown !== this._phone()) { this._phoneShown = this._phone(); this.syncSlots(); }
    this.syncDeck();
    for (let i = this._anims.length - 1; i >= 0; i--) {
      const a = this._anims[i];
      a.t += 1000 / 60;
      const k = Math.min(1, a.t / a.dur);
      a.step && a.step(k);
      if (k >= 1) { this._anims.splice(i, 1); a.end && a.end(); }
    }
  },
  /* Settle anything in flight and put the board back — the counterpart of Board3D.cancelBoxFx,
     called on the same error paths so a failed pull can never strand an awaited promise. */
  cancel() {
    this._anims.length = 0;
    this.cancelHand();
    /* A shuffle caught mid-riffle would leave two half-stacks on the board. */
    if (this._shuffling) { this._shuffling = false; this._buildDeck(); }
    /* Only the card in flight is abandoned. The discard stays: it is the last card the player
       actually saw, and clearing it on an unrelated error would make the board forget. */
    if (this._flying) {
      this._flying.userData.dead = true;      // a pending hold timer must not resurrect it
      this._scene.remove(this._flying);
      this._flying = null;
    }
    /* A cancelled card never reaches toTable, so nothing else would ever release whoever is
       waiting on the stage. Same reasoning as the _done list below it: an error path that
       strands an awaited promise is how the board soft-locks. */
    this._stageCleared();
    const waiting = this._done; this._done = [];
    waiting.forEach(r => r());
  },
};
