"use strict";
/* The collection — 150 cards a Season, in fifteen sets of ten, and the empty slots are the
   point. A collection you cannot see the shape of is not a collection, so a set shows all ten
   slots whether you hold them or not: owned cards in full, missing ones silhouetted but NAMED
   and BADGED, because "Epic" is what tells you whether a gap is a week's play or a lucky
   Tuesday.

   Paged by SET rather than shown as one grid of 150. A set is the unit that completes and pays
   (GDD §4.4), so it is the unit worth looking at — and the page you land on is the one closest
   to finishing, which answers "what am I nearly done with" without a tap.

   ---- what this is NOT any more ----

   It used to be one page per episode, because five cards unlocked one. Clues do that now
   (js/clues.js), so the collection has stopped being a progress bar for the story and gone back
   to being a collection. What the story costs is shown on the case board in the ring, and
   tapping a panel there opens the EVIDENCE (openEvidence below), not this.

   Nothing here writes state. Opening it can never change a run. */

/* Which set is on screen. Deliberately NOT persisted: it is where you are looking, not where
   you are. */
let albumSet = 0;

function openAlbum(){
  const sets = Cards.sets();
  /* THE FIRST SET NOT YET FINISHED — where you are in the collection, read left to right.

     It used to open on the set CLOSEST TO DONE, on the reasoning that "what am I nearly done
     with" is the useful question. It is, for about the last tenth of a Season. For the rest of
     it the sets sit within a card or two of each other, so the winner is noise: measured over
     forty sixty-roll runs the album opened on page 1, 2, 3 and 4 thirteen, twelve, six and nine
     times. Opening somewhere different every time, for a reason the screen never states, is
     indistinguishable from a bug — and it was reported as one.

     First-incomplete is never arbitrary, matches the order the sets are authored in (and so the
     arcs they belong to), and lands on page 1 for every new player, which is where a collection
     starts. Finished sets are behind you; this is the one you are working on. */
  let best = sets.findIndex(s => {
    const [got, need] = Cards.setProgress(s.key);
    return got < need;
  });
  albumSet = best < 0 ? 0 : best;      // every set complete: back to the beginning
  renderAlbum();
}

function renderAlbum(){
  const host = $("#sheetHost");
  const sets = Cards.sets(), season = Cards.season();
  /* Cards this build's catalogue cannot explain get a page of their own AFTER the sets. They are
     kept rather than deleted (js/cards.js), and a card that is kept but appears nowhere is
     indistinguishable from one that was thrown away — so if there are any, they are shown. */
  const lost = Cards.lostCards();
  const pages = sets.length + (lost.length ? 1 : 0);
  const onLost = lost.length && albumSet >= sets.length;
  const set = sets[albumSet] || sets[0];
  const owned = Cards.owned(), pool = Cards.poolSize();
  const pct = pool ? Math.round(owned / pool * 100) : 0;

  const body = onLost ? albumLostHtml(lost)
    : set ? albumSetHtml(set)
    : `<div class="hint" style="margin:20px 0;text-align:center">No cards are authored for this Season.</div>`;

  host.innerHTML = `<div class="modal albumModal"><div class="top">
      <button class="sheetX" id="albumX" title="Close">✕</button>
      <div class="eyebrow">${season ? season.name : "Collection"} · ${Cards.completedSets().length}/${sets.length} sets</div>
      <h2>${owned} of ${pool} cards</h2></div>
    <div class="mbody">
      <div class="albumBar"><div class="albumFill" style="width:${pct}%"></div></div>
      <div class="hint" style="margin:6px 0 10px">
        <b style="color:var(--gold)">${Cards.convertedCount()}</b> collected —
        ${Cards.copiesToConvert()} copies convert a card and pay its status.</div>
      ${body}
      <div class="albNav">
        <button class="btn ghost albArrow" id="albPrev" ${albumSet <= 0 ? "disabled" : ""}>‹</button>
        <div class="albDots">${sets.map((s, i) => {
          const done = Cards.setComplete(s.key);
          return `<button class="albDot${i === albumSet ? " sel" : ""}${done ? " done" : ""}"
             data-p="${i}" title="${s.name}"></button>`;
        }).join("") + (lost.length
          ? `<button class="albDot kept${onLost ? " sel" : ""}" data-p="${sets.length}"
               title="Kept from other content"></button>` : "")}</div>
        <button class="btn ghost albArrow" id="albNext" ${albumSet >= pages - 1 ? "disabled" : ""}>›</button>
      </div>
      <button class="btn ghost wide" id="albumClose" style="margin-top:10px">Close</button>
    </div></div>`;
  host.classList.add("show");

  const close = () => { host.classList.remove("show"); host.innerHTML = ""; host.onclick = null; renderAll(); };
  $("#albumClose").onclick = close;
  $("#albumX").onclick = close;
  host.onclick = (e) => { if (e.target === host) close(); };

  const go = (i) => { albumSet = Math.max(0, Math.min(pages - 1, i)); renderAlbum(); };
  $("#albPrev").onclick = () => go(albumSet - 1);
  $("#albNext").onclick = () => go(albumSet + 1);
  host.querySelectorAll(".albDot").forEach(b => b.onclick = () => go(+b.dataset.p));
}

/* One set: its ten slots, and what finishing it is worth. A set NEVER gates anything (§4.4),
   so this footer promises a reward and never a requirement. */
