/* The world around the board.

   Imported by js/ui/board3d.js — deliberately not a second <script type="module"> tag, so
   there is still exactly one module entry point and the classic-script load order in
   index.html stays the dependency order.

   Everything geometric comes from js/env-model.js (a classic script, so its globals are
   already defined by the time any module runs). This file only turns those numbers into
   three.js objects. Two halves:

     - the terrain: plinth, island, sea. Procedural, exact, and the thing the board
       physically sits on — it has to line up with the ring to a fraction of a tile, which
       is not something a generated mesh can promise.
     - the props: GLB pieces placed by assets/env/scene.js. Normalized on load exactly the
       way tiles are, except the size comes from the manifest instead of being forced to 1×1.

   The whole thing hangs off one group, so cfg.env3d can add and remove it live. */

import * as THREE from "../../vendor/three.module.js";
import { GLTFLoader } from "../../vendor/loaders/GLTFLoader.js";

/* envScene() lives in js/env-model.js and picks the manifest entry cfg.envScene names.
   Note it is reached by bare name, not through window: assets/env/scene.js declares a
   top-level `const`, which is a global *lexical* binding — visible to this module, but
   never a property of window. */

const C = {
  ground:   0x1d4f8f,          // harbour blue; assets/env/scene.js overrides per environment
  shelf:    0x17427c,
  cliff:    0x1b2048,
  quay:     0x2b3268,
  quayLip:  0x3c4489,
  plinth:   0x232a63,
  plinthLip:0x4a3f7d,
};

