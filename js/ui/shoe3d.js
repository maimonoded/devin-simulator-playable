import * as THREE from "../../vendor/three.module.js";

/* The pull deck — the stack of cards standing inside the board ring, and the card that lifts off
   it when a bonus tile is landed on.

   Imported by js/ui/board3d.js, so it is a sibling module and adds NO <script> tag: this project
   still has exactly one type="module" and the classic load order is still the dependency order
   (CLAUDE.md). It reads the classic globals — cfg, ENV_CAM, CardArt — the same way board3d.js
   does; they are all defined by the time a deferred module runs.

   THE ENGINE OWNS THE MONEY. js/tiles/deck-tile.js drew the card, applied every coin, every
   point of energy and the item, and returned the finished event before a frame of this runs.
   Nothing in here decides anything: the pull REVEALS. A card that never animated has already
   been paid.

   THREE RULES INHERITED FROM THE BRANCH THIS CAME FROM, and every one of them is why the board
   does not soft-lock:

     · THE PULL PROMISE RESOLVES ON A setTimeout, NEVER FROM THE FRAME LOOP.
       requestAnimationFrame is suspended in a background tab. showCard() in js/ui/fx.js awaits
       this, and roll()'s finally in js/ui/main.js is the only thing that clears state.animating
       — so a frame-driven resolve means tabbing away mid-pull leaves the board permanently
       stuck with Roll disabled.
     · settle() FORCES THE FINAL POSE, so the card is where it belongs even if every frame was
       dropped, and whenClear(maxMs) ALWAYS resolves. Resolving twice is harmless; never
       resolving is fatal.
     · failed() MEANS BROKEN, NOT "NOT BUILT YET". fx.js keys its flat-card fallback off it, and
       conflating the two is what made the flat card flash on every page load.

   COORDINATES. One world unit is one tile; the ring is the outer band of an 11x11 grid, so the
   interior is x,z within about +-4.5 and the board's centre is the origin. The camera is fixed
   at 45 degrees azimuth, so screen-across is u = (x-z)/root2 and a larger (x+z) is LOWER on
   screen. Start sits at (+5,+5), the bottom vertex of the diamond, so the deck at (+d,+d) is
   straight down-screen from the middle — nearest the player, and out of the token's way. */

/* ---------------------------------------------------------------------------
   WHERE THE FURNITURE STANDS — constants, deliberately NOT cfg.

   The deck's seat and the discard spot are LAYOUT: there is one right answer per view, and it
   is found by looking at it. Nothing here is a balance knob.

   That is not only tidiness. cfg is PERSISTED, and loadConfig() in js/storage.js merges a saved
   config over the shipped defaults — so as long as a position lived in cfg, changing it changed
   NOTHING for anybody who had already opened the game: their save would keep whatever value was
   current the first time they loaded it. A constant cannot be shadowed by a save.

   TIMINGS DO GO IN cfg (cardPullMs, deckCardMs, cardToTableMs), with drawer rows. Pacing is a
   tuning surface and editing it live is the point. Position is not.

   THE DECK STANDS ALONE, ON THE CENTRE LINE. `at` is its DEPTH — how far down-screen from the
   board's centre it sits, along the Start<->VIP diagonal. `gap` used to hold a DISCARD SPOT
   beside it, where every card that had been read stayed lying face up as the board's memory of
   the last turn. This version does not keep them: a card is drawn, read, and goes back where it
   came from, so there is nothing to sit beside and gap is 0. The machinery is intact — give gap
   a value and the two separate again along (1,-1)/root2, the axis a 45-degree camera renders as
   horizontal.

   THE PHONE FRAME NEEDS ITS OWN NUMBERS. ?view=mobile is far more zoomed in (cfg.camZoomPhone
   0.5 against camZoom 0.85), so the desktop pair walks off the bottom of a 9:16 frame — it sits
   nearer the middle and smaller there. */
const DECK = { at: 1.70, gap: 0, scale: 2.00 };
const DECK_PHONE = { at: 1.05, gap: 0, scale: 1.65 };

