/* The people on the board.

   Imported by js/ui/board3d.js, like js/ui/env3d.js and js/ui/dice3d.js and for the same reason —
   one module entry point, so the classic-script order in index.html stays the dependency order.

   These are scenery and nothing else. They own no game state, they are not persisted, they cost
   nothing to land on and the roll loop never waits for them. That is a deliberate line: everything
   the board does to the player goes through the event list (js/tiles/README.md), and a figure that
   quietly moved coins from outside it would be the one thing that could desync the economy from
   what the player was shown. If they ever earn a mechanic, it belongs in js/overlays/ with the
   mystery box, resolving before the tile it stands on.

   THE ONE RULE HERE: never touch the token, the camera or the board's tweens.

   The gold box's idle tick stands down while Board3D._anims is running, because the throw and the
   opening animate the very objects it wants to bob. Nothing here shares an object with anything
   else, so these keep walking through a box throw — which is right: the camera pulls out during
   one, and a world that freezes the moment it is looked at is worse than one that carries on. */

import * as THREE from "../../vendor/three.module.js";
import { GLTFLoader } from "../../vendor/loaders/GLTFLoader.js";

const TILE_H = 0.16;          // tile slab thickness, as in board3d.js
const TILES = 40;

/* Ease a step so a figure sets off and arrives gently instead of sliding at a constant rate.
   The same curve board3d.js uses for the camera, and for the same reason. */
const ease = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

