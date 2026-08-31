"use strict";
/* The collection — the 150 things there are to collect in a Season.

   Content, like assets/board/board.js and assets/pools/pools.js: a classic script defining
   globals, edited by hand far more often than the code that reads it. The engine is js/cards.js.

   ---- what changed, and why it matters ----

   Cards used to BE the gate: five named ones unlocked an episode, so the pool was derived from
   the episodes' requirements and every card had a job. GDD §6.1 moved the gate to clues, and
   that frees the collection to be what §4 actually describes — a Season-wide catalogue you are
   never finished with, whose only job is Status and the satisfaction of the thing itself.

   So there are no "requirements" here any more. A card is wanted because it is missing.

   ---- the shape (§4.6) ----

   48 cards a Season: 29 Common, 12 Rare, 6 Epic, 1 Legendary, in 4 SETS OF TWELVE — one set per
   four-episode arc (§4.4). A set is a collection target and NEVER a gate: completing one pays a
   bonus and a display piece, and a player who completes none is only poorer, never stuck.

   It was 150 in 15 sets of ten. That did not survive contact with conversion: a Collectible
   needs THREE copies of one specific card, and across 150 cards a given Common turns up 0.67
   times in a demo run — so the thing the collection is FOR almost never happened. The catalogue
   is sized to the eighteen episodes that exist.

   ---- two kinds, interleaved (§4.1) ----

   Each set carries seven MEMORIES — moments from the episodes — and five TROPHIES, the
   aspirational objects: the watch, the necklace, the villa. Twenty of the forty-eight are
   trophies, marked `kind: "status"`; absent means a memory, so the annotation stays rare enough
   to mean something. Cards.validate() refuses any other kind, because a typo there is invisible
   in play — the card simply stops being a trophy and looks like an ordinary memory.

   ---- ids ----

   A card's id is the whole identity — ownership, drop tables and the Showcase all key off it —
   and it must be unique across every Season, not just within one. A Season's cards persist
   after its reset (§5.3), so two Seasons reusing "the-blanket" would silently merge two
   different cards into one pile. validate() refuses it.

   ---- art ----

   `art` is OPTIONAL and names a file under the Season's `art` directory. Absent means the
   procedural face (js/ui/cardface.js), which is the right answer for most of the 90 Commons:
   ninety pieces of generated art would cost more to make than they would ever be looked at.
   The top of the ladder is where painted art earns its place — §4.2 calls an Epic "the pull
   that makes a pack memorable", and a memorable pull cannot be a gradient. */

/* Rarity. `weight` is how often it drops (§4.2's 60/25/12/3, summing to 100), `status` what
   CONVERTING one pays (§5.1), `trickle` what each copy past the third pays instead, and `dup`
   the multiplier on cfg.dupCoins for a duplicate that has not converted yet.

   ---- RANK IS THE STAR COUNT ----

   A card face wears `rank` STARS, not the rarity's name. "Is an Epic better than a Rare?" is a
   question you have to have learnt the answer to; ★★★ against ★★ is not a question at all. So
   rank is the display, and it is why rank runs 1..4 with no gaps — the number is drawn.

   `name` and `short` are still the words, for the places that need to say it in prose: the
   tuning drawer, the card reference, an image's alt text. No card face reads them.

   `color` is the rarity badge, drawn on every card face in both the canvas and the DOM path.
   The FAMILY decides the frame and the RARITY decides the badge — two independent axes, so a
   status item in a gold frame and an Epic collection card can never be mistaken for each other
   however good the art is. See CLAUDE.md. */
const CARD_RARITIES = [
  { key: "common",    name: "Common",    short: "Com",  rank: 1, weight: 60, status: 10,  trickle: 2,  dup: 1,  color: "#8fa3c9" },
  { key: "rare",      name: "Rare",      short: "Rare", rank: 2, weight: 25, status: 30,  trickle: 6,  dup: 3,  color: "#4f9dff" },
  { key: "epic",      name: "Epic",      short: "Epic", rank: 3, weight: 12, status: 100, trickle: 20, dup: 8,  color: "#b06bff" },
  { key: "legendary", name: "Legendary", short: "Leg",  rank: 4, weight: 3,  status: 400, trickle: 80, dup: 25, color: "#ffcb5c" },
];

