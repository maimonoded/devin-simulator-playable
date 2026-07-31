/* The builders view — the buildings, in their own 3D scene.

   They used to be a row of thin towers in the middle of the board, which is a bad place for
   them: the board's middle is where the dice land and where reveals play, and at twelve
   builders each tower was 0.02 units wide and told you nothing. They now get a screen of
   their own, showing cfg.builderPageSize of them at a time.

   ONE RENDERER, TWO SCENES. This module owns a scene and a camera but never draws: js/ui/board3d.js
   renders whichever of the two is active into the single canvas. A second WebGLRenderer would
   mean a second GL context, and browsers cap those — losing one silently kills the board.

   The camera copies the board's azimuth and elevation (ENV_CAM), so a building looks like it
   belongs to the same world as the tiles rather than to a separate app.

   Geometry is procedural on purpose. A building is a stack of storeys, one per level bought,
   so "how far along is this" is legible at a glance and at any tier count — no art needs to
   exist per level, and dropping real models in later only changes _buildOne(). */

import * as THREE from "../../vendor/three.module.js";

const C = {
  plot:     0x2b3268,
  plotLip:  0x3c4489,
  storey:   0x8b6dff,
  storeyAlt:0x7a5cf0,
  done:     0xffcb5c,
  doneAlt:  0xe6b348,
  ground:   0x1b2048,
};

const PLOT = 1.6;        // footprint of one building's plot, world units
const GAP  = 0.55;       // space between plots
const STOREY_H = 0.42;   // height of one level's block
/* The camera sits at 45° azimuth, so a row laid along world X projects as a DIAGONAL across
   the screen. Turning the row a quarter-turn about Y cancels that and it reads as a straight
   line left-to-right — the same correction the old board-centre skyline needed. */
const ROW_YAW = Math.PI / 4;

