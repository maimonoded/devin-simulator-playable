#!/usr/bin/env bash
#
# Start Harbour Heights.
#
#   ./start.sh          → http://localhost:8125/index.html
#   ./start.sh 9000     → start on a particular port instead
#
# A thin wrapper over serve.py, which is the only supported way to run the
# project: file:// URLs cannot load the board (it is an ES module), and a plain
# http.server breaks video seeking (no HTTP Range) and serves stale files after
# an edit (no no-store). See serve.py's own docstring.
#
# ---- IT HANDLES THE PORT ITSELF ----
#
# "Address already in use" is the one way this script used to fail, and it left
# the reader holding a Python traceback about socket.bind -- which says nothing
# about what to do next. A leftover server from an earlier session is the normal
# cause, not a rare one.
#
# So: if the port is free, use it. If something is already serving THIS working
# tree there, that is the thing you wanted -- say so and stop. If something else
# holds the port, step up to the next free one and say loudly that it moved.
#
# The middle case has to be checked rather than assumed, because this repo keeps
# several worktrees on different branches and any of them may have left a server
# behind. Silently reusing one would serve the wrong branch and look like the
# code had not changed. So it compares the served index.html against the local
# one, byte for byte, and treats a mismatch as somebody else's server.
#
# OPEN=1 opens a browser once the server answers (start.command sets it).
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "start.sh: python3 not found — install it, or run the server yourself." >&2
  exit 1
fi

want="${1:-8125}"

port_busy() { (: <>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

# Is the server on this port serving the tree we are standing in?
serving_this_tree() {
  local body
  body="$(curl -fsS --max-time 2 "http://127.0.0.1:$1/index.html" 2>/dev/null)" || return 1
  [ "$body" = "$(cat index.html)" ]
}

port="$want"
if port_busy "$port"; then
  if serving_this_tree "$port"; then
    echo "Harbour Heights is already running → http://localhost:$port/index.html"
    echo "(started earlier, and serving this working tree — nothing to do)"
    [ "${OPEN:-0}" = "1" ] && open "http://localhost:$port/index.html" 2>/dev/null
    exit 0
  fi
  # Someone else's: step up rather than fight over it.
  for _ in $(seq 1 40); do
    port=$((port + 1))
    port_busy "$port" || break
  done
  if port_busy "$port"; then
    echo "start.sh: ports $want-$port are all busy. Pass one explicitly: ./start.sh 9999" >&2
    exit 1
  fi
  echo "Port $want is taken by something else — using $port instead."
fi

if [ "${OPEN:-0}" = "1" ]; then
  # Backgrounded, because the exec below never returns. curl retries rather than
  # sleeping a guessed interval — a browser that arrives early shows an error.
  (
    for _ in $(seq 1 40); do
      curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:$port/index.html" && break
      sleep 0.25
    done
    open "http://localhost:$port/index.html"
  ) &
fi

exec python3 serve.py "$port"
