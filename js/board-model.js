"use strict";
/* Board layout (fixed 40 tiles) — pure data + geometry, no DOM. */
const CORNERS={0:"start",10:"spa",20:"vip",30:"premiere"};
const TRAINS=new Set([5,15,25,35]);
const DECKS=new Set([3,8,13,18,23,28]);
function tileType(i){ if(CORNERS[i])return CORNERS[i]; if(TRAINS.has(i))return"train"; if(DECKS.has(i))return"deck"; return"standard"; }
/* standard tile coin weights rise around the board (mean 1) */
const stdWeights={}; (function(){
  const stds=[]; for(let i=0;i<40;i++) if(tileType(i)==="standard") stds.push(i);
  let raw=stds.map(i=>0.6+ (i/39)*1.0); const mean=raw.reduce((a,b)=>a+b,0)/raw.length;
  stds.forEach((i,k)=>stdWeights[i]=raw[k]/mean);
})();
function gridPos(i){
  if(i<=10) return {r:10-i,c:0};
  if(i<=20) return {r:0,c:i-10};
  if(i<=30) return {r:i-20,c:10};
  return {r:10,c:10-(i-30)};
}
/* Clockwise path from a tile to Start (a full lap when already on Start). */
function pathToStart(from){ const path=[]; const dist=(40-from)%40||40; let p=from;
  for(let s=0;s<dist;s++){ p=(p+1)%40; path.push(p); } return path; }
