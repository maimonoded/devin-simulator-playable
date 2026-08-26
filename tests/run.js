"use strict";
/* Zero-dependency test runner.
   The app is plain classic scripts sharing globals, so we load the real files into one
   vm context — no bundler, no framework, no library mocks. Only the DOM-free layers are
   loaded; see tests/README.md for what is deliberately left untested and why.

   Run: node tests/run.js            (add a filename fragment to filter, e.g. `node tests/run.js tiles`)
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

/* Files under test, in index.html's dependency order. ui/* is excluded on purpose. */
const APP_FILES = [
  "js/util.js",
  "js/config.js",
  "js/content.js",
  "js/board-model.js",
  "js/env-model.js",
  "js/dice-model.js",
  "assets/env/scene.js",
  /* content the collection and the status track are read from */
  "assets/cards/cards.js",
  "assets/status/status.js",
  "js/state.js",
  "js/storage.js",
  "js/episodes.js",
  ...fs.readdirSync(path.join(ROOT, "episodes"))
      .filter(f => /^\d+\.js$/.test(f)).sort().map(f => "episodes/" + f),
  /* xlsx.js is browser-only at runtime, but it must still LOAD in a bare context —
     it is listed here so a stray top-level DOMParser/DecompressionStream reference fails
     the suite rather than only breaking in an old browser. */
  "js/xlsx.js",
  "js/economy.js",
  "js/economy-import.js",
  /* board-actor.js owns grantEnergy(), which js/boxes.js calls */
  "js/board-actor.js",
  "js/collection.js",
  "js/status.js",
  "js/boxes.js",
  "js/tiles/tile.js",
  ...fs.readdirSync(path.join(ROOT, "js/tiles"))
      .filter(f => f.endsWith("-tile.js")).sort().map(f => "js/tiles/" + f),
  "js/game.js",
];

/* ---- the only shims: browser globals the logic layer touches at load time ----
   storage.js probes localStorage and registers a beforeunload listener. These are
   plain stand-ins for browser built-ins, not mocks of app behaviour. */
function makeShims() {
  const store = new Map();
  return {
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
      clear: () => store.clear(),
    },
    window: { addEventListener() {} },
    console,
    performance,
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
}

/* ---- assertions ---- */
const results = { pass: 0, fail: 0, failures: [] };
let currentSuite = "";

function suite(name) { currentSuite = name; }

function test(name, fn) {
  try {
    fn();
    results.pass++;
  } catch (e) {
    results.fail++;
    results.failures.push({ suite: currentSuite, name, message: e && e.message ? e.message : String(e) });
  }
}

function fail(msg) { throw new Error(msg); }
function ok(cond, msg) { if (!cond) fail(msg || "expected truthy, got " + cond); }
function eq(actual, expected, msg) {
  if (actual !== expected) fail((msg ? msg + ": " : "") + `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function near(actual, expected, tol, msg) {
  if (!(Math.abs(actual - expected) <= tol)) fail((msg ? msg + ": " : "") + `expected ~${expected} (±${tol}), got ${actual}`);
}
function deepEq(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) fail((msg ? msg + ": " : "") + `expected ${b}, got ${a}`);
}
function throws(fn, msg) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; }
  if (!threw) fail(msg || "expected function to throw");
}

/* ---- context ---- */
const ctx = vm.createContext(makeShims());
for (const rel of APP_FILES) {
  const code = fs.readFileSync(path.join(ROOT, rel), "utf8");
  try {
    vm.runInContext(code, ctx, { filename: rel });
  } catch (e) {
    console.error(`\n✗ failed loading ${rel}\n  ${e.message}\n`);
    process.exit(1);
  }
}

Object.assign(ctx, { suite, test, ok, eq, near, deepEq, throws, fail, APP_ROOT: ROOT });

/* Per-test isolation helpers. These must be defined INSIDE the context: the app's
   top-level `const`/`let` live in the context's lexical scope, not on its global
   object, so they're unreachable from Node. */
vm.runInContext(`
  function resetCfg(){
    Object.assign(cfg, JSON.parse(JSON.stringify(DEFAULTS)));
    deck = JSON.parse(JSON.stringify(defDeck));
    boxTable = JSON.parse(JSON.stringify(defBox));
    boxTiers = JSON.parse(JSON.stringify(defBoxTiers));
    deckBoxes = JSON.parse(JSON.stringify(defDeckBoxes));
  }
  function freshRun(){
    resetCfg();
    initState();
    return state;
  }
  /* Force a box tier's table to one outcome, always restored. The drop tables are weighted, so
     a test that wants "a silver card" has to say so rather than roll for it. */
  function forceBox(tierKey, match, fn){
    const t = Boxes.tier(tierKey);
    const saved = t.table.map(r => r.weight);
    t.table.forEach(r => { r.weight = match(r) ? 100 : 0; });
    try { return fn(); } finally { t.table.forEach((r, i) => { r.weight = saved[i]; }); }
  }
  /* Deterministic randomness: feeds Math.random a fixed sequence, always restored.
     Not a mock of anything the app owns — just removing the nondeterminism. */
  function withRandom(values, fn){
    const real = Math.random;
    let i = 0;
    Math.random = () => {
      const v = typeof values === "function" ? values(i) : values[i % values.length];
      i++; return v;
    };
    try { return fn(); } finally { Math.random = real; }
  }
  /* Silence expected console noise (e.g. the warn when Episodes.add gets junk). */
  function withQuietConsole(fn){
    const w = console.warn, e = console.error;
    console.warn = () => {}; console.error = () => {};
    try { return fn(); } finally { console.warn = w; console.error = e; }
  }
`, ctx, { filename: "tests/helpers" });

/* ---- run suites ---- */
const filter = process.argv[2];
const suiteDir = path.join(__dirname, "suites");
const suites = fs.readdirSync(suiteDir).filter(f => f.endsWith(".js")).sort()
  .filter(f => !filter || f.includes(filter));

for (const f of suites) {
  vm.runInContext(fs.readFileSync(path.join(suiteDir, f), "utf8"), ctx, { filename: "tests/suites/" + f });
}

/* ---- report ---- */
const total = results.pass + results.fail;
if (results.fail) {
  console.log("");
  for (const f of results.failures) console.log(`  ✗ [${f.suite}] ${f.name}\n      ${f.message}`);
}
console.log(`\n${results.fail ? "FAIL" : "PASS"}  ${results.pass}/${total} assertions passed` +
            (suites.length ? `  (${suites.length} suite files)` : ""));
process.exit(results.fail ? 1 : 0);
