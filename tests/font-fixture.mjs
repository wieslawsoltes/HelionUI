/** Original synthetic SFNT construction for parser/native tests. No third-party font
 * bytes or outlines are embedded. The shapes are triangles and rectangles, not a UI font. */
import { parseOpenType } from '../src/text/opentype.js';
const u16 = (...values) => values.flatMap(n => [(n >>> 8) & 255, n & 255]);
const u32 = (...values) => values.flatMap(n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const tag = name => Array.from(name, c => c.charCodeAt(0));
const pad = values => [...values, ...Array((4 - values.length % 4) % 4).fill(0)];
function simple(points, repeatFlags = false) {
  const x = points.map(p=>p[0]), y = points.map(p=>p[1]);
  const flags = repeatFlags ? [9, points.length - 1] : points.map(p => p[2] === false ? 0 : 1);
  return [...u16(1, Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y), points.length-1, 0), ...flags,
    ...u16(...x.map((v,i)=>v-(x[i-1]||0))), ...u16(...y.map((v,i)=>v-(y[i-1]||0)))];
}
function composite(components) {
  return [...u16(-1,-100,-100,900,1100), ...components.flatMap((c,i)=>[...u16(c.flags | (i < components.length-1 ? 32 : 0),c.gid), ...u16(...c.args), ...u16(...(c.matrix||[]))])];
}
const cov = gids => u16(1,gids.length,...gids);
function layoutTable(features, lookups) {
  // Every feature in a default Latin LangSys; all other script plans fall back empty.
  const lang = u16(0,65535,features.length,...features.map((_,i)=>i));
  const scripts=[...u16(1),...tag('latn'),...u16(8,4,0),...lang];
  let off=2+features.length*6; const records=[], bodies=[];
  for(const [name,index] of features) { const body=u16(0,1,index); records.push(...tag(name),...u16(off)); bodies.push(...body); off+=body.length; }
  const featureList=[...u16(features.length),...records,...bodies];
  off=2+lookups.length*2; const lookupOffsets=[], lookupBodies=[];
  for(const [type,sub,flags=0] of lookups) { const body=[...u16(type,flags,1,8),...sub]; lookupOffsets.push(off); lookupBodies.push(...body); off+=body.length; }
  const lookupList=[...u16(lookups.length,...lookupOffsets),...lookupBodies];
  return [...u16(1,0,10,10+scripts.length,10+scripts.length+featureList.length),...scripts,...featureList,...lookupList];
}
function pairSubtable(classPairs) {
  if(!classPairs) return [...u16(1,18,4,0,1,12,1,3,-80),...cov([2])];
  return [...u16(2,24,4,0,30,38,2,2,0,0,0,-80),...cov([2]),...u16(1,2,1,1),...u16(1,3,1,1)];
}
function markSubtable(kind=4) {
  // mark gid9 attaches at (0,0); base A gid2 at (300,700), or mark gid7 at (100,150).
  const base=kind===6?7:2, x=kind===6?100:300, y=kind===6?150:700;
  return [...u16(1,12,18,1,24,36),...cov([9]),...cov([base]),...u16(1,0,6,1,0,0),...u16(1,4,1,x,y)];
}
export function makeTestFont({ classPairs=false, legacyKern=false, extension=false, cycle=false, shortLoca=false, repeatedFlags=false, extraTables={} }={}) {
  const shapes=[
    simple([[0,0],[0,650],[500,650],[500,0]],repeatedFlags), [],
    simple([[0,0],[300,700],[600,0]],repeatedFlags),
    simple([[0,700],[300,0],[600,700]],repeatedFlags),
    simple([[0,0],[0,700],[300,700],[300,0]],repeatedFlags),
    simple([[0,0],[0,500],[180,500],[180,0]],repeatedFlags),
    simple([[0,0],[0,700],[440,700],[440,0]],repeatedFlags),
    simple([[0,0],[80,80],[160,0],[80,-80]],repeatedFlags),
    composite([{flags:1|2|512,gid:cycle?8:2,args:[0,0]},{flags:1|2,gid:7,args:[220,820]}]),
    simple([[0,0],[160,240,false],[240,300]]),
    composite([{flags:1|2|512,gid:2,args:[0,0]},{flags:1|2,gid:9,args:[300,720]}]),
    simple([[0,0],[350,650],[700,0]],repeatedFlags),
    composite([{flags:1|2|128,gid:2,args:[50,20],matrix:[8192,4096,-4096,12288]}]),
    composite([{flags:1|2,gid:2,args:[0,0]},{flags:1,gid:7,args:[1,0]}])
  ];
  const glyphs=shapes.map(pad), offsets=[0]; for(const g of glyphs) offsets.push(offsets.at(-1)+g.length);
  const advances=[600,250,600,600,350,200,480,0,610,0,610,700,350,600];
  const cmap=new Map([[32,1],[65,2],[86,3],[102,4],[105,5],[0x30a,7],[0xc5,8],[0x301,9],[0xe9,10],[0x1f642,11],[0x100,12],[0x101,13]]);
  for(let cp=33;cp<=126;cp++) if(!cmap.has(cp)) cmap.set(cp,2);
  const maps=[...cmap].sort((a,b)=>a[0]-b[0]);
  const cmap12=[...u16(12,0),...u32(16+maps.length*12,0,maps.length),...maps.flatMap(([cp,gid])=>u32(cp,cp,gid))];
  const head=new Uint8Array(54), hv=new DataView(head.buffer); hv.setUint32(0,0x10000);hv.setUint32(12,0x5f0f3cf5);hv.setUint16(18,1000);hv.setInt16(50,shortLoca?0:1);
  const hhea=new Uint8Array(36), hh=new DataView(hhea.buffer);hh.setUint32(0,0x10000);hh.setInt16(4,800);hh.setInt16(6,-200);hh.setInt16(8,100);hh.setUint16(34,shapes.length);
  const post=new Uint8Array(32), pv=new DataView(post.buffer);pv.setUint32(0,0x30000);pv.setInt16(8,-90);pv.setInt16(10,45);
  const name='Fixture UI', nameBytes=Array.from(name,c=>u16(c.charCodeAt(0))).flat();
  const os2=new Uint8Array(96), ov=new DataView(os2.buffer);ov.setUint16(0,4);ov.setUint16(4,400);ov.setInt16(26,40);ov.setInt16(28,300);
  const pair=pairSubtable(classPairs), ext=extension?[...u16(1,2),...u32(8),...pair]:pair;
  const gpos=layoutTable(legacyKern?[['mark',0],['mkmk',1]]:[['kern',0],['mark',1],['mkmk',2]],
    [...(legacyKern?[]:[[extension?9:2,ext]]),[4,markSubtable(4)],[6,markSubtable(6)]]);
  const liga=[...u16(1,8,1,14),...cov([4]),...u16(1,4,6,2,5)];
  const tables={head:[...head],hhea:[...hhea],hmtx:advances.flatMap(v=>u16(v,0)),maxp:[...u32(0x10000),...u16(shapes.length),...Array(26).fill(0)],
    loca:shortLoca?u16(...offsets.map(x=>x/2)):u32(...offsets),glyf:glyphs.flat(),cmap:[...u16(0,1,3,10),...u32(12),...cmap12],
    name:[...u16(0,1,18,3,1,0x409,1,nameBytes.length,0),...nameBytes],post:[...post],'OS/2':[...os2],GPOS:gpos,GSUB:layoutTable([['liga',0]],[[4,liga]]),
    ...(legacyKern?{kern:u16(0,1,0,20,1,1,6,0,0,2,3,-80)}:{}),...extraTables};
  const entries=Object.entries(tables).sort((a,b)=>a[0].localeCompare(b[0])); let off=12+entries.length*16;
  const directory=[], data=[];
  for(const [name,bytes] of entries) {directory.push(...tag(name),...u32(0,off,bytes.length));const padded=pad(bytes);data.push(...padded);off+=padded.length;}
  const pow=2**Math.floor(Math.log2(entries.length));
  return new Uint8Array([...u32(0x10000),...u16(entries.length,pow*16,Math.log2(pow),entries.length*16-pow*16),...directory,...data]);
}
export function fixtureFont(options={}, metadata={}) {return parseOpenType(makeTestFont(options),metadata);}
export function tableOffset(bytes, name) {
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  for(let i=0;i<v.getUint16(4);i++) {const at=12+i*16;if(String.fromCharCode(...bytes.slice(at,at+4))===name)return {record:at,offset:v.getUint32(at+8),length:v.getUint32(at+12)};}
  throw new Error(`Missing test table ${name}`);
}
export async function makeWOFF(bytes, compress=true) {
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), n=v.getUint16(4), records=[], data=[];let off=44+n*20;
  for(let i=0;i<n;i++) {const at=12+i*16,length=v.getUint32(at+12),table=bytes.slice(v.getUint32(at+8),v.getUint32(at+8)+length);
    let encoded=table;if(compress&&length) {const stream=new Blob([table]).stream().pipeThrough(new CompressionStream('deflate'));const compressed=new Uint8Array(await new Response(stream).arrayBuffer());if(compressed.length<table.length) encoded=compressed;}
    records.push(...bytes.slice(at,at+4),...u32(off,encoded.length,length,0));const padded=pad([...encoded]);data.push(...padded);off+=padded.length;
  }
  return new Uint8Array([...tag('wOFF'),...u32(0x10000,off),...u16(n,0),...u32(bytes.length),...Array(24).fill(0),...records,...data]);
}
export function makeTTC(fontBytes) {
 const bytes=new Uint8Array(fontBytes.length+16);bytes.set([...tag('ttcf'),...u32(0x10000,1,16)]);bytes.set(fontBytes,16);
 const v=new DataView(bytes.buffer);for(let i=0;i<v.getUint16(20);i++){const at=16+12+i*16+8;v.setUint32(at,v.getUint32(at)+16);}return bytes;
}
