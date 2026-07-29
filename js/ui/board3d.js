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

const N = 11;                    // grid is 11x11, tiles around the ring
const TILE = 1;                  // one tile = one world unit
/* 0 = tiles butt exactly, so flush full-bleed tile art forms one continuous floor.
   The gap existed for the plain placeholder slabs, which needed it to read as separate tiles. */
const GAP = 0;
const TILE_H = 0.16;             // tile slab thickness
const EXTENT = N * TILE;         // board footprint
/* The player piece. Absent file = the placeholder disc stays, so this is safe to remove. */
const TOKEN_MODEL = "assets/token/token.glb";

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

const Board3D = {
  available: false,
  ready: false,

  _renderer: null, _scene: null, _camera: null, _host: null,
  _tiles: [], _token: null, _towers: [], _boxes: new Map(), _models: new Map(), _gltf: null,
  _flat: false, _raf: 0,
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
       genuinely different numbers rather than one scaled by aspect. */
    const want = cfg.phoneView ? cfg.camZoomPhone : cfg.camZoom;
    const zoom = follow ? Math.min(1, Math.max(0.05, want || 1)) : 1;
    const halfW = (EXTENT * Math.SQRT2 / 2) * (follow ? zoom : envMargin());
    const halfH = halfW * Math.sin(THREE.MathUtils.degToRad(ENV_CAM.el));
    const fit = Math.max(halfH, halfW / aspect);
    this._camera.left = -fit * aspect;
    this._camera.right = fit * aspect;
    this._camera.top = fit;
    this._camera.bottom = -fit;
    this._camera.updateProjectionMatrix();
    if (window.syncBoardLabels) window.syncBoardLabels();
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
    this._buildTowers();
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

  _buildTowers() {
    if (this._towerGroup) this._scene.remove(this._towerGroup);
    this._towers = [];
    /* The row is laid along world X, then the whole group is turned 45° about Y so it reads
       as a straight line across the board from the camera's 45° viewpoint — otherwise the
       skyline runs diagonally across the ring. */
    const group = new THREE.Group();
    group.rotation.y = Math.PI / 4;
    const n = Builders.count();
    const span = 6.4, w = Math.min(0.6, (span / n) * 0.72);
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, 1, w),
        new THREE.MeshLambertMaterial({ color: COLORS.tower }),
      );
      mesh.position.set(-span / 2 + (i + 0.5) * (span / n), 0, 0);
      mesh.castShadow = true;
      group.add(mesh);
      this._towers.push(mesh);
    }
    this._towerGroup = group;
    this._scene.add(group);
    this.setBuilders();
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

  setOverlays(indices) {
    if (!this.available) return;
    for (const [i, mesh] of this._boxes) {
      if (!indices.includes(i)) { this._scene.remove(mesh); this._boxes.delete(i); }
    }
    indices.forEach(i => {
      if (this._boxes.has(i)) return;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshLambertMaterial({ color: COLORS.box }),
      );
      const w = this._tileWorld(i);
      mesh.position.set(w.x, TILE_H + 0.2, w.z);
      mesh.rotation.y = Math.PI / 4;
      this._scene.add(mesh);
      this._boxes.set(i, mesh);
    });
  },

  setBuilders() {
    if (!this.available) return;
    const tiers = Builders.maxTier();
    this._towers.forEach((mesh, i) => {
      const done = Builders.isMaxed(i);
      const h = 0.25 + Builders.progress(i) * 3.2;
      mesh.scale.y = h;
      mesh.position.y = (h * 1) / 2;        // geometry is 1 tall, so scale then re-centre
      mesh.material.color.setHex(done ? COLORS.towerDone : COLORS.tower);
    });
  },

  setFlat(flat) {
    this._flat = flat;
    if (!this.available) return;
    const r = 40;
    const el = THREE.MathUtils.degToRad(flat ? 89.9 : ENV_CAM.el);
    const az = THREE.MathUtils.degToRad(flat ? 0 : ENV_CAM.az);
    this._camera.position.set(
      r * Math.cos(el) * Math.sin(az),
      r * Math.sin(el),
      r * Math.cos(el) * Math.cos(az),
    );
    this._camera.lookAt(0, 0, 0);
    Env3D.setFlat(flat);
    this.resize();
  },

  /* Live tuning-drawer edits. env3d and envMargin re-apply without a reload; envShadows does
     not, because the light and material setup is decided once in init(). */
  applyEnv() {
    if (!this.available) return;
    Env3D.rebuild();
    this.setTokenHeight();   // cfg.tokenHeight is live too, and must not reload the model
    this.resize();
  },

  /* Did tile i end up with a 3D model? render.js asks, to decide whether the tile still
     needs its emoji. */
  hasModel(i) { return this._models.has(i); },

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
    this._followCamera();
    Env3D.tick(1 / 60);
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
  _initDrag(canvas) {
    const el = THREE.MathUtils.degToRad(ENV_CAM.el);
    const right = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", (e) => {
      if (!cfg.camDrag || e.button !== 0) return;
      this._drag = { x: e.clientX, y: e.clientY };
      this._camManual = true;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this._drag) return;
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      this._drag.x = e.clientX; this._drag.y = e.clientY;

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
      if (!this._drag) return;
      this._drag = null;
      canvas.style.cursor = "grab";
      if (e.pointerId != null && canvas.hasPointerCapture?.(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
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
