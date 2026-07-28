#!/usr/bin/env python3
"""Conform an environment GLB to the contract in assets/env/ART-BRIEF-ENV.md.

Generators return a mesh at an arbitrary scale, origin and rotation — Tripo in particular
hands back the model turned to face the reference image's three-quarter camera, which is
where the board's 5-degree misalignment came from. Rather than have the engine measure and
guess at every page load, the measuring happens here, once, and the answer is written into
the file. The runtime then just scales and drops.

Two shapes, matching the two things an environment is made of:

  --deck   a piece the board stands on. Normalized so the flat deck contains a 1 x 1
           axis-aligned square centred on the origin, with the deck surface at y = 0.
  (prop)   anything else. Normalized so the footprint's longer axis runs along X and
           measures 1, centred in XZ, with the base at y = 0.

The correction is written as a transform on a new root node. Geometry, materials, images
and the whole BIN chunk are copied through byte for byte — which is the point. Round-tripping
a mesh through a library to do this is what drops the baked texture (see
assets/tiles/README.md); editing one node transform cannot.

    python3 tools/normalize-env.py raw/island.glb --deck -o assets/env/models/island.glb
    python3 tools/normalize-env.py raw/boat.glb          -o assets/env/models/boat.glb
    python3 tools/normalize-env.py assets/env/models/island.glb --check --deck
"""

import argparse
import json
import math
import struct
import sys

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
NORMALIZED_NODE = "env-normalize"

# ---------------------------------------------------------------- glTF container


def read_glb(path):
    with open(path, "rb") as fh:
        blob = fh.read()
    magic, version, _ = struct.unpack_from("<III", blob, 0)
    if magic != 0x46546C67:
        sys.exit(f"{path}: not a GLB (bad magic)")
    if version != 2:
        sys.exit(f"{path}: glTF version {version}, expected 2")
    off, gltf, binary = 12, None, b""
    while off < len(blob):
        clen, ctype = struct.unpack_from("<II", blob, off)
        data = blob[off + 8: off + 8 + clen]
        if ctype == JSON_CHUNK:
            gltf = json.loads(data.decode("utf-8"))
        elif ctype == BIN_CHUNK:
            binary = data
        off += 8 + clen + (-clen % 4)
    if gltf is None:
        sys.exit(f"{path}: no JSON chunk")
    return gltf, binary


def write_glb(path, gltf, binary):
    js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    js += b" " * (-len(js) % 4)                     # chunks must be 4-byte aligned
    bin_pad = binary + b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(js) + (8 + len(bin_pad) if bin_pad else 0)
    out = bytearray()
    out += struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(js), JSON_CHUNK) + js
    if bin_pad:
        out += struct.pack("<II", len(bin_pad), BIN_CHUNK) + bin_pad
    with open(path, "wb") as fh:
        fh.write(bytes(out))


# ---------------------------------------------------------------- 4x4 maths
# Row-major internally; glTF wants column-major, so writing transposes once at the end.


def mat_identity():
    return [[1.0 if r == c else 0.0 for c in range(4)] for r in range(4)]


def mat_mul(a, b):
    return [[sum(a[r][k] * b[k][c] for k in range(4)) for c in range(4)] for r in range(4)]


def mat_apply(m, p):
    x, y, z = p
    return (
        m[0][0] * x + m[0][1] * y + m[0][2] * z + m[0][3],
        m[1][0] * x + m[1][1] * y + m[1][2] * z + m[1][3],
        m[2][0] * x + m[2][1] * y + m[2][2] * z + m[2][3],
    )


def mat_translate(tx, ty, tz):
    m = mat_identity()
    m[0][3], m[1][3], m[2][3] = tx, ty, tz
    return m


def mat_scale(s):
    m = mat_identity()
    m[0][0] = m[1][1] = m[2][2] = s
    return m


def mat_rot_y(a):
    c, s = math.cos(a), math.sin(a)
    m = mat_identity()
    m[0][0], m[0][2] = c, s
    m[2][0], m[2][2] = -s, c
    return m


def node_matrix(node):
    if "matrix" in node:                            # glTF stores column-major
        m = node["matrix"]
        return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    out = mat_identity()
    if "translation" in node:
        out = mat_mul(out, mat_translate(*node["translation"]))
    if "rotation" in node:
        x, y, z, w = node["rotation"]
        r = mat_identity()
        r[0][0], r[0][1], r[0][2] = 1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)
        r[1][0], r[1][1], r[1][2] = 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)
        r[2][0], r[2][1], r[2][2] = 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)
        out = mat_mul(out, r)
    if "scale" in node:
        sx, sy, sz = node["scale"]
        s = mat_identity()
        s[0][0], s[1][1], s[2][2] = sx, sy, sz
        out = mat_mul(out, s)
    return out


