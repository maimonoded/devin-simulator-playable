"use strict";
/* One card, drawn. The album and the box popup both render cards, and a card that looks like
   two different things in the two places it appears is not a collection — so the markup lives
   here and both call it.

   The class family is prefixed `cc` because `.card` is already the side panel's box
   (css/panels.css) — a collectible card and a panel are not the same thing and must not share
   a selector. Styling is css/collection.css.

   THREE STATES, one element:
     owned     full art, tier frame, name and role
     locked    the same card, silhouetted — you can see WHAT is missing, which is the whole
               point of an album with empty slots in it
     unknown   an id this board cannot explain (content changed under a save). Drawn as a
               broken slot rather than throwing, and Collection.validate() is what reports it.

   CLUE CARDS LOOK DIFFERENT ON PURPOSE. They are the one kind whose art carries information
   out of the story rather than a face, and they are the kind that feeds the wager — so they
   wear a paper evidence-tag treatment (.kind-clue in css/collection.css) instead of a tier
   frame, and they carry no tier at all. */

/* An art path as a background-image rule, for a style="..." attribute.

   SINGLE quotes inside url(), and both quote characters escaped out of the path. This is
   interpolated into a double-quoted attribute, so a double quote here closes the attribute
   early and the rule silently becomes url("") — a card with no picture, no console error and
   nothing in the network log to notice. */
function cardArtCss(src){
  return `background-image:url('${String(src).replace(/['"]/g,"%22")}')`;
}

/* opts: {owned, count, size:"sm"|"md"|"lg", dup, flip} */
function cardFace(card, opts){
  const o=opts||{};
  const size=o.size||"md";
  if(!card) return `<div class="ccard unknown size-${size}"><div class="ccLock">?</div>
      <div class="ccFoot"><div class="ccName">Unknown card</div></div></div>`;
  const owned=!!o.owned;
  const tier=card.tier?Collection.tier(card.tier):null;
  const cls=["ccard","size-"+size,"kind-"+card.kind,
             card.tier?("tier-"+card.tier):"", owned?"got":"locked",
             o.flip?"flip":""].filter(Boolean).join(" ");
  /* The tier ribbon is the only thing that separates three cards off one portrait, so it is
     drawn for locked slots too — "Simon, Gold" is a different thing to collect from "Simon,
     Silver" and the album has to say which one is missing. */
  const ribbon=tier?`<div class="ccTier">${tier.icon} ${tier.name}</div>`:
                    `<div class="ccTier clue">🔍 Clue</div>`;
  const dup=o.dup?`<div class="ccDup">DUPLICATE · +${fmt(o.dup)}🪙</div>`:"";
  const count=(owned&&o.count>1)?`<div class="ccCount">×${o.count}</div>`:"";
  return `<div class="${cls}">
      <div class="ccArt" style="${cardArtCss(card.art)}"></div>
      <div class="ccSheen"></div>
      ${ribbon}${dup}${count}
      ${owned?"":`<div class="ccLock">🔒</div>`}
      <div class="ccFoot">
        <div class="ccName">${card.name}</div>
        <div class="ccSub">${card.sub||""}</div>
      </div>
    </div>`;
}

/* A card-shaped panel for the things a box pays that are not cards — coins, energy, a status
   item. Same silhouette as a card so a box's contents read as one row of things rather than
   as cards plus a paragraph. */
function dropFace(drop, opts){
  const o=opts||{}, size=o.size||"md";
  if(drop.kind==="card") return cardFace(drop.card,{owned:true,count:drop.count,size,
                                                   dup:drop.isNew?0:drop.coins,flip:o.flip});
  if(drop.kind==="status"){
    return `<div class="ccard size-${size} kind-status got${o.flip?" flip":""}">
        <div class="ccArt" style="${cardArtCss(drop.item.art)}"></div>
        <div class="ccSheen"></div>
        <div class="ccFrame"></div>
        <div class="ccTier status">⭐ +${drop.item.points}</div>
        <div class="ccFoot"><div class="ccName">${drop.item.name}</div>
          <div class="ccSub">For your shelf</div></div>
      </div>`;
  }
  const big=drop.kind==="coins"?`🪙 +${fmt(drop.amount)}`:`⚡ +${drop.amount}`;
  const lbl=drop.kind==="coins"?"Coins":"Energy";
  return `<div class="ccard size-${size} kind-${drop.kind} got${o.flip?" flip":""}">
      <div class="ccPlain">${big}</div>
      <div class="ccFoot"><div class="ccName">${lbl}</div><div class="ccSub">&nbsp;</div></div>
    </div>`;
}
