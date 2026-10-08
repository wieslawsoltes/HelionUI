#!/usr/bin/env python3
"""Build-time Unicode 16.0 data generation; ICU 76 is NOT a runtime dependency."""
import ctypes as C,json,pathlib,argparse
p=argparse.ArgumentParser();p.add_argument('--ucd',default='/usr/share/texlive/texmf-dist/tex/generic/unicode-data');p.add_argument('--output',default='src/typography/unicode-data.js');a=p.parse_args();u=C.CDLL('libicuuc.so.76')
def fn(n,args,ret):
 f=getattr(u,n+'_76');f.argtypes=args;f.restype=ret;return f
v=(C.c_uint8*4)();fn('u_getUnicodeVersion',[C.POINTER(C.c_uint8)],None)(v);assert list(v)==[16,0,0,0]
prop=fn('u_getIntPropertyValue',[C.c_int32,C.c_int32],C.c_int32);binary=fn('u_hasBinaryProperty',[C.c_int32,C.c_int32],C.c_uint8);short=fn('uscript_getShortName',[C.c_int32],C.c_char_p);mir=fn('u_charMirror',[C.c_int32],C.c_int32);pair=fn('u_getBidiPairedBracket',[C.c_int32],C.c_int32)
status=C.c_int32();nfc=fn('unorm2_getNFCInstance',[C.POINTER(C.c_int32)],C.c_void_p)(C.byref(status));compose=fn('unorm2_composePair',[C.c_void_p,C.c_int32,C.c_int32],C.c_int32)
tag=lambda s:int.from_bytes(s.encode('ascii'),'big');scripts={}
for i in range(256):
 s=short(i)
 if s:
  s=s.decode().lower();scripts[i]=tag({'zyyy':'DFLT','zinh':'DFLT','zzzz':'DFLT','hira':'kana'}.get(s,s))
ranges=[];last=None;start=0;mirrors=[];brackets=[]
for cp in range(0x110000):
 props=(prop(cp,0x1012)&31)|((prop(cp,0x101a)&3)<<5)|(int(binary(cp,64))<<7)|(prop(cp,0x1002)<<8)|(prop(cp,0x1000)<<16)|(prop(cp,0x1007)<<21)|(int(binary(cp,5))<<24)
 value=(props,scripts.get(prop(cp,0x100a),tag('DFLT')))
 if last is not None and value!=last:ranges.extend([start,cp-1,*last]);start=cp
 last=value
 m=mir(cp)
 if m!=cp:mirrors.extend([cp,m])
 b=pair(cp)
 if b!=cp:brackets.extend([cp,b,prop(cp,0x1015)])
ranges.extend([start,0x10ffff,*last]);decomp=[];comps=[]
for line in (pathlib.Path(a.ucd)/'UnicodeData.txt').read_text().splitlines():
 c=line.split(';');raw=c[5]
 if not raw or raw.startswith('<'):continue
 cp=int(c[0],16);seq=[int(s,16) for s in raw.split()];decomp.extend([cp,len(seq),*seq])
 if len(seq)==2 and compose(nfc,*seq)==cp:comps.append([*seq,cp])
comps.sort();data=dict(version='16.0.0',ranges=ranges,decompositions=decomp,compositions=[x for t in comps for x in t],mirrors=mirrors,brackets=brackets)
text='// Generated Unicode 16.0.0 data, ICU 76 / UCD 16. See NOTICE. No font data.\nexport const UNICODE_DATA=Object.freeze('+json.dumps(data,separators=(',',':'))+');\n';pathlib.Path(a.output).write_text(text);print(json.dumps(dict(version='16.0.0',ranges=len(ranges)//4,pairs=len(comps),bytes=len(text))))
