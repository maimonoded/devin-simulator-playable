#!/usr/bin/env python3
"""Normalize a generated GLB into a board tile that satisfies the engine spec.

Generative 3D models return a mesh in whatever pose, scale and origin their
pipeline happens to use. The engine needs all of this to be exact and identical
across all 40 tiles, so every asset goes through here before delivery:

    1 x 1 unit footprint   (XZ bounding box scaled to fit, aspect preserved)
    +Y up                  (rotates a Z-up mesh if detected or forced)
    origin at base centre   (XZ centred, Y=0 at the lowest point)
    sits on ground plane    (min Y == 0)
    <= 2000 triangles       (decimated if over)

    python normalize_tile.py in.glb --out tiles/11.glb
    python normalize_tile.py 'raw/*.glb' --outdir tiles/ --max-tris 2000

Reports every check so a failure is visible rather than silently shipped.
"""
import argparse
import glob
import os
import sys


def _venv_dir():
    """The skill's venv, whether this script sits at the skill root or in scripts/."""
    here = os.path.dirname(os.path.abspath(__file__))
    for base in (here, os.path.dirname(here)):
        candidate = os.path.join(base, ".venv")
        if os.path.isdir(candidate):
            return candidate
    return os.path.join(here, ".venv")   # nonexistent, but a stable path to report


def _reexec_in_venv():
    """Re-run this script with the skill's own interpreter, if one exists.

    The skill may be invoked by any agent from any working directory, with
    whatever `python` happens to be on PATH — often a system interpreter that
    has none of the dependencies. Rather than requiring the caller to remember
    to activate anything, the script locates a virtualenv next to the skill and
    hands itself over to it. If there is no venv, it carries on with the
    current interpreter, so a plain `pip install` setup keeps working.
    """
    if os.environ.get("BOARD_TILE_ART_VENV"):
        return  # already re-executed; don't loop

    # Installed skill directories are sometimes read-only, so the venv can't
    # live beside the script. Point this at any interpreter to override.
    override = os.environ.get("BOARD_TILE_ART_PYTHON")
    if override:
        # No path comparison here: .venv/bin/python is typically a symlink to
        # the system interpreter, so realpath() equality gives false matches.
        # The BOARD_TILE_ART_VENV guard above already prevents a re-exec loop.
        os.environ["BOARD_TILE_ART_VENV"] = "1"
        os.execv(override, [override, os.path.abspath(__file__), *sys.argv[1:]])

    # The venv sits at the skill root, but this script has lived both at that
    # root and in a scripts/ subdirectory. Checking only one of them means the
    # lookup silently misses and the script runs against a system interpreter
    # with no dependencies, so both are tried, nearest first.
    venv_dir = _venv_dir()
    # A venv is identified by sys.prefix, NOT by which binary it points at:
    # .venv/bin/python is usually a symlink to the same system interpreter, so
    # comparing resolved binary paths falsely reports "already in the venv".
    if os.path.realpath(sys.prefix) == os.path.realpath(venv_dir):
        return
    for rel in (os.path.join("bin", "python"), os.path.join("Scripts", "python.exe")):
        candidate = os.path.join(venv_dir, rel)
        if not os.path.exists(candidate):
            continue
        os.environ["BOARD_TILE_ART_VENV"] = "1"
        os.execv(candidate, [candidate, os.path.abspath(__file__), *sys.argv[1:]])


_reexec_in_venv()

try:
    import numpy as np
    import trimesh
except ImportError:
    sys.exit(
        "Missing dependencies. Either create the skill's virtualenv:\n"
        "    bash <skill>/setup.sh\n"
        "or install into the current interpreter:\n"
        "    pip install trimesh numpy fast_simplification Pillow"
    )

try:
    from PIL import Image
    HAVE_PIL = True
except ImportError:
    Image = None
    HAVE_PIL = False


def texture_of(mesh):
    """The material's colour image, or None.

    PBR materials (what image-to-3D produces) keep it on `baseColorTexture`;
    trimesh's simpler material uses `image`. Both are checked so the texture
    checks don't quietly pass on a material type they don't recognise.
    """
    mat = getattr(getattr(mesh, "visual", None), "material", None)
    if mat is None:
        return None
    return getattr(mat, "baseColorTexture", None) or getattr(mat, "image", None)


