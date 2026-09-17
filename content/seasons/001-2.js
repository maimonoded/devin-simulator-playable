"use strict";
/* Season 2 of series 001 — episodes 007-012.

   Pricing intent: the item step is now the rule rather than the novelty. Every episode here is
   TWO steps, the second always asking coins plus one kind of item, and the quantity reaches two
   by the end of the season — so the player learns to bank an item ahead of needing it instead
   of spending the moment one drops.

   The SEASON has a real price of its own, and it sits on the spine between episode 006 and
   episode 007: about 13 laps of coins and three items, paid in one step — and the items are what will actually take the time (see the note in 001-1.js). A season is where the
   run should feel like it stops and starts again, which a free heading cannot do. */

Catalog.addSeason({
  id: "001-2",
  series: "001",
  title: "Flight to Texas",
  blurb: "The paperwork holds, the secret travels badly, and everyone ends up at the airport.",
  price: [
    { coins: 6000, items: { cert: 2, ring: 1 } },
  ],
  episodes: [
    {
      id: "007", title: "Technically Your Husband",
      blurb: "Signed, witnessed and filed. Victoria finds out what the paperwork entitles him to.",
      price: [
        { coins: 1800 },
        { coins: 1800, items: { ring: 1 } },
      ],
    },
    {
      id: "008", title: "Size Seven",
      blurb: "A gift that fits too well, from a husband who is supposed to know nothing about her.",
      price: [
        { coins: 2000 },
        { coins: 2000, items: { heel: 1 } },
      ],
    },
    {
      id: "009", title: "Jones Airlines",
      blurb: "Two seats to Texas, and a name on the fuselage Simon would rather nobody read aloud.",
      price: [
        { coins: 2200 },
        { coins: 2200, items: { cert: 2 } },
      ],
    },
    {
      id: "010", title: "Escorted Out",
      blurb: "Carl calls security, swears he was the one attacked, and demands the tramp be removed.",
      price: [
        { coins: 2400 },
        { coins: 2400, items: { keycard: 1 } },
      ],
    },
    {
      id: "011", title: "Thirty Hours",
      blurb: "Banned from the only airline flying there, Carl and the cousin find another way to Texas.",
      price: [
        { coins: 2600 },
        { coins: 2800, items: { ring: 2 } },
      ],
    },
    {
      id: "012", title: "Reported Found",
      blurb: "Victoria's mother is paying for this wedding out of her savings. Simon's assistant is not.",
      price: [
        { coins: 2800 },
        { coins: 3200, items: { blackcard: 1 } },
      ],
    },
  ],
});
