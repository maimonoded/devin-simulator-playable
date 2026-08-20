/* 3D board renderer.

   This is the project's only ES module *entry point* — everything else is classic scripts
   sharing globals. It imports js/ui/env3d.js (the world around the board), which is therefore
   also a module, but there is still one <script type="module"> tag so index.html's classic
   load order remains the dependency order. It owns a three.js scene for the board and exposes an imperative API on
   window.Board3D that mirrors what js/ui/render.js used to do to the DOM, so callers barely
   change. Everything else on screen (HUD, panels, modals, the video player) is still DOM.

   Two consequences of being a module:
     - it loads deferred, i.e. AFTER every classic script has run, so it calls boot() itself
     - the page must be served over http; browsers block module scripts on file:// URLs

   Geometry reuses gridPos(i) from js/board-model.js, so the board layout stays defined in one
   place. The camera is orthographic at azimuth 45° / elevation 38°, which reproduces the CSS
   board's projection exactly (sin 38° = cos 52° = 0.6157). */

import * as THREE from "../../vendor/three.module.js";
import { GLTFLoader } from "../../vendor/loaders/GLTFLoader.js";
import { Env3D } from "./env3d.js";
import { Shoe3D } from "./shoe3d.js";
import { NPC3D } from "./npc3d.js";

const N = 11;                    // grid is 11x11, tiles around the ring
const TILE = 1;                  // one tile = one world unit
/* 0 = tiles butt exactly, so flush full-bleed tile art forms one continuous floor.
   The gap existed for the plain placeholder slabs, which needed it to read as separate tiles. */
const GAP = 0;
const TILE_H = 0.16;             // tile slab thickness
const EXTENT = N * TILE;         // board footprint
/* The player piece. Absent file = the placeholder disc stays, so this is safe to remove. */
const TOKEN_MODEL = "assets/token/token.glb";
/* The mystery box sitting on a tile. Same deal: absent file falls back to the plain cube, so the
   board never depends on the asset having been generated. Normalized to a 1x1 footprint with its
   origin at the base, like the tiles, so BOX_SIZE is just how big it is in tile units. */
const BOX_MODEL = "assets/props/models/mystery-box.glb";
/* The gold one holds clues. Because contents are decided when a box is PLACED, the board can
   say so before the player gets there — which is what turns a box into somewhere worth landing
   rather than an invisible bonus. */
const BOX_MODEL_GOLD = "assets/props/models/mystery-box-gold.glb";
const BOX_SIZE = 0.42;           // tile units, tall enough to read past a neighbouring tile
/* Where a box's base goes: the slab's TOP, the same surface the token stands on and the same
   value js/ui/npc3d.js calls FOOT_Y.

   Not TILE_H/2, which is what this used to be. TILE_H/2 is where _loadModel GROUNDS A TILE MODEL
   (`holder.position.y += TILE_H / 2 - box.min.y`), i.e. the underside of the tile's own paving —
   half a slab BELOW the surface things stand on. A box placed there sinks 0.08 into its tile.
   It got away with it for a while because a chunky object still reads as sitting on a tile when
   its bottom centimetre is buried; the walking figures are what made the same mistake visible.

   Every box height has to come from here: the resting place, the gold box's idle bob, and the
   put-everything-back path after a cancelled throw. The throw itself captures the resting y and
   restores it, so it follows on its own — but only because all three agree. */
const BOX_Y = TILE_H;

/* ---- the VIP treasure chest ----
   The VIP Lounge is the board's only POOL, and until now the only place you could see it was
   the HUD. This is that number, standing in the world.

   IT IS NOT ON THE TILE. It sits OUTSIDE the ring, past the VIP corner on the outward diagonal,
   where it neither shares tile 20's square with the token nor competes with that tile's own art
   — and where, in the shipped texas-town world, it stands among the trees.

   That position is also why it is allowed to be BIG. envMaxTop() in js/env-model.js caps a
   piece by how much board it could hide, and tile 20 is the diamond's FAR vertex: there is no
   board behind it at all, so the only ceiling is the frame's (ENV_Y.deck + 3.0). Every other
   piece of art on this board is fighting a 0.2-tile budget; this one is not.

   Board-relative rather than an entry in assets/env/scene.js, for one reason: env pieces are
   static scenery that Env3D places and forgets, and this one has to follow state.vip. Added to
   the scene root so it survives a world switch. NOTE the consequence — in the harbour world
   that spot is open water and the chest will stand on it. cfg.chest turns it off. */
const CHEST_MODEL = "assets/props/models/treasure-chest.glb";
const CHEST_MODEL_OPEN = "assets/props/models/treasure-chest-open.glb";
/* Tile units, largest dimension. Measured on the board rather than chosen. It went 1.8 → 2.5 to
   read past the storefronts, and then to 0.83 — a third of that — once it was seen at the size
   it actually renders: 2.5 made a chest taller than the buildings behind it, which reads as a
   set piece rather than as the Lounge's takings. A third of a tile is a prop again. */
const CHEST_SIZE = 0.83;
/* World (x,z), on the outward diagonal past tile 20 (which sits at (-5,-5), the ring's edge
   being -5.5).

   6.05 IS MEASURED, NOT ROUNDED. It has to clear the plinth (±6.0) so the chest is not standing
   on the board's own lip, and it has to stay INSIDE the town — at 6.6 the chest sat behind the
   texas-town storefronts and was invisible from the camera, which is the whole failure this
   position exists to avoid. Just outside the plinth is the one band that is both off the board
   and in front of the buildings.

   Framing: envVisible() guarantees |x+z| <= 11·cfg.envMargin, which is 12.1 against 18.7 at the
   shipped margin of 1.7. Note this corner is only ON SCREEN when the camera is near it — the
   camera follows the token, so with the token at Start the far vertex (tile 20 included) is
   above the top of the frame. The chest is a landmark you arrive at, not a permanent fixture.

   ON THE DIAGONAL, AND THAT WAS RE-LEARNED THE HARD WAY. Moving it along the ring to get it out
   of the token's screen column (-7.0,-5.1) put it straight behind the town's woodwork — the
   corner diagonal is the ONE clear lane between the board's lip and the buildings, which is why
   the distance above is so tight. It shares a screen column with the token but sits ABOVE it,
   not behind it: chest base at y 76, token at y 108, so they stack rather than overlap. */
const CHEST_AT = [-6.05, -6.05];
/* Turned to face the camera, not the +Z the tile loader assumes: a chest read from behind is a
   brown box, and this one's lid is a barrel, so the two ends read as blank arches.

   THE TWO MODELS NEED DIFFERENT YAWS, AND THAT IS NOT A MISTAKE. normalize_tile.py squares each
   model's floor to the axes, and squaring is modulo 90° — which quadrant a given model lands in
   is arbitrary. These two were squared by 60.5° and 55.5°, and came out a quarter-turn apart:
   the shut chest shows its clasp at 90°, the open one shows its coins at 0. Measured by
   rendering four clones of each at 0/90/180/270 and looking, which is the only way to know.
   Re-generate either model and this has to be re-measured. */
const CHEST_YAW = { _chestShut: Math.PI / 2, _chestOpen: 0 };
/* Its base sits on the deck — ENV_Y.deck, the underside of the tiles and the top of the island,
   which is 0. Written as a name rather than a bare 0 so it moves if the datum ever does. */
const CHEST_Y = 0;

/* Palette lifted from css/base.css + css/board.css so both renderers look alike. */
const COLORS = {
  standard: 0x232a63,
  corner:   0x272e63,
  start:    0x3a3016,
  spa:      0x232a63,
  vip:      0x232a63,
  premiere: 0x232a63,
  train:    0x2a2f66,
  deck:     0x2b2560,
  edge: {                        // the coloured borders the CSS tiles carry
    start:    0xffcb5c,
    spa:      0x2dd4bf,
    vip:      0x8b6dff,
    premiere: 0xff6fa5,
  },
  token:    0xff6fa5,
  tower:    0x8b6dff,
  towerDone:0xffcb5c,
  box:      0xffcb5c,
};

/* Smooth in and out — the camera moves, which should never start or stop abruptly. */
const ease = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
/* A falling box: most of the way down fast, then a small overshoot and settle. Reads as weight
   without a physics step, and unlike a real bounce it always ends exactly at 1 — the box has to
   come to rest ON the tile, not near it. */
const bounce = (k) => {
  if (k >= 1) return 1;
  const p = 1 - Math.pow(1 - k, 2.2);
  return p + Math.sin(k * Math.PI) * 0.06 * (1 - k);
};
/* How high a box lobs on its way from the card to its tile. Shape, not pacing, so it is a
   constant here while the throw's timings stay in cfg — it has to keep its proportion to the
   board whatever boxThrowMs is tuned to, and it is measured in tiles like everything else. */
const THROW_ARC = 0.9;

