#!/usr/bin/env bash
#
# Stop Harbour Heights.
#
#   ./stop.sh           → stop the server on 8125
#   ./stop.sh 9000      → stop the one on a particular port
#   ./stop.sh --force   → stop whatever holds the port, even if it is not ours
#
# ---- IT REFUSES TO KILL SOMEBODY ELSE'S SERVER ----
#
# This repo keeps several worktrees on different branches, and any of them may
# have a server running. 8125 is the default for all of them, so the process
# sitting on it is quite often NOT the one belonging to the tree you are
# standing in — that has already caused a session to be told "8125 belongs to
# another checkout" and work around it on 8126.
#
# A stop script that blindly killed the listener would therefore take down a
# colleague's server, and the only symptom they would get is their browser
# going dead while they were reading it. So this asks the same question
# start.sh asks before it reuses a port: fetch index.html and compare it, byte
# for byte, against the local one. A match means the server is serving THIS
# tree and is ours to stop. A mismatch means hands off, and it says whose it
# might be rather than just refusing.
#
# --force overrides that, for when you know the other tree is finished with it.
#
# It also checks the process really is a serve.py before signalling it: a port
# is a weak claim on an identity, and killing an unrelated program because it
# happened to bind 8125 would be worse than doing nothing.
set -euo pipefail

cd "$(dirname "$0")"

force=0
port=""
for arg in "$@"; do
  case "$arg" in
    -f|--force) force=1 ;;
    -h|--help)
      sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    ''|*[!0-9]*)
      echo "stop.sh: not a port: $arg" >&2
      echo "usage: ./stop.sh [port] [--force]" >&2
      exit 2 ;;
    *) port="$arg" ;;
  esac
done
port="${port:-8125}"

port_busy() { (: <>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

# Is the server on this port serving the tree we are standing in?
serving_this_tree() {
  local body
  body="$(curl -fsS --max-time 2 "http://127.0.0.1:$1/index.html" 2>/dev/null)" || return 1
  [ "$body" = "$(cat index.html)" ]
}

if ! port_busy "$port"; then
  echo "Nothing is listening on $port — already stopped."
  exit 0
fi

if ! command -v lsof >/dev/null 2>&1; then
  echo "stop.sh: lsof not found, so the process holding $port cannot be identified." >&2
  echo "Stop it from the terminal running it (ctrl-c), or install lsof." >&2
  exit 1
fi

# Only listeners, and only ones that actually look like our server. A port is a
# weak claim on an identity; the command line is a much better one.
pids=""
for pid in $(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null || true); do
  case "$(ps -p "$pid" -o command= 2>/dev/null || true)" in
    *serve.py*) pids="$pids $pid" ;;
  esac
done
pids="$(echo "$pids" | xargs || true)"

if [ -z "$pids" ]; then
  echo "Port $port is busy, but nothing on it looks like serve.py:" >&2
  lsof -i "tcp:$port" -sTCP:LISTEN 2>/dev/null | sed 's/^/  /' >&2 || true
  echo "Leaving it alone — stop it yourself if it is yours." >&2
  exit 1
fi

if [ "$force" != "1" ] && ! serving_this_tree "$port"; then
  echo "The server on $port is serving a DIFFERENT working tree, so it is not mine to stop." >&2
  echo "  here: $(pwd)" >&2
  for pid in $pids; do
    echo "  pid $pid: $(ps -p "$pid" -o command= 2>/dev/null | sed 's/^ *//')" >&2
  done
  echo "Stop it from its own checkout, or re-run as: ./stop.sh $port --force" >&2
  exit 1
fi

# TERM first: serve.py should get the chance to close its sockets. KILL only for
# the one that ignores it, and only after it has actually had a moment.
kill $pids 2>/dev/null || true
for _ in $(seq 1 40); do
  port_busy "$port" || break
  sleep 0.1
done
if port_busy "$port"; then
  kill -9 $pids 2>/dev/null || true
  for _ in $(seq 1 20); do
    port_busy "$port" || break
    sleep 0.1
  done
fi

if port_busy "$port"; then
  echo "stop.sh: $port is still held after SIGKILL (pids:$pids)." >&2
  exit 1
fi
echo "Stopped Harbour Heights on $port (pid$([ "$(echo "$pids" | wc -w)" -gt 1 ] && echo s):$pids)."
