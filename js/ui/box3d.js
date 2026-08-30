import * as THREE from "three";
import { GLTFLoader } from "../../vendor/loaders/GLTFLoader.js";
import { art, onArtLoad } from "./artcache.js";

/* The box you open, and the cards that come out of it — both IN THE SCENE.

   Imported by js/ui/board3d.js, so it is a sibling module and adds no <script> tag.

   ---- why this is not a dialog ----

   Opening a box was a modal with a picture of a box in it. That is a window about the game
   rather than a moment in it: the board goes behind a scrim, the thing you tap is an <img>, and
   nothing that happens is happening anywhere. Here the box is the same GLB the board used to
   stand on a tile — it arrives over the middle of the board, it turns and bobs, you tap the
   actual object, and it swells and bursts where it stood. The cards fly out of the burst and
   hang in the air to be read.

   The only DOM left is a caption line and the countdown bar (js/ui/pack.js), which are the two
   things a mesh cannot say. There is no panel and no scrim.

   ---- the rules this inherits ----

   Same four the dice and the pull deck learned the hard way, and every one still applies:

     · EVERY PROMISE RESOLVES ON A TIMER, NEVER FROM THE FRAME LOOP. requestAnimationFrame is
       suspended in a background tab, and opening a box is inside the roll loop — a frame-driven
       resolve means tabbing away mid-open leaves roll() awaiting forever with state.animating
       stuck true and the board soft-locked with Roll disabled. The tweens here drive the
       PICTURE; a setTimeout decides when the beat is over.
     · cancel() settles whatever is outstanding, so a mid-roll error cannot strand the loop.
     · A box asked for before the model arrived is still played — with a plain cube, which is the
       fallback for a missing asset rather than a placeholder to be removed later.
     · "Failed" is distinct from "not loaded yet", so the DOM fallback in pack.js only takes over
       when the model genuinely will not come. */

const MODEL = "assets/boxes/models/box.glb";
const MODEL_GOLD = "assets/boxes/models/box-gold.glb";
/* Which model each tier wears, and how its material is pushed. Silver is the plain box, gold is
   the gold one, and diamond is the gold mesh lit cold — one asset doing two jobs beats a third
   GLB that only differs in hue. */
const SKIN = {
  silver:  { model: "plain", emissive: 0x39406e, intensity: 0.20, tint: 0xdfe6f5 },
  gold:    { model: "gold",  emissive: 0xffb020, intensity: 0.45, tint: 0xffffff },
  diamond: { model: "gold",  emissive: 0x63d8ff, intensity: 0.70, tint: 0xa8e8ff },
};
/* Where the box hangs while it waits to be opened: above whatever the camera is aimed at, so it
   is in the middle of the screen however the follow camera has wandered. */
const HOVER_Y = 2.0;
/* Mirrors ENV_CAM.el / the 45° azimuth in js/ui/board3d.js — see the note in js/ui/estate3d.js.
   The cards stand upright in the air for the same reason the case panels do: a quad that faces
   the camera has one depth, and one depth is what let the board's furniture hide the dice. */
const FORESHORTEN = 1 / Math.cos(38 * Math.PI / 180);
/* The card canvas is 260x360, and the row-fitting maths below needs that ratio before any card
   has been painted — so it is a constant here rather than read off a texture that does not
   exist yet. _cardTexture is the one place allowed to disagree, and it does not. */
const CARD_ASPECT = 260 / 360;
const CAM_YAW = Math.PI / 4;
const ease = k => 1 - Math.pow(1 - k, 3);
const backOut = k => { const c = 1.70158, p = k - 1; return 1 + (c + 1) * p * p * p + c * p * p; };