/* Shorthands, so a 150-row catalogue reads as a catalogue rather than as JSON. */
const C = "common", R = "rare", E = "epic", L = "legendary";

/* ---- THE CLUE PHOTOGRAPHS ----

   A clue is the card the player actually wants — it is the story, and four of them buy the next
   episode. It used to be the plainest thing in the box: cream paper with a sentence typed on it,
   sitting next to status plaques that glowed. That had the hierarchy exactly backwards.

   So a clue is a PHOTOGRAPH now, and the sentence is the caption under it. Twelve of them, and
   a clue picks one by HASHING ITS OWN ID — the same trick the procedural card faces use, and for
   the same reason: 144 authored clues would need 144 photographs, which would cost more to make
   than they would ever be looked at, while eight identical photos down one episode's evidence
   board would read as a bug.

   Hashing rather than cycling matters: a clue keeps the same photograph forever, across reloads
   and across saves, because nothing about the choice is stored. Adding a thirteenth photo
   reshuffles which clue shows what, which is why they are deliberately generic — no photograph
   here illustrates a specific clue, and none of them should. */
const CLUE_ART = {
  dir: "assets/cards/clues/",
  files: ["phone", "letter", "keys", "car", "ledger", "door",
          "photos", "ticket", "watch", "window", "waiting", "cash"],
};

