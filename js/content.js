"use strict";
/* Story content — prediction questions, episode titles, login reward ladder. */
const QUESTIONS=[
 {q:"Will Elena confront Marco at the gala?",opts:[["She confronts him publicly",1.8],["She keeps the secret",2.1],["She sends a note instead",3.4]]},
 {q:"Who sabotaged the yacht party?",opts:[["Vivienne",2.2],["The new intern",1.7],["Marco himself",3.0]]},
 {q:"Does Sofia accept the inheritance?",opts:[["Yes — and moves in",1.6],["No, she walks away",2.6]]},
 {q:"What's inside the locked drawer?",opts:[["A hidden will",2.0],["Old love letters",2.3],["A second phone",2.8]]},
 {q:"Will the merger go through?",opts:[["Signed by midnight",1.9],["Collapses at the last minute",2.0]]},
 {q:"Who is the masked guest?",opts:[["Elena's ex",2.1],["A rival heiress",2.4],["A private investigator",2.9]]},
 {q:"Does Marco discover the affair?",opts:[["Yes, and reacts calmly",2.7],["Yes, and it explodes",1.7],["No — not yet",2.2]]},
 {q:"Where did the missing painting go?",opts:[["Sold in secret",2.0],["Hidden in the penthouse",2.2],["Destroyed in the fire",3.1]]},
];
const EP_TITLES=["The Inheritance","Rumors at Dawn","The Gala","A Knock at Midnight","The Yacht","Broken Vows","The Reveal","Ashes & Silk","The Verdict","Last Dance"];
const LOGIN_REWARDS=[200,300,400,500,750,1000,1500];
