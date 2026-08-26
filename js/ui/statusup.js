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

   ---- the rank change ----

   When the points cross a rank boundary the bar cannot simply animate to its new fraction — it
   would run backwards, because the new rank starts near empty. So it fills to the top of the old
   rank first, the rank flips, and then it fills to where it really is. Two moves, in the order
   the player's progress actually happened. */

function showStatusUp(up){
  return new Promise(resolve=>{
    const auto=typeof autoMode!=="undefined"&&autoMode==="session";
    const el=$("#statusUp");
    if(auto||!el||!up||!up.items||!up.items.length) return resolve();

    const from=up.from|0, to=up.to|0;
    const rankFrom=Status.rank(from), rankTo=Status.rank(to);
    const levelled=rankFrom.name!==rankTo.name;
    const barMs=Math.max(0,cfg.statusBarMs||0);
    const holdMs=Math.max(0,cfg.statusUpMs||0);

    const items=up.items.map(i=>
      `<span class="suItem" style="${cardArtCss(i.art)}" title="${i.name.replace(/"/g,"&quot;")}"></span>`).join("");
    const names=up.items.map(i=>i.name).join(" · ");
    const next=Status.nextRank(to);
    el.innerHTML=`
      <div class="suRow">
        <span class="suArt">${items}</span>
        <span class="suWords">
          <span class="suWhat">${names}</span>
          <span class="suGain">+${fmt(to-from)} status</span>
        </span>
      </div>
      <div class="suTrack">
        <span class="suIco" id="suIco">${rankFrom.icon}</span>
        <span class="suName" id="suName">${rankFrom.name}</span>
        <span class="suBar"><span class="suFill" id="suFill"></span></span>
        <span class="suNext" id="suNext">${next?`${fmt(Status.toNext(to))} to ${next.name}`:"top rank"}</span>
      </div>
      ${levelled?`<div class="suNew" id="suNew">New rank · ${rankTo.icon} ${rankTo.name}</div>`:""}`;
    el.classList.add("show");
    el.classList.toggle("levelled",levelled);

    const fill=$("#suFill");
    const pct=(p)=>Math.round(Status.rankProgress(p)*100)+"%";
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
        /* 1 · to the top of the rank they were in */
        const half=Math.max(1,Math.round(barMs*0.45));
        fill.style.transition=`width ${half}ms cubic-bezier(.3,.8,.4,1)`;
        fill.style.width="100%";
        later(()=>{
          /* 2 · the rank turns over, and the bar starts again where the new one starts */
          const ico=$("#suIco"), name=$("#suName"), tag=$("#suNew");
          if(ico) ico.textContent=rankTo.icon;
          if(name){ name.textContent=rankTo.name; name.classList.add("pop"); }
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
