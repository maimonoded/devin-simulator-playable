import * as THREE from "three";
import { art, artTick, onArtLoad } from "./artcache.js";

/* The Status Estate — the one object standing INSIDE the board ring (GDD §3.5).

   Imported by js/ui/board3d.js, so it is a sibling module and adds no <script> tag: the project
   still has exactly one type="module" and the classic load order is still the dependency order.

   ---- what stood here before ----

   Five panels, one per episode, showing that episode's clue slots. They worked, but they were
   the wrong thing in the right place: the centre of the board is where a player's eye rests
   between rolls, and what belongs there is the thing that is slowly, visibly getting better.
   §3.5 is explicit about it — an estate that upgrades with Status level, which is the passive
   progress anchor the builder landmarks used to be.

   The clue progress did not vanish; it moved to where it is actually needed. The story panel
   carries the count, the HUD carries it in the 9:16 frame, and tapping the estate opens the
   profile — which is what the estate is a picture of.

   ---- why this is geometry and not DOM ----

   It was DOM once, projected onto the board's centre every frame. That works and it looks wrong:
   a DOM layer draws AFTER the scene whatever its depth, so it floats over the dice instead of
   behind them, it cannot be occluded, and every camera move slides it across the world by a
   frame's worth of lag. It reads as chrome pinned over the board rather than as a building
   standing on it.

   ---- AN UPRIGHT PLANE, NOT A SPRITE ----

   A sprite — or any camera-facing quad — has ONE depth for the whole quad, so a die landing in
   front of the estate's feet is still measured against its middle and vanishes behind the whole
   building. Standing it up fixes that: depth then varies down its height exactly as a real
   standee's does. The camera looks down at 38°, so the base is further away than the roof, and a
   die resting nearer the camera than that base simply draws in front. A die behind it is still
   hidden, which is also correct.

   It is yawed to face the camera and never needs updating, because this camera only pans and
   zooms — it never orbits. Standing upright costs cos(38°) of on-screen height, so the geometry
   is made FORESHORTEN times taller and `height` keeps meaning screen size.

   ---- these are constants, deliberately not config ----

   Where the furniture stands is LAYOUT: one right answer per view, found by looking at it. And
   cfg is PERSISTED — js/storage.js merges a saved config over the shipped defaults, so a layout
   number living in cfg would change nothing for anyone who has already opened the game. Timings
   stay in cfg; position does not. */

/* `at` is measured UP-screen from the board's centre, so a larger number sits higher. `height`
   is the whole extent in tiles. */
const SPOT = { at: -0.35, height: 4.10 };
/* The 9:16 frame is far more zoomed in (cfg.camZoomPhone), so the same numbers walk the estate
   off the board there — it needs to be smaller and lower. */
const SPOT_PHONE = { at: 0.05, height: 3.05 };
/* Seated ON the board and growing UP from it: the surface is 0 and a plane's origin is its
   middle, so the base sits at BASE_Y and the centre goes half its height above. */
const BASE_Y = 0.14;
/* Mirrors ENV_CAM in js/ui/board3d.js. */
const CAM_EL = 38;
const FORESHORTEN = 1 / Math.cos(CAM_EL * Math.PI / 180);
const CAM_YAW = Math.PI / 4;

/* The painted face, in canvas pixels. Portrait, because the art is: a building is taller than
   it is wide, and a plaque under it carries the name. */
const F = { w: 300, h: 400, plaque: 84, pad: 10 };

