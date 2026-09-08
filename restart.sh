#!/usr/bin/env bash
#
# Restart Harbour Heights: stop.sh, then start.sh.
#
#   ./restart.sh           → restart on 8125
#   ./restart.sh 9000      → restart on a particular port
#   ./restart.sh --force   → stop the port even if another tree is serving it
#
# Deliberately thin. Everything that could go wrong here — a port held by
# another worktree, a process that is not ours, a browser opened too early —
# is already reasoned about in the two scripts this calls, and a third copy of
# that reasoning is a third place for it to drift.
#
# STOPPING IS ALLOWED TO FIND NOTHING. "Restart" when the server is not running
# means "start", not "fail" — so a stop that reports nothing to stop is a
# success here. What is NOT ignored is stop.sh refusing: if the port belongs to
# another working tree, starting on top of that refusal would hand you
# start.sh's next free port instead, and you would be reading a server on 8126
# while believing you had restarted the one on 8125. So a refusal stops us, and
# says so.
#
# OPEN=1 is passed through to start.sh, which opens a browser once the server
# answers.
set -euo pipefail

cd "$(dirname "$0")"

# Split the port from the flags so both children get what they understand:
# stop.sh takes --force, start.sh does not.
force=0
port=""
for arg in "$@"; do
  case "$arg" in
    -f|--force) force=1 ;;
    -h|--help)
      sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    ''|*[!0-9]*)
      echo "restart.sh: not a port: $arg" >&2
      echo "usage: ./restart.sh [port] [--force]" >&2
      exit 2 ;;
    *) port="$arg" ;;
  esac
done
port="${port:-8125}"

stop_args=("$port")
[ "$force" = "1" ] && stop_args+=(--force)

./stop.sh "${stop_args[@]}"

# exec, so ctrl-c reaches the server rather than a wrapper holding it.
exec ./start.sh "$port"
