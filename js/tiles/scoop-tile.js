"use strict";
/* The Scoop — where Go-To-Jail used to be, doing the opposite job.

   GDD §3.4: it teleports the token to a random NPC tile AND triggers it. So the board's one
   "you have been moved" tile is a shortcut into the story rather than a punishment, and it is
   the second lever on clue pacing after the NPC tile count itself — a Scoop is an extra draw
   from the clue pool, mid-lap, for free. */

/* Shared with the Mixed pool's `move:"npc"` row, which is the same idea arriving from a plot
   twist. A free function rather than a method because neither caller is a subclass of the
   other, and the rule about NOT walking there belongs with the behaviour, not with one tile. */
function teleportToNpc(label,ctx){
  const npcs=tilesOfType("npc");
  if(!npcs.length) return [{float:{text:"📰 …",color:"var(--muted)"},
                            log:{icon:"📰",msg:`${label} · nobody to find`}}];
  const to=npcs[Math.floor(rand(0,npcs.length))];
  const who=tileArg(to)||"someone";
  state.pos=to;
  /* A one-step path, not a walk. Walking from the Scoop to an NPC behind it would cross Start
     and pay a lap bonus nobody rolled — and a teleport that ambles round the board is not a
     teleport. */
  return [
    {float:{text:"📰 "+label,color:"var(--pink)"},
     log:{icon:"📰",msg:`${label} · straight to <b>${who}</b>`}},
    {move:{path:[to],stepMs:Math.round(cfg.scoopStepMs)}},
    ...TILE_TYPES.npc.onLand(Object.assign({},ctx,{pos:to})),
  ];
}

class ScoopTile extends Tile {
  get icon(){ return "📰"; }
  get corner(){ return true; }
  onLand(ctx){ return teleportToNpc("The Scoop",ctx); }
}
registerTile("scoop",ScoopTile);
