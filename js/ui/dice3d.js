/* The dice, thrown onto the middle of the board.

   Imported by js/ui/board3d.js, like js/ui/env3d.js and for the same reason — one module
   entry point, so the classic-script order in index.html stays the dependency order.

   All the geometry that can be got wrong lives in js/dice-model.js (a classic script, so its
   globals are already defined by the time any module runs) and is tested there. This file
   only turns a pair of numbers into a throw.

   THE ONE RULE HERE: the roll must never depend on this finishing.

   js/ui/main.js awaits the throw before it moves the token, and its try/finally exists
   because a stuck roll leaves the board soft-locked with Roll disabled for ever. rAF is
   suspended in a background tab, so an animation-driven promise would simply never resolve
   if the player switched tabs mid-roll. The promise is therefore on a timer and the frame
   loop only draws: tab away and come back and the dice are sitting there showing the right
   numbers, having skipped their flight. */

import * as THREE from "../../vendor/three.module.js";
import { GLTFLoader } from "../../vendor/loaders/GLTFLoader.js";

const DIE_MODEL = "assets/dice/models/die.glb";
const BOARD_TOP = 0.16;              // tile slab thickness — dice rest on the board surface

export const Dice3D = {
  _scene: null,
  _group: null,
  _proto: null,          // the loaded GLB, cloned per die
  _dice: [],             // { obj, from:{x,z}, to:{x,z}, spin:{axis,rate}, qMid, qEnd }
  _t0: 0,
  _ms: 0,
  _pending: false,

  init(scene) {
    this._scene = scene;
    this._group = new THREE.Group();
    scene.add(this._group);
    this._load();
  },

  /* Loaded once and cloned. build() in board3d.js runs on every board rebuild, and the token
     learned this lesson the expensive way: re-fetching the model each time left a placeholder
     on screen for the length of the download. */
  _load() {
    if (this._proto || this._loading) return;
    this._loading = true;
    new GLTFLoader().load(DIE_MODEL, (gltf) => {
      this._proto = gltf.scene;
      this._loading = false;
      /* A throw that was asked for before the file arrived is still on screen as nothing at
         all — build the dice now so it appears rather than silently skipping. */
      if (this._pending) this._spawn(this._pending);
      /* The DOM pair is only hidden once these can replace them, and at boot the answer was
         "not yet". Without this the fallback dice stay up for the whole session. */
      if (window.onDiceReady) window.onDiceReady();
    }, undefined, (e) => {
      this._loading = false;
      /* Say so. Silence here is indistinguishable from "the dice never landed", and the DOM
         dice in js/ui/fx.js stay hidden either way. */
      console.warn(`Dice3D: ${DIE_MODEL} failed to load, no dice will be shown`, e);
    });
  },

  available() { return !!this._proto; },

  /* Throw `values` (one die per entry) into the middle of the CURRENT view.

     `centre` is where the camera is looking right now, passed in by board3d.js rather than
     read from it — this module is imported by board3d.js, so reaching back for it would be a
     cycle. It is sampled once, at the throw: the camera holds still while the dice are in the
     air (js/ui/main.js does not move the token until this resolves), and a landing spot that
     chased a moving camera would slide the dice across the board as they fell.

     TIMING IS A CONTRACT, not a side effect of the animation. cfg.diceRevealMs means "click to
     the result being readable on the board", so the promise resolves at exactly that mark AND
     the dice are put in their final pose at exactly that mark — settle() rather than trusting a
     frame to land on the boundary. js/ui/main.js then waits cfg.diceToMoveMs before it moves the
     token, so both drawer knobs keep meaning what they say. It also makes diceRevealMs = 0 a
     legal setting: the dice appear already landed instead of never arriving. */
  throwDice(values, centre) {
    const ms = Math.max(0, cfg.diceRevealMs || 0);
    /* Clear first and unconditionally. The previous pair is left lying on the board between
       rolls, and it has to be gone the moment this one is thrown — including when the model
       never loaded, where _spawn below won't run at all. */
    this.clear();
    this._pending = values;
    this._centre = centre || { x: 0, z: 0 };
    if (this._proto) this._spawn(values);
    this._t0 = performance.now();
    this._ms = ms;
    return new Promise(r => setTimeout(() => { this.settle(); r(); }, ms));
  },

  _spawn(values) {
    this._pending = null;
    this._group.clear();
    this._dice = [];

    const c = this._centre || { x: 0, z: 0 };
    const size = cfg.diceSize || 0.9;
    const rest = BOARD_TOP + size / 2;
    const spots = diceLanding(values.length, cfg.diceSpread || 1.5, [c.x, c.z]);
    const dist = cfg.diceThrowFrom || 4.0;

    values.forEach((value, i) => {
      const obj = this._proto.clone(true);
      obj.name = "die";                   // findable in the scene graph when checking a throw
      obj.userData.value = value;
      obj.scale.setScalar(size);          // die.glb is a unit cube centred on its origin
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = !!cfg.envShadows; } });

      /* Where it ends up: the tilt that puts `value` on top, with a quarter-turn of yaw so
         two dice don't land as a matched pair. The yaw is composed on the LEFT, in world
         space — that is what makes it provably unable to disturb which face is up. */
      const t = dieTopTilt(value);
      const tilt = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(...t.axis).normalize(), t.angle);
      const yaw = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0), Math.floor(rand(0, 4)) * Math.PI / 2);
      const qEnd = yaw.multiply(tilt);

      /* Where it starts: off the bottom-left of the view, scattered a little so the pair
         doesn't fly in as one rigid block, and already tumbling. */
      const jitter = () => rand(-0.5, 0.5);
      const from = {
        x: c.x + DIE_THROW_FROM[0] * dist + jitter(),
        z: c.z + DIE_THROW_FROM[2] * dist + jitter(),
      };
      const qStart = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28)));

      obj.position.set(from.x, rest, from.z);
      obj.quaternion.copy(qStart);
      this._group.add(obj);

      this._dice.push({
        obj, from, to: spots[i], rest, qStart, qEnd,
        /* Tumble axis and speed. Biased toward the axis across the throw, so the dice roll
           forward the way they are travelling rather than spinning like a top. */
        axis: new THREE.Vector3(rand(-1, 1), rand(-0.4, 0.4), rand(-1, 1)).normalize(),
        rate: rand(9, 15),
        qMid: null,
      });
    });
  },

  /* One frame. Draws the throw from wall-clock time, so a dropped or slow frame changes how
     smooth it looks and never how long it takes. */
  tick() {
    if (!this._dice.length || !this._ms) return;
    const t = Math.min(1, (performance.now() - this._t0) / this._ms);
    /* The dice stop turning before they stop moving — a die that is still rotating as it
       comes to rest reads as sliding. */
    const SETTLE = 0.68;

    for (const d of this._dice) {
      const p = d.obj.position;
      /* Ease out across the ground: fast off the hand, slowing into the landing spot. */
      const e = 1 - Math.pow(1 - t, 2.2);
      p.x = d.from.x + (d.to.x - d.from.x) * e;
      p.z = d.from.z + (d.to.z - d.from.z) * e;
      p.y = d.rest + diceArcHeight(t) * (cfg.diceArc || 2.2);

      if (t < SETTLE) {
        const step = new THREE.Quaternion().setFromAxisAngle(d.axis, d.rate * (1 / 60));
        d.obj.quaternion.multiply(step);
        d.qMid = d.obj.quaternion.clone();
      } else {
        /* Turn the shortest way from wherever the tumble happened to stop to the pose that
           shows the rolled number. Eased, so it reads as the die settling rather than
           snapping to attention. */
        const u = (t - SETTLE) / (1 - SETTLE);
        const k = u * u * (3 - 2 * u);
        d.obj.quaternion.slerpQuaternions(d.qMid || d.qStart, d.qEnd, k);
      }
    }
    if (t >= 1) this._ms = 0;          // landed: stop touching them until the next throw
  },

  /* Put the dice exactly where the throw ends. Called on the timer at cfg.diceRevealMs, so the
     result is readable at that mark whatever the frame loop did — a slow frame, or a background
     tab where rAF never ran at all and the dice would otherwise be frozen in mid-air. */
  settle() {
    for (const d of this._dice) {
      d.obj.position.set(d.to.x, d.rest, d.to.z);
      d.obj.quaternion.copy(d.qEnd);
    }
    this._ms = 0;
  },

  clear() {
    if (this._group) this._group.clear();
    this._dice = [];
    this._ms = 0;
  },

  setShadows() {
    this._group?.traverse((o) => { if (o.isMesh) o.castShadow = !!cfg.envShadows; });
  },
};