/* HOW HIGH "ON THE TABLE" IS, and it is not zero. The board's surface is ENV_Y.deck = 0, and a
   card seated exactly there is swallowed by it — the floor wins and a card lying flat simply
   does not render. Shared, so the stack and the discard lie on the board at the same height. */
const TABLE_Y = 0.04;
const CARD_W = 0.66, CARD_H = 0.94, CARD_T = 0.026;
const CARD_SIZE = 1.65;          // the pulled card, at rest — matches the stack it came off
const CARD_ARC = 1.6;            // how high it is lobbed off the deck on the way up
/* HOW BIG IT GETS WHILE IT IS BEING READ.

   THESE ARE AREA MULTIPLES, NOT EDGE ONES, and that is the whole trap. "Three times bigger" is
   read by eye as three times the AREA on screen, so the edge only wants root-3 (about 1.73).
   Tripling the edge instead — 1.15 to 3.45 on the deck, 2.6 to 7.8 here — makes each card NINE
   times the area, which buried the middle of the board and pushed the amount written across the
   bottom of the presented card clean off the canvas. The card is drawn into the SCENE, so the
   canvas edge clips it and nothing is there to scroll.

   So: deck 1.15 -> 2.00 and present 2.6 -> 4.5, both a shade over root-3, which lands at roughly
   three times the area each. Nudge the pair together — they are the same card. */
const PRESENT_SCALE = 4.5;
/* ...AND A CEILING ON THAT, because the size above is the right size only for the framing it was
   judged in. The card is drawn into the SCENE, so the canvas edge clips it and there is nothing
   to scroll — and the frustum is not a constant: board3d's _applyFrustum zooms right in for
   VIEW_MOBILE while css/mobile.css lets the mobile frame take whatever aspect it is given. Open
   ?view=mobile in an ordinary wide desktop window and 4.5 projects the card to 143% of the frame
   height: the eyebrow goes off the top and the bottom 40% panel — the live number the whole
   compose-at-runtime design exists to show — goes off the bottom entirely.

   So the presented scale is the smaller of PRESENT_SCALE and what the frame can actually hold.
   It can only ever REDUCE: at a real phone aspect the card takes ~41% of the height and this
   never binds, so the size that was judged and approved is exactly the size that still ships. */
const PRESENT_FIT = 0.80;        // the share of the visible height the card may take
const PRESENT_LIFT = 3.0;        // toward the camera; under an ortho camera this only reorders
/* HOW TALL THE STACK IS. A fixed number, because this deck is bottomless: the board's four
   bonus tiles draw from a weighted table (js/config.js) that is never consumed, so there is no
   count to depict and a stack that shrank would be lying. It is a deck, not a shoe. */
const DECK_SLABS = 12;
const EDGE_COLOR = 0xf4ecd8;     // the paper edge of the stack
const SQ2 = Math.SQRT1_2;

