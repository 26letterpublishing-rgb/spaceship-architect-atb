const test = require('node:test');
const assert = require('node:assert/strict');
const create = require('../browser-storage');
function storage(initial = {}, limit = Infinity) {
  const data = {...initial};
  return new Proxy(data, {get(target,key) {
    if(key==='getItem')return key=>target[key]??null;
    if(key==='setItem')return (key,value)=>{if(Object.entries({...target,[key]:String(value)}).reduce((n,[k,v])=>n+k.length+v.length,0)>limit)throw Error('quota');target[key]=String(value);};
    if(key==='removeItem')return key=>delete target[key];
    return target[key];
  }});
}
function database(entries = new Map(), rejectWrites = false) {
  return {open() {
    const request = {};
    setImmediate(()=>{request.result={transaction() {
      const tx = {}, changes=[];
      tx.objectStore=()=>({put:(v,k)=>changes.push([k,v]),delete:k=>changes.push([k,null]),openCursor() {
        const cursorRequest={}, values=[...entries];let index=0;
        const step=()=>setImmediate(()=>{const item=values[index++];cursorRequest.result=item?{key:item[0],value:item[1],continue:step}:null;cursorRequest.onsuccess?.();if(!item)setImmediate(()=>tx.oncomplete?.());});step();return cursorRequest;
      }});
      setImmediate(()=>{if(changes.length){if(rejectWrites){tx.error=Error('disk full');tx.onabort?.();}else{for(const[k,v]of changes)v===null?entries.delete(k):entries.set(k,v);tx.oncomplete?.();}}});
      return tx;
    }};request.onsuccess();});return request;
  }};
}
function environment(native, entries, rejectWrites=false) {return {localStorage:native,sessionStorage:storage(),indexedDB:database(entries,rejectWrites),addEventListener(){},dispatchEvent(){},CustomEvent:class{}};}
test('full storage migrates only recovery copies and preserves all contents',async()=>{
 const key='sa-campaign-full-backup-v1-TEST', native=storage({[key]:'large backup',other:'do not touch','sa2e-character-library-v1':'old character'}), entries=new Map();
 const api=create(environment(native,entries));await api.ready;
 assert.equal(native.getItem(key),null);assert.equal(api.local.getItem(key),'large backup');assert.equal(native.getItem('other'),'do not touch');assert.equal(native.getItem('sa2e-character-library-v1'),'old character');
 api.local.setItem(key,'new backup');await api.flush();assert.equal(api.local.getItem(key),'new backup');
 const reloaded=create(environment(native,entries));await reloaded.ready;assert.equal(reloaded.local.getItem(key),'new backup');
});
test('new login and character saves survive reload when local and session quotas are full',async()=>{
 const native=storage({filler:'full'},10),entries=new Map(),root=environment(native,entries);root.sessionStorage=storage({},0);
 const api=create(root);await api.ready;
 api.local.setItem('sa-gm-token-ABCD','test-token');api.local.setItem('sa2e-character-recovery-v1','new character');await api.flush();
 const reloaded=create(environment(native,entries));await reloaded.ready;assert.equal(reloaded.local.getItem('sa-gm-token-ABCD'),'test-token');assert.equal(reloaded.local.getItem('sa2e-character-recovery-v1'),'new character');assert.equal(native.getItem('filler'),'full');
});
test('overflow replaces an older native character value without reviving stale data',async()=>{
 const native=storage({'draft':'old'},12),entries=new Map(),api=create(environment(native,entries));await api.ready;
 api.local.setItem('draft','new character too large');assert.equal(api.local.getItem('draft'),'new character too large');await api.flush();assert.equal(native.getItem('draft'),null);
 const again=create(environment(native,entries));await again.ready;assert.equal(again.local.getItem('draft'),'new character too large');again.local.removeItem('draft');await again.flush();assert.equal(entries.has('draft'),false);
});
test('failed archive transactions keep originals and failed saves never report success',async()=>{
 const key='sa-campaign-cache-v1-TEST',native=storage({[key]:'original'},40),api=create(environment(native,new Map(),true));await api.ready;
 assert.equal(native.getItem(key),'original');api.local.setItem('huge','x'.repeat(100));await assert.rejects(api.flush(),/disk full/);assert.equal(native.getItem(key),'original');
});
test('rapid writes persist the latest value and removal',async()=>{
 const entries=new Map(),api=create(environment(storage({},0),entries));await api.ready;
 api.local.setItem('draft','one');api.local.setItem('draft','two');await api.flush();assert.equal(entries.get('draft'),'two');api.local.removeItem('draft');await api.flush();assert.equal(entries.has('draft'),false);
});
test('explicit same-origin memory-only ship roll avoids all native storage access',async()=>{const memory=storage(),provider={memoryOnly:true,ready:Promise.resolve(),local:memory};const root={location:{search:'?shipRoll=1',origin:'http://test'},parent:{location:{origin:'http://test'},SABrowserStorage:provider}};for(const key of ['localStorage','sessionStorage','indexedDB'])Object.defineProperty(root,key,{get(){throw Error('native access: '+key);}});assert.equal(create(root),provider);provider.local.setItem('roll','retained');assert.equal(provider.local.getItem('roll'),'retained');});
for(const kind of ['normal-page','cross-origin','unmarked','missing-ready','missing-remove','inaccessible'])test('memory selection preserves durable fallback: '+kind,async()=>{const root=environment(storage({preserve:'yes'}),new Map()),provider={memoryOnly:true,ready:Promise.resolve(),local:storage()};root.location={search:kind==='normal-page'?'':'?shipRoll=1',origin:'http://test'};root.parent={location:{origin:kind==='cross-origin'?'http://other':'http://test'},SABrowserStorage:provider};if(kind==='unmarked')delete provider.memoryOnly;if(kind==='missing-ready')delete provider.ready;if(kind==='missing-remove')provider.local={getItem(){},setItem(){}};if(kind==='inaccessible')Object.defineProperty(root.parent,'location',{get(){throw Error('cross origin');}});let opened=0;const original=root.indexedDB.open;root.indexedDB.open=(...args)=>{opened++;return original(...args);};const actual=create(root);assert.notEqual(actual,provider);await actual.ready;assert.equal(opened,1);assert.equal(actual.local.getItem('preserve'),'yes');});
