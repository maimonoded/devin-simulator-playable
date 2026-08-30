"use strict";
/* "Your status went up" — the beat a status item earns.

   A collection card and a status item come out of the same box seconds apart and are completely
   different things: a card is spent on unlocking an episode, an item goes on the player's shelf
   and stays there. The gold frame says which is which (js/ui/box3d.js, css/collection.css); this
   says what it DID — the track moving, and the rank changing when it changes.

   Without it, earning an item moved a four-pixel bar in the corner of the HUD and nothing else.
   The one number both loops feed deserves to be watched at least once.

   ---- what it is not ----

   Not a dialog. No scrim, no panel, no close button: a ribbon over the board, the board still
   visible and live behind it. It blocks the roll loop the way every other reward beat does, and
   a tap takes it away early.

   ---- the level change ----

   When the points cross a LEVEL boundary the bar cannot simply animate to its new fraction — it
   would run backwards, because the new level starts near empty. So it fills to the top of the old
   level first, the level flips, and then it fills to where it really is. Two moves, in the order
   the player's progress actually happened.

   Crossing several levels at once (a set completing is 250 points, and an early level costs 200)
   is the same beat: it fills, flips to the level actually reached, and fills again. Animating
   every level in between would be honest and unwatchable. */

function showStatusUp(up){
  return new Promise(resolve=>{
    const auto=typeof autoMode!=="undefined"&&autoMode==="session";
    const el=$("#statusUp");
    if(auto||!el||!up||!up.items||!up.items.length) return resolve();

    const from=up.from|0, to=up.to|0;
    const lvFrom=Status.level(from), lvTo=Status.level(to);
    const rankFrom=Status.rank(from), rankTo=Status.rank(to);
    const levelled=lvTo>lvFrom;
    const barMs=Math.max(0,cfg.statusBarMs||0);
    const holdMs=Math.max(0,cfg.statusUpMs||0);

    const items=up.items.map(i=>
      `<span class="suItem" style="${cardArtCss(i.art)}" title="${i.name.replace(/"/g,"&quot;")}"></span>`).join("");
    const names=up.items.map(i=>i.name).join(" · ");

    /* WHY THIS APPEARED. Without it the beat named a mug, said +5, and left the player to work
       out what a mug has to do with anything — which is the one question a reward popup exists
       to answer. The information was always there: the caller knows whether it came out of a
       box or was earned, and the item knows its own condition.

       Only for a single item: two arriving together have two different reasons and one line
       cannot carry both, so the plural case says what they have in common instead. */
    const one=up.items.length===1?up.items[0]:null;
    const why=up.items.length>1
      ? `${up.items.length} pieces for your Showcase`
      : up.source==="box"
        ? "Found in the pack"
        : one&&Status.earnWords(one)
          ? `Earned at ${Status.earnWords(one)}`
          : "Earned";
    const owed=Status.toNextLevel(to);
    el.innerHTML=`
      <div class="suRow">
        <span class="suArt">${items}</span>
        <span class="suWords">
          <span class="suWhat">${names}</span>
          <span class="suWhy">${why}</span>
          <span class="suGain">+${fmt(to-from)} status · on your shelf</span>
        </span>
      </div>
      <div class="suTrack">
        <span class="suIco" id="suIco">${rankFrom.icon}</span>
        <span class="suName" id="suName">Level ${lvFrom}</span>
        <span class="suBar"><span class="suFill" id="suFill"></span></span>
        <!-- "35 to LV 4", not "35 to 4" — which read as a range counting DOWNWARD, or as a
             score. The slot is narrow so this was written terse, and terse went past compact
             into meaningless. "LV n" is the vocabulary the estate plaque already uses. -->
        <span class="suNext" id="suNext">${owed?`${fmt(owed)} to LV ${lvTo+1}`:"Season complete"}</span>
      </div>
      ${levelled?`<div class="suNew" id="suNew">Level ${lvTo}${
          rankTo.name!==rankFrom.name?` · ${rankTo.icon} ${rankTo.name}`:""}</div>`:""}`;
    el.classList.add("show");
    el.classList.toggle("levelled",levelled);

    const fill=$("#suFill");
    const pct=(p)=>Math.round(Status.levelProgress(p)*100)+"%";
    fill.style.transition="none";
    fill.style.width=pct(from);

    let done=false, timers=[];
    const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
    const finish=()=>{
      if(done) return; done=true;
      timers.forEach(clearTimeout);
      el.classList.remove("show","levelled");
      el.innerHTML=""; el.onclick=null;
      renderAll();
      resolve();
    };

    /* Next paint, or the transition is set and the width changed in one style recalc and the bar
       jumps rather than moves. nextPaint rather than a bare rAF because the rank flip is staged
       behind this: rAF is suspended in a background tab, and a beat that never flips the rank is
       worse than one that flips it without animating. */
    nextPaint(()=>{
      if(done) return;
      if(!levelled){
        fill.style.transition=`width ${barMs}ms cubic-bezier(.2,.9,.3,1)`;
        fill.style.width=pct(to);
      }else{
        /* 1 · to the top of the level they were in */
        const half=Math.max(1,Math.round(barMs*0.45));
        fill.style.transition=`width ${half}ms cubic-bezier(.3,.8,.4,1)`;
        fill.style.width="100%";
        later(()=>{
          /* 2 · the level turns over, and the bar starts again where the new one starts */
          const ico=$("#suIco"), name=$("#suName"), tag=$("#suNew");
          if(ico) ico.textContent=rankTo.icon;
          if(name){ name.textContent="Level "+lvTo; name.classList.add("pop"); }
          if(tag) tag.classList.add("in");
          if(ico) ico.classList.add("pop");
          confetti();
          fill.style.transition="none"; fill.style.width="0%";
          nextPaint(()=>{
            if(done) return;
            fill.style.transition=`width ${barMs-half}ms cubic-bezier(.2,.9,.3,1)`;
            fill.style.width=pct(to);
          });
        },half+60);
      }
    });

    later(finish,barMs+holdMs);
    /* A tap anywhere on it takes it away — the same courtesy the cards get. */
    el.onclick=finish;
  });
}