def set_texture(mesh, img):
    mat = getattr(getattr(mesh, "visual", None), "material", None)
    if mat is None:
        return
    if getattr(mat, "baseColorTexture", None) is not None:
        mat.baseColorTexture = img
    else:
        mat.image = img


def pin_slab_colour(mesh, target_hex):
    """Shift the texture so the tile's bare slab lands on an exact colour.

    The slab colour cannot be pinned through the prompt. It is stated in the
    style block and the generator still drifts — measured across three runs of
    one tile: #E5DDCB, #F2E9D1, #C3BBA8. Re-rolling until forty tiles agree is
    not a plan, and a board whose tiles are subtly different creams looks
    broken in a way no single tile reveals.

    So the slab is measured and corrected here. The whole texture is shifted by
    one delta rather than recolouring slab pixels alone: a selective remap has
    to decide what counts as slab, and gets it wrong on white or cream props
    (a paper cup, a painted gate). Drift is global anyway, so a global shift
    shifts it back and leaves every relative colour intact.

    Returns (before_hex, after_hex) or None when there is no texture to fix.
    """
    img = texture_of(mesh)
    if img is None:
        return None
    target = np.array([int(target_hex[i:i + 2], 16) for i in (0, 2, 4)], float)

    a = np.asarray(img.convert("RGB"), float)
    flat = a.reshape(-1, 3)
    mx, mn = flat.max(axis=1), flat.min(axis=1)
    sat = (mx - mn) / np.maximum(mx, 1.0)
    slab = flat[(sat < 0.14) & (mx > 120)]      # low-saturation and lit = bare slab
    if len(slab) < 200:
        return None                              # nothing slab-like; leave it alone
    before = np.median(slab, axis=0)

    shifted = np.clip(a + (target - before), 0, 255).astype(np.uint8)
    set_texture(mesh, Image.fromarray(shifted))
    return (
        "%02X%02X%02X" % tuple(int(c) for c in before),
        target_hex.upper(),
    )


def load_scene(path):
    scene = trimesh.load(path, force="scene", process=False)
    if not scene.geometry:
        sys.exit(f"{path}: no geometry found")
    return scene


def guess_up_axis(mesh, path=""):
    """Determine the source up axis.

    For glTF this is not a guess: the 2.0 spec mandates +Y up, and trimesh has
    already applied the node transforms by the time we see the mesh. So a .glb
    is Y-up by definition and must be left alone.

    That matters because the extent heuristic below actively gets this wrong.
    It assumes the smallest extent is the height, which holds for a flat
    plate-like tile but not for anything with a tall feature: a wall-and-gate
    diorama measuring 1.00 wide x 0.64 tall x 0.70 deep is deeper than it is
    tall, so the heuristic called it Z-up and rotated a correct model onto its
    back — silently, with every check still passing.

    The heuristic is kept for non-glTF inputs (OBJ, PLY, STL), which carry no
    up-axis convention. `--up` overrides either path.
    """
    if os.path.splitext(path)[1].lower() in (".glb", ".gltf"):
        return "y"
    ex, ey, ez = mesh.extents
    return "z" if ez < ex and ez < ey else "y"


def floor_yaw(mesh, band=0.2):
    """Angle the mesh's floor is rotated by, in radians (0 to pi/2).

    Image-to-3D reconstructs in the reference image's frame. That reference is a
    three-quarter view, so a square plot comes back sitting diagonally — 45-52
    degrees is typical. The mesh is fine, but its axis-aligned bounding box is
    then the diamond's box rather than the floor's, so anything that scales by
    the bounding box renders the tile far too small with a skewed floor, and
    tiles touch at their corners instead of tiling.

    Found as the orientation of the floor's minimum-area bounding rectangle.
    Only the bottom `band` of the height is sampled, so walls and props don't
    drag the fit. A square floor is symmetric under 90 degrees, so any of the
    four equivalent answers is equally correct.
    """
    v = mesh.vertices
    if len(v) < 3:
        return 0.0
    y0, y1 = v[:, 1].min(), v[:, 1].max()
    pts = v[v[:, 1] <= y0 + (y1 - y0) * band][:, [0, 2]]
    if len(pts) < 3:
        return 0.0
    best_area, best = None, 0.0
    for deg in np.arange(0, 90, 0.5):
        a = np.radians(deg)
        rot = np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]])
        p = pts @ rot.T
        area = (p[:, 0].max() - p[:, 0].min()) * (p[:, 1].max() - p[:, 1].min())
        if best_area is None or area < best_area:
            best_area, best = area, a
    return float(best)


