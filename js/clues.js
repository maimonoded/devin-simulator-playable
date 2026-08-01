"use strict";
/* The clue album — what a clue actually IS.

   Until now a clue was a bare integer. state.clues counted them, cfg.clueAlbumSize promised an
   album of 300, and nothing anywhere said what those 300 were. This file is that content.

   TWO COUNTERS, ONE OF THEM IS THE ALBUM:
     state.clues      lifetime total, never spent — this IS the album's progress
     state.cycleClues the flow banked since the last prediction, spent to buy accuracy
   So the album needs no state of its own: the clues you own are the first state.clues of them,
   filled in order. Same reasoning as the episode library — derive it, don't keep a second
   counter that can drift from the first.

   Filling in order rather than at random is deliberate. A random fill would make the album a
   slot machine you cannot reason about ("how close am I to finishing this set?"); in order, the
   next clue is always the next slot and a set completes when you reach it.

   CONTENT. Sets below are named; cfg.clueAlbumSize (from the economy model) is the album's real
   size, so any slot past the named ones is a numbered placeholder rather than a missing entry.
   That way the model stays authoritative about how big the album is and content can land later
   without a code change — add names here and the placeholders become real. */

const CLUE_SETS = [
  { name: "The Street",      icon: "🏙", clues: [
    "A cardboard sign, lettered in a steady hand",
    "Shoes worth more than the coat",
    "A bank card, unused, six months expired",
    "The bench he never sleeps on",
    "A phone that only ever receives",
  ]},
  { name: "The Family",      icon: "👔", clues: [
    "A will with one name struck through",
    "The brother who took the meeting",
    "A photograph cropped to two people",
    "Legal fees paid in cash",
    "A signature that leans the wrong way",
  ]},
  { name: "The Wedding",     icon: "💍", clues: [
    "A dress altered twice",
    "The seat left empty at the top table",
    "An invitation returned unopened",
    "Rings bought on a company card",
    "A toast nobody recorded",
  ]},
  { name: "The Office",      icon: "🏢", clues: [
    "A badge that still opens the door",
    "Minutes missing from the file",
    "The intern who signed for the delivery",
    "A resignation dated on a Sunday",
    "Two sets of quarterly numbers",
  ]},
  { name: "The Hospital",    icon: "🏥", clues: [
    "A chart with the surname redacted",
    "Visiting hours nobody kept",
    "A prescription in another city",
    "The nurse who recognised him",
    "An ambulance called from a landline",
  ]},
  { name: "The Reveal",      icon: "🎬", clues: [
    "A recording made without consent",
    "The lawyer's second phone",
    "A hotel key from the wrong year",
    "Testimony that contradicts the date",
    "The name on the deed",
  ]},
];

const Clues = {
  /* The album's size comes from the economy model, not from how much content exists — the model
     is what says how big the collection is meant to be. */
  total(){ return Math.max(0, Math.round(cfg.clueAlbumSize || 0)); },
  /* How many are in a set. Sets are equal-sized so the grid is regular. */
  setSize(){ return CLUE_SETS[0] ? CLUE_SETS[0].clues.length : 5; },
  setCount(){ return Math.max(1, Math.ceil(this.total() / this.setSize())); },

  /* Owned = the first state.clues slots. Nothing to persist. */
  collected(){ return Math.min(this.total(), Math.max(0, Math.floor(state.clues || 0))); },
  has(i){ return i < this.collected(); },

  /* Set metadata, cycling the authored names once the album runs past them so a 300-slot album
     never shows a blank heading. */
  setOf(i){ return Math.floor(i / this.setSize()); },
  setMeta(s){
    const authored = CLUE_SETS[s];
    if (authored) return { name: authored.name, icon: authored.icon };
    return { name: `Case File ${s + 1}`, icon: "🗂" };
  },
  /* A clue's name, or a numbered placeholder where no content has been written yet. */
  nameOf(i){
    const s = CLUE_SETS[this.setOf(i)];
    const within = i % this.setSize();
    return (s && s.clues[within]) || `Clue #${String(i + 1).padStart(3, "0")}`;
  },
  /* [collectedInSet, sizeOfSet] — the size is clamped so a short final set reports honestly. */
  setProgress(s){
    const size = this.setSize(), from = s * size;
    const slots = Math.max(0, Math.min(size, this.total() - from));
    const got = Math.max(0, Math.min(slots, this.collected() - from));
    return [got, slots];
  },
  setComplete(s){ const [g, n] = this.setProgress(s); return n > 0 && g === n; },
  /* Sets with at least one slot — what the album renders. */
  sets(){
    const out = [];
    for (let s = 0; s < this.setCount(); s++) if (this.setProgress(s)[1] > 0) out.push(s);
    return out;
  },
};
