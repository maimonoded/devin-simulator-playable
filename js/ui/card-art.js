"use strict";
/* The look of the deck — card faces and the card back, drawn to <canvas>.

   ONE PLACE, TWO CONSUMERS. js/ui/shoe3d.js wraps these canvases in a THREE.CanvasTexture for
   the board, and js/ui/fx.js drops the same canvas straight into the DOM for the flat fallback.
   Drawing rather than shipping PNGs is what keeps the deck working with no art pipeline: there
   is no build step here, and a card that only appears once someone generates an asset is a card
   nobody sees. Every glyph below is vector, so it is crisp at any texture size.

   THE SUITS ARE THE SHOW, not a French deck. Each one is a face of the drama:

     ⭐ Stars     the Walk of Fame — fame, the industry, being seen
     ❤️ Hearts    love and romance
     💎 Diamonds  the real stone: money, the gift, the proof. Cut as a brilliant with a table
                  and facets, deliberately NOT the flat rhombus a playing card uses — the whole
                  point is that it reads as a jewel.
     🎭 Masks     the drama itself, and everyone pretending

   And the two jokers are the leads, Victoria and Simon. A joker is the ticket, so it gets the
   full-bleed treatment: a spotlight, a name, and a gold TICKET band. Nothing else in the deck
   looks remotely like one, which matters — it is the card the whole economy turns on.

   PAINTED ART ON TOP OF THE DRAWING. assets/cards/ holds generated pictures for the two things
   worth painting — the back and the two jokers — and they replace the vector version when they
   arrive. The drawing is not a placeholder to be deleted once the art lands: it is what renders
   while the PNG is still downloading, and what renders forever if the file is missing. Same
   contract as the tile and prop art, and the reason the deck can never fail to draw.

   The numbered cards stay vector on purpose. A generated 7-of-Hearts would be a different
   drawing every time, and the corner index at 34px would be mush — the suit pip has to be the
   SAME shape at 92px in the middle and 34px in the corner, which only a path can promise. */

/* name → the file that replaces the drawing, if it is there. */
const CARD_ART_DIR = "assets/cards/";

