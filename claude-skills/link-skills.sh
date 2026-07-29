#!/usr/bin/env bash
# Set up this repo's Claude Code skills and link them into .claude/skills.
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
# For each skill it runs setup.sh first, if there is one — board-tile-art's builds a
# virtualenv and installs trimesh, numpy, Pillow — and then makes the link. Setup comes
# first on purpose: a linked skill that cannot run is worse than one that is not there yet,
# because Claude Code will offer it and it will fail at the first command.
#
# Re-running is safe. Pass --no-setup to skip straight to linking when the environments are
# already good and you just want the links back.
#
# Everything here resolves from this script's own location, so the repo can live anywhere
# and be cloned under any name.

set -euo pipefail

run_setup=1
for arg in "$@"; do
  case "$arg" in
    --no-setup) run_setup=0 ;;
    -h|--help) sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/.." && pwd)"
dest="$repo/.claude/skills"

mkdir -p "$dest"

linked=0
failed=()

for skill in "$here"/*/; do
  name="$(basename "$skill")"

  if [ ! -f "$skill/SKILL.md" ]; then
    echo "skip    $name — no SKILL.md, so Claude Code would not load it anyway"
    continue
  fi

  if [ "$run_setup" = 1 ] && [ -f "$skill/setup.sh" ]; then
    echo "setup   $name"
    # Run it from the skill's own directory: setup.sh resolves its paths from its own
    # location, but anything it shells out to should still see the skill as the cwd.
    if ( cd "$skill" && bash setup.sh >/dev/null 2>&1 ); then
      echo "        ok"
    else
      # Don't abort — the other skills are still worth linking, and this one's docs are
      # still readable. Report it at the end so it cannot scroll past unnoticed.
      echo "        FAILED — re-run 'bash $name/setup.sh' to see why" >&2
      failed+=("$name")
    fi
  fi

  target="$dest/$name"
  # A real directory here is someone's own work, not ours to delete.
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    echo "ERROR   $target exists and is not a symlink — move it aside and re-run" >&2
    exit 1
  fi
  # Relative, so the link survives the repo being moved or cloned somewhere else.
  ln -sfn "../../claude-skills/$name" "$target"
  echo "linked  .claude/skills/$name -> claude-skills/$name"
  linked=$((linked + 1))
done

echo
echo "$linked skill(s) linked. Restart Claude Code if they do not show up."
if [ ${#failed[@]} -gt 0 ]; then
  echo "setup failed for: ${failed[*]}" >&2
  exit 1
fi