function roundRect(x, a, b, w, h, rad){
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

export const Estate3D = {
  _scene: null, _group: null, _sig: null,

  init(scene){
    this._scene = scene;
    this._group = new THREE.Group();
    this._group.name = "estate";
    scene.add(this._group);
    /* A face painted before its art arrived is a building with no building in it. The cache says
       when one lands; dropping the signature is what makes the next sync repaint it. */
    onArtLoad(() => { this._sig = null; this.sync(); });
    /* NOT sync() here. Board3D.init() runs before boot() calls initState(), so there is no state
       to read yet. renderAll() calls sync the moment state exists. */
  },
  meshes(){ return this._group ? this._group.children : []; },

  _phone(){
    return (typeof VIEW_MOBILE !== "undefined" && VIEW_MOBILE) || !!cfg.phoneView;
  },

  /* Which tier the current level has reached. Derived from the level, so re-cutting the bands
     re-cuts the estate for free — and the last tier holds rather than running off the end. */
  tierFor(level){
    const lv = level == null ? Status.level() : level;
    let t = ESTATE_TIERS[0];
    ESTATE_TIERS.forEach(x => { if (lv >= x.at) t = x; });
    return t;
  },
  tierIndex(level){ return ESTATE_TIERS.indexOf(this.tierFor(level)); },

  /* WHERE INSIDE THE TIER THIS LEVEL SITS — {step, span}, step counting from 0.

     The estate changes a LITTLE every level and a LOT every fifth, and this is what the little
     change is derived from. It has to be derived rather than authored: six tiers of art exist
     and thirty are not going to be painted, so the per-level difference is something the canvas
     does to the art it already has.

     The span is measured to the NEXT tier rather than assumed to be five, so re-cutting the
     bands re-cuts the ramp with them. The last tier runs to the top of the track. */
  tierStep(level){
    const lv = level == null ? Status.level() : level;
    const t = this.tierFor(lv);
    const i = ESTATE_TIERS.indexOf(t);
    const next = ESTATE_TIERS[i + 1];
    const end = next ? next.at : (Status.maxLevel() + 1);
    return { step: Math.max(0, lv - t.at), span: Math.max(1, end - t.at) };
  },

  /* Rebuilt only when what it shows changes. renderAll() runs on every float and every log line,
     and each rebuild paints a canvas and uploads a texture — enough to stall the roll loop. */
  sync(){
    if (!this._scene) return;
    if (typeof state === "undefined" || typeof Status === "undefined") return;
    const lv = Status.level();
    const sig = `${lv}/${Math.round(Status.levelProgress() * 100)}/` +
                `${this._phone() ? "p" : "d"}/${artTick()}`;
    if (sig === this._sig) return;
    this._sig = sig;

    const g = this._group;
    while (g.children.length){
      const c = g.children[0];
      g.remove(c);
      c.material?.map?.dispose?.();
      c.material?.dispose?.();
    }

    const spot = this._phone() ? SPOT_PHONE : SPOT;
    const map = this._texture(lv);
    const th = spot.height;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(th * map.userData.aspect, th * FORESHORTEN),
      new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
    mesh.rotation.y = CAM_YAW;
    /* Along (1,−1)/√2 — the axis the 45° camera renders as vertical-on-screen displacement. */
    const a = spot.at;
    mesh.position.set(-a, BASE_Y + th * FORESHORTEN / 2, -a);
    mesh.userData.estate = true;
    mesh.renderOrder = 2;
    g.add(mesh);
  },

  /* The face: the building, then a plaque with the band, the level and the level bar. */
  _texture(level){
    const tier = this.tierFor(level);
    const rank = Status.rank();
    const c = document.createElement("canvas");
    c.width = F.w; c.height = F.h;
    const x = c.getContext("2d");
    const img = art(tier.art);

    /* The art is a painted scene on its own flat ground, not a cut-out — so it is drawn INSIDE a
       rounded frame rather than pasted onto the board. A hard rectangular edge floating over the
       ring reads as a mistake; a framed one reads as a portrait of the place, which is what it
       is. The frame and the plaque share a border so the whole object is one thing. */
    const fx = F.pad, fy = F.pad, fw = F.w - F.pad * 2, fh = F.h - F.plaque - F.pad;
    x.save();
    roundRect(x, fx, fy, fw, fh, 14);
    x.clip();
    if (img){
      /* Cover inside the frame, anchored low: the ground the building stands on is the part
         worth keeping when something has to be cropped. */
      const s = Math.max(fw / img.width, fh / img.height);
      const w = img.width * s, h = img.height * s;
      x.drawImage(img, fx + (fw - w) / 2, fy + fh - h, w, h);
    } else {
      x.fillStyle = "rgba(35,42,99,.55)";
      x.fillRect(fx, fy, fw, fh);
    }
    /* THE LIGHTS COME ON, ONE LEVEL AT A TIME. `warm` runs 0..1 across the tier and lifts a
       golden wash over the scene, so the same painting reads as colder and emptier at the start
       of a tier than at the end of it. It is the cheapest per-level change that is actually
       VISIBLE at the size this is drawn — a prop moved by four pixels would not be.

       soft-light rather than a flat overlay: it warms the lit parts and leaves the shadows,
       which is what a building filling with light does. A plain alpha fill just greys it. */
    const { step, span } = this.tierStep(level);
    const warm = span > 1 ? step / (span - 1) : 1;
    if (warm > 0){
      x.save();
      x.globalCompositeOperation = "soft-light";
      x.globalAlpha = 0.18 + warm * 0.42;
      x.fillStyle = "#ffb04a";
      x.fillRect(fx, fy, fw, fh);
      x.restore();
      /* and a little more exposure, so it brightens as well as warms */
      x.save();
      x.globalCompositeOperation = "lighter";
      x.globalAlpha = warm * 0.10;
      x.fillStyle = "#ffd9a0";
      x.fillRect(fx, fy, fw, fh);
      x.restore();
    }
    /* A vignette, so the frame's edge is a fade rather than a cut. It lifts as the tier is
       climbed — the place stops looking like somewhere the light does not reach. */
    const vig = x.createLinearGradient(0, fy + fh * 0.55, 0, fy + fh);
    vig.addColorStop(0, "rgba(8,10,28,0)");
    vig.addColorStop(1, `rgba(8,10,28,${(0.55 - warm * 0.22).toFixed(3)})`);
    x.fillStyle = vig; x.fillRect(fx, fy, fw, fh);
    x.restore();
    /* The gilt gains weight with the level too, so the FRAME says it as well as the picture. */
    roundRect(x, fx, fy, fw, fh, 14);
    x.lineWidth = 2 + warm * 1.6;
    x.strokeStyle = `rgba(255,203,92,${(0.30 + warm * 0.42).toFixed(3)})`;
    x.stroke();

    /* the plaque — overlapping the frame's foot by a few pixels so the two read as one object */
    const py = F.h - F.plaque;
    roundRect(x, F.pad, py, F.w - F.pad * 2, F.plaque - F.pad, 9);
    const grad = x.createLinearGradient(0, py, 0, F.h);
    grad.addColorStop(0, "rgba(12,15,40,.93)"); grad.addColorStop(1, "rgba(8,10,28,.97)");
    x.fillStyle = grad; x.fill();
    x.lineWidth = 2; x.strokeStyle = "rgba(255,203,92,.45)"; x.stroke();

    x.textBaseline = "middle";
    x.textAlign = "left";
    x.fillStyle = "#ffcb5c";
    x.font = "800 16px 'Segoe UI', system-ui, -apple-system, sans-serif";
    x.fillText(`${rank.icon} ${tier.name}`, F.pad + 10, py + 17, F.w - F.pad * 2 - 70);
    x.textAlign = "right";
    x.fillStyle = "#e8ecff";
    x.font = "800 14px 'Segoe UI', system-ui, -apple-system, sans-serif";
    x.fillText(`LV ${Status.level()}`, F.w - F.pad - 10, py + 17);

    /* PIPS — one per level in this tier, filled up to where you are. The warmth ramp is felt
       rather than read; this is the half that can be READ, so "something changed" is never a
       question. Drawn on the plaque beside the level, where the eye already goes. */
    const pipR = 2.6, pipGap = 8;
    const pipW = (span - 1) * pipGap;
    let pxs = F.w - F.pad - 10 - pipW;
    for (let i = 0; i < span; i++){
      x.beginPath();
      x.arc(pxs + i * pipGap, py + 34, pipR, 0, Math.PI * 2);
      x.fillStyle = i <= step ? "rgba(255,203,92,.95)" : "rgba(255,255,255,.20)";
      x.fill();
    }

    /* the level bar — the one thing on the board that moves every few rolls */
    const bx = F.pad + 10, bw = F.w - F.pad * 2 - 20, by = py + 44, bh = 7;
    roundRect(x, bx, by, bw, bh, 4);
    x.fillStyle = "rgba(255,255,255,.13)"; x.fill();
    const p = Math.max(0, Math.min(1, Status.levelProgress()));
    if (p > 0){
      roundRect(x, bx, by, Math.max(4, bw * p), bh, 4);
      x.fillStyle = "#2dd4bf"; x.fill();
    }

    /* HAVE / NEEDED, under the bar. A bar on its own says "some of the way"; the numbers say
       how much more, which is the question actually being asked. Both are drawn because they
       answer it at different distances — the bar from across the board, the number when you
       look at it.

       Measured WITHIN the level, not against the Season: points banked since this level began,
       over what this level costs. At the top there is no next level, so it says so rather than
       printing a fraction of a span that does not exist. */
    const lvNow = Status.level();
    x.textBaseline = "middle";
    x.textAlign = "center";
    x.font = "800 13px 'Segoe UI', system-ui, -apple-system, sans-serif";
    if (lvNow >= Status.maxLevel()){
      x.fillStyle = "#ffcb5c";
      x.fillText("SEASON COMPLETE", F.w / 2, by + 20);
    } else {
      const here = Status.levelAt(lvNow), next = Status.levelAt(lvNow + 1);
      const have = Math.max(0, Math.round(Status.points() - here));
      const need = Math.max(1, Math.round(next - here));
      x.fillStyle = "rgba(232,236,255,.92)";
      x.fillText(`${fmt(have)} / ${fmt(need)}`, F.w / 2, by + 20);
    }

    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.userData = { aspect: F.w / F.h };
    return map;
  },

  /* Every problem at once, in the house style. A tier that opens where no band does would make
     the house and the title change on different rolls, which is the one thing §3.5's pairing
     exists to avoid. */
  validate(){
    const errs = [];
    if (!ESTATE_TIERS.length) return ["The estate has no tiers."];
    if (ESTATE_TIERS[0].at !== 1) errs.push("The first estate tier must open at level 1.");
    ESTATE_TIERS.forEach((t, i) => {
      if (!t.name) errs.push(`Estate tier ${i} has no name — the plaque prints it.`);
      if (!t.art) errs.push(`Estate tier "${t.name}" has no art.`);
      if (i && t.at <= ESTATE_TIERS[i - 1].at)
        errs.push(`Estate tier "${t.name}" does not open above the one before it.`);
      if (!STATUS_RANKS.some(r => r.from === t.at))
        errs.push(`Estate tier "${t.name}" opens at level ${t.at}, which is not where a status band opens.`);
    });
    return errs;
  },
};
