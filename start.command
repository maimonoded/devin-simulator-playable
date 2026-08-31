#!/usr/bin/env bash
#
# Double-click me in Finder.
#
# Finder opens a .command file in Terminal and runs it; a .sh file it hands to a
# text editor instead. So this exists purely for the extension -- everything else,
# including choosing the port, lives in start.sh.
#
# It sets OPEN=1, which start.sh does not default to: from a shell the URL is
# already printed in front of you and a tab opening underneath you is a nuisance,
# but from a double-click there is nowhere else for the game to appear.
set -euo pipefail
cd "$(dirname "$0")"
OPEN=1 exec ./start.sh "$@"
