const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process'),{once}=require('events');
test('transporter calculation HTTP owner privacy and restore',{timeout:30000},async t=>{
 const child=spawn(process.execPath,['server.js'],{windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-transporter-provenance-'))},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup')),8000);child.stdout.on('data',v=>{const url=String(v).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
 const post=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;};
 const f=await require('../scripts/fixtures/console-debug-sensors.cjs').seed(post,3,'ready'),get=route=>fetch(base+'/api/'+route).then(r=>r.json()),backup=()=>get(`campaign/backup?code=${f.code}&token=${f.token}`),restore=b=>post('campaign/restore',{code:f.code,token:f.token,backup:b}),state=token=>get(`state?room=${f.code}&token=${token||f.token}`);
 const b=await backup(),e=b.campaign.encounter,u=e.units[0],tf=require('./helpers/transporter-fixture.cjs')(),id=u.id;
 Object.assign(u,tf.unit,{id,characterId:f.characterId});tf.ship.crewCharacterIds=[f.characterId];tf.ship.ship.sicInventory.find(i=>i.id==='vr').impairmentPoints=2;
 tf.ship.ship.sicInventory.push({id:'secret-interference',type:'transport-scrambler',impairmentPoints:1});tf.ship.ship.placements.push({sicId:'secret-interference',cell:u.location.square+1});
 Object.assign(e,{starships:tf.room.starships,shipPositions:tf.room.shipPositions,units:[u],activeId:id,showcase:true,hasEngagedClock:true,pausedForTurn:true,hardPaused:true,running:false});tf.body.passengerIds=[id];assert.equal(require('../ship-transporter').command(e,u,tf.body).ok,true);e.activeId=null;e.pausedForTurn=false;await restore(b);
 let pending=(await state()).units.find(u=>u.id===id).delayedAction;assert.ok(pending.rollSpec.calculation);
 const submit={roomCode:f.code,characterId:f.characterId,characterToken:f.pcToken,action:'rollShipAction',id,rollId:pending.id,score:100,diceResults:[3,1]};await post('action',submit);await post('action',submit);
 for(let i=0;i<100;i++){if(!(await state()).units.find(u=>u.id===id).delayedAction)break;await f.act({action:'step'});}
 const result=(await state()).units.find(u=>u.id===id).actionResults.find(r=>r.stage==='complete');assert.ok(result?.calculation,JSON.stringify((await state()).units.find(u=>u.id===id)));assert.deepEqual(result.calculation.values,[3,1]);assert.match(result.calculation.gmSummary,/secret-interference/);
 const owner=(await state(f.pcToken)).units.find(u=>u.id===id).actionResults.find(r=>r.id===result.id);assert.ok(owner.calculation);assert.equal(owner.calculation.gmSummary,undefined);assert.ok(!JSON.stringify(owner.calculation).includes('secret-interference'));
 await restore(await backup());assert.deepEqual((await state()).units.find(u=>u.id===id).actionResults.find(r=>r.id===result.id).calculation,result.calculation);
});


