/* What is painted and what is not.
 *
 *     node tools/card-art/audit.js
 *
 * Two checks that matter more than the count: a row tagged with art that is not
 * on disk (a broken card, silent in the console), and a file on disk that no row
 * points at (generated, paid for, invisible). Both have happened. */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync("assets/cards/cards.js", "utf8"), ctx, { filename: "cards.js" });

const all = vm.runInContext("CARD_SEASONS[0].sets.flatMap(s => s.cards)", ctx);
const dir = vm.runInContext("CARD_SEASONS[0].art", ctx) || "assets/cards/s1/";
const onDisk = new Set(fs.readdirSync(dir).filter(f => /\.webp$/.test(f)));

const broken = all.filter(c => c.art && !onDisk.has(c.art)).map(c => c.id);
const tagged = new Set(all.filter(c => c.art).map(c => c.art));
const orphan = [...onDisk].filter(f => !tagged.has(f));

vm.runInContext("CARD_RARITIES", ctx).forEach(r => {
  const of = all.filter(c => c.rarity === r.key), done = of.filter(c => c.art).length;
  console.log(`  ${r.name.padEnd(10)} ${String(done).padStart(3)}/${String(of.length).padStart(3)}` +
              (done === of.length ? "  DONE" : ""));
});
console.log(`  ${"TOTAL".padEnd(10)} ${String(all.filter(c => c.art).length).padStart(3)}/${String(all.length).padStart(3)}`);
if (broken.length) console.log("\nTAGGED BUT NO FILE:", broken.join(" "));
if (orphan.length) console.log("\nON DISK BUT UNTAGGED:", orphan.join(" "));
process.exit(broken.length || orphan.length ? 1 : 0);
