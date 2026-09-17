"use strict";
/* js/catalog.js — the show as data. The runner loads the real content files, so these assert
   the shipped catalog rather than a fixture. */

/* Registration warns and drops rather than throwing, so the interesting assertion is usually
   "it complained AND nothing changed". This keeps the message instead of silencing it. */
function captureWarn(fn) {
  const real = console.warn;
  const msgs = [];
  console.warn = (...a) => msgs.push(a.join(" "));
  try { fn(); } finally { console.warn = real; }
  return msgs;
}

suite("catalog: what is declared");

test("both series are registered, in declaration order", () => {
  deepEq(Catalog.series().map(s => s.id), ["001", "002"]);
  eq(Catalog.getSeries("001").title, "A Husband by Christmas");
  ok(Catalog.getSeries("nope") === null, "an unknown id is null, not undefined");
});

test("series 001 is free and series 002 is not", () => {
  deepEq(Catalog.getSeries("001").price, [], "the first series must cost nothing — it is the way in");
  eq(Catalog.getSeries("002").price.length, 1);
  ok(Catalog.getSeries("002").price[0].coins > 0);
});

test("the placeholder series declares no seasons, so it ends the spine", () => {
  deepEq(Catalog.seasonsOf("002"), []);
  deepEq(Catalog.itemsOf("002"), []);
});

test("three seasons, six episodes each, in story order", () => {
  deepEq(Catalog.seasonsOf("001").map(s => s.id), ["001-1", "001-2", "001-3"]);
  deepEq(Catalog.episodesOf("001-1").map(e => e.id), ["001", "002", "003", "004", "005", "006"]);
  deepEq(Catalog.episodesOf("001-2").map(e => e.id), ["007", "008", "009", "010", "011", "012"]);
  deepEq(Catalog.episodesOf("001-3").map(e => e.id), ["013", "014", "015", "016", "017", "018"]);
  eq(Catalog.episodeCount(), 18);
});

test("episode titles are the ones the episode files carried", () => {
  eq(Catalog.getEpisode("001").title, "Six Months on the Street");
  eq(Catalog.getEpisode("006").title, "The Nation's Richest Man");
  eq(Catalog.getEpisode("018").title, "Showing Him Off");
});

test("the season an episode belongs to, and the series that season belongs to", () => {
  eq(Catalog.seasonOfEpisode("009").id, "001-2");
  eq(Catalog.seriesOfSeason("001-3").id, "001");
  ok(Catalog.seasonOfEpisode("999") === null);
});

test("a video path is derived from the id, never stored", () => {
  eq(Catalog.videoFor("013"), "episodes/013.mp4");
  eq("video" in Catalog.getEpisode("013"), false, "an episode must not carry its own path");
});

test("items are declared by the series and looked up globally", () => {
  deepEq(Catalog.itemsOf("001").map(i => i.id), ["cert", "ring", "heel", "keycard", "blackcard"]);
  eq(Catalog.getItem("keycard").name, "Rose Hotel Key");
  eq(Catalog.getItem("keycard").series, "001", "an item knows the series it is themed to");
  ok(Catalog.getItem("nope") === null);
});

test("every item a price asks for is one the catalog declares", () => {
  Catalog.spine().forEach(e => e.price.forEach((step, i) => {
    Object.keys(step.items).forEach(id => {
      ok(Catalog.getItem(id), `${e.key} step ${i + 1} asks for "${id}", which no series declares`);
    });
  }));
});

test("steps are normalised, so nothing downstream has to guess", () => {
  Catalog.spine().forEach(e => e.price.forEach((step, i) => {
    eq(typeof step.coins, "number", `${e.key} step ${i + 1} coins`);
    ok(step.items && typeof step.items === "object", `${e.key} step ${i + 1} items`);
  }));
  // declared without an items field at all
  deepEq(Catalog.getEpisode("001").price, [{ coins: 1200, items: {} }]);
});

