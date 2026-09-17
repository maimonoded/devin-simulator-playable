"use strict";
/* The catalog — the show as data. Series hold seasons, seasons hold episodes, and each of the
   three carries a price. PURE DATA: it reads no state, writes no cfg and never touches the DOM.
   What the player has actually paid for lives in js/unlock.js, which is the only file that
   knows the difference between "declared" and "owned".

   Content is one file per series and one per season (content/series/, content/seasons/), each
   a classic script calling addSeries/addSeason — the same wrapper the old episodes/NNN.js used,
   for the same reason: nothing outside js/ui/board3d.js may import or fetch().

   A PRICE is an ordered array of STEPS, and [] means free:

       { coins: Number, items: { itemId: Number, … } }        either field may be absent

   Steps are NORMALISED on the way in, so every step that comes back out of here has both
   fields — `coins` a whole number (0 when free) and `items` an object (empty when none).
   A content file may leave either out; nothing downstream has to guess.

   All three levels are priced because a season is meant to be a milestone the player pays for,
   not a heading its episodes happen to sit under. An episode's video path is derived rather
   than stored: the id is the whole identity, as it always was — episodes/<id>.mp4.

   ---- why one flat spine ----

   spine() flattens everything into ONE ordered list: each series, then each of its seasons,
   then that season's episodes. The drama is serialised — nobody watches episode 12 before
   episode 3 — so exactly one thing is payable at any moment, and Unlock.current() is simply
   that list's first unpaid entry. A tree would let every screen offer any leaf it liked and
   leave "what do I pay for next" to be re-answered, differently, in each of them. Because a
   parent always precedes its children here, walking the list in order can never reach an
   episode whose season is still locked.

   It is rebuilt on every call rather than cached: content registers at load and never changes,
   the whole list is a couple of dozen entries, and a cache that goes stale when a content file
   is edited is a far nastier bug than the loop it saves (js/economy.js _baseOf takes the same
   view of its own maths).

   ---- a typo must not white-screen the app ----

   A content file is data, written by hand. A duplicate id, a season naming a series that does
   not exist, an episode with no id: each is warned about and dropped, and nothing throws.
   Losing one season beats losing the game. */

const CATALOG_VIDEO_DIR = "episodes/";
const CATALOG_ART_DIR   = "assets/library/";

/* Declaration order IS the spine's order, so the series are kept in an array as well as a map. */
const _catSeries = [];
const _catSeriesById = new Map();
const _catSeasons = new Map();
const _catEpisodes = new Map();
const _catItems = new Map();      // item id → def, across every series: getItem() is global

function _catWarn(msg) { console.warn("Catalog: " + msg); }

function _catPrice(raw, where) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) { _catWarn(`${where}: a price must be an array of steps — ignored.`); return []; }
  const out = [];
  raw.forEach((step, i) => {
    if (!step || typeof step !== "object") { _catWarn(`${where}: step ${i + 1} is not an object — dropped.`); return; }
    const items = {};
    const want = step.items || {};
    Object.keys(want).forEach(id => {
      const n = Math.round(+want[id] || 0);
      if (n > 0) items[id] = n;      // "0 of an item" is not a cost; it would only ever render as noise
    });
    out.push({ coins: Math.max(0, Math.round(+step.coins || 0)), items });
  });
  return out;
}

/* One spine entry. Built here rather than inline so spine() and target() can never disagree
   about the shape of what they hand back. */
function _catEntry(kind, def, parentKey) {
  return { kind, id: def.id, key: kind + ":" + def.id, price: def.price, parentKey: parentKey || null };
}

