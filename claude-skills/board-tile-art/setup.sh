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

if [ ! -d "$VENV" ]; then
  echo "creating venv at $VENV"
  python3 -m venv "$VENV"
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
