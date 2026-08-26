import * as THREE from "three";
import { art, artTick, onArtLoad } from "./artcache.js";

/* The case board — the current set, standing INSIDE the board ring.

   Imported by js/ui/board3d.js, so it is a sibling module and adds no <script> tag: the project
   still has exactly one type="module" and the classic load order is still the dependency order.

   ---- why this is geometry and not DOM ----

   It was DOM first, projected onto the board's centre every frame. That works and it looks
   wrong: a DOM layer is drawn AFTER the scene whatever its depth, so it floats over the dice
   instead of behind them, it cannot be occluded by anything, and every camera move slides it
   across the world by a frame's worth of lag. It reads as chrome pinned over the board rather
   than as furniture standing on it.

   Here each panel is a canvas painted once and uploaded as a texture on a THREE.Sprite seated
   at a world position. So it is in the scene: the dice land in front of it, the camera moves it
   because the camera moves everything, and it is exactly as big as its place on the board says.

   COORDINATES. One world unit is one tile; the ring occupies the outer band of an 11x11 grid,
   so the interior is x,z within about ±4.5 and the board's centre is the origin. The camera is
   fixed at 45° azimuth, which means the axis (1,−1)/√2 renders as a straight horizontal line on
   screen and larger (x+z) is LOWER on screen. The row of panels is laid out along that axis, so
   `gap` is spacing in tiles AND spacing on screen.

   ---- these are constants, deliberately not config ----

   Where the furniture stands is LAYOUT: there is one right answer per view, found by looking at
   it. Nothing here is a balance knob. That is not only tidiness — cfg is PERSISTED, and
   js/storage.js merges a saved config over the shipped defaults, so as long as a layout number
   lives in cfg, changing it changes nothing for anyone who has already opened the game. Timings
   stay in cfg (pacing is a tuning surface and the drawer editing it live is the point); position
   does not. */

const SQ2 = Math.SQRT1_2;
/* `at` is measured UP-screen from the board's centre, so a larger number sits higher. `gap` is
   panel-to-panel spacing across the screen, and it has to stay ahead of the panel's own width
   (height × the face's aspect, about 0.42) or neighbours overlap. `height` is the panel's whole
   extent in tiles — a sprite is camera-facing, so its height maps almost one-for-one onto screen
   vertical, which makes this the number that decides whether the row survives the camera aiming
   low (token near Start) without clipping the top of the frame. */
const ROW = { at: -0.55, gap: 1.22, height: 2.60 };
/* The 9:16 frame is far more zoomed in (cfg.camZoomPhone), so the same numbers walk the row over
   the board there — it needs to be shorter and tighter. */
const ROW_PHONE = { at: -0.15, gap: 0.98, height: 2.05 };
/* Seated ON the board and growing UP from it: the board's surface is 0 and a sprite's origin is
   its middle, so the base sits at BASE_Y and the sprite's centre goes half its height above. */
const BASE_Y = 0.14;
/* The camera's elevation, mirroring ENV_CAM.el in js/ui/board3d.js. A panel stands UPRIGHT on
   the board, so what you see of its height is foreshortened by cos(elevation) — the panels are
   made taller by exactly that factor so `height` stays a promise about SCREEN size. */
const CAM_EL = 38;
const FORESHORTEN = 1 / Math.cos(CAM_EL * Math.PI / 180);
/* The camera's azimuth. Turning a panel by this makes it face the camera squarely; it never
   needs updating because this camera only pans and zooms, it never orbits. */
const CAM_YAW = Math.PI / 4;

/* The panel face, in canvas pixels. Everything else is derived, so the aspect the sprite is
   scaled by always matches what was actually painted. */
const F = {
  w: 150, pad: 9, head: 32, headGap: 6, slotGap: 5,
  get slotW(){ return this.w - this.pad * 2; },
};
/* Height for `n` slots, so a set with four or six of them is drawn at the right shape rather
   than squashed into a fixed box. */
function panelHeight(n, slotH){
  return F.pad + F.head + F.headGap + n * slotH + (n - 1) * F.slotGap + F.pad;
}