# ---------------------------------------------------------------- mesh reading

COMPONENT = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2),
             5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_accessor(gltf, binary, index):
    acc = gltf["accessors"][index]
    fmt, size = COMPONENT[acc["componentType"]]
    n = NCOMP[acc["type"]]
    view = gltf["bufferViews"][acc["bufferView"]]
    base = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride") or size * n
    out = []
    for i in range(acc["count"]):
        vals = struct.unpack_from("<" + fmt * n, binary, base + i * stride)
        out.append(vals if n > 1 else vals[0])
    return out


def gather_triangles(gltf, binary):
    """Every triangle in the scene, in the file's own world space."""
    tris = []
    scene = gltf["scenes"][gltf.get("scene", 0)]

    def walk(idx, parent):
        node = gltf["nodes"][idx]
        world = mat_mul(parent, node_matrix(node))
        if "mesh" in node:
            for prim in gltf["meshes"][node["mesh"]].get("primitives", []):
                if prim.get("mode", 4) != 4:        # triangles only
                    continue
                pos = prim.get("attributes", {}).get("POSITION")
                if pos is None:
                    continue
                verts = [mat_apply(world, p) for p in read_accessor(gltf, binary, pos)]
                if "indices" in prim:
                    idxs = read_accessor(gltf, binary, prim["indices"])
                else:
                    idxs = range(len(verts))
                idxs = list(idxs)
                for i in range(0, len(idxs) - 2, 3):
                    tris.append((verts[idxs[i]], verts[idxs[i + 1]], verts[idxs[i + 2]]))
        for child in node.get("children", []):
            walk(child, world)

    for root in scene.get("nodes", []):
        walk(root, mat_identity())
    if not tris:
        sys.exit("no triangles found")
    return tris


# ---------------------------------------------------------------- geometry


def hull_xz(points):
    """Convex hull (monotone chain) of points projected to XZ."""
    pts = sorted(set((round(p[0], 6), round(p[2], 6)) for p in points))
    if len(pts) < 3:
        return pts

    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2:
                (ax, az), (bx, bz) = out[-2], out[-1]
                if (bx - ax) * (p[1] - az) - (bz - az) * (p[0] - ax) > 0:
                    break
                out.pop()
            out.append(p)
        return out[:-1]

    return half(pts) + half(reversed(pts))


def min_area_rect(hull):
    """Smallest enclosing rectangle: angle, centre, and the two side lengths.

    Tried against every hull edge rather than a fixed angle sweep — the optimal rectangle
    always shares an edge with the hull, so this is exact rather than quantised, which
    matters when the whole point is to remove a 5-degree error."""
    best = None
    n = len(hull)
    for i in range(n):
        ax, az = hull[i]
        bx, bz = hull[(i + 1) % n]
        ang = math.atan2(bz - az, bx - ax)
        c, s = math.cos(-ang), math.sin(-ang)
        us = [p[0] * c - p[1] * s for p in hull]
        vs = [p[0] * s + p[1] * c for p in hull]
        w, d = max(us) - min(us), max(vs) - min(vs)
        if best is None or w * d < best[0]:
            cu, cv = (max(us) + min(us)) / 2, (max(vs) + min(vs)) / 2
            cx = cu * math.cos(ang) - cv * math.sin(ang)
            cz = cu * math.sin(ang) + cv * math.cos(ang)
            best = (w * d, ang, (cx, cz), w, d)
    _, ang, centre, w, d = best
    return ang, centre, w, d


