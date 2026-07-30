"use strict";
/* Dependency-free .xlsx reader.

   An .xlsx is a ZIP of XML parts, and this file opens both by hand: the ZIP central directory
   is walked with a DataView, deflated members go through the platform's own DecompressionStream
   and the XML through the browser's DOMParser. No library, so the project keeps its no-npm /
   no-build rule. Nothing here touches a browser global until read() is called, so the file also
   loads cleanly into the tests' vm context.

   Only cached *values* are read. A formula cell hands back the number Excel last computed and
   its <f> is thrown away — lifting the numbers a designer produced is the whole job, and
   re-implementing Excel is explicitly not.

   Known limits: ZIP64 workbooks are refused rather than misread, and dates arrive as raw Excel
   serial numbers because the number format lives in styles.xml, which is not parsed. */
const Xlsx={

  /* → Promise<Workbook>. Every sheet is inflated and indexed up front, which is what lets the
     accessors below stay synchronous; model workbooks are a few hundred KB, so that is cheap.
     Rejects with an Error whose message is meant to be shown to a designer as-is. */
  async read(data){
    try{
      const bytes=this._bytes(data);
      return await this._open(bytes,this._zipDir(bytes));
    }catch(e){
      if(e&&e.xlsx) throw e;                       // already phrased for a human
      throw new Error("This workbook could not be read — the file looks damaged or incomplete. ("+((e&&e.message)||e)+")");
    }
  },

  /* Errors we authored are tagged so read() can tell them apart from a stray TypeError and
     leave their wording alone. */
  _fail(msg){ const e=new Error(msg); e.xlsx=true; return e; },

  _bytes(data){
    if(data instanceof Uint8Array) return data;
    if(ArrayBuffer.isView(data)) return new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
    if(data&&typeof data.byteLength==="number") return new Uint8Array(data);
    throw this._fail("Nothing to read — pass the file's bytes, e.g. the ArrayBuffer from file.arrayBuffer().");
  },

  _text(bytes){ return new TextDecoder("utf-8").decode(bytes); },

  /* ---- ZIP ------------------------------------------------------------------------------ */

  /* The end-of-central-directory record may be followed by an archive comment, so its
     signature has to be searched for backwards instead of assumed 22 bytes from the end. */
  _zipDir(b){
    const dv=new DataView(b.buffer,b.byteOffset,b.byteLength);
    const u16=o=>dv.getUint16(o,true), u32=o=>dv.getUint32(o,true);
    let eocd=-1;
    const floor=Math.max(0,b.length-22-0xFFFF);   // 0xFFFF is the largest comment ZIP allows
    for(let p=b.length-22;p>=floor;p--) if(u32(p)===0x06054b50){ eocd=p; break; }
    if(eocd<0) throw this._fail("This file is not a .xlsx workbook (no ZIP signature found).");
    const count=u16(eocd+10), cdSize=u32(eocd+12), cdAt=u32(eocd+16);
    if(count===0xFFFF||cdSize===0xFFFFFFFF||cdAt===0xFFFFFFFF) throw this._zip64();
    const entries=Object.create(null);            // a part named "constructor" must not find Object.prototype
    let p=cdAt;
    for(let i=0;i<count;i++){
      if(p+46>b.length||u32(p)!==0x02014b50)
        throw this._fail("This .xlsx file is damaged — its ZIP directory ends sooner than the file says it should.");
      const nameLen=u16(p+28), extraLen=u16(p+30), cmtLen=u16(p+32);
      const e={method:u16(p+10),csize:u32(p+20),lho:u32(p+42)};
      if(e.csize===0xFFFFFFFF||e.lho===0xFFFFFFFF) throw this._zip64();
      e.name=this._text(b.subarray(p+46,p+46+nameLen));
      entries[e.name]=e;
      p+=46+nameLen+extraLen+cmtLen;
    }
    return entries;
  },

  _zip64(){ return this._fail("This workbook uses the ZIP64 format, which this reader cannot open. Re-saving it from Excel as .xlsx normally fixes it."); },

  /* The compressed bytes sit after the *local* header, and only that header's own name/extra
     lengths can be trusted to skip them: Excel writes a different extra field into the local
     header than into the central directory, so the directory's copies are the wrong lengths. */
  _member(b,entries,name){
    const e=entries[name];
    if(!e) return null;
    const dv=new DataView(b.buffer,b.byteOffset,b.byteLength);
    if(e.lho+30>b.length||dv.getUint32(e.lho,true)!==0x04034b50)
      throw this._fail(`This .xlsx file is damaged — the part "${name}" is not where its ZIP directory says it is.`);
    const at=e.lho+30+dv.getUint16(e.lho+26,true)+dv.getUint16(e.lho+28,true);
    return {entry:e,data:b.subarray(at,at+e.csize)};
  },

  /* Method 0 is stored, method 8 is raw deflate. DecompressionStream is the newest platform
     feature this reader needs, so it is the only one worth feature-testing. */
  async _inflate(m,name){
    if(m.entry.method===0) return m.data;
    if(m.entry.method!==8)
      throw this._fail(`This workbook was zipped in a way this reader does not understand (compression method ${m.entry.method} in "${name}"). Re-save it from Excel.`);
    if(typeof DecompressionStream==="undefined")
      throw this._fail("This browser is too old to unzip the workbook (it has no DecompressionStream). Chrome or Edge 80+, Safari 16.4+ or Firefox 113+ can.");
    const src=new ReadableStream({start(c){ c.enqueue(m.data); c.close(); }});
    const out=await new Response(src.pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
    return new Uint8Array(out);
  },

  /* ---- XML ------------------------------------------------------------------------------ */

  async _xml(b,entries,path,what){
    const m=this._member(b,entries,path);
    if(!m) return null;
    const text=this._text(await this._inflate(m,path));
    if(typeof DOMParser==="undefined")
      throw this._fail("This browser cannot read the workbook's XML (it has no DOMParser).");
    const doc=new DOMParser().parseFromString(text,"application/xml");
    if(doc.getElementsByTagName("parsererror").length)
      throw this._fail(`This workbook is damaged — ${what} is not valid XML.`);
    return doc;
  },

  /* Prefixes vary between writers, so every tag/attribute test goes through the local name. */
  _local(node){ const n=node.localName||node.nodeName||node.tagName||""; const i=n.indexOf(":"); return i<0?n:n.slice(i+1); },

  _attrByLocal(el,want){
    const at=el.attributes||[];
    for(let i=0;i<at.length;i++) if(this._local(at[i])===want) return at[i].value;
    return null;
  },

  _kids(el,tag){
    const out=[], kids=el.children||[];
    for(let i=0;i<kids.length;i++) if(this._local(kids[i])===tag) out.push(kids[i]);
    return out;
  },

  /* ---- paths ---------------------------------------------------------------------------- */

  _dirOf(path){ const i=path.lastIndexOf("/"); return i<0?"":path.slice(0,i+1); },

  /* A relationship target is either absolute inside the package ("/xl/worksheets/sheet1.xml")
     or relative to the part that owns the .rels file. Both have to end up as a ZIP entry name. */
  _resolve(owner,target){
    const t=String(target||"").replace(/\\/g,"/");
    if(t.charAt(0)==="/") return t.slice(1);
    const out=[];
    (this._dirOf(owner)+t).split("/").forEach(seg=>{
      if(seg===""||seg===".") return;
      if(seg===".."){ out.pop(); return; }
      out.push(seg);
    });
    return out.join("/");
  },

  _relsPathFor(part){ const d=this._dirOf(part); return `${d}_rels/${part.slice(d.length)}.rels`; },

  _rels(doc){
    const map=Object.create(null);
    if(!doc) return map;
    const list=doc.getElementsByTagName("Relationship");
    for(let i=0;i<list.length;i++){
      const r=list[i], id=r.getAttribute("Id");
      if(id) map[id]={target:r.getAttribute("Target")||"",type:r.getAttribute("Type")||""};
    }
    return map;
  },

  /* Relationship types are long schema URLs; only the last segment identifies the part. */
  _relByType(map,suffix){
    for(const id in map) if(map[id].type.endsWith(suffix)) return map[id];
    return null;
  },

  /* ---- workbook ------------------------------------------------------------------------- */

  async _open(b,entries){
    const rootRels=this._rels(await this._xml(b,entries,"_rels/.rels","the package index"));
    const main=this._relByType(rootRels,"/officeDocument");
    const wbPath=main?this._resolve("",main.target):"xl/workbook.xml";
    if(!entries[wbPath])
      throw this._fail("This file is a ZIP but not an Excel workbook (xl/workbook.xml is missing). If it is an .xls or a .csv, re-save it as .xlsx.");
    const wb=await this._xml(b,entries,wbPath,"the workbook");
    const rels=this._rels(await this._xml(b,entries,this._relsPathFor(wbPath),"the workbook's relationships"));

    const ssRel=this._relByType(rels,"/sharedStrings");
    const ssPath=ssRel?this._resolve(wbPath,ssRel.target):"xl/sharedStrings.xml";
    const shared=entries[ssPath]?this._sharedStrings(await this._xml(b,entries,ssPath,"the workbook's shared text")):[];

    const names=[], sheets=[];
    const list=wb.getElementsByTagName("sheet");
    for(let i=0;i<list.length;i++){
      const el=list[i];
      const rid=el.getAttribute("r:id")||this._attrByLocal(el,"id");   // r:id is namespaced
      const rel=rid?rels[rid]:null;
      const path=rel?this._resolve(wbPath,rel.target):null;
      const doc=path&&entries[path]?await this._xml(b,entries,path,`the sheet "${el.getAttribute("name")}"`):null;
      names.push(el.getAttribute("name")||`Sheet${i+1}`);
      /* A sheet whose part is missing still keeps its slot: sheetNames must stay the tab order
         the designer sees, so a broken part becomes an empty sheet rather than a gap. */
      sheets.push(doc?this._sheet(doc,shared):{cells:Object.create(null),rows:0});
    }
    return this._api(names,sheets);
  },

  /* A shared string is either one <t> or a run of <r><t> fragments to be joined in order.
     <rPh> (Japanese phonetic hints) carries a <t> of its own, so walking direct children is
     what keeps its text from being spliced into the middle of the real string. */
  _sharedStrings(doc){
    const out=[], list=doc.getElementsByTagName("si");
    for(let i=0;i<list.length;i++) out.push(this._richText(list[i]));
    return out;
  },

  _richText(el){
    let s="";
    const kids=el.children||[];
    for(let i=0;i<kids.length;i++){
      const k=kids[i], tag=this._local(k);
      if(tag==="t") s+=k.textContent;
      else if(tag==="r") this._kids(k,"t").forEach(t=>{ s+=t.textContent; });
    }
    return s;
  },

  /* One worksheet → {cells:{"A1":value}, rows:maxRow}. A cell with a formula still has the
     value Excel cached in <v>; we take it and ignore <f>. */
  _sheet(doc,shared){
    const cells=Object.create(null);
    let rows=0;
    const list=doc.getElementsByTagName("c");
    for(let i=0;i<list.length;i++){
      const c=list[i], at=this._ref(c.getAttribute("r"));
      if(!at) continue;
      const t=c.getAttribute("t")||"n";
      const v=this._kids(c,"v")[0]||null, is=this._kids(c,"is")[0]||null;
      let val=null;
      if(t==="inlineStr") val=is?this._richText(is):(v?v.textContent:null);
      else if(!v) val=null;                                        // styled-only cell, no value
      else if(t==="s"){ const k=parseInt(v.textContent,10); val=shared[k]===undefined?"":shared[k]; }
      else if(t==="str"||t==="e"||t==="d") val=v.textContent;      // formula text, "#DIV/0!", ISO date
      else if(t==="b") val=v.textContent.trim()==="1"?1:0;         // flags read as numbers, so number() works on them
      else { const n=parseFloat(v.textContent); val=isFinite(n)?n:null; }
      if(val===null||val==="") continue;
      cells[at.key]=val;
      if(at.row>rows) rows=at.row;
    }
    return {cells,rows};
  },

  /* "ab12" → {key:"AB12", col:28, row:12}. Column letters are bijective base-26 (A=1 … Z=26,
     AA=27); the sheet limits double as the validity check for a hand-typed ref. */
  _ref(ref){
    const m=/^([A-Za-z]+)([0-9]+)$/.exec(String(ref==null?"":ref).trim());
    if(!m) return null;
    const letters=m[1].toUpperCase();
    let col=0;
    for(let i=0;i<letters.length;i++) col=col*26+(letters.charCodeAt(i)-64);
    const row=parseInt(m[2],10);
    if(col<1||col>16384||row<1||row>1048576) return null;
    return {key:letters+row,col,row};
  },

  /* ---- the Workbook handed back ---------------------------------------------------------- */

  _api(names,sheets){
    /* Exact name first, then a trimmed/case-folded match — a designer typing "inputs" should
       not get a silent null. Folded keys carry a NUL prefix, which a sheet name cannot
       contain, so they can never shadow a real name. */
    const FOLD="\u0000";
    const idx=Object.create(null);
    names.forEach((n,i)=>{
      if(idx[n]===undefined) idx[n]=i;
      const k=FOLD+n.trim().toLowerCase();
      if(idx[k]===undefined) idx[k]=i;
    });
    const find=name=>{
      const n=String(name==null?"":name);
      let i=idx[n];
      if(i===undefined) i=idx[FOLD+n.trim().toLowerCase()];
      return i===undefined?null:sheets[i];
    };
    const ref=this._ref.bind(this);
    /* Methods close over `api` rather than using `this`, so a destructured wb.label keeps working. */
    const api={
      sheetNames:names.slice(),
      has(sheet){ return !!find(sheet); },
      rows(sheet){ const s=find(sheet); return s?s.rows:0; },
      cell(sheet,at){ const s=find(sheet); if(!s) return null; const r=ref(at); if(!r) return null;
        const v=s.cells[r.key]; return v===undefined?null:v; },
      label(sheet,at){ const v=api.cell(sheet,at); return v===null?"":String(v).trim(); },
      number(sheet,at){
        const v=api.cell(sheet,at);
        if(typeof v==="number") return isFinite(v)?v:null;
        if(typeof v!=="string"||v.trim()==="") return null;
        const n=Number(v.trim());                                  // a number Excel stored as text still counts
        return isFinite(n)?n:null;
      },
    };
    return api;
  },
};
