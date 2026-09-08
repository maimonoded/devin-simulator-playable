#!/usr/bin/env bash
#
# Finish and tag a whole batch from a file of "<card-id> <signed-url>" lines.
#
#   tools/card-art/finish-batch.sh batch.txt
#
# Exists because doing this inline in a shell loop got it wrong twice in one
# minute, both times silently:
#
#   * the inner command ate the loop's stdin, so the loop ran once -- fixed
#     here by redirecting each call from /dev/null;
#   * and `python3 tag-card.py $ids` passed ONE argument, because zsh does not
#     word-split unquoted expansions the way bash does. tag-card.py then
#     reported every card as missing while the files sat on disk, which reads
#     exactly like the failure it is meant to detect.
#
# An array and an explicit "${ids[@]}" is the fix for the second. Run from the
# repo root.
set -euo pipefail

list="${1:?usage: finish-batch.sh <file of '<id> <url>' lines>}"
here="$(dirname "$0")"
ids=()

while read -r id url; do
  [ -z "${id:-}" ] && continue
  "$here/finish-card.sh" "$id" "$url" </dev/null
  ids+=("$id")
done < "$list"

[ ${#ids[@]} -gt 0 ] || { echo "finish-batch.sh: nothing to tag" >&2; exit 1; }
python3 "$here/tag-card.py" "${ids[@]}"
node "$here/audit.js"