def deck_candidates(tris, limit=8):
    """Flat upward-facing surfaces, as (height, verts, area), biggest area first.

    Plural, because "biggest flat surface" is the wrong test on its own. The Texas town's
    largest flat surface by area is the base plate its whole diorama sits on — which is
    almost entirely covered by the town square and the storefronts standing on it. Picking it
    put the deck 1.19 units BELOW the surface the board should stand on, and buried the board.
    conform() therefore scores these by how much CLEAR deck each one offers.

    Faces are gathered into a band around each candidate height rather than a single thin
    bucket: a reconstructed dirt lot is never perfectly level, and with thin buckets its area
    scatters across dozens of them so a crisply flat porch roof wins instead."""
    ys = [v[1] for t in tris for v in t]
    span = max(ys) - min(ys) or 1.0
    band = span * 0.02
    faces = []
    for a, b, c in tris:
        ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
        vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
        nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
        length = math.sqrt(nx * nx + ny * ny + nz * nz)
        if length == 0 or ny / length < 0.95:
            continue
        faces.append(((a[1] + b[1] + c[1]) / 3, length / 2, (a, b, c)))
    if not faces:
        sys.exit("no flat upward-facing surface — is this a deck piece?")

    scored = []
    for centre, _, _ in faces:
        area = sum(f[1] for f in faces if abs(f[0] - centre) <= band)
        scored.append((area, centre))
    scored.sort(reverse=True)

    out = []
    for area, centre in scored:
        if any(abs(centre - h) <= band * 2 for h, _, _ in out):
            continue                                # same surface, already have it
        picked = [f for f in faces if abs(f[0] - centre) <= band]
        verts = [v for f in picked for v in f[2]]
        height = sum(f[0] * f[1] for f in picked) / area
        out.append((height, verts, area))
        if len(out) >= limit:
            break
    return out


def clear_square(tris, height, ang, span):
    """Largest axis-aligned square of deck that has NOTHING standing on it.

    Flatness alone is not enough. The Texas town's slab runs on underneath its storefronts,
    so the flat rectangle was 12.2 tiles wide while the part the board could actually occupy
    was far smaller — the board landed with its far edge inside the shopfronts and the engine
    reported four corners buried up to 2.88 above the deck.

    So: rasterise the deck, rasterise everything that stands above it, subtract, and find the
    biggest empty square left. Returns (side, centre_x, centre_z) in the rotated frame.
    Marking the blockers by bounding box rather than exact coverage is deliberate — it errs
    toward calling a cell blocked, and a slightly small deck is safe where a large one is not.
    """
    c, sn = math.cos(-ang), math.sin(-ang)
    rot = lambda x, z: (x * c - z * sn, x * sn + z * c)
    clearance = span * 0.03

    pts = [rot(v[0], v[2]) for t in tris for v in t]
    u0, u1 = min(p[0] for p in pts), max(p[0] for p in pts)
    v0, v1 = min(p[1] for p in pts), max(p[1] for p in pts)
    N = 160
    du, dv = (u1 - u0) / N or 1, (v1 - v0) / N or 1
    deck = [[False] * N for _ in range(N)]
    blocked = [[False] * N for _ in range(N)]

    def cells(ps):
        us = [p[0] for p in ps]; vs = [p[1] for p in ps]
        i0 = max(0, int((min(us) - u0) / du)); i1 = min(N - 1, int((max(us) - u0) / du))
        j0 = max(0, int((min(vs) - v0) / dv)); j1 = min(N - 1, int((max(vs) - v0) / dv))
        return i0, i1, j0, j1

    def inside(ps, x, z):
        (ax, az), (bx, bz), (cx_, cz_) = ps
        d1 = (x - bx) * (az - bz) - (ax - bx) * (z - bz)
        d2 = (x - cx_) * (bz - cz_) - (bx - cx_) * (z - cz_)
        d3 = (x - ax) * (cz_ - az) - (cx_ - ax) * (z - az)
        return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))

    for tri in tris:
        ps = [rot(p[0], p[2]) for p in tri]
        # Deck: fill the triangle properly. A flat slab can be two big triangles, so marking
        # only the cells its vertices land in would leave the middle of the deck unmarked.
        if all(abs(p[1] - height) <= clearance for p in tri):
            i0, i1, j0, j1 = cells(ps)
            for j in range(j0, j1 + 1):
                for i in range(i0, i1 + 1):
                    if inside(ps, u0 + (i + 0.5) * du, v0 + (j + 0.5) * dv):
                        deck[j][i] = True
        # Blocked: same proper fill, for anything sitting above the deck. Selected by
        # centroid rather than by any-vertex, so a triangle bridging from the deck up to a
        # roof does not claim the deck it springs from — and filled rather than
        # bounding-boxed, because reconstruction is full of long thin triangles whose boxes
        # are enormous. Marking only the vertices instead is the opposite failure: a slab
        # covering the base plate is a handful of big triangles, so it marked its corners
        # and left the middle "clear", and the base plate won the deck vote while sitting
        # 1.19 units under the surface the board should stand on.
        cy = sum(p[1] for p in tri) / 3
        if cy > height + clearance:
            i0, i1, j0, j1 = cells(ps)
            for j in range(j0, j1 + 1):
                for i in range(i0, i1 + 1):
                    if inside(ps, u0 + (i + 0.5) * du, v0 + (j + 0.5) * dv):
                        blocked[j][i] = True

    # largest all-clear square, by the standard DP over the mask
    best = (0, 0, 0)
    dp = [[0] * N for _ in range(N)]
    for j in range(N):
        for i in range(N):
            if not deck[j][i] or blocked[j][i]:
                continue
            dp[j][i] = 1 if i == 0 or j == 0 else 1 + min(dp[j-1][i], dp[j][i-1], dp[j-1][i-1])
            if dp[j][i] > best[0]:
                best = (dp[j][i], i, j)
    n, i, j = best
    if n == 0:
        # Zero is an answer, not a failure: conform() scores every candidate surface and a
        # buried one legitimately has no clear deck. Exiting here instead let the first dud
        # candidate kill the whole run, which is how re-conforming the island — a piece that
        # had worked for weeks — started reporting "no clear deck at all".
        return 0.0, 0.0, 0.0
    side = min(n * du, n * dv)
    cu = u0 + (i - n / 2 + 0.5) * du
    cv = v0 + (j - n / 2 + 0.5) * dv
    return side, cu, cv


