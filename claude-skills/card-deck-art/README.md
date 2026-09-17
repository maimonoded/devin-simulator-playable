# card-deck-art

Generates the painted parts of Harbour Heights' pull deck — the card back and the joker cards —
through Scenario, and installs them into `assets/cards/`.

The 52 numbered cards are **not** generated: their suits and ranks are vector paths in
[js/ui/card-art.js](../../js/ui/card-art.js), because a pip has to be the same shape at 92px in
the middle of a card and at 34px in its corner. See [SKILL.md](SKILL.md).

A missing PNG is not an error — the vector drawing renders instead, always. That is what makes
this skill safe to re-run and safe to abandon halfway.

Needs the Scenario MCP server: [../board-tile-art/INSTALL.md](../board-tile-art/INSTALL.md).
