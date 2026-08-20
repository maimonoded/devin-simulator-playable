"use strict";
/* THE FIRST-TIME FLOW — Zara's scripted opening, and the two switches that get a developer past it.

   Built from "FTUE Wireframe v2": nine screens, content-first, ending on "Let's unlock more
   episodes". The player watches two episodes before being asked for anything, guesses once, and
   always wins. There is no Builder and no wager here — both were cut from the storyboard.

     1   splash          brand + progress, the only beat on a timer
     2   host welcome    Zara introduces herself and the two free episodes
     3   episode 1       plays clean — no guess, no stakes
     4   Zara reacts     her reaction is the transition into episode 2
     5   the guess       episode 2's real question, no coins, no wager language
     5a  wrong pick      Zara stops the player and points at the other answer (a loop, not a screen)
     6   episode 2       plays with the locked guess riding along
     7   first win       YOU CALLED IT + the scripted coins
     8   unlock more     one CTA, and the intro is over

   MORE BEATS ARE COMING. STEPS is an ordered list and nothing indexes into it, so a new screen is
   an entry in the right place and nothing else.

   ---- a step ----

     { id:"welcome", run:async ctx => { ... } }

   `run` is an ordinary async function and the step is over when it resolves. Deliberately the
   whole contract: a beat can be a line of copy, a video, a branching question, or all three, and a
   narrower shape would have to be widened for the first one that did not fit. `ctx` is this object.

   A step must ALWAYS resolve. Anything it waits on goes through ctx.until() — which ctx.screen()
   and ctx.tap() already do — or Skip tears the UI down and leaves the run loop parked on a promise
   nobody will settle.

   ---- what the intro GIVES ----

   Rewards land at the moment they are earned, not in a lump at the end: episode 1 is banked when
   it has played, the coins when the player taps Collect, episode 2 when it has played. So a player
   who walks out halfway keeps exactly what they actually did, and Skip needs no unwind logic of
   its own. See _bankEpisode().

   ---- getting past it ----

   Two switches, deliberately NOT the same switch:

     ?ftue=false      bypass, this load only. Nothing is written down: drop the parameter and the
                      intro is back. For looking at the game without the intro in the way.
     the Skip button  a dismissal. Sets state.ftueDone, which persists.

   ?ftue=true (or a bare ?ftue) forces it to run even for a player who has seen it, which is how
   you iterate on it without wiping progress. The debug menu's Replay does the same with no reload. */