# ---------------------------------------------------------------- the two modes


def conform(tris, deck_mode):
    if deck_mode:
        ys = [v[1] for t in tris for v in t]
        span = max(ys) - min(ys) or 1.0
        best = None
        for height, verts, area in deck_candidates(tris):
            ang, (cx, cz), w, d = min_area_rect(hull_xz(verts))
            side, ccx, ccz = clear_square(tris, height, ang, span)
            if best is None or side > best[0]:
                best = (side, height, ang, cx, cz, ccx, ccz, w, d, area)
        if best is None or best[0] <= 0:
            sys.exit("no clear deck on any flat surface — every one has something standing "
                     "on it. Regenerate with an empty middle (ART-BRIEF-ENV.md 6.3).")
        side, height, ang, _, _, cx, cz_, w, d, area = best
        # Sit the board on the TOP of the flat band, not its average. The band is a couple of
        # percent of the model's height and the piece is then scaled up ~20x, so half a
        # percent of slop becomes a tenth of a tile on screen — enough to sink tiles whose
        # slabs are only 0.16 tall. Erring high leaves a hairline gap; erring low buries them.
        c_, sn_ = math.cos(-ang), math.sin(-ang)
        for h, verts, _a in deck_candidates(tris):
            if abs(h - height) > 1e-9:
                continue
            inside_sq = [v[1] for v in verts
                         if abs(v[0] * c_ - v[2] * sn_ - cx) <= side / 2
                         and abs(v[0] * sn_ + v[2] * c_ - cz_) <= side / 2]
            if inside_sq:
                height = max(inside_sq)
            break
        fill = area / (w * d) if w * d else 0
        scale = 1.0 / side
        report = {"deck height": height, "flat size": (w, d), "flat fill": fill,
                  "clear square": side, "rotation": math.degrees(ang),
                  "centre": (cx, cz_)}
        if side < w * 0.3:
            print(f"  NOTE: only {side / min(w, d):.0%} of the flat surface is clear — "
                  f"the rest has something standing on it")
        base = height
    else:
        verts = [v for t in tris for v in t]
        ang, (cx, cz), w, d = min_area_rect(hull_xz(verts))
        if d > w:                                   # longer footprint axis runs along X
            ang += math.pi / 2
            w, d = d, w
        scale = 1.0 / w
        base = min(v[1] for v in verts)
        report = {"footprint": (w, d), "rotation": math.degrees(ang),
                  "centre": (cx, cz), "base height": base}
    # mat_rot_y(a) turns a point by -a in the (x, z) convention min_area_rect measures in,
    # so cancelling a rectangle sitting at `ang` means passing +ang, not -ang. Passing -ang
    # doubles the error instead of removing it: the island came out 10 degrees off rather
    # than 5, and every check still passed, because none of them looked at the angle.
    if deck_mode:
        # centre comes from the rotated frame, so rotate, then translate, then scale
        m = mat_mul(mat_scale(scale),
                    mat_mul(mat_translate(-cx, -base, -cz_), mat_rot_y(ang)))
    else:
        m = mat_mul(mat_scale(scale), mat_mul(mat_rot_y(ang), mat_translate(-cx, -base, -cz)))
    return m, report, scale


