import * as THREE from "three";
import { GLTFLoader } from "../../vendor/loaders/GLTFLoader.js";
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

   ---- THE HOUSE IS A MODEL; THE SIGN IS STILL A PLANE ----

   The estate began as a painting: the tier's art inside a gilt frame, with a plaque under it,
   the whole thing printed on one upright plane. That is a picture OF the place. §3.5 asks for
   the place, and a board whose centrepiece is a framed picture while forty tiles around it are
   real geometry reads as a poster propped up in the middle of the game.

   So a tier may now carry a `model` — a GLB that stands on the board like any tile's does — and
   the painting becomes the FALLBACK, not the plan. Both paths ship at once and always will:
   a tier with no model yet, a file that 404s, a GLTFLoader that fails, all land on the painting,
   which is the same picture the album and the profile use anyway. Nothing has to be migrated in
   one go, which is the point — the tiers can be modelled one at a time.

   What does NOT become geometry is the plaque. The band, the tier's name, the level, the pips
   and the level bar are the only Status readout on the board, and they are the one thing here
   that moves every few rolls. So they stay a painted canvas — but on their own plane now, a
   sign standing on the ground in front of the house rather than a label welded under a picture.

   ---- why any of this is geometry and not DOM ----

   It was DOM once, projected onto the board's centre every frame. That works and it looks wrong:
   a DOM layer draws AFTER the scene whatever its depth, so it floats over the dice instead of
   behind them, it cannot be occluded, and every camera move slides it across the world by a
   frame's worth of lag. It reads as chrome pinned over the board rather than as a building
   standing on it.

   ---- AN UPRIGHT PLANE, NOT A SPRITE ----

   Still true of the sign, and of the painting when it is the one showing. A sprite — or any
   camera-facing quad — has ONE depth for the whole quad, so a die landing in front of the
   estate's feet is still measured against its middle and vanishes behind the whole building.
   Standing it up fixes that: depth then varies down its height exactly as a real standee's does.
   The camera looks down at 38°, so the base is further away than the roof, and a die resting
   nearer the camera than that base simply draws in front. A die behind it is still hidden,
   which is also correct.

   It is yawed to face the camera and never needs updating, because this camera only pans and
   zooms — it never orbits. Standing upright costs cos(38°) of on-screen height, so the geometry
   is made FORESHORTEN times taller and `height` keeps meaning screen size.

   The model needs none of that. It is a solid thing with real depth, so it occludes and is
   occluded on its own terms — which is why its material is left writing depth while the two
   painted planes do not.

   ---- these are constants, deliberately not config ----

   Where the furniture stands is LAYOUT: one right answer per view, found by looking at it. And
   cfg is PERSISTED — js/storage.js merges a saved config over the shipped defaults, so a layout
   number living in cfg would change nothing for anyone who has already opened the game. Timings
   stay in cfg; position does not.

   What IS per-tier lives in assets/estate/estate.js beside the model path — `yaw` and `scale`,
   both optional. A generated mesh arrives at whatever angle its reference image was drawn at,
   and a villa is not a bedsit's size; neither is a reason to edit this file. */

/* ---- the painting (the fallback) ----
   `at` is measured UP-screen from the board's centre, so a larger number sits higher. `height`
   is the whole extent in tiles. */
const SPOT = { at: -0.35, height: 4.10 };
/* The 9:16 frame is far more zoomed in (cfg.camZoomPhone), so the same numbers walk the estate
   off the board there — it needs to be smaller and lower. */
const SPOT_PHONE = { at: 0.05, height: 3.05 };

/* ---- the modelled estate ----
   `height` and `span` are WORLD sizes in tiles, NOT screen sizes. The painting is a flat card
   held up to the camera, so stating its size in screen units is the only thing that makes sense;
   a building is geometry standing on the ground, and the camera foreshortens it exactly as it
   foreshortens the board under it.

   IT IS FITTED INSIDE BOTH, and takes whichever bound it hits first. A single "scale to this
   height" rule only works while every tier is roughly the same shape, and they are not: the
   bedsit is a tall narrow house, and once the roof came off to make it an open dollhouse it
   became a wide shallow box instead. Scaling that by height alone multiplies it until its floor
   fills the ring. The villa at the top of the track is a wide clifftop island and would do the
   same. So `height` keeps a tall tier from burying the board and `span` keeps a wide one from
   swallowing it, and neither has to be re-derived when a tier changes shape.

   `sign` is the sign's on-screen WIDTH, and `gap` is how far clear of the plot it stands, in
   world units — measured from the plot's real near corner rather than assumed, so a wide tier
   pushes its own sign forward without a number changing.

   `at` sits well above the painting's, because the assembly now hangs BELOW its anchor: the
   house stands at `at` and the sign drops in front of it. */
const MODEL = { at: -0.70, height: 3.15, span: 3.90, sign: 2.30, gap: 0.14 };
const MODEL_PHONE = { at: -0.05, height: 2.60, span: 3.20, sign: 1.85, gap: 0.12 };

/* Seated ON the board and growing UP from it: the surface is 0 and a plane's origin is its
   middle, so the base sits at BASE_Y and the centre goes half its height above. */
const BASE_Y = 0.14;
/* Mirrors ENV_CAM in js/ui/board3d.js. */
const CAM_EL = 38;
const FORESHORTEN = 1 / Math.cos(CAM_EL * Math.PI / 180);
const CAM_YAW = Math.PI / 4;
const UP = new THREE.Vector3(0, 1, 0);
/* The direction from what the camera looks at TOWARD the camera. Mirrors _camOffset in
   js/ui/board3d.js, normalized. Under an orthographic camera, sliding something along this axis
   changes ONLY its depth — not where it lands on screen and not how big it is. */
const CAM_DIR = new THREE.Vector3(
  Math.cos(CAM_EL * Math.PI / 180) * Math.sin(CAM_YAW),
  Math.sin(CAM_EL * Math.PI / 180),
  Math.cos(CAM_EL * Math.PI / 180) * Math.cos(CAM_YAW));

