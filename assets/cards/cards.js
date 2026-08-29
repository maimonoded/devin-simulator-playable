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

   150 cards a Season: 90 Common, 38 Rare, 18 Epic, 4 Legendary, in 15 SETS OF TEN. A set is a
   collection target and NEVER a gate (§4.4) — completing one pays a bonus and a display piece,
   and a player who completes none is only poorer, never stuck.

   Per set that works out at six Commons and a tail: eight sets carry three Rares and an Epic,
   three carry two Rares and two Epics, and four carry two Rares, an Epic and the Season's one
   Legendary apiece. Cards.validate() checks the totals, because "90/38/18/4" is a balance
   decision and a typo in it is invisible in play.

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
      { key: "the-street", name: "The Street", cards: [
        { id: "folded-blanket",    name: "A Folded Blanket",           rarity: C, art: "folded-blanket.webp"  },
        { id: "shelter-queue",     name: "The Shelter Queue",          rarity: C, art: "shelter-queue.webp"  },
        { id: "cold-coffee",       name: "Cold Coffee",                rarity: C, art: "cold-coffee.webp"  },
        { id: "borrowed-coat",     name: "A Borrowed Coat",            rarity: C, art: "borrowed-coat.webp"  },
        { id: "dock-bench",        name: "The Bench by the Docks",     rarity: C, art: "clue-bench.webp" },
        { id: "yesterdays-paper",  name: "Yesterday's Paper",          rarity: C, art: "yesterdays-paper.webp"  },
        { id: "locked-garage",     name: "The Locked Garage",          rarity: R, art: "locked-garage.webp"  },
        { id: "cash-envelope",     name: "A Cash Envelope",            rarity: R, art: "clue-cash.webp" },
        { id: "through-the-glass", name: "The Photograph Through the Glass", rarity: E, art: "clue-photo.webp" },
        { id: "six-months",        name: "Six Months on the Street",   rarity: L, art: "six-months.webp"  },
      ] },

      { key: "the-family", name: "The Family", cards: [
        { id: "sunday-lunch",      name: "Sunday Lunch",               rarity: C, art: "sunday-lunch.webp"  },
        { id: "good-tablecloth",   name: "The Good Tablecloth",        rarity: C, art: "good-tablecloth.webp"  },
        { id: "address-book",      name: "Mum's Address Book",         rarity: C, art: "address-book.webp"  },
        { id: "fridge-calendar",   name: "A Fridge Calendar",          rarity: C, art: "fridge-calendar.webp"  },
        { id: "spare-room",        name: "The Spare Room",             rarity: C, art: "spare-room.webp"  },
        { id: "empty-chair",       name: "The Empty Chair",            rarity: C, art: "clue-chair.webp" },
        { id: "front-door-key",    name: "The Front Door Key",         rarity: R, art: "front-door-key.webp"  },
        { id: "argument-in-hall",  name: "An Argument in the Hall",    rarity: R, art: "argument-in-hall.webp"  },
        { id: "victoria",          name: "Victoria",                   rarity: E, art: "victoria.webp" },
        { id: "victorias-mother",  name: "Victoria's Mother",          rarity: E, art: "diane.webp" },
      ] },

      { key: "carls-circle", name: "Carl's Circle", cards: [
        { id: "returned-ring",     name: "A Returned Ring",            rarity: C, art: "returned-ring.webp"  },
        { id: "cousins-bracelet",  name: "The Cousin's Bracelet",      rarity: C, art: "cousins-bracelet.webp"  },
        { id: "unread-message",    name: "An Unread Message",          rarity: C, art: "clue-phone.webp" },
        { id: "carls-watch",       name: "Carl's Watch",               rarity: C, art: "carls-watch.webp"  },
        { id: "business-card",     name: "The Firm's Business Card",   rarity: C, art: "clue-card.webp" },
        { id: "blocked-number",    name: "A Blocked Number",           rarity: C, art: "blocked-number.webp"  },
        { id: "coldest-thing",     name: "The Coldest Thing He Said",  rarity: R, art: "coldest-thing.webp"  },
        { id: "his-new-job",       name: "His New Job",                rarity: R, art: "his-new-job.webp"  },
        { id: "the-cousin",        name: "The Cousin",                 rarity: R, art: "the-cousin.webp"  },
        { id: "carl",              name: "Carl",                       rarity: E, art: "carl.webp" },
      ] },

      { key: "the-registry", name: "The Registry Office", cards: [
        { id: "numbered-ticket",   name: "A Numbered Ticket",          rarity: C, art: "numbered-ticket.webp"  },
        { id: "waiting-bench",     name: "The Waiting Bench",          rarity: C, art: "waiting-bench.webp"  },
        { id: "cheap-biro",        name: "A Cheap Biro",               rarity: C, art: "cheap-biro.webp"  },
        { id: "registrars-desk",   name: "The Registrar's Desk",       rarity: C, art: "registrars-desk.webp"  },
        { id: "witness-form",      name: "A Witness Form",             rarity: C, art: "witness-form.webp"  },
        { id: "two-signatures",    name: "Two Signatures",             rarity: C, art: "clue-signature.webp" },
        { id: "the-long-pause",    name: "The Long Pause",             rarity: R, art: "the-long-pause.webp"  },
        { id: "identification",    name: "Identification",             rarity: R, art: "identification.webp"  },
        { id: "registrars-face",   name: "The Registrar's Face",       rarity: E, art: "registrars-face.webp"  },
        { id: "the-name",          name: "The Name on the Certificate", rarity: L, art: "the-name.webp"  },
      ] },

      { key: "harbour-heights", name: "Harbour Heights", cards: [
        { id: "harbour-wall",      name: "The Harbour Wall",           rarity: C, art: "harbour-wall.webp"  },
        { id: "gulls-on-the-rail", name: "Gulls on the Rail",          rarity: C, art: "gulls-on-the-rail.webp"  },
        { id: "chip-shop-window",  name: "A Chip Shop Window",         rarity: C, art: "chip-shop-window.webp"  },
        { id: "the-bus-stop",      name: "The Bus Stop",               rarity: C, art: "the-bus-stop.webp"  },
        { id: "boats-at-dawn",     name: "Fishing Boats at Dawn",      rarity: C, art: "boats-at-dawn.webp"  },
        { id: "church-spire",      name: "The Church Spire",           rarity: C, art: "church-spire.webp"  },
        { id: "notice-board",      name: "The Town Notice Board",      rarity: R, art: "clue-sign.webp" },
        { id: "rumour-at-bakers",  name: "A Rumour at the Baker's",    rarity: R, art: "rumour-at-bakers.webp"  },
        { id: "the-long-pier",     name: "The Long Pier",              rarity: R, art: "the-long-pier.webp"  },
        { id: "heights-at-night",  name: "Harbour Heights at Night",   rarity: E, art: "heights-at-night.webp"  },
      ] },

      { key: "the-wedding", name: "The Wedding", cards: [
        { id: "an-invitation",     name: "An Invitation",              rarity: C, art: "an-invitation.webp"  },
        { id: "rush-job",          name: "A Rush Job at the Printers", rarity: C, art: "rush-job.webp"  },
        { id: "white-ribbon",      name: "White Ribbon",               rarity: C, art: "white-ribbon.webp"  },
        { id: "caterers-quote",    name: "The Caterer's Quote",        rarity: C, art: "caterers-quote.webp"  },
        { id: "size-sevens",       name: "A Pair of Size Sevens",      rarity: C, art: "clue-shoes.webp" },
        { id: "folding-chairs",    name: "Folding Chairs",             rarity: C, art: "folding-chairs.webp"  },
        { id: "the-church-slot",   name: "The Church Slot",            rarity: R, art: "the-church-slot.webp"  },
        { id: "grandmas-blessing", name: "Grandma's Blessing",         rarity: R, art: "grandmas-blessing.webp"  },
        { id: "christmas-day",     name: "Christmas Day",              rarity: E, art: "christmas-day.webp"  },
        { id: "the-first-dance",   name: "The First Dance",            rarity: E, art: "the-first-dance.webp"  },
      ] },

      { key: "the-rose", name: "The Rose Hotel", cards: [
        { id: "brass-key-fob",     name: "A Brass Key Fob",            rarity: C, art: "brass-key-fob.webp"  },
        { id: "lobby-carpet",      name: "The Lobby Carpet",           rarity: C, art: "lobby-carpet.webp"  },
        { id: "bell-on-the-desk",  name: "A Bell on the Desk",         rarity: C, art: "bell-on-the-desk.webp"  },
        { id: "rose-wallpaper",    name: "Rose Wallpaper",             rarity: C, art: "rose-wallpaper.webp"  },
        { id: "ballroom-doors",    name: "The Ballroom Doors",         rarity: C, art: "ballroom-doors.webp"  },
        { id: "silver-tray",       name: "A Silver Tray",              rarity: C, art: "silver-tray.webp"  },
        { id: "the-cancellation",  name: "The Cancellation",           rarity: R, art: "the-cancellation.webp"  },
        { id: "deposit-unpaid",    name: "A Deposit Nobody Paid",      rarity: R, art: "deposit-unpaid.webp"  },
        { id: "managers-slip",     name: "The Manager's Correction",   rarity: R, art: "managers-slip.webp"  },
        { id: "the-rose-hotel",    name: "The Rose Hotel",             rarity: E, art: "the-rose-hotel.webp"  },
      ] },

      { key: "jones-airlines", name: "Jones Airlines", cards: [
        { id: "boarding-pass",     name: "A Boarding Pass",            rarity: C, art: "boarding-pass.webp"  },
        { id: "baggage-tag",       name: "The Baggage Tag",            rarity: C, art: "baggage-tag.webp"  },
        { id: "safety-card",       name: "A Safety Card",              rarity: C, art: "safety-card.webp"  },
        { id: "cabin-crew-wings",  name: "Cabin Crew Wings",           rarity: C, art: "cabin-crew-wings.webp"  },
        { id: "tarmac-at-dusk",    name: "The Tarmac at Dusk",         rarity: C, art: "tarmac-at-dusk.webp"  },
        { id: "window-seat",       name: "A Window Seat",              rarity: C, art: "window-seat.webp"  },
        { id: "the-livery",        name: "The Livery",                 rarity: R, art: "the-livery.webp"  },
        { id: "empty-first-row",   name: "An Empty First Row",         rarity: R, art: "empty-first-row.webp"  },
        { id: "name-on-the-tail",  name: "The Name on the Tail",       rarity: E, art: "name-on-the-tail.webp"  },
        { id: "jones-airlines",    name: "Jones Airlines",             rarity: L, art: "jones-airlines.webp"  },
      ] },

      { key: "the-terminal", name: "The Terminal", cards: [
        { id: "departures-board",  name: "The Departures Board",       rarity: C, art: "departures-board.webp"  },
        { id: "rope-barrier",      name: "A Rope Barrier",             rarity: C, art: "rope-barrier.webp"  },
        { id: "one-desk-open",     name: "One Desk Open",              rarity: C, art: "one-desk-open.webp"  },
        { id: "rolling-suitcase",  name: "A Rolling Suitcase",         rarity: C, art: "rolling-suitcase.webp"  },
        { id: "security-lane",     name: "The Security Lane",          rarity: C, art: "security-lane.webp"  },
        { id: "a-paper-cup",       name: "A Paper Cup",                rarity: C, art: "a-paper-cup.webp"  },
        { id: "phones-raised",     name: "Phones Raised in the Queue", rarity: R, art: "phones-raised.webp"  },
        { id: "camera-above",      name: "The Camera Above the Desk",  rarity: R, art: "camera-above.webp"  },
        { id: "a-raised-voice",    name: "A Raised Voice",             rarity: R, art: "a-raised-voice.webp"  },
        { id: "escorted-out",      name: "Escorted Out",               rarity: E, art: "escorted-out.webp"  },
      ] },

      { key: "texas", name: "Texas", cards: [
        { id: "rented-sedan",      name: "A Rented Sedan",             rarity: C, art: "rented-sedan.webp"  },
        { id: "red-dust",          name: "Red Dust",                   rarity: C, art: "red-dust.webp"  },
        { id: "diner-menu",        name: "A Diner Menu",               rarity: C, art: "diner-menu.webp"  },
        { id: "long-straight-road",name: "The Long Straight Road",     rarity: C, art: "long-straight-road.webp"  },
        { id: "motel-sign",        name: "A Motel Sign",               rarity: C, art: "motel-sign.webp"  },
        { id: "boots-by-the-door", name: "Boots by the Door",          rarity: C, art: "boots-by-the-door.webp"  },
        { id: "thirty-hours",      name: "Thirty Hours by Road",       rarity: R, art: "thirty-hours.webp"  },
        { id: "the-state-line",    name: "The State Line",             rarity: R, art: "the-state-line.webp"  },
        { id: "out-of-range",      name: "A Station Out of Range",     rarity: R, art: "out-of-range.webp"  },
        { id: "the-jones-ranch",   name: "The Jones Ranch",            rarity: E, art: "the-jones-ranch.webp"  },
      ] },

      { key: "the-press", name: "The Press", cards: [
        { id: "a-press-badge",     name: "A Press Badge",              rarity: C, art: "a-press-badge.webp"  },
        { id: "camera-flash",      name: "A Camera Flash",             rarity: C, art: "camera-flash.webp"  },
        { id: "front-page",        name: "Yesterday's Front Page",     rarity: C, art: "front-page.webp"  },
        { id: "voice-recorder",    name: "A Voice Recorder",           rarity: C, art: "voice-recorder.webp"  },
        { id: "the-doorstep",      name: "The Doorstep",               rarity: C, art: "the-doorstep.webp"  },
        { id: "a-notebook",        name: "A Notebook",                 rarity: C, art: "a-notebook.webp"  },
        { id: "it-circulated",     name: "The Photograph That Circulated", rarity: R, art: "it-circulated.webp"  },
        { id: "press-office",      name: "The Press Office's Silence", rarity: R, art: "press-office.webp"  },
        { id: "share-price",       name: "A Share-Price Story",        rarity: R, art: "share-price.webp"  },
        { id: "reported-found",    name: "Reported Found",             rarity: E, art: "reported-found.webp"  },
      ] },

      { key: "the-boardroom", name: "The Boardroom", cards: [
        { id: "a-long-table",      name: "A Long Table",               rarity: C, art: "a-long-table.webp"  },
        { id: "water-glasses",     name: "Water Glasses",              rarity: C, art: "water-glasses.webp"  },
        { id: "chair-at-the-head", name: "The Chair at the Head",      rarity: C, art: "chair-at-the-head.webp"  },
        { id: "a-bound-report",    name: "A Bound Report",             rarity: C, art: "a-bound-report.webp"  },
        { id: "the-company-seal",  name: "The Company Seal",           rarity: C, art: "the-company-seal.webp"  },
        { id: "a-nameplate",       name: "A Nameplate",                rarity: C, art: "a-nameplate.webp"  },
        { id: "the-search",        name: "The Search Nobody Called Off", rarity: R, art: "the-search.webp"  },
        { id: "vote-postponed",    name: "A Vote Postponed",           rarity: R, art: "vote-postponed.webp"  },
        { id: "the-board",         name: "The Board",                  rarity: E, art: "the-board.webp"  },
        { id: "jones-ceo",         name: "Simon Jones, CEO",           rarity: E, art: "jones-ceo.webp"  },
      ] },

      { key: "grandmas-things", name: "Grandma's Things", cards: [
        { id: "tin-of-buttons",    name: "A Tin of Buttons",           rarity: C, art: "tin-of-buttons.webp"  },
        { id: "lavender",          name: "Lavender",                   rarity: C, art: "lavender.webp"  },
        { id: "reading-glasses",   name: "Her Reading Glasses",        rarity: C, art: "reading-glasses.webp"  },
        { id: "crocheted-blanket", name: "A Crocheted Blanket",        rarity: C, art: "crocheted-blanket.webp"  },
        { id: "the-good-china",    name: "The Good China",             rarity: C, art: "the-good-china.webp"  },
        { id: "wind-up-clock",     name: "A Wind-Up Clock",            rarity: C, art: "wind-up-clock.webp"  },
        { id: "consultants-letter",name: "The Consultant's Letter",    rarity: R, art: "consultants-letter.webp"  },
        { id: "photo-from-1962",   name: "A Photograph from 1962",     rarity: R, art: "photo-from-1962.webp"  },
        { id: "her-wedding-ring",  name: "Her Wedding Ring",           rarity: R, art: "her-wedding-ring.webp"  },
        { id: "grandma",           name: "Grandma",                    rarity: E, art: "grandma.webp" },
      ] },

      { key: "the-suite", name: "The Honeymoon Suite", cards: [
        { id: "rose-petals",       name: "Rose Petals",                rarity: C, art: "rose-petals.webp"  },
        { id: "one-blanket",       name: "One Blanket",                rarity: C, art: "one-blanket.webp"  },
        { id: "bare-floorboards",  name: "Bare Floorboards",           rarity: C, art: "bare-floorboards.webp"  },
        { id: "turned-down-bed",   name: "A Turned-Down Bed",          rarity: C },
        { id: "a-cold-radiator",   name: "A Cold Radiator",            rarity: C },
        { id: "two-in-the-morning",name: "Two in the Morning",         rarity: C },
        { id: "closed-outside",    name: "The Door Closed From Outside", rarity: R, art: "closed-outside.webp"  },
        { id: "an-heirloom",       name: "An Heirloom",                rarity: R, art: "an-heirloom.webp"  },
        { id: "the-floor-offered", name: "The Floor He Offered",       rarity: R, art: "the-floor-offered.webp"  },
        { id: "one-bed",           name: "One Bed",                    rarity: E, art: "one-bed.webp"  },
      ] },

      { key: "the-reveal", name: "The Reveal", cards: [
        { id: "missing-notice",    name: "A Missing-Person Notice",    rarity: C },
        { id: "old-headline",      name: "A Six-Month-Old Headline",   rarity: C },
        { id: "unopened-letter",   name: "An Unopened Letter",         rarity: C, art: "clue-will.webp" },
        { id: "law-firms-crest",   name: "A Law Firm's Crest",         rarity: C },
        { id: "a-dictaphone",      name: "A Dictaphone",               rarity: C },
        { id: "a-lobby-window",    name: "A Lobby Window",             rarity: C },
        { id: "what-she-doesnt",   name: "What She Still Doesn't Know", rarity: R, art: "what-she-doesnt.webp"  },
        { id: "the-word-unsaid",   name: "The Word Nobody Said",       rarity: R, art: "the-word-unsaid.webp"  },
        { id: "richest-man",       name: "The Nation's Richest Man",   rarity: E, art: "richest-man.webp"  },
        { id: "simon",             name: "Simon",                      rarity: L, art: "simon.webp" },
      ] },
    ],
  },
];
