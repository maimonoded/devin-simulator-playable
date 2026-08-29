#!/usr/bin/env bash
#
# Double-click me in Finder.
#
# Finder opens a .command file in Terminal and runs it; a .sh file it hands to a
# text editor instead. So this exists purely for the extension -- the work is all
# in start.sh, which is still the thing to run from a shell.
#
# It also opens the browser, which start.sh deliberately does not: from a shell
# you already have the URL in front of you, and a browser tab opening under you
# is a nuisance. From a double-click there is nowhere else for the game to appear.
set -euo pipefail

cd "$(dirname "$0")"

PORT="${1:-8125}"

# After the server is actually listening -- backgrounded, because start.sh below
# never returns. curl retries rather than sleeping a guessed interval.
(
  for _ in $(seq 1 40); do
    curl -s -o /dev/null "http://localhost:$PORT/index.html" && break
    sleep 0.25
  done
  open "http://localhost:$PORT/index.html"
) &

exec ./start.sh "$PORT"
