/* Debug menu — the development jumps, and the HUD button that opens them.

   Its own file rather than a corner of drawer.js, because it is not part of the drawer: the
   drawer is hidden in ?view=mobile and this is used mostly THERE. Keeping it separate is also
   how it ships nowhere — deleting one <script> tag takes the whole tool with it, and it builds
   its own button rather than declaring one in index.html so there is no markup left behind.

   Depends on the UI layer below it (render, fx) and on main.js at call time only. */

/* ---------------- the debug button ----------------
   IN THE HUD, not in the drawer. It lived in the drawer first because the drawer is the
   development surface and is hidden in ?view=mobile for free — but that is exactly the problem:
   the phone view is where this gets used, and there is no drawer there to open. The HUD is the
   one bar that survives both framings (js/ui/main.js reparents it INTO the board scene in mobile,
   so anything in it comes along).

   BUILT FROM JS, not declared in index.html. A dev tool that exists only because a script created
   it is removed by dropping that script — nothing to unpick from the markup, and no chance of it
   shipping in a build that forgot to strip it. */
function buildDebugButton(){
  const hud=document.querySelector(".hud");
  if(!hud||$("#debugBtn")) return;
  const b=document.createElement("button");
  b.className="avatarBtn"; b.id="debugBtn"; b.title="Debug — jump to a tile";
  b.textContent="🐞";
  b.style.cssText="margin-left:6px;background:var(--panel2);border:1px solid var(--line)";
  b.onclick=openDebugPanel;
  /* After the avatar, which is itself margin-left:auto — so the pair sits at the far right in
     both framings without either needing to know about the other. */
  const av=$("#avatarBtn");
  if(av&&av.parentElement===hud) av.insertAdjacentElement("afterend",b); else hud.appendChild(b);
}

/* The actions, as a sheet in #sheetHost — the in-scene modal host the profile and the library
   both use, so it is framed by the board window and works in the phone view. */
function openDebugPanel(){
  const host=$("#sheetHost");
  if(!host) return;
  host.innerHTML=`<div class="modal"><div class="top">
      <button class="sheetX" id="debugX" title="Close">✕</button>
      <div class="eyebrow">Development</div><h2>Jump to a tile</h2></div>
    <div class="mbody">
      <p class="hint" style="margin:0 0 10px">Walks the token there and resolves the landing exactly
      as a roll would — the lap bonus, the tile, any overlay on it. No energy is spent, but your
      current stake DOES apply to what the tile pays, exactly as it would on a real roll.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${DEBUG_ACTIONS.map((a,i)=>
        `<button class="btn ghost" data-dbg="${i}" title="${a.hint||""}"
             style="padding:11px 8px;font-size:12.5px;justify-content:center">${a.label}</button>`).join("")}</div>
    </div></div>`;
  host.classList.add("show");
  const close=()=>{ host.classList.remove("show"); host.innerHTML=""; host.onclick=null; };
  $("#debugX").onclick=close;
  host.onclick=(e)=>{ if(e.target===host) close(); };
  host.querySelectorAll("[data-dbg]").forEach(btn=>btn.onclick=()=>{
    const a=DEBUG_ACTIONS[+btn.dataset.dbg];
    close();                       // every one of these is a thing to WATCH
    debugRun(a);
  });
}

/* ---------------- debug actions ----------------
   Each one names a tile to walk to. `to` is resolved when the button is pressed, not when the
   drawer is built, so "the next card tile" means the next one from wherever the token is now.

   These deliberately go the long way round the board rather than teleporting: arriving anywhere
   on this board means stepping onto every tile in between, collecting the lap bonus if Start is
   crossed, and resolving whatever is waiting at the end. A debug jump that skipped all that
   would be testing a path the game does not have. */
const DEBUG_ACTIONS=[
  {label:"🎬 Go to Reshoot", hint:"the jail corner", to:()=>30},
  {label:"🃏 Next card tile", hint:"the next deck draw, clockwise", to:()=>nextTileOfType(state.pos,"deck")},
  {label:"💆 Go to Spa",     hint:"energy corner",  to:()=>10},
  {label:"🌟 Go to VIP",     hint:"collects the pool", to:()=>20},
  {label:"⭐ Go to Start",   hint:"a full lap if you are on it", to:()=>0},
  {label:"👷 Go to Payroll", hint:"a bill", to:()=>3},
  {label:"🏢 Go to Overheads", hint:"the bigger bill", to:()=>23},
];

/* Walk there and resolve it, borrowing roll()'s shape exactly — including the try/finally, which
   is not optional: state.animating is what gates the Roll button, and a debug action that threw
   halfway would leave the board soft-locked with no way back short of a reload.

   The drawer closes first. Every one of these is a thing to WATCH, and watching it from behind
   the panel that launched it is no use. */
async function debugRun(action){
  if(state.animating) return;
  const to=action.to();
  if(to==null){ toast("🐞 Nothing of that kind on the board"); return; }
  $("#drawer").classList.remove("open");   // harmless if it was never open
  state.animating=true; renderAll();
  try{
    /* Hand the loop back first if auto-roll owns it — runAuto treats a second call as "stop".
       (There is no stopAuto(): it went with the builders, which were its only caller.) */
    if(typeof autoMode!=="undefined"&&autoMode!==null) autoRoll();
    const path=pathBetween(state.pos,to);
    let passedStart=false;
    for(const p of path){
      state.pos=p;
      if(p===0) passedStart=true;
      positionToken();
      await sleep(cfg.tokenStepMs);
    }
    /* The lap bonus is for PASSING Start, so landing on it is the tile's business, not this. */
    if(passedStart&&state.pos!==0){
      const pass=applyPassStart(state.mult);
      floatToken("+"+fmt(pass),"var(--gold)");
      log("⭐",`Passed Start · +<b>${fmt(pass)}</b> coins`);
    }
    log("🐞",`Debug · walked to <b>${to}</b> (${tileType(to)})`);
    await playEvents(resolveLandingEvents(state.mult));
  }catch(e){
    console.error("debug action failed:",e);
    log("⚠️","<b>Debug action failed</b> — board recovered.");
    clearOverlayFx();
  }finally{
    state.animating=false; renderAll();
  }
}
