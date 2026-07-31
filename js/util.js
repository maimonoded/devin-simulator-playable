"use strict";
/* Generic helpers — no game or DOM knowledge beyond querySelector shorthand. */
const $=(s)=>document.querySelector(s);
const fmt=(n)=>Math.round(n).toLocaleString();
/* Compact money for places where five prices have to share one phone-width row:
   2,500 → "2.5k", 1,240,000 → "1.2m". One decimal only while the mantissa is under 10, so a
   price never runs past four characters — "9.9k", "999k", "1.2m" — which is what keeps the
   upgrade row on one line whatever the economy does to the numbers. */
const SHORT_UNITS=["","k","m","b","t","q"];
function fmtShort(n){
  const v=n||0, neg=v<0, a=Math.abs(v);
  if(a<1000) return (neg?"-":"")+Math.round(a);
  let u=0,x=a;
  while(x>=1000&&u<SHORT_UNITS.length-1){ x/=1000; u++; }
  /* 9.95 would print as "10.0" and 999.5 as "1000" — both a character too wide. Rounding
     first and rolling up a unit when it overflows keeps the width promise. */
  let s=x<9.95?x.toFixed(1):String(Math.round(x));
  if(parseFloat(s)>=1000&&u<SHORT_UNITS.length-1){
    x/=1000; u++; s=x<9.95?x.toFixed(1):String(Math.round(x));
  }
  if(s.endsWith(".0")) s=s.slice(0,-2);
  return (neg?"-":"")+s+SHORT_UNITS[u];
}
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const rand=(a,b)=>a+Math.random()*(b-a);
const chance=(p)=>Math.random()<p;
function weighted(table){ const tot=table.reduce((a,x)=>a+x.weight,0); let r=Math.random()*tot;
  for(const x of table){ r-=x.weight; if(r<=0) return x; } return table[table.length-1]; }
/* Fisher-Yates, returns a new array. */
function shuffle(arr){ const r=arr.slice();
  for(let i=r.length-1;i>0;i--){ const j=Math.floor(rand(0,i+1)); const t=r[i]; r[i]=r[j]; r[j]=t; }
  return r; }