export const Builders3D = {
  _scene: null, _camera: null, _root: null,
  _plots: [],            // one { group, storeys[], crown } per slot on the page
  _built: 0,             // how many slots the current meshes were built for
  _t: 0,

  init() {
    this._scene = new THREE.Scene();

    /* Orthographic, and aimed exactly like the board camera. The board reads as isometric
       because of this pair of angles; a perspective camera here would make the two screens
       feel like different games. */
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const az = THREE.MathUtils.degToRad(ENV_CAM.az), el = THREE.MathUtils.degToRad(ENV_CAM.el);
    this._camera.position.set(
      Math.cos(el) * Math.sin(az) * 40,
      Math.sin(el) * 40,
      Math.cos(el) * Math.cos(az) * 40,
    );
    this._camera.lookAt(0, 0, 0);

    this._scene.add(new THREE.AmbientLight(0xffffff, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(8, 16, 10);
    this._scene.add(key);
    const rim = new THREE.DirectionalLight(0x8b6dff, 0.6);
    rim.position.set(-8, 5, -6);
    this._scene.add(rim);

    this._root = new THREE.Group();
    this._root.rotation.y = ROW_YAW;   // straight on screen from the moment it is built
    this._scene.add(this._root);
    return this;
  },

  scene() { return this._scene; },
  camera() { return this._camera; },

  /* ---------------- geometry ---------------- */

  /* One plot: a pad, a lip, and an empty stack of storeys sized to cfg.tiers. Every storey
     mesh exists from the start and is hidden until bought — growing the stack by toggling
     visibility keeps upgrades instant, where rebuilding the mesh would stutter mid-animation. */
  _buildOne(x) {
    const g = new THREE.Group();
    g.position.x = x;

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(PLOT, 0.18, PLOT),
      new THREE.MeshLambertMaterial({ color: C.plot }),
    );
    pad.position.y = 0.09;
    pad.receiveShadow = true;
    g.add(pad);

    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(PLOT * 1.06, 0.06, PLOT * 1.06),
      new THREE.MeshLambertMaterial({ color: C.plotLip }),
    );
    lip.position.y = 0.03;
    g.add(lip);

    const storeys = [];
    const tiers = Math.max(1, Builders.maxTier());
    for (let t = 0; t < tiers; t++) {
      /* Each storey is a little narrower than the one below, so a finished building tapers
         instead of reading as one flat slab. */
      const k = PLOT * (0.78 - t * 0.055);
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(k, STOREY_H, k),
        new THREE.MeshLambertMaterial({ color: t % 2 ? C.storeyAlt : C.storey }),
      );
      m.position.y = 0.18 + STOREY_H * (t + 0.5);
      m.castShadow = true;
      m.visible = false;
      g.add(m);
      storeys.push(m);
    }
    return { group: g, storeys };
  },

  /* Rebuild the row for the page's slot count. Cheap, and only runs when the count changes
     (a page turn, a series change, or cfg.tiers being edited in the drawer). */
  build() {
    const slots = Builders.pageBuilders().length || 1;
    const tiers = Math.max(1, Builders.maxTier());
    if (this._built === slots && this._plots[0] && this._plots[0].storeys.length === tiers) {
      this.update();
      return;
    }
    this._plots.forEach(p => this._root.remove(p.group));
    this._plots = [];

    const step = PLOT + GAP;
    const span = slots * step;
    for (let i = 0; i < slots; i++) {
      const p = this._buildOne(-span / 2 + (i + 0.5) * step);
      this._root.add(p.group);
      this._plots.push(p);
    }
    this._built = slots;

    /* A ground slab under the row, wide enough that the plots never appear to float. It is
       only as deep as the plots so the camera's 38° tilt still shows its front face. */
    if (this._ground) this._root.remove(this._ground);
    this._ground = new THREE.Mesh(
      new THREE.BoxGeometry(span + 1.6, 0.5, PLOT + 1.6),
      new THREE.MeshLambertMaterial({ color: C.ground }),
    );
    this._ground.position.y = -0.25;
    this._ground.receiveShadow = true;
    this._root.add(this._ground);

    this.update();
  },

  /* Height and colour from state. Called after every upgrade. */
  update() {
    const page = Builders.pageBuilders();
    this._plots.forEach((p, slot) => {
      const bIdx = page[slot];
      const has = bIdx !== undefined;
      p.group.visible = has;
      if (!has) return;
      const tier = Builders.tier(bIdx);
      const done = Builders.isMaxed(bIdx);
      p.storeys.forEach((m, t) => {
        m.visible = t < tier;
        m.material.color.setHex(done ? (t % 2 ? C.doneAlt : C.done) : (t % 2 ? C.storeyAlt : C.storey));
      });
    });
  },

  /* Fit the row to the canvas. Same trick as the board: an orthographic frustum sized to the
     content, then widened for whichever axis the window is short of. */
  resize(w, h) {
    if (!this._camera || !w || !h) return;
    const aspect = w / h;
    const slots = Math.max(1, this._built);
    /* Half-width of the row plus a margin, and a half-height that leaves room for a fully
       grown building plus the button row the DOM draws over the bottom of this view. */
    const halfW = (slots * (PLOT + GAP)) / 2 + 0.9;
    const halfH = 0.18 + STOREY_H * Math.max(1, Builders.maxTier()) + 1.6;
    const fit = Math.max(halfH, halfW / aspect);
    this._camera.left = -fit * aspect;
    this._camera.right = fit * aspect;
    this._camera.top = fit;
    this._camera.bottom = -fit;
    /* Nudge the aim down so the row sits above the button row rather than behind it. */
    this._camera.updateProjectionMatrix();
  },

  /* A slow drift so the screen is not dead still. Deliberately tiny — this is a menu, and
     anything livelier fights the numbers the player is reading. */
  tick(dt) {
    this._t += dt || 0;
    // drift AROUND the row's fixed quarter-turn, never replacing it
    if (this._root) this._root.rotation.y = ROW_YAW + Math.sin(this._t * 0.25) * 0.045;
  },
};

window.Builders3D = Builders3D;
