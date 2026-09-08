# The UI icons

The toolbar and the play controls used to be EMOJI. Emoji are somebody else's art direction:
they change with the operating system, they carry a colour palette that has nothing to do with
this game, and a 📔 does not say "collectibles" to anyone who has not been told.

## The one constraint that decides everything

**They render at 13–18px in the HUD pills and about 26px on the play buttons.** That is small
enough that detail is not merely wasted, it is harmful — a painted object at 13px is grey mush,
and worse than the emoji it replaced. So every prompt asks for the same thing: a **bold, simple
silhouette**, chunky forms, high contrast, no fine detail, no text.

The test for any of these is not "is it pretty at 1024px". It is "can I tell what it is at 13".

## The pipeline

```
python3 tools/icon-art/make.py            # what is missing, and the prompt for each
tools/icon-art/finish.sh <name> <url>     # download, square-crop, 256px, transparent WebP
```

Generated at 1024×1024 on a FLAT MID-GREY ground — not on transparency, which the image models
here do not offer, and not on white or black, either of which bleeds into a light or dark rim
when it is keyed out. The grey is keyed with ImageMagick's fuzz, which is why the prompt insists
on a plain single-colour background: a gradient cannot be keyed cleanly.
