#!/usr/bin/env bash
#
# Start Harbour Heights.
#
#   ./start.sh          → http://localhost:8125/index.html
#   ./start.sh 9000     → a different port
#
# A thin wrapper over serve.py, which is the only supported way to run the
# project: file:// URLs cannot load the board (it is an ES module), and a plain
# http.server breaks video seeking (no HTTP Range) and serves stale files after
# an edit (no no-store). See serve.py's own docstring.
#
# It cd's to its own directory first, so it works from anywhere.
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "start.sh: python3 not found — install it, or run the server yourself." >&2
  exit 1
fi

exec python3 serve.py "$@"
