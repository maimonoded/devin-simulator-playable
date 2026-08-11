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
   not only whichever happens to be at the front of the queue. */

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
  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">Library</div>
      <h2>${ids.length} episode${ids.length>1?"s":""}</h2></div>
    <div class="mbody">
      ${unwatched?`<div class="hint" style="margin-bottom:8px"><b style="color:var(--pink)">${unwatched}</b> not watched yet — those still take a prediction.</div>`:""}
      <div class="libList">${rows}</div>
      <button class="btn ghost wide" id="libClose" style="margin-top:12px">Close</button>
    </div></div>`;
  $("#scrim").classList.add("show");
  $("#libClose").onclick=()=>{ closeEpisodeUi(); renderAll(); };
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