/* ---- THE WEATHER OVER THE PLOT ----

   A tier change swaps one building for another, and swapping it in place is a CUT: one frame a
   bedsit, the next a townhouse, in the middle of the board, while the player is reading a status
   ribbon somewhere else. It reads as an asset popping in, which is exactly what it is.

   So a cloud rolls over the plot, the swap happens where it is thickest, and it clears. The
   player sees weather and then a different house, which is the oldest trick there is and still
   the right one — nothing about the swap is on screen.

   `front` is the whole reason this obeys the board's rules instead of breaking them. The puffs
   are not drawn over the scene with depth testing off, which would put fog over a die that
   landed in FRONT of the estate. They are moved bodily toward the camera along CAM_DIR — the
   same trick _packAnchor() plays with a box — so they reliably cover the building behind them
   while anything nearer the camera still draws in front, correctly and for free.

   Puffs are upright planes yawed to the camera, like everything else flat here. */
const FOG = {
  count: 16,
  front: 3.0,          // world units toward the camera — depth only, nothing moves on screen
  spread: 0.36,        // how far puffs scatter, as a fraction of the estate's span
  lift: 0.34,          // where the cloud's lowest puffs sit, as a fraction of the estate's height
  tall: 0.13,          // and how far up the rest of them are stacked, per step, same units
  rise: 0.34,          // how far a puff drifts up over its life, same units
  size: 0.88,          // a puff's starting diameter, as a fraction of the span
  grow: 1.55,          // and what it grows to
  stagger: 0.22,       // the last puff starts this far into the beat, so it billows
  peak: 0.86,          // the thickest a puff gets
  swapAt: 0.46,        // when the building is exchanged, as a fraction of the beat
  /* Not white. A pure-white cloud over a cream board reads as a flash going off; a
     grey-blue one with a little warmth mixed through it reads as weather. */
  cool: 0xd7e0f2,
  warm: 0xf6dfc0,
};

/* WHICH WAY THE HOUSE FACES — and why it is the one number always worth checking.

   The estate is an OPEN dollhouse: no roof, and the two walls nearest the viewer taken away so
   the floors and everything standing on them are visible from above. That makes the turn
   load-bearing in a way it never was for a closed building. Face the open corner at the camera
   and you are looking into the rooms; turn it a half-turn and the estate is two blank walls.

   It is not derivable, either. These are image-to-3D meshes, and the generator returns each one
   in the frame of its own reference image — near enough the same frame every time, since every
   tier comes off the same pipeline, but never exactly. So the default here is the angle that
   fits the shipped set, found by LOOKING: tools/estate-preview.html renders a mesh at eight
   yaws under this same camera, which answers it in one screenshot. A tier that lands somewhere
   else corrects itself with `yaw` in assets/estate/estate.js and needs no code change.

   That it comes out equal to the camera azimuth is a coincidence worth not reading into. The
   player's piece is turned by CAM_YAW because it was authored facing +Z; this is turned by the
   same amount because that is where its open corner happens to point. */
const MODEL_YAW = 45 * Math.PI / 180;

/* THE LIGHTS COMING ON, as a light rather than as a wash.

   On the painting the per-level change was a golden soft-light pass over the picture: the same
   scene reading colder at the start of a tier than at the end of it. A model does not need the
   trick, because it can simply be LIT — so the ramp drives a warm point light standing where the
   windows are, plus a little emissive so the building lifts and not only the ground it throws
   light on. Same idea, one fewer pretence.

   WHERE IT STANDS is what makes the number safe. The lamp sits INSIDE the open box, roughly at
   the height of the floor between the two storeys — so what it lights is the rooms, which are in
   shadow from every direction the scene's own lights come from, and it barely touches the outer
   walls at all. That is why it can be bright. An earlier pass, on a closed building, put the same
   light outside and ran it up to the scene's key: it floodlit the front and took the teal
   straight out of the walls. A warm light has to stay a warm light.

   The emissive beside it is a lift, not a glow, for the same reason: additive light flattens
   shadows, which is the one thing the painting's soft-light pass was careful not to do.

   The lamp's floor is deliberately above zero. An unlit estate at the centre of the board reads
   as a model that failed to load rather than as a tier just begun. */
const LAMP = { from: 0.45, to: 2.40, at: 0.46, dist: 3.4, color: 0xffb56a };
const EMIT = { from: 0.00, to: 0.05, color: 0xffb04a };

/* The painted faces, in canvas pixels. The painting is portrait, because the art is: a building
   is taller than it is wide, and a plaque under it carries the name. The sign is that same
   plaque with the picture cut away — same width, so nothing in it has to be re-laid-out, and
   PLAQUE_H tall plus a pad top and bottom for the stroke to sit in. */
const F = { w: 300, h: 400, plaque: 84, pad: 10 };
const PLAQUE_H = F.plaque - F.pad;                    // 74 — the plaque box itself
const P = { w: 300, h: PLAQUE_H + F.pad * 2, pad: F.pad };

/* performance.now() where it exists, Date.now() where it does not. Monotonic is preferable —
   the fog should not jump if the system clock moves — but either is fine over a second. */
const now = () => (typeof performance !== "undefined" && performance.now)
  ? performance.now() : Date.now();

/* WHAT THE STATUS SURFACES ARE CURRENTLY DRAWING — the live total most of the time, a held older
   reading while a card beat is up, and an interpolated one while that beat's bar runs
   (js/ui/fx.js). The estate's sign is one of those surfaces and the HUD pill is the other: they
   carry the same level and the same bar, so they have to read ONE value or they contradict each
   other on screen at the same instant, which is worse than neither of them moving. */
