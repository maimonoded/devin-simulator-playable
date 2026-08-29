"use strict";
/* One card, drawn. The collection and the box popup both render cards, and a card that looks
   like two different things in the two places it appears is not a collection — so the markup
   lives here and both call it.

   The class family is prefixed `cc` because `.card` is already the side panel's box
   (css/panels.css) — a collectible card and a panel are not the same thing and must not share
   a selector. Styling is css/collection.css.

   ---- TWO INDEPENDENT AXES ----

   This is the rule the whole design of a card face hangs on, and it is why nothing here reads
   one field to decide two things:

     FAMILY  decides the FRAME.   collection · status · clue
     RARITY  decides the BADGE.   one to four STARS, coloured

   A status item and an Epic collection card come out of the same box seconds apart and are
   completely different things — one goes on the player's shelf and stays there, the other is a
   card in a set. The frame is what carries that, because a label can be missed and a frame
   cannot. The badge is orthogonal: it says how hard this was to get, in STARS and in colour,
   and it is drawn on every card that has a rarity whatever family it belongs to.

   ---- WHY THE THREE FAMILIES LOOK THE WAY THEY DO ----

   They are not three decorations on one idea. They are three different things the player wants
   differently, and the faces are ranked to match:

     clue        A PHOTOGRAPH with the line typed under it. This is the one the player is
                 actually playing for — four of them buy the next episode — so it is the one
                 that looks like something worth having. It used to be the plainest object in
                 the box, which had the hierarchy backwards.
     collection  Gilt over warm plum. A thing you collect and complete; the art is the point.
     status      A PLAQUE, and the number is the hero. Nobody reads what their status items
                 are; they read what they were worth. So the points are set large and the
                 picture is reduced to a stamp beside them — which also means a status item can
                 never be mistaken for a photograph or for a card in a set.

   ---- THREE STATES, one element ----
     owned     full art, the family frame, name and rarity
     locked    the same card, silhouetted — you can see WHAT is missing, which is the whole
               point of a collection with empty slots in it
     unknown   an id this build cannot explain (the catalogue changed under a save). Drawn as a
               broken slot rather than throwing; Cards.validate() is what reports it.

   ---- CONVERTED ----
   Three copies convert a card into its Collectible (GDD §4.3). That is the moment the card
   stops being progress and becomes a thing you own, so it is marked: a star, and the frame
   lights. Copies short of it show their count instead, which doubles as the progress bar. */

/* An art path as a background-image rule, for a style="..." attribute.

   SINGLE quotes inside url(), and both quote characters escaped out of the path. This is
   interpolated into a double-quoted attribute, so a double quote here closes the attribute
   early and the rule silently becomes url("") — a card with no picture, no console error and
   nothing in the network log to notice. */
function cardArtCss(src){
  return `background-image:url('${String(src).replace(/['"]/g,"%22")}')`;
}

/* The procedural face, for the ~90 Commons that will never have painted art. Two hues off a
   hash of the id, so a card looks the same every time it is drawn and different from its
   neighbours — which is all a placeholder has to do. Ninety pieces of generated art would cost
   more to make than they would ever be looked at; the top of the ladder is where painted art
   earns its place (GDD §4.2). */
function cardHueOf(id){
  let h=0; const s=String(id||"");
  for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
  return h%360;
}
function cardProcCss(card){
  const h=cardHueOf(card&&card.id), h2=(h+38)%360;
  return `background-image:linear-gradient(155deg,hsl(${h} 46% 34%),hsl(${h2} 40% 18%))`;
}

