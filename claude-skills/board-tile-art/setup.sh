#!/usr/bin/env bash
# Create the skill's own virtualenv and install its dependencies into it.
#
# Run once after installing the skill:
#     bash setup.sh
#
# scripts/normalize_tile.py detects .venv/ automatically and re-executes itself
# with that interpreter, so nothing needs activating and no agent has to
# remember which python to call.
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SKILL_DIR/.venv"

# A virtualenv records absolute paths. Every script in bin/ carries a shebang naming its
# interpreter by full path, so moving the skill — as happened when these moved out of
# ~/.claude/skills into the repo — leaves bin/pip pointing at a directory that no longer
# exists. bin/python keeps working, because it is a symlink and derives its prefix from
# where it actually sits, which makes a moved venv look healthy right up until something
# calls pip.
#
# `python3 -m venv` over an existing directory does NOT repair this: it rewrites pyvenv.cfg
# but leaves existing bin/ scripts alone, and ensurepip no-ops when pip is already current.
# So test the thing that actually breaks, and rebuild if it is broken.
if [ -d "$VENV" ]; then
  if ! "$VENV/bin/python" -c "" >/dev/null 2>&1 \
     || { [ -x "$VENV/bin/pip" ] && ! "$VENV/bin/pip" --version >/dev/null 2>&1; }; then
    echo "venv at $VENV was built somewhere else — rebuilding it here"
    rm -rf "$VENV"
  fi
fi

if [ ! -d "$VENV" ]; then
  echo "creating venv at $VENV"
  python3 -m venv "$VENV"
else
  echo "venv already present at $VENV"
fi

"$VENV/bin/python" -m pip install --upgrade pip --quiet
# Pillow is NOT optional. Without it trimesh cannot decode a GLB's embedded
# texture, so it loads the material with no image and exports an untextured
# mesh — silently, no warning. The tile then renders plain white in the engine
# while every geometry check still reports PASS.
"$VENV/bin/python" -m pip install --quiet \
  trimesh \
  numpy \
  fast_simplification \
  Pillow

echo
echo "installed into $VENV"
"$VENV/bin/python" - <<'PY'
import sys, trimesh, numpy
try:
    import fast_simplification
    decim = "yes"
except ImportError:
    decim = "NO — triangle budget will not be enforced"
try:
    import PIL
    imaging = PIL.__version__
except ImportError:
    imaging = "MISSING — textures will be silently dropped"
print(f"  python              : {sys.executable}")
print(f"  trimesh             : {trimesh.__version__}")
print(f"  numpy               : {numpy.__version__}")
print(f"  Pillow              : {imaging}")
print(f"  decimation backend  : {decim}")
PY
echo
echo "verify with:  python3 scripts/normalize_tile.py --check-env"
