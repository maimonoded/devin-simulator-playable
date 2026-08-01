"use strict";
/* Bonus mini-games — the full-frame games a tile can open instead of a popup.

   Each game is a self-contained page in minigames/, opened in an <iframe> over the board and
   talked to with postMessage. The iframe is not timidity, it is the only way this works: the app
   is classic scripts sharing ONE global namespace and one CSS cascade, and a game like
   steal-the-spotlight.html declares its own $, fmt, scene, camera, renderer, #collectBtn and a
   `*` reset. Inlining any of that is a syntax error or a silent repaint of the whole app. A
   separate realm also means every game keeps working when opened on its own, which is how they
   are authored — see minigames/README.md for the contract.

   THE ONE RULE: the game never decides money. The tile has already banked the coins (see
   js/tiles/train-tile.js) and the amount is handed over purely to be presented. If the game is
   disabled, missing, or broken, the player still gets paid — the fallback is the plain Collect
   popup, so a bad file costs presentation and never coins. */

/* key → page. A new bonus game is one line here plus the file. */
const MINIGAMES={
  "train-small":"minigames/steal-the-spotlight.html",
  "train-large":"minigames/gala-match3.html",
};

/* The live game, so clearOverlayFx() can tear one down after a mid-roll error. */
let bonusOpen=null;

/* Open the game for `spec` and resolve when the player collects.
   Resolves — never rejects — exactly once, on every path: collect, idle auto-collect, hard
   timeout, load failure, or teardown. roll()'s finally in js/ui/main.js is the only thing that
   clears state.animating, so a promise that never settles soft-locks the board. */
function showMinigame(spec){
  /* Auto-play session is the batch balancing tool: thousands of rolls, no one watching. Opening
     a WebGL page per train tile would be both pointless and a context leak, so it takes the same
     fast path the Collect popup does. Auto-ROLL deliberately does not — it simulates a real
     session, so it plays the game and lets it idle-collect like a player who looked away. */
  if(typeof autoMode!=="undefined"&&autoMode==="session") return showCollect(spec);
  const src=cfg.bonusGames?MINIGAMES[spec.game]:null;
  if(!src) return showCollect(spec);

  return new Promise(resolve=>{
    const host=$("#bonusHost");
    if(!host){ showCollect(spec).then(resolve); return; }

    let done=false;
    const timers=[];
    const after=(ms,fn)=>{ timers.push(setTimeout(fn,ms)); };

    const frame=document.createElement("iframe");
    frame.className="bonusFrame";
    frame.setAttribute("title","Bonus game");
    /* Same-origin on purpose: the handshake below checks e.origin, and a sandboxed frame would
       report "null" instead. serve.py serves the whole tree, so this is a normal same-site load. */
    frame.src=src;

    const teardown=()=>{
      timers.forEach(clearTimeout); timers.length=0;
      removeEventListener("message",onMsg);
      host.classList.remove("show"); host.innerHTML="";
      bonusOpen=null;
    };
    const finish=()=>{ if(done) return; done=true; teardown(); resolve(); };
    /* Give up on the game and pay out the normal way. Used when the page never reports ready. */
    const bail=()=>{ if(done) return; done=true; teardown(); showCollect(spec).then(resolve); };

    function onMsg(e){
      if(done) return;
      if(e.origin!==location.origin||e.source!==frame.contentWindow) return;
      const m=e.data||{};
      if(m.type==="bonus:ready"){
        timers.forEach(clearTimeout); timers.length=0;
        /* The random 10–20s the Collect popup has always used. It paces the TRAY — collecting is
           an acknowledgement, not a decision, and the coins are already banked either way. */
        const trayMs=rand(Math.min(cfg.collectMinSec,cfg.collectMaxSec),
                          Math.max(cfg.collectMinSec,cfg.collectMaxSec))*1000;
        /* Picking IS the decision, so it is never made for a player: idleMs 0 means "wait".
           Auto-roll is the one case with nobody to click — it simulates a session rather than
           watching one, so there the game plays its own round after the same window. */
        const auto=typeof autoMode!=="undefined"&&autoMode==="roll";
        /* The whole spec goes over, so a game's own payload (a prize ladder, a winning rung)
           needs no plumbing here — the tile puts it on the event and the game reads it. */
        frame.contentWindow.postMessage(Object.assign({},spec,{
          type:"bonus:open",
          /* The balance BEFORE the win, not the live one. The tile banked the coins before the
             game opened, so sending state.coins would have the game count UP from a total that
             already included the prize — ending one prize too high and snapping back to the real
             number the moment the HUD reappeared. Starting from the difference makes the count-up
             land exactly on what the player actually has. */
          coins:Math.max(0,state.coins-(spec.amount||0)),
          loadMs:cfg.bonusLoadMs, idleMs:auto?trayMs:0, trayMs,
        }),location.origin);
        /* Belt and braces, exactly as showCollect has: whatever happens inside that page, the
           roll loop gets its promise back. */
        after(cfg.bonusMaxMs,finish);
        return;
      }
      if(m.type==="bonus:done") finish();
    }

    addEventListener("message",onMsg);
    /* A page that never says hello is a broken or missing file. Don't strand the player. */
    after(Math.max(4000,cfg.bonusLoadMs+3000),bail);
    frame.addEventListener("error",bail);

    host.innerHTML=""; host.appendChild(frame); host.classList.add("show");
    bonusOpen={finish,bail};
  });
}