const Catalog = {

  /* ---------------- registration (called by the content files) ---------------- */

  addSeries(def) {
    const d = def || {};
    if (!d.id) { _catWarn("a series with no id was ignored."); return null; }
    if (_catSeriesById.has(d.id)) { _catWarn(`series "${d.id}" is already registered — the second one is ignored.`); return null; }
    const items = [];
    (d.items || []).forEach(it => {
      if (!it || !it.id) { _catWarn(`series "${d.id}": an item with no id was dropped.`); return; }
      if (_catItems.has(it.id)) { _catWarn(`item "${it.id}" is already declared by series "${_catItems.get(it.id).series}" — dropped.`); return; }
      const item = { id: it.id, name: it.name || it.id, icon: it.icon || "", series: d.id };
      _catItems.set(it.id, item);
      items.push(item);
    });
    const rec = {
      id: d.id, title: d.title || d.id, blurb: d.blurb || "", art: d.art || "",
      items, price: _catPrice(d.price, `series "${d.id}"`), seasons: (d.seasons || []).slice(),
    };
    _catSeries.push(rec);
    _catSeriesById.set(d.id, rec);
    return rec;
  },

  addSeason(def) {
    const d = def || {};
    if (!d.id) { _catWarn("a season with no id was ignored."); return null; }
    if (_catSeasons.has(d.id)) { _catWarn(`season "${d.id}" is already registered — the second one is ignored.`); return null; }
    const parent = _catSeriesById.get(d.series);
    if (!parent) { _catWarn(`season "${d.id}" names series "${d.series}", which is not registered — ignored.`); return null; }
    /* The series file is the index: its `seasons` list is what orders the spine, so a season it
       does not name would be registered somewhere nothing ever looks. Refused at the door
       instead, with a warning that names the file to fix. */
    if (parent.seasons.indexOf(d.id) < 0) { _catWarn(`season "${d.id}" is not listed by series "${parent.id}" — ignored.`); return null; }
    const episodes = [];
    (d.episodes || []).forEach(ep => {
      if (!ep || !ep.id) { _catWarn(`season "${d.id}": an episode with no id was dropped.`); return; }
      if (_catEpisodes.has(ep.id)) { _catWarn(`episode "${ep.id}" is already registered — the second one is dropped.`); return; }
      const rec = {
        id: ep.id, title: ep.title || ep.id, blurb: ep.blurb || "",
        price: _catPrice(ep.price, `episode "${ep.id}"`), season: d.id,
      };
      _catEpisodes.set(ep.id, rec);
      episodes.push(rec);
    });
    const rec = {
      id: d.id, series: parent.id, title: d.title || d.id, blurb: d.blurb || "",
      price: _catPrice(d.price, `season "${d.id}"`), episodes,
    };
    _catSeasons.set(d.id, rec);
    return rec;
  },

  /* ---------------- lookups ---------------- */

  series() { return _catSeries.slice(); },
  getSeries(id) { return _catSeriesById.get(id) || null; },
  getSeason(id) { return _catSeasons.get(id) || null; },
  getEpisode(id) { return _catEpisodes.get(id) || null; },

  seasonsOf(seriesId) {
    const s = _catSeriesById.get(seriesId);
    return s ? s.seasons.map(id => _catSeasons.get(id)).filter(Boolean) : [];
  },
  episodesOf(seasonId) {
    const s = _catSeasons.get(seasonId);
    return s ? s.episodes.slice() : [];
  },
  seriesOfSeason(id) { const s = _catSeasons.get(id); return s ? this.getSeries(s.series) : null; },
  seasonOfEpisode(id) { const e = _catEpisodes.get(id); return e ? this.getSeason(e.season) : null; },

  /* Items are themed per series, so a series declares its own set; ids are global because a
     price names an item and nothing else, and the player's inventory is one pile. */
  itemsOf(seriesId) { const s = _catSeriesById.get(seriesId); return s ? s.items.slice() : []; },
  getItem(itemId) { return _catItems.get(itemId) || null; },

  episodeCount() { return _catEpisodes.size; },
  videoFor(episodeId) { return CATALOG_VIDEO_DIR + episodeId + ".mp4"; },
  /* Cover art, derived from the id exactly as the video path is — a series billboard is 16:9
     and an episode poster is 2:3, so they live in separate folders rather than being told apart
     by their contents. Nothing declares its own path: art that does not exist simply is not
     there, and the library draws a lettered plate instead, the same way the board draws a tile
     with no assets/tiles/N.glb. See assets/library/README.md. */
  artFor(kind, id) { return CATALOG_ART_DIR + (kind === "series" ? "series/" : "episodes/") + id + ".jpg"; },

  /* Series "001" and episode "001" are different things, so an id alone is not a key. */
  key(kind, id) { return kind + ":" + id; },

  /* ---------------- the spine ---------------- */

  spine() {
    const out = [];
    _catSeries.forEach(s => {
      const sKey = this.key("series", s.id);
      out.push(_catEntry("series", s, null));
      this.seasonsOf(s.id).forEach(se => {
        const seKey = this.key("season", se.id);
        out.push(_catEntry("season", se, sKey));
        se.episodes.forEach(ep => out.push(_catEntry("episode", ep, seKey)));
      });
    });
    return out;
  },

  /* The same entry the spine would hand back, without walking it. */
  target(kind, id) {
    if (kind === "series") { const d = this.getSeries(id); return d ? _catEntry("series", d, null) : null; }
    if (kind === "season") { const d = this.getSeason(id); return d ? _catEntry("season", d, this.key("series", d.series)) : null; }
    if (kind === "episode") {
      const d = this.getEpisode(id);
      return d ? _catEntry("episode", d, this.key("season", d.season)) : null;
    }
    return null;
  },

  /* Spine entries, outermost first — they carry the kind, which is what a caller asking
     "is everything above this paid for?" actually needs. */
  ancestorsOf(kind, id) {
    if (kind === "season") {
      const d = this.getSeason(id);
      return d ? [this.target("series", d.series)].filter(Boolean) : [];
    }
    if (kind === "episode") {
      const d = this.getEpisode(id);
      const se = d && this.getSeason(d.season);
      return se ? [this.target("series", se.series), this.target("season", se.id)].filter(Boolean) : [];
    }
    return [];
  },
};
