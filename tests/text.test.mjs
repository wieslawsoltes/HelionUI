import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseOpenType,loadFont,decodeWOFF,FontFormatError,contoursToSegments} from '../src/text/opentype.js';
import {loadFonts,selectFace,DEFAULT_FONT_SOURCES} from '../src/text/fonts.js';
import {compile,h,fromHTML} from '../src/core/compiler.js';
import {fbits,fromBits,DEFAULT_LIMITS} from '../src/core/schema.js';
import {arenaLayout} from '../src/gpu/arena-layout.js';
import {makeTestFont,fixtureFont,makeWOFF,makeTTC,tableOffset} from './font-fixture.mjs';
import {textReference} from './text-reference.mjs';
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const packed=(props={},font=fixtureFont())=>compile(h('TextBlock',{text:'AV fi A\u030A',...props}),{fonts:[font]});
const corrupt=(tag,offset,value,method='setUint16')=>{const bytes=makeTestFont(),t=tableOffset(bytes,tag);new DataView(bytes.buffer)[method](t.offset+offset,value);return bytes;};

test('font loader reads static TrueType metrics and named family',()=>{
 const f=fixtureFont();assert.equal(f.family,'Fixture UI');assert.equal(f.weight,400);assert.equal(f.style,'normal');assert.equal(f.units,1);assert.equal(f.sourceUnits,1000);
 near(f.ascent,.8);near(f.descent,.2);near(f.lineGap,.1);near(f.underlinePosition,.09);near(f.underlineThickness,.045);near(f.strikePosition,-.3);near(f.strikeThickness,.04);
 assert.equal(f.glyphs.length,14);assert.equal(f.cmap.size,102);assert.equal(f.warnings.length,0);
});
test('cmap uses Unicode scalar pages, including astral codepoints without byte clamping',()=>{
 const c=packed(),ref=textReference(c);assert.equal(ref.map(0x1f642).id,11);assert.equal(ref.map(0xc5).id,8);assert.notEqual(ref.map(0x1f642).id,ref.map(255).id);
 assert.equal(ref.map(0x12345).id,0);assert.equal(c.textMode,'opentype');assert.equal(c.fonts[0].mappedScalars,102);
});
test('quadratic outline conversion keeps implicit on-curve midpoints and contour closure',()=>{
 const s=contoursToSegments([[{x:0,y:0,on:false},{x:200,y:200,on:false},{x:400,y:0,on:false}]],1000);
 assert.equal(s.length,3);assert.ok(s.every(s=>s[0]===1));assert.deepEqual(s[0].slice(1,3),[.2,-0]);assert.deepEqual(s.at(-1).slice(5,7),s[0].slice(1,3));
});
test('simple outline Y inversion and normalized bounds use the font em',()=>{
 const f=fixtureFont(),g=f.glyphs[2];[0,-.7,.6,0].forEach((v,i)=>near(g.bounds[i],v));assert.equal(g.segments.length,3);near(g.advance,.6);
 assert.equal(f.glyphs[9].segments[0][0],1);assert.ok(f.glyphs[9].segments[0][4]<0);
});
test('compound TrueType glyphs combine translated contours and USE_MY_METRICS',()=>{
 const f=fixtureFont(),g=f.glyphs[8];assert.equal(g.segments.length,7);near(g.advance,.6);near(g.bounds[1],-.9);near(g.bounds[2],.6);
});
test('compound TrueType 2x2 transform uses all four matrix entries',()=>{
 const g=fixtureFont().glyphs[12];const vertices=g.segments.map(s=>s.slice(1,3));
 for(const expected of [[.05,-.02],[.025,-.62],[.35,-.17]])assert.ok(vertices.some(p=>Math.abs(p[0]-expected[0])<1e-6&&Math.abs(p[1]-expected[1])<1e-6),JSON.stringify(vertices));
});
test('compound point-number attachment aligns actual parent and child points',()=>{
 const g=fixtureFont().glyphs[13];assert.ok(g.segments.some(s=>Math.abs(s[1]-.3)<1e-6&&Math.abs(s[2]+.7)<1e-6));near(g.bounds[1],-.78);
});
for(const options of [{shortLoca:true},{repeatedFlags:true}])test(`TrueType alternate encoding ${JSON.stringify(options)} is outline-identical`,()=>assert.deepEqual(fixtureFont(options).glyphs,fixtureFont().glyphs));
test('TrueType collection selects its indexed face with absolute table offsets',()=>{const f=parseOpenType(makeTTC(makeTestFont()));assert.equal(f.family,'Fixture UI');assert.throws(()=>parseOpenType(makeTTC(makeTestFont()),{collectionIndex:1}),FontFormatError);});
for(const compress of [false,true])test(`WOFF1 ${compress?'deflated':'uncompressed'} tables reconstruct the same font`,async()=>{const original=makeTestFont(),woff=await makeWOFF(original,compress),decoded=await decodeWOFF(woff);assert.deepEqual(decoded,original);const f=await loadFont(new Blob([woff]));assert.equal(f.glyphs.length,14);});
test('font loader accepts typed-array views with nonzero offsets',()=>{const font=makeTestFont(),buffer=new Uint8Array(font.length+100);buffer.set(font,37);assert.equal(parseOpenType(buffer.subarray(37,37+font.length)).family,'Fixture UI');});
test('font loader has no hidden font-face downloads when prepared fonts are supplied',async()=>{const f=fixtureFont();const faces=await loadFonts([f]);assert.equal(faces[0],f);assert.equal(DEFAULT_FONT_SOURCES.length,3);assert.ok(DEFAULT_FONT_SOURCES.every(f=>f.source.includes('/v20201206-phase3/')));});