const CardArt = {
  /* Portrait, close to a real playing card's 0.7 ratio. */
  W: 340, H: 480,

  SUITS: {
    star:    { ink: "#c8901a", glow: "#ffd76e", label: "Stars"    },
    heart:   { ink: "#d82f52", glow: "#ff8098", label: "Hearts"   },
    diamond: { ink: "#1f9fc4", glow: "#8ce8ff", label: "Diamonds" },
    mask:    { ink: "#7c5cd6", glow: "#c3adff", label: "Masks"    },
  },
  /* THE LEADS, AND THIS ORDER IS LOAD-BEARING — it must match Shoe.JOKERS index for index.
     Since jokers became type-routed, index k is also the k-th episode placeholder, so a portrait
     out of step with Shoe.JOKERS does not merely draw the wrong face: it labels the wrong
     collection. There are as many entries here as there are joker ids, and a test pins that.

     Carl and Victoria's mother are the show's third and fourth billed — see the episode content
     and assets/npcs/README.md, which reached the same two independently. Carl already exists as a
     board figure (assets/npcs/models/carl.glb), so his card and the man walking the ring are
     deliberately the same read: slate navy, sunglasses, phone at his ear.

     `file` is a PAINTED OVERRIDE and a missing one is not an error — _override() falls back to
     the vector portrait below, so the mechanism ships before the art does. */
  JOKERS: [
    { name: "VICTORIA", ink: "#d82f52", glow: "#ff9ab4", file: "joker-victoria" },
    { name: "SIMON",    ink: "#1f9fc4", glow: "#8ce8ff", file: "joker-simon"    },
    { name: "CARL",     ink: "#2f9e4f", glow: "#8fe0a6", file: "joker-carl"     },
    { name: "MAMA",     ink: "#e0872f", glow: "#ffc98a", file: "joker-mama"     },
  ],

  _cache: new Map(),
  _img: new Map(),        // name → HTMLImageElement once loaded, or false once known missing
  _listeners: [],
  /* Called when a painted override finishes loading, so a texture built from one of these
     canvases can be told to re-upload. */
  onReady(fn){ this._listeners.push(fn); },

  /* Ask for a painted override by name. Returns the image if it is already here, else starts
     the load and returns null — the caller draws the vector version in the meantime, and the
     canvas is repainted in place when the file lands. Probed by loading it rather than by
     fetch(), which the tile art does for the same reason. */
  _override(name, redraw){
    if (this._img.has(name)) return this._img.get(name) || null;
    this._img.set(name, false);                       // in flight; treat as missing for now
    const im = new Image();
    im.onload = () => {
      this._img.set(name, im);
      redraw && redraw();
      this._listeners.forEach(fn => { try { fn(name); } catch (e) {} });
    };
    im.onerror = () => { this._img.set(name, false); };   // absent file: keep the drawing
    im.src = CARD_ART_DIR + name + ".png";
    return null;
  },
  /* Paint an override edge to edge, cropped to fill rather than squashed — the generated art
     is card-shaped but not to the pixel. */
  _cover(x, im){
    const { W, H } = this;
    const s = Math.max(W / im.width, H / im.height);
    const w = im.width * s, h = im.height * s;
    x.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  },
  /* Faces are drawn once and reused: a pull would otherwise repaint a canvas and re-upload a
     texture every time, and there are only 54 of them. */
  face(card){
    const key = "f:" + card;
    if (this._cache.has(key)) return this._cache.get(key);
    const c = document.createElement("canvas");
    c.width = this.W; c.height = this.H;
    const x = c.getContext("2d");
    const paint = () => {
      if (Shoe.isTicket(card)) this._joker(x, Shoe.jokerIndex(card), card);
      else this._numbered(x, Shoe.suitOf(card), Shoe.rank(card));
    };
    paint();
    this._cache.set(key, c);
    return c;
  },
  back(){
    if (this._cache.has("back")) return this._cache.get("back");
    const c = document.createElement("canvas");
    c.width = this.W; c.height = this.H;
    const x = c.getContext("2d");
    const paint = () => {
      const im = this._override("back", paint);
      if (im) { x.clearRect(0, 0, this.W, this.H); this._cover(x, im); }
      else this._back(x);
    };
    paint();
    this._cache.set("back", c);
    return c;
  },

  /* ---------------- the shared card body ---------------- */
  _panel(x, fill, edge){
    const { W, H } = this, r = 34;
    x.clearRect(0, 0, W, H);
    x.save();
    this._round(x, 6, 6, W - 12, H - 12, r);
    x.fillStyle = fill; x.fill();
    x.lineWidth = 9; x.strokeStyle = edge; x.stroke();
    x.clip();
    return () => x.restore();
  },
  _round(x, l, t, w, h, r){
    x.beginPath();
    x.moveTo(l + r, t);
    x.arcTo(l + w, t, l + w, t + h, r);
    x.arcTo(l + w, t + h, l, t + h, r);
    x.arcTo(l, t + h, l, t, r);
    x.arcTo(l, t, l + w, t, r);
    x.closePath();
  },

  /* ---------------- a numbered card ---------------- */
  /* Rank dominates, because the rank is the MOVE — it is the one thing the player has to read
     in the half-second the card is on screen. The suit is the character of the card, so it sits
     right above the numeral where the eye lands next, and repeats small in the corners the way
     a real card indexes itself. */
  _numbered(x, suit, rank){
    const s = this.SUITS[suit] || this.SUITS.star;
    const { W, H } = this;
    const done = this._panel(x, "#fbf7ec", s.ink);

    // a soft wash of the suit colour, so the card reads as its suit before you focus on it
    const g = x.createRadialGradient(W / 2, H * 0.42, 10, W / 2, H * 0.42, H * 0.62);
    g.addColorStop(0, this._alpha(s.glow, 0.34));
    g.addColorStop(1, this._alpha(s.glow, 0));
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    // the pip, above the numeral
    this._pip(x, suit, W / 2, H * 0.29, 92);

    // the rank
    x.fillStyle = s.ink;
    x.textAlign = "center"; x.textBaseline = "middle";
    x.font = "800 176px Georgia, 'Times New Roman', serif";
    x.fillText(String(rank), W / 2, H * 0.63);

    // corner index, top-left and rotated bottom-right, like a real card
    const idx = (cx, cy, flip) => {
      x.save();
      x.translate(cx, cy);
      if (flip) x.rotate(Math.PI);
      x.fillStyle = s.ink;
      x.textAlign = "center"; x.textBaseline = "middle";
      x.font = "800 46px Georgia, serif";
      x.fillText(String(rank), 0, -20);
      this._pip(x, suit, 0, 30, 34);
      x.restore();
    };
    idx(46, 56, false);
    idx(W - 46, H - 56, true);
    done();
  },

  /* ---------------- the jokers ---------------- */
  /* The two leads, and the only cards that are tickets. A spotlight and a silhouette rather
     than a portrait: this is drawn, not painted, and a bad likeness would read worse than a
     confident piece of stagecraft. Swap in assets/cards/joker-victoria.png to replace it. */
  _joker(x, which, card){
    const j = this.JOKERS[which] || this.JOKERS[0];
    const { W, H } = this;

    /* Painted portrait if we have one. It already carries its own gold frame, so it goes edge
       to edge and only the name band is drawn over it — the player still has to be told which
       card this is, and that it is a ticket. */
    const im = this._override(j.file, () => { const c = this._cache.get("f:" + card); if (c) this._joker(c.getContext("2d"), which, card); });
    if (im) {
      x.clearRect(0, 0, W, H);
      this._cover(x, im);
      this._jokerBand(x, j);
      return;
    }

    const done = this._panel(x, "#16123a", "#f0b429");

    // spotlight cone from the top
    const beam = x.createLinearGradient(0, 0, 0, H * 0.8);
    beam.addColorStop(0, this._alpha(j.glow, 0.55));
    beam.addColorStop(1, this._alpha(j.glow, 0));
    x.fillStyle = beam;
    x.beginPath();
    x.moveTo(W / 2 - 26, 0); x.lineTo(W / 2 + 26, 0);
    x.lineTo(W * 0.94, H * 0.78); x.lineTo(W * 0.06, H * 0.78);
    x.closePath(); x.fill();

    // the silhouette: head, shoulders, a suggestion of a collar
    x.fillStyle = j.ink;
    x.beginPath(); x.arc(W / 2, H * 0.40, 58, 0, Math.PI * 2); x.fill();
    x.beginPath();
    x.moveTo(W / 2 - 116, H * 0.78);
    x.quadraticCurveTo(W / 2 - 96, H * 0.50, W / 2 - 40, H * 0.465);
    x.lineTo(W / 2 + 40, H * 0.465);
    x.quadraticCurveTo(W / 2 + 96, H * 0.50, W / 2 + 116, H * 0.78);
    x.closePath(); x.fill();
    // collar notch, so the shoulders read as a person and not a hill
    x.fillStyle = this._alpha("#16123a", 0.55);
    x.beginPath();
    x.moveTo(W / 2, H * 0.50); x.lineTo(W / 2 - 22, H * 0.62); x.lineTo(W / 2 + 22, H * 0.62);
    x.closePath(); x.fill();

    this._jokerBand(x, j);
    done();
  },

  /* The name and the TICKET flash. Drawn over whichever version of the card is underneath, so
     a painted joker and a drawn one label themselves identically. */
  _jokerBand(x, j){
    const { W, H } = this;
    x.save();
    const g = x.createLinearGradient(0, H * 0.74, 0, H);
    g.addColorStop(0, this._alpha("#0d0a24", 0));
    g.addColorStop(0.35, this._alpha("#0d0a24", 0.88));
    g.addColorStop(1, this._alpha("#0d0a24", 0.96));
    x.fillStyle = g;
    x.fillRect(0, H * 0.74, W, H * 0.26);

    x.textAlign = "center"; x.textBaseline = "middle";
    x.letterSpacing = "5px";
    x.fillStyle = "#f0b429";
    x.font = "800 38px Georgia, serif";
    x.fillText(j.name, W / 2, H * 0.855);

    x.letterSpacing = "7px";
    x.fillStyle = this._alpha("#ffffff", 0.9);
    x.font = "700 21px Georgia, serif";
    x.fillText("★ TICKET ★", W / 2, H * 0.925);

    // JOKER, small, at the top — the card says what it is before you read the name
    x.letterSpacing = "8px";
    x.fillStyle = this._alpha("#f0b429", 0.92);
    x.font = "700 21px Georgia, serif";
    x.shadowColor = "rgba(0,0,0,.8)"; x.shadowBlur = 10;
    x.fillText("JOKER", W / 2, 40);
    x.restore();
  },

  /* ---------------- the back ---------------- */
  /* A theatre marquee: gold on deep indigo, bulbs around the edge, and a medallion holding all
     four suits around the house monogram. It has to read at the size of a stack of cards on the
     board, so it is built from big shapes and one strong colour rather than fine detail. */
  _back(x){
    const { W, H } = this;
    const done = this._panel(x, "#1b1547", "#f0b429");

    // vignette
    const g = x.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, H * 0.72);
    g.addColorStop(0, "#2c2270");
    g.addColorStop(1, "#12102f");
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    // fine diagonal hatch, for a woven card-stock feel
    x.strokeStyle = this._alpha("#ffffff", 0.05);
    x.lineWidth = 2;
    for (let i = -H; i < W + H; i += 12) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i + H, H); x.stroke();
    }

    // marquee bulbs just inside the gold edge
    const inset = 30, bulbs = [];
    for (let i = 0; i <= 7; i++) bulbs.push([inset + (W - inset * 2) * (i / 7), inset]);
    for (let i = 0; i <= 7; i++) bulbs.push([inset + (W - inset * 2) * (i / 7), H - inset]);
    for (let i = 1; i < 11; i++) bulbs.push([inset, inset + (H - inset * 2) * (i / 11)]);
    for (let i = 1; i < 11; i++) bulbs.push([W - inset, inset + (H - inset * 2) * (i / 11)]);
    bulbs.forEach(([bx, by]) => {
      const bg = x.createRadialGradient(bx, by, 0, bx, by, 9);
      bg.addColorStop(0, "#fff3cf");
      bg.addColorStop(0.45, "#f0b429");
      bg.addColorStop(1, this._alpha("#f0b429", 0));
      x.fillStyle = bg;
      x.beginPath(); x.arc(bx, by, 9, 0, Math.PI * 2); x.fill();
    });

    // the medallion
    const cx = W / 2, cy = H / 2, R = 104;
    x.strokeStyle = "#f0b429"; x.lineWidth = 5;
    x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 2;
    x.beginPath(); x.arc(cx, cy, R - 12, 0, Math.PI * 2); x.stroke();
    x.fillStyle = this._alpha("#f0b429", 0.10);
    x.beginPath(); x.arc(cx, cy, R - 12, 0, Math.PI * 2); x.fill();

    // all four suits, in gold, around the monogram
    const ring = R - 46;
    this._pip(x, "star",    cx,        cy - ring, 40, "#f0b429");
    this._pip(x, "diamond", cx + ring, cy,        40, "#f0b429");
    this._pip(x, "mask",    cx,        cy + ring, 40, "#f0b429");
    this._pip(x, "heart",   cx - ring, cy,        40, "#f0b429");

    x.fillStyle = "#f0b429";
    x.textAlign = "center"; x.textBaseline = "middle";
    x.font = "800 44px Georgia, serif";
    x.letterSpacing = "2px";
    x.fillText("HH", cx, cy + 2);

    x.font = "700 17px Georgia, serif";
    x.letterSpacing = "6px";
    x.fillStyle = this._alpha("#ffd76e", 0.9);
    x.fillText("HARBOUR", cx, cy - R - 34);
    x.fillText("HEIGHTS", cx, cy + R + 34);
    x.letterSpacing = "0px";
    done();
  },

  /* ---------------- the pips ---------------- */
  /* Each suit drawn as a filled path at (cx,cy) fitting a box `size` across. `tint` overrides
     the suit's own ink, which is what lets the back draw all four in gold. */
  _pip(x, suit, cx, cy, size, tint){
    const s = this.SUITS[suit] || this.SUITS.star;
    const col = tint || s.ink;
    const k = size / 100;
    if (suit === "mask") {
      /* THE MASKS GO VIA AN OFFSCREEN CANVAS. Their eyes and mouth are punched with
         destination-out, which erases pixels rather than painting them — drawn straight onto the
         card that erases the CARD, leaving transparent holes that render black on the board and
         show the page through in the DOM fallback. Cutting them out of a scratch canvas and
         compositing the result keeps the holes inside the pip, where they belong. */
      const px = Math.ceil(size * 1.6);
      const oc = document.createElement("canvas");
      oc.width = oc.height = px;
      const ox = oc.getContext("2d");
      ox.translate(px / 2, px / 2); ox.scale(k, k);
      this._pathMask(ox, col);
      x.drawImage(oc, cx - px / 2, cy - px / 2);
      return;
    }
    x.save();
    x.translate(cx, cy); x.scale(k, k);
    x.fillStyle = col;
    if (suit === "star") this._pathStar(x);
    else if (suit === "heart") this._pathHeart(x);
    else this._pathDiamond(x, tint || null, s);
    x.restore();
  },
  _pathStar(x){
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 21 : 50;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath(); x.fill();
  },
  _pathHeart(x){
    x.beginPath();
    x.moveTo(0, 46);
    x.bezierCurveTo(-62, 4, -44, -46, -14, -30);
    x.bezierCurveTo(-5, -25, -1, -17, 0, -12);
    x.bezierCurveTo(1, -17, 5, -25, 14, -30);
    x.bezierCurveTo(44, -46, 62, 4, 0, 46);
    x.closePath(); x.fill();
  },
  /* A BRILLIANT CUT, not the flat rhombus: a table across the top, crown facets down to the
     girdle, and a pavilion to a point. That silhouette is what makes it read as a real stone,
     which is the whole reason this suit exists. */
  _pathDiamond(x, tint, s){
    const table = 22, girdle = 46, top = -34, waist = -12, tip = 50;
    x.beginPath();
    x.moveTo(-table, top); x.lineTo(table, top);
    x.lineTo(girdle, waist); x.lineTo(0, tip); x.lineTo(-girdle, waist);
    x.closePath(); x.fill();
    if (tint) return;                      // flat gold on the card back
    // facets, so the stone has depth rather than being a silhouette
    x.strokeStyle = this._alpha("#ffffff", 0.75);
    x.lineWidth = 3; x.lineJoin = "round";
    x.beginPath();
    x.moveTo(-table, top); x.lineTo(-girdle, waist);
    x.moveTo(table, top); x.lineTo(girdle, waist);
    x.moveTo(-girdle, waist); x.lineTo(girdle, waist);
    x.moveTo(-table, top); x.lineTo(0, tip);
    x.moveTo(table, top); x.lineTo(0, tip);
    x.stroke();
    // the table's highlight — the glint that sells it
    x.fillStyle = this._alpha(s.glow, 0.85);
    x.beginPath();
    x.moveTo(-table + 4, top + 4); x.lineTo(table - 4, top + 4);
    x.lineTo(table - 12, waist - 4); x.lineTo(-table + 12, waist - 4);
    x.closePath(); x.fill();
  },
  /* Comedy over tragedy, overlapped — the pair reads as "theatre" where one alone reads as
     "a face". */
  _pathMask(x, col){
    const face = (dx, dy, sc, smile) => {
      x.save(); x.translate(dx, dy); x.scale(sc, sc);
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(-30, -34);
      x.quadraticCurveTo(0, -44, 30, -34);
      x.quadraticCurveTo(34, 6, 0, 40);
      x.quadraticCurveTo(-34, 6, -30, -34);
      x.closePath(); x.fill();
      // eyes and mouth punched out
      x.globalCompositeOperation = "destination-out";
      x.beginPath(); x.ellipse(-13, -10, 8, 10, 0, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.ellipse(13, -10, 8, 10, 0, 0, Math.PI * 2); x.fill();
      x.beginPath();
      if (smile) { x.moveTo(-16, 10); x.quadraticCurveTo(0, 30, 16, 10); x.quadraticCurveTo(0, 20, -16, 10); }
      else { x.moveTo(-16, 24); x.quadraticCurveTo(0, 4, 16, 24); x.quadraticCurveTo(0, 14, -16, 24); }
      x.closePath(); x.fill();
      x.globalCompositeOperation = "source-over";
      x.restore();
    };
    face(-18, 4, 0.86, false);            // tragedy, behind
    face(16, -4, 0.94, true);             // comedy, in front
  },

  _alpha(hex, a){
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  },
};