const Board3D = {
  available: false,
  ready: false,

  _renderer: null, _scene: null, _camera: null, _host: null,
  _tiles: [], _token: null, _boxes: new Map(), _models: new Map(), _gltf: null,
  _raf: 0,
  /* The mystery box model, loaded once and cloned per box. */
  _boxModel: null, _boxModelGold: null,
  /* Frustum half-height from the last resize(), and the multiplier the box throw pulls the
     camera out by. Kept apart so the throw can widen the view without resize() having to know
     about it, and so a resize mid-throw still lands on the right base framing. */
  _fit: 0, _aspect: 1, _zoom: 1, _zoomShown: 1,
  /* Per-frame animations owned by the board (the box throw and the box opening). Same shape the
     mini-games use. _fxDone holds the resolve of anything currently awaiting one of them, so a
     teardown can settle it rather than leaving the roll loop waiting on an animation that will
     never finish. */
  _anims: [], _fxDone: [], _flying: null,
  _tokenTarget: new THREE.Vector3(), _hopT: 1,
  /* _camTarget is where the camera is looking now, _camWant where it is heading. Keeping
     them apart is what makes the follow trail rather than snap. */
  _camTarget: new THREE.Vector3(), _camWant: new THREE.Vector3(),
  _camAim: new THREE.Vector3(), _camOffset: new THREE.Vector3(),
  /* Set while the player has dragged the view somewhere of their own. Follow stands down
     until the token next moves, so a look-around isn't fought by the camera. */
  _camManual: false, _drag: null,

  /* ---------------- setup ---------------- */
  init(host) {
    this._host = host;
    try {
      this._renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      console.warn("Board3D: WebGL unavailable, falling back to the DOM board", e);
      this.available = false;
      return false;
    }
    /* Render at 2x and let the browser downsample, even on a 1x display. A tile spans only
       ~27 CSS pixels at the default board size, so it is the sample count — not the texture
       or the triangle budget — that limits how much of the art survives. The scene is a few
       thousand triangles, so supersampling costs effectively nothing here. */
    this._renderer.setPixelRatio(Math.max(2, Math.min(devicePixelRatio, 2)));
    this._renderer.domElement.className = "boardCanvas";
    host.appendChild(this._renderer.domElement);

    this._scene = new THREE.Scene();

    /* Orthographic so every tile is the same shape regardless of distance — the CSS board
       had to drop its perspective for exactly this reason. */
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const az = THREE.MathUtils.degToRad(ENV_CAM.az), el = THREE.MathUtils.degToRad(ENV_CAM.el);
    /* The camera is defined as a direction and a distance from whatever it is looking at,
       not as a fixed point. Framing the whole board and following the token are then the
       same code with a different target — and the direction never changes, so the isometric
       projection is identical however far the camera travels. */
    this._camOffset = new THREE.Vector3(
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az),
    ).multiplyScalar(40);
    this._camAim.copy(this._camTarget).add(this._camOffset);
    this._camera.position.copy(this._camAim);
    this._camera.lookAt(this._camTarget);

    /* With nothing but the board on screen a near-flat ambient reads fine. Once there is
       ground under it the board has to look like it is sitting on something, which means a
       real key light and a shadow — so the ambient comes down to leave the shadow somewhere
       to land. */
    const env = !!cfg.env3d;
    this._scene.add(new THREE.AmbientLight(0xffffff, env ? 0.95 : 1.5));
    const key = new THREE.DirectionalLight(0xffffff, env ? 1.9 : 1.6);
    key.position.set(...(env ? [12, 24, 16] : [6, 12, 8]));
    this._scene.add(key);
    const rim = new THREE.DirectionalLight(0x8b6dff, 0.7);
    rim.position.set(-8, 5, -6);
    this._scene.add(rim);
    if (env) this._scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x14204a, 0.45));

    /* Shadows are what sell "the board sits on the island" — without one it reads as a decal.
       The shadow camera is sized to the island, not the scene: anything bigger just spends
       texels on water. */
    if (env && cfg.envShadows) {
      this._renderer.shadowMap.enabled = true;
      this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      const s = ENV_SIZE.island + 1.5;
      Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 80 });
      key.shadow.bias = -0.0006;
      key.shadow.normalBias = 0.02;
      key.shadow.camera.updateProjectionMatrix();
    }

    Env3D.init(this._scene);
    this.syncPageBackground();
    /* Init once, not per build(): the deck and the ticket placeholders hang off their own
       groups, which build() leaves alone, so they survive a board rebuild the way the token
       does. build() also re-runs on every reset and would re-fetch their models. */
    Shoe3D.init(this._scene);
    /* Same deal, and handed the board's own geometry rather than deriving the ring a second
       time. anisotropy is passed as a function because the renderer's capability is only
       meaningful once it exists, which it does by here but would not at module scope. */
    NPC3D.init(this._scene, {
      tileWorld: (i) => this._tileWorld(i),
      anisotropy: () => this._renderer.capabilities.getMaxAnisotropy(),
    });
    this._initDrag(this._renderer.domElement);

    this.available = true;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(host);
    addEventListener("resize", () => this.resize());   // belt and braces for window changes
    this._loop();
    return true;
  },

  resize() {
    if (!this.available) return;
    const w = this._host.clientWidth, h = this._host.clientHeight;
    if (!w || !h) return;            // pane collapsed — a 0-size aspect would corrupt the frustum

    /* setSize with updateStyle (the default) so the drawing buffer and the CSS size always
       agree. Sizing the buffer alone and letting CSS stretch the canvas gives non-square
       pixels — the board looked squashed flat until this was fixed. */
    this._renderer.setSize(w, h);

    /* Frame the whole board with a margin. The ring is EXTENT units square, which projects
       sqrt(2) wider and sqrt(2)*sin(38°) taller, so pick the vertical half-extent that
       contains it on both axes and derive the horizontal from the true aspect. */
    const aspect = w / h;
    /* Two different framings, deliberately not the same number scaled.

       Static: fit the board plus envMargin, so the island and some water are in shot.
       Following: fit a fraction of the BOARD itself and ignore the ground margin, because
       camZoom is meant to read as "how much of the board is on screen" — 0.5 is half. Scaling
       the margined frame instead would make 0.55 show 93% of the board, since most of that
       frame is water. */
    const follow = !!cfg.camFollow;
    /* Phone framing keeps its own zoom. A 9:16 pane is far narrower than a desktop one, so
       the value that fills a wide frame leaves the board small in a tall one — they are
       genuinely different numbers rather than one scaled by aspect.
       ?view=mobile IS phone framing, but it must not write cfg.phoneView to say so: that key
       is persisted, so a single visit to the mobile URL would leave the desktop view stuck in
       9:16 forever. Read the flag here instead of setting the config. */
    const phone = cfg.phoneView || (typeof VIEW_MOBILE !== "undefined" && VIEW_MOBILE);
    const want = phone ? cfg.camZoomPhone : cfg.camZoom;
    const zoom = follow ? Math.min(1, Math.max(0.05, want || 1)) : 1;
    const halfW = (EXTENT * Math.SQRT2 / 2) * (follow ? zoom : envMargin());
    const halfH = halfW * Math.sin(THREE.MathUtils.degToRad(ENV_CAM.el));
    /* Stored rather than applied directly: the box throw multiplies this to pull the camera out,
       and keeping the base separate means a resize mid-throw re-fits the board without also
       cancelling the zoom. */
    this._fit = Math.max(halfH, halfW / aspect);
    this._aspect = aspect;
    this._applyFrustum();
    if (window.syncBoardLabels) window.syncBoardLabels();
  },

  /* The camera's frustum = the fit resize() worked out, widened by whatever the box throw is
     currently asking for. Cheap enough to call every frame while the zoom is moving. */
  _applyFrustum() {
    const fit = this._fit * this._zoom, a = this._aspect;
    this._camera.left = -fit * a;
    this._camera.right = fit * a;
    this._camera.top = fit;
    this._camera.bottom = -fit;
    this._camera.updateProjectionMatrix();
    this._zoomShown = this._zoom;
  },

  /* world position of a tile's centre (top surface) */
  _tileWorld(i) {
    const p = gridPos(i);
    return new THREE.Vector3(
      (p.c - (N - 1) / 2) * TILE,
      TILE_H / 2,
      (p.r - (N - 1) / 2) * TILE,
    );
  },

  /* Angle the model's floor is rotated by, found as the orientation of its minimum-area
     bounding rectangle. Only vertices in the bottom 15% of the model count, so walls and
     props don't drag the fit. Returns 0..90° — a square floor is symmetric under 90°, so any
     of the four results is equally correct. */
  _floorYaw(model, box) {
    const cut = box.min.y + (box.max.y - box.min.y) * 0.15;
    const pts = [];
    const v = new THREE.Vector3();
    model.traverse((o) => {
      if (!o.isMesh) return;
      const p = o.geometry.attributes.position;
      for (let k = 0; k < p.count; k++) {
        v.fromBufferAttribute(p, k);
        o.localToWorld(v);
        if (v.y <= cut) pts.push(v.x, v.z);
      }
    });
    if (pts.length < 6) return 0;
    let bestArea = Infinity, bestRad = 0;
    for (let deg = 0; deg < 90; deg += 0.5) {
      const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        const u = pts[i] * ca - pts[i + 1] * sa;
        const w = pts[i] * sa + pts[i + 1] * ca;
        if (u < x0) x0 = u; if (u > x1) x1 = u;
        if (w < z0) z0 = w; if (w > z1) z1 = w;
      }
      const area = (x1 - x0) * (z1 - z0);
      if (area < bestArea) { bestArea = area; bestRad = a; }
    }
    return bestRad;
  },

  /* World-space extent of an object's floor — the bottom 20% of its height. This, not the
     bounding box, is what has to line up with the neighbouring tiles: anything that overhangs
     the ground (a roof, a wall cap) may cross the cell edge without dragging the floor in. */
  _floorRect(obj) {
    const box = new THREE.Box3().setFromObject(obj, true);
    const cut = box.min.y + (box.max.y - box.min.y) * 0.2;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const v = new THREE.Vector3();
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const p = o.geometry.attributes.position;
      for (let k = 0; k < p.count; k++) {
        v.fromBufferAttribute(p, k);
        o.localToWorld(v);
        if (v.y > cut) continue;
        if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x;
        if (v.z < z0) z0 = v.z; if (v.z > z1) z1 = v.z;
      }
    });
    if (x0 === Infinity) {            // no geometry sampled — fall back to the whole box
      const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      return { w: s.x, d: s.z, cx: c.x, cz: c.z };
    }
    return { w: x1 - x0, d: z1 - z0, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
  },

  /* Yaw that turns a +Z-facing model to point out of the ring, away from the board centre
     (the world origin). Which edge a tile is on is just whichever of |x|/|z| is larger; the
     four edges come out as 0 / ±90 / 180°. */
  _tileYaw(i) {
    const w = this._tileWorld(i);
    const out = Math.abs(w.z) >= Math.abs(w.x)
      ? { x: 0, z: Math.sign(w.z) }
      : { x: Math.sign(w.x), z: 0 };
    return Math.atan2(out.x, out.z);
  },

  /* ---------------- build ---------------- */
  build() {
    if (!this.available) return;
    this._tiles.forEach(t => { this._scene.remove(t); });
    this._tiles = [];
    this._models.forEach(m => this._scene.remove(m));
    this._models.clear();

    const geo = new THREE.BoxGeometry(TILE - GAP, TILE_H, TILE - GAP);
    for (let i = 0; i < 40; i++) {
      const type = tileType(i);
      const mat = new THREE.MeshLambertMaterial({ color: COLORS[type] ?? COLORS.standard });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(this._tileWorld(i));
      mesh.userData.tile = i;
      mesh.castShadow = mesh.receiveShadow = true;
      this._scene.add(mesh);
      this._tiles[i] = mesh;

      /* corner tiles get a coloured rim, standing in for the CSS border */
      const edge = COLORS.edge[type];
      if (edge) {
        const ring = new THREE.Mesh(
          new THREE.BoxGeometry(TILE - GAP + 0.06, TILE_H * 0.9, TILE - GAP + 0.06),
          new THREE.MeshBasicMaterial({ color: edge, wireframe: true }),
        );
        ring.position.copy(mesh.position);
        this._scene.add(ring);
      }
      this._loadModel(i, mesh) || this._loadArt(i, mesh);
    }

    this._buildToken();
    this._loadBoxModel();
    this._loadChest();
    this.setTokenTile(state.pos, true);
  },

  /* Optional per-tile 3D model (assets/tiles/models/N.glb) — the point of the whole port.

     Normalization happens HERE rather than in the file. The offline normalizer round-trips the
     mesh through trimesh, which drops the baked texture (verified: raw GLB has 1 image, the
     normalized one has 0), and these assets already arrive inside the triangle budget. So the
     textured file is used as-is and the engine enforces the spec on import — measure the
     bounding box, fix the up axis, scale to the tile, centre it and sit it on the slab.
     Absent models are normal: the tile keeps its plain slab. */
  _loadModel(i, slab) {
    if (!this._gltf) this._gltf = new GLTFLoader();
    this._gltf.load(
      tileModelPath(i),
      (gltf) => {
        const model = gltf.scene;

        /* No up-axis correction: glTF 2.0 mandates +Y up and GLTFLoader has already applied
           the node transforms, so a .glb is upright by definition. There used to be a
           "deeper than it is tall, so treat it as Z-up" heuristic here. It is exactly wrong
           for a correct tile — a square ground with a low profile is *supposed* to be deeper
           than it is tall, so the heuristic stood good tiles on end. Only a malformed export
           would need this, and guessing costs more than it saves. */
        let box = new THREE.Box3().setFromObject(model, true);

        /* Square the floor to the tile axes BEFORE measuring anything else.

           Image-to-3D reconstructs the model in the reference image's frame, and the reference
           is a three-quarter view — so the plot's square ground comes back sitting diagonally,
           typically ~45-52° off axis. Its axis-aligned bounding box is then the diamond's
           bounding box, which is much larger than the floor itself: one asset measured a
           1.00 x 0.99 AABB around a floor that was really 0.70 x 0.76. Scaling that AABB to
           the tile leaves the actual paving at ~0.7, rotated, so tiles meet at their corners
           with visible gaps instead of forming a continuous surface.

           So: find the floor's own orientation via its minimum-area bounding rectangle and
           undo it. Ground samples only — the walls and props would skew the fit. */
        /* The model goes inside a holder. All rotation happens on the model; all scaling and
           positioning on the holder, which stays axis-aligned — so a non-uniform scale always
           means world X and Z, and never gets swapped by a 90° tile yaw. */
        const holder = new THREE.Group();
        holder.add(model);

        model.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -this._floorYaw(model, box));

        /* Turn the model to face out of the ring. Art fronts +Z by convention (see
           assets/tiles/README.md), and the four edges need four different yaws or the two
           side edges would present the model's flank instead of its face. Facing OUT rather
           than in matters: the two edges nearest the camera are the ones the player reads,
           and an inward-facing model puts its back — here a blank brick wall — between the
           camera and its own tile, hiding both the art and the token standing on it.

           Corner tiles have two equally valid normals and just take one. */
        model.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), this._tileYaw(i));
        holder.updateMatrixWorld(true);

        /* Fit the FLOOR to the cell, each axis independently.

           Two reasons it isn't a uniform scale of the whole model. First, the thing that has
           to tile is the floor, not the bounding box: a wall or roof that overhangs the ground
           would otherwise drive the scale and shrink the floor away from its neighbours.
           Second, generated floors are never quite square — this one came back 0.863 x 0.984 —
           and a uniform fit leaves the short axis 14% short of the cell, which reads as a gap
           between every pair of tiles. Height takes the geometric mean so proportions stay
           sane. The stretch is a few percent on chunky toy art and invisible; a visible seam
           in the board is not. */
        const f = this._floorRect(holder);
        const sx = (TILE - GAP) / (f.w || 1);
        const sz = (TILE - GAP) / (f.d || 1);
        holder.scale.set(sx, Math.sqrt(sx * sz), sz);
        holder.updateMatrixWorld(true);

        /* centre the floor on the tile and rest the base on the slab */
        const f2 = this._floorRect(holder);
        box = new THREE.Box3().setFromObject(holder, true);
        const w = this._tileWorld(i);
        holder.position.x += w.x - f2.cx;
        holder.position.z += w.z - f2.cz;
        holder.position.y += TILE_H / 2 - box.min.y;

        holder.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
        /* Anisotropic filtering. The camera looks down at 38°, so tile surfaces are always
           seen at a grazing angle — precisely the case where plain mipmapping over-blurs,
           because it picks a mip level for the axis that is compressed hardest and applies
           it to both. three.js defaults to 1 (off); the GPU offers 16. */
        const aniso = this._renderer.capabilities.getMaxAnisotropy();
        model.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (!m.map) continue;
            m.map.anisotropy = aniso;
            m.map.needsUpdate = true;
          }
        });

        this._scene.add(holder);
        this._models.set(i, holder);
        slab.visible = false;                       // the model brings its own ground
        /* Models arrive after the label layer is built, so the label has to be told. */
        if (window.onTileModelled) window.onTileModelled(i);
      },
      undefined,
      () => {},                                     // no model for this tile — keep the slab
    );
    return false;   // the PNG fallback is still wired up; whichever resolves wins
  },

  /* Optional per-tile artwork. In 3D this is just the slab's top-face texture —
     no counter-rotation, no anchor maths, which is the whole point of the port. */
  _loadArt(i, mesh) {
    const src = tileImagePath(i);
    new THREE.TextureLoader().load(
      src,
      tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const top = new THREE.MeshLambertMaterial({ map: tex, transparent: true });
        const side = mesh.material;
        /* BoxGeometry material order: +x, -x, +y(top), -y, +z, -z */
        mesh.material = [side, side, top, side, side, side];
      },
      undefined,
      () => {},                      // absent art is normal — leave the plain slab
    );
  },

  _buildToken() {
    if (this._token) this._scene.remove(this._token);
    const g = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.12, 24),
      new THREE.MeshLambertMaterial({ color: COLORS.token }),
    );
    disc.position.y = 0.06;
    g.add(disc);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 16, 12),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
    );
    dot.position.y = 0.2;
    g.add(dot);
    this._token = g;
    this._scene.add(g);
    this._loadTokenModel(g);
  },

  /* Swap the placeholder disc for the modelled piece (assets/token/token.glb).

     The disc is built first and kept until the GLB actually arrives, so the board is never
     without a token — a missing or failed file just leaves the disc in place.

     Normalized on load like the tile art, for the same reason: the file is whatever the
     generator produced. Scaled by HEIGHT rather than footprint, because a game piece reads
     by how tall it stands next to a tile, and stood on the holder's origin so the existing
     hop tween — which drives holder.position.y — keeps working untouched. */
  _loadTokenModel(holder) {
    /* Already parsed? Reattach it. build() runs on every board rebuild — a config reset, a
       reshape — and each one used to discard the model and re-fetch 5 MB, leaving the
       placeholder disc on screen until it came back. Warm, that gap is a few hundred
       milliseconds; cold or on a slow link it is however long the download takes, and if the
       fetch fails at all the disc simply stays. The piece is a singleton, so keeping it and
       moving it between holders is both correct and free. */
    if (this._tokenModel) {
      holder.clear();
      holder.add(this._tokenModel);
      this.setTokenHeight();
      return;
    }
    if (!this._gltf) this._gltf = new GLTFLoader();
    this._gltf.load(TOKEN_MODEL, (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model, true);
      /* Keep the unscaled height: setTokenHeight() rescales from this, so dragging the size
         slider never re-fetches the model. */
      this._tokenNaturalH = box.getSize(new THREE.Vector3()).y || 1;
      this._tokenModel = model;

      /* Turn to face the camera. Unlike a tile, a piece has no board edge to align with —
         it should read from wherever the player is looking, and the camera azimuth is fixed. */
      model.rotation.y = THREE.MathUtils.degToRad(ENV_CAM.az);

      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = !!cfg.envShadows;
        if (o.material?.map) o.material.map.anisotropy = this._renderer.capabilities.getMaxAnisotropy();
      });

      holder.clear();                        // drop the placeholder disc
      holder.add(model);
      this.setTokenHeight();
    }, undefined, (e) => {
      /* Say so. A silent failure here is indistinguishable from "there is no model", and the
         board just quietly shows the placeholder for ever. */
      console.warn(`Board3D: player piece ${TOKEN_MODEL} failed to load, keeping the disc`, e);
    });
  },

  /* Resize the piece to cfg.tokenHeight, in tile units. Rescales the model already in the
     scene rather than reloading it — the GLB is several MB, and this runs on every frame of
     a slider drag. Re-grounds afterwards so the feet stay on the tile whatever the size. */
  setTokenHeight() {
    const m = this._tokenModel;
    const holder = m && m.parent;
    if (!holder) return;
    m.scale.setScalar((cfg.tokenHeight || 0.6) / (this._tokenNaturalH || 1));
    m.position.set(0, 0, 0);
    /* From the HOLDER down: setTokenTile writes holder.position but nothing recomputes its
       matrixWorld until the next render, and Box3 reads matrixWorld. Measuring against a
       stale identity returns a local-space box, and the world-relative correction below then
       double-counts the holder's position — the piece lands one tile-offset away. */
    holder.updateMatrixWorld(true);

    /* Box3 measures in WORLD space, but m.position is relative to the holder — and the holder
       travels with the token. So correct toward the holder's position, not toward the origin.
       Subtracting the world centre outright parks the piece at the middle of the board, which
       is exactly what it did until this line was fixed; it only looked right on first load,
       when the holder happened to still be at the origin. */
    const box = new THREE.Box3().setFromObject(m, true);
    const c = box.getCenter(new THREE.Vector3());
    m.position.x += holder.position.x - c.x;        // centred on the tile
    m.position.z += holder.position.z - c.z;
    m.position.y += holder.position.y - box.min.y;  // feet on the tile top
  },


  /* ---------------- updates ---------------- */
  setTokenTile(i, instant) {
    if (!this.available || !this._token) return;
    this._camManual = false;      // the token moved — the camera's job again

    const w = this._tileWorld(i);
    this._tokenTarget.set(w.x, TILE_H, w.z);
    if (instant) {
      this._token.position.copy(this._tokenTarget);
      this._hopT = 1;
    } else {
      this._hopT = 0;                       // triggers the hop tween in _loop
    }
  },

  /* `boxes` is [{i, gold}] — which tiles hold a box and which of those are the clue ones. */
  setOverlays(boxes) {
    if (!this.available) return;
    const want = new Map(boxes.map(b => [b.i, !!b.gold]));
    for (const [i, mesh] of this._boxes) {
      /* A box whose LOOK changed has to be rebuilt, not just left alone — that happens when a
         pre-gold save is restored and its contents get drawn on the first landing. */
      if (!want.has(i) || mesh.userData.gold !== want.get(i)) {
        this._scene.remove(mesh); this._boxes.delete(i);
      }
    }
    want.forEach((gold, i) => {
      if (this._boxes.has(i)) return;
      this._boxes.set(i, this._addBox(i, gold));
    });
  },

  /* One box, resting on its tile. Uses the generated model if it has arrived and a plain cube
     otherwise — the cube is not a placeholder to be removed later, it is the fallback for a
     missing or failed asset, exactly like the token's disc. */
  _addBox(i, gold) {
    const holder = new THREE.Group();
    const w = this._tileWorld(i);
    holder.position.set(w.x, BOX_Y, w.z);
    holder.userData.gold = !!gold;
    /* Gold falls back to the plain box before it falls back to the cube: a wrong-coloured box
       still reads as a box, where a cube reads as missing art. */
    const model = (gold && this._boxModelGold) || this._boxModel;
    holder.add(model
      ? model.clone(true)
      : new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3),
                       new THREE.MeshLambertMaterial({ color: gold ? 0xffcb5c : COLORS.box })));
    if (!model) holder.children[0].position.y = 0.15;   // cube pivots at its middle

    /* The gold one has to be findable from across the board, where a tile is a few dozen pixels
       and a colour difference alone is lost against the pale deck. So it is also bigger and
       wears a halo — and it moves, which is what the eye actually catches. */
    if (gold) {
      holder.scale.setScalar(Math.max(0.2, +cfg.boxGoldScale || 1));
      const glow = Math.max(0, +cfg.boxGoldGlow || 0);
      if (glow > 0) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this._glowTexture(), color: 0xffcb5c, transparent: true, opacity: glow,
          depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        s.scale.set(1.5, 1.5, 1);
        s.position.y = BOX_SIZE * 0.55;
        holder.add(s);
        holder.userData.glow = s;
      }
    }
    /* THE SIZE THIS BOX RETURNS TO, stamped rather than assumed to be 1. A gold box is already
       scaled up (cfg.boxGoldScale), so the throw — which multiplies scale on its way in — and
       cancelBoxFx putting a box back both need this box's OWN resting size. Reading it off the
       holder here keeps the gold rule stated once, above, instead of re-derived at two more
       call sites that could drift from it. */
    holder.userData.restScale = holder.scale.x;
    /* Turned to the camera like the piece: a wrapped box has a front (the bow's knot) and no
       board edge to align with, so it should read from wherever the player is sitting. */
    holder.rotation.y = THREE.MathUtils.degToRad(ENV_CAM.az);
    this._scene.add(holder);
    return holder;
  },

  /* A soft radial blob, drawn once and reused as the gold box's halo. Cheaper and softer than
     any geometry, and as a sprite it always faces the camera. */
  _glowTexture() {
    if (this._goldGlowTex) return this._goldGlowTex;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d").createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,235,170,1)");
    g.addColorStop(0.35, "rgba(255,203,92,0.55)");
    g.addColorStop(1, "rgba(255,203,92,0)");
    const ctx = c.getContext("2d");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    this._goldGlowTex = new THREE.CanvasTexture(c);
    return this._goldGlowTex;
  },

  /* Idle life on the gold boxes: a slow turn, a gentle bob and a breathing halo. Skipped while
     any board tween is running — the throw and the opening own the transforms then, and a bob
     added on top would fight them. */
  _tickBoxes(t) {
    if (this._anims.length) return;
    for (const [i, g] of this._boxes) {
      if (!g.userData.gold) continue;
      const spin = Math.max(200, +cfg.boxGoldSpinMs || 4200);
      g.rotation.y = (t / spin) * Math.PI * 2;
      const bob = Math.max(0, +cfg.boxGoldBob || 0);
      g.position.y = BOX_Y + Math.sin(t / 620 + i) * bob;
      if (g.userData.glow) {
        const k = 1 + Math.sin(t / 480 + i) * 0.12;
        g.userData.glow.scale.set(1.5 * k, 1.5 * k, 1);
      }
    }
  },

  /* Load the box model once, then re-make any boxes already on the board so they pick it up.
     Called from build(); failure is logged and leaves the cubes, which is a working board. */
  _loadBoxModel() {
    this._loadOneBoxModel(BOX_MODEL, "_boxModel");
    this._loadOneBoxModel(BOX_MODEL_GOLD, "_boxModelGold");
  },
  _loadOneBoxModel(url, slot) {
    if (this[slot]) return;
    if (!this._gltf) this._gltf = new GLTFLoader();
    this._gltf.load(url, (gltf) => {
      const model = gltf.scene;
      /* Measure from real vertices, not cached per-geometry boxes: setFromObject without the
         precise flag returns the box OF a rotated box, which reads high and renders the prop
         small. Same trap the tile loader documents. */
      const size = new THREE.Box3().setFromObject(model, true).getSize(new THREE.Vector3());
      model.scale.setScalar(BOX_SIZE / (Math.max(size.x, size.y, size.z) || 1));
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = !!cfg.envShadows;
        if (o.material?.map) o.material.map.anisotropy = this._renderer.capabilities.getMaxAnisotropy();
        /* Self-lit, so the gold box stays the brightest thing on the deck wherever the sun is
           pointing. Cloned first — the loaded material is shared by every clone of this model,
           which is fine here (all gold boxes want it) but must not leak to the plain one. */
        if (slot === "_boxModelGold" && o.material?.emissive) {
          o.material = o.material.clone();
          o.material.emissive = new THREE.Color(0xffb020);
          o.material.emissiveIntensity = Math.max(0, +cfg.boxGoldEmissive || 0);
        }
      });
      this[slot] = model;
      /* Anything already placed is still a cube (or the wrong colour) — swap it now rather than
         waiting for the next board rebuild, which might not come until the player rolls. */
      const live = [...this._boxes].map(([i, m]) => [i, m.userData.gold]);
      live.forEach(([i]) => { this._scene.remove(this._boxes.get(i)); this._boxes.delete(i); });
      live.forEach(([i, gold]) => this._boxes.set(i, this._addBox(i, gold)));
    }, undefined, (e) => {
      console.warn(`Board3D: mystery box ${url} failed to load, keeping the cube`, e);
    });
  },

  /* ---------------- the VIP treasure chest ----------------

     TWO MODELS, NOT AN ANIMATION. Image-to-3D returns one fused mesh with no separate lid node,
     so a generated chest physically cannot hinge — the shut one and the open one are two files
     and opening is a swap. That is the same idiom the mystery box already uses for its plum and
     gold variants: the file IS the state. The swap is covered by the light coming up inside it,
     which is what the eye actually follows.

     Optional like every other prop: no file, no chest, and nothing else changes. */
  _loadChest() {
    if (!cfg.chest) return;
    this._loadOneChest(CHEST_MODEL, "_chestShut");
    this._loadOneChest(CHEST_MODEL_OPEN, "_chestOpen");
  },
  _loadOneChest(url, slot) {
    if (this[slot]) return;
    if (!this._gltf) this._gltf = new GLTFLoader();
    this._gltf.load(url, (gltf) => {
      const model = gltf.scene;
      /* Real vertices, not cached per-geometry boxes — the same trap the tile and box loaders
         document: the box OF a rotated box reads high and renders the prop small. */
      const size = new THREE.Box3().setFromObject(model, true).getSize(new THREE.Vector3());
      model.scale.setScalar(CHEST_SIZE / (Math.max(size.x, size.y, size.z) || 1));
      /* Stamped so the open-pop can MULTIPLY it rather than assign an absolute scale — the same
         rule the thrown mystery box lives under, and for the same reason: an absolute scale
         silently re-sizes the model and a pop killed mid-flight strands it at the wrong size. */
      model.userData.restScale = model.scale.x;
      model.position.set(CHEST_AT[0], CHEST_Y, CHEST_AT[1]);
      model.rotation.y = CHEST_YAW[slot] || 0;
      /* The open one waits in the scene rather than being added on demand: a GLTF that first
         appears mid-flourish would pop in a frame late, and the whole beat is under a second. */
      model.visible = (slot === "_chestShut");
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = !!cfg.envShadows;
        if (o.material?.map) o.material.map.anisotropy = this._renderer.capabilities.getMaxAnisotropy();
      });
      this[slot] = model;
      this._scene.add(model);
    }, undefined, (e) => {
      console.warn(`Board3D: treasure chest ${url} failed to load`, e);
    });
  },

  /* Open the chest for ms. Called from playEvents when the VIP Lounge pays out — see
     js/tiles/vip-tile.js, which is the only caller and explains why it is the only one.

     PUSHED, NOT POLLED, and that is the fix for a real failure: this used to watch state.vip and
     open on any change, so it fired about ten times a pack — nine of them while the token, and
     therefore the camera, was somewhere else entirely and the far corner was off the top of the
     frame. It played correctly and nobody ever saw it. Now it plays once, at the one moment the
     player is standing at this corner looking at it.

     Never blocking: the caller does not await it, and nothing in the pull loop waits. */
  openChest(ms) {
    this._chestFrom = performance.now();
    this._chestUntil = this._chestFrom + Math.max(120, +ms || 0);
  },

  /* One frame of the chest. Renders whatever openChest() last asked for and OWNS NO STATE — it
     never reads or writes the pool. A prop that moved coins from outside the event list is the
     one thing that could desync the economy from what the player was shown (the rule NPC3D
     lives under too). */
  _tickChest(t) {
    const shut = this._chestShut, open = this._chestOpen;
    if (!shut || !open) return;
    const isOpen = t < (this._chestUntil || 0);
    shut.visible = !isOpen;
    open.visible = isOpen;
    if (!isOpen) {
      if (this._chestLight) this._chestLight.intensity = 0;
      /* Put the size back, always — a pop interrupted by a reload or a second payout must not
         strand the chest swollen for the rest of the run. */
      const rest = +open.userData.restScale || open.scale.x;
      if (open.scale.x !== rest) open.scale.setScalar(rest);
      return;
    }
    /* The coins lighting up. A point light just inside the mouth rather than an emissive on the
       mesh, because the coins are not a separate material to brighten — the model is one baked
       texture, so the light is the only handle on "the gold, specifically". */
    if (!this._chestLight) {
      /* Radius in WORLD units, not tile-size-derived: the chest is a third of a tile, and a
         light with a 1.8-unit reach around it lit almost nothing. This one has to spill onto
         the ground so the corner itself brightens — that spill is most of what is visible at
         this size. */
      this._chestLight = new THREE.PointLight(0xffc257, 0, 6, 2);
      this._chestLight.position.set(CHEST_AT[0], CHEST_Y + CHEST_SIZE * 0.6, CHEST_AT[1]);
      this._scene.add(this._chestLight);
    }
    /* Up fast, down slow, so it reads as catching the light rather than blinking. */
    const span = Math.max(120, this._chestUntil - (this._chestFrom || 0));
    const k = Math.min(1, Math.max(0, (t - (this._chestFrom || 0)) / span));
    const ease = Math.sin(k * Math.PI) ** 0.6;
    this._chestLight.intensity = Math.max(0, +cfg.chestGlow || 0) * ease;
    /* AND IT SWELLS. This is the part that makes the beat legible at all: measured on the real
       board, the chest renders 35px tall, so a lid tilting back is a ~10px change at the top
       edge of the frame — correct, and invisible. Motion is what the eye catches (the same
       finding as the gold box's turn-and-bob), so the open model grows on the way in and
       settles back. A MULTIPLIER on restScale, never an absolute — see the stamp in
       _loadOneChest. */
    const rest = +open.userData.restScale || open.scale.x;
    open.scale.setScalar(rest * (1 + (Math.max(1, +cfg.chestOpenScale || 1) - 1) * ease));
  },

  /* ---------------- the box throw ----------------
     Pull the camera out, rain the boxes onto their tiles, put the camera back. Returns a promise
     that resolves when the whole thing is done, so the caller can await it before handing the
     board back to the player.

     Resolves — never rejects — on every path, including no boxes, no WebGL and a mid-throw view
     switch. The caller clears state.pendingBoxes on the strength of it. */
  /* `from` is an optional world-space origin — the card that earned the boxes. Given one, they
     ARRIVE FROM IT rather than dropping out of the sky, so the player sees where the reward came
     from instead of being told in the log. Omitted (or null) keeps the original fall, which is
     what every non-joker path still gets and what a joker gets if the card has already left.

     The card is drawn over everything while it is presented (Shoe3D._setOverlay), so a box is
     hidden behind it for the first part of the trip and emerges past its edge. That is the
     effect, not a defect: it reads as coming OUT of the card rather than from a point that
     happens to be near it. */
  throwOverlays(all, fresh, from) {
    /* `all` is every box that should be on the board, `fresh` only the ones to animate. Boxes
       already sitting there from earlier trips must not leap into the air again. */
    this.setOverlays(all);
    if (!this.available) return Promise.resolve();
    const falling = (fresh || all).map(i => this._boxes.get(i)).filter(Boolean);
    if (!falling.length) return Promise.resolve();

    const zoomOut = Math.max(1, +cfg.boxZoomOut || 1);
    const outMs = Math.max(0, +cfg.boxZoomOutMs || 0);
    const throwMs = Math.max(1, +cfg.boxThrowMs || 1);
    const inMs = Math.max(0, +cfg.boxZoomInMs || 0);

    /* The whole throw fits in boxThrowMs however many boxes there are: each one falls for a
       fixed share of the window and the starts are spread across what is left, so the last box
       lands exactly on time. Ten boxes overlap more; they do not take ten times as long. */
    const fallMs = throwMs * 0.62;
    const gap = falling.length > 1 ? (throwMs - fallMs) / (falling.length - 1) : 0;

    /* The whole resting POSE now, not just its height: a box thrown from the card moves in x and
       z too, so those have to be restorable — done() and cancelBoxFx() both put it back exactly
       on its tile whichever frame the throw stopped on. */
    const rest = falling.map(g => g.position.clone());
    /* Multiplied, never assigned: a gold box rests at cfg.boxGoldScale, and a throw that set an
       absolute scale would quietly shrink every gold box it threw back to the ordinary size. */
    const restScale = falling.map(g => +g.userData.restScale || g.scale.x || 1);
    const throwScale = Math.max(1, +cfg.boxThrowScale || 1);
    falling.forEach(g => { g.visible = false; });

    return new Promise(resolve => {
      this._fxDone.push(resolve);
      const done = () => { falling.forEach((g, k) => {
        g.visible = true; g.position.copy(rest[k]); g.scale.setScalar(restScale[k]); g.rotation.z = 0;
      }); resolve(); };
      this._tween(outMs, k => { this._zoom = 1 + (zoomOut - 1) * ease(k); }, () => {
        falling.forEach((g, k) => {
          const start = k * gap, spin = (k % 2 ? -1 : 1) * (0.5 + Math.random() * 0.7);
          this._tween(fallMs, (t) => {
            g.visible = true;
            /* Fall with a squash-free bounce: overshoot slightly past the tile and settle, which
               reads as weight without needing physics. */
            const p = bounce(t);
            const r = rest[k];
            if (from) {
              /* Thrown: across on a plain ease, down on the bounce, plus an arc so it is lobbed
                 rather than dragged. The HORIZONTAL deliberately does not use bounce — the box
                 would visibly sail past its tile and slide back, which reads as a miscalculation
                 rather than as weight. Height is where an overshoot looks like landing. */
              const e = ease(t);
              g.position.set(
                from.x + (r.x - from.x) * e,
                from.y + (r.y - from.y) * p + Math.sin(t * Math.PI) * THROW_ARC,
                from.z + (r.z - from.z) * e,
              );
              /* BIG AT THE CARD, ordinary at the tile. It leaves the card at cfg.boxThrowScale
                 and shrinks to its resting size as it travels, on the SAME ease as the distance
                 so the two stay in step — which is what makes it read as receding rather than
                 as deflating. The camera is orthographic, so there is no perspective to do this
                 for us: an object does not get smaller as it moves away, and faking it here is
                 the only thing selling the depth of the trip. */
              g.scale.setScalar(restScale[k] * (1 + (throwScale - 1) * (1 - e)));
            } else {
              g.position.y = r.y + (1 - p) * 7;
            }
            g.rotation.z = (1 - p) * spin;
          }, null, start);
        });
        this._tween(throwMs, () => {}, () => {
          this._tween(inMs, k => { this._zoom = zoomOut + (1 - zoomOut) * ease(k); }, () => {
            this._zoom = 1;
            this._fxDone = this._fxDone.filter(r => r !== resolve);
            done();
          });
        });
      });
    });
  },

  /* ---------------- opening a box ----------------
     Lift it off its tile, float it to the middle of the view swelling as it goes, hold on a last
     inflate, then pop. Resolves at the POP, not after — the caller fires the confetti and the
     showers on that moment, and the box has to be gone by then.

     The box is animated where it already is, in the board scene, rather than being re-drawn as a
     DOM element over the canvas: it is a lit 3D object with a real texture, and a flat copy of it
     floating over the board would not match. Flying it to the camera's aim point is what puts it
     in the middle of the screen whatever the camera is following. */
  openBox(i) {
    if (!this.available) return Promise.resolve();
    const g = this._boxes.get(i);
    if (!g) return Promise.resolve();

    const riseMs = Math.max(1, +cfg.boxRiseMs || 1);
    const swellMs = Math.max(0, +cfg.boxSwellMs || 0);
    const grow = Math.max(1, +cfg.boxOpenScale || 1);

    const from = g.position.clone();
    const s0 = g.scale.x;
    /* The middle of the screen in world terms is what the camera is aimed at, lifted so the box
       floats clear of the board rather than sinking into it. */
    const to = this._camTarget.clone();
    to.y = from.y + 2.2;

    /* Nothing else may be resolving on this box while it flies — take it out of the map now, so
       a renderOverlays() mid-flight (the state no longer lists it) can't remove it underneath us. */
    this._boxes.delete(i);

    return new Promise(resolve => {
      /* Registered so a mid-roll error can settle this instead of stranding an inflated box in
         mid-air and leaving roll() awaiting a pop that never comes. */
      this._flying = g;
      this._fxDone.push(resolve);
      const finish = () => {
        this._flying = null;
        this._fxDone = this._fxDone.filter(r => r !== resolve);
        resolve();
      };
      this._tween(riseMs, k => {
        const e = ease(k);
        g.position.lerpVectors(from, to, e);
        /* A little arc on the way up, and a slow turn so the ribbon catches the light. */
        g.position.y += Math.sin(e * Math.PI) * 0.6;
        g.scale.setScalar(s0 * (1 + (grow - 1) * e));
        g.rotation.y += 0.06;
      }, () => {
        this._tween(swellMs, k => {
          /* The tell: it strains, wobbling faster and faster, just before it goes. */
          const puff = 1 + 0.16 * k + Math.sin(k * Math.PI * 6) * 0.05 * k;
          g.scale.setScalar(s0 * grow * puff);
          g.rotation.z = Math.sin(k * Math.PI * 8) * 0.09 * k;
        }, () => {
          this._scene.remove(g);
          finish();
        });
      });
    });
  },

  /* Stop every board animation and clean up after it. Called from clearOverlayFx() when a roll
     dies mid-way: an inflated box left hanging over the board is the visible symptom, but the
     one that actually matters is the promise — roll()'s finally is what clears state.animating,
     and it only runs once the await returns. */
  cancelBoxFx() {
    if (!this.available) return;
    /* The deck's fx have their own queue, and a mid-pull error must settle both or pull()
       awaits a promise nothing will ever resolve. */
    Shoe3D.cancel();
    this._anims.length = 0;
    if (this._flying) { this._scene.remove(this._flying); this._flying = null; }
    /* Anything caught mid-throw is invisible or in the air — put every box back on its tile, so
       the board matches state whichever frame we stopped on. */
    for (const [i, g] of this._boxes) {
      const w = this._tileWorld(i);
      g.visible = true; g.position.set(w.x, BOX_Y, w.z); g.rotation.z = 0;
      /* Scale too, now that a thrown box arrives oversized: a throw killed mid-flight would
         otherwise leave a box sitting on its tile at up to cfg.boxThrowScale for the rest of the
         run, which is the loudest possible way for an error path to be visible. */
      g.scale.setScalar(+g.userData.restScale || g.scale.x || 1);
    }
    const waiting = this._fxDone; this._fxDone = [];
    waiting.forEach(r => r());
    /* The throw may have died with the camera pulled out — put it back. */
    if (this._zoom !== 1) { this._zoom = 1; this._applyFrustum(); }
  },

  /* A frame-stepped tween. delay lets the throw stagger without a nest of setTimeouts, which
     matters because these have to stop when the board does — a pending timeout firing into a
     torn-down scene is how the dice used to throw after a reset. */
  _tween(dur, step, end, delay = 0) {
    if (dur <= 0 && delay <= 0) { step && step(1); end && end(); return; }
    this._anims.push({ t: -delay, dur: Math.max(1, dur), step, end });
  },

  /* The ticket placeholders sit inside the board ring and are redrawn whenever a ticket
     lands. One scene, one camera — the builders' second scene is gone with the builders. */
  setTicketSlots() {
    if (!this.available) return;
    Shoe3D.syncSlots();
  },

  /* Live tuning-drawer edits. env3d and envMargin re-apply without a reload; envShadows does
     not, because the light and material setup is decided once in init(). */
  applyEnv() {
    if (!this.available) return;
    Env3D.rebuild();
    this.syncPageBackground();
    this.setTokenHeight();   // cfg.tokenHeight is live too, and must not reload the model
    NPC3D.setHeight();       // and cfg.npcHeight, for the same reason
    this.resize();
  },

  /* ?view=mobile only: paint the page behind the canvas with the environment's own ground
     colour. The renderer is alpha:true and the ground fades to transparent at the rim, so
     whatever is behind the canvas IS the edge of the world — with the app's blue gradient
     back there it reads as a border around the game. Matching the colour makes the rim
     disappear. Set as a CSS variable rather than a style so css/mobile.css keeps ownership
     of which elements use it. With the environment off there is no world colour to match,
     so it falls back to the near-black the sea would have faded into anyway. */
  syncPageBackground() {
    if (typeof VIEW_MOBILE === "undefined" || !VIEW_MOBILE) return;
    const css = cfg.env3d ? Env3D.groundColorCss() : "#0b1024";
    document.documentElement.style.setProperty("--envBg", css);
  },

  /* Did tile i end up with a 3D model? render.js asks, to decide whether the tile still
     needs its emoji. */
  hasModel(i) { return this._models.has(i); },

  /* Throw the dice onto the middle of the board. js/ui/fx.js calls this instead of shaking
     the DOM dice when the 3D board is up and the model actually loaded; it falls back on its
     own if either is false, so a missing die.glb costs the throw and nothing else. */
  /* _camTarget is where the camera is looking right now — the board centre when nothing is
     following, the token when it is, wherever the player dragged to otherwise. Handing it
     over is what makes the dice land in view rather than at the middle of the board, which
     with camFollow on is often off-screen entirely. */
  /* Two poses, two owners. The card is PRESENTED at the camera's aim — centre of the screen,
     square to the view, wherever the camera happens to be looking — and then DEALT to a fixed
     spot on the board that the player learns. So the aim goes over (live objects, read every
     frame, because camFollow moves it mid-flight) but the destination does not: that one is
     Shoe3D._discardPos(). */
  pullCard(card) {
    return Shoe3D.pullCard(card, { aim: this._camTarget, camera: this._camera });
  },
  /* Resolves once nothing is being presented — the joker's hold and its flight into the episode
     row included. pull() awaits it on a ticket so the celebration is watched instead of being
     put away by the next card; every other path ignores it and loses nothing. */
  cardStageClear(maxMs) { return Shoe3D.whenClear(maxMs); },
  /* Where the presented card is, for throwOverlays to launch a joker's boxes from. Null when
     nothing is on the stage, which is the signal to fall from above instead. */
  cardWorldPos() { return Shoe3D.presentedPos(); },
  /* The completed-collection celebration. Hands over the LIVE camera for the same reason pullCard
     does: camFollow drifts while the hand is up, and a pose computed once would let it slide. */
  completeHand(slot, per) {
    return Shoe3D.completeHand(slot, per, { aim: this._camTarget, camera: this._camera });
  },
  /* A bought deck being riffled into the one already on the table. Decoration only — the cards
     are in the shoe before this is called. Resolves, never rejects. */
  shuffleDeck() { return Shoe3D.shuffleDeck(); },
  /* Definitively failed, as opposed to merely not downloaded yet — fx.js keys its fallback off
     this, so that distinction is what stops the flat card flashing on every page load. */
  shoeFailed() { return Shoe3D.failed(); },

  /* Where a WORLD point lands on screen, in the host's coordinates. Split out of screenPosOf so
     anything in the scene can hand a position to a DOM element — the collected hand flying into
     the episode button needs it, and it is not a tile. */
  worldToScreen(p) {
    if (!this.available) return null;
    const v = new THREE.Vector3(p.x, p.y, p.z).project(this._camera);
    const rect = this._renderer.domElement.getBoundingClientRect();
    const host = this._host.getBoundingClientRect();
    return {
      x: (v.x * 0.5 + 0.5) * rect.width + (rect.left - host.left),
      y: (-v.y * 0.5 + 0.5) * rect.height + (rect.top - host.top),
    };
  },
  /* Same projection, in VIEWPORT coordinates. worldToScreen is relative to the board-scene host,
     which is right for a DOM overlay parented INTO that host and wrong for anything parented
     anywhere else — mixing the two silently puts the element hundreds of pixels off, with nothing
     to show for it but an animation nobody can find. Anything flying to a target outside the
     scene (the episode button lives on the play row) wants these. */
  worldToViewport(p) {
    if (!this.available) return null;
    const v = new THREE.Vector3(p.x, p.y, p.z).project(this._camera);
    const r = this._renderer.domElement.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * r.width + r.left, y: (-v.y * 0.5 + 0.5) * r.height + r.top };
  },

  /* A point on screen → a WORLD point that projects back onto it. The inverse of
     worldToViewport, and what lets a 3D object fly to a DOM element's position without ever
     leaving the scene: no second medium, no coordinate frames to line up, no CSS. */
  viewportToWorld(x, y) {
    if (!this.available) return null;
    const r = this._renderer.domElement.getBoundingClientRect();
    const ndcX = ((x - r.left) / r.width) * 2 - 1;
    const ndcY = -(((y - r.top) / r.height) * 2 - 1);
    return new THREE.Vector3(ndcX, ndcY, 0).unproject(this._camera);
  },
  /* Where an element's centre is, as a world point the scene can fly to. */
  elementWorldPos(sel) {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    if (!b.width && !b.height) return null;
    return this.viewportToWorld(b.left + b.width / 2, b.top + b.height / 2);
  },

  /* The placeholder's WORLD position, for callers that need to project it themselves. */
  slotWorldPos3(slot) { return Shoe3D.slotWorldPos(slot); },

  /* Screen position of a tile, for DOM overlays (floating rewards, tile labels). */
  screenPosOf(i, lift = 0) {
    if (!this.available) return null;
    const w = this._tileWorld(i);
    const v = new THREE.Vector3(w.x, w.y + lift, w.z).project(this._camera);
    const rect = this._renderer.domElement.getBoundingClientRect();
    const host = this._host.getBoundingClientRect();
    return {
      x: (v.x * 0.5 + 0.5) * rect.width + (rect.left - host.left),
      y: (-v.y * 0.5 + 0.5) * rect.height + (rect.top - host.top),
    };
  },

  /* ---------------- loop ----------------
     tick() is one frame of work, split out so it can be driven manually — rAF is suspended
     in background tabs, so tests (and headless checks) can step the animation themselves. */
  tick() {
    if (this._token) {
      const p = this._token.position;
      if (this._hopT < 1) {
        /* one hop per step: ease across and arc upward, matching the CSS keyframe it replaces */
        this._hopT = Math.min(1, this._hopT + 0.18);
        p.lerp(this._tokenTarget, 0.45);
        p.y = TILE_H + Math.sin(this._hopT * Math.PI) * 0.45;
      } else {
        p.lerp(this._tokenTarget, 0.35);
        p.y = TILE_H;
      }
    }
    /* The board's own tweens (the box throw). Stepped before the camera so a zoom change lands
       in the same frame it was asked for rather than one late. */
    this._stepAnims(1000 / 60);
    this._tickBoxes(performance.now());
    this._tickChest(performance.now());
    /* The cast keeps walking through a box throw, unlike the boxes' own idle tick: nothing here
       shares an object with the board's tweens, and a world that freezes whenever something else
       is happening reads worse than one that carries on. */
    NPC3D.tick(1000 / 60);
    if (this._zoom !== this._zoomShown) this._applyFrustum();
    this._followCamera();
    Env3D.tick(1 / 60);
    Shoe3D.tick();
    this._renderer.render(this._scene, this._camera);
    if (window.syncBoardLabels) window.syncBoardLabels();
  },

  /* Move the camera toward the token, one frame's worth.

     It aims at the token's own position rather than its tile centre, so the camera drifts
     during the hop instead of stepping tile to tile. The catch-up is exponential and framed
     as a time constant: cfg.camFollowMs is roughly how long it takes to close the distance,
     independent of frame rate, so the feel doesn't change on a 120Hz display.

     The camera trails on purpose. Locking it to the token would pin the piece dead centre
     and slide the whole world underneath it, which reads as the board moving rather than
     the player — the lag is what makes a hop look like travel. */
  /* Drag the ground to pan the view.

     Screen pixels map to world distance differently on the two axes: the camera looks down
     at 38°, so a vertical drag covers 1/sin(38°) ≈ 1.6x more ground than the same drag
     sideways. Panning with one scale for both makes the world feel like it slides out from
     under the cursor. So horizontal uses the camera's own right vector, vertical uses the
     ground direction that reads as "up screen", divided by sin(elevation).

     The grabbed point stays under the pointer as a result, which is the whole trick — the
     view feels dragged rather than nudged. */
  /* Which ticket placeholder is under a screen point, or null.

     Sprites, so a plain Raycaster works — but the row is drawn with depthWrite off and sits
     over the board, and three.js reports sprite hits in camera order, so the nearest hit is the
     one the player believes they touched. */
  slotAt(clientX, clientY) {
    if (!this.available) return null;
    const r = this._renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1);
    if (!this._ray) this._ray = new THREE.Raycaster();
    this._ray.setFromCamera(ndc, this._camera);
    /* The row is rebuilt whenever a ticket lands, and a fresh sprite's world matrix is stale
       until the next render — so a tap in the frame right after a ticket arrives would miss
       every placeholder. Update before testing rather than trusting the render loop to have
       got there first. */
    const sprites = Shoe3D.slotSprites();
    sprites.forEach(s => s.updateMatrixWorld());
    const hits = this._ray.intersectObjects(sprites, false);
    /* Slot 0 is a legitimate answer and is falsy — every caller must test against null. */
    return hits.length ? hits[0].object.userData.slot : null;
  },

  _initDrag(canvas) {
    const el = THREE.MathUtils.degToRad(ENV_CAM.el);
    const right = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      /* Remember where the press started so pointerup can tell a TAP from a PAN. Without this
         every attempt to tap a placeholder that moved the cursor a pixel would pan instead. */
      this._press = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
      if (!cfg.camDrag) return;          // picking still works; only panning is off
      this._drag = { x: e.clientX, y: e.clientY };
      this._camManual = true;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this._drag) return;
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      this._drag.x = e.clientX; this._drag.y = e.clientY;
      if (this._press) this._press.moved += Math.abs(dx) + Math.abs(dy);

      const c = this._camera, r = canvas.getBoundingClientRect();
      const wppX = (c.right - c.left) / r.width;      // world units per screen pixel
      const wppY = (c.top - c.bottom) / r.height;
      right.setFromMatrixColumn(c.matrix, 0).setY(0).normalize();
      fwd.copy(up).cross(right).normalize();          // ground axis that points up-screen

      /* The world moves with the cursor, so the camera target moves against it. The two axes
         take opposite signs because screen Y grows downward while the projection's Y grows
         up — get this wrong and horizontal drags feel right while vertical ones invert. */
      this._camWant
        .addScaledVector(right, -dx * wppX)
        .addScaledVector(fwd, dy * wppY / Math.sin(el));

      this._clampPan(this._camWant);
      this._camWant.y = 0;
    });
    const end = (e) => {
      /* RELEASE THE DRAG FIRST, ALWAYS. The tap-pick below runs game code — a raycast, then
         whatever onSlotTap opens — and if any of it throws before the drag is cleared the board
         is left believing the button is still down: every later mouse move pans the camera, with
         no way out short of a reload. That is exactly what happened when slotSprites() went
         missing. Panning is the essential half of this handler and picking is the optional half,
         so the essential half cannot sit downstream of the optional one.

         Same shape as pull()'s try/finally, and for the same reason. */
      const p = this._press; this._press = null;
      if (this._drag) {
        this._drag = null;
        canvas.style.cursor = "grab";
        if (e.pointerId != null && canvas.hasPointerCapture?.(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      }
      /* A tap, not a pan: under a few pixels of travel. Outside the cfg.camDrag guard, so
         picking still works with panning turned off. */
      if (!(p && p.moved < 6 && e.clientX != null && window.onSlotTap)) return;
      try {
        const slot = this.slotAt(e.clientX, e.clientY);
        if (slot != null) window.onSlotTap(slot);
      } catch (err) {
        console.error("slot pick failed:", err);
      }
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  },

  /* Pull the aim inward, toward the middle of the board.

     Centring on the token wastes the frame whenever the token is near an outer edge — half
     the screen becomes sea. Aiming at a point part-way between the token and the board's
     centre spends that frame on board instead, and the token simply sits off-centre. It does
     not need to be centred.

     This is a bias, not a clamp. Clamping the frame inside the board square was the first
     attempt and it fails on this board: the ring is hollow, so "fit the frame inside the
     board" resolves to "sit on the empty middle", and at any zoom where the whole board fits
     the camera stops moving altogether. A bias always tracks the token, and camBias alone
     decides how much board versus environment you get.

       0    aim straight at the token (all follow, sea at the edges)
       0.5  half way to the middle
       1    always the board centre (no follow at all) */
  _biasToCentre(v) {
    const b = Math.min(1, Math.max(0, cfg.camBias ?? 0));
    v.multiplyScalar(1 - b);            // board centre is the world origin
  },

  /* Pull the aim back until the token is actually on screen.

     camBias alone is projection-blind, and the projection is not symmetric. The world
     diagonals that form the diamond's LEFT and RIGHT vertices lie across the camera azimuth,
     so they project to screen-horizontal at full scale; the TOP and BOTTOM ones lie along it
     and are squashed by sin(38°). The same bias therefore pushes the token clean off the side
     of the frame at the left and right corners while looking fine at the top and bottom.

     So the offset is measured in the camera's own basis and any excess is given back.
     camTokenInset is how much of the half-frame the token may use: 1 lets it reach the very
     edge, lower values hold it further in. */
  _keepTokenInFrame(v) {
    if (!this._token) return;
    const c = this._camera, el = THREE.MathUtils.degToRad(ENV_CAM.el);
    const right = new THREE.Vector3().setFromMatrixColumn(c.matrix, 0).setY(0).normalize();
    const fwd = new THREE.Vector3(0, 1, 0).cross(right).normalize();
    const d = new THREE.Vector3(this._token.position.x - v.x, 0, this._token.position.z - v.z);

    const inset = Math.min(1, Math.max(0.1, cfg.camTokenInset ?? 0.7));
    const limX = (c.right - c.left) / 2 * inset;
    const limY = (c.top - c.bottom) / 2 * inset;

    const dr = d.dot(right);                 // already in camera-horizontal units
    const df = d.dot(fwd) * Math.sin(el);    // ground distance -> camera-vertical units
    if (Math.abs(dr) > limX) v.addScaledVector(right, dr - Math.sign(dr) * limX);
    if (Math.abs(df) > limY) {
      v.addScaledVector(fwd, (df - Math.sign(df) * limY) / Math.sin(el));
    }
  },

  /* A loose bound so a drag can't lose the board off-screen entirely. */
  _clampPan(v) {
    const lim = EXTENT / 2 + (cfg.camEdgePad ?? 0.5);
    v.x = Math.max(-lim, Math.min(lim, v.x));
    v.z = Math.max(-lim, Math.min(lim, v.z));
  },

  /* Advance the board's tweens by one frame. Iterated backwards so an `end` callback that queues
     the next phase (which the throw does at every step) can push onto the list mid-iteration. */
  _stepAnims(ms) {
    for (let n = this._anims.length - 1; n >= 0; n--) {
      const a = this._anims[n];
      a.t += ms;
      if (a.t < 0) continue;                      // still in its stagger delay
      const k = Math.min(1, a.t / a.dur);
      a.step && a.step(k);
      if (k >= 1) { this._anims.splice(n, 1); a.end && a.end(); }
    }
  },

  _followCamera() {
    if (this._camManual) {
      /* left where the player put it — _camWant is already the dragged position */
    } else if (!cfg.camFollow) {
      this._camWant.set(0, 0, 0);
    } else if (this._token) {
      this._camWant.set(this._token.position.x, 0, this._token.position.z);
      this._biasToCentre(this._camWant);
      this._keepTokenInFrame(this._camWant);
    }
    const ms = Math.max(16, cfg.camFollowMs || 450);
    const k = 1 - Math.exp(-(1000 / 60) / ms * 3);   // ~95% closed after camFollowMs
    this._camTarget.lerp(this._camWant, k);
    this._camAim.copy(this._camTarget).add(this._camOffset);
    this._camera.position.copy(this._camAim);
    this._camera.lookAt(this._camTarget);
  },

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    this.tick();
  },
};

window.Board3D = Board3D;

/* The module runs after every classic script, so this is where the app actually starts. */
const host = document.getElementById("boardHost");
if (host) Board3D.init(host);
Board3D.ready = true;
if (!window.__booted && typeof window.boot === "function") {
  window.__booted = true;
  window.boot();
}
