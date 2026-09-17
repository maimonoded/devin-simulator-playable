"use strict";
/* The face of a drawn card, composed on a <canvas> at the moment it is drawn.

   ONE PLACE, TWO CONSUMERS. js/ui/shoe3d.js wraps these canvases in a THREE.CanvasTexture for
   the card that lifts off the deck on the board; js/ui/fx.js drops the same canvas straight into
   the DOM for the flat fallback. Neither one knows how a card is drawn, and there is exactly one
   answer to "what does a card look like" however it reaches the screen.

   ---------------------------------------------------------------------------
   THE SPLIT: TOP 60% PAINTING, BOTTOM 40% TEXT — and the text is DRAWN, not baked.

   A painted 5:3 landscape from assets/cards/ fills the top of the card, cover-cropped. The
   bottom is a panel this file draws: the card's NAME, and WHAT IT JUST DID.

   That second half is the whole reason a card is composed rather than shipped as a picture.
   The number on a card is the LIVE one — a Windfall pulled at stake x5 pays 1,500, not the 300
   in the deck table, and the fine a broke player draws is floored at their balance. A baked
   image can only ever show the base number, so it would be wrong more often than right.
   assets/cards/README.md states the same contract from the art side: no image in that folder
   carries a word or a digit, because this file owns every glyph on a card.

   MISSING ART DEGRADES, IT DOES NOT BREAK. A card is a MOVE: the board is mid-turn when one is
   drawn, so a deck that threw on a 404 would take the game down rather than lose a picture. An
   absent or broken PNG costs that one card its painting and nothing else — the name, the number
   and the colour are drawn on a plain field instead. That is also what renders in the window
   before the file has finished downloading, which is why the fallback is not a placeholder
   waiting to be deleted.

   NAME -> FILE IS A MAP IN HERE, NOT A COLUMN ON THE DECK ROW. `deck` in js/config.js is
   live-edited in the tuning drawer and rebuilt wholesale by Economy.apply(), so a field added to
   a row would be edited away or overwritten. The mapping is presentation and it lives with the
   presentation; a name with no entry simply draws its fallback.

   LATE ART REPAINTS IN PLACE. _art() starts the load and returns null, the fallback is drawn,
   and the same canvas is repainted when the file lands — `onReady` then lets shoe3d re-upload
   the texture built from it. Probing by loading an Image rather than by fetch() is deliberate:
   this project's classic scripts may not fetch() local files (see CLAUDE.md), and the tile art
   probes the same way. */

const CARD_ART_DIR = "assets/cards/";

