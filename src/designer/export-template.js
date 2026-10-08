/** Optional export assets are expanded only on explicit Export, never at boot.
 * No font data is packaged and no code is evaluated by this decoder. */
export async function decodeExportTemplate(encoded) {
  if(typeof encoded!=='string'||encoded.length>8*1024*1024)throw new RangeError('Invalid embedded export template');
  if(typeof DecompressionStream!=='function')throw new Error('Standalone HTML export requires gzip DecompressionStream support. Use the served source/site export template on this browser.');
  const raw=atob(encoded),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader=stream.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024)throw new RangeError('Expanded export template exceeds 8 MiB');chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  return new Blob(chunks).text();
}
