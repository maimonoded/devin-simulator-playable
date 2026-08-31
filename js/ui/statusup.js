"use strict";
/* "Your status went up" — the beat a CONVERSION earns.

   GDD §4.3: the third copy of a card converts it into that card's Collectible, and that is the
   moment a duplicate stops being a consolation and becomes the thing the player is collecting
   toward. It is also the only inflow the player watches happen, so it gets the beat: the item,
   what it paid, and the track moving under it.

   Without it, converting a card moved a four-pixel bar in the corner of the HUD and nothing
   else. The one number every loop feeds deserves to be watched at least once.

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

    /* Painted art if the card has any, and the procedural face if it has not — `art` is OPTIONAL
       on a card (js/ui/cardface.js), so a Collectible can arrive with none, and url('null') is a
       blank square with nothing in the console to explain it. */
    const names=up.items.map(i=>i.name).join(" · ");

    /* THE CARD TURNS INTO THE PLAQUE, and that IS the beat.

       This used to be a ribbon: a fifty-pixel thumbnail, a name and a number, arriving AFTER the
       third copy's card beat had already fired confetti. So the loud moment announced a card and
       the quiet one carried the actual event — a card becoming a Collectible — which is the
       payoff three pulls were spent on. Worse, the transformation was never shown. The same art
       appeared in a smaller box.

       Now the card is held at size, in the face it has worn all along, reading 3 of 3. Then it
       turns edge-on and comes back as the plaque. One id, two faces (CLAUDE.md), and the flip is
       the sentence between them — the collection's whole thesis in half a second.

       ONE ITEM ONLY. A box can convert several at once, and half a dozen cards flipping in
       sequence is a cutscene; several arrive as plaques already, side by side. */
    const solo=up.items.length===1?up.items[0]:null;
    const card=solo?Cards.get(solo.id):null;
    const need=Cards.copiesToConvert();
    const faceCard=card
      ? cardFace(card,{owned:true,size:"lg",count:need,converted:false})
      : "";
    const facePlaque=it=>dropFace({kind:"status",item:it},{size:"lg"});
    const heroHtml=solo&&faceCard
      ? `<div class="suHero"><div class="suFace" id="suFace">${faceCard}</div></div>`
      : `<div class="suHero suMany">${up.items.map(facePlaque).join("")}</div>`;

    /* WHY THIS APPEARED. Without it the beat named a card, said +30, and left the player to work
       out what a card they already had has to do with anything — which is the one question a
       reward popup exists to answer. The answer is the conversion rule itself: this card is here
       because a third copy of it just landed.

       The plural case cannot name the reason twice, and several conversions in one box is the
       common way this arrives, so it says how many rather than how each happened. */
    const why=up.items.length>1
      ? `${up.items.length} Collectibles`
      : up.source==="converted"
        ? `Collected — ${Cards.copiesToConvert()} copies`
        : "Collected";
    const owed=Status.toNextLevel(to);
    el.innerHTML=`
      ${heroHtml}
      <div class="suWords">
        <span class="suWhat">${names}</span>
        <span class="suWhy">${why}</span>
        <!-- "now", because the plaque above states what the whole Collectible is worth and this
             is the part of it the track just received. Without the word they are two unexplained
             numbers about one event. -->
        <span class="suGain">+${fmt(to-from)} status now</span>
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
    /* THE FLIP, and then the track. Staged rather than simultaneous: two things moving at once
       means neither is watched, and the order is the order the events actually happened — the
       card became a Collectible, and THEN it was worth points.

       Timers, not transitionend: requestAnimationFrame and CSS transitions are both suspended in
       a background tab, and a beat that never swaps the face leaves the player looking at a card
       claiming 3 of 3 forever. Every stage here is on a setTimeout for the same reason the box
       promises are (js/ui/box3d.js). */
    const flipMs=Math.max(0,cfg.statusFlipMs||0);
    const face=$("#suFace");
    if(face&&solo&&flipMs>0){
      later(()=>{
        if(done) return;
        face.style.transition=`transform ${Math.round(flipMs/2)}ms cubic-bezier(.5,0,.9,.4)`;
        face.style.transform="rotateY(90deg)";
        later(()=>{
          if(done) return;
          /* Edge-on is where the object changes. Swapping at any other point shows the card
             becoming the plaque in plain view, which reads as a glitch rather than a turn. */
          face.innerHTML=facePlaque(solo);
          face.style.transition=`transform ${Math.round(flipMs/2)}ms cubic-bezier(.1,.6,.5,1)`;
          face.style.transform="rotateY(0deg)";
          confetti();
        },Math.round(flipMs/2)+20);
      },Math.max(0,+cfg.statusCardMs||0));
    }
    const trackAt=(solo&&flipMs>0?Math.max(0,+cfg.statusCardMs||0)+flipMs:0)+40;

    later(()=>nextPaint(()=>{
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
    }),trackAt);

    later(finish,trackAt+barMs+holdMs);
    /* A tap anywhere on it takes it away — the same courtesy the cards get. */
    el.onclick=finish;
  });
}
