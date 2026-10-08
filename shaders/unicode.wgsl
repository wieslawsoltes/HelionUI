// Unicode 16.0 properties. Runtime lookup/segmentation uses only resident buffers.
fn ucRecord(u:u32,c:u32)->u32 {if(u==0u||c>0x10ffffu){return 0u;}var lo=0u;var hi=heap[u+1u];let base=heap[u];while(lo<hi){let m=u32((lo+hi)/2u);let p=base+m*4u;if(c<heap[p]){hi=m;}else if(c>heap[p+1u]){lo=m+1u;}else{return p;}}return 0u;}
fn ucProps(u:u32,c:u32)->u32 {let p=ucRecord(u,c);if(p==0u){return 0u;}return heap[p+2u];}
fn ucScript(u:u32,c:u32)->u32 {let p=ucRecord(u,c);if(p==0u){return 0x44464c54u;}return heap[p+3u];}
fn ucMap(base:u32,n:u32,c:u32,stride:u32)->u32 {var lo=0u;var hi=n;while(lo<hi){let m=u32((lo+hi)/2u);if(heap[base+m*stride]<c){lo=m+1u;}else{hi=m;}}if(lo<n&&heap[base+lo*stride]==c){return base+lo*stride;}return 0u;}
fn ucMirror(u:u32,c:u32)->u32 {let p=ucMap(heap[u+6u],heap[u+7u],c,2u);if(p==0u){return c;}return heap[p+1u];}
fn ucDecomp(u:u32,c:u32)->u32 {let p=ucMap(heap[u+2u],heap[u+3u],c,2u);if(p==0u){return 0u;}return heap[p+1u];}
fn ucCompose(u:u32,a:u32,b:u32)->u32 {
 if(a>=0x1100u&&a<0x1113u&&b>=0x1161u&&b<0x1176u){return 0xac00u+((a-0x1100u)*21u+b-0x1161u)*28u;}
 if(a>=0xac00u&&a<0xd7a4u&&(a-0xac00u)%28u==0u&&b>0x11a7u&&b<0x11c3u){return a+b-0x11a7u;}
 let base=heap[u+4u];var lo=0u;var hi=heap[u+5u];while(lo<hi){let m=u32((lo+hi)/2u);let p=base+m*3u;if(heap[p]<a||(heap[p]==a&&heap[p+1u]<b)){lo=m+1u;}else{hi=m;}}if(lo<heap[u+5u]){let p=base+lo*3u;if(heap[p]==a&&heap[p+1u]==b){return heap[p+2u];}}return 0u;
}
fn ucChar(data:u32,p:u32,gapStart:u32,gapEnd:u32)->u32 {return heap[data+p+select(0u,gapEnd-gapStart,p>=gapStart)];}
fn ucBoundary(u:u32,data:u32,count:u32,p:u32,gapStart:u32,gapEnd:u32)->bool {
 if(p==0u||p>=count){return true;}let a=ucProps(u,ucChar(data,p-1u,gapStart,gapEnd));let b=ucProps(u,ucChar(data,p,gapStart,gapEnd));let x=a&31u;let y=b&31u;
 if(x==2u&&y==5u){return false;}if(x==1u||x==2u||x==5u||y==1u||y==2u||y==5u){return true;}
 if(x==4u&&(y==4u||y==9u||y==6u||y==7u)){return false;}if((x==6u||x==9u)&&(y==9u||y==8u)){return false;}if((x==7u||x==8u)&&y==8u){return false;}
 if(y==3u||y==17u||y==10u||x==11u){return false;}
 if(((b>>5u)&3u)==1u){var j=p;var linker=false;while(j>0u){j--;let q=(ucProps(u,ucChar(data,j,gapStart,gapEnd))>>5u)&3u;if(q==3u){linker=true;}else if(q==1u){if(linker){return false;}break;}else if(q!=2u){break;}}}
 if((b&128u)!=0u&&x==17u){var j=p-1u;while(j>0u){j--;let q=ucProps(u,ucChar(data,j,gapStart,gapEnd));if((q&128u)!=0u){return false;}if((q&31u)!=3u){break;}}}
 if(x==12u&&y==12u){var j=p;var n=0u;while(j>0u){j--;if((ucProps(u,ucChar(data,j,gapStart,gapEnd))&31u)!=12u){break;}n++;}if(n%2u==1u){return false;}}
 return true;
}
fn ucPrevious(u:u32,data:u32,count:u32,p:u32,gapStart:u32,gapEnd:u32)->u32 {var j=min(p,count);if(j>0u){j--;while(j>0u&&!ucBoundary(u,data,count,j,gapStart,gapEnd)){j--;}}return j;}
fn ucNext(u:u32,data:u32,count:u32,p:u32,gapStart:u32,gapEnd:u32)->u32 {var j=min(p+1u,count);while(j<count&&!ucBoundary(u,data,count,j,gapStart,gapEnd)){j++;}return j;}
