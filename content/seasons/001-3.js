"use strict";
/* Season 3 of series 001 — episodes 013-018.

   Pricing intent: the full shape, and the most expensive stretch of the run. Every episode is
   THREE steps — coins, then coins and one item, then coins and TWO DIFFERENT items — so the
   last step of each is the one that has to be planned for rather than stumbled into. Coin costs
   per episode run 7,200 to 11,400, which is 19 to 30 laps of the board.

   The SEASON is priced in two steps of its own, the only two-step gate in the game: it is the
   last thing between the player and the end of the story, and it should read as one.  */

Catalog.addSeason({
  id: "001-3",
  series: "001",
  title: "The Honeymoon Suite",
  blurb: "Texas, a hotel that knows exactly who he is, and one bed between two people still acting.",
  price: [
    { coins: 5000, items: { keycard: 2 } },
    { coins: 7000, items: { blackcard: 1, heel: 2 } },
  ],
  episodes: [
    {
      id: "013", title: "The Rose Hotel",
      blurb: "Texas, and a hotel where the staff greet Simon by a name his wife has never heard.",
      price: [
        { coins: 2200 },
        { coins: 2400, items: { keycard: 1 } },
        { coins: 2600, items: { ring: 1, cert: 1 } },
      ],
    },
    {
      id: "014", title: "A Real Diamond",
      blurb: "The family asks to see the engagement ring. There has never been one.",
      price: [
        { coins: 2400 },
        { coins: 2600, items: { ring: 1 } },
        { coins: 2800, items: { heel: 1, cert: 1 } },
      ],
    },
    {
      id: "015", title: "Enjoy Your Night",
      blurb: "A honeymoon suite, prepared for a couple who have not had the ceremony yet.",
      price: [
        { coins: 2600 },
        { coins: 2800, items: { heel: 2 } },
        { coins: 3000, items: { keycard: 1, ring: 1 } },
      ],
    },
    {
      id: "016", title: "One Bed",
      blurb: "One bed, two people keeping up an act, and a night neither of them planned for.",
      price: [
        { coins: 2800 },
        { coins: 3000, items: { cert: 2 } },
        { coins: 3400, items: { keycard: 2, heel: 1 } },
      ],
    },
    {
      id: "017", title: "Putting On a Show",
      blurb: "Grandma arrives with a wedding-night heirloom and no intention of leaving the room.",
      price: [
        { coins: 3000 },
        { coins: 3400, items: { blackcard: 1 } },
        { coins: 3800, items: { ring: 2, cert: 2 } },
      ],
    },
    {
      id: "018", title: "Showing Him Off",
      blurb: "The whole family is sold on the marriage. Victoria's mother takes the couple out to prove it.",
      price: [
        { coins: 3400 },
        { coins: 3800, items: { ring: 2 } },
        { coins: 4200, items: { blackcard: 1, keycard: 2 } },
      ],
    },
  ],
});
