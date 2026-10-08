/** Host-side capability dispatch, not a live document/model mirror. */
export class AppCommandBudget {
 constructor({maxCommands=1000,maxUnits=1048576}={}){this.maxCommands=maxCommands;this.maxUnits=maxUnits;this.started=0;this.commands=0;this.units=0;}
 accept(data,now=performance.now()){
  if(now-this.started>=1000){this.started=now;this.commands=0;this.units=0;}
  if(++this.commands>this.maxCommands)throw new RangeError('App command rate exceeded');
  const stack=[data],seen=new Set();let visited=0;
  while(stack.length){if(++visited>262144)throw new RangeError('App payload is too complex');const value=stack.pop();if(typeof value==='string'){this.units+=value.length;}else if(typeof value==='number'||typeof value==='boolean'){this.units++;}else if(value&&typeof value==='object'){if(seen.has(value))continue;seen.add(value);if(ArrayBuffer.isView(value)){this.units+=value.byteLength/4;}else for(const v of Object.values(value))stack.push(v);}if(this.units>this.maxUnits)throw new RangeError('App command payload budget exceeded');}
 }
}
export function dispatchAppCommand(surface,type,data){
 if(!surface)throw new Error('Call app(view) before mutating its controls');
 if(typeof data.id!=='string'||data.id.length>256)throw new TypeError('A bounded control/model ID is required');
 if(type==='set'){if(typeof data.property!=='string'||!Number.isFinite(data.value))throw new TypeError('set requires a property and finite scalar');surface.set(data.id,data.property,data.value);return;}
 if(type==='text'){if(typeof data.value!=='string')throw new TypeError('app.text requires a string');surface.setText(data.id,data.value);return;}
 if(type==='items'){surface.list(data.id).replace(data.items);return;}
 if(!Array.isArray(data.args)||data.args.length>3)throw new TypeError('Bounded command arguments required');
 if(type==='data'){if(!['upsert','patch','remove','clear','replace','sort','select','batch'].includes(data.operation))throw new TypeError('Unsupported data operation');surface.dataSource(data.id)[data.operation](...data.args);return;}
 if(type==='model'){if(!['set','execute'].includes(data.operation))throw new TypeError('Unsupported model operation');surface.model(data.id)[data.operation](...data.args);return;}
 if(type==='editor'){if(!['insert','replaceDocument','search','insertSnippet','command','setReplacement'].includes(data.operation))throw new TypeError('Unsupported editor operation');surface.editor(data.id)[data.operation](...data.args);return;}
 throw new TypeError(`Unsupported app command ${type}`);
}