export const Shoe3D = {
  _scene: null, _root: null, _deck: null, _ghost: null,
  _anims: [], _done: [], _flying: null, _discard: null, _failed: false,
  _clearWaiters: null, _shown: null,

  init(scene) {
    if (this._scene) return;
    try {
      this._scene = scene;
      this._root = new THREE.Group();
      scene.add(this._root);
      this._deck = new THREE.Group();
      this._root.add(this._deck);
      this._buildDeck();
      this._buildGhost();
      this._place();
      /* The paintings arrive after this runs — the stack is already on the board wearing the
         drawn back. A CanvasTexture repainted in place only needs re-uploading, which is all
         this does; nothing is rebuilt. */
      CardArt.onReady(() => {
        if (this._backTex) this._backTex.needsUpdate = true;
        if (this._flying) this._markFace(this._flying);
        if (this._discard) this._markFace(this._discard);
      });
    } catch (e) {
      /* A broken deck costs the picture and nothing else: fx.js falls back to the flat DOM card
         and the game plays on. */
      console.warn("Shoe3D init failed:", e);
      this._failed = true;
    }
  },

  /* Definitively broken, as opposed to merely not built yet — see the header. */
  failed() { return this._failed || !this._scene; },
  /* Which framing is up. ?view=mobile IS phone framing but deliberately never writes
     cfg.phoneView (it is persisted, and one visit would stick the desktop view in 9:16
     forever), so both have to be consulted — the same test board3d.js uses for its zoom. */
  _phone() { return !!(cfg.phoneView || (typeof VIEW_MOBILE !== "undefined" && VIEW_MOBILE)); },
  _layout() { return this._phone() ? DECK_PHONE : DECK; },

  /* ---------------- the stack ---------------- */
  /* Half the gap, stepped along the screen-horizontal axis. side -1 is left, +1 is right. */
  _pairPos(side) {
    const L = this._layout();
    const h = (L.gap / 2) * side * SQ2;
    return new THREE.Vector3(L.at + h, TABLE_Y, L.at - h);
  },
  _anchorPos() { return this._pairPos(-1); },        // the deck, on the left
  _discardPos() { return this._pairPos(1); },        // the card just pulled, on the right
  /* World height of the top of the stack — where a card sits before it is pulled, and so where
     the flying card has to start from. */
  _topY() { return TABLE_Y + CARD_T * DECK_SLABS * 1.05 * this._layout().scale; },

  _buildDeck() {
    const g = this._deck;
    while (g.children.length) g.remove(g.children[0]);
    if (this._deckGeo) this._deckGeo.dispose();
    if (this._deckMats) this._deckMats.forEach(m => m.dispose());
    const back = new THREE.MeshBasicMaterial({ map: this._backTexture() });
    const edge = new THREE.MeshLambertMaterial({ color: EDGE_COLOR });
    const geo = new THREE.BoxGeometry(CARD_W, CARD_T, CARD_H);
    this._deckGeo = geo; this._deckMats = [back, edge];
    for (let k = 0; k < DECK_SLABS; k++) {
      const m = new THREE.Mesh(geo, [edge, edge, back, edge, edge, edge]);
      m.position.y = CARD_T * k * 1.05 + CARD_T / 2;
      /* A hair of rotation per slab, alternating: a stack of perfectly squared cards reads as
         one solid block, and the point of the pile is that it is made of cards. */
      m.rotation.y = (k % 2 ? 0.03 : -0.02);
      m.castShadow = !!cfg.envShadows;
      g.add(m);
    }
  },

  /* Seat the deck and the ghost for whichever view is up. Split out from _buildDeck because a
     view flip moves them and rebuilds nothing. */
  _place() {
    const L = this._layout();
    this._deck.scale.setScalar(L.scale);
    this._deck.position.copy(this._anchorPos());
    /* Turned to the fixed camera, like the token and the mystery box: a card has a front and no
       board edge to align with, so it should read from where the player is sitting. */
    this._deck.rotation.y = THREE.MathUtils.degToRad(ENV_CAM.az);
    this._syncGhost();
    if (this._discard) this._discard.position.copy(this._discardPos());
    this._shown = this._phone();
  },

  /* THE EMPTY SLOT THE PULLED CARD LANDS IN — a dashed outline, shown only while nothing is on
     it. Without it the pair is lopsided before the first card of a run: a deck sitting off to
     the left of nothing, which reads as a mistake rather than as a deck waiting to deal. It is
     also what makes the card's arrival land somewhere the eye already knows. */
  _buildGhost() {
    /* NOT BUILT. It marked the empty discard spot so the deck did not sit "off to the left of
       nothing" — and there is no discard spot any more, so an outline of one is an outline of a
       thing this version does not have. The deck sits on the centre line by itself instead.
       Kept, rather than deleted, because it is the other half of gap: restore the discard and
       this is what makes the pair read as a pair before the first card of a run. */
    if (true) return;
    if (this._ghost || !this._scene) return;
    const tex = new THREE.CanvasTexture(CardArt.ghost());
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W * CARD_SIZE, CARD_H * CARD_SIZE),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;                     // lie flat on the table
    /* Yaw applied after the flat rotation, so it squares to the camera like the card that will
       land on it. Order matters — rotation.set would undo the tilt. */
    m.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(ENV_CAM.az));
    this._root.add(m);
    this._ghost = m;
  },
  _syncGhost() {
    if (!this._ghost) return;
    this._ghost.position.copy(this._discardPos());
    /* ABOVE the table height, not below it. Tucking it under a card so the card would cover it
       puts a zero-thickness plane at y ~ 0.034, and the board's own ground wins there — the same
       swallowing TABLE_Y exists to escape, and worse for a plane with no thickness at all. It
       never fights a real card, because the two are never visible at the same time. */
    this._ghost.position.y += 0.010;
    this._ghost.visible = !this._discard;
  },

  /* ---------------- pulling ---------------- */
  /* ONE CARD ON THE STAGE AT A TIME, enforced here rather than by hoping the callers are slow
     enough. Every card is presented at the same place, so a second arriving while the first is
     still there would land on top of it. PUT AWAY, NOT DELETED: the outgoing card is sent where
     it was already going — the table — so the board ends in exactly the state it would have
     reached on its own, and nothing is lost. */
  /* Drop every tween driving one card. Anything that FORCES a pose has to call this first —
     a tween left in _anims goes on writing its own pose every frame and simply overwrites what
     was forced, which is how a settled card climbs back off the table on its own. */
  _retire(mesh) { this._anims = this._anims.filter(a => a.mesh !== mesh); },
  _clearStage() {
    const prev = this._flying;
    if (!prev) return;
    this._retire(prev);
    if (prev.userData.putAway) prev.userData.putAway();
    if (this._flying === prev) { this._drop(prev); this._flying = null; this._stageCleared(); }
  },
  /* Resolves once the stage is clear — the card's hold and its trip to the table included.
     showCard() in fx.js awaits this after the reveal so nothing else starts while a card is
     still hanging in front of the camera.

     ALWAYS RESOLVES. maxMs is not a nicety: state.animating is cleared in roll()'s finally, so
     a promise that never settled would soft-lock the board with Roll disabled forever. */
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

  /* Pull a card, in TWO BEATS.

       1. PRESENTED — it lifts off the deck, arcs up and comes square to the camera: big, dead
          centre of the screen. This is the beat the player reads, and the promise resolves at
          the end of it, on a timer.

       2. HELD, THEN PUT BACK — it hangs still for cfg.deckCardMs and then travels back down
          onto the deck it came off, lies flat and is gone. Nothing stays on the board.

     Beat 2 is off the turn's critical path by construction: it starts after resolve(), so it
     runs while the token is already walking. fx.js chooses to wait for it (whenClear) because in
     THIS game the card is the whole reveal and nothing else should start over the top of it —
     but if it ever stops waiting, nothing here has to change.

     SQUARE TO THE CAMERA in beat 1, not flat on the board. The camera looks down at 38 degrees,
     so a card lying flat is foreshortened to about 62% of its height — legible, but working
     against you in the second that matters. Turning it to face the view is most of why this
     reads better, more than the size is.

     CENTRED BY MOVING ALONG THE VIEW AXIS. The camera is orthographic, so sliding the card
     toward it changes neither its size nor its position on screen by one pixel — it only puts it
     in front of everything else. That is what lets it sit dead centre over the board without
     hovering at some arbitrary height that reads as "stuck in the air". Size comes from scaling.

     `view` is Board3D's LIVE aim and camera, read every frame on purpose: with camFollow on the
     aim drifts while the card is in the air, and a pose computed once would let the card slide
     off-centre exactly when the player is trying to read it. */
  pullCard(card, view) {
    if (this.failed()) return Promise.resolve();
    this._clearStage();
    const ms = Math.max(1, +cfg.cardPullMs || 1);
    const holdMs = Math.max(0, +cfg.deckCardMs || 0);
    const downMs = Math.max(1, +cfg.cardToTableMs || 1);
    const from = this._anchorPos();
    from.y = this._topY();
    const table = this._discardPos();
    const yaw = THREE.MathUtils.degToRad(ENV_CAM.az);

    /* Where "in front of the screen" is, right now. */
    const _p = new THREE.Vector3(), _d = new THREE.Vector3();
    const presentPos = () => {
      if (!view || !view.aim || !view.camera) return _p.set(table.x, table.y + PRESENT_LIFT, table.z);
      _d.copy(view.camera.position).sub(view.aim).normalize();
      return _p.copy(view.aim).addScaledVector(_d, PRESENT_LIFT);
    };
    /* Facing the camera: the face is the box's +Y, so the camera's own orientation turned a
       quarter turn about X puts that face square to the view. */
    const _q = new THREE.Quaternion();
    const faceQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    /* Measured off the LIVE camera for the same reason presentPos is: with camFollow on, the
       frustum is re-applied as the view changes, and a size cached at build time would be the
       previous framing's answer. Orthographic only — a perspective camera would need the
       distance, and this board does not have one. */
    const presentScale = () => {
      const c = view && view.camera;
      const full = CARD_SIZE * PRESENT_SCALE;
      if (!c || !c.isOrthographicCamera) return full;
      const visH = (c.top - c.bottom) / (c.zoom || 1);
      if (!(visH > 0)) return full;
      return Math.min(full, (visH * PRESENT_FIT) / CARD_H);
    };
    const presentQuat = () => (view && view.camera)
      ? _q.copy(view.camera.quaternion).multiply(faceQuat)
      : _q.setFromEuler(new THREE.Euler(0, yaw, 0));
    const flatQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));

    const mesh = this._makeCard(card);
    mesh.position.copy(from);
    mesh.scale.setScalar(CARD_SIZE);
    /* IN FRONT OF EVERYTHING, by not testing depth at all rather than by being nearer. While it
       is presented this card is a readout, not a prop: it is the one thing the player has to
       read, and nothing on the board has any business covering it. Ordinary depth comes back the
       moment it starts for the table, where it IS a prop and should sit under whatever passes
       over it — the next turn's dice, most of all. */
    this._setOverlay(mesh, true);
    this._root.add(mesh);
    this._flying = mesh;

    /* Beat 2's landing, idempotent and reachable three ways: the tween ending, its own backstop
       timer, or a later pull putting this card away early. */
    const toTable = () => {
      if (mesh.userData.dead || mesh.userData.tabled) return;
      mesh.userData.tabled = true;
      if (this._flying === mesh) this._flying = null;
      mesh.position.copy(table);
      mesh.quaternion.copy(flatQuat);
      mesh.scale.setScalar(CARD_SIZE);
      this._setOverlay(mesh, false);
      /* The one underneath is now completely hidden, so it goes rather than accumulating — one
         card in the scene per discard spot, forever. Done at the END of the trip down: until
         this card is actually on the table, the old one is still what the player can see. */
      /* THE CARD GOES, it does not stay. It used to be installed as the discard and lie face up
         where the player could see the last turn; this version keeps nothing on the board once a
         card has been read. Dropping it here rather than skipping the trip down on purpose: the
         journey back to the deck is what says "that turn is over", and a card that vanished the
         instant the reveal ended would read as a glitch. */
      if (this._discard && this._discard !== mesh) this._drop(this._discard);
      this._discard = null;
      this._drop(mesh);
      this._stageCleared();
    };
    mesh.userData.putAway = toTable;

    const startDown = () => {
      /* `dead` is the cancel case, and it matters BECAUSE of the hold: cancel() can land in the
         gap between the reveal resolving and this firing, and without the guard a card already
         taken out of the scene would still be installed as the discard — blanking the spot the
         player is looking at, since installing it removes the card actually on the table. */
      if (mesh.userData.dead || mesh.userData.tabled || mesh.userData.falling) return;
      mesh.userData.falling = true;
      /* Depth restored HERE, at the start of the trip rather than at the end of it: the reveal
         has resolved, so the next turn may already be throwing dice, and a card on its way home
         must not be painted over the top of them for half a second. */
      this._setOverlay(mesh, false);
      /* Beat 1 may still be in _anims on a path that did not go through settle's force. Two
         tweens on one mesh means the older one is stepped last each frame and wins, so the card
         would climb back to the presented pose while flagged as falling. */
      this._retire(mesh);
      const p0 = mesh.position.clone(), q0 = mesh.quaternion.clone(), s0 = mesh.scale.x;
      this._anims.push({
        mesh, t: 0, dur: downMs,
        step: k => {
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          mesh.position.lerpVectors(p0, table, e);
          mesh.quaternion.slerpQuaternions(q0, flatQuat, e);
          mesh.scale.setScalar(s0 + (CARD_SIZE - s0) * e);
        },
        end: toTable,
      });
      /* The frame loop may never run. Whichever gets there first wins. */
      setTimeout(toTable, downMs + 400);
    };

    return new Promise(resolve => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        this._done = this._done.filter(r => r !== settle);
        /* THE PROMISE SETTLES ON EVERY PATH, but the POSE is only forced while this card is
           still the one on the stage. A pull that arrived mid-flight already put this card away
           (_clearStage) and cancel() already took it out of the scene — in either case its own
           timer is still pending, and moving a tabled card to the middle of the screen here is
           how a discard climbs back off the table on its own. */
        if (!mesh.userData.dead && !mesh.userData.tabled) {
          /* Force the presented pose rather than trusting the tween to have reached it: in a
             backgrounded tab no frame ran at all and the card is still sitting on the deck.
             RETIRE BEAT 1 FIRST — forcing a pose out from under a live tween lasts exactly one
             frame, and the tween then re-flies the pull from wherever it had got to. */
          this._retire(mesh);
          mesh.position.copy(presentPos());
          mesh.quaternion.copy(presentQuat());
          mesh.scale.setScalar(presentScale());
        }
        resolve();
        /* The hold, then the deal. Both sit AFTER resolve() — see the header. startDown is a
           no-op for a card that has already been put away or cancelled. */
        if (holdMs) setTimeout(startDown, holdMs); else startDown();
      };
      /* On the cancel list too, so an error path that tears the board down settles this rather
         than stranding the roll loop awaiting it. */
      this._done.push(settle);

      this._anims.push({
        mesh, t: 0, dur: ms,
        step: k => {
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          mesh.position.lerpVectors(from, presentPos(), e);
          mesh.position.y += Math.sin(e * Math.PI) * CARD_ARC * 0.35;
          mesh.quaternion.slerpQuaternions(flatQuat, presentQuat(), e);
          mesh.scale.setScalar(CARD_SIZE + (presentScale() - CARD_SIZE) * e);
        },
        end: () => {},
      });
      /* THE CONTRACT: independent of the frame loop, so it holds in a background tab. */
      setTimeout(settle, ms);
    });
  },

  /* ---------------- housekeeping ---------------- */
  /* Wipe the discard spot entirely — a new run, not a new pull. */
  clearCard() {
    if (this._flying) { this._flying.userData.dead = true; this._drop(this._flying); this._flying = null; }
    if (this._discard) { this._drop(this._discard); this._discard = null; }
    this._syncGhost();
    this._stageCleared();
  },

  /* Draw-over-everything, or ordinary depth.

     THREE FLAGS, AND ALL THREE ARE LOAD-BEARING — renderOrder alone does not do this, which is
     the trap. three.js draws every opaque object before ANY transparent one, and renderOrder
     only sorts within a pass; so an opaque card is drawn before any transparent thing in the
     scene however high its renderOrder, and the only thing keeping it visible is its own depth
     write. While it is presented the card therefore joins the transparent pass, ignores the
     depth buffer, and sorts last within that pass.

     Materials are per-mesh — every card builds its own — so flipping these cannot leak. */
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
    const face = new THREE.MeshBasicMaterial({ map: this._tex4(CardArt.face(card)) });
    const back = new THREE.MeshBasicMaterial({ map: this._backTexture() });
    const edge = new THREE.MeshLambertMaterial({ color: EDGE_COLOR });
    const m = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, CARD_T, CARD_H),
                             [edge, edge, face, back, edge, edge]);
    m.castShadow = !!cfg.envShadows;
    m.userData.faceTex = face.map;
    return m;
  },
  /* A face texture is built per pull and belongs to that card, because the face is composed
     from the LIVE numbers — two pulls of the same deck row are two different pictures. So it is
     disposed with the card. The BACK texture is the opposite: one picture, shared by every slab
     and every card, cached for the session and never disposed. */
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
  _markFace(mesh) { if (mesh && mesh.userData.faceTex) mesh.userData.faceTex.needsUpdate = true; },
  /* Take a card out of the scene and give its buffers back. The back texture is shared, so it is
     pointedly not disposed here — three.js does not dispose a material's maps for it, which is
     exactly what makes that safe. */
  _drop(mesh) {
    this._root.remove(mesh);
    if (mesh.userData.faceTex) mesh.userData.faceTex.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => m && m.dispose());
    mesh.geometry.dispose();
  },

  /* ---------------- frame ---------------- */
  tick() {
    if (!this._scene || this._failed) return;
    /* cfg.deck3d is live in the tuning drawer, so the stack hides and reappears without a
       reload — the same deal cfg.npcs gets. Hidden rather than dropped: there is nothing to
       reload, and a pull is refused by fx.js while it is off. */
    this._root.visible = !!cfg.deck3d;
    /* A view flip moves the furniture and rebuilds nothing. Pulled every frame rather than
       pushed from the drawer, for the reason the branch this came from gives about readouts: a
       thing that has to be notified is a thing that is wrong after the next caller is added. */
    if (this._shown !== this._phone()) this._place();
    /* ADVANCED BY THE WALL CLOCK, not by a nominal frame. Every deadline in a pull is a
       setTimeout — settle at cardPullMs, startDown after the hold, the toTable backstop — so a
       tween counting `1000/60` per frame runs on a different clock from its own contract and the
       two drift apart the moment the frame rate is not exactly 60.

       That drift was the whole bug: at 30 fps the lift took 1332ms of wall clock instead of 620,
       so settle() fired with the card at 45% scale, forced it to full size for one frame, and
       the stale tween then dragged it back and re-flew the pull. On a tab return with no frames
       at all it was worse — the card climbed back up while already flagged as falling, playing
       the closing beat backwards.

       A large delta is deliberately NOT clamped. If the tab was hidden for five seconds the
       wall clock says that beat is over, so completing it on the first frame back is the
       correct answer and not a skipped animation. */
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const dt = this._last ? now - this._last : 1000 / 60;
    this._last = now;
    for (let i = this._anims.length - 1; i >= 0; i--) {
      const a = this._anims[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.step && a.step(k);
      /* Guard the splice: step() can retire this tween itself (settle/startDown both do), and
         splicing by a stale index would then drop somebody else's. */
      if (k >= 1) { const j = this._anims.indexOf(a); if (j >= 0) this._anims.splice(j, 1); a.end && a.end(); }
    }
  },

  /* Settle anything in flight and put the board back — the counterpart of Board3D.cancelBoxFx(),
     called from the same error paths (clearOverlayFx in js/ui/fx.js) so a failed roll can never
     strand an awaited promise. */
  cancel() {
    this._anims.length = 0;
    /* Only the card in flight is abandoned. The DISCARD stays: it is the last card the player
       actually saw, and clearing it on an unrelated error would make the board forget. */
    if (this._flying) {
      this._flying.userData.dead = true;      // a pending hold timer must not resurrect it
      this._drop(this._flying);
      this._flying = null;
    }
    /* A cancelled card never reaches toTable, so nothing else would ever release whoever is
       waiting on the stage — and an error path that strands an awaited promise is how the board
       soft-locks. Same reasoning for the _done list under it. */
    this._stageCleared();
    const waiting = this._done; this._done = [];
    waiting.forEach(r => r());
  },
};
