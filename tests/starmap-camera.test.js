const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../space-map.js'),'utf8');
function setup(storage=new Map()){
 const state={roomCode:'one',encounterId:'battle'},bridge={state:()=>state,mode:()=> 'player',myUnitId:()=> 'pc'},observers=[];let fits=0;
 const c={window:{SACombatBridge:bridge},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.stopped=true;}},fitRendered:svg=>{fits++;svg.setAttribute('viewBox','1 2 30 20');},coverViewport(){}};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('  const cameraStorageKey='),source.indexOf('  const wreckVisible=')),c);
 const svg=()=>({dataset:{},box:'0 0 999 999',getAttribute(){return this.box;},setAttribute(k,v){this.box=v;}});
 return {c,state,bridge,observers,storage,svg,fits:()=>fits};
}
test('camera validates finite positive bounded boxes and caps session storage',()=>{
 const h=setup();for(const value of ['NaN 0 1 1','0 0 -1 1','0 0 0 1','Infinity 0 1 1','0 0 100001 1','1 2 3'])assert.equal(h.c.validCamera(value),null);
 assert.equal(h.c.validCamera('1 2 30 20'),'1 2 30 20');for(let i=0;i<55;i++)h.c.mountCamera(h.svg(),'view-'+i);
 const values=JSON.parse(h.storage.get('sa-starmap-cameras-v1'));assert.equal(values.length,40);assert.equal(values[0][0],'view-15');
});
test('manual camera survives unchanged redraws; reload refits current contents',()=>{
 const h=setup(),svg=h.svg(),key=h.c.cameraIdentity('sensors','u','ship','sic');h.c.mountCamera(svg,key);assert.equal(h.fits(),1);
 svg.box='5 6 10 8';h.observers[0].fn();h.c.mountCamera(svg,key);assert.equal(h.fits(),1);assert.equal(svg.box,'5 6 10 8');h.c.releaseCamera(svg);
 const reload=setup(h.storage),next=reload.svg();reload.c.mountCamera(next,key);assert.equal(next.box,'1 2 30 20');assert.equal(reload.fits(),1);
 reload.c.fitRendered(next);reload.observers[0].fn();const reopened=reload.svg();reload.c.mountCamera(reopened,key);assert.equal(reopened.box,'1 2 30 20');
});
test('room, encounter, viewer, operator, ship and view have independent identities',()=>{
 const h=setup(),key=()=>h.c.cameraIdentity('sensors','operator','ship','sic'),base=key();
 for(const field of ['roomCode','encounterId']){const previous=h.state[field];h.state[field]='other';assert.notEqual(key(),base);h.state[field]=previous;}
 h.bridge.mode=()=> 'gm';assert.notEqual(key(),base);h.bridge.mode=()=> 'player';h.bridge.myUnitId=()=> 'other';assert.notEqual(key(),base);h.bridge.myUnitId=()=> 'pc';
 for(const args of [['combat','operator','ship','sic'],['sensors','other','ship','sic'],['sensors','operator','other','sic'],['sensors','operator','ship','other']])assert.notEqual(h.c.cameraIdentity(...args),base);
 const svg=h.svg();h.c.mountCamera(svg,base);svg.box='50 60 10 8';h.observers[0].fn();h.state.encounterId='new';h.c.mountCamera(svg,key());assert.equal(svg.box,'1 2 30 20');
 h.state.catalogPreview=true;assert.equal(key(),null);
});
test('post-layout fit preserves input during opening and reload starts fitted',()=>{
 const h=setup(),tasks=[];h.c.requestAnimationFrame=fn=>tasks.push(fn);const svg=h.svg();svg.isConnected=true;
 h.c.mountCamera(svg,'new');assert.equal(tasks.length,1);svg.dataset.userViewBox=svg.box='5 6 9 8';tasks.shift()();assert.equal(svg.box,'5 6 9 8');h.c.saveCamera(svg);
 const reopened=h.svg();reopened.isConnected=true;h.c.mountCamera(reopened,'new');assert.equal(tasks.length,1);assert.equal(reopened.box,'1 2 30 20');tasks.shift()();
 const fresh=h.svg();fresh.isConnected=true;h.c.mountCamera(fresh,'fresh');const before=h.fits();tasks.shift()();assert.equal(h.fits(),before+1);h.c.mountCamera(fresh,'fresh');assert.equal(tasks.length,0);
});
test('corrupt saved views are ignored and Fit only uses disclosed rendered markers',()=>{
 const storage=new Map([['sa-starmap-cameras-v1',JSON.stringify([['bad','0 0 NaN 1']])]]),h=setup(storage),svg=h.svg();h.c.mountCamera(svg,'bad');assert.equal(h.fits(),1);
 const code=source.slice(source.indexOf('  function fitRendered('),source.indexOf('  function ensureMapStyles(')),seen=[];
 const marker=(x,y)=>({transform:{baseVal:{consolidate:()=>({matrix:{e:x,f:y}})}},hasAttribute:()=>false});
 const map={dataset:{},clientWidth:600,clientHeight:300,querySelectorAll:selector=>{seen.push(selector);return selector==='[data-space-ship]:not([data-fit-ignore])'?[marker(0,0),marker(2,0)]:[];},setAttribute:(name,value)=>map.value=value};
 vm.runInContext(code,h.c);h.c.fitRendered(map);assert.ok(seen.includes('[data-space-ship]:not([data-fit-ignore])'));assert.ok(Number(map.value.split(' ')[2])<30);
 map.querySelectorAll=()=>[];const prior=map.value;h.c.fitRendered(map);assert.equal(map.value,prior,'empty contact picture retains safe existing extent');
});

test('changed disclosed contents refit once; unchanged updates preserve pan and zoom',()=>{
 const h=setup(),svg=h.svg();h.c.mountCamera(svg,'combat');h.c.refitContents(svg,'known-a');svg.box='5 6 9 8';svg.dataset.manualCamera='true';
 h.c.refitContents(svg,'known-a');assert.equal(svg.box,'5 6 9 8');
 for(const signature of ['known-a,detected-b','known-a,last-known-b','known-a','known-a,object-c']){h.c.refitContents(svg,signature);assert.equal(svg.box,'1 2 30 20');assert.equal(svg.dataset.manualCamera,undefined);svg.box='5 6 9 8';}
 const untouched=h.svg();h.c.refitContents(untouched,'one');h.c.refitContents(untouched,'two');assert.equal(untouched.box,'0 0 999 999','unmounted campaign/edit maps are not changed');
});
