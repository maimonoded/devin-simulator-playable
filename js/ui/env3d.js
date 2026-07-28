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

/* assets/env/scene.js declares `const ENV_SCENE`, and a top-level const in a classic script
   is a global *lexical* binding — visible to this module by name, but never a property of
   window. So `window.ENV_SCENE` is always undefined and this has to read the name directly,
   guarded for the case where the manifest file is absent. */
const envScene = () => (typeof ENV_SCENE === "undefined" ? null : ENV_SCENE);

const C = {
  sea:      0x1d4f8f,
  seaShelf: 0x17427c,
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
    this._buildProps();
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

  /* Radial water texture: solid around the island, gone by the frame edge. Drawn to a
     canvas rather than shipped as a PNG — it is four stops of a gradient, and a file would
     be one more thing to keep in step with the palette. */
  _seaFade() {
    const N = 256, cv = document.createElement("canvas");
    cv.width = cv.height = N;
    const g = cv.getContext("2d").createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    const hex = "#" + C.sea.toString(16).padStart(6, "0");
    /* Stops are fractions of the plane's half-width (ENV_SIZE.sea = 24 tiles). The island's
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
    const { plinth, island, sea } = ENV_SIZE;
    const Y = ENV_Y;
    const on = Object.assign({ sea: true, shelf: true, island: true, plinth: true },
                             envScene()?.terrain);

    /* Sea. One plane, wider than the frame at any aspect, so the board is in a place rather
       than on a tray. It only receives shadow — a shadow-casting water plane would shadow a
       seabed nobody can see.

       It fades out radially instead of ending on an edge. A flat plane that reaches the
       frame boundary paints the whole stage one colour and flattens the panel's own vignette;
       fading to transparent lets the page background come back at the rim, so the water reads
       as water near the island and as backdrop at the edges. Fog would do this too, but fog
       is depth-based and the camera looks along a diagonal — it would darken the far corner
       and leave the near one bright. */
    if (on.sea) {
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(sea * 2, sea * 2),
        new THREE.MeshLambertMaterial({ map: this._seaFade(), transparent: true }),
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
        new THREE.MeshLambertMaterial({ color: C.seaShelf }),
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

  /* ---------------- props ----------------
     Same contract as a tile model (assets/tiles/README.md), with one difference: a tile is
     forced to 1×1 because every tile is one tile, whereas an env piece declares its own
     width in the manifest. Everything else — any export scale, any origin, base dropped
     onto its datum — works the same way. */
  _buildProps() {
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
        gltf => this._placeProp(gltf.scene, p, piece),
        undefined,
        () => console.warn(`env: missing assets/env/models/${piece.model}.glb`),
      );
    });
  },

  /* The model-space height that gets aligned to the piece's datum — see envPlace().
     "surface" casts a ray straight down through the model's own centre and takes the first
     thing it hits, which on a walled plaza is the plaza. Falls back to the top if the ray
     misses, which it does on a piece with a hole through the middle. */
  _anchorY(model, p, box) {
    if (p.anchor === "top") return box.max.y;
    if (p.anchor !== "surface") return box.min.y;
    const ray = new THREE.Raycaster(
      new THREE.Vector3(p.x, box.max.y + 1, p.z),
      new THREE.Vector3(0, -1, 0),
      0, (box.max.y - box.min.y) + 2,
    );
    const hit = ray.intersectObject(model, true)[0];
    return hit ? hit.point.y : box.max.y;
  },

  /* Width of the flat surface on top of a piece, in its current scale.

     Bounding-box width is the obvious way to size a piece and it is wrong for anything the
     board stands on: the first island generated came back with a staircase jutting off one
     side, which owned half the bounding box, so fitting the box to 15 tiles left a plaza of
     7 — a board of 11 sat outside its own walls. What matters is the deck, so measure the
     deck: find its height above the centre, then walk outward until the surface steps away
     from it. Both axes, averaged, because a generated square is never quite square. */
  _surfaceSpan(model, box) {
    const c = box.getCenter(new THREE.Vector3());
    const cast = (x, z) => {
      const r = new THREE.Raycaster(new THREE.Vector3(x, box.max.y + 1, z),
                                    new THREE.Vector3(0, -1, 0),
                                    0, (box.max.y - box.min.y) + 2);
      return r.intersectObject(model, true)[0]?.point.y ?? null;
    };
    const y0 = cast(c.x, c.z);
    if (y0 === null) return box.getSize(new THREE.Vector3()).x;

    const reach = box.getSize(new THREE.Vector3()).x;
    const step = reach / 120, tol = reach * 0.02;
    const walk = (dx, dz) => {
      let d = 0;
      for (let i = 1; i <= 120; i++) {
        const y = cast(c.x + dx * step * i, c.z + dz * step * i);
        if (y === null || Math.abs(y - y0) > tol) break;
        d = step * i;
      }
      return d;
    };
    const x = walk(1, 0) + walk(-1, 0), z = walk(0, 1) + walk(0, -1);
    return (x + z) / 2 || box.getSize(new THREE.Vector3()).x;
  },

  _placeProp(model, p, piece) {
    if (!this._root) return;                       // env was switched off while loading

    /* Yaw first, then measure: `size` means the width the piece ends up with on the board,
       which is the only thing a manifest author can reason about. Measuring in the model's
       own frame instead would make `size` mean something different for every yaw. */
    model.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), p.yaw);
    model.updateMatrixWorld(true);

    let box = new THREE.Box3().setFromObject(model);
    const span = p.fit === "surface" ? this._surfaceSpan(model, box)
                                     : box.getSize(new THREE.Vector3()).x;
    model.scale.multiplyScalar(p.size / (span || 1));
    model.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(model);
    const centre = box.getCenter(new THREE.Vector3());
    model.position.x += p.x - centre.x;
    model.position.z += p.z - centre.z;
    /* XZ first, then update, then the height — the "surface" anchor casts a ray at the
       piece's final x/z, so the matrices have to already reflect that move. */
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    model.position.y += p.y - this._anchorY(model, p, box);
    model.updateMatrixWorld(true);

    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this._root.add(model);

    /* The height budget can only be checked once the mesh is here, and it is the rule
       pieces actually break — so report it against what was really delivered. */
    const top = new THREE.Box3().setFromObject(model).max.y;
    if (top > p.maxTop + 0.01) {
      console.warn(`env: "${piece.model}" reaches y=${top.toFixed(2)} at (${p.x}, ${p.z}); ` +
                   `the sight line there allows ${p.maxTop.toFixed(2)} — it will hide the board`);
    }
  },

  /* Top-down is a diagnostic view. The terrain is symmetrical so it survives it; anything
     authored for the fixed camera (the backdrop, when it exists) hides here. */
  setFlat(flat) {
    this._flat = flat;
  },

  tick(dt) {
    this._t += dt;
  },
};

window.Env3D = Env3D;