const Ftue={

  /* The two episodes the intro is built on. Real episodes with their real questions, videos and
     answers — the intro teaches the actual game rather than a mock-up of it. Both are authored
     with correct:0, which the guided guess relies on; FTUE_EP2's question IS the one Zara asks. */
  EP1:"001",
  EP2:"002",

  /* Zara's poses. Missing files degrade to a plain silhouette rather than a broken image — the
     same contract as tile art and props, so the flow is playable before the art lands.
     See assets/host/README.md. */
  ART:"assets/host/",
  POSE:{
    welcome:"zara-welcome.png",   // the full character shot — screen 2
    excited:"zara-excited.png",   // screen 4, and the win
    thinking:"zara-thinking.png", // screen 5 and the hint
    eager:"zara-eager.png",       // screen 8
    face:"zara-face.png",         // the little round avatar in a bubble over video
  },

  /* ---------- the script ---------- */
  STEPS:[

    /* 1 · SPLASH. The only screen that advances on a timer — everything after it waits for a tap,
       because an intro that moves on by itself is an intro the player is reading behind. */
    { id:"splash", run:async ctx=>{
        ctx.screen(`<div class="ftueSplash">
            <div class="ftueLogo">🎬</div>
            <div class="ftueBrand">HARBOUR HEIGHTS</div>
            <div class="ftueTag">ENDLESS MICRO·DRAMA</div>
            <div class="ftueLoad"><i></i></div>
            <div class="ftueLoadTxt">loading episodes…</div>
          </div>`,{chrome:false});
        await ctx.wait(cfg.ftueSplashMs);
      } },

    /* 2 · HOST WELCOME. Zara, the hook, and the first tap. No sign-in, nothing asked for. */
    { id:"welcome", run:async ctx=>{
        ctx.screen(ctx.hostScreen({
          pose:"welcome",
          title:"Hey — welcome in.",
          say:"I'm Zara, your host. The first two episodes are on me — let's watch.",
          cta:"▶ Start watching",
        }));
        await ctx.tap("#ftueCta");
      } },

    /* 3 · EPISODE 1. Plays clean. Banked as watched the moment it is over — including when the
       player closes it early, because they were given it rather than having earned it. */
    { id:"ep1", run:async ctx=>{
        await ctx.playEpisode(ctx.EP1,"Sit back and enjoy — this one's just for watching.");
        ctx._bankEpisode(ctx.EP1);
      } },

    /* 4 · ZARA REACTS. Her reaction IS the transition — no rate-us card, no interstitial. */
    { id:"react", run:async ctx=>{
        ctx.screen(ctx.hostScreen({
          pose:"excited",
          say:"Oh wow — I did NOT see that coming! I have to know what happens next… let's keep watching.",
          cta:"▶ Play next episode",
        }));
        await ctx.tap("#ftueCta");
      } },

    /* 5 · THE GUESS, and 5a folded into it as a loop rather than a screen of its own — 5a is the
       same screen with different copy, and splitting it would mean two places that have to agree
       about which answer is correct.

       GUIDED, NOT GATED: there is no fail state. A wrong tap greys that option out and Zara points
       at the other one, and the loop only leaves when the correct answer is tapped. The question,
       the answers and which one is right all come off the episode file — nothing about the intro
       decides what is true about episode 2. */
    { id:"guess", run:async ctx=>{
        const ep=Episodes.get(ctx.EP2)||{};
        const answers=ep.answers||[];
        const right=ep.correct|0;
        const dead=new Set();
        const ask="Hmm… I wonder — what do you think?";
        const hint="Ooh — hold on. Watch her face in that last scene… I'd go the other way.";
        for(;;){
          ctx.screen(ctx.hostScreen({
            pose:"thinking",
            say:dead.size?hint:ask,
            /* The episode's own question, in the PANEL. Zara's bubble is the invitation; this is
               the text the answers actually answer, so it sits with them and is sized to be read
               rather than glanced at. */
            ask:ep.question||"",
            options:answers.map((a,i)=>({
              text:a.text,
              /* Three states: dead (tapped and wrong), lit (the one Zara is pointing at once she
                 has had to say something), plain. */
              cls:dead.has(i)?"dead":(dead.size&&i===right?"lit":""),
            })),
          }));
          const pick=await ctx.tapOne(".ftueOpt");
          if(pick===right) return ctx._pick=pick;
          dead.add(pick);
        }
      } },

    /* 6 · EPISODE 2, with the locked guess riding along as a chip. */
    { id:"ep2", run:async ctx=>{
        const ep=Episodes.get(ctx.EP2)||{};
        const a=(ep.answers||[])[ctx._pick|0];
        await ctx.playEpisode(ctx.EP2,"Let's see if you read her right…",
          a?`your guess: ${a.text}`:"");
        ctx._bankEpisode(ctx.EP2);
      } },

    /* 7 · THE FIRST WIN. Always a win — the guess in 5 cannot be left wrong. The coins land on
       Collect rather than on arrival at this screen, so the tap is what pays. */
    { id:"win", run:async ctx=>{
        /* The same scene as every other Zara beat, dressed for a win: she is IN it, celebrating,
           rather than reduced to a thumbnail in a bubble at the bottom. */
        ctx.screen(ctx.hostScreen({
          pose:"excited",
          say:"Nice read! That's how you win big around here.",
          cta:"Collect",
          lead:`<div class="ftueBurst"></div>
            <div class="ftueWinHead">
              <div class="ftueWinTitle">YOU<br>CALLED IT!</div>
              <div class="ftueWinPay"><span class="ftueCoin">🪙</span>
                <span class="ftueWinAmt">+${fmt(cfg.ftueWinCoins)}</span></div>
            </div>`,
        }));
        if(typeof confetti==="function") confetti();
        await ctx.tap("#ftueCta");
        state.coins+=Math.max(0,cfg.ftueWinCoins|0);
        log("🎉",`Called it — <b>${fmt(cfg.ftueWinCoins)}</b> coins`);
        renderAll();
      } },

    /* 8 · UNLOCK MORE. The end of the intro in this version. The button drops straight onto the
       live board — the old "spotlight Roll" beat was cut from the storyboard, and the board's own
       controls are already where the player is looking. */
    { id:"handoff", run:async ctx=>{
        ctx.screen(ctx.hostScreen({
          pose:"eager",
          say:"I can't wait to see what happens next — let's unlock more episodes!",
          cta:"Let's unlock more episodes",
        }));
        await ctx.tap("#ftueCta");
      } },
  ],

  /* ---------- should it run? ---------- */
  /* Read once, at load. The parameter cannot change without a reload, and re-parsing the URL on
     every call would only invite someone to mutate it from the console and get two answers. */
  PARAM:(()=>{ try{ return new URLSearchParams(location.search).get("ftue"); }catch(e){ return null; } })(),
  /* A bare ?ftue counts as ON — it is what someone types when they mean "give me the intro", and
     reading an empty value as "no opinion" would silently do the opposite. */
  forced(){ return this.PARAM!=null&&/^(|1|true|on|yes)$/i.test(this.PARAM); },
  bypassed(){ return this.PARAM!=null&&/^(0|false|off|no)$/i.test(this.PARAM); },
  wanted(){
    if(this.bypassed()) return false;      // this load only, and nothing is written down
    if(this.forced())   return true;       // replay, even for a save that has seen it
    return !state.ftueDone;
  },

  /* ---------- running ---------- */
  active:false,
  _i:-1,
  _bail:null,      // resolves the moment the run ends, however it ends
  _abort:null,
  _pick:0,

  /* Called from boot(). Silent when it is not wanted — a no-op that logs is a no-op that makes
     every returning player's log look like something happened. */
  maybeStart(){ if(this.wanted()) this.start(); },

  async start(){
    if(this.active) return;
    this.active=true; this._i=-1; this._pick=0;
    this._bail=new Promise(res=>{ this._abort=res; });
    document.documentElement.classList.add("ftueOn");
    const stage=$("#ftueStage"); if(stage) stage.classList.add("show");
    const skip=$("#ftueSkip");   if(skip)   skip.classList.add("show");
    log("🎓","Starting the intro");
    try{
      for(let i=0;i<this.STEPS.length;i++){
        if(!this.active) break;            // skipped mid-step
        this._i=i;
        await this.until(this.STEPS[i].run(this));
      }
    }catch(e){
      /* A broken step must not strand the player inside a half-drawn intro with the board behind
         it — fall through to finish(), which puts the game back. */
      console.error("FTUE step failed:",e);
    }
    this.finish();
  },

  /* Race anything a step waits on against the end of the run, so Skip settles it. */
  until(p){ return Promise.race([Promise.resolve(p),this._bail]); },

  /* The player pressed Skip: dismissed for good. Nothing to unwind — every reward the intro gives
     was banked at the moment it was earned. */
  skip(){
    if(!this.active) return;
    log("🎓","Intro skipped");
    this.finish();
  },

  /* THE ONE EXIT, whichever way the run ends — finished, skipped, or thrown out of. Idempotent,
     because start()'s loop calls it after a skip has already called it. */
  finish(){
    if(!this.active) return;
    this.active=false; this._i=-1;
    if(this._abort){ this._abort(); this._abort=null; }
    document.documentElement.classList.remove("ftueOn");
    const stage=$("#ftueStage");
    if(stage){ stage.classList.remove("show"); stage.innerHTML=""; }
    const skip=$("#ftueSkip"); if(skip) skip.classList.remove("show");
    state.ftueDone=true;
    if(typeof saveState==="function") saveState();
    renderAll();
  },

  /* Hand the intro back and run it again, without touching anything else the player has done. */
  replay(){
    state.ftueDone=false;
    if(typeof saveState==="function") saveState();
    if(this.active) this.finish();
    this.start();
  },

  /* ---------- what the intro banks ----------
     "The first two episodes are on me" has to be said in the row's own language, because that is
     where isWatched() reads from: fill the episode's placeholder, queue it the way award() does,
     then take it straight back out of the queue — filled AND watched. Which leaves the row showing
     two collections done and the player collecting toward the third, which is the board they are
     handed at the end.

     Idempotent: replaying the intro on a save that already has episode 1 banked must not
     double-count epsWatched or re-queue an id Tickets.completeEpisode has already seen. */
  _bankEpisode(id){
    const slot=state.tickets.findIndex((_,i)=>Tickets.idAt(i)===id);
    if(slot<0) return;
    if(Tickets.isFull(slot)&&Tickets.isWatched(slot)) return;    // already given
    state.tickets[slot]=Tickets.perEpisode();
    Tickets.completeEpisode(slot);                               // guarded against double-queueing
    const k=state.epQueue.indexOf(id);
    if(k>=0) state.epQueue.splice(k,1);                          // watched, not waiting
    state.epsWatched=(state.epsWatched|0)+1;
    if(typeof saveState==="function") saveState();
    log("🎬",`Episode watched · <b>${Episodes.titleOf(id)}</b>`);
    renderAll();
  },

  /* ---------- drawing ----------
     One stage, replaced whole on every beat. There is no diffing and no component tree: a screen
     is a string, and the step that drew it owns the handlers it binds afterwards. */
  screen(html,{chrome=true}={}){
    const el=$("#ftueStage");
    if(!el) return;
    el.innerHTML=`<div class="ftuePhone${chrome?"":" bare"}">${html}</div>`;
    /* Re-triggered per screen rather than transitioned on the container, so each beat arrives
       under its own power instead of the whole stage sliding once at the start. */
    const card=el.firstElementChild;
    if(card) card.animate(
      [{opacity:0,transform:"translateY(10px)"},{opacity:1,transform:"none"}],
      {duration:Math.max(1,cfg.ftueFadeMs|0),easing:"cubic-bezier(.22,1,.36,1)"});
  },

  /* A Zara screen, in two bands that every one of them shares:

       .ftueScene   she stands here, lit, bottom-anchored — with her SPEECH BUBBLE beside her
                    head and a tail pointing back at her. It flexes, so she is as big as the
                    screen has room for.
       .ftuePanel   what the player reads and touches. Never her voice.

     THE SPLIT IS THE POINT. Her line used to sit in the same column as the answer buttons, at
     the same width, in the same box — and it read as a fourth option you could tap. Speech
     belongs to her, up in the scene, light-on-dark with a tail; the things you press are down
     here, dark chips and a filled CTA. Nothing in the panel is ever styled like the bubble.

     Screens 2, 4, 5, 7 and 8 are all this with different content. */
  hostScreen({pose,title="",say="",ask="",cta="",options=null,lead=""}){
    const opts=options
      ? `<div class="ftueOpts">${options.map((o,i)=>
          `<button class="ftueOpt ${o.cls||""}" data-i="${i}"><span>${o.text}</span></button>`).join("")}</div>`
      : "";
    return `<div class="ftueScene">
        ${title?`<div class="ftueTitle">${title}</div>`:""}
        ${lead}
        <div class="ftueSpot"></div>
        <div class="ftueHost">${this.hostImg(pose)}</div>
        ${say?`<div class="ftueSay">${say}</div>`:""}
      </div>
      <div class="ftuePanel">
        ${ask?`<div class="ftueAsk"><b>Your call</b>${ask}</div>`:""}
        ${opts}
        ${cta?`<button class="btn pink wide ftueCta" id="ftueCta">${cta}</button>`:""}
      </div>`;
  },

  /* A missing pose falls back to a silhouette — the art is optional in exactly the way tile and
     prop models are, so the flow is playable before any of it lands.

     The silhouette is on the WRAPPER and the failed <img> is removed outright, rather than the
     img being restyled in place: an img whose src has been cleared still draws the browser's
     broken-image glyph, which showed up as a little torn-picture icon inside the round avatar. */
  hostImg(pose){
    const f=this.POSE[pose]||this.POSE.welcome;
    return `<span class="ftueZara"><img src="${this.ART}${f}" alt="Zara"
              onerror="this.closest('.ftueZara').classList.add('missing');this.remove()"></span>`;
  },

  bubble(html,{avatar=false}={}){
    return `<div class="ftueBubble${avatar?" withAv":""}">
      ${avatar?`<span class="ftueAv">${this.hostImg("face")}</span>`:""}
      <span>${html}</span></div>`;
  },

  /* ---------- waiting ----------
     All three race the bail promise, so Skip settles whatever the current step is sitting on. */
  wait(ms){ return this.until(new Promise(res=>setTimeout(res,Math.max(0,ms|0)))); },

  tap(sel){
    return this.until(new Promise(res=>{
      const b=$(sel);
      if(!b) return res();                 // nothing to press — don't hang the run
      b.onclick=()=>res();
    }));
  },

  /* Resolve with WHICH one was tapped. data-i rather than indexOf, so the handler does not depend
     on the NodeList still matching the DOM after a redraw. */
  tapOne(sel){
    return this.until(new Promise(res=>{
      const list=$("#ftueStage").querySelectorAll(sel);
      if(!list.length) return res(0);
      list.forEach(b=>{ b.onclick=()=>res(+b.dataset.i||0); });
    }));
  },

  /* ---------- video ----------
     The real player, not a copy of it: playerMarkup/playVideo own the controls, the progress bar,
     the seek block and the resolve-on-close, and a second implementation here would be a second
     set of those to keep working. Zara rides on top in a bubble, with the episode label and the
     locked guess as chips.

     Resolves however playback ended. A player who closes the video early still moves on — this is
     an intro, and refusing to continue would trap them on a video they have said they are done
     with. */
  async playEpisode(id,say,chip=""){
    this.screen(`<div class="ftueVideo">
        <div class="ftueChip epChip">${Episodes.titleOf(id)}</div>
        ${chip?`<div class="ftueChip guessChip">${chip}</div>`:""}
        ${playerMarkup(id)}
        ${this.bubble(say,{avatar:true})}
      </div>`,{chrome:false});
    /* Her line is setup, not a caption — it gets out of the way once it has been read, because
       the screen behind it is the whole point of the screen. Not awaited and not cleaned up: the
       next screen() replaces the stage outright, so a timer that fires late has nothing to find.
       The CHIPS stay: the episode label and the locked guess are state, not dialogue. */
    setTimeout(()=>{
      const b=$("#ftueStage").querySelector(".ftueBubble");
      if(b) b.classList.add("gone");
    },Math.max(0,cfg.ftueBubbleMs|0));
    await this.until(playVideo(id));
  },
};