test('GPOS explicit-pair kerning changes AV advance by the font-specified amount',()=>{const r=textReference(packed());near(r.width('AV',100),112);near(r.width('AA',100),120);});
test('GPOS class-pair kerning matches explicit-pair measurements',()=>{const r=textReference(packed({},fixtureFont({classPairs:true})));near(r.width('AV',100),112);near(r.width('VA',100),120);});
test('GPOS extension lookup resolves the embedded pair-positioning subtable',()=>near(textReference(packed({},fixtureFont({extension:true}))).width('AV',100),112));
test('legacy kern table is used when the script has no GPOS kerning plan',()=>near(textReference(packed({},fixtureFont({legacyKern:true}))).width('AV',100),112));
test('kerning can be disabled independently of ligature substitution',()=>{const r=textReference(packed({kerning:false}));near(r.width('AV',100),120);assert.equal(r.shape('fi').length,1);});
test('GSUB standard ligature emits the substituted glyph with its own advance',()=>{const r=textReference(packed());const g=r.shape('fi');assert.equal(g.length,1);assert.equal(g[0].id,6);assert.equal(g[0].count,2);near(r.width('fi',100),48);});
test('ligature disabling retains individual glyphs and leaves kerning enabled',()=>{const r=textReference(packed({ligatures:false}));assert.equal(r.shape('fi').length,2);near(r.width('fi',100),55);near(r.width('AV',100),112);});
test('decomposed accents use retained canonical composition when the glyph exists',()=>{const r=textReference(packed());assert.equal(r.shape('A\u030A')[0].id,r.shape('Å')[0].id);assert.equal(r.shape('A\u030A')[0].count,2);near(r.width('A\u030A',20),r.width('Å',20));});
test('GPOS mark-to-base anchor uses baseline-relative X/Y offsets',()=>{const r=textReference(packed());const a=r.attachment(r.map(65),r.map(0x301));near(a[0],.3);near(a[1],-.7);});
test('GPOS mark-to-mark anchor chains accents instead of moving the text advance',()=>{const r=textReference(packed());const a=r.attachment(r.map(0x30a),r.map(0x301),true);near(a[0],.1);near(a[1],-.15);near(r.width('A\u0301',20),12);});
test('caret interpolation across a ligature uses component advances',()=>{const r=textReference(packed());near(r.caret('fi',0,100),0);near(r.caret('fi',1,100),48*350/550);near(r.caret('fi',2,100),48);});
test('caret uses full-string kerning context instead of isolated prefix measurement',()=>{const r=textReference(packed());near(r.caret('AV',1,100),52);near(r.width('A',100),60);});
test('combining sequence caret boundaries agree with composed glyph advance',()=>{const r=textReference(packed());near(r.caret('A\u030A',1,100),0);near(r.caret('A\u030A',2,100),60);assert.equal(r.mark(0x301),true);assert.equal(r.mark(65),false);assert.equal(r.mark(0x1f642),false);});
test('font line height uses ascent/descent/gap; explicit lineHeight overrides it',()=>{near(textReference(packed()).lineHeight(20),22);near(textReference(packed({lineHeight:30})).lineHeight(20),30);});
test('tabs advance to four-space stops without rendering a replacement glyph',()=>near(textReference(packed()).width('A\tA',20),32));
test('letter spacing is resolved as a pixel distance, not scaled font units',()=>near(textReference(packed({letterSpacing:2,ligatures:false})).width('fi',20),15));
test('word wrapping trims soft-break spaces and preserves hard newlines/CRLF',()=>{
 const r=textReference(packed()),lines=r.lines('AA AA',10,16);assert.equal(lines.length,2);near(lines[0].width,12);assert.equal(lines[0].end,2);assert.equal(lines[0].next,3);
 assert.equal(r.lines('A\r\nV\n',10).length,3);near(r.measure('A\nV',10)[1],22);
});
test('long unbroken words wrap at shaped cluster boundaries',()=>{const r=textReference(packed());assert.equal(r.lines('AAAA',10,13).length,2);assert.equal(r.lines('fifi',10,5).length,2);});
test('soft wrapped lines do not apply kerning against a glyph on the next line',()=>{const r=textReference(packed());const lines=r.lines('AV',100,61);assert.equal(lines.length,2);near(lines[0].width,60);near(lines[1].width,60);});

