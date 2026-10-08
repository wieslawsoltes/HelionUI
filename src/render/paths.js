/** Declarative path parser: absolute/relative M L H V Q T C S A Z. Curves stay curves until GPU flattening. */
export function parsePath(source) {
  if (Array.isArray(source)) {
    if (!source.every(s => Array.isArray(s) && s.length === 9 && [0, 1, 2].includes(s[0]) && s.slice(1).every(x => Number.isFinite(x) && Number.isFinite(Math.fround(x))))) throw new TypeError('Malformed vector segment array');
    return source.map(s => [...s]);
  }
  if (typeof source !== 'string') throw new TypeError('Path data must be a string');
  const tokens = source.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
  const junk = source.replace(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[\s,]/g, '');
  if (junk) throw new SyntaxError(`Invalid path tokens: ${junk}`);
  const out = []; let i = 0, command = '', x = 0, y = 0, sx = 0, sy = 0, last = '', controlX = 0, controlY = 0;
  const number = () => { if (i >= tokens.length || /^[a-z]$/i.test(tokens[i])) throw new SyntaxError('Missing path coordinate'); const v = Number(tokens[i++]); if (!Number.isFinite(v) || !Number.isFinite(Math.fround(v))) throw new TypeError('Non-finite path coordinate'); return v; };
  while (i < tokens.length) {
    if (/^[a-z]$/i.test(tokens[i])) command = tokens[i++];
    if (!command) throw new SyntaxError('Path must begin with a command');
    const relative = command === command.toLowerCase(), c = command.toUpperCase();
    const point = () => [number() + (relative ? x : 0), number() + (relative ? y : 0)];
    if (c === 'Z') { if (x !== sx || y !== sy) out.push([0, x, y, sx, sy, 0, 0, 0, 0]); x = sx; y = sy; last='Z';command = ''; continue; }
    if (c === 'M') { [x, y] = point(); sx = x; sy = y; command = relative ? 'l' : 'L';last='M';continue; }
    if (c === 'L') { const [nx, ny] = point(); out.push([0, x, y, nx, ny, 0, 0, 0, 0]); x = nx; y = ny; }
    else if (c === 'H') { const nx = number() + (relative ? x : 0); out.push([0, x, y, nx, y, 0, 0, 0, 0]); x = nx; }
    else if (c === 'V') { const ny = number() + (relative ? y : 0); out.push([0, x, y, x, ny, 0, 0, 0, 0]); y = ny; }
    else if (c === 'Q') { const p = point(), q = point(); out.push([1, x, y, ...p, ...q, 0, 0]); [controlX,controlY]=p;[x, y] = q; }
    else if (c === 'C') { const p = point(), q = point(), r = point(); out.push([2, x, y, ...p, ...q, ...r]); [controlX,controlY]=q;[x, y] = r; }
    else if (c === 'S') { const p=['C','S'].includes(last)?[2*x-controlX,2*y-controlY]:[x,y],q=point(),r=point();out.push([2,x,y,...p,...q,...r]);[controlX,controlY]=q;[x,y]=r; }
    else if (c === 'T') { const p=['Q','T'].includes(last)?[2*x-controlX,2*y-controlY]:[x,y],q=point();out.push([1,x,y,...p,...q,0,0]);[controlX,controlY]=p;[x,y]=q; }
    else if (c === 'A') { const rx=number(),ry=number(),rotation=number(),large=number(),sweep=number(),end=point();if(![0,1].includes(large)||![0,1].includes(sweep))throw new SyntaxError('Arc flags must be 0 or 1');out.push(...arcToCubics([x,y],end,rx,ry,rotation,large,sweep));[x,y]=end; }
    else throw new SyntaxError(`Unsupported path command ${command}; use M/L/H/V/Q/T/C/S/A/Z`);
    last=c;
  }
  if(out.some(segment=>segment.slice(1).some(x=>!Number.isFinite(x)||!Number.isFinite(Math.fround(x)))))throw new RangeError('Path normalization exceeded f32 range');
  return out;
}
export function pathBounds(segments) {
  if (!segments.length) return [0, 0, 0, 0];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of segments) for (let i = 1; i < 5 + s[0] * 2; i += 2) { x0 = Math.min(x0, s[i]); y0 = Math.min(y0, s[i + 1]); x1 = Math.max(x1, s[i]); y1 = Math.max(y1, s[i + 1]); }
  return [x0, y0, x1, y1];
}

/** Endpoint arc normalization, performed once while authoring. Cubic geometry
 * remains retained and its flattening/rasterization still execute in WGSL. */
export function arcToCubics(start,end,radiusX,radiusY,rotation,largeArc,sweep) {
 let rx=Math.abs(radiusX),ry=Math.abs(radiusY);const [x0,y0]=start,[x1,y1]=end;
 if(x0===x1&&y0===y1)return [];if(!rx||!ry)return [[0,x0,y0,x1,y1,0,0,0,0]];
 const phi=rotation*Math.PI/180,c=Math.cos(phi),s=Math.sin(phi),dx=(x0-x1)/2,dy=(y0-y1)/2;
 const xp=c*dx+s*dy,yp=-s*dx+c*dy;const radii=xp*xp/(rx*rx)+yp*yp/(ry*ry);if(radii>1){const k=Math.sqrt(radii);rx*=k;ry*=k;}
 const denom=rx*rx*yp*yp+ry*ry*xp*xp;const factor=(largeArc===sweep?-1:1)*Math.sqrt(Math.max(0,(rx*rx*ry*ry-denom)/denom));
 const cxp=factor*rx*yp/ry,cyp=-factor*ry*xp/rx,cx=c*cxp-s*cyp+(x0+x1)/2,cy=s*cxp+c*cyp+(y0+y1)/2;
 const ux=(xp-cxp)/rx,uy=(yp-cyp)/ry,vx=(-xp-cxp)/rx,vy=(-yp-cyp)/ry;
 const begin=Math.atan2(uy,ux);let delta=Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy);if(!sweep&&delta>0)delta-=2*Math.PI;if(sweep&&delta<0)delta+=2*Math.PI;
 const count=Math.max(1,Math.ceil(Math.abs(delta)/(Math.PI/2))),step=delta/count,out=[];let previous=start;
 const point=t=>[cx+rx*c*Math.cos(t)-ry*s*Math.sin(t),cy+rx*s*Math.cos(t)+ry*c*Math.sin(t)];
 const tangent=t=>[-rx*c*Math.sin(t)-ry*s*Math.cos(t),-rx*s*Math.sin(t)+ry*c*Math.cos(t)];
 for(let i=0;i<count;i++){const a=begin+i*step,b=a+step,k=4/3*Math.tan(step/4),p=point(a),q=i+1===count?end:point(b),ta=tangent(a),tb=tangent(b);out.push([2,...previous,p[0]+k*ta[0],p[1]+k*ta[1],q[0]-k*tb[0],q[1]-k*tb[1],...q]);previous=q;}
 return out;
}
