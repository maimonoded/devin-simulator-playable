"use strict";
/* Series 001 — the show the board is set in, and the only one with content.

   FREE (price []). It is the first thing on the spine, and a priced first series would leave a
   new player with nothing to roll toward.

   The ITEM SET lives here because items are themed per series: these five are the props the
   story turns on, so a second series would bring its own five rather than inherit these. Ids
   are global — a price names an item and nothing else — and they are what the deck cards and
   the bonus games grant, so they are short and they do not change.

   `art` is a cover for the library's shelf. Nothing ships one yet; the library has to draw a
   series whose art is missing, exactly as the board draws a tile with no assets/tiles/N.glb. */

Catalog.addSeries({
  id: "001",
  title: "A Husband by Christmas",
  blurb: "Simon has been sleeping rough for six months and letting the country believe he is dead. " +
         "Victoria needs a groom by Christmas and has just found her fiancé with her own cousin. " +
         "One signature later they are married, and neither of them has told the truth yet.",
  items: [
    { id: "cert",      name: "Marriage Certificate", icon: "📜" },
    { id: "ring",      name: "A Real Diamond",       icon: "💍" },
    { id: "heel",      name: "Size Seven Heel",      icon: "👠" },
    { id: "keycard",   name: "Rose Hotel Key",       icon: "🔑" },
    { id: "blackcard", name: "Simon's Black Card",   icon: "💳" },
  ],
  price: [],
  seasons: ["001-1", "001-2", "001-3"],
});