def off_axis(ang):
    """How far a rectangle's angle is from axis-aligned, in degrees. A rectangle is the same
    rectangle under quarter turns, so only the remainder mod 90 means anything."""
    a = abs(math.degrees(ang)) % 90
    return min(a, 90 - a)


def check(tris, deck_mode, tol=0.01, tol_deg=0.25):
    """Verify a conformed file, so the skill's checklist has something to run."""
    problems = []
    if deck_mode:
        ys0 = [v[1] for t in tris for v in t]
        span0 = max(ys0) - min(ys0) or 1.0
        cands = [(clear_square(tris, h, min_area_rect(hull_xz(vs))[0], span0)[0], h, vs)
                 for h, vs, _ in deck_candidates(tris)]
        _, height, verts = max(cands)
        ang, (cx, cz), w, d = min_area_rect(hull_xz(verts))
        if off_axis(ang) > tol_deg:
            problems.append(f"deck sits {off_axis(ang):.2f}° off axis, must be square to X/Z")
        if abs(height) > tol:
            problems.append(f"deck surface at y={height:.4f}, must be 0")
        ys = [v[1] for t in tris for v in t]
        side, ccx, ccz = clear_square(tris, height, 0.0, max(ys) - min(ys))
        if side < 1 - 0.02:
            problems.append(f"clear deck is {side:.4f} across, must be at least 1 "
                            f"— something stands where the board goes")
        if abs(ccx) > 0.02 or abs(ccz) > 0.02:
            problems.append(f"clear deck centred at ({ccx:.4f}, {ccz:.4f}), must be (0, 0)")
    else:
        verts = [v for t in tris for v in t]
        ang, (cx, cz), w, d = min_area_rect(hull_xz(verts))
        base = min(v[1] for v in verts)
        if off_axis(ang) > tol_deg:
            problems.append(f"footprint sits {off_axis(ang):.2f}° off axis, must be square to X/Z")
        if abs(base) > tol:
            problems.append(f"base at y={base:.4f}, must be 0")
        if abs(max(w, d) - 1) > tol:
            problems.append(f"footprint {max(w, d):.4f}, must be 1")
        if abs(cx) > tol or abs(cz) > tol:
            problems.append(f"footprint centre ({cx:.4f}, {cz:.4f}), must be (0, 0)")
    return problems


# ---------------------------------------------------------------- entry point


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("-o", "--out")
    ap.add_argument("--deck", action="store_true",
                    help="the piece the board stands on (default: a prop)")
    ap.add_argument("--check", action="store_true",
                    help="verify an already-conformed file instead of writing one")
    args = ap.parse_args()

    gltf, binary = read_glb(args.input)
    tris = gather_triangles(gltf, binary)

    if args.check:
        problems = check(tris, args.deck)
        for p in problems:
            print(f"FAIL  {p}")
        print("PASS  conforms to the environment asset contract" if not problems else "")
        return 1 if problems else 0

    if not args.out:
        sys.exit("need -o/--out")
    roots = gltf["scenes"][gltf.get("scene", 0)].get("nodes", [])
    if any(gltf["nodes"][r].get("name") == NORMALIZED_NODE for r in roots):
        sys.exit(f"{args.input} is already conformed — run this on the raw generator output")

    matrix, report, scale = conform(tris, args.deck)
    for k, v in report.items():
        print(f"  {k}: {v if not isinstance(v, tuple) else tuple(round(x, 4) for x in v)}"
              if not isinstance(v, float) else f"  {k}: {v:.4f}")
    print(f"  applied scale: {scale:.6f}")

    gltf["nodes"].append({
        "name": NORMALIZED_NODE,
        "children": list(roots),
        # glTF matrices are column-major
        "matrix": [matrix[r][c] for c in range(4) for r in range(4)],
    })
    gltf["scenes"][gltf.get("scene", 0)]["nodes"] = [len(gltf["nodes"]) - 1]
    write_glb(args.out, gltf, binary)
    print(f"  wrote {args.out}")

    problems = check(gather_triangles(*read_glb(args.out)), args.deck)
    for p in problems:
        print(f"FAIL  {p}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
