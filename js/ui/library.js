"use strict";
/* The episode library — everything unlocked so far, in one list, rewatchable.

   The list is DERIVED, not stored: Collection.unlockedEpisodeIds() reads it off the albums,
   because an episode is unlocked exactly when its page of cards is complete. state.epQueue only
   says which of them are still UNWATCHED, and it shrinks as they are watched — reading the
   library off that showed a player with four unlocked episodes just the one they had not seen.

   THREE different taps, because the three states are genuinely different — and one of them is
   "collected, but the story is not ready for it yet":

     never watched, and next in the story → the full flow, prediction and wager included. It is
                                         a first viewing and the bet has not been placed yet.
     never watched, but out of order     → refused, with a toast naming what comes first. The
                                         page is complete; the drama is serialised.
     already watched                   → the video alone. Betting on an episode whose ending you
                                         know is not a bet, so there is no wager, no clue spend
                                         and no queue change.

   That is why openPrediction takes an id: the library can start one for any unwatched episode,
   not only whichever happens to be at the front of the queue. */

function openLibrary(){
  const ids=Collection.unlockedEpisodeIds();
  if(!ids.length){ toast("🎞 Nothing unlocked yet — collect a full page of cards"); return; }
  const unwatched=ids.filter(id=>state.epQueue.includes(id)).length;
  const blocked=Collection.blockedBy();
  const next=Collection.firstUnwatchedId();
  const sealed=state.pendingReveal?state.pendingReveal.id:null;
  const rows=ids.map(id=>{
    const ep=Episodes.get(id);
    const isNew=state.epQueue.includes(id);
    /* Four states. A sealed episode has been BET ON but not watched to the end, so it is
       neither new (no second wager) nor a plain replay (its result is still owed). And an
       unwatched episode that is NOT next in the story is LOCKED — its page is complete, but the
       drama is serialised and something earlier is still owed. Marking it is what makes the
       ordering rule visible before it is enforced rather than only in a toast afterwards. */
    const locked=isNew&&id!==next;
    const tag=id===sealed?"FINISH":id===next?"NEXT":locked?"🔒":isNew?"NEW":"▶";
    const cls=id===sealed?" sealed":`${locked?" locked":isNew?" new":""}${id===next?" next":""}`;
    return `<button class="libRow${cls}" data-id="${id}">
        <span class="libNo">${id}</span>
        <span class="libTitle">${ep.title}</span>
        <span class="libTag">${tag}</span>
      </button>`;
  }).join("");
  $("#scrim").innerHTML=`<div class="modal"><div class="top"><div class="eyebrow">Library</div>
      <h2>${ids.length} episode${ids.length>1?"s":""}</h2></div>
    <div class="mbody">
      ${unwatched?`<div class="hint" style="margin-bottom:8px"><b style="color:var(--pink)">${unwatched}</b> not watched yet — those still take a prediction.${
          blocked?` <b style="color:var(--gold)">${Episodes.titleOf(blocked)}</b> comes first, and its cards are still out there.`:""}</div>`:""}
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
    /* Any unwatched row starts the next episode of the STORY, not the one tapped — the drama is
       serialised, so jumping ahead spoils what was skipped. openPrediction owns that rule and
       says so; it also refuses outright when the next one has not been collected yet. */
    openPrediction(id);
  });
}

/* A rewatch is the video and nothing else. Returns to the library when it ends or is closed,
   so working through a few in a row does not mean reopening the list each time. */
async function replayEpisode(id){
  const ep=Episodes.get(id);
  if(!ep){ toast(`⚠ Missing episode file for <b>${id}</b>`); return; }
  $("#scrim").innerHTML=`<div class="modal videoModal"><div class="top"><div class="eyebrow">EP ${Episodes.numberOf(ep.id)} \u00b7 Replay</div><h2>${ep.title}</h2></div>
    <div class="mbody">${playerMarkup(id)}</div></div>`;
  $("#scrim").classList.add("show");
  log("🎞",`Replaying <b>${ep.title}</b>`);
  await playVideo(id);          // resolves on end, or when the close button is pressed
  openLibrary();
}