test('declarative font family, size, weight and features inherit through containers',()=>{
 const f=fixtureFont(),bold={...f,weight:600},italic={...f,style:'italic'},c=compile(h('Grid',{fontFamily:'Fixture UI',fontSize:21,fontWeight:600,kerning:false},h('TextBlock',{text:'A'}),h('TextBlock',{text:'A',fontStyle:'italic'})),{fonts:[f,bold,italic]});
 const u=new Uint32Array(c.nodes.buffer),floats=new Float32Array(c.nodes.buffer);near(floats[72+34],21);const r=textReference(c,1);assert.equal(c.heap[r.style+2]&1,0);assert.notEqual(textReference(c,1).primary,textReference(c,2).primary);
});
test('per-glyph fallback uses another loaded family without stealing a primary glyph',()=>{
 const f=fixtureFont({}, {family:'Main'}),other=fixtureFont({}, {family:'Fallback'});f.cmap=new Map(f.cmap);f.cmap.delete(0x1f642);
 const c=compile(h('TextBlock',{fontFamily:'Main, Fallback',text:'A🙂'}),{fonts:[f,other]}),r=textReference(c);assert.notEqual(r.map(65).face,r.map(0x1f642).face);assert.equal(r.map(0x1f642).id,11);
});
test('font face selection favors matching styles and closest real weights without synthesis',()=>{const normal=fixtureFont(),bold={...normal,weight:600},italic={...normal,style:'italic'};assert.equal(selectFace([normal,bold,italic],normal.family,550),bold);assert.equal(selectFace([normal,bold,italic],normal.family,600,'italic'),italic);});
test('HTML declarations preserve typography features and booleans',()=>{
 const el={tagName:'UI-TEXT',attributes:[['font-family','Fixture UI'],['font-size','20'],['kerning','false'],['ligatures','false'],['text-decoration','underline']].map(([name,value])=>({name,value})),children:[],childNodes:[{nodeType:3,textContent:'AV fi'}]};
 const c=compile(fromHTML(el),{fonts:[fixtureFont()]}),r=textReference(c);assert.equal(c.heap[r.style+2],0);assert.equal(c.heap[r.style+6],1);near(r.width('AV',20),24);
});
for(const props of [{fontWeight:0},{fontStyle:'synthetic'},{lineHeight:-1},{letterSpacing:Infinity},{fontSize:0},{textDecoration:'sparkle'},{textAlignment:'justify'},{kerning:'false'},{ligatures:1}])test(`invalid typography style rejected: ${JSON.stringify(props)}`,()=>assert.throws(()=>packed(props)));