def to_y_up(mesh, up):
    if up == "z":
        # Z-up -> Y-up: rotate -90 degrees about X.
        m = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])
        mesh.apply_transform(m)
    return mesh


def normalize(path, max_tris=2000, up=None, footprint=1.0, tex_size=1024,
              min_ground_ratio=0.8, max_height=None, slab_color=None, verbose=True):
    scene = load_scene(path)
    mesh = scene.to_mesh() if hasattr(scene, "to_mesh") else scene.dump(concatenate=True)
    if isinstance(mesh, list):
        mesh = trimesh.util.concatenate(mesh)

    report = {"file": os.path.basename(path), "tris_in": len(mesh.faces)}

    # Texture state is tracked from here on. A tile that arrives textured and
    # leaves untextured is a failure, not a detail: it renders plain white in
    # the engine while every geometry check below still says PASS. That is
    # exactly how an untextured tile once shipped unnoticed.
    tex_in = texture_of(mesh)
    report["pillow"] = HAVE_PIL
    report["tex_in"] = tuple(tex_in.size) if tex_in is not None else None

    detected = up or guess_up_axis(mesh, path)
    report["up_detected"] = detected
    mesh = to_y_up(mesh, detected)

    # Decimate BEFORE scaling and centring. Quadric simplification moves
    # vertices, so doing it afterwards knocks the footprint off 1.000 and lifts
    # or sinks the base off Y=0 — small, but it fails the engine's checks.
    if len(mesh.faces) > max_tris:
        # Quadric decimation does not carry UVs through: the result comes back
        # with ColorVisuals and the texture is gone. Trading a tile's artwork
        # for its triangle count is never the right call silently, so this
        # refuses and tells the caller to set the budget at generation time
        # (Tripo's faceLimit), where the mesh is built to fit and keeps its UVs.
        if tex_in is not None:
            report["decimate_refused"] = (
                f"{len(mesh.faces)} tris > budget {max_tris}, but decimating would "
                "discard the texture — re-generate with a lower faceLimit instead"
            )
        else:
            try:
                mesh = mesh.simplify_quadric_decimation(face_count=max_tris)
                report["decimated"] = True
            except Exception as e:
                report["decimate_error"] = str(e)

    # A tile renders a few dozen pixels across; a 4096² texture is ~7 MB per
    # tile once trimesh re-encodes it as PNG, i.e. ~270 MB for a 40-tile board.
    if tex_in is not None and tex_size and max(tex_in.size) > tex_size:
        set_texture(mesh, tex_in.resize((tex_size, tex_size)))

    # Pin the bare slab to the board's fixed colour — see pin_slab_colour().
    report["slab"] = pin_slab_colour(mesh, slab_color.lstrip("#")) if slab_color else None

    # Square the floor to the axes before measuring anything else — see floor_yaw().
    # This has to happen before scaling and centring, both of which read the bounding
    # box, and the bounding box is meaningless while the floor sits diagonally.
    yaw = floor_yaw(mesh)
    report["floor_yaw_deg"] = round(float(np.degrees(yaw)), 1)
    if yaw > 1e-4:
        mesh.apply_transform(trimesh.transformations.rotation_matrix(-yaw, [0, 1, 0]))

    # Scale so the XZ footprint fits exactly in footprint x footprint.
    ext = mesh.extents
    xz = max(ext[0], ext[2])
    if xz <= 0:
        sys.exit(f"{path}: degenerate footprint")
    scale = footprint / xz
    mesh.apply_scale(scale)
    report["scale"] = round(scale, 6)

    # Origin at the centre of the base: XZ centred, lowest point at Y = 0.
    bmin, bmax = mesh.bounds
    offset = np.array([
        -(bmin[0] + bmax[0]) / 2.0,
        -bmin[1],
        -(bmin[2] + bmax[2]) / 2.0,
    ])
    mesh.apply_translation(offset)

    report["tris_out"] = len(mesh.faces)

    b0, b1 = mesh.bounds
    report["footprint"] = (round(float(b1[0] - b0[0]), 4), round(float(b1[2] - b0[2]), 4))
    report["height"] = round(float(b1[1] - b0[1]), 4)
    report["base_y"] = round(float(b0[1]), 6)
    report["centre_xz"] = (round(float((b0[0] + b1[0]) / 2), 6),
                           round(float((b0[2] + b1[2]) / 2), 6))

    tex_out = texture_of(mesh)
    report["tex_out"] = tuple(tex_out.size) if tex_out is not None else None

    # ---- shape warnings -------------------------------------------------
    # These are not spec violations, so they don't fail the file. They flag a
    # mesh that satisfies every measurement above and still sits wrong on a
    # board, which is a failure mode the check table otherwise can't see.
    warn = []

    # A tile is a square plot. When the reference image is composed as a
    # facade — a wall viewed head-on — reconstruction returns a shallow strip
    # instead, and the engine, centring what it is given, parks the tall mass
    # in the MIDDLE of the tile rather than at its back edge. There it stands
    # between the camera and the tile, hiding the player's token. A real case:
    # a 1.00 x 0.64 ground put its wall 0.17 from centre and buried the token.
    fx, fz = report["footprint"]
    ratio = min(fx, fz) / max(fx, fz) if max(fx, fz) else 0
    report["ground_ratio"] = round(ratio, 3)
    if ratio < min_ground_ratio:
        warn.append(
            f"ground is {fx} x {fz} (ratio {ratio:.2f}) — a shallow strip, not a square plot. "
            "The tall mass will land mid-tile and occlude. Re-generate with the subject "
            "described as a square plot seen from above, mass at the back."
        )

    # Height is free in principle, but a tall piece hides the token on the far
    # side of a ring board. The budget depends on the engine's camera, so it is
    # only checked when the caller supplies one.
    if max_height and report["height"] > max_height:
        warn.append(
            f"height {report['height']} exceeds the board's budget of {max_height} — "
            "this piece will hide the token when its tile is on the far side"
        )

    report["warnings"] = warn

    tol = 1e-4
    report["checks"] = {
        "footprint_1x1": abs(max(report["footprint"]) - footprint) < tol,
        "sits_on_ground": abs(report["base_y"]) < tol,
        "centred_xz": all(abs(c) < tol for c in report["centre_xz"]),
        "tri_budget": report["tris_out"] <= max_tris,
        # Without Pillow, trimesh drops the texture at LOAD, so tex_in is
        # already None and a "survived" check would vacuously pass. The
        # imaging check is what catches that case.
        "imaging_available": HAVE_PIL,
        "texture_survived": (tex_in is None) or (tex_out is not None),
    }
    report["ok"] = all(report["checks"].values())
    return mesh, report


