/* Card and item art, decoded once and shared by everything that paints a canvas face.

   Two things draw cards into a canvas — the case board standing inside the ring
   (js/ui/case3d.js) and the box that pops open on it (js/ui/box3d.js) — and both need the same
   pictures. One cache, so an image is fetched and decoded once however many faces use it.

   ---- why this has a callback ----

   Painting a face needs the image already decoded, and images arrive whenever the network says
   so. A miss therefore kicks off the load and paints the empty slot for now. Something has to
   ask for a repaint when the image lands, or the slot stays empty until the next unrelated
   redraw — which is exactly the bug this file was pulled out to fix: a card collected on one
   roll only appeared on the board after the NEXT roll, because that was the next thing that
   happened to call renderAll().

   `tick` is bumped on every arrival so a signature that includes it always differs, and
   `onLoad` is what actually re-triggers the draw. */

const _cache = new Map();        // src → HTMLImageElement (decoded) | "loading" | "failed"
const _listeners = [];
let _tick = 0;

/* Bumped whenever an image lands. Fold it into a redraw signature so "the art arrived" counts
   as a change worth repainting for. */
export function artTick(){ return _tick; }

/* Called after each arrival. Register once, at init — these are never removed. */
export function onArtLoad(fn){ _listeners.push(fn); }

/* The decoded image, or null while it is on its way (or if it never arrived). Never throws and
   never returns a half-loaded image, so a caller can use the result without checking .complete. */
export function art(src){
  if (!src) return null;
  const got = _cache.get(src);
  if (got && got !== "loading" && got !== "failed") return got;
  if (got) return null;                       // already loading, or already known to be missing
  _cache.set(src, "loading");
  const img = new Image();
  const done = (val) => {
    _cache.set(src, val);
    _tick++;
    /* Guarded: one broken listener must not stop the others, and must not take down an image
       load handler — this runs outside any of the game's own try/finally. */
    _listeners.forEach(fn => { try { fn(); } catch (e) { console.warn("artcache listener:", e); } });
  };
  img.onload = () => done(img);
  img.onerror = () => { console.warn("artcache: missing", src); done("failed"); };
  img.src = src;
  return null;
}
