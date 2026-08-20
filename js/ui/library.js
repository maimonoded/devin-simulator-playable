"use strict";
/* The episode library — everything unlocked so far, in one list, rewatchable.

   The list is DERIVED, not stored: Tickets.unlockedEpisodeIds() reads it off the completed
   placeholders, because the episode id is its number ("003" is the third episode). state.epQueue
   only says which of them are still UNWATCHED, and it shrinks as they are watched — reading the
   library off that showed a player with four unlocked episodes just the one they had not seen.

   Two different taps, because the two states are genuinely different:

     never watched (still in epQueue)  → the full flow, prediction and wager included. It is a
                                         first viewing and the bet has not been placed yet.
     already watched                   → the video alone. Betting on an episode whose ending you
                                         know is not a bet, so there is no wager, no clue spend
                                         and no queue change.

   That is why openPrediction takes an id: the library can start one for any unwatched episode,
   not only whichever happens to be at the front of the queue.

   THE LIBRARY IS THE EPISODES SCREEN. The 🎬 button on the play row opens this and nothing else
   — it used to jump straight into the prediction, and there was a second, top-left library
   button for the list. One list, one door. The jump did not disappear, it became the WATCH
   button at the top of this modal, which starts exactly the flow that button started.

   The Watch button is only drawn when something is actually playable, and what "playable" means
   is Tickets.firstUnwatchedId()'s answer, not ours: it returns null when the ordering gate
   refuses everything queued, and in that state the honest thing is a list with no primary
   action rather than a button that explains itself only after being pressed. */

function openLibrary(){
  const ids=Tickets.unlockedEpisodeIds();
  if(!ids.length){ toast(`🎞 Nothing unlocked yet — collect ${Tickets.perEpisode()} tickets`); return; }
  const unwatched=ids.filter(id=>state.epQueue.includes(id)).length;
  const next=Tickets.firstUnwatchedId();
  const sealed=state.pendingReveal?state.pendingReveal.id:null;
  const rows=ids.map(id=>{
    const ep=Episodes.get(id);
    const isNew=state.epQueue.includes(id);
    /* Three states, not two. A sealed episode has been BET ON but not watched to the end, so
       it is neither new (no second wager) nor a plain replay (its result is still owed). Mark
       the one that will actually play, so the ordering rule is visible before it is enforced
       rather than only in a toast afterwards. */
    const tag=id===sealed?"FINISH":id===next?"NEXT":isNew?"NEW":"▶";
    const cls=id===sealed?" sealed":`${isNew?" new":""}${id===next?" next":""}`;
    return `<button class="libRow${cls}" data-id="${id}">
        <span class="libNo">${id}</span>
        <span class="libTitle">${ep.title}</span>
        <span class="libTag">${tag}</span>
      </button>`;
  }).join("");
  /* A sealed bet wins over the queue: openPrediction resumes it whatever it is handed, so the
     button says so instead of naming an episode it would then refuse to start. */
  const playId=sealed||next;
  /* The count on the button is what can be watched IN A ROW from here — Tickets.bingeableCount(),
     not the 🎬 badge's number. The badge counts everything waiting; this counts what pressing the
     button will actually get through before the ordering gate stops it, which with four
     collections filling at once are routinely different numbers. Floored at 1: playId exists, so
     at least one is playable — an orphaned episode off the row has no slot to be counted in. */
  const bingeable=playId?Math.max(1,Tickets.bingeableCount()):0;
  const watch=playId
    ? `<button class="btn pink wide" id="libWatch" style="margin-bottom:10px">
         <span class="libWatchLabel">${sealed?"▶ Finish":"▶ Watch"} ${Episodes.titleOf(playId)}</span>
         <span class="libWatchCount" title="Ready to watch back to back">${bingeable}</span></button>`
    : "";
  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">Library</div>
      <h2>${ids.length} episode${ids.length>1?"s":""}</h2></div>
    <div class="mbody">
      ${watch}
      ${unwatched?`<div class="hint" style="margin-bottom:8px"><b style="color:var(--pink)">${unwatched}</b> not watched yet — those still take a prediction.</div>`:""}
      <div class="libList">${rows}</div>
      <button class="btn ghost wide" id="libClose" style="margin-top:12px">Close</button>
    </div></div>`;
  $("#scrim").classList.add("show");
  $("#libClose").onclick=()=>{ closeEpisodeUi(); renderAll(); };
  /* The old 🎬 button's whole behaviour, unchanged and in one line — the ordering rule stays
     inside openPrediction, which is the only place that has ever enforced it. */
  if(playId) $("#libWatch").onclick=()=>openPrediction(playId);
  $("#scrim").querySelectorAll(".libRow").forEach(b=>b.onclick=()=>{
    const id=b.dataset.id;
    // a sealed episode always resumes, whichever row was tapped — the result is owed on it
    if(state.pendingReveal) return openPrediction(id);
    if(!state.epQueue.includes(id)) return replayEpisode(id);
    /* Any unwatched row starts the EARLIEST unwatched episode, not the one tapped — the story
       is serialised, so jumping ahead spoils what was skipped. Say so, or being handed a
       different episode than the one you pressed just reads as a bug. */
    const next=Tickets.firstUnwatchedId()||id;
    if(next!==id) toast(`▶ Episodes play in order — starting <b>${Episodes.titleOf(next)}</b>`);
    openPrediction(next);
  });
}

/* A rewatch is the video and nothing else. Returns to the library when it ends or is closed,
   so working through a few in a row does not mean reopening the list each time. */
async function replayEpisode(id){
  const ep=Episodes.get(id);
  if(!ep){ toast(`⚠ Missing episode file for <b>${id}</b>`); return; }
  $("#scrim").innerHTML=`<div class="modal videoModal"><div class="top"><div class="eyebrow">Replay</div><h2>${ep.title}</h2></div>
    <div class="mbody">${playerMarkup(id)}</div></div>`;
  $("#scrim").classList.add("show");
  log("🎞",`Replaying <b>${ep.title}</b>`);
  await playVideo(id);          // resolves on end, or when the close button is pressed
  openLibrary();
}
