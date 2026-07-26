"use strict";
/* Generic helpers — no game or DOM knowledge beyond querySelector shorthand. */
const $=(s)=>document.querySelector(s);
const fmt=(n)=>Math.round(n).toLocaleString();
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const rand=(a,b)=>a+Math.random()*(b-a);
const chance=(p)=>Math.random()<p;
function weighted(table){ const tot=table.reduce((a,x)=>a+x.weight,0); let r=Math.random()*tot;
  for(const x of table){ r-=x.weight; if(r<=0) return x; } return table[table.length-1]; }
/* Fisher-Yates, returns a new array. */
function shuffle(arr){ const r=arr.slice();
  for(let i=r.length-1;i>0;i--){ const j=Math.floor(rand(0,i+1)); const t=r[i]; r[i]=r[j]; r[j]=t; }
  return r; }
