# Setup — connecting the Scenario MCP server

This skill talks to Scenario entirely through its remote MCP server. Nothing else is needed: no API key in your environment, no SDK, no local server process. Connect once and the `scenario:*` tools show up in every session.

Server URL: `https://mcp.scenario.com/mcp` (Streamable HTTP + OAuth — no `mcp-remote` bridge needed for Claude Code)

---

## Claude Code

### Install the skill

```bash
mkdir -p ~/.claude/skills
cp -r board-tile-art ~/.claude/skills/
```

`~/.claude/skills/` makes it available everywhere. For a single repo, use `.claude/skills/` in the project root instead.

### Add the MCP server

```bash
claude mcp add --transport http scenario https://mcp.scenario.com/mcp
```

Then:

1. Start a new Claude Code session (the config loads at startup).
2. Ask it something Scenario-related — "list my Scenario teams" is the standard smoke test.
3. A browser tab opens for OAuth. Log in to Scenario, click **Authorize**.
4. Back in the terminal, you're connected.

Scope matters: `claude mcp add` defaults to the current project. Add `--scope user` to make the server available in every project, which is usually what you want for an art pipeline you'll use across repos.

### Verify

```
/mcp
```

Lists connected servers and their status. `scenario` should show as connected. Then:

```
List my Scenario teams and projects
```

If that returns your workspace, the skill is ready to run.

### API key instead of OAuth

Only needed for headless or CI use, where nobody can click through a browser:

```bash
claude mcp add --transport http scenario \
  https://mcp.scenario.com/mcp \
  --header "Authorization: Basic $(echo -n 'KEY:SECRET' | base64)"
```

Key pairs come from the Scenario dashboard under **Settings → API Keys**. For normal interactive work, prefer OAuth — nothing lands in your shell history or config files.

---

## Claude Desktop

Settings → Connectors → **Add custom connector**, paste `https://mcp.scenario.com/mcp`, then quit and restart Claude Desktop so the config loads. OAuth triggers on first use.

## claude.ai

Settings → Connectors → **Add custom connector**, same URL, complete OAuth in the browser. Custom connectors require a paid plan (Pro / Max / Team / Enterprise).

---

## Local dependencies

Only `scripts/normalize_tile.py` runs locally. Recommended — a virtualenv owned by the skill:

```bash
bash setup.sh
```

That creates `.venv/` inside the skill directory and installs `trimesh`, `numpy`, `Pillow` and `fast_simplification` into it.

**Pillow is not optional.** Without it trimesh cannot decode a GLB's embedded texture: it loads the material with no image and exports an untextured mesh — silently, no warning, with every geometry check still reporting PASS. The tile then renders plain white in the engine. `--check-env` and the per-tile report both call this out now, but an environment built before Pillow was added to `setup.sh` will have produced untextured tiles; re-run `setup.sh` and re-normalize them. Nothing needs activating: the script checks for `.venv/` next to itself and re-executes with that interpreter, so it works no matter which `python` an agent happens to call or what directory it runs from.

Verify at any time:

```bash
python3 scripts/normalize_tile.py --check-env
```

It reports the interpreter actually in use, so a skill silently running against the wrong environment is visible rather than mysterious.

If the skill lives somewhere read-only and a venv can't sit beside it, point the script at any interpreter instead:

```bash
export BOARD_TILE_ART_PYTHON=/path/to/venv/bin/python
```

With no venv and no override, it falls back to the current interpreter — so a plain `pip install trimesh numpy Pillow fast_simplification` still works.

`fast_simplification` is the decimation backend. Without it, trimesh's `simplify_quadric_decimation` raises `ModuleNotFoundError` and the triangle budget goes unenforced. The script reports this rather than shipping over-budget meshes, but installing it saves the round trip.

## Teams and projects

Scenario won't guess a default workspace when your account has more than one team or project — it will ask which to use. Answering once per session is enough; the skill passes the same `team_id` and `project_id` on every call afterward.

## Known friction

**Downloading assets on claude.ai.** The claude.ai sandbox blocks `cdn.cloud.scenario.com` by default, so pulling a finished GLB down for normalization fails with `x-deny-reason: host_not_allowed`. Add that host to your network egress settings, or run `normalize_tile.py` on your own machine. Claude Code has no such restriction — the full pipeline runs end to end, which is the main reason to run this skill there.

**Model IDs are pinned.** `references/mcp-path.md` names the exact base model and LoRA. They're pinned deliberately: swapping models mid-board changes the look. If a pinned model is ever retired, `scenario:recommend` will find a replacement, but treat that as a style version bump and re-run the whole board.
