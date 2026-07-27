# Tile artwork

Drop a PNG in here and that board tile uses it. Nothing else to wire up — no config, no
registration, no code change.

## Naming

**The filename is 1-based**, counting clockwise from Start:

| File | Tile | Which tile |
|---|---|---|
| `1.png` | index 0 | **Start** (bottom vertex of the diamond) |
| `2.png` | index 1 | first standard tile after Start |
| `4.png` | index 3 | first Plot Twist / deck tile |
| `6.png` | index 5 | first train tile |
| `11.png` | index 10 | **Spa** corner |
| `21.png` | index 20 | **VIP Lounge** corner |
| `31.png` | index 30 | **Premiere** corner |
| `40.png` | index 39 | last tile before Start |

So the file number is `index + 1`. Only `.png` is looked for.

The mapping lives in `tileImagePath()` in [../../js/board-model.js](../../js/board-model.js) — if
you'd rather the filenames matched the 0-based code indices, that's the one line to change.

## Size

A tile renders at **47.3 × 47.3 CSS px** on the default 560px board (11 columns, 4px gaps).

| | Size | Notes |
|---|---|---|
| **Recommended** | **144 × 144 px** | 3× for retina; what to author at |
| Acceptable | 96 × 96 px | 2× |
| Minimum | 48 × 48 px | 1×; will look soft on retina |

Square, and `background-size: cover` fills the tile — so anything non-square gets cropped.
Transparency is fine; it composites over the board background.

**Author it straight-on, not pre-skewed.** The board is drawn at `rotateX(52deg) rotateZ(45deg)`,
but the artwork is counter-rotated by the same amount, so it **faces the viewer upright** — exactly
as the source file looks. Don't skew your art into a diamond to "match" the board; that would be
applied twice. A straight-on render or illustration is what you want.

The picture is scaled slightly larger than the tile and is allowed to overflow it, so art with a
base or a tall element reads as an object standing on the board rather than a flat texture. It
still occupies a small area — roughly 47px — so fine detail, thin lines and small text will not
survive. Bold shapes and strong contrast read best.

## What changes when art is present

- the art is drawn on a child element (`.art`) that counter-rotates the board tilt — a CSS
  background would be sheared by the board's 3D transform, which is why it isn't one
- the tile's gradient background and inset shadow are dropped
- its **type border colour is kept** (gold Start, teal Spa, purple VIP, pink Premiere) so the
  board still reads
- the emoji icon is hidden — the art replaces it
- the small coin-value label stays, switched to white with a shadow for legibility
- mystery-box markers still sit on top

## Partial sets are fine

Missing files are simply not used, so you can skin one tile or all forty. Absence is detected by
attempting to load the image (`fetch()` is blocked on `file://`), which means **404s for missing
files are expected** in the network log. The result is cached per tile for the page's lifetime,
so rebuilding the board doesn't re-probe.