test("the prices teach the mechanic in the order the seasons run", () => {
  ["001", "002", "003", "004", "005"].forEach(id => {
    const p = Catalog.getEpisode(id).price;
    eq(p.length, 1, `episode ${id} is one step`);
    deepEq(p[0].items, {}, `episode ${id} must be coins only`);
  });
  ["006", "007", "008", "009", "010", "011", "012"].forEach(id => {
    const p = Catalog.getEpisode(id).price;
    eq(p.length, 2, `episode ${id} is two steps`);
    deepEq(p[0].items, {}, `episode ${id} step 1 stays coins only`);
    eq(Object.keys(p[1].items).length, 1, `episode ${id} step 2 asks for one kind of item`);
  });
  ["013", "014", "015", "016", "017", "018"].forEach(id => {
    const p = Catalog.getEpisode(id).price;
    eq(p.length, 3, `episode ${id} is three steps`);
    eq(Object.keys(p[2].items).length, 2, `episode ${id}'s last step asks for two different items`);
  });
});

suite("catalog: the spine");

test("series, then its seasons, then each season's episodes", () => {
  const spine = Catalog.spine();
  eq(spine.length, 23, "2 series + 3 seasons + 18 episodes");
  deepEq(spine.slice(0, 4).map(e => e.key),
         ["series:001", "season:001-1", "episode:001", "episode:002"]);
  eq(spine[8].key, "season:001-2", "the next season comes after the last episode of the one before");
  eq(spine[9].key, "episode:007");
  eq(spine[22].key, "series:002", "the locked series is last");
});

test("a parent always comes before its children", () => {
  const spine = Catalog.spine();
  const seen = new Set();
  spine.forEach(e => {
    if (e.parentKey) ok(seen.has(e.parentKey), `${e.key} appears before its parent ${e.parentKey}`);
    seen.add(e.key);
  });
});

test("every entry carries kind, id, key, price and parent — only a series has none", () => {
  Catalog.spine().forEach(e => {
    eq(e.key, Catalog.key(e.kind, e.id));
    ok(Array.isArray(e.price), e.key + " price");
    eq(e.parentKey === null, e.kind === "series", e.key + " parentKey");
  });
});

test("target() hands back the same entry the spine holds", () => {
  Catalog.spine().forEach(e => deepEq(Catalog.target(e.kind, e.id), e));
  ok(Catalog.target("episode", "999") === null);
  ok(Catalog.target("nonsense", "001") === null);
});

test("ancestorsOf climbs outermost first", () => {
  deepEq(Catalog.ancestorsOf("series", "001"), []);
  deepEq(Catalog.ancestorsOf("season", "001-2").map(a => a.key), ["series:001"]);
  deepEq(Catalog.ancestorsOf("episode", "018").map(a => a.key), ["series:001", "season:001-3"]);
  deepEq(Catalog.ancestorsOf("episode", "999"), []);
});

suite("catalog: bad content is dropped, not thrown");

test("a duplicate series id warns and changes nothing", () => {
  const before = Catalog.series().length;
  let out;
  const warns = captureWarn(() => { out = Catalog.addSeries({ id: "001", title: "Impostor", seasons: [] }); });
  ok(out === null, "the second registration is refused");
  eq(warns.length, 1, "and says so");
  eq(Catalog.series().length, before);
  eq(Catalog.getSeries("001").title, "A Husband by Christmas", "the real one is untouched");
});

test("a season naming a series that does not exist warns and is ignored", () => {
  let out;
  const warns = captureWarn(() => {
    out = Catalog.addSeason({ id: "999-1", series: "999", title: "Orphan", episodes: [{ id: "999" }] });
  });
  ok(out === null);
  eq(warns.length, 1);
  ok(Catalog.getSeason("999-1") === null, "not registered");
  ok(Catalog.getEpisode("999") === null, "and neither are its episodes");
});

test("a season its series does not list is ignored — the series file is the index", () => {
  let out;
  const warns = captureWarn(() => {
    out = Catalog.addSeason({ id: "001-4", series: "001", title: "Unlisted", episodes: [] });
  });
  ok(out === null);
  eq(warns.length, 1);
  ok(Catalog.getSeason("001-4") === null);
  eq(Catalog.spine().length, 23, "the spine is unchanged, which is the point");
});

test("an id-less registration is dropped rather than throwing", () => {
  const warns = captureWarn(() => {
    ok(Catalog.addSeries({ title: "no id" }) === null);
    ok(Catalog.addSeason({ series: "001", title: "no id" }) === null);
    ok(Catalog.addSeries() === null, "not even an object");
  });
  eq(warns.length, 3);
  eq(Catalog.series().length, 2);
});