def print_report(r):
    mark = "PASS" if r["ok"] else "FAIL"
    print(f"\n{r['file']}  [{mark}]")
    print(f"  up axis detected : {r['up_detected']}")
    print(f"  floor squared by : {r['floor_yaw_deg']} deg")
    print(f"  triangles        : {r['tris_in']} -> {r['tris_out']}")
    print(f"  scale applied    : {r['scale']}")
    print(f"  footprint (X,Z)  : {r['footprint']}   height: {r['height']}"
          f"   ground ratio: {r['ground_ratio']}")
    print(f"  base Y           : {r['base_y']}      centre XZ: {r['centre_xz']}")
    if r.get("slab"):
        print(f"  slab colour      : #{r['slab'][0]} -> #{r['slab'][1]}")
    tex = lambda t: f"{t[0]}x{t[1]}" if t else "none"
    print(f"  texture          : {tex(r['tex_in'])} -> {tex(r['tex_out'])}"
          + ("" if r["pillow"] else "   (Pillow MISSING — texture dropped at load)"))
    if r.get("decimate_error"):
        print(f"  decimation FAILED: {r['decimate_error']}")
    if r.get("decimate_refused"):
        print(f"  decimation REFUSED: {r['decimate_refused']}")
    for name, passed in r["checks"].items():
        print(f"    {'ok ' if passed else 'BAD'}  {name}")
    for w in r.get("warnings", []):
        print(f"  WARNING: {w}")


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("inputs", nargs="?", help="input GLB, or a glob like 'raw/*.glb'")
    p.add_argument("--check-env", action="store_true",
                   help="report which interpreter and dependencies are in use, then exit")
    p.add_argument("--out", help="output path (single input only)")
    p.add_argument("--outdir", help="output directory (required for globs)")
    p.add_argument("--max-tris", type=int, default=2000, help="triangle budget (default 2000)")
    p.add_argument("--footprint", type=float, default=1.0, help="tile units (default 1.0)")
    p.add_argument("--min-ground-ratio", type=float, default=0.8,
                   help="warn when the ground is shallower than this fraction of its width "
                        "(default 0.8) — a strip-shaped tile centres its mass badly")
    p.add_argument("--max-height", type=float,
                   help="warn above this height in tile units; depends on the board's camera "
                        "and token, so there is no safe default")
    p.add_argument("--slab-color",
                   help="pin the tile's bare slab to this hex (e.g. E9E2D0) by shifting the "
                        "whole texture; the generator cannot hold a colour across a board")
    p.add_argument("--tex-size", type=int, default=1024,
                   help="cap the texture's longest side (default 1024; 0 to leave it alone). "
                        "Generators return 4096, which trimesh re-encodes to a ~7MB PNG per tile")
    p.add_argument("--up", choices=["y", "z"],
                   help="force source up axis instead of auto-detecting")
    args = p.parse_args()

    if args.check_env:
        try:
            import fast_simplification  # noqa: F401
            decim = "available"
        except ImportError:
            decim = "MISSING — triangle budget cannot be enforced"
        venv_dir = _venv_dir()
        if os.path.realpath(sys.prefix) == os.path.realpath(venv_dir):
            in_venv = "yes" + (" (re-executed)" if os.environ.get("BOARD_TILE_ART_VENV") else "")
        elif os.path.isdir(venv_dir):
            in_venv = "NO — a .venv exists but is not in use"
        else:
            in_venv = "no venv present; using the current interpreter"
        print(f"interpreter        : {sys.executable}")
        print(f"skill venv in use  : {in_venv}")
        print(f"trimesh            : {trimesh.__version__}")
        print(f"numpy              : {np.__version__}")
        print(f"Pillow             : "
              + (__import__("PIL").__version__ if HAVE_PIL
                 else "MISSING — textures are silently dropped at load"))
        print(f"decimation backend : {decim}")
        return

    if not args.inputs:
        p.error("an input GLB or glob is required (or use --check-env)")

    paths = sorted(glob.glob(args.inputs))
    if not paths and os.path.exists(args.inputs):
        paths = [args.inputs]
    if not paths:
        sys.exit(f"no such file: {args.inputs}")
    if len(paths) > 1 and not args.outdir:
        sys.exit("multiple inputs — use --outdir")

    failures = 0
    for src in paths:
        mesh, report = normalize(src, args.max_tris, args.up, args.footprint, args.tex_size,
                                 args.min_ground_ratio, args.max_height, args.slab_color)
        if args.out and len(paths) == 1:
            dst = args.out
        else:
            base = os.path.splitext(os.path.basename(src))[0]
            dst = os.path.join(args.outdir or ".", f"{base}.glb")
        os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
        mesh.export(dst)
        print_report(report)
        print(f"  -> {dst}")
        failures += 0 if report["ok"] else 1

    if failures:
        sys.exit(f"\n{failures} file(s) failed spec checks")
    print(f"\nall {len(paths)} file(s) pass")


if __name__ == "__main__":
    main()
