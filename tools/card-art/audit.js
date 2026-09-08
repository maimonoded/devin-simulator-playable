/* What is painted, what is not, and whether this machine can do the work.
 *
 *     node tools/card-art/audit.js
 *
 * Two checks that matter more than the count: a row tagged with art that is not
 * on disk (a broken card, silent in the console), and a file on disk that no row
 * points at (generated, paid for, invisible). Both have happened.
 *
 * And one that matters more than either, which is why it runs FIRST and prints
 * before anything else: can this machine encode a WebP at all?
 *
 * Generating an image COSTS MONEY and happens BEFORE finish-card.sh touches it.
 * So a box without cwebp or ImageMagick does not fail cheaply -- it fails after
 * seven paid images are already sitting in a CDN behind signed URLs that expire.
 * Discovering the gap at step 4 of 6 is the expensive way to discover it. This is
 * the cheap way, and it is in the one command the operator already runs before
 * every batch. */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
const { execFileSync } = require("child_process");
/* ---- can this machine finish a card? ---- */
const have = cmd => {
  try { execFileSync("command", ["-v", cmd], { shell: true, stdio: "ignore" }); return true; }
  catch { return false; }
};
const encoder =
  have("cwebp")  ? "cwebp (libwebp-tools)" :
  have("magick")  ? "ImageMagick (magick)" :
  have("convert") ? "ImageMagick (convert)" : null;

console.log(encoder ? `  toolchain   ${encoder}` : "  toolchain   NONE — cannot encode WebP");
if (!encoder) {
  console.log(`
  finish-card.sh cannot run on this machine, so generating images would spend
  credits on files it cannot process. Install one of these FIRST:

      Debian/Ubuntu   apt-get install -y webp
      Alpine          apk add libwebp-tools
      Fedora/RHEL     dnf install -y libwebp-tools
      macOS           brew install webp

  Then run this again. Everything below is still accurate; it is the encoding
  step that is missing, not the catalogue.
`);
}
console.log("");

const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync("assets/cards/cards.js", "utf8"), ctx, { filename: "cards.js" });

const all = vm.runInContext("CARD_SEASONS[0].sets.flatMap(s => s.cards)", ctx);
const dir = vm.runInContext("CARD_SEASONS[0].art", ctx) || "assets/cards/s1/";
const onDisk = new Set(fs.readdirSync(dir).filter(f => /\.webp$/.test(f)));

const broken = all.filter(c => c.art && !onDisk.has(c.art)).map(c => c.id);
const tagged = new Set(all.filter(c => c.art).map(c => c.art));

/* RETIRED art is not an orphan. Season 1 was cut from 150 cards to 48, and the ~120
   paintings that fell out are still on disk for a future Season to pick up.

   Without this list every one of them reports as "generated, paid for, invisible" --
   which is a real failure mode that has really happened, and an audit that reports it
    120 times for reasons everyone already knows is an audit nobody reads. So the file
   says which absences are deliberate, and anything NOT on it still fails.
   assets/cards/retired.txt explains itself and how to bring one back. */
const RETIRED_LIST = "assets/cards/retired.txt";
const retired = new Set(
  (fs.existsSync(RETIRED_LIST) ? fs.readFileSync(RETIRED_LIST, "utf8") : "")
    .split("\n").map(l => l.trim()).filter(l => l && l[0] !== "#"));
const orphan = [...onDisk].filter(f => !tagged.has(f) && !retired.has(f));
const shelved = [...onDisk].filter(f => retired.has(f)).length;

vm.runInContext("CARD_RARITIES", ctx).forEach(r => {
  const of = all.filter(c => c.rarity === r.key), done = of.filter(c => c.art).length;
  console.log(`  ${r.name.padEnd(10)} ${String(done).padStart(3)}/${String(of.length).padStart(3)}` +
              (done === of.length ? "  DONE" : ""));
});
console.log(`  ${"TOTAL".padEnd(10)} ${String(all.filter(c => c.art).length).padStart(3)}/${String(all.length).padStart(3)}`);
if (shelved) console.log(`  ${"retired".padEnd(10)} ${String(shelved).padStart(3)}     kept on disk for a future Season`);
if (broken.length) console.log("\nTAGGED BUT NO FILE:", broken.join(" "));
if (orphan.length) console.log("\nON DISK BUT UNTAGGED:", orphan.join(" "),
  "\n(painted but in no catalogue row \u2014 tag it, or add it to " + RETIRED_LIST + ")");

/* A missing encoder is a non-zero exit like any other problem. It is not a
   catalogue error, but it does mean "do not start a batch", which is the only
   thing the exit code is asked to say. */
process.exit(broken.length || orphan.length || !encoder ? 1 : 0);
