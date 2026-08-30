# The one prompt, and why every icon uses it

    A single mobile game UI icon on a pure flat CHROMA GREEN background. Subject: {SUBJECT}.
    Bold chunky silhouette, thick clean shapes, very high contrast, saturated jewel colours
    with a warm gold rim light, simple 3D game-asset shading, no fine detail. Centred,
    generous even margin, subject fills about two thirds of the frame. The background is one
    single solid green colour edge to edge, absolutely flat, no gradient, no vignette, no
    shadow cast onto it. No text, no letters, no numbers, no logos, no watermark.

`model_bytedance-seedream-5-0-pro`, 1024×1024, `numImages: 1`, seven at a time.

**"Bold chunky silhouette … no fine detail" is the load-bearing clause.** These render at 19px in
a HUD pill and 26px on a play button. A beautifully rendered object at 19px is grey mush and
worse than the emoji it replaced — measured, by putting the first one on screen at 13, 16, 26, 40
and 64 and looking. The test is never "is it good at 1024".

**THE GROUND IS GREEN, AND THAT WAS LEARNED THE EXPENSIVE WAY.** It was magenta first, on the
reasoning that no icon in this set is pink. True — and irrelevant, because **purple is this
model's default jewel-tone fill**, purple sits inside magenta's key radius, and the key does not
care about the difference. Two icons came back as outlines with see-through middles: a collectible
card that was a picture frame around nothing, and a market stall you could see through. Both were
good generations ruined at the key. Regenerating on the same ground picked purple again, which is
the tell that it is not a bad draw.

Green fixes it because nothing in this palette — gold, navy, cream, white — is green. The one
exception is the energy bolt, which is teal: generate that one on magenta. And say it in the
prompt as well as relying on the ground: *"no green and no purple and no magenta anywhere in the
subject"* is what turned the card from 5% of frame to 38%.

**"Pure flat" is the second.** The models here cannot emit transparency, so the ground is
keyed out afterwards (tools/icon-art/finish.sh). Magenta because no icon in this set is pink —
keying green would eat the gold rim light, and keying white or black leaves a bright or dark
fringe on a UI that is neither. The model drifts a few points off pure magenta every time, which
is why finish.sh SAMPLES the corner instead of hardcoding the key.

## The subjects

| file | subject |
|---|---|
| `album` | a collector's card album — a ring binder open with trading cards slotted in, front card showing a gold star |
| `collectibles` | one gilt-framed collectible card seen face-on, a large gold star on it, a soft gold glow behind |
| `coins` | a small stack of thick gold coins, the top one tilted and catching the light |
| `trophies` | a gold two-handled trophy cup on a short plinth |
| `episodes` | a film clapperboard, closed, three-quarter view, with a gold play triangle on its face |
| `dice` | one white game die showing six pips, tilted, with a gold edge highlight |
| `energy` | a single fat lightning bolt, electric teal-white with a gold outline |
| `store` | a small market stall with a striped awning, seen head-on |

## The six status bands

The level pill's icon is the player's RANK, and the ladder is about ACCESS — on the set as
nobody, in the audience, through the door, at the party, recognised at it, running it. Six
silhouettes, no two confusable at 19px, which is the whole reason the emoji ladder was replaced
(it had ⭐ and 🌟 on adjacent rungs). Same prompt template, same magenta ground.

| file | subject |
|---|---|
| `rank-extra` | a black-and-white film clapperboard, closed, seen head-on |
| `rank-fan` | a red-and-white striped popcorn tub, overflowing |
| `rank-insider` | a single gold cinema admission ticket with a torn stub edge |
| `rank-regular` | two champagne coupes touching in a toast |
| `rank-vip` | a pair of dark sunglasses, folded, head-on |
| `rank-producer` | a gold crown with three points and a red velvet band |
