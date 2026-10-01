const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
const maps=require('../ship-map-core'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('empty scans retain live timing without dice; uncertain scans freeze for manual input; relocation preserves stats',{timeout:30000},async t=>{
 const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-sensor-outcome-'))},stdio:['ignore','pipe','pipe']});
 child.stderr.on('data',c=>process.stderr.write(c));t.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timed out')),8000);child.stdout.on('data',c=>{const u=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(u){clearTimeout(timer);resolve(u);}});});
 const post=async(route,body)=>{body=await require('./helpers/confirmed-encounter.cjs')(base,body);const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;};
 const demo=await post('campaign/showcase/start',{}),act=body=>post('action',{roomCode:demo.code,gmToken:demo.gmToken,...body}),state=()=>fetch(`${base}/api/state?room=${demo.code}&token=${demo.gmToken}`).then(r=>r.json());
 await require('./helpers/combat-demo.cjs')(base,demo);
 const initial=await state(),source=initial.starships.find(s=>s.controlType==='pc'),target=initial.starships.find(s=>s.id!==source.id),sensor=maps.installedItems(source).find(i=>maps.definition(i.type).sensor);
 const seat=ship=>{const [square,c]=[...maps.buildLayout(ship.ship).footprint].find(([,c])=>maps.definition(c.type).bridge&&c.stations.some(s=>s.x===c.column&&s.y===c.row));return {starshipId:ship.id,square,sicId:c.sicId,mesh:c.stations.find(s=>s.x===c.column&&s.y===c.row).mesh,stationed:true};};
 async function prepare(distance){
  await act({action:'prepareEncounter',mode:'starship',preparationId:'scan-outcome-'+distance,spaceObjects:[{id:'object-rock',name:'Nearby Rock',kind:'asteroid',q:1,r:0,quantity:1}],starships:initial.starships,shipPositions:[{id:source.id,q:0,r:0},{id:target.id,q:distance,r:0}],units:initial.units.map(u=>({...u,preparationUnitId:u.id,speed:.1,moveSpeed:15,sensorSkill:0,location:seat(u.team==='pc'?source:target)}))});
  await act({action:'setRunning',running:true});await act({action:'setHardPaused',paused:true});const u=(await state()).units.find(u=>u.team==='pc');await act({action:'nudge',id:u.id,amount:100});return u;
 }
 let unit=await prepare(100);
 await act({action:'sensorCommand',id:unit.id,sicId:sensor.id,kind:'area',requestId:'empty-scan-http'});let s=await state(),pending=s.units.find(u=>u.id===unit.id).delayedAction;
 assert.ok(pending?.sensorOrder);assert.ok(pending.remaining>0);assert.ok(!pending.awaitingRoll);assert.equal(s.rollPaused,false);
 await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});
 const end=Date.now()+15000;do{await sleep(100);s=await state();}while(s.units.find(u=>u.id===unit.id).delayedAction&&Date.now()<end);
 assert.equal(s.units.find(u=>u.id===unit.id).delayedAction,null);assert.equal(s.starships.find(v=>v.id===source.id).sensorState.reports[0].text,'No contacts resolved in the scanned area. Unknown markers indicate approximate locations. Objects within sensor range: Nearby Rock.');assert.ok(s.units.find(u=>u.id===unit.id).actionResults.some(r=>r.text==='No contacts resolved in the scanned area. Unknown markers indicate approximate locations. Objects within sensor range: Nearby Rock.'));assert.equal(s.running,true);
 assert.deepEqual(s.log.findLast(e=>e.objectRefs?.length)?.objectRefs,[{id:'object-rock',label:'Nearby Rock'}]);
 unit=await prepare(2);await act({action:'sensorCommand',id:unit.id,sicId:sensor.id,kind:'analysis',targetId:target.id,requestId:'uncertain-scan-http'});s=await state();assert.equal(s.units.find(u=>u.id===unit.id).delayedAction.awaitingRoll,true);assert.equal(s.rollPaused,true);
 const timers=s.units.map(u=>u.atb);await sleep(350);assert.deepEqual((await state()).units.map(u=>u.atb),timers);
 const before=(await state()).units.find(u=>u.id===unit.id);await act({action:'setCombatLocation',id:unit.id,location:{...before.location,stationed:false}});const after=(await state()).units.find(u=>u.id===unit.id);
 for(const key of ['moveSpeed','dexterityDice','projectileSkill','weapons','heldWeaponId'])assert.deepEqual(after[key],before[key],key+' must survive GM relocation');
});
