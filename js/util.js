"use strict";
/* Generic helpers — no game or DOM knowledge beyond querySelector shorthand. */
const $=(s)=>document.querySelector(s);
const fmt=(n)=>Math.round(n).toLocaleString();
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const rand=(a,b)=>a+Math.random()*(b-a);
const chance=(p)=>Math.random()<p;
function weighted(table){ const tot=table.reduce((a,x)=>a+x.weight,0); let r=Math.random()*tot;
  for(const x of table){ r-=x.weight; if(r<=0) return x; } return table[table.length-1]; }