export const Env3D = {
  _scene: null, _root: null, _gltf: null, _t: 0, _sea: null,

  init(scene) {
    this._scene = scene;
    this.rebuild();
  },

  /* Torn down and rebuilt wholesale — it is a few dozen objects, and being able to toggle
     cfg.env3d in the tuning drawer without a reload is worth more than the milliseconds. */
  rebuild() {
    if (this._root) {
      this._scene.remove(this._root);
      this._root.traverse(o => { o.geometry?.dispose?.(); });
      this._root = null;
      this._sea = null;
    }
    if (!cfg.env3d) return;

    this._root = new THREE.Group();
    this._scene.add(this._root);
    this._buildTerrain();
    this._buildPieces();
  },

  /* ---------------- terrain ----------------
     Squares, not boxes: a 4-sided CylinderGeometry is a square frustum, which gives the
     island sloping sides for free. Its "radius" is the circumradius, hence the √2, and it
     needs a 45° yaw to put its faces on the world axes rather than its corners. */
  _square(rTop, rBot, h, y, color, flatShade) {
    const geo = new THREE.CylinderGeometry(rTop * Math.SQRT2, rBot * Math.SQRT2, h, 4, 1);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, flatShading: !!flatShade }));
    mesh.rotation.y = Math.PI / 4;
    mesh.position.y = y;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this._root.add(mesh);
    return mesh;
  },

  /* Radial ground texture: solid around the deck, gone by the frame edge. Drawn to a canvas
     rather than shipped as a PNG — it is four stops of a gradient, and a file would be one
     more thing to keep in step with the palette. */
  _groundFade(color) {
    const N = 256, cv = document.createElement("canvas");
    cv.width = cv.height = N;
    const g = cv.getContext("2d").createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    const hex = "#" + color.toString(16).padStart(6, "0");
    /* Stops are fractions of the plane's half-width (ENV_SIZE.ground = 24 tiles). The deck's
       corners reach 11.5, and the frame runs out at about 19 — so hold the water solid past
       the island and have it gone by the time the frame ends. */
    g.addColorStop(0.00, hex);
    g.addColorStop(0.40, hex);
    g.addColorStop(0.56, hex + "99");
    g.addColorStop(0.70, hex + "00");
    const ctx = cv.getContext("2d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, N, N);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  },

  /* The procedural terrain is the default AND the fallback. A manifest that ships a modelled
     island turns off the parts it replaces — the sea stays, because a plane that reaches the
     frame edge at every aspect is not something a generated mesh can be asked for. */
  _buildTerrain() {
    const { plinth, island, ground } = ENV_SIZE;
    const Y = ENV_Y;
    const on = Object.assign({ ground: true, shelf: true, island: true, plinth: true },
                             envScene()?.terrain);
    /* The colour is manifest data, not code: an environment that is not a harbour has to be
       able to say so without anyone editing this file. */
    const groundColor = on.groundColor ?? C.ground;

    /* Ground. One plane, wider than the frame at any aspect, so the board is in a place
       rather than on a tray. It only receives shadow — a shadow-casting ground plane would
       shadow a seabed nobody can see.

       It fades out radially instead of ending on an edge. A flat plane that reaches the
       frame boundary paints the whole stage one colour and flattens the panel's own vignette;
       fading to transparent lets the page background come back at the rim, so the water reads
       as water near the island and as backdrop at the edges. Fog would do this too, but fog
       is depth-based and the camera looks along a diagonal — it would darken the far corner
       and leave the near one bright. */
    if (on.ground) {
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(ground * 2, ground * 2),
        new THREE.MeshLambertMaterial({ map: this._groundFade(groundColor), transparent: true }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = Y.water;
      water.receiveShadow = true;
      this._root.add(water);
      this._sea = water;
    }

    /* A lighter shelf just under the shoreline so the island doesn't meet the sea on a
       hard line — cheaper and steadier than any shader. */
    if (on.shelf) {
      const shelf = new THREE.Mesh(
        new THREE.PlaneGeometry((island + 2.6) * 2, (island + 2.6) * 2),
        new THREE.MeshLambertMaterial({ color: C.shelf }),
      );
      shelf.rotation.x = -Math.PI / 2;
      shelf.position.y = Y.water + 0.02;
      this._root.add(shelf);
    }

    /* Island: a tapered block from the keel up to the quay, then a thin lip at the
       waterline so the shore reads as a sea wall rather than a chamfer. */
    if (on.island) {
      this._square(island, island - 1.9, Y.quay - Y.keel, (Y.quay + Y.keel) / 2, C.cliff, true);
      this._square(island + 0.12, island + 0.12, 0.14, Y.quay - 0.07, C.quayLip);
      this._square(island, island, 0.10, Y.quay - 0.05, C.quay);
    }

    /* Plinth: the board's platform. Straight-sided, because the board's own edge is
       straight and a taper here would fight it. */
    if (on.plinth) {
      this._square(plinth, plinth, Y.deck - Y.quay, (Y.deck + Y.quay) / 2, C.plinth);
      this._square(plinth + 0.16, plinth + 0.16, 0.16, Y.deck - 0.08, C.plinthLip);
    }
  },

  /* ---------------- pieces ----------------
     Placement is scale, turn, drop — and nothing else.

     Every environment GLB is conformed by tools/normalize-env.py before it ships, so its
     deck (or its footprint, for a prop) is already 1 unit, already axis-aligned, already
     centred on the origin, and already sitting at y = 0. See envPlace() in js/env-model.js
     for why the measuring that used to live here is gone. */
  _buildPieces() {
    const pieces = envExpand(envScene()?.pieces);
    if (!pieces.length) return;
    if (!this._gltf) this._gltf = new GLTFLoader();

    pieces.forEach(piece => {
      const p = envPlace(piece);
      if (p.problems.length) {
        console.warn(`env: "${piece.model}" — ${p.problems.join("; ")}`);
        if (!piece.model) return;
      }
      this._gltf.load(
        `assets/env/models/${piece.model}.glb`,
        gltf => this._place(gltf.scene, p, piece),
        undefined,
        () => console.warn(`env: missing assets/env/models/${piece.model}.glb`),
      );
    });
  },

  _place(model, p, piece) {
    if (!this._root) return;                       // env was switched off while loading

    model.scale.setScalar(p.scale);
    model.rotation.y = p.yaw;
    model.position.set(p.x, p.y, p.z);
    model.updateMatrixWorld(true);

    model.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    this._root.add(model);

    if (p.isDeck) this._checkDeck(model, p, piece);
    else this._checkHeight(model, p, piece);
  },

  /* Does the board actually land on the deck?

     This is the safety net that makes swapping environments unattended reasonable. A file
     that does not meet the contract — wrong scale, a deck that is not square, a rotation
     that puts the corners over the edge — is not something the engine should quietly paper
     over, but it is something it can notice. Ray down at the ring's outer corners and edge
     midpoints; each has to land on the deck at the datum. */
  _checkDeck(model, p, piece) {
    const half = ENV_BOARD / 2, ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const bad = [];
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      /* Corners at ±half, edge midpoints at half — the same square the tiles occupy. */
      const k = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      const x = p.x + Math.cos(a) * half * k, z = p.z + Math.sin(a) * half * k;
      ray.set(new THREE.Vector3(x, p.y + 20, z), down);
      ray.far = 60;
      const hit = ray.intersectObject(model, true)[0];
      if (!hit || Math.abs(hit.point.y - p.y) > 0.05) {
        bad.push(`(${x.toFixed(1)}, ${z.toFixed(1)})` +
                 (hit ? ` is ${(hit.point.y - p.y).toFixed(2)} off` : " has no deck under it"));
      }
    }
    if (bad.length) {
      console.warn(`env: "${piece.model}" does not carry the board — ${bad.join(", ")}. ` +
                   `Re-run tools/normalize-env.py --deck on the raw file.`);
    }
  },

  /* The sight-line budget, checked against what was really delivered rather than what the
     manifest asked for — it is the rule pieces actually break. */
  _checkHeight(model, p, piece) {
    const top = new THREE.Box3().setFromObject(model).max.y;
    if (top > p.maxTop + 0.01) {
      console.warn(`env: "${piece.model}" reaches y=${top.toFixed(2)} at (${p.x}, ${p.z}); ` +
                   `the sight line there allows ${p.maxTop.toFixed(2)} — it will hide the board`);
    }
  },

  tick(dt) {
    this._t += dt;
  },
};

window.Env3D = Env3D;
