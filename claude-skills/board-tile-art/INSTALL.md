# Install

```bash
unzip board-tile-art.zip -d ~/.claude/skills/
cd ~/.claude/skills/board-tile-art
bash setup.sh
```

Then **restart Claude Code** — the skills list is read at startup, so a skill added
mid-session is found only if you point at the file directly. Confirm with `/skills`.

If it still doesn't appear, check you have exactly this path and no extra nesting:

```bash
ls ~/.claude/skills/board-tile-art/SKILL.md
```

`cp -r board-tile-art ~/.claude/skills/board-tile-art/` when the directory already
exists produces `.../board-tile-art/board-tile-art/SKILL.md`, which discovery misses.

## Two copies?

A project-scoped `.claude/skills/` in a repo shadows nothing but loads only when you
start Claude Code from that repo. If edits seem to vanish, check whether both exist:

```bash
md5sum ~/.claude/skills/board-tile-art/scripts/normalize_tile.py \
       .claude/skills/board-tile-art/scripts/normalize_tile.py 2>/dev/null
```

Different hashes mean you are editing one copy and running the other.

## Scenario MCP

Required — the skill does nothing without it. See `README.md`.

```bash
claude mcp add --transport http scenario https://mcp.scenario.com/mcp --scope user
```

## Verify

```bash
python3 ~/.claude/skills/board-tile-art/scripts/normalize_tile.py --check-env
```

Every line should report a version. `Pillow: MISSING` means textures will be dropped
silently — re-run `setup.sh` before generating anything.