export const NPC3D = {
  _scene: null, _group: null, _ctx: null,
  /* { id, obj, tile, t, wait, pace, yaw, natural } — one per loaded character. A character whose
     file never arrived is simply absent from this list; see _load(). */
  _walkers: [],
  _started: false,

  /* ctx supplies the board's own geometry rather than this file re-deriving it. tileWorld is
     Board3D._tileWorld, so the ring stays defined in exactly one place — the board is 40 tiles
     laid out by js/board-model.js and a second copy of that maths here would be a second thing
     to keep in step. */
  init(scene, ctx) {
    this._scene = scene;
    this._ctx = ctx;
    this._group = new THREE.Group();
    scene.add(this._group);
    this._load();
  },

  /* One load per character, at init rather than per build(): the group survives a board rebuild
     the way the dice and the token do. The token learned this the expensive way — re-fetching on
     every rebuild left a placeholder on screen for the length of the download. */
  _load() {
    if (this._started) return;
    this._started = true;
    if (typeof NPC_CAST === "undefined") return;    // manifest not loaded — no cast, no crash
    const loader = new GLTFLoader();
    NPC_CAST.forEach((c) => {
      loader.load(c.model, (gltf) => {
        const model = gltf.scene;
        /* Measure from real vertices. setFromObject without the precise flag returns the box OF a
           rotated box, which reads high and would render the figure small — the same trap the tile
           and prop loaders both document. */
        const natural = new THREE.Box3().setFromObject(model, true)
          .getSize(new THREE.Vector3()).y || 1;

        /* The figure goes inside a holder. All facing happens on the holder, so the model's own
           transform stays whatever the file shipped with and the per-character yaw offset below
           is applied exactly once. */
        const holder = new THREE.Group();
        holder.add(model);
        model.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = !!cfg.envShadows;
          if (o.material?.map) {
            o.material.map.anisotropy = this._ctx.anisotropy ? this._ctx.anisotropy() : 1;
          }
        });

        this._group.add(holder);
        this._walkers.push({
          id: c.id,
          obj: holder,
          natural,
          /* Scaled by HEIGHT, like the player piece and unlike the mystery box. A figure reads by
             how tall it stands next to a tile; the ~1.8 units these arrive at is an artefact of
             normalizing a person to a 1x1 footprint and means nothing on the board. */
          tile: ((c.start | 0) % TILES + TILES) % TILES,
          t: 0,
          /* Stagger the first step. Without it the whole cast sets off on the same frame and
             walks in formation, which reads as a mechanism rather than as people. */
          wait: Math.random() * (+cfg.npcPauseMaxMs || 0),
          pace: +c.pace > 0 ? +c.pace : 1,
          yaw: THREE.MathUtils.degToRad(+c.yaw || 0),
        });
        this._applyHeight(this._walkers[this._walkers.length - 1]);
        this._place(this._walkers[this._walkers.length - 1]);
      }, undefined, (e) => {
        /* Say so. Silence here is indistinguishable from "there is no such character", and the
           board just quietly runs one figure short for ever. */
        console.warn(`NPC3D: ${c.id} (${c.model}) failed to load — walking without them`, e);
      });
    });
  },

  /* Height in tile units, live from the drawer. Rescales what is already in the scene rather than
     reloading — this runs on every frame of a slider drag. */
  setHeight() { this._walkers.forEach(w => { this._applyHeight(w); this._place(w); }); },
  _applyHeight(w) {
    w.obj.scale.setScalar((+cfg.npcHeight || 0.75) / (w.natural || 1));
  },

  /* Where a figure stands on tile i: the board-centre side of it, not the middle.

     The middle is taken. Tile art puts its mass at the outward edge and its detail in the centre,
     the mystery box sits at the centre, and the token lands there — three things a walker would
     have to push through on a ring it laps for ever. The inner edge is the one strip of every tile
     that is reliably clear, which is what makes it read as a pavement rather than a collision. */
  _lane(i) {
    const w = this._ctx.tileWorld(i);
    /* Which edge of the ring this tile is on is just whichever of |x|/|z| is larger — the same
       test board3d.js uses to face a tile outward. Inward is the negation of that. */
    const inward = Math.abs(w.z) >= Math.abs(w.x)
      ? { x: 0, z: -Math.sign(w.z) }
      : { x: -Math.sign(w.x), z: 0 };
    const lane = +cfg.npcLane || 0;
    return { x: w.x + inward.x * lane, z: w.z + inward.z * lane };
  },

  /* Park a figure on its current tile, facing along the step it is about to take. */
  _place(w) {
    const a = this._lane(w.tile);
    w.obj.position.set(a.x, TILE_H / 2, a.z);
    this._face(w, a, this._lane((w.tile + 1) % TILES));
  },

  /* Turn a figure to walk from a to b. atan2(dx, dz) is the yaw that points a +Z-facing model
     along a direction — the same formula board3d.js uses to face a tile out of the ring — and the
     per-character offset is what makes "+Z-facing" true for a model that is not. Both are
     rotations about Y, so adding them is the whole composition. */
  _face(w, a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    if (!dx && !dz) return;
    w.obj.rotation.y = Math.atan2(dx, dz) + w.yaw;
  },

  /* One frame. dt in milliseconds, fixed by the caller so the walk is deterministic and a
     background tab does not fast-forward the cast on return. */
  tick(dt) {
    if (!this._group) return;
    const on = cfg.npcs === undefined ? true : !!cfg.npcs;
    this._group.visible = on;
    if (!on || !this._walkers.length) return;

    const step = Math.max(1, +cfg.npcStepMs || 900);
    const bob = Math.max(0, +cfg.npcBob || 0);

    for (const w of this._walkers) {
      if (w.wait > 0) { w.wait -= dt; continue; }

      w.t += dt / (step * w.pace);
      if (w.t >= 1) {
        /* Arrived. Land exactly on the tile rather than near it, then dwell — the pause is what
           stops a lap reading as a conveyor belt, and giving each figure its own random one is
           what stops the three of them syncing up over a long run. */
        w.tile = (w.tile + 1) % TILES;
        w.t = 0;
        const lo = Math.max(0, +cfg.npcPauseMinMs || 0);
        const hi = Math.max(lo, +cfg.npcPauseMaxMs || 0);
        w.wait = lo + Math.random() * (hi - lo);
        this._place(w);
        continue;
      }

      const a = this._lane(w.tile), b = this._lane((w.tile + 1) % TILES);
      const k = ease(w.t);
      w.obj.position.set(
        a.x + (b.x - a.x) * k,
        TILE_H / 2 + Math.sin(w.t * Math.PI) * bob,
        a.z + (b.z - a.z) * k,
      );
      this._face(w, a, b);
    }
  },
};