/* opts: {owned, count, converted, size:"sm"|"md"|"lg", dup, flip} */
function cardFace(card, opts){
  const o=opts||{};
  const size=o.size||"md";
  if(!card) return `<div class="ccard unknown size-${size}"><div class="ccLock">?</div>
      <div class="ccFoot"><div class="ccName">Unknown card</div></div></div>`;
  const owned=!!o.owned;
  const fam=card.family||"collection";
  const r=card.rarity?Cards.rarity(card.rarity):null;
  const converted=o.converted!=null?!!o.converted
                 :(card.id?Cards.converted(card.id):false);
  const art=Cards.artFor(card);
  const cls=["ccard","size-"+size,"fam-"+fam,
             r?("rar-"+r.key):"", owned?"got":"locked", converted?"conv":"",
             o.flip?"flip":""].filter(Boolean).join(" ");
  /* Drawn for locked slots too: three stars is what tells you whether the gap in the row is a
     week's play or a lucky Tuesday. `title` keeps the word for anyone hovering, and for a
     screen reader — the stars are the display, not the whole truth. */
  const badge=r?`<div class="ccRar" style="--rar:${r.color}" title="${r.name}">${Cards.stars(r)}</div>`:"";
  const dup=o.dup?`<div class="ccDup">DUPLICATE · +${fmt(o.dup)}🪙</div>`:"";
  const need=Cards.copiesToConvert();
  /* A small slot runs the badge and the copy count along one line, and "2/3" does not fit
     beside four stars in ninety pixels. The small form drops the denominator — the card already
     lights up when it converts, so how many are still wanted is the album's job, not the slot's. */
  const held=o.count||1;
  const count=(owned&&!converted&&need>1)
    ? `<div class="ccCount">${size==="sm"?held:held+"/"+need}</div>`
    : (converted?`<div class="ccCount conv">★</div>`:"");
  return `<div class="${cls}">
      <div class="ccArt" style="${art?cardArtCss(art):cardProcCss(card)}"></div>
      <div class="ccSheen"></div>
      <div class="ccFrame"></div>
      ${badge}${dup}${count}
      ${owned?"":`<div class="ccLock">🔒</div>`}
      <div class="ccFoot">
        <div class="ccName">${card.name}</div>
        <div class="ccSub">${card.sub||(Cards.setForCard(card.id)||{}).name||""}</div>
      </div>
    </div>`;
}

/* A card-shaped panel for the things a box pays that are not collection cards — a clue, coins,
   energy, a status item. Same silhouette so a box's contents read as one row of things rather
   than as cards plus a paragraph, and the FAMILY frame is what keeps them apart. */
function dropFace(drop, opts){
  const o=opts||{}, size=o.size||"md";
  if(drop.kind==="card") return cardFace(drop.card,{owned:true,count:drop.count,
                                                   converted:drop.converted,size,
                                                   dup:(drop.isNew||drop.converted)?0:drop.coins,
                                                   flip:o.flip});
  if(drop.kind==="clue"){
    /* A case photograph with the line typed under it. The photo is picked by hashing the clue's
       own id, so it is the same one every time this clue is drawn and a different one from the
       clue above it in the evidence board — see CLUE_ART in assets/cards/cards.js.

       The sentence still has to be READ, which is why it sits on paper over the photograph
       rather than on the gradient a card name gets: this is the only face in the game carrying
       a line of prose, and prose over a photograph is the one thing that reliably becomes
       unreadable. */
    const clueId=drop.clue&&drop.clue.id;
    const shot=Cards.clueArt(String(drop.ep||"")+String(clueId||""));
    return `<div class="ccard size-${size} fam-clue got${o.flip?" flip":""}">
        <div class="ccArt" style="${cardArtCss(shot)}"></div>
        <div class="ccGrain"></div>
        <div class="ccFrame"></div>
        <div class="ccRar" style="--rar:var(--teal)">${drop.isNew?"Evidence":"Known"}</div>
        ${drop.isNew?"":`<div class="ccDup">+${fmt(drop.coins)}🪙</div>`}
        <div class="ccSlip"><span>${drop.isNew?drop.clue.text:"You knew that one."}</span></div>
        <div class="ccFoot"><div class="ccName">A clue</div>
          <div class="ccSub">${Episodes.titleOf(drop.ep)}</div></div>
      </div>`;
  }
  if(drop.kind==="status"){
    /* The points are the hero and the picture is a stamp behind them. A status item is a thing
       the player banks rather than looks at, so what it was WORTH is the headline — and a face
       built around a number can never be confused with a photograph or with a card in a set. */
    return `<div class="ccard size-${size} fam-status got${o.flip?" flip":""}">
        <div class="ccArt" style="${cardArtCss(drop.item.art)}"></div>
        <div class="ccFrame"></div>
        <div class="ccBig"><b>+${fmt(drop.item.points)}</b><i>status</i></div>
        <div class="ccFoot"><div class="ccName">${drop.item.name}</div>
          <div class="ccSub">For your shelf</div></div>
      </div>`;
  }
  const big=drop.kind==="coins"?`🪙 +${fmt(drop.amount)}`:`⚡ +${drop.amount}`;
  const lbl=drop.kind==="coins"?"Coins":"Energy";
  return `<div class="ccard size-${size} fam-${drop.kind} got${o.flip?" flip":""}">
      <div class="ccPlain">${big}</div>
      <div class="ccFoot"><div class="ccName">${lbl}</div><div class="ccSub">&nbsp;</div></div>
    </div>`;
}
