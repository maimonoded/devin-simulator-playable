#!/usr/bin/env bash
# Link this repo's skills into .claude/skills, where Claude Code looks for project skills.
#
# Why the indirection: the skills belong in git — they are built around this repo's asset
# contracts (assets/tiles/ART-BRIEF.md, assets/env/ART-BRIEF-ENV.md) and drift the moment
# they live apart from them. But .claude is Claude Code's own working directory, full of
# local state nobody wants in a diff, so the whole of it is git-ignored. The skills
# therefore live in claude-skills/ and get symlinked into place.
#
# Run once after cloning:
#
#     ./claude-skills/link-skills.sh
#
# It is safe to re-run — it refreshes the links and adds any new skill.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/.." && pwd)"
dest="$repo/.claude/skills"

mkdir -p "$dest"

linked=0
for skill in "$here"/*/; do
  name="$(basename "$skill")"
  if [ ! -f "$skill/SKILL.md" ]; then
    echo "skip   $name — no SKILL.md, so Claude Code would not load it anyway"
    continue
  fi
  target="$dest/$name"
  # A real directory here is someone's own work, not ours to delete.
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    echo "ERROR  $target exists and is not a symlink — move it aside and re-run" >&2
    exit 1
  fi
  # Relative, so the link survives the repo being moved or cloned somewhere else.
  ln -sfn "../../claude-skills/$name" "$target"
  echo "linked .claude/skills/$name -> claude-skills/$name"
  linked=$((linked + 1))
done

echo
echo "$linked skill(s) linked. Restart Claude Code if they do not show up."