test('cached glyph arena is fixed and its footprint is explicit',()=>{const a=arenaLayout(DEFAULT_LIMITS);assert.equal(a.constants.GLYPH_SLOTS,2048);assert.equal(a.glyphCacheBytes,64+2048*(64+8+4096));});
for(const slots of [0,3,16384])test(`invalid glyph cache capacity ${slots} is rejected`,()=>assert.throws(()=>compile(h('TextBlock'),{limits:{glyphCacheSlots:slots}})));
test('real font resources are marked as fills, while diagnostic compile is explicit',()=>{const c=packed(),r=textReference(c),resource=c.heap[c.heap[r.primary+4]+r.map(65).id*4];assert.equal(c.heap[resource+11],1);near(fromBits(c.heap[resource+5]),0);assert.equal(compile(h('TextBlock')).textMode,'diagnostic');});

test('font format failures are explicit, never a successful placeholder substitution',async()=>{await assert.rejects(()=>loadFont(new Uint8Array(20)),FontFormatError);await assert.rejects(()=>loadFonts([]));await assert.rejects(()=>loadFonts(Array(9).fill(fixtureFont())));});
for(const [tag,off,value,method] of [['head',12,0,'setUint32'],['head',18,0],['head',50,2],['hhea',34,0],['loca',4,0xffffffff,'setUint32'],['maxp',4,0]])test(`malformed ${tag}/${off} is rejected before GPU upload`,()=>assert.throws(()=>parseOpenType(corrupt(tag,off,value,method)),FontFormatError));
test('duplicate SFNT table directory entries are rejected',()=>{const b=makeTestFont();b.set(b.slice(12,16),28);assert.throws(()=>parseOpenType(b),/Duplicate/);});
test('truncated SFNT and cyclic composite glyphs are rejected',()=>{assert.throws(()=>parseOpenType(makeTestFont().slice(0,-1)),FontFormatError);assert.throws(()=>fixtureFont({cycle:true}),/Cyclic/);});
test('configured font byte/outline point limits are enforced',()=>{assert.throws(()=>parseOpenType(makeTestFont(),{maxBytes:100}),/byte limit/);assert.throws(()=>parseOpenType(makeTestFont(),{maxPoints:4}),/point budget/);});
for(const name of ['CFF ','CFF2','fvar'])test(`unsupported ${name} font is rejected explicitly`,()=>assert.throws(()=>fixtureFont({extraTables:{[name]:Array(16).fill(0)}}),/not supported|Variable/));
test('malformed WOFF length and inflated output declaration cannot be accepted',async()=>{
 const woff=await makeWOFF(makeTestFont()),v=new DataView(woff.buffer);v.setUint32(8,woff.length-1);await assert.rejects(()=>decodeWOFF(woff),FontFormatError);
 const other=await makeWOFF(makeTestFont());new DataView(other.buffer).setUint32(16,0xffffffff);await assert.rejects(()=>decodeWOFF(other),FontFormatError);
});
test('font runtime has no Canvas text rasterization or per-frame CPU shaping API',async()=>{
 const runtime=await readFile(new URL('../src/gpu/runtime.js',import.meta.url),'utf8'),glyph=await readFile(new URL('../shaders/glyph-cache.wgsl',import.meta.url),'utf8');
 assert.doesNotMatch(runtime,/fillText|measureText|getImageData|new FontFace/);assert.match(runtime,/rasterGlyphCache/);assert.match(glyph,/bitcast<u32>\(matrix\[k\]\)/);assert.doesNotMatch(glyph,/quantiz|sizeBucket/);
});


test('zero-contour TrueType glyph may end at its ten-byte header',()=>{
 const bytes=makeTestFont(),v=new DataView(bytes.buffer),g=tableOffset(bytes,'glyf').offset,l=tableOffset(bytes,'loca').offset;
 // Empty glyph zero; the following empty glyph can own the remaining unused span.
 v.setInt16(g,0);v.setUint32(l+4,10);
 new Uint8Array(bytes.buffer).fill(0,g+10,g+v.getUint32(l+8));
 const f=parseOpenType(bytes);assert.deepEqual(f.glyphs[0].segments,[]);near(f.glyphs[0].advance,.6);
});
test('WOFF1 rejects undersized SFNT headers and nonzero reserved fields',async()=>{
 for(const [offset,value,method] of [[16,8,'setUint32'],[14,1,'setUint16']]){
  const bytes=await makeWOFF(makeTestFont());new DataView(bytes.buffer)[method](offset,value);await assert.rejects(()=>decodeWOFF(bytes),FontFormatError);
 }
});
