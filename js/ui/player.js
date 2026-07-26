"use strict";
/* Episode video player — owns both its markup and its behaviour.
   Callers render playerMarkup(id) into a modal, then await playVideo(id).

   Controls: autoplay (muted fallback), click to pause/resume, press-and-hold or a
   latching button for 2x, progress bar. There is deliberately no seek UI and no way
   to exit early. Auto-play session skips playback entirely but still logs the watch.
   See episodes/README.md for the player's behaviour table. */

function mmss(s){ if(!isFinite(s)||s<0) s=0; const m=Math.floor(s/60); return m+":"+String(Math.floor(s%60)).padStart(2,"0"); }

/* The player's DOM. Ids here are the contract playVideo() binds to. */
function playerMarkup(id){
  return `<div class="vwrap" id="vWrap">
      <video id="epVideo" class="epVideo" playsinline preload="auto" src="${Episodes.videoFor(id)}"></video>
      <div class="vpause">▶</div>
      <div class="vsound" id="vSound">🔇 tap for sound</div>
      <div class="vspeed" id="vSpeed">2×</div>
      <div class="vbar"><div class="vfill" id="vFill"></div></div>
      <div class="vtime" id="vTime">0:00</div>
    </div>
    <div class="vctrl"><button class="btn ghost speedBtn" id="speedBtn">⏩ 2× speed</button></div>`;
}

/* Drive the player. Resolves when the episode ends (or the fallback elapses). */
function playVideo(id){
  return new Promise(resolve=>{
    const wrap=$("#vWrap"), v=$("#epVideo");
    let done=false, maxTime=0;
    const finish=()=>{ if(done) return; done=true; try{ v&&v.pause(); }catch(e){} resolve(); };
    /* no video (or it failed to load) → keep the old placeholder behaviour */
    const fallback=()=>{
      if(done) return;
      if(wrap) wrap.innerHTML=`<div class="scene"><div class="play">🎬</div><div class="sceneBar" id="sBar"></div></div>`;
      const bar=$("#sBar");
      if(bar){ requestAnimationFrame(()=>{ bar.style.transition=`width ${cfg.fallbackSceneMs}ms linear`; bar.style.width="100%"; }); }
      setTimeout(finish,cfg.fallbackSceneMs);
    };
    if(!v){ fallback(); return; }

    /* Auto-play session is a batch economy tool — don't sit through 90s of footage.
       Read the length from metadata, log that the episode was watched, and move on.
       (Auto-roll deliberately does NOT skip: it simulates a real viewing session.) */
    if(typeof autoMode!=="undefined"&&autoMode==="session"){
      const title=Episodes.titleOf(id);
      let settled=false;
      const skip=(secs)=>{
        if(settled) return; settled=true;
        const len=isFinite(secs)&&secs>0?` · ${mmss(secs)} of footage`:"";
        log("⏩",`Auto-play watched <b>${title}</b>${len} (playback skipped)`);
        try{ v.pause(); v.removeAttribute("src"); v.load(); }catch(e){}   // abort the download
        finish();
      };
      if(isFinite(v.duration)&&v.duration>0) return skip(v.duration);
      v.addEventListener("loadedmetadata",()=>skip(v.duration));
      v.addEventListener("error",()=>skip(NaN));
      setTimeout(()=>skip(v.duration),2000);        // don't hang if metadata never arrives
      return;
    }

    v.addEventListener("error",fallback);
    v.addEventListener("ended",finish);
    v.addEventListener("contextmenu",e=>e.preventDefault());   // hide download / speed menu

    const fill=$("#vFill"), time=$("#vTime");
    v.addEventListener("timeupdate",()=>{
      if(v.currentTime>maxTime) maxTime=v.currentTime;
      const d=v.duration;
      if(isFinite(d)&&d>0){
        if(fill) fill.style.width=Math.min(100,(v.currentTime/d)*100)+"%";
        if(time) time.textContent=`${mmss(v.currentTime)} / ${mmss(d)}`;
      }
    });
    // block seeking ahead of what's actually been watched
    v.addEventListener("seeking",()=>{
      if(v.currentTime>maxTime+0.5) v.currentTime=maxTime;
    });

    /* Speed: press-and-hold the video for a temporary 2×, plus a latching 2× button.
       Effective rate is 2 whenever either is active. */
    const speedBtn=$("#speedBtn"), chip=$("#vSpeed");
    let latched=false, holding=false, pressTimer=null, suppressClick=false;
    const applyRate=()=>{
      const fast=latched||holding;
      v.playbackRate=fast?2:1;
      if(chip) chip.style.display=fast?"block":"none";
      if(speedBtn) speedBtn.classList.toggle("on",latched);
    };
    if(speedBtn) speedBtn.onclick=()=>{ latched=!latched; applyRate(); };
    wrap.addEventListener("pointerdown",()=>{
      if(done) return;
      pressTimer=setTimeout(()=>{
        holding=true;
        suppressClick=true;   // a hold must not also toggle pause
        applyRate();
      },cfg.longPressMs);
    });
    const endHold=()=>{
      clearTimeout(pressTimer);
      if(holding){ holding=false; applyRate(); }
    };
    ["pointerup","pointerleave","pointercancel"].forEach(e=>wrap.addEventListener(e,endHold));

    // click anywhere on the video toggles pause/resume (unless it was a hold)
    wrap.onclick=()=>{
      if(done) return;
      if(suppressClick){ suppressClick=false; return; }
      if(v.paused){ v.play().catch(()=>{}); wrap.classList.remove("paused"); }
      else { v.pause(); wrap.classList.add("paused"); }
    };

    // autoplay with sound; if the browser blocks it, retry muted and offer to unmute
    v.play().catch(()=>{
      v.muted=true;
      v.play().catch(fallback);
      const badge=$("#vSound");
      if(badge){
        badge.style.display="block";
        badge.onclick=(e)=>{ e.stopPropagation(); v.muted=false; badge.style.display="none"; };
      }
    });
  });
}