export const Box3D = {
  _scene: null, _group: null, _gltf: null,
  _plain: null, _gold: null, _failed: false, _loading: false,
  _box: null, _cards: [], _anims: [], _done: [],
  _tapped: null,                    // set while a box is waiting to be opened

  init(scene, opts){
    this._view = (opts && typeof opts.view === "function") ? opts.view : null;
    this._scene = scene;
    this._group = new THREE.Group();
    this._group.name = "boxfx";
    scene.add(this._group);
    this._load();
    /* A card face painted before its art arrived is a blank card. Repaint on arrival. */
    onArtLoad(() => this._cards.forEach(c => c.userData.repaint && c.userData.repaint()));
  },
  failed(){ return this._failed; },
  /* What a tap may hit: only the closed box, and only while it is waiting. */
  targets(){ return this._box && this._tapped ? [this._box] : []; },

  _load(){
    if (this._loading) return;
    this._loading = true;
    if (!this._gltf) this._gltf = new GLTFLoader();
    let pending = 2, anyOk = false;
    const one = (url, slot) => this._gltf.load(url, (g) => {
      const m = g.scene;
      /* Measure from real vertices: setFromObject without the precise flag returns the box OF a
         rotated box, which reads high and renders the prop small. Same trap the tile loader
         documents. */
      const size = new THREE.Box3().setFromObject(m, true).getSize(new THREE.Vector3());
      m.userData.unit = 1 / (Math.max(size.x, size.y, size.z) || 1);
      this[slot] = m;
      anyOk = true;
      if (!--pending) this._loading = false;
    }, undefined, (e) => {
      console.warn(`Box3D: ${url} failed to load, falling back to a cube`, e);
      if (!--pending){ this._loading = false; this._failed = !anyOk; }
    });
    one(MODEL, "_plain");
    one(MODEL_GOLD, "_gold");
  },

  /* ---------------- the closed box ----------------
     Puts it over the aim point and hands back a promise that settles the moment it POPS — by tap
     or by the timer, whichever comes first. The caller fires the confetti on that resolve, so
     the burst lands on the frame the box goes. */
  present(tier, aim){
    const wait = Math.max(0, +cfg.packAutoOpenMs || 0);
    const g = this._make(tier);
    g.position.copy(aim);
    g.position.y += HOVER_Y;
    g.userData.baseY = g.position.y;
    g.userData.t = 0;
    this._box = g;
    this._group.add(g);

    return new Promise(resolve => {
      let gone = false;
      const pop = () => {
        if (gone) return; gone = true;
        clearTimeout(timer);
        this._tapped = null;
        this._done = this._done.filter(r => r !== pop);
        this._pop(g, resolve);
      };
      /* Registered so cancel() can settle this instead of leaving the roll loop awaiting a pop
         that will never come. */
      this._done.push(pop);
      this._tapped = pop;                       // what a raycast hit calls
      const timer = setTimeout(pop, wait);      // …and what happens if nobody taps
    });
  },
  /* Called by Board3D when a tap lands on the box. */
  tap(){ if (this._tapped) this._tapped(); },

  _make(tier){
    /* tier.skin FIRST, because the tier KEYS are standard/premium/insider and this table is
       keyed silver/gold/diamond — so SKIN[tier.key] matched nothing and every box in the game
       quietly wore the plain silver mesh, including the two that have gold art in the store.
       The fallback on tier.key is kept for a caller that names a skin directly. */
    const skin = SKIN[(tier && tier.skin) || (tier && tier.key)] || SKIN.silver;
    const src = skin.model === "gold" ? this._gold : this._plain;
    const holder = new THREE.Group();
    const size = Math.max(0.2, +cfg.packBoxSize || 1.6);
    if (src){
      const m = src.clone(true);
      m.scale.setScalar(src.userData.unit * size);
      m.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = !!cfg.envShadows;
        /* Cloned before touching: the loaded material is shared by every clone of this model, so
           writing the diamond's cold emissive onto it would recolour the gold box too. */
        o.material = o.material.clone();
        if (o.material.emissive){
          o.material.emissive = new THREE.Color(skin.emissive);
          o.material.emissiveIntensity = skin.intensity;
        }
        if (o.material.color && skin.tint !== 0xffffff) o.material.color.multiplyScalar(1).lerp(new THREE.Color(skin.tint), 0.5);
      });
      /* The GLB's origin is its base (it used to stand on a tile); centre it so it turns about
         itself in mid-air rather than swinging round its feet. */
      m.position.y = -size / 2;
      holder.add(m);
    }else{
      /* No model yet, or none coming. A lit cube in the tier's colour is a working box. */
      const geo = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshStandardMaterial({
        color: skin.tint, emissive: new THREE.Color(skin.emissive),
        emissiveIntensity: skin.intensity, roughness: 0.4, metalness: 0.3,
      });
      holder.add(new THREE.Mesh(geo, mat));
    }
    return holder;
  },

  /* It strains, wobbling faster and faster, and goes. Resolves at the burst, not after it. */
  _pop(g, resolve){
    const swell = Math.max(1, +cfg.packSwellMs || 1);
    const grow = Math.max(1, +cfg.packPopScale || 1.5);
    const s0 = g.scale.x;
    this._tween(swell, k => {
      const puff = 1 + (grow - 1) * k + Math.sin(k * Math.PI * 7) * 0.06 * k;
      g.scale.setScalar(s0 * puff);
      g.rotation.z = Math.sin(k * Math.PI * 9) * 0.10 * k;
      g.rotation.y += 0.05 + 0.12 * k;
    }, () => {
      this._group.remove(g);
      if (this._box === g) this._box = null;
    });
    /* Timer, not the tween's end callback: a background tab drops every frame and the roll loop
       still has to move on. The tween is the picture; this is the beat. */
    setTimeout(resolve, swell);
  },

  /* ---------------- what was inside ----------------
     The drops fly up out of the burst and hang in a row to be read, then fade. `onShow` is
     called as each one arrives so the caption can name it. Resolves when the last one is done. */
  /* HOW BIG A REVEALED CARD IS, in the only unit that matters: how much of the screen it fills.

     It used to be cfg.packCardSize, a height in TILES — the same units the board is measured
     in, on the reasoning that the cards hang in the world beside it. That reasoning is right
     about where they are and wrong about what they are. The board is zoomed to fit the ring, so
     a phone's board is small and 2.2 tiles came out around sixty pixels: the card a box paid
     out was a fifth the size of the same card handed over by a tile landing, which is the
     report that started this. A card is a thing you READ, so it is sized against the view.

     `h` is already an on-screen height — the plane stands upright and is scaled by FORESHORTEN
     to cancel the 38° tilt — so the conversion is exact: the camera shows `view.h` world units
     of screen height, and a card wanting a fraction f of that gets f * view.h.

     THE ROW HAS TO FIT THE WIDTH TOO. An Insider pays three cards side by side, and three cards
     at a single card's size would run off both edges. So the height is capped by what the row
     can afford, which is why this takes a count and not just a fraction.

     No view metrics means no WebGL board to measure — fall back to the old tile-height knob. */
  _cardHeight(n){
    const v = this._view ? this._view() : null;
    if (!v || !(v.h > 0) || !(v.w > 0)) return Math.max(0.4, +cfg.packCardSize || 2.2);
    const want = v.h * Math.min(0.9, Math.max(0.05, +cfg.packCardScreen || 0.42));
    const cards = Math.max(1, n | 0);
    const gapF = Math.max(0, +cfg.packCardSpacing || 0.18);
    /* n cards and n-1 gaps, across nine tenths of the view — the tenth is breathing room. */
    const fits = (v.w * 0.9) / (cards * CARD_ASPECT + (cards - 1) * CARD_ASPECT * gapF);
    return Math.max(0.4, Math.min(want, fits));
  },

  reveal(drops, aim, onShow){
    const flip = Math.max(0, +cfg.packFlipMs || 0);
    const hold = Math.max(0, +cfg.packRevealMs || 0);
    const gapMs = Math.max(0, +cfg.packItemGapMs || 0);
    const dupMs = Math.max(0, +cfg.packDupMs || 0);
    const closeMs = Math.max(0, +cfg.packCloseMs || 0);

    const h = this._cardHeight(drops.length);
    const gap = h * CARD_ASPECT * Math.max(0, +cfg.packCardSpacing || 0.18);
    const from = aim.clone(); from.y += HOVER_Y;

    let t = 0;
    drops.forEach((d, k) => {
      const extra = (d.kind === "card" && !d.isNew) ? dupMs : 0;
      setTimeout(() => {
        if (onShow) onShow(d, k);
        const spr = this._card(d, h);   // a camera-aligned plane; see _card()
        const off = (k - (drops.length - 1) / 2) * gap;
        /* Along (1,−1)/√2 — the axis the 45° camera renders as horizontal, so the row is level
           on screen however the board is turned. */
        const to = new THREE.Vector3(from.x + off * Math.SQRT1_2, from.y, from.z - off * Math.SQRT1_2);
        spr.position.copy(from);
        spr.scale.set(0.01, 0.01, 1);
        this._group.add(spr);
        this._cards.push(spr);
        /* Upright, so its on-screen height is foreshortened — made taller by exactly that, so
           cfg.packCardSize keeps meaning what it looks like. */
        const hh = h * FORESHORTEN, w = h * spr.userData.aspect;
        this._tween(Math.max(1, flip), kk => {
          const e = backOut(kk);
          spr.position.lerpVectors(from, to, ease(kk));
          spr.position.y = from.y + Math.sin(ease(kk) * Math.PI) * 0.5;
          spr.scale.set(w * e, hh * e, 1);
        }, () => { spr.position.copy(to); spr.scale.set(w, hh, 1); });
      }, t + 10);
      t += flip + hold + gapMs + extra;
    });

    return new Promise(resolve => {
      const finish = () => {
        this._done = this._done.filter(r => r !== finish);
        this._clearCards();
        resolve();
      };
      this._done.push(finish);
      setTimeout(finish, t + closeMs);
    });
  },
  /* The player tapping anywhere while the cards are up takes them away early. */
  dismissable(){ return this._cards.length > 0; },
  dismiss(){ const d = this._done.slice(); d.forEach(r => r()); },

  _clearCards(){
    this._cards.forEach(c => { this._group.remove(c); c.material?.map?.dispose?.(); c.material?.dispose?.(); });
    this._cards.length = 0;
  },

  /* One drop's face, painted to a canvas: the art, the name, the tier, and — when it is one you
     already hold — the band that says so and what it paid instead. */
  /* An UPRIGHT plane, yawed to face the camera — see the long note in js/ui/estate3d.js. A quad
     that faces the camera has a single depth, and that is what let the board's furniture swallow
     the dice; standing it up gives it real depth down its height. */
  _card(drop, h){
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
    mesh.rotation.y = CAM_YAW;
    mesh.renderOrder = 6;
    const paint = () => {
      const map = this._cardTexture(drop);
      mesh.material.map?.dispose?.();
      mesh.material.map = map;
      mesh.material.needsUpdate = true;
      mesh.userData.aspect = map.userData.aspect;
    };
    mesh.userData.repaint = paint;
    paint();
    return mesh;
  },

  _cardTexture(drop){
    const W = 260, H = 360, PAD = 10;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    const rr = (a, b, w, hh, r) => {
      if (x.roundRect){ x.beginPath(); x.roundRect(a, b, w, hh, r); return; }
      const k = Math.min(r, w / 2, hh / 2);
      x.beginPath(); x.moveTo(a + k, b);
      x.arcTo(a + w, b, a + w, b + hh, k); x.arcTo(a + w, b + hh, a, b + hh, k);
      x.arcTo(a, b + hh, a, b, k); x.arcTo(a, b, a + w, b, k); x.closePath();
    };

    let edge = "#5765ad", label = "", ink = "#eef0ff", name = "", sub = "";
    let img = null, plain = "";
    /* TWO INDEPENDENT AXES, exactly as in the DOM path (js/ui/cardface.js): the FAMILY decides
       the frame and the RARITY decides the badge. A status item and an Epic card come out of the
       same box seconds apart and are completely different things, so the gold double frame and
       corner ticks below — which no collection card of any rarity ever wears — are what tell
       them apart at a glance.

       BOTH HALVES HAVE TO MOVE TOGETHER. This function reads the same fields cardFace() does,
       and when the card model changed under it and this did not, a collection card came out as a
       dark rectangle with no art: `card.art` is a bare filename that only means something
       relative to its Season's directory, and `card.tier`/`card.kind` had stopped existing at
       all. Resolve art through Cards.artFor() and colour through the rarity, never by hand. */
    let ornate = false, slip = false, gilt = false, trophy = false, hero = "";
    if (drop.kind === "card" && drop.card){
      const card = drop.card;
      const r = card.rarity ? Cards.rarity(card.rarity) : null;
      /* GOLD, not the rarity's colour. The frame is the FAMILY; the rarity is the badge, and it
         keeps its own colour there. Letting rarity paint the border made a Common look broken
         rather than ordinary, and put two different-looking frames inside one family. */
      /* A TROPHY IS A DIFFERENT OBJECT, and it has to be here too. This painter is the canvas
         twin of cardFace(), and a card that looks like two different things in the two places it
         appears is not a collection (CLAUDE.md) — which is exactly what a box was handing over
         while the board was showing the heavy gold frame, the brackets and the cups. */
      trophy = Cards.isStatusCard(card.id);
      edge = trophy ? "#ffcb5c" : "#c9a24a"; gilt = true;
      /* Stars for a memory, CUPS for a trophy — one to four either way, and never the rarity's
         name. Same count, different glyph, same rule as the DOM path. */
      label = r ? (trophy ? Cards.cups(r) : Cards.stars(r)) : "";
      name = card.name;
      sub = card.sub || (Cards.setForCard(card.id) || {}).name || "";
      img = art(Cards.artFor(card));
    }else if (drop.kind === "clue"){
      /* A CONTACT SHEET: a strip of film, the frame ringed in grease pencil, the line typed in
         the margin under it. This is the card the player is playing for — four of them buy the
         next episode — so it is not the plainest thing in the box any more. The photo is picked
         by hashing the clue's own id (CLUE_ART, in assets/cards/cards.js), so it is the same one
         every time and a different one from the clue beside it.

         The sprockets are what identify it: this family is dark like a collection card, so it
         cannot separate itself by ground colour and does it by SILHOUETTE instead.

         Without this branch at all it fell through to the energy case and drew "+undefined" on a
         teal card, which is why the family is switched on explicitly here. */
      edge = "#d9cdae"; slip = true;
      label = drop.isNew ? "EVIDENCE" : "KNOWN";
      name = drop.isNew ? drop.clue.text : "You knew that one.";
      sub = Episodes.titleOf(drop.ep);
      ink = "#33281a";
      img = art(Cards.clueArt(String(drop.ep || "") + String((drop.clue || {}).id || "")));
    }else if (drop.kind === "status"){
      /* The NUMBER is the hero and the picture is a stamp behind it. Nobody reads what their
         status items are; they read what they were worth. */
      edge = "#ffcb5c"; ornate = true; label = "STATUS";
      hero = "+" + fmt(drop.item.points);
      /* "Collected", not "For your shelf": the shelf of hand-authored status items is gone, and
         this is the canvas twin of dropFace()'s status face in js/ui/cardface.js — the two have
         to say the same thing or one card reads as two objects. */
      name = drop.item.name; sub = "Collected";
      img = art(drop.item.art);
    }else if (drop.kind === "coins"){
      edge = "#ffcb5c"; label = "COINS"; name = "+" + fmt(drop.amount); plain = "🪙"; ink = "#ffcb5c";
    }else{
      edge = "#2dd4bf"; label = "ENERGY"; name = "+" + drop.amount; plain = "⚡"; ink = "#2dd4bf";
    }

    /* body. A collection card is WARM under its gilt — deep plum-brown, not the blue-black the
       rest of the app uses — because that warmth separates it from the cool cream of a clue as
       much as the gold does. A status item is gold-brown; everything else stays navy. */
    rr(2, 2, W - 4, H - 4, 16);
    const g = x.createLinearGradient(0, 0, 0, H);
    if (slip){ g.addColorStop(0, "#191a1f"); g.addColorStop(1, "#121316"); }
    /* Plum for a memory, amber for a trophy — the same shift in TEMPERATURE the DOM makes, and
       for the same reason: it separates the two kinds without touching the gilt, the badge or
       the halo, none of which is being asked to carry a second job. */
    else if (trophy){ g.addColorStop(0, "#5a3d1c"); g.addColorStop(1, "#160d04"); }
    else if (gilt){ g.addColorStop(0, "#3a2140"); g.addColorStop(1, "#120a18"); }
    else if (ornate){ g.addColorStop(0, "#3d2f10"); g.addColorStop(1, "#1d1607"); }
    else { g.addColorStop(0, "#1a1f47"); g.addColorStop(1, "#0e1230"); }
    x.fillStyle = g; x.fill();

    /* art, or the big glyph for a payout that is not a card */
    x.save(); rr(2, 2, W - 4, H - 4, 16); x.clip();
    if (img){
      /* A clue's photograph is shot cold and sits INSET, as a frame punched into film; a status
         item's picture is pushed back behind its number. Canvas filters are cheap here — this
         texture is painted once per card. */
      if (slip){
        x.filter = "grayscale(1) contrast(1.3) brightness(0.86)";
        const fx = 22, fy = 20, fw = W - 44, fh = H * 0.46;
        const s = Math.max(fw / img.width, fh / img.height);
        x.save(); x.beginPath(); x.rect(fx, fy, fw, fh); x.clip();
        x.drawImage(img, fx + (fw - img.width * s) / 2, fy + (fh - img.height * s) / 2,
                    img.width * s, img.height * s);
        x.restore();
        x.filter = "none";
        /* the grease-pencil ring, the way a picture editor marks a keeper */
        x.save();
        x.translate(fx + fw / 2, fy + fh / 2); x.rotate(-0.105);
        x.strokeStyle = "rgba(226,58,48,.85)"; x.lineWidth = 5;
        x.beginPath(); x.ellipse(0, 0, fw * 0.37, fh * 0.37, 0, 0, Math.PI * 2); x.stroke();
        x.restore();
      }else{
        if (ornate) x.globalAlpha = 0.34;
        const s = Math.max(W / img.width, H / img.height);
        x.drawImage(img, (W - img.width * s) / 2, -img.height * s * 0.03, img.width * s, img.height * s);
        x.globalAlpha = 1;
      }
    }else if (plain){
      x.font = "700 92px 'Segoe UI', system-ui, sans-serif";
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(plain, W / 2, H / 2 - 26);
    }
    /* the name sits on a gradient off the bottom, so it reads over any art — every family has
       art under its foot now, including the clue. */
    if (!slip){
      const f = x.createLinearGradient(0, H - 130, 0, H);
      f.addColorStop(0, "rgba(8,10,28,0)"); f.addColorStop(0.45, "rgba(8,10,28,.9)");
      f.addColorStop(1, "rgba(8,10,28,.98)");
      x.fillStyle = f; x.fillRect(0, H - 130, W, 130);
    }
    x.restore();

    /* THE SPROCKETS, drawn last of the art so they sit over the frame like real film. Both
       strips, top to bottom, at the same pitch the DOM uses. */
    if (slip){
      x.fillStyle = "rgba(232,230,223,.92)";
      for (let y = 8; y < H - 12; y += 26){
        x.fillRect(4, y, 11, 12);
        x.fillRect(W - 15, y, 11, 12);
      }
    }

    /* the rarity badge */
    if (label){
      /* The stars are set twice the size of a word badge, matching the DOM path -- they are the
         thing being read at a glance, and "EVIDENCE" at that size would swamp the card. */
      const stars = gilt;
      /* Cups are emoji and emoji are wider than a star glyph, so four of them at star size would
         run half the card — the same allowance the DOM path makes. */
      x.font = trophy ? "800 21px 'Segoe UI', system-ui, sans-serif"
                     : stars ? "800 30px 'Segoe UI', system-ui, sans-serif"
                     : "800 15px 'Segoe UI', system-ui, sans-serif";
      const tw = x.measureText(label).width + 20;
      rr(PAD, PAD, tw, stars ? 40 : 26, stars ? 20 : 13);
      x.fillStyle = "rgba(8,10,28,.85)"; x.fill();
      x.lineWidth = 1.5; x.strokeStyle = edge; x.stroke();
      x.fillStyle = edge; x.textAlign = "left"; x.textBaseline = "middle";
      x.fillText(label, PAD + 10, PAD + (stars ? 21 : 14));
    }

    /* THE COPY COUNT, opposite the badge — the DOM card has carried it all along and this one
       never did, so the same card said "2/3" off a tile and nothing at all out of a box. A
       converted card shows the star instead: that is a state, not a count. */
    if (gilt && drop.kind === "card"){
      const need = Cards.copiesToConvert();
      const conv = !!drop.converted;
      const txt = conv ? "\u2605" : `${Math.max(1, drop.count | 0)}/${need}`;
      x.font = "800 17px 'Segoe UI', system-ui, sans-serif";
      const tw = x.measureText(txt).width + 18;
      rr(W - PAD - tw, PAD, tw, 28, 14);
      x.fillStyle = "rgba(8,10,28,.85)"; x.fill();
      x.lineWidth = 1.5; x.strokeStyle = conv ? "#ffcb5c" : "rgba(160,175,225,.55)";
      x.stroke();
      x.fillStyle = conv ? "#ffcb5c" : "#c3cbe8";
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(txt, W - PAD - tw / 2, PAD + 15);
      x.textAlign = "left";
    }

    /* the status hero, across the middle */
    if (hero){
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillStyle = "#ffcb5c";
      x.font = "700 62px Georgia, 'Times New Roman', serif";
      x.fillText(hero, W / 2, H * 0.40);
      x.fillStyle = "rgba(255,203,92,.72)";
      x.font = "800 13px 'Segoe UI', system-ui, sans-serif";
      x.fillText("S T A T U S", W / 2, H * 0.40 + 44);
    }

    /* name and role. A clue is a sentence and is set to be READ — typewriter, centred on the
       page, four lines of room — where a card's name is a label under its art. */
    x.textAlign = "center";
    x.fillStyle = ink;
    if (slip){
      /* Annotated in the MARGIN, the way a contact sheet is — not on a slip laid over the
         picture. The frame above already ends at 0.46H, so there is clear film to write on. */
      x.textAlign = "left";
      x.fillStyle = "#d6d2c6";
      x.font = "700 15px 'Courier New', ui-monospace, monospace";
      wrap(x, name, 22, H * 0.66, W - 44, 19, 3);
      x.textAlign = "center";
      x.fillStyle = "#7c7a72";
      x.font = "400 14px 'Segoe UI', system-ui, sans-serif";
      x.fillText(sub, W / 2, H - 24, W - 44);
      x.fillStyle = "#f0ede3";
      x.font = "700 17px 'Courier New', ui-monospace, monospace";
      x.fillText("A CLUE", W / 2, H - 48, W - 44);
    }else{
      x.font = "700 24px Georgia, 'Times New Roman', serif";
      wrap(x, name, W / 2, H - 66, W - 28, 26, 2);
      if (sub){
        x.fillStyle = "#9098c9";
        x.font = "400 14px 'Segoe UI', system-ui, sans-serif";
        x.fillText(sub, W / 2, H - 24, W - 28);
      }
    }

    /* The duplicate band, across the middle where it cannot be missed — but NOT for the copy
       that converts. That one is the payoff (GDD 4.3), and stamping "DUPLICATE" across the best
       moment the collection has would be exactly backwards. */
    if (drop.kind === "card" && !drop.isNew && !drop.converted){
      x.save();
      x.translate(W / 2, H * 0.42); x.rotate(-0.12);
      const bg = x.createLinearGradient(-W / 2, 0, W / 2, 0);
      bg.addColorStop(0, "rgba(255,203,92,0)"); bg.addColorStop(0.14, "#ffcb5c");
      bg.addColorStop(0.86, "#ffcb5c"); bg.addColorStop(1, "rgba(255,203,92,0)");
      x.fillStyle = bg; x.fillRect(-W / 2, -17, W, 34);
      x.fillStyle = "#1b1405";
      x.font = "800 16px 'Segoe UI', system-ui, sans-serif";
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(`DUPLICATE  +${fmt(drop.coins)}`, 0, 0);
      x.restore();
    }

    /* …and its opposite. The third copy is the one that turns a card into its Collectible, and
       it is the single best moment the collection has — so it gets the band, in teal, saying
       what it earned rather than what it consoled. */
    if (drop.kind === "card" && drop.converted){
      x.save();
      x.translate(W / 2, H * 0.42); x.rotate(-0.12);
      const bg = x.createLinearGradient(-W / 2, 0, W / 2, 0);
      bg.addColorStop(0, "rgba(45,212,191,0)"); bg.addColorStop(0.14, "#2dd4bf");
      bg.addColorStop(0.86, "#2dd4bf"); bg.addColorStop(1, "rgba(45,212,191,0)");
      x.fillStyle = bg; x.fillRect(-W / 2, -17, W, 34);
      x.fillStyle = "#062b26";
      x.font = "800 16px 'Segoe UI', system-ui, sans-serif";
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(`COLLECTED  +${drop.status} STATUS`, 0, 0);
      x.restore();
    }

    /* edge — and, for a status item, a frame rather than a border */
    rr(2, 2, W - 4, H - 4, 16);
    x.lineWidth = ornate ? 9 : trophy ? 8 : 5; x.strokeStyle = edge; x.stroke();
    if (gilt){
      /* The fine inner rule, set just inside the gilt. Brighter once the card has converted:
         that is the moment it stops being progress and becomes a thing you own. */
      const conv = !!drop.converted;
      rr(13, 13, W - 26, H - 26, 9);
      x.lineWidth = conv ? 2.5 : 1.5;
      x.strokeStyle = conv ? "rgba(255,203,92,.9)" : "rgba(255,203,92,.42)";
      x.stroke();
    }
    if (trophy){
      /* THE PLAQUE'S BRACKETS, IN ADVANCE — top-left and bottom-right, exactly the two the DOM
         draws. Brackets read as something hung on a wall, which is what this card becomes on its
         third copy, so the card and the Collectible are recognisably one object at both ends. */
      x.strokeStyle = "rgba(255,203,92,.85)"; x.lineWidth = 3.5; x.lineCap = "round";
      const T = 24, m = 9;
      [[m, m, 1, 1], [W - m, H - m, -1, -1]].forEach(([cx0, cy0, sx, sy]) => {
        x.beginPath();
        x.moveTo(cx0 + sx * T, cy0); x.lineTo(cx0, cy0); x.lineTo(cx0, cy0 + sy * T);
        x.stroke();
      });
      x.lineCap = "butt";
    }
    if (ornate){
      /* An inner rule set in from the outer one, and a tick across each corner: the language of
         something framed and hung rather than something dealt. */
      x.lineWidth = 2; x.strokeStyle = "rgba(255,203,92,.55)";
      rr(13, 13, W - 26, H - 26, 9); x.stroke();
      x.strokeStyle = edge; x.lineWidth = 3; x.lineCap = "round";
      const T = 26, m = 7;
      [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]
        .forEach(([cx0, cy0, sx, sy]) => {
          x.beginPath();
          x.moveTo(cx0 + sx * T, cy0); x.lineTo(cx0, cy0); x.lineTo(cx0, cy0 + sy * T);
          x.stroke();
        });
      x.lineCap = "butt";
    }

    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.userData = { aspect: W / H };
    return map;
  },

  /* ---------------- frame ---------------- */
  tick(ms){
    this._step(ms);
    const g = this._box;
    if (g && this._tapped){
      /* Idle: turning slowly and breathing, so a box waiting to be opened is obviously waiting
         rather than stuck. */
      g.userData.t += ms;
      g.rotation.y += 0.006;
      g.position.y = g.userData.baseY + Math.sin(g.userData.t / 620) * 0.12;
    }
  },
  /* A tween, BACKED BY A TIMER.

     The frame loop drives the picture, and a timer guarantees the ending. requestAnimationFrame
     is suspended in a background tab, so a tween whose cleanup lives only in its last frame
     simply never cleans up — the box stops mid-swell and stays on the board forever, which is
     exactly the bug this shape was introduced to fix. The promises were always timer-based; the
     SCENE has to be too.

     settle() forces the final pose before running `end`, so the result is correct even if every
     frame was dropped, and it is idempotent — whichever of the two gets there first wins. */
  _tween(dur, step, end){
    if (dur <= 0){ step && step(1); end && end(); return; }
    const a = { t: 0, dur, step, done: false };
    a.settle = () => {
      if (a.done) return;
      a.done = true;
      const i = this._anims.indexOf(a);
      if (i >= 0) this._anims.splice(i, 1);
      step && step(1);
      end && end();
    };
    this._anims.push(a);
    /* One frame of grace, so a tween that is running normally finishes on its own last frame
       rather than being cut off a millisecond early by its own safety net. */
    setTimeout(a.settle, dur + 20);
  },
  _step(ms){
    for (let n = this._anims.length - 1; n >= 0; n--){
      const a = this._anims[n];
      a.t += ms;
      if (a.t >= a.dur){ a.settle(); continue; }
      a.step && a.step(a.t / a.dur);
    }
  },

  /* Settle everything and clear the scene. Called from clearOverlayFx() when a roll dies
     mid-way: a box left hanging over the board is the visible symptom, but the one that matters
     is the promise — roll()'s finally is what clears state.animating, and it only runs once the
     await returns. */
  cancel(){
    this._anims.length = 0;
    const waiting = this._done.slice();
    this._done.length = 0;
    this._tapped = null;
    if (this._box){ this._group.remove(this._box); this._box = null; }
    this._clearCards();
    waiting.forEach(r => { try { r(); } catch (e) {} });
  },
};

/* Wrapped, and capped at `max` lines so a long clue line cannot walk off the card.

   Alignment is the CALLER'S: this only ever calls fillText(line, cx, y), so cx is whatever the
   current textAlign makes it — a centre for a card name, a left margin for a contact sheet's
   annotation. `cy` is the baseline of the LAST line, so text grows upward from it. */
function wrap(x, text, cx, cy, maxW, lh, max){
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach(w => {
    const t = line ? line + " " + w : w;
    if (x.measureText(t).width > maxW && line){ lines.push(line); line = w; }
    else line = t;
  });
  if (line) lines.push(line);
  const use = lines.slice(0, max);
  if (lines.length > max) use[max - 1] = use[max - 1].replace(/\s*\S*$/, "…");
  const top = cy - (use.length - 1) * lh;
  use.forEach((l, i) => x.fillText(l, cx, top + i * lh));
}