/* Rounded rectangle, with a fallback: ctx.roundRect is recent enough that a browser old enough
   to run the legacy CSS board might not have it, and a missing method here would take the whole
   face down rather than one corner. */
function roundRect(x, r, a, b, w, h, rad){
  if (x.roundRect){ x.beginPath(); x.roundRect(a, b, w, h, rad); return; }
  const k = Math.min(rad, w / 2, h / 2);
  x.beginPath();
  x.moveTo(a + k, b);
  x.arcTo(a + w, b, a + w, b + h, k);
  x.arcTo(a + w, b + h, a, b + h, k);
  x.arcTo(a, b + h, a, b, k);
  x.arcTo(a, b, a + w, b, k);
  x.closePath();
}

export const Case3D = {
  _scene: null, _group: null, _sig: null,

  init(scene){
    this._scene = scene;
    this._group = new THREE.Group();
    this._group.name = "caseboard";
    scene.add(this._group);
    /* A face painted before its art arrived is missing a card it should be showing. The cache
       says when one lands; dropping the signature is what makes the next sync repaint it, and
       asking for that sync here is what stops the card waiting for the next roll to appear. */
    onArtLoad(() => { this._sig = null; this.sync(); });
    /* NOT sync() here. Board3D.init() runs before boot() calls initState(), so there is no
       state.albums to read yet. renderAll() calls sync the moment state exists, so the row
       appears on the first render either way. */
  },
  sprites(){ return this._group ? this._group.children : []; },

  _phone(){
    return (typeof VIEW_MOBILE !== "undefined" && VIEW_MOBILE) || !!cfg.phoneView;
  },

  /* Rebuilt whenever something the faces draw changes. renderAll() runs on every float, every
     log line and every event in a roll, and each rebuild paints five canvases and uploads five
     textures — enough to visibly stall the roll loop. The signature covers everything a face
     shows, so a change the player can see always redraws and nothing else does. */
  sync(){
    if (!this._scene) return;
    if (typeof state === "undefined" || !state.albums || typeof Collection === "undefined") return;
    const n = Collection.num();
    const pages = Collection.pages(n);
    const sig = pages.map(p =>
      p.needs.map(id => Collection.countOf(id, n) > 0 ? "1" : "0").join("") +
      (state.epQueue.includes(p.ep) ? "q" : "") +
      (Collection.canWatch(p.ep) ? "!" : "")).join("|")
      + `#${n}/${this._phone() ? "p" : "d"}/${artTick()}`;
    if (sig === this._sig) return;
    this._sig = sig;

    const g = this._group;
    while (g.children.length){
      const c = g.children[0];
      g.remove(c);
      c.material?.map?.dispose?.();
      c.material?.dispose?.();
    }
    if (!pages.length) return;

    const row = this._phone() ? ROW_PHONE : ROW;
    const a = row.at, gap = row.gap;
    pages.forEach((page, k) => {
      const off = (k - (pages.length - 1) / 2) * gap;
      /* Along (1,−1)/√2 — the axis the 45° camera renders as horizontal. */
      const x = -a + off * SQ2, z = -a - off * SQ2;
      const map = this._panelTexture(page, k, n);
      /* AN UPRIGHT PLANE, STANDING ON THE BOARD — not a sprite, and not a camera-aligned quad.

         Both of those have ONE depth for the whole panel, so a die that lands in front of a
         panel's feet is still measured against the panel's middle and vanishes behind the whole
         thing. That was the bug: the dice are the moment, and the furniture was hiding them.

         Standing the panel up fixes it because depth then varies down its height exactly the way
         a real standee's does — the camera looks down at 38°, so the panel's base is further
         away than its top, and a die resting on the board nearer the camera than that base is
         simply nearer. It draws in front, and a die behind the row is still hidden by it, which
         is also correct.

         It is yawed to face the camera and never needs updating: this camera only pans and
         zooms, it never orbits. Standing upright costs height on screen (cos 38° of it), so the
         geometry is made FORESHORTEN times taller and `height` keeps meaning screen size. */
      const th = row.height;
      const spr = new THREE.Mesh(
        new THREE.PlaneGeometry(th * map.userData.aspect, th * FORESHORTEN),
        new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
      spr.rotation.y = CAM_YAW;
      spr.position.set(x, BASE_Y + th * FORESHORTEN / 2, z);
      /* The page index rides on the sprite so a raycast hit can say WHICH episode was tapped
         without the picker needing to know how the row is laid out. */
      spr.userData.page = k;
      spr.renderOrder = 2;
      g.add(spr);
    });
  },

  /* One panel's face: the episode's header, and its slots stacked. A collected slot carries the
     card's own art; an empty one is a dashed outline the same size and shape, so "3 of 5" reads
     without counting and you can see the shape of what is missing.

     The art is CROPPED to the top of the portrait rather than scaled whole: a slot is a wide
     band, and a whole card squeezed into it puts the face where nobody can see it. */
  _panelTexture(page, k, boardNum){
    const needs = page.needs;
    const slotH = Math.round(F.slotW * 0.44);
    const H = panelHeight(needs.length, slotH);
    const c = document.createElement("canvas");
    c.width = F.w; c.height = H;
    const x = c.getContext("2d");

    const [got, need] = Collection.pageProgress(page, boardNum);
    const ready = Collection.pageReady(page, boardNum);
    const seen = ready && !state.epQueue.includes(page.ep);
    const next = Collection.canWatch(page.ep);

    /* Four states, and they are the player's four questions in order: what can I watch, what is
       waiting on something earlier, what am I still collecting, and what is done. */
    const skin = seen
      ? { top: "#2b3268", bot: "#232a58", edge: "#3d4585", ink: "#2dd4bf", slot: "#1d2350" }
      : next
      ? { top: "#f7eed6", bot: "#e8dcb8", edge: "#ffcb5c", ink: "#6b4c05", slot: "#e2d4ab" }
      : ready
      ? { top: "#3d4890", bot: "#2f3872", edge: "#ffcb5c", ink: "#ffcb5c", slot: "#232a63" }
      : { top: "#3d4890", bot: "#2f3872", edge: "#5765ad", ink: "#e8ecff", slot: "#232a63" };
    const head = seen ? "✓ SEEN"
               : next ? "▶ WATCH"
               : ready ? `EP ${k + 1} · HOLD`
               : `EP ${k + 1} · ${got}/${need}`;

    /* body */
    const grad = x.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, skin.top); grad.addColorStop(1, skin.bot);
    roundRect(x, 0, 1.5, 1.5, F.w - 3, H - 3, 11);
    x.fillStyle = grad; x.fill();
    x.lineWidth = 3; x.strokeStyle = skin.edge; x.stroke();

    /* header */
    x.fillStyle = skin.ink;
    x.font = "800 17px 'Segoe UI', system-ui, -apple-system, sans-serif";
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(head, F.w / 2, F.pad + F.head / 2, F.w - F.pad * 2);

    /* slots */
    let y = F.pad + F.head + F.headGap;
    needs.forEach(id => {
      const card = Collection.cardOf(id, boardNum);
      const owned = Collection.countOf(id, boardNum) > 0;
      const img = owned && card ? art(card.art) : null;
      roundRect(x, 0, F.pad, y, F.slotW, slotH, 5);
      if (img){
        x.save(); x.clip();
        /* Cover, anchored near the top — a portrait cropped to a band keeps the face. */
        const s = Math.max(F.slotW / img.width, slotH / img.height);
        const w = img.width * s, h = img.height * s;
        x.drawImage(img, F.pad + (F.slotW - w) / 2, y - h * 0.14, w, h);
        x.restore();
        x.lineWidth = 1.5; x.strokeStyle = "rgba(255,255,255,.30)"; x.setLineDash([]); x.stroke();
      }else{
        x.fillStyle = skin.slot;
        x.fill();
        x.lineWidth = 1.5;
        x.setLineDash([5, 4]);
        x.strokeStyle = card && card.kind === "clue"
          ? "rgba(230,214,176,.55)" : "rgba(214,222,255,.45)";
        x.stroke();
        x.setLineDash([]);
      }
      y += slotH + F.slotGap;
    });

    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.userData = { aspect: F.w / H };
    return map;
  },
};
