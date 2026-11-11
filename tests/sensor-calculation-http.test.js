const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
const maps=require('../ship-map-core'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('sensor provenance survives HTTP resolution and reload with owner and GM projections',{timeout:45000},async t=>{
 const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-sensor-departure-'))},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timed out')),8000);child.once('error',reject);child.stdout.on('data',c=>{const u=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(u){clearTimeout(timer);resolve(u);}});});
 const post=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;};
 const f=await require('../scripts/fixtures/console-debug-sensors.cjs').seed(post,3,'ready');
 const state=(token=f.token)=>fetch(`${base}/api/state?room=${f.code}&token=${token}`).then(r=>r.json()),backup=()=>fetch(`${base}/api/campaign/backup?code=${f.code}&token=${f.token}`).then(r=>r.json()),restore=b=>post('campaign/restore',{code:f.code,token:f.token,backup:b});

 const baseline=await backup(),actor=baseline.campaign.encounter.units[0].id;
 Object.assign(baseline.campaign.encounter,{showcase:true,hasEngagedClock:true,activeId:actor,pausedForTurn:true,hardPaused:true,running:false});
 Object.assign(baseline.campaign.encounter.units[0],{atb:100,speed:.1,sensorSkill:0});baseline.campaign.encounter.shipPositions.find(p=>p.id==='debug-target').q=2;for(const ships of [baseline.campaign.starships,baseline.campaign.encounter.starships])ships.find(s=>s.id==='debug-target').sensorScenarioMasking=4;require('../ship-sensors').detect(baseline.campaign.encounter,baseline.campaign.encounter.starships.find(s=>s.id==='debug-ship'),baseline.campaign.encounter.starships.find(s=>s.id==='debug-target'));await restore(baseline);
 const pcAct=body=>post('action',{roomCode:f.code,characterId:f.characterId,characterToken:f.pcToken,...body});
 await pcAct({action:'sensorCommand',id:actor,sicId:'sn',kind:'analysis',targetId:'debug-target',requestId:'calculation-http'});
 let s=await state(),pending=s.units.find(u=>u.id===actor).delayedAction;
 assert.ok(pending.awaitingRoll);assert.ok(pending.rollSpec.calculation);
 const submission={action:'rollShipAction',id:actor,rollId:pending.id,score:60};await pcAct(submission);await pcAct(submission);
 for(let i=0;i<100;i++){s=await state();if(!s.units.find(u=>u.id===actor).delayedAction)break;await f.act({action:'step'});}
 s=await state();const results=s.units.find(u=>u.id===actor).actionResults,final=results.find(r=>r.stage==='complete'&&r.calculation);
 assert.ok(final);assert.ok(final.calculation.gmLines.join(' ').includes('Test Contact'));assert.match(final.calculation.lines.join(' '),/Accepted submitted subtotal/);
 const pc=await state(f.pcToken),pcFinal=pc.units.find(u=>u.id===actor).actionResults.find(r=>r.id===final.id);assert.ok(pcFinal);assert.equal(pcFinal.calculation.gmLines,undefined);
 assert.ok(!JSON.stringify(pc.units).includes('GM only:'));
 const guestPassword=require('node:crypto').randomUUID(),guestCharacter={id:'other-pc',phase:'finalized',access:{pcCode:guestPassword},identity:{characterName:'Other PC'}};const joined=await post('campaign/join/request',{code:f.code,character:guestCharacter});await post('campaign/join/respond',{code:f.code,token:f.token,requestId:joined.requestId,decision:'approve'});const otherToken=(await post('campaign/join/status',{code:f.code,characterId:guestCharacter.id,pcCode:guestPassword})).token;const peerBackup=await backup(),peerSource=peerBackup.campaign.encounter.units.find(u=>u.id===actor);peerBackup.campaign.encounter.units.push({...structuredClone(peerSource),id:'peer-unit',characterId:guestCharacter.id,characterName:'Other PC',actionResults:[],queuedEffects:[],pendingShipRolls:[],delayedAction:null,atb:0});await restore(peerBackup);const peerState=await state(otherToken);assert.ok(peerState.units.some(u=>u.id===actor),'peer sees the same onboard actor');assert.ok(!JSON.stringify(peerState.units).includes('calculation\":{'));
 const count=results.length;await restore(await backup());s=await state();assert.equal(s.units.find(u=>u.id===actor).actionResults.length,count);assert.deepEqual(s.units.find(u=>u.id===actor).actionResults.find(r=>r.id===final.id).calculation,final.calculation);
});
