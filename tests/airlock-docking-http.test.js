const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
test('Bridge docking and PC boarding run through authenticated campaign routes',{timeout:45000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sa-airlock-http-')),child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
 const post=async(p,b,status=200)=>{const r=await fetch(base+'/api/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d).slice(0,500));return d;};
 const demo=await post('campaign/showcase/start',{}),code=demo.code,token=demo.gmToken,pc=demo.players[0];
 const backup=await fetch(`${base}/api/campaign/backup?code=${code}&token=${token}`).then(r=>r.json()),f=require('./helpers/crew-room-fixture.cjs')();f.seat('bridge');
 const source=f.ship,target=structuredClone(source);target.id='other';target.ship.id='other';target.title='Destination';target.crewCharacterIds=[];target.characterLocations={};source.crewCharacterIds=[pc.id];source.characterLocations={[pc.id]:f.unit.location};
 for(const s of [source,target]){s.ship.airlocks=[{square:21,side:'left'}];s.ship.currentShieldHp=0;s.ship.fieldState={position:{q:0,r:0}};}
 backup.campaign.starships=[source,target];backup.campaign.npcRoster=[];backup.campaign.encounter=null;
 await post('campaign/restore',{code,token,backup});
 const utility=b=>post('campaign/starship/field-utility',{code,token:pc.token,characterId:pc.id,starshipId:source.id,sicId:'bridge',...b});
 let inspect=await utility({kind:'airlock-inspect'});assert.equal(inspect.result.targets[0].id,'other');
 await utility({kind:'airlock-dock',targetId:'other',receipt:'http-airlock-dock'});await utility({kind:'airlock-dock',targetId:'other',receipt:'http-airlock-dock'});
 inspect=await utility({kind:'airlock-inspect'});assert.equal(inspect.result.links.length,1);assert.ok(inspect.result.links[0].remaining>18);
 const waitFor=async(read,accept,timeout)=>{const end=Date.now()+timeout;let value;do{value=await read();if(accept(value))return value;await new Promise(r=>setTimeout(r,200));}while(Date.now()<end);assert.fail('Expected transition did not finish: '+JSON.stringify(value).slice(0,400));};
 await waitFor(()=>utility({kind:'airlock-inspect'}),r=>r.result.links[0]?.ready,25000);
 await post('campaign/starship/move-character',{code,token:pc.token,characterId:pc.id,starshipId:source.id,square:21,mesh:4,boardShipId:'other'});
 const state=()=>fetch(`${base}/api/campaign/state?code=${code}&token=${pc.token}`).then(r=>r.json());
 await waitFor(state,s=>s.starships.find(s=>s.id===source.id)?.characterLocations?.[pc.id]?.environment==='boarding',3000);
 const arrived=await waitFor(state,s=>s.starships.find(s=>s.id==='other')?.characterLocations?.[pc.id]?.square===21,8000);
 assert.equal(arrived.starships.find(s=>s.id===source.id).characterLocations[pc.id],undefined);
});

test('active combat boarding settles before initiative and survives reload with guarded stranded-turn recovery',{timeout:45000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sa-board-combat-')),child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
 const post=async(p,b,status=200)=>{const r=await fetch(base+'/api/'+p,{method:'POST',headers:{'Content-Type':'application/json',Connection:'close'},body:JSON.stringify(b)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d).slice(0,500));return d;};
 const demo=await post('campaign/showcase/start',{}),code=demo.code,token=demo.gmToken,pc=demo.players[0];
 const state=()=>fetch(`${base}/api/state?room=${code}&token=${token}`).then(r=>r.json()),backup=()=>fetch(`${base}/api/campaign/backup?code=${code}&token=${token}`).then(r=>r.json()),act=b=>post('action',{roomCode:code,gmToken:token,...b});
 let s=await state();const own=s.starships[0],target=s.starships[1],actor=s.units.find(u=>u.characterId===pc.id),pilot=s.units.find(u=>u.characterId===demo.players[1].id),hatch=own.ship.airlocks[0],seat=require('../ship-automation').seats(own).find(v=>v.bridge);
 await act({action:'prepareEncounter',confirmCampaignName:'Explore Features',expectedEncounterId:s.encounterId,preparationId:require('node:crypto').randomUUID(),mode:'starship',starships:s.starships,shipPositions:s.starships.map(v=>({id:v.id,q:0,r:0})),units:s.units.map(u=>({...u,preparationUnitId:u.id,speed:1,location:u.id===actor.id?{environment:'starship',starshipId:own.id,square:hatch.square,mesh:3}:u.id===pilot.id?seat:u.location}))});
 let b=await backup();const e=b.campaign.encounter;e.shipPositions=e.starships.map(v=>({id:v.id,q:0,r:0}));e.knownContacts={[own.id]:{[target.id]:{level:'detected'}}};
 for(const v of e.starships){v.currentShieldHp=v.ship.currentShieldHp=0;for(const i of v.ship.sicInventory)if(require('../ship-map-core').definition(i.type).shield){i.disabled=true;i.status='powered-down';}if(v.id===own.id)v.sensorState={contacts:{[target.id]:{level:'detected'}}};}
 await post('campaign/restore',{code,token,backup:b});await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});await act({action:'setHardPaused',paused:true});assert.equal((await state()).hasEngagedClock,true);
 await post('campaign/starship/field-utility',{code,token,starshipId:own.id,id:pilot.id,sicId:seat.sicId,kind:'airlock-dock',targetId:target.id,receipt:'combat-docking'});for(let i=0;i<20;i++)await act({action:'step'});
 await act({action:'nudge',id:actor.id,amount:100});
 const move={roomCode:code,characterId:pc.id,characterToken:pc.token,action:'playerCombatAction',id:actor.id,kind:'move',boardShipId:target.id,route:[{environment:'starship',starshipId:own.id,square:hatch.square,mesh:4}]};
 await post('action',{...move,characterToken:demo.players[1].token},403);await post('action',move);await act({action:'step'});
 s=await state();assert.equal(s.units.find(u=>u.id===actor.id).location.environment,'boarding');assert.notEqual(s.activeId,actor.id);assert.equal(s.starships[0].ship.airlockDocking.transfers[0].remaining,5);
 await act({action:'step'});await act({action:'step'});b=await backup();assert.equal(b.campaign.encounter.starships[0].ship.airlockDocking.transfers[0].remaining,3);
 // An unrelated active turn must not be discarded by boarding recovery.
 const unrelated=structuredClone(b);unrelated.campaign.encounter.activeId=pilot.id;unrelated.campaign.encounter.pausedForTurn=true;await post('campaign/restore',{code,token,backup:unrelated});assert.equal((await state()).activeId,pilot.id);
 // Recover the exact legacy stranded passenger without advancing its saved timer.
 const stuck=structuredClone(b),u=stuck.campaign.encounter.units.find(u=>u.id===actor.id);u.location.environment='exterior';stuck.campaign.encounter.activeId=actor.id;stuck.campaign.encounter.pausedForTurn=true;stuck.campaign.encounter.activeAction=null;
 for(const invalid of [{unitId:'unrelated-unit'},{remaining:6}]){const unsafe=structuredClone(stuck);Object.assign(unsafe.campaign.encounter.starships[0].ship.airlockDocking.transfers[0],invalid);await post('campaign/restore',{code,token,backup:unsafe});const unchanged=await state();assert.equal(unchanged.activeId,actor.id);assert.equal(unchanged.units.find(u=>u.id===actor.id).location.environment,'exterior');}
 await post('campaign/restore',{code,token,backup:stuck});s=await state();assert.notEqual(s.activeId,actor.id,JSON.stringify({unit:s.units.find(u=>u.id===actor.id),ships:s.starships.map(v=>({id:v.id,transfers:v.ship.airlockDocking?.transfers,hull:v.ship.gridCells.includes(208)})),paused:s.pausedForTurn,action:s.activeAction,attack:s.attackResolution,item:s.itemResolution,delay:s.delayRequest}));assert.equal(s.units.find(u=>u.id===actor.id).location.environment,'boarding');assert.equal(s.starships[0].ship.airlockDocking.transfers[0].remaining,3);
 for(let i=0;i<2;i++)await act({action:'step'});assert.equal((await state()).units.find(u=>u.id===actor.id).location.environment,'boarding');await act({action:'step'});
 s=await state();const arrived=s.units.find(u=>u.id===actor.id);assert.equal(arrived.location.starshipId,target.id);assert.equal(arrived.team,'pc');assert.ok(!s.starships[1].crewCharacterIds.includes(pc.id));assert.equal(s.starships[0].ship.airlockDocking.transfers.length,0);
 b=await backup();await post('campaign/restore',{code,token,backup:b});assert.equal((await state()).units.find(u=>u.id===actor.id).location.starshipId,target.id);
});
