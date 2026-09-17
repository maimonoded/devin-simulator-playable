"use strict";
/* Season 1 of series 001 — episodes 001-006.

   Pricing intent: this season teaches the mechanic and charges almost nothing for the lesson.
   The season itself is FREE, so the very first thing a new player can pay for is an episode.
   Episodes 001-005 are ONE step of coins only — about three laps of the board for the first
   (1,200 coins, against the ~451 a lap the tiles actually pay), rising to about six laps for
   the fifth. Episode 006 is where the step bar and the first ITEM appear together, on an episode
   the player reaches having already paid five easy ones. */

Catalog.addSeason({
  id: "001-1",
  series: "001",
  title: "The Arrangement",
  blurb: "A jilted bride, a man with no address, and a marriage neither of them meant.",
  price: [],
  episodes: [
    {
      id: "001", title: "Six Months on the Street",
      blurb: "The man sleeping rough behind the market has been dead for six months. Officially.",
      price: [ { coins: 1200 } ],
    },
    {
      id: "002", title: "A Wedding by Christmas",
      blurb: "Grandma is fading, and Victoria's mother promises her a wedding before the year is out.",
      price: [ { coins: 1500 } ],
    },
    {
      id: "003", title: "Not Good Enough",
      blurb: "Victoria finds her fiancé with her own cousin. Carl's excuse is that she was never enough.",
      price: [ { coins: 1800 } ],
    },
    {
      id: "004", title: "Marry Me Instead",
      blurb: "The wedding is booked, the groom is gone, and the only man who will say yes owns nothing.",
      price: [ { coins: 2200 } ],
    },
    {
      id: "005", title: "The Name on the Certificate",
      blurb: "The registrar needs a legal name. Six months of hiding comes down to one line of ink.",
      price: [ { coins: 2600 } ],
    },
    /* First two-step price, and the first item asked for anywhere in the game. One of one, of
       the item that episode 005 just made the story about. */
    {
      id: "006", title: "The Nation's Richest Man",
      blurb: "The clerk looks up from the certificate and recognises a face the whole country buried.",
      price: [
        { coins: 1600 },
        { coins: 1600, items: { cert: 1 } },
      ],
    },
  ],
});