const CardArt = {
  /* Portrait, a real playing card's ratio. The board's card mesh is 0.66 x 0.94 tiles, which is
     the same shape, so nothing stretches. */
  W: 340, H: 480,
  /* The painting's share of the card's height. The user's spec, and assets/cards/README.md is
     written to it — the art is generated at 5:3 and cover-cropped into a band of 340 x 288,
     losing about an eighth off each side, which is why nothing important is painted out there. */
  ART: 0.60,

  /* A deck row's NAME -> assets/cards/card-<slug>.png. The names are the ones in `deck`
     (js/config.js), mirrored from ECONOMY_DEFAULT in js/economy.js. Rename a card in both of
     those and it loses its picture until it is renamed here too, which costs a painting and
     never a turn. */
  SLUGS: {
    "Small coins":         "small-coins",
    "Medium coins":        "medium-coins",
    "Insider tip":         "insider-tip",
    "Windfall":            "windfall",
    "Small energy":        "energy",
    "Fine / Paparazzi":    "fine",
    "Prop from the set":   "prop",
    /* One card, one face. card-gala.png is unused now and kept: the two bonus cards were merged
       into "Bonus Game", and the follow-spot reads as ANY bonus where a red carpet reads as one
       particular one. */
    "Bonus Game":          "spotlight",
    "Advance to Start":    "advance",
  },

  /* Pulled from css/base.css so the deck follows the theme rather than carrying a second copy
     of it. Read once — these never change at runtime — and every one has a literal fallback,
     because this also has to draw before the stylesheet is applied. */
  _pal: null,
  pal() {
    if (this._pal) return this._pal;
    const v = (k, d) => {
      try {
        const s = getComputedStyle(document.documentElement).getPropertyValue(k).trim();
        return s || d;
      } catch (e) { return d; }
    };
    return (this._pal = {
      bg: v("--bg", "#0d1029"), bg2: v("--bg2", "#141838"),
      gold: v("--gold", "#ffcb5c"), goldD: v("--gold-d", "#e0a63a"),
      teal: v("--teal", "#2dd4bf"), pink: v("--pink", "#ff6fa5"),
      bad: v("--bad", "#ff5f7e"), text: v("--text", "#eef0ff"),
      muted: v("--muted", "#9098c9"),
    });
  },

  /* ---------------- painted art ---------------- */
  /* name -> Image once loaded, "load" while in flight, false once known missing. THREE states,
     not two: "in flight" and "missing" must stay distinct, or a card drawn during the download
     window registers no repaint and keeps its fallback for the rest of the session. */
  _img: new Map(),
  _wait: new Map(),          // name -> [redraw, ...] — canvases to repaint when it lands
  _listeners: [],
  /* Fired when a painting arrives, so a texture built from one of these canvases can be told to
     re-upload. The canvas itself is already repainted by then. */
  onReady(fn) { this._listeners.push(fn); },

  _art(name, redraw) {
    const have = this._img.get(name);
    if (have && have !== "load") return have;
    if (have === "load") { if (redraw) this._wait.get(name).push(redraw); return null; }
    if (have === false) return null;                 // absent: it is never coming
    this._img.set(name, "load");
    this._wait.set(name, redraw ? [redraw] : []);
    const im = new Image();
    im.onload = () => {
      this._img.set(name, im);
      const w = this._wait.get(name) || []; this._wait.set(name, []);
      w.forEach(fn => { try { fn(); } catch (e) {} });
      this._listeners.forEach(fn => { try { fn(name); } catch (e) {} });
    };
    im.onerror = () => { this._img.set(name, false); this._wait.set(name, []); };
    im.src = CARD_ART_DIR + name + ".png";
    return null;
  },

  /* Warm the whole folder. Called once from boot so the first card a player draws is painted
     rather than caught mid-download — the whole folder, which assets/cards/README.md sizes
     deliberately for exactly this. Deferred by the caller, never on the critical path: a missing
     or slow file costs a picture and the fallback is already drawn. */
  preload(items) {
    this._art("card-back");
    Object.values(this.SLUGS).forEach(s => this._art("card-" + s));
    (items || []).forEach(id => this._art("item-" + id));
  },

  /* ---------------- the three canvases ---------------- */
  /* A card face. `c` is the `card` event from js/board-actor.js:
       name      the deck row's name — picks the painting
       big       what it just did, already formatted by the tile (the LIVE number)
       positive  false only when the card cost coins
       energy    the card paid energy
       item      the Catalog id of the item it granted, or null
     Never cached: `big` is the live number and `item` the one actually drawn, so two pulls of
     the same row are two different cards. One canvas paint per pull is a fraction of a frame. */
  face(c) {
    const card = c || {};
    const can = document.createElement("canvas");
    can.width = this.W; can.height = this.H;
    const x = can.getContext("2d");
    const paint = () => this._face(x, card, paint);
    paint();
    return can;
  },
  /* The back — on every slab of the stack, and on the reverse of the card in flight. Cached:
     there is one of it, and the stack alone asks for it a dozen times. */
  back() {
    if (this._back) return this._back;
    const can = document.createElement("canvas");
    can.width = this.W; can.height = this.H;
    const x = can.getContext("2d");
    const paint = () => {
      const im = this._art("card-back", paint);
      if (im) { x.clearRect(0, 0, this.W, this.H); this._cover(x, im, 0, 0, this.W, this.H); }
      else this._drawnBack(x);
    };
    paint();
    return (this._back = can);
  },
  /* The empty slot a pulled card lands in — a dashed outline, shown while that slot is empty.
     Here rather than in shoe3d.js because it is card art: shoe3d owns the board, this file owns
     everything drawn on a canvas.

     NOT CURRENTLY ON SCREEN. The deck stands alone on the centre line and a card goes back onto
     it when it has been read, so there is no second spot to mark — shoe3d's _buildGhost() says
     as much and returns early. Kept for the same reason that function is: the two are the halves
     of one decision, and restoring a discard spot needs both. */
  ghost() {
    if (this._ghostC) return this._ghostC;
    const can = document.createElement("canvas");
    can.width = 132; can.height = 188;
    const x = can.getContext("2d");
    this.round(x, 6, 6, can.width - 12, can.height - 12, 14);
    x.fillStyle = "rgba(12,16,40,.42)"; x.fill();
    x.setLineDash([10, 8]); x.lineWidth = 6;
    x.strokeStyle = "rgba(255,235,190,.72)"; x.stroke();
    return (this._ghostC = can);
  },

  /* ---------------- drawing a face ---------------- */
  _face(x, c, redraw) {
    const { W, H } = this, P = this.pal();
    const band = Math.round(H * this.ART);
    const cost = c.positive === false;
    const edge = cost ? P.bad : (c.energy ? P.teal : P.gold);

    x.clearRect(0, 0, W, H);
    x.save();
    this.round(x, 5, 5, W - 10, H - 10, 30);
    x.fillStyle = P.bg; x.fill();
    x.save(); x.clip();

    /* 1 — the painting, cover-cropped into the top band. */
    const slug = this.SLUGS[c.name];
    const im = slug ? this._art("card-" + slug, redraw) : null;
    if (im) this._cover(x, im, 0, 0, W, band);
    else this._drawnArt(x, band, c, edge);

    /* 2 — the text panel. Its own field rather than the painting dimmed: the number has to be
       the most legible thing on the card at stack size, and text over art never is. */
    const g = x.createLinearGradient(0, band, 0, H);
    g.addColorStop(0, P.bg2); g.addColorStop(1, P.bg);
    x.fillStyle = g; x.fillRect(0, band, W, H - band);
    /* A gold seam, and a short fade of the art into it so the crop does not end on a hard line. */
    const f = x.createLinearGradient(0, band - 34, 0, band);
    f.addColorStop(0, "rgba(13,16,41,0)"); f.addColorStop(1, "rgba(13,16,41,.85)");
    x.fillStyle = f; x.fillRect(0, band - 34, W, 34);
    x.fillStyle = edge; x.globalAlpha = 0.85; x.fillRect(0, band - 2, W, 3); x.globalAlpha = 1;

    /* 3 — the eyebrow, over the art rather than in the panel. The panel's 192px belong to the
       name and the number; a third line in there squeezes both of the ones that matter. */
    const top = x.createLinearGradient(0, 0, 0, 64);
    top.addColorStop(0, "rgba(9,11,30,.72)"); top.addColorStop(1, "rgba(9,11,30,0)");
    x.fillStyle = top; x.fillRect(0, 0, W, 64);
    x.textAlign = "center"; x.textBaseline = "alphabetic";
    x.font = "700 13px system-ui,sans-serif";
    x.fillStyle = "rgba(255,235,190,.92)";
    this._tracked(x, "PLOT TWIST", W / 2, 32, 4.5);

    /* 4 — the item medallion, if this card granted one, straddling the seam. WHICH prop was
       found is the card's news, so it is shown rather than only named — and the square item
       art exists precisely so it can be shown somewhere that is not card-shaped. */
    /* WHAT THE PANEL HOLDS decides where the name sits. Three shapes, and every one of them is
       a real card in the deck:
         name + number   the usual card — the number is the news, so it gets the lower half.
         name only       the Bonus Game card, which names a game and prices nothing: the number
                         is the GAME's to reveal (js/tiles/deck-tile.js). ONE card, not two —
                         Premiere Gala and Steal the Spotlight merged, and which of them runs is
                         decided after the draw by cfg.trainLargeChance, not by the deck. With
                         nothing under it the name centres in the panel instead of hanging at the
                         top of an empty box.
         medallion too   an item card gives its top third to the prop, so everything drops. */
    const big = c.big && String(c.big) !== String(c.name) ? String(c.big) : "";
    let nameY = big ? 348 : 396, bigY = 428;
    if (c.item) {
      this._medallion(x, c.item, W / 2, band, 54, edge, redraw);
      nameY = big ? 386 : 418; bigY = 448;
    }

    /* 5 — the name, and what it did. A medallion has already taken the top of the panel, so a
       card carrying one keeps its name to one line; nothing in the deck needs two. */
    x.fillStyle = P.text;
    const lines = this._wrap(x, String(c.name || ""), W - 44, c.item ? 26 : 29,
                             "800", "Georgia,serif", c.item ? 1 : 2);
    const lh = lines[0].size + 6;
    const y0 = nameY - (lines.length - 1) * lh / 2;
    lines.forEach((ln, i) => { x.font = ln.font; this._shadowed(x, ln.text, W / 2, y0 + i * lh); });

    if (big) {
      /* The live number, in the card's own colour. Fitted rather than clipped: an item line is
         "icon Name x2" and much longer than "+1,500", and both have to land inside the card. */
      const size = this._fit(x, big, W - 40, c.item ? 30 : 44, "800", "Georgia,serif", 15);
      x.font = `800 ${size}px Georgia,serif`;
      x.fillStyle = cost ? P.bad : (c.energy ? P.teal : P.gold);
      this._shadowed(x, big, W / 2, bigY + (lines.length > 1 ? 12 : 0));
    }

    x.restore();
    /* The border last, so it sits over the art and the panel both. */
    this.round(x, 5, 5, W - 10, H - 10, 30);
    x.lineWidth = 7; x.strokeStyle = edge; x.stroke();
    x.lineWidth = 2; x.strokeStyle = "rgba(255,255,255,.22)"; x.stroke();
    x.restore();
  },

  /* What a card looks like with no painting behind it: a plain field in the card's own colour,
     which is exactly what assets/cards/README.md promises a missing file costs. */
  _drawnArt(x, band, c, edge) {
    const { W } = this, P = this.pal();
    const g = x.createRadialGradient(W / 2, band * 0.44, 10, W / 2, band * 0.44, band * 0.95);
    g.addColorStop(0, this._mix(edge, P.bg, 0.55));
    g.addColorStop(1, P.bg);
    x.fillStyle = g; x.fillRect(0, 0, W, band);
    x.save();
    x.globalAlpha = 0.9;
    x.textAlign = "center"; x.textBaseline = "middle";
    x.font = "96px system-ui,'Apple Color Emoji','Segoe UI Emoji',sans-serif";
    x.fillText(c.positive === false ? "💸" : (c.energy ? "⚡" : "🃏"),
               W / 2, band * 0.47);
    x.restore();
    x.textBaseline = "alphabetic";
  },

  /* One item, round, on the seam. The square art cover-cropped into a disc, or the item's own
     emoji when the file is missing — the same degrade as everything else here. */
  _medallion(x, id, cx, cy, r, edge, redraw) {
    const P = this.pal();
    x.save();
    x.shadowColor = "rgba(0,0,0,.65)"; x.shadowBlur = 16; x.shadowOffsetY = 4;
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fillStyle = P.bg2; x.fill();
    x.restore();

    x.save();
    x.beginPath(); x.arc(cx, cy, r - 5, 0, Math.PI * 2); x.clip();
    const im = this._art("item-" + id, redraw);
    /* Cropped IN a little rather than fitted. An item is painted with the object filling the
       middle two thirds of a square (the FRAMING block in assets/cards/README.md), so dropping
       that square whole into the disc leaves the prop floating in a ring of empty surface —
       which is the one thing a medallion this size cannot afford. */
    if (im) this._cover(x, im, cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);
    else {
      x.fillStyle = P.bg; x.fillRect(cx - r, cy - r, r * 2, r * 2);
      x.textAlign = "center"; x.textBaseline = "middle";
      x.font = `${Math.round(r * 1.1)}px system-ui,'Apple Color Emoji','Segoe UI Emoji',sans-serif`;
      x.fillText("🎬", cx, cy + 2);
      x.textBaseline = "alphabetic";
    }
    x.restore();

    x.beginPath(); x.arc(cx, cy, r - 2.5, 0, Math.PI * 2);
    x.lineWidth = 5; x.strokeStyle = edge; x.stroke();
  },

  /* The back, drawn: one bold gold disc on a dark field with a ring of marquee bulbs, which is
     what the painted back is too — assets/cards/README.md explains why that shape and not a
     scene. It is mostly seen as a ~40px sliver down the side of the stack. */
  _drawnBack(x) {
    const { W, H } = this, P = this.pal();
    x.clearRect(0, 0, W, H);
    x.save();
    this.round(x, 5, 5, W - 10, H - 10, 30);
    x.fillStyle = P.bg2; x.fill();
    x.save(); x.clip();
    const g = x.createRadialGradient(W / 2, H / 2, 8, W / 2, H / 2, H * 0.6);
    g.addColorStop(0, "#2a2160"); g.addColorStop(1, P.bg);
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    /* the marquee border */
    x.fillStyle = "rgba(255,203,92,.55)";
    const pad = 26, n = 11;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      [pad, H - pad].forEach(y => { x.beginPath(); x.arc(pad + t * (W - pad * 2), y, 3.4, 0, 7); x.fill(); });
    }
    for (let i = 1; i < 15; i++) {
      const y = pad + (i / 15) * (H - pad * 2);
      [pad, W - pad].forEach(px => { x.beginPath(); x.arc(px, y, 3.4, 0, 7); x.fill(); });
    }
    /* the disc */
    const r = 96;
    const d = x.createRadialGradient(W / 2, H / 2 - 14, 6, W / 2, H / 2, r);
    d.addColorStop(0, "#ffe9b0"); d.addColorStop(0.6, P.gold); d.addColorStop(1, P.goldD);
    x.beginPath(); x.arc(W / 2, H / 2, r, 0, Math.PI * 2); x.fillStyle = d; x.fill();
    x.beginPath(); x.arc(W / 2, H / 2, r - 16, 0, Math.PI * 2);
    x.lineWidth = 3; x.strokeStyle = "rgba(13,16,41,.55)"; x.stroke();
    x.beginPath(); x.arc(W / 2, H / 2, r * 0.42, 0, Math.PI * 2);
    x.fillStyle = P.bg; x.fill();
    x.beginPath(); x.arc(W / 2, H / 2, r * 0.42, 0, Math.PI * 2);
    x.lineWidth = 4; x.strokeStyle = "rgba(13,16,41,.75)"; x.stroke();
    x.restore();
    this.round(x, 5, 5, W - 10, H - 10, 30);
    x.lineWidth = 7; x.strokeStyle = P.goldD; x.stroke();
    x.restore();
  },

  /* ---------------- small helpers ---------------- */
  round(x, l, t, w, h, r) {
    x.beginPath();
    x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
    x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
  },
  /* Fill a box with an image, cropping rather than squashing. */
  _cover(x, im, l, t, w, h) {
    if (!im.width || !im.height) return;
    const s = Math.max(w / im.width, h / im.height);
    const iw = im.width * s, ih = im.height * s;
    x.save();
    x.beginPath(); x.rect(l, t, w, h); x.clip();
    x.drawImage(im, l + (w - iw) / 2, t + (h - ih) / 2, iw, ih);
    x.restore();
  },
  /* Largest size at or below `size` that fits `max` pixels wide, never below `min`. */
  _fit(x, text, max, size, weight, family, min) {
    let s = size;
    for (; s > (min || 12); s -= 2) {
      x.font = `${weight} ${s}px ${family}`;
      if (x.measureText(text).width <= max) break;
    }
    return s;
  },
  /* At most `maxLines` lines, broken on spaces, each fitted. Returns what to draw, so the
     caller can place them — a name is one line far more often than two. */
  _wrap(x, text, max, size, weight, family, maxLines) {
    const one = this._fit(x, text, max, size, weight, family, size - 6);
    x.font = `${weight} ${one}px ${family}`;
    if (x.measureText(text).width <= max || maxLines < 2) {
      return [{ text, size: one, font: `${weight} ${one}px ${family}` }];
    }
    const words = text.split(" ");
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
      x.font = `${weight} ${size}px ${family}`;
      const w = Math.max(x.measureText(a).width, x.measureText(b).width);
      if (!best || w < best.w) best = { a, b, w };
    }
    if (!best) return [{ text, size: one, font: `${weight} ${one}px ${family}` }];
    const s = this._fit(x, best.a.length > best.b.length ? best.a : best.b, max, size, weight, family, 14);
    const font = `${weight} ${s}px ${family}`;
    return [{ text: best.a, size: s, font }, { text: best.b, size: s, font }];
  },
  _shadowed(x, text, cx, y) {
    x.save();
    x.shadowColor = "rgba(0,0,0,.72)"; x.shadowBlur = 10; x.shadowOffsetY = 2;
    x.fillText(text, cx, y);
    x.restore();
  },
  /* Letter-spaced small caps. canvas has letterSpacing only in newer browsers, so it is drawn
     glyph by glyph — the eyebrow is eight characters and this runs once per card. */
  _tracked(x, text, cx, y, gap) {
    const chars = text.split("");
    const w = chars.reduce((a, ch) => a + x.measureText(ch).width + gap, -gap);
    let px = cx - w / 2;
    const prev = x.textAlign; x.textAlign = "left";
    chars.forEach(ch => { x.fillText(ch, px, y); px += x.measureText(ch).width + gap; });
    x.textAlign = prev;
  },
  /* Blend two #rrggbb values — the fallback field's tint. */
  _mix(a, b, k) {
    const p = h => {
      const s = String(h).replace("#", "").trim();
      const v = s.length === 3 ? s.split("").map(c => c + c).join("") : s;
      const n = parseInt(v, 16);
      return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [0, 0, 0];
    };
    const A = p(a), B = p(b);
    const m = i => Math.round(A[i] * k + B[i] * (1 - k));
    return `rgb(${m(0)},${m(1)},${m(2)})`;
  },
};

/* Warm the folder once, off the critical path.

   Sixteen files and 4.4 MB — assets/cards/README.md sizes them for exactly this, because a
   dozen of them can be wanted at once. It runs on an idle callback rather than at parse time so
   it never competes with the board's GLBs for the first paint, and nothing waits for it: a card
   drawn before its picture lands draws the fallback and repaints itself when it arrives.

   The item ids come from the Catalog rather than a list in here, for the reason
   assets/cards/README.md gives about naming: the filename IS the id, so a second series brings
   its own five and their pictures load beside these without a line changing anywhere. */
(function warmCardArt() {
  const go = () => {
    try {
      const items = (typeof Catalog !== "undefined")
        ? Catalog.series().reduce((a, s) => a.concat(Catalog.itemsOf(s.id).map(i => i.id)), [])
        : [];
      CardArt.preload(items);
    } catch (e) { /* no catalog yet, or no network: the fallbacks draw */ }
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1500);
})();