function albumSetHtml(set){
  const [got, need] = Cards.setProgress(set.key);
  const done = Cards.setComplete(set.key);
  const claimed = Cards.setClaimed(set.key);
  const slots = set.cards.map(c =>
    `<div class="albSlot">${cardFace(c, { owned: Cards.has(c.id), count: Cards.count(c.id), size: "sm" })}</div>`
  ).join("");
  const foot = done
    ? (claimed
        ? `<div class="albDone">✓ Complete — ${fmt(Math.round(cfg.setBonusCoins * cfg.boardScale))}🪙 and
             ${cfg.setBonusStatus} status collected</div>`
        : `<div class="albNeed">✓ Complete — the bonus lands on your next roll</div>`)
    : `<div class="albNeed"><b>${need - got}</b> more to finish this set ·
         ${fmt(Math.round(cfg.setBonusCoins * cfg.boardScale))}🪙 and ${cfg.setBonusStatus} status when you do</div>`;
  return `<div class="albPage${done ? " ready" : ""}">
      <div class="albHead">
        <span class="albEp">Set ${albumSet + 1}</span>
        <span class="albTitle">${set.name}</span>
        <span class="albCount${done ? " done" : ""}">${got}/${need}${done ? " ✓" : ""}</span>
      </div>
      <div class="albGrid ten">${slots}</div>
      <div class="albFoot">${foot}</div>
    </div>`;
}

/* Cards held from content this build no longer defines. They keep their name, their rarity and
   everything they are worth (js/cards.js remembers it when they are banked) — they are simply
   not part of THIS Season's 150, so they sit apart rather than inflating it. */
function albumLostHtml(lost){
  const slots = lost.map(c =>
    `<div class="albSlot">${cardFace(c, { owned: true, count: Cards.count(c.id),
                                          converted: Cards.converted(c.id), size: "sm" })}</div>`
  ).join("");
  return `<div class="albPage">
      <div class="albHead">
        <span class="albEp">Kept</span>
        <span class="albTitle">From other content</span>
        <span class="albCount">${lost.length}</span>
      </div>
      <div class="albGrid ten">${slots}</div>
      <div class="albFoot"><div class="albNeed">These are not part of this Season's ${Cards.poolSize()},
        so they do not count toward it — but they are yours, they still pay their status, and they
        come back the moment their content does.</div></div>
    </div>`;
}

/* ---------------- the evidence, for one episode ----------------
   What tapping a case-board panel opens. The panel shows an episode's clue slots, so the sheet
   behind it has to be those clues — the same list the wager screen calls "Review the evidence",
   reachable before you are ready to bet. */
function openEvidence(ep){
  const host = $("#sheetHost");
  const [got, need] = Clues.progressFor(ep);
  const held = Clues.evidenceFor(ep);
  const unlocked = Clues.isUnlocked(ep);
  const unwatched = state.epQueue.includes(ep);
  const blocked = unlocked && unwatched && !Collection.canWatch(ep) ? Collection.blockedBy() : null;
  const rows = held.length
    ? `<ul class="evList">${held.map(c => `<li>${c.text}</li>`).join("")}</ul>`
    : `<p class="hint" style="margin:0">Nothing on file yet. Clues come off the cast's tiles.</p>`;
  /* The gaps are drawn, not just counted: an empty slot is what makes a collection legible, and
     the evidence board is a collection too. */
  const gaps = Math.max(0, need - got);
  const foot = !unlocked
    ? `<div class="albNeed"><b>${gaps}</b> more clue${gaps === 1 ? "" : "s"} to unlock this episode</div>`
    : blocked
    ? `<div class="albNeed">🔒 Unlocked — but <b>“${Episodes.titleOf(blocked)}”</b> has to be watched first</div>`
    : unwatched
    ? `<button class="btn pink wide" id="evWatch">▶ Predict &amp; watch</button>`
    : `<div class="albDone">✓ Watched</div>`;

  host.innerHTML = `<div class="modal albumModal"><div class="top">
      <button class="sheetX" id="evX" title="Close">✕</button>
      <div class="eyebrow">Episode ${ep} · the evidence</div>
      <h2>${Episodes.titleOf(ep)}</h2></div>
    <div class="mbody">
      <div class="albumBar"><div class="albumFill" style="width:${need ? Math.round(got / need * 100) : 0}%"></div></div>
      <div class="hint" style="margin:6px 0 10px"><b style="color:var(--teal)">${got}</b>/${need} clues ·
        ${Clues.authoredFor(ep).length} exist, so no two players read the same file.</div>
      ${rows}
      ${gaps ? `<div class="evGaps">${Array.from({ length: gaps }, () => `<div class="evGap"></div>`).join("")}</div>` : ""}
      <div class="albFoot">${foot}</div>
      <button class="btn ghost wide" id="evClose" style="margin-top:10px">Close</button>
    </div></div>`;
  host.classList.add("show");
  const close = () => { host.classList.remove("show"); host.innerHTML = ""; host.onclick = null; renderAll(); };
  $("#evClose").onclick = close;
  $("#evX").onclick = close;
  host.onclick = (e) => { if (e.target === host) close(); };
  const w = $("#evWatch");
  if (w) w.onclick = () => { close(); openPrediction(ep); };
}
