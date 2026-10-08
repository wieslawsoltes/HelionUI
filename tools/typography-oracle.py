#!/usr/bin/env python3
"""Independent test oracle, using system HarfBuzz and ICU. No runtime dependency
and no font assets emitted. JSON input/output enables reproducible local audits."""
import ctypes as C,json,sys
h=C.CDLL('libharfbuzz.so.0');u=C.CDLL('libicuuc.so.76')
def f(lib,name,args,ret):
 a=getattr(lib,name);a.argtypes=args;a.restype=ret;return a
ptr=C.c_void_p;U=C.c_uint32;I=C.c_int32
blob=f(h,'hb_blob_create',[C.c_char_p,U,I,ptr,ptr],ptr);facecreate=f(h,'hb_face_create',[ptr,U],ptr);upem=f(h,'hb_face_get_upem',[ptr],U);fontcreate=f(h,'hb_font_create',[ptr],ptr);funcs=f(h,'hb_ot_font_set_funcs',[ptr],None);scale=f(h,'hb_font_set_scale',[ptr,I,I],None);bcreate=f(h,'hb_buffer_create',[],ptr);add=f(h,'hb_buffer_add_utf32',[ptr,C.POINTER(U),I,U,I],None);guess=f(h,'hb_buffer_guess_segment_properties',[ptr],None);direc=f(h,'hb_buffer_set_direction',[ptr,I],None);script=f(h,'hb_buffer_set_script',[ptr,U],None);lang=f(h,'hb_language_from_string',[C.c_char_p,I],ptr);setlang=f(h,'hb_buffer_set_language',[ptr,ptr],None)
class Feature(C.Structure):_fields_=[('tag',U),('value',U),('start',U),('end',U)]
shape=f(h,'hb_shape',[ptr,ptr,C.POINTER(Feature),U],None)
class Info(C.Structure):_fields_=[('codepoint',U),('mask',U),('cluster',U),('var1',U),('var2',U)]
class Position(C.Structure):_fields_=[('x_advance',I),('y_advance',I),('x_offset',I),('y_offset',I),('var',U)]
infos=f(h,'hb_buffer_get_glyph_infos',[ptr,C.POINTER(U)],C.POINTER(Info));positions=f(h,'hb_buffer_get_glyph_positions',[ptr,C.POINTER(U)],C.POINTER(Position));destroy=f(h,'hb_buffer_destroy',[ptr],None)
version=f(h,'hb_version_string',[],C.c_char_p)().decode()
tag=lambda s:int.from_bytes(s.encode('ascii'),'big')
fonts={}
def hb(req):
 path=req['font']
 if path not in fonts:
  data=open(path,'rb').read();bl=blob(data,len(data),0,None,None);fc=facecreate(bl,0);ft=fontcreate(fc);em=upem(fc);funcs(ft);scale(ft,em,em);fonts[path]=(ft,em)
 ft,em=fonts[path];text=[ord(c) for c in req['text']];buf=bcreate();a=(U*len(text))(*text);add(buf,a,len(text),0,len(text));guess(buf)
 if req.get('direction') in ('ltr','rtl'):direc(buf,4 if req['direction']=='ltr' else 5)
 if req.get('script'):script(buf,tag(req['script']))
 if req.get('language'):setlang(buf,lang(req['language'].encode(),-1))
 feature=req.get('features',{});ff=(Feature*len(feature))(*(Feature(tag(k),int(v),0,0xffffffff)for k,v in feature.items()));shape(ft,buf,ff,len(feature));n=U();ii=infos(buf,C.byref(n));pp=positions(buf,C.byref(n));out=[]
 for i in range(n.value):out.append(dict(gid=ii[i].codepoint,cluster=ii[i].cluster,advanceX=pp[i].x_advance/em,advanceY=-pp[i].y_advance/em,offsetX=pp[i].x_offset/em,offsetY=-pp[i].y_offset/em))
 destroy(buf);return out
ushort=C.c_uint16
bo=f(u,'ubrk_open_76',[I,C.c_char_p,C.POINTER(ushort),I,C.POINTER(I)],ptr);bf=f(u,'ubrk_first_76',[ptr],I);bn=f(u,'ubrk_next_76',[ptr],I);bc=f(u,'ubrk_close_76',[ptr],None)
uopen=f(u,'ubidi_open_76',[],ptr);uset=f(u,'ubidi_setPara_76',[ptr,C.POINTER(ushort),I,C.c_uint8,ptr,C.POINTER(I)],None);ulevel=f(u,'ubidi_getLevels_76',[ptr,C.POINTER(I)],C.POINTER(C.c_uint8));umap=f(u,'ubidi_getVisualMap_76',[ptr,C.POINTER(I),C.POINTER(I)],None);uclose=f(u,'ubidi_close_76',[ptr],None)
def utf16(s):
 raw=s.encode('utf-16-le');arr=(ushort*(len(raw)//2)).from_buffer_copy(raw);mapping={0:0};p=0
 for i,c in enumerate(s):p+=2 if ord(c)>0xffff else 1;mapping[p]=i+1
 return arr,mapping
def grapheme(s):
 a,m=utf16(s);e=I();it=bo(0,b'root',a,len(a),C.byref(e));assert e.value<=0,e.value;out=[];n=bf(it)
 while n!=-1:out.append(m[n]);n=bn(it)
 bc(it);return out
def bidi(req):
 a,m=utf16(req['text']);e=I();it=uopen();base={'ltr':0,'rtl':1,'auto':254}[req.get('direction','auto')];uset(it,a,len(a),base,None,C.byref(e));assert e.value<=0,e.value;l=ulevel(it,C.byref(e));levels=[l[j] for j in sorted(m) if j<len(a)];maps=(I*len(a))();umap(it,maps,C.byref(e));visual=[]
 for j in maps:
  if j in m:visual.append(m[j])
 uclose(it);return dict(levels=levels,order=visual)
def main():
 req=json.load(sys.stdin);out={'harfbuzzVersion':version,'unicodeVersion':'16.0.0','results':[]}
 for r in req['cases']:
  mode=r.get('mode','shape');out['results'].append(hb(r) if mode=='shape' else grapheme(r['text']) if mode=='grapheme' else bidi(r))
 json.dump(out,sys.stdout,ensure_ascii=False)
if __name__=='__main__':main()