function shownPts(){
  return typeof statusShownPoints === "function" ? statusShownPoints() : Status.points();
}

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
  _scene: null, _group: null, _lamp: null,
  _body: null, _sign: null, _bodySig: null, _signSig: null,
  _gltf: null, _models: new Map(), _pending: new Set(), _failed: new Set(),
  /* Which tier the building on screen IS. Not derivable from _bodySig, which carries the level
     — and a level change inside one tier must not fog, because nothing is being swapped. */
  _bodyTier: null,
  /* And the PATH it was built from. With per-level models a tier is no longer enough to say
     which building is standing: two levels of one band can be two different files. */
  _bodyUrl: null,
  _fog: null, _fogFrom: 0, _fogDur: 0, _fogSwap: null, _fogTimers: [],
  _fogTex: null, _fogGeo: null,

  init(scene){
    this._scene = scene;
    this._group = new THREE.Group();
    this._group.name = "estate";
    scene.add(this._group);
    /* THE LAMP IS MADE ONCE AND NEVER REMOVED, which is not a tidiness point.

       three.js keys every material's compiled program on the scene's light counts, so adding or
       dropping a light invalidates all of them. Parenting the lamp to the building meant that
       crossing from a modelled tier to a painted one — level 6, today, which every player
       reaches — took the point-light count from one to zero and recompiled the whole scene: one
       frame of ~45 ms, on the exact roll that is supposed to feel like a promotion.

       Living on the group instead, it is simply turned down to nothing when there is no house to
       light. It also gets to be positioned in world coordinates, because the group is unscaled —
       the holder is not, and a world position written onto a child of a scaled parent is
       multiplied by that scale. */
    this._lamp = new THREE.PointLight(LAMP.color, 0, LAMP.dist, 2);
    this._group.add(this._lamp);
    /* A painting drawn before its art arrived is a building with no building in it, so a sync
       is taken whenever the cache says an image landed.

       Nothing is invalidated by hand here, and that matters. onArtLoad fires for EVERY image the
       game ever decodes — forty-eight card faces, twelve clue photographs, every item — and the
       old single-signature version dropped it on each one. Under a model that would mean cloning
       a seven-thousand-triangle building and its materials sixty times over a session, to show
       something identical each time. The painting's signature carries artTick() and repaints
       itself; the model's does not carry it, because no picture in that cache is in the model.
       So the right invalidation is none. */
    onArtLoad(() => this.sync());
    /* NOT sync() here. Board3D.init() runs before boot() calls initState(), so there is no state
       to read yet. renderAll() calls sync the moment state exists. */
  },

  /* What a tap may hit. Every mesh under the group, so the model's own geometry answers as
     readily as the sign does — a player tapping the house means the house.

     The matrices are refreshed here rather than at the call site: the estate is rebuilt whenever
     the level moves, and a fresh mesh's world matrix is stale until the next render, so a tap in
     that one frame would miss. Updating the GROUP is what makes it correct — updating each mesh
     leaves it reading a parent transform that is itself stale. */
  meshes(){
    if (!this._group) return [];
    this._group.updateMatrixWorld(true);
    const out = [];
    this._group.traverse(o => { if (o.isMesh) out.push(o); });
    return out;
  },

  _phone(){
    return (typeof VIEW_MOBILE !== "undefined" && VIEW_MOBILE) || !!cfg.phoneView;
  },

  /* WHICH BUILDING THIS LEVEL WANTS — the tier's, unless the level has one of its own.

     A tier is a band of five levels and one model covers all five, which is why the only thing
     that changed between them was the lamp. `levels` lets a tier name a different GLB at a given
     level, so the bedsit can get a real bed at 2 and its stairs fixed at 3 while staying the
     bedsit. Absent, every level in the band shares the tier's model exactly as before — this is
     an opt-in per tier and per level, not a new requirement to author thirty buildings.

     Keyed by the absolute level rather than by a step within the band, because that is how the
     manifest reads out loud: `levels: { 2: ... }` on a tier that opens at 1 is "at level 2". */
  modelFor(level){
    const lv = level == null ? Status.level() : level;
    const t = this.tierFor(lv);
    return (t.levels && t.levels[lv]) || t.model || null;
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
     and thirty are not going to be painted, so the per-level difference is something the engine
     does to the asset it already has.

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
  /* 0..1 across the tier — how far the lights have come up. */
  _warm(level){
    const { step, span } = this.tierStep(level);
    return span > 1 ? step / (span - 1) : 1;
  },

  /* ---------------- the model ----------------

     Loaded once per path and kept, because the SIGN repaints every time the level bar moves and
     re-fetching a megabyte of building behind it would be absurd. Clones are cheap; the fetch is
     not. A failure is remembered too, so a missing file costs one 404 rather than one per roll. */
  _model(url){
    if (!url) return null;
    if (this._models.has(url)) return this._models.get(url);
    if (this._pending.has(url) || this._failed.has(url)) return null;
    this._pending.add(url);
    if (!this._gltf) this._gltf = new GLTFLoader();
    this._gltf.load(url, (gltf) => {
      this._pending.delete(url);
      /* Anisotropic filtering, set ONCE and here. The camera looks down at 38°, so surfaces are
         always seen at a grazing angle — precisely the case plain mipmapping over-blurs. three.js
         clamps the value to the GPU's maximum, so asking for 16 is safe without the renderer to
         hand.

         It belongs on the CACHED scene rather than on each clone, because a clone shares its
         material's `.map` with this one: writing `needsUpdate` on it per rebuild would re-upload
         a 4096² texture and regenerate its mips every time the level moved, to change nothing. */
      gltf.scene.traverse(o => {
        if (!o.isMesh || !o.material) return;
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])){
          if (!m.map) continue;
          m.map.anisotropy = 16;
          m.map.needsUpdate = true;
        }
      });
      this._models.set(url, gltf.scene);
      /* The painting is on screen by now. Sync here rather than waiting for a roll to trigger
         one — and nothing needs invalidating, because the two paths' signatures are prefixed
         "m/" and "f/" and so can never compare equal across a swap. */
      this.sync();
    }, undefined, (e) => {
      this._pending.delete(url);
      this._failed.add(url);
      console.warn(`Estate3D: ${url} failed to load — falling back to the painting`, e);
    });
    return null;
  },

  /* Rebuilt only when what it shows changes, and the house and the sign are asked separately.

     renderAll() runs on every float and every log line, and the level bar moves every few rolls
     — so the sign is repainted often. The house is not: it depends on the LEVEL, never on the
     points inside it, and rebuilding it would mean cloning a mesh and its materials to show
     something identical. Two signatures, two child groups, one cheap sync. */
  sync(){
    if (!this._scene) return;
    if (typeof state === "undefined" || typeof Status === "undefined") return;
    /* The SHOWN total, not the live one — so a renderAll() landing mid-beat repaints what the
       beat is showing rather than snapping the sign to the answer its bar is still travelling
       toward. */
    const pts = shownPts();
    const lv = Status.level(pts);
    const tier = this.tierFor(lv);
    const view = this._phone() ? "p" : "d";
    const url = this.modelFor(lv);
    const src = this._model(url);
    /* The next tier's building is fetched a level early, so that arriving at it is not the
       moment its megabyte starts downloading. */
    this._preload(lv);

    /* A PROMOTION WAITS FOR ITS HOUSE. The new tier's model is almost never in hand on the frame
       the level ticks over, and the naive reading of the line below is "no model yet, so draw the
       painting" — which showed the player a framed picture for a moment and then popped the
       building in behind it. Two changes where there should be one, and the fog covered neither:
       by the time the model landed the tier had already turned over, so nothing looked new.

       So when the tier we are moving TO has a model that is merely still in flight, the estate
       holds still — old house, old plaque — and the promotion happens in one beat when the file
       arrives. Only a tier with no model at all, or one whose model has genuinely failed, falls
       back to the painting; and the first build has nothing to hold, so it paints regardless. */
    if (!src && url && !this._failed.has(url) && this._body && this._bodyUrl) return;

    if (src){
      /* MODELLED. The house holds still while the sign counts. */
      const bodySig = `m/${lv}/${view}`;
      const signSig = `m/${lv}/${Math.round(Status.levelProgress(pts) * 100)}/${view}`;
      /* A swap already owing owns the body until it runs. Touching it here would change the
         house in the open and then have the armed swap change it again — see _swapNow. */
      if (bodySig !== this._bodySig && !this._fogSwap){
        /* ANY CHANGE OF BUILDING gets weather over it; anything else is swapped where it stands.

           The test is the MODEL PATH, not the tier. It used to be the tier, which was right while
           a band shared one building — but a tier can now name a different GLB per level, and a
           level 1 → 2 swap is exactly as much of a cut as a tier change is. What the fog covers is
           an exchange, and an exchange is what a changed path means.

           The two cases that must NOT fog are the ones that look like a change and are not: the
           first build, when there is no old house to hide, and the model arriving after the
           painting stood in for it — same path, so a puff of cloud there would announce a load
           rather than a promotion. Both are caught by comparing the path the body was BUILT from,
           which is why _bodyUrl is tracked separately from the signature. */
        if (this._body && this._bodyUrl && this._bodyUrl !== url && this._fogOn()){
          /* NOT `this._bodySig = bodySig` here. The signature has to describe what is DRAWN, and
             for the next 46% of the beat that is still the old house — so it is written by the
             swap, in _swapNow, at the moment the house actually changes. Writing it now was a
             real bug and a nasty one: the signature said "already showing the townhouse" while
             the flat was still standing, so a level that moved BACK inside the cloud's window
             (a Season reset, or a status value nudged in the tuning drawer) found nothing to do,
             and the armed swap then installed the townhouse over it for good — right house,
             wrong player, under the flat's plaque, and stuck until the next level change. */
          this._beginFog();
        } else {
          this._bodySig = bodySig;
          this._signSig = null;                  // the sign hangs off the plot; remeasure it
          this._body = this._swap(this._body, this._buildModel(src, tier, lv));
          this._bodyTier = tier;
          this._bodyUrl = url;
          this._sweep();
        }
      }
      /* While the cloud is THICKENING, the sign holds its old name: the plaque and the house
         belong to one tier and have to turn over together, or the board says "The townhouse"
         over a bedsit for half a second.

         The gate is `_fogSwap` — is a swap still owing — and not `_fog`, which was the first and
         wrong version of this line. Fog outlives the swap by design: it clears for as long again
         afterwards. Gating on the cloud therefore blocked the plaque for the whole beat and left
         it stale until something else happened to call renderAll(), which in a quiet moment is
         never. Gating on the swap opens it the instant the house changes, still under cover. */
      if (signSig !== this._signSig && !this._fogSwap){
        this._signSig = signSig;
        this._sign = this._swap(this._sign, this._buildSign(lv));
      }
      return;
    }

    /* PAINTED. The plaque is part of the picture, so there is nothing to hang beside it. */
    const bodySig = `f/${lv}/${Math.round(Status.levelProgress(pts) * 100)}/${view}/${artTick()}`;
    if (bodySig === this._bodySig) return;
    this._bodySig = bodySig;
    this._signSig = null;
    this._sign = this._swap(this._sign, null);
    this._lamp.intensity = 0;      // turned down, never removed — see init()

    const map = this._paintingTexture(lv);
    const spot = this._phone() ? SPOT_PHONE : SPOT;
    const th = spot.height;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(th * map.userData.aspect, th * FORESHORTEN),
      new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
    mesh.rotation.y = CAM_YAW;
    const g = this._ground(spot.at);
    mesh.position.set(g.x, BASE_Y + th * FORESHORTEN / 2, g.z);
    mesh.userData.own = "all";
    mesh.renderOrder = 2;
    this._body = this._swap(this._body, mesh);
    this._bodyTier = tier;
    this._bodyUrl = null;                      // a painting was built from no model at all
  },

  /* The ground point `at` units UP-screen of the board's centre. The 45° camera renders a
     displacement along (−1, −1) as straight up the screen, which is why both coordinates take
     the same number and why it is negated. */
  _ground(at){ return { x: -at, z: -at }; },

  /* Swap one child of the group for another, disposing what it owns.

     `userData.own` says what a mesh brought with it. A painted plane owns everything — its
     canvas texture, its material and its geometry. A model's meshes own only their MATERIALS,
     which were cloned so the warm ramp could be written onto them; the geometry and the texture
     underneath belong to the loaded scene every future clone is made from, and disposing those
     would empty the cache from underneath the next rebuild. */
  _swap(old, next){
    const g = this._group;
    if (old){
      g.remove(old);
      old.traverse(o => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (o.userData.own === "all"){
          mats.forEach(m => {
            if (!m || !m.map) return;
            /* THE SIGN'S HANDLE DIES WITH THE SIGN — but with that sign only, matched on the
               texture actually being disposed. Nulling it unconditionally looks equivalent and
               is not: `next` is an ARGUMENT, so _buildSign has already painted the replacement
               and set the new handle by the time this runs, and a blanket null would erase the
               sign about to be installed rather than the one going away. Invalidating here
               rather than at each call site is what makes it a property of disposal, so a
               paintBar can never write into a dead texture. */
            if (this._live && this._live.map === m.map) this._live = null;
            if (m.map.dispose) m.map.dispose();
          });
          if (o.geometry && o.geometry.dispose) o.geometry.dispose();
        }
        mats.forEach(m => m && m.dispose && m.dispose());
      });
    }
    if (next) g.add(next);
    return next || null;
  },

  /* ---------------- letting go of a tier ----------------

     WHY THIS EXISTS. Each tier's building carries one baked 4096² texture — about 89 MB once the
     GPU has decoded it and built its mips, against 2 MB on disk. Six tiers is 15 MB of repository
     and about 537 MB of video memory, and a Season walks the player through all six. Keeping
     every tier it had ever seen is what the cache did at first: fine on a desktop, a crash on a
     phone, and invisible in every check that looks at file sizes.

     WHY IT IS NOT SIMPLY "DISPOSE THE OLD ONE". The cached scene is what every clone is made
     from, and THREE's clone() shares geometry, while a cloned material shares its `.map`. So the
     source owns the two expensive things and the clone standing on the board is borrowing them:
     dispose the source while its clone is on screen and the estate turns into untextured noise.
     _swap() therefore disposes a clone's materials and nothing else, and eviction waits until
     nothing is borrowing.

     `keep` is what makes that wait unnecessary to reason about at the call site: whatever the
     BODY was built from is always kept, whether or not the level still agrees with it. That
     covers both windows where the two disagree — the fog, where the new tier is current while
     the old house is still standing, and the hold, where the new tier's file has not arrived. */
  _evict(url){
    const scene = this._models.get(url);
    if (!scene) return;
    this._models.delete(url);
    scene.traverse(o => {
      if (!o.isMesh) return;
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if (!m) return;
        if (m.map && m.map.dispose) m.map.dispose();
        if (m.dispose) m.dispose();
      });
    });
  },

  /* Keep what is drawn, where the player is, and where they are going next; drop the rest.
     Called after a build rather than on a timer, because a build is exactly when the answer
     changes. Re-reaching an evicted tier simply re-fetches it. */
  _sweep(){
    if (typeof Status === "undefined") return;
    const keep = new Set();
    const add = t => { if (t && t.model) keep.add(t.model); };
    if (this._bodyUrl) keep.add(this._bodyUrl); // borrowed by the clone on the board
    const lv = Status.level();
    const url = this.modelFor(lv);
    if (url) keep.add(url);                    // where the player is
    if (lv < Status.maxLevel()) {
      const nx = this.modelFor(lv + 1);        // and the next LEVEL, which _preload is warming
      if (nx) keep.add(nx);
    }
    const i = ESTATE_TIERS.indexOf(this.tierFor(lv));
    add(ESTATE_TIERS[i + 1]);                  // and the next tier's own
    Array.from(this._models.keys()).forEach(url => { if (!keep.has(url)) this._evict(url); });
  },

  /* The tier after this one, fetched while the player is still climbing toward it. _model()
     already refuses to fetch twice, so this is safe to call on every sync. */
  _preload(level){
    /* The next LEVEL first — with per-level models that is the next swap the player will see,
       and it may be a different file even inside the same band. */
    if (level < Status.maxLevel()) this._model(this.modelFor(level + 1));
    const i = ESTATE_TIERS.indexOf(this.tierFor(level));
    const next = ESTATE_TIERS[i + 1];
    if (next) this._model(next.model);
  },

  /* ---------------- the weather ----------------
     See FOG. The cloud is presentation and NOTHING waits on it: it plays behind the status
     ribbon, and the swap it covers has already happened in `state` long before this runs. */

  _fogOn(){ return !!cfg.estateFog && (+cfg.estateFogMs || 0) > 0; },

  /* One soft round puff, painted once and shared by every puff in every cloud. A radial
     gradient to transparent, which is the whole texture — the shape comes from scattering and
     scaling a dozen of them, not from any one being interesting. */
  _puffTexture(){
    if (this._fogTex) return this._fogTex;
    const N = 128;
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    /* Falls off slowly at first and then fast: a puff with a soft edge and a solid middle reads
       as cloud, where a plain linear falloff reads as a blurred dot. */
    g.addColorStop(0.00, "rgba(255,255,255,0.95)");
    g.addColorStop(0.42, "rgba(255,255,255,0.62)");
    g.addColorStop(0.74, "rgba(255,255,255,0.18)");
    g.addColorStop(1.00, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, N, N);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this._fogTex = t;
    return t;
  },

  /* Roll the cloud in, exchange the building under it, and let it clear.

     `swap` is run from a TIMER, not from the frame that happens to cross the halfway mark.
     requestAnimationFrame is suspended in a background tab, and a swap stranded behind a frame
     that never comes would leave the old tier standing forever. Same reason the teardown is a
     timer: see CLAUDE.md, "the scene's animations are driven by frames but ENDED by timers". */
  _beginFog(){
    /* A second promotion arriving mid-cloud. Drop the swap the first one still owed rather than
       running it: this cloud's own callback will build whatever tier is current by then, so the
       skipped house is never wanted. Running it here — which is what the first version did —
       revealed that intermediate building uncovered, for the one frame between the old cloud
       being torn down and the new one being built. A hard cut, in the middle of the feature
       whose entire job is to prevent one. */
    this._endFog(false);

    const dur = Math.max(1, +cfg.estateFogMs || 0);
    const spot = this._phone() ? MODEL_PHONE : MODEL;
    const g = this._ground(spot.at);

    const group = new THREE.Group();
    group.name = "estatefog";
    /* Toward the camera: depth only. See FOG.front. */
    group.position.set(g.x, 0, g.z).addScaledVector(CAM_DIR, FOG.front);

    const tex = this._puffTexture();
    if (!this._fogGeo) this._fogGeo = new THREE.PlaneGeometry(1, 1);
    const cool = new THREE.Color(FOG.cool), warm = new THREE.Color(FOG.warm);

    for (let i = 0; i < FOG.count; i++){
      /* Scattered deterministically rather than randomly. Two clouds in a row that differ only
         by noise look the same anyway, and a fixed pattern is one less thing that can produce a
         bad roll — a run of puffs all landing on one side would leave the swap visible.
         The golden angle spreads them evenly however many there are. */
      const a = i * 2.39996;
      const r = Math.sqrt((i + 0.5) / FOG.count) * spot.span * FOG.spread;
      const m = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
        color: cool.clone().lerp(warm, (i % 3) / 2 * 0.7),
      });
      const puff = new THREE.Mesh(this._fogGeo, m);
      puff.rotation.y = CAM_YAW;
      puff.userData = {
        x: Math.cos(a) * r,
        /* Stacked up the building rather than pooled at its feet: the cloud has to cover a
           three-tile house, and puffs all sharing one height cover a band across its middle and
           leave the roof and the plot showing. */
        y: BASE_Y + spot.height * (FOG.lift + (i % 5) * FOG.tall),
        z: Math.sin(a) * r,
        /* The last puff starts FOG.stagger into the beat, so the cloud builds rather than
           blinking on all at once. */
        lag: (i / Math.max(1, FOG.count - 1)) * FOG.stagger,
        seed: (i % 5) / 5,
      };
      puff.renderOrder = 3;
      group.add(puff);
    }

    this._fog = group;
    this._fogFrom = now();
    this._fogDur = dur;
    this._fogSwap = () => this._swapNow();
    this._group.add(group);
    this._tickFog(0);            // pose frame zero now, so nothing flashes at full size

    this._fogTimers.push(setTimeout(() => this._runSwap(), dur * FOG.swapAt));
    this._fogTimers.push(setTimeout(() => this._endFog(true), dur + 20));
  },

  /* Exactly once, whoever gets here first. */
  _runSwap(){
    const fn = this._fogSwap;
    this._fogSwap = null;
    if (fn) fn();
  },

  /* THE EXCHANGE, and it reads the world FRESH rather than closing over the tier that was
     current when the cloud started.

     Half a beat is long enough for the level to move again — a Season reset drops it to 1, and
     the tuning drawer can move it with a keystroke — and a swap that installs a tier captured
     0.7s ago would then install a house nobody is living in. Deriving it here means the cloud is
     a promise to bring the estate up to date, not a promise to install one particular building,
     and a level that changes mid-cloud simply changes what comes out of it.

     Writing _bodySig HERE rather than when the cloud started is the other half of that: the
     signature now describes what is on the board at the moment it says so. */
  _swapNow(){
    if (typeof state === "undefined" || typeof Status === "undefined") return;
    const lv = Status.level();
    const tier = this.tierFor(lv);
    const url = this.modelFor(lv);
    const src = this._model(url);
    /* Its model is still in flight. Leave the old house standing and leave the signature alone:
       the sync that runs when the file lands finds a difference and starts a fresh cloud. */
    if (!src) return;
    this._bodySig = `m/${lv}/${this._phone() ? "p" : "d"}`;
    this._body = this._swap(this._body, this._buildModel(src, tier, lv));
    this._bodyTier = tier;
    this._bodyUrl = url;
    this._sweep();                             // what we just left is nobody's now
    /* The plaque turns over with the house. _fogSwap is already null by now — _runSwap clears it
       before calling — so the gate in sync() is open and this repaints it, still under cover. */
    this._signSig = null;
    this.sync();
  },

  /* `runOwing` says what to do with a swap that has not happened yet.

     The natural end of a cloud passes TRUE: by then the swap timer has almost always fired and
     _runSwap is a no-op, but if anything stopped it the building must still be exchanged — the
     level has already moved and an estate showing the wrong tier is worse than one that changed
     without its weather.

     A restart passes FALSE, because the swap is superseded rather than skipped: see _beginFog. */
  _endFog(runOwing){
    this._fogTimers.forEach(clearTimeout);
    this._fogTimers = [];
    if (runOwing) this._runSwap(); else this._fogSwap = null;
    const g = this._fog;
    this._fog = null;
    if (!g) return;
    this._group.remove(g);
    g.traverse(o => { if (o.isMesh && o.material.dispose) o.material.dispose(); });
    /* Neither the geometry nor the texture is disposed — both are shared by every puff of every
       cloud this session, and the next promotion wants them. */
  },

  /* Called from Board3D's frame loop, beside NPC3D.tick and Box3D.tick.

     The phase is read off the CLOCK rather than accumulated from frames, and the `dt` the loop
     passes is deliberately ignored. Accumulating works only while frames arrive at the rate the
     accumulation assumes; a tab that is throttled to a frame a second would otherwise crawl the
     cloud at a sixtieth of its proper speed and still be thickening long after the swap it was
     supposed to cover had happened. Read from the clock, a sparse frame simply lands at the
     right density, and a tab that never renders at all shows nothing and loses nothing —
     the swap and the clean-up are on timers either way. */
  tick(){
    if (!this._fog) return;
    this._tickFog(Math.min(1, (now() - this._fogFrom) / this._fogDur));
  },

  _tickFog(t){
    this._fog.children.forEach(p => {
      const d = p.userData;
      /* Each puff runs its own life from `lag` to the end of the beat. */
      const u = Math.max(0, Math.min(1, (t - d.lag) / Math.max(0.001, 1 - d.lag)));
      /* In fast, out slow: the cloud has to be thick BEFORE the swap and can take its time
         clearing afterwards, because by then there is nothing left to hide. */
      const a = Math.sin(Math.pow(u, 0.7) * Math.PI);
      p.material.opacity = a * FOG.peak;
      p.visible = p.material.opacity > 0.004;
      const spot = this._phone() ? MODEL_PHONE : MODEL;
      const size = spot.span * FOG.size * (1 + (d.seed - 0.5) * 0.35)
                 * (0.62 + FOG.grow * 0.38 * u);
      p.scale.set(size, size * FORESHORTEN, 1);
      p.position.set(d.x, d.y + spot.height * FOG.rise * u, d.z);
    });
  },

  /* ---------------- the house ----------------

     Normalization happens HERE rather than in the file, exactly as it does for a tile: measure
     the bounding box, scale it to the height this view wants, centre it on the spot and rest its
     base on the board. So an export at any scale or origin drops in and lands correctly, and a
     tier is content — a path, and at most a turn and a size. */
  _buildModel(src, tier, lv){
    const spot = this._phone() ? MODEL_PHONE : MODEL;
    const holder = new THREE.Group();
    const model = src.clone(true);
    holder.add(model);

    /* Turn it. Unlike a tile the estate has no board edge to align with — it stands alone in
       the middle of the ring — and unlike the player's piece it does not need turning toward
       the camera, because it is already looking that way. See MODEL_YAW. The tier's own `yaw`
       is added on top, for a reference drawn at some other angle. */
    model.rotateOnWorldAxis(UP, MODEL_YAW + (+tier.yaw || 0));
    holder.updateMatrixWorld(true);

    /* Measure from real vertices — setFromObject without the precise flag returns the box OF a
       rotated box, which reads high and renders the building small. Same trap the tile and box
       loaders document. */
    let box = new THREE.Box3().setFromObject(holder, true);
    const size = box.getSize(new THREE.Vector3());
    /* Fitted inside the height AND the ground span, whichever runs out first — see MODEL. */
    const k = +tier.scale || 1;
    holder.scale.setScalar(Math.min(
      (spot.height * k) / (size.y || 1),
      (spot.span * k) / (Math.max(size.x, size.z) || 1)));
    holder.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(holder, true);
    const c = box.getCenter(new THREE.Vector3());
    const g = this._ground(spot.at);
    holder.position.x += g.x - c.x;
    holder.position.z += g.z - c.z;
    holder.position.y += BASE_Y - box.min.y;
    holder.updateMatrixWorld(true);

    /* Where the sign goes is derived from where the plot actually ENDS, not from a guess about
       how big a house is. u is the ground axis running toward the camera; the box's far corner
       along it is the nearest point of the plot on screen, and the sign stands `gap` beyond it.
       Stored on the holder so _buildSign can read it back without measuring twice. */
    box = new THREE.Box3().setFromObject(holder, true);
    holder.userData.nearU = (box.max.x + box.max.z) / Math.SQRT2;
    /* The height it actually CAME OUT at, which is not spot.height — that is only the bound the
       fit was tested against, and the ground span is just as likely to be the one that binds.
       For the bedsit the height binds and the two agree; for a wide tier like the villa, or any
       tier that sets `scale`, they do not, and a lamp placed against the bound would hang above
       a building that never reached it. */
    const built = box.max.y - box.min.y;

    const warm = this._warm(lv);
    const emissive = new THREE.Color(EMIT.color);
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = !!cfg.envShadows;
      /* Cloned before touching. three.js shares materials across clone(), so writing this
         level's warmth onto them would write it onto every future clone of the same tier —
         and the ramp would freeze at whatever level happened to be reached first. */
      const list = (Array.isArray(o.material) ? o.material : [o.material]).map(m => {
        const mm = m.clone();
        if (mm.emissive){
          mm.emissive = emissive.clone();
          mm.emissiveIntensity = EMIT.from + warm * (EMIT.to - EMIT.from);
        }
        /* Nothing is done to `mm.map` here on purpose — it is the cached scene's texture, not a
           copy, and it was already filtered once on load. See _model(). */
        return mm;
      });
      o.material = Array.isArray(o.material) ? list : list[0];
      o.userData.own = "mat";
    });

    /* Light the rooms. `built` and not spot.height — see above. */
    this._lamp.position.set(g.x, BASE_Y + built * LAMP.at, g.z);
    this._lamp.intensity = LAMP.from + warm * (LAMP.to - LAMP.from);

    return holder;
  },

  /* ---------------- the sign ----------------
     The plaque, on its own upright plane, standing on the ground clear of the plot. */
  _buildSign(lv){
    const spot = this._phone() ? MODEL_PHONE : MODEL;
    const map = this._plaqueTexture(lv);
    const w = spot.sign;
    const h = w * (P.h / P.w) * FORESHORTEN;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
    mesh.rotation.y = CAM_YAW;
    /* Beyond the plot's near corner, on the axis that runs toward the camera. A point that far
       along it has both ground coordinates equal to u/√2 — which is the whole of the conversion
       back out of that axis. */
    const near = (this._body && this._body.userData.nearU) || 0;
    const u = near + spot.gap;
    mesh.position.set(u / Math.SQRT2, BASE_Y + h / 2, u / Math.SQRT2);
    mesh.userData.own = "all";
    mesh.renderOrder = 2;
    return mesh;
  },

  /* ---------------- the painted faces ----------------

     The painting: the building, then the plaque under it. Used when a tier has no model, or has
     one that will not load. */
  _paintingTexture(level){
    const tier = this.tierFor(level);
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
       VISIBLE at the size this is drawn — a prop moved by four pixels would not be. The modelled
       estate does the same thing with an actual lamp; see LAMP above.

       soft-light rather than a flat overlay: it warms the lit parts and leaves the shadows,
       which is what a building filling with light does. A plain alpha fill just greys it. */
    const warm = this._warm(level);
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
    this._plaque(x, F.pad, F.h - F.plaque, F.w - F.pad * 2, level);

    return this._texture(c, F.w / F.h);
  },

  /* The sign: the same plaque with the picture cut away. Identical drawing code, so the two
     paths cannot drift into looking like two different objects. */
  _plaqueTexture(level){
    const c = document.createElement("canvas");
    c.width = P.w; c.height = P.h;
    const x = c.getContext("2d");
    this._plaque(x, P.pad, P.pad, P.w - P.pad * 2, level);
    const map = this._texture(c, P.w / P.h);
    /* THE SIGN IS THE PLAQUE — the whole canvas and nothing else on it — so the status beat
       repaints it outright. Hanging the plaque on its own plane is what makes that true; in the
       painted face it is a band inside a picture and would have to be snapshotted and restored. */
    this._live = { ctx: x, map, level };
    return map;
  },

  /* THE BEAT'S BAR. Repaints the sign in place and re-uploads its texture — no new mesh, no new
     material, and no trip through sync()'s signature gate — so this is cheap enough to step on a
     timer while the status beat plays, which a full sync() explicitly is not.

     Returns false when there is no sign to paint on: the painted fallback draws its plaque into
     the picture instead, and there is a window after a swap disposes one sign and before the next
     is built. The caller falls back to a full sync, which is the behaviour before any of this. */
  paintBar(p, pts, gain){
    const L = this._live;
    if (!L || !L.map) return false;
    L.ctx.clearRect(0, 0, P.w, P.h);
    /* THE LEVEL THE SIGN IS ALREADY SHOWING, not the one the points imply. Only the bar and the
       number under it move here; the tier's name, the "LV n" and the pips are the sign's
       IDENTITY, and sync() holds those deliberately — behind the fog while the house changes,
       and behind _fogSwap while a swap is owing. Reading Status.level(pts) instead would turn
       the plaque over while the previous building was still standing, which is the one thing
       §3.5's pairing and the fog both exist to prevent. */
    this._plaque(L.ctx, P.pad, P.pad, P.w - P.pad * 2, L.level, { p, pts, gain });
    L.map.needsUpdate = true;
    /* THE SIGNATURE NO LONGER DESCRIBES WHAT IS DRAWN, so it must stop being trusted.

       sync() skips the rebuild when its signature is unchanged, and that signature quantises
       progress to a whole percent — so a small gain often computes the SAME string it did
       before the beat, and at the Season gate levelProgress is pinned at 1 and the string can
       never change at all. The settling sync would then early-return and leave this gold, lit,
       mid-beat bar on the plaque permanently. Invalidating here is what makes the settle's
       "guaranteed to land on the real number" actually true. */
    this._signSig = null;
    return true;
  },

  _texture(canvas, aspect){
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.userData = { aspect };
    return map;
  },

  /* THE PLAQUE — the band, the tier's name, the level, the pips and the level bar, drawn at
     (ox, oy) in a box `w` wide and PLAQUE_H tall. Everything inside is placed relative to that
     corner, which is what lets the painting hang it under a picture and the sign stand it on
     the ground with one copy of the code. */
  _plaque(x, ox, oy, w, level, bar){
    const tier = this.tierFor(level);
    /* THE POINTS THIS FACE IS DRAWING — shownPts() normally, or the beat's own interpolated
       value when it is steering. The fraction is passed in rather than derived during a beat
       because a level crossing is TWO moves, not one: fill to the top of the old level, turn
       over, fill again from the bottom of the new one. Deriving it would run the bar backwards
       across everything just earned. */
    const pts = bar && bar.pts != null ? bar.pts : shownPts();
    const rank = Status.rank(pts);

    roundRect(x, ox, oy, w, PLAQUE_H, 9);
    const grad = x.createLinearGradient(0, oy, 0, oy + PLAQUE_H + F.pad);
    grad.addColorStop(0, "rgba(12,15,40,.93)"); grad.addColorStop(1, "rgba(8,10,28,.97)");
    x.fillStyle = grad; x.fill();
    x.lineWidth = 2; x.strokeStyle = "rgba(255,203,92,.45)"; x.stroke();

    x.textBaseline = "middle";
    x.textAlign = "left";
    x.fillStyle = "#ffcb5c";
    x.font = "800 16px 'Segoe UI', system-ui, -apple-system, sans-serif";
    x.fillText(`${rank.icon} ${tier.name}`, ox + 10, oy + 17, w - 70);
    x.textAlign = "right";
    x.fillStyle = "#e8ecff";
    x.font = "800 14px 'Segoe UI', system-ui, -apple-system, sans-serif";
    x.fillText(`LV ${level}`, ox + w - 10, oy + 17);

    /* PIPS — one per level in this tier, filled up to where you are. The warmth ramp is felt
       rather than read; this is the half that can be READ, so "something changed" is never a
       question. Drawn on the plaque beside the level, where the eye already goes. */
    const { step, span } = this.tierStep(level);
    const pipR = 2.6, pipGap = 8;
    const pipW = (span - 1) * pipGap;
    const pxs = ox + w - 10 - pipW;
    for (let i = 0; i < span; i++){
      x.beginPath();
      x.arc(pxs + i * pipGap, oy + 34, pipR, 0, Math.PI * 2);
      x.fillStyle = i <= step ? "rgba(255,203,92,.95)" : "rgba(255,255,255,.20)";
      x.fill();
    }

    /* the level bar — the one thing on the board that moves every few rolls */
    const bx = ox + 10, bw = w - 20, by = oy + 44, bh = 7;
    roundRect(x, bx, by, bw, bh, 4);
    x.fillStyle = "rgba(255,255,255,.13)"; x.fill();
    const p = Math.max(0, Math.min(1, bar && bar.p != null ? bar.p : Status.levelProgress(pts)));
    if (p > 0){
      roundRect(x, bx, by, Math.max(4, bw * p), bh, 4);
      if (bar && bar.gain){
        /* Gold and lit while the beat runs. The card that paid for this has just flown off the
           board into the collection button, so the eye is already on its way back here. */
        x.save();
        x.shadowColor = "rgba(255,203,92,.85)"; x.shadowBlur = 12;
        x.fillStyle = "#ffcb5c"; x.fill();
        x.restore();
      } else {
        x.fillStyle = "#2dd4bf"; x.fill();
      }
    }

    /* HAVE / NEEDED, under the bar. A bar on its own says "some of the way"; the numbers say
       how much more, which is the question actually being asked. Both are drawn because they
       answer it at different distances — the bar from across the board, the number when you
       look at it.

       Measured WITHIN the level, not against the Season: points banked since this level began,
       over what this level costs. At the top there is no next level, so it says so rather than
       printing a fraction of a span that does not exist. */
    /* Measured within the level this face is DRAWING, not the one the points imply. They are the
       same on every full paint; they come apart during a beat, where the bar is steered and the
       plaque's identity is deliberately held (see paintBar). */
    const lvNow = level;
    x.textBaseline = "middle";
    x.textAlign = "center";
    x.font = "800 13px 'Segoe UI', system-ui, -apple-system, sans-serif";
    if (lvNow >= Status.maxLevel()){
      x.fillStyle = "#ffcb5c";
      x.fillText("SEASON COMPLETE", ox + w / 2, by + 20);
    } else {
      const here = Status.levelAt(lvNow), next = Status.levelAt(lvNow + 1);
      const have = Math.max(0, Math.round(pts - here));
      const need = Math.max(1, Math.round(next - here));
      x.fillStyle = bar && bar.gain ? "#fff2cf" : "rgba(232,236,255,.92)";
      x.fillText(`${fmt(have)} / ${fmt(need)}`, ox + w / 2, by + 20);
    }
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
      /* A model is the estate and the painting is the fallback, so a tier needs at least one of
         them. Which one it has is not this function's business: a modelled tier that has kept
         its painting is the safest thing in the file, and a painted tier is simply not modelled
         yet. */
      if (!t.art && !t.model)
        errs.push(`Estate tier "${t.name}" has neither art nor a model.`);
      if (i && t.at <= ESTATE_TIERS[i - 1].at)
        errs.push(`Estate tier "${t.name}" does not open above the one before it.`);
      if (!STATUS_RANKS.some(r => r.from === t.at))
        errs.push(`Estate tier "${t.name}" opens at level ${t.at}, which is not where a status band opens.`);
    });
    return errs;
  },
};