const CARD_SEASONS = [
  {
    season: 1,
    name: "Harbour Heights",
    art: "assets/cards/s1/",
    sets: [
      /* Episodes 1-5 — the street, the family, the betrayal */
      { key: "the-street", name: "The Street", cards: [
        { id: "folded-blanket",        name: "A Folded Blanket",                     rarity: C, art: "folded-blanket.webp" },
        { id: "shelter-queue",         name: "The Shelter Queue",                    rarity: C, art: "shelter-queue.webp" },
        { id: "cold-coffee",           name: "Cold Coffee",                          rarity: C, art: "cold-coffee.webp" },
        { id: "borrowed-coat",         name: "A Borrowed Coat",                      rarity: C, art: "borrowed-coat.webp" },
        { id: "locked-garage",         name: "The Locked Garage",                    rarity: R, art: "locked-garage.webp" },
        { id: "cash-envelope",         name: "A Cash Envelope",                      rarity: R, art: "clue-cash.webp" },
        { id: "six-months",            name: "Six Months on the Street",             rarity: L, art: "six-months.webp" },
        { id: "silk-scarf",            name: "A Silk Scarf",                         rarity: C, art: "silk-scarf.webp", kind: "status"  },
        { id: "gold-cufflinks",        name: "Gold Cufflinks",                       rarity: C, art: "gold-cufflinks.webp", kind: "status"  },
        { id: "cashmere-coat",         name: "A Cashmere Coat",                      rarity: C, art: "cashmere-coat.webp", kind: "status"  },
        { id: "swiss-watch",           name: "A Swiss Watch",                        rarity: R, art: "swiss-watch.webp", kind: "status"  },
        { id: "penthouse-key",         name: "The Penthouse Key",                    rarity: E, art: "penthouse-key.webp", kind: "status"  },
      ]},
      /* Episodes 6-10 — the certificate, the reveal, the airline */
      { key: "the-name", name: "The Name", cards: [
        { id: "numbered-ticket",       name: "A Numbered Ticket",                    rarity: C, art: "numbered-ticket.webp" },
        { id: "registrars-desk",       name: "The Registrar's Desk",                 rarity: C, art: "registrars-desk.webp" },
        { id: "witness-form",          name: "A Witness Form",                       rarity: C, art: "witness-form.webp" },
        { id: "boarding-pass",         name: "A Boarding Pass",                      rarity: C, art: "boarding-pass.webp" },
        { id: "the-long-pause",        name: "The Long Pause",                       rarity: R, art: "the-long-pause.webp" },
        { id: "identification",        name: "Identification",                       rarity: R, art: "identification.webp" },
        { id: "registrars-face",       name: "The Registrar's Face",                 rarity: E, art: "registrars-face.webp" },
        { id: "monogrammed-shirt",     name: "A Monogrammed Shirt",                  rarity: C, art: "monogrammed-shirt.webp", kind: "status"  },
        { id: "leather-gloves",        name: "Leather Driving Gloves",               rarity: C, art: "leather-gloves.webp", kind: "status"  },
        { id: "crystal-decanter",      name: "A Crystal Decanter",                   rarity: C, art: "crystal-decanter.webp", kind: "status"  },
        { id: "diamond-studs",         name: "Diamond Studs",                        rarity: R, art: "diamond-studs.webp", kind: "status"  },
        { id: "private-jet",           name: "The Private Jet",                      rarity: E, art: "private-jet.webp", kind: "status"  },
      ]},
      /* Episodes 11-14 — Texas, the hotel, the diamond */
      { key: "the-rose", name: "The Rose Hotel", cards: [
        { id: "brass-key-fob",         name: "A Brass Key Fob",                      rarity: C, art: "brass-key-fob.webp" },
        { id: "lobby-carpet",          name: "The Lobby Carpet",                     rarity: C, art: "lobby-carpet.webp" },
        { id: "rose-wallpaper",        name: "Rose Wallpaper",                       rarity: C, art: "rose-wallpaper.webp" },
        { id: "ballroom-doors",        name: "The Ballroom Doors",                   rarity: C, art: "ballroom-doors.webp" },
        { id: "the-cancellation",      name: "The Cancellation",                     rarity: R, art: "the-cancellation.webp" },
        { id: "managers-slip",         name: "The Manager's Correction",             rarity: R, art: "managers-slip.webp" },
        { id: "the-rose-hotel",        name: "The Rose Hotel",                       rarity: E, art: "the-rose-hotel.webp" },
        { id: "velvet-heels",          name: "Velvet Heels",                         rarity: C, art: "velvet-heels.webp", kind: "status"  },
        { id: "pearl-earrings",        name: "Pearl Earrings",                       rarity: C, art: "pearl-earrings.webp", kind: "status"  },
        { id: "perfume-bottle",        name: "A Cut-Glass Perfume Bottle",           rarity: C, art: "perfume-bottle.webp", kind: "status"  },
        { id: "emerald-necklace",      name: "An Emerald Necklace",                  rarity: R, art: "emerald-necklace.webp", kind: "status"  },
        { id: "vintage-roadster",      name: "The Vintage Roadster",                 rarity: E, art: "vintage-roadster.webp", kind: "status"  },
      ]},
      /* Episodes 15-18 — the wedding night, Grandma, showing him off */
      { key: "the-suite", name: "The Suite", cards: [
        { id: "rose-petals",           name: "Rose Petals",                          rarity: C, art: "rose-petals.webp" },
        { id: "one-blanket",           name: "One Blanket",                          rarity: C, art: "one-blanket.webp" },
        { id: "turned-down-bed",       name: "A Turned-Down Bed",                    rarity: C, art: "turned-down-bed.webp" },
        { id: "wind-up-clock",         name: "A Wind-Up Clock",                      rarity: C, art: "wind-up-clock.webp" },
        { id: "the-good-china",        name: "The Good China",                       rarity: C, art: "the-good-china.webp" },
        { id: "crocheted-blanket",     name: "A Crocheted Blanket",                  rarity: C, art: "crocheted-blanket.webp" },
        { id: "grandmas-blessing",     name: "Grandma's Blessing",                   rarity: R, art: "grandmas-blessing.webp" },
        { id: "silver-case",           name: "A Silver Cigarette Case",              rarity: C, art: "silver-case.webp", kind: "status"  },
        { id: "designer-luggage",      name: "Designer Luggage",                     rarity: C, art: "designer-luggage.webp", kind: "status"  },
        { id: "couture-gown",          name: "The Couture Gown",                     rarity: R, art: "couture-gown.webp", kind: "status"  },
        { id: "sapphire-ring",         name: "A Sapphire Ring",                      rarity: R, art: "sapphire-ring.webp", kind: "status"  },
        { id: "the-villa",             name: "The Villa on the Hill",                rarity: E, art: "the-villa.webp", kind: "status"  },
      ]},
    ],
  },
];
