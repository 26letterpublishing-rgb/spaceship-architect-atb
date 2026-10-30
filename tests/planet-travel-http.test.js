const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events'),{randomUUID}=require('node:crypto');
test('fresh saved campaign keeps approved travel and private terrain through server restart',{timeout:30000},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sa-surface-travel-'));let child,base;
 async function launch(){child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),8000);child.stdout.on('data',data=>{const url=String(data).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});}
 async function stop(){if(child?.exitCode===null){const exit=once(child,'exit');child.kill();await exit;}}
 t.after(stop);await launch();
 const post=async(route,body,status=200)=>{const r=await fetch(base+'/api/campaign/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;};
 const demo=await post('showcase/start',{}),template=await fetch(base+`/api/campaign/backup?code=${demo.code}&token=${demo.gmToken}`).then(r=>r.json());
 const fresh=await post('v03/create',{name:'Surface travel persistence QA',gmCode:'surface-qa'},201),code=fresh.campaign.code,initialToken=fresh.token;let token=initialToken;
 template.campaign.interfaceVersion='0.3';template.campaign.roomOpen=true;template.campaign.code=code;template.campaign.name='Surface travel persistence QA';await post('restore',{code,token,backup:template});const saved=await fetch(base+`/api/campaign/backup?code=${code}&token=${token}`).then(r=>r.json());token=(await post('v03/load',{backup:saved,choice:'replace'})).token;
 const id=demo.players[0].id,pc=await post('v03/join',{code,name:'Travel tester'});await post('v03/claim',{code,token:pc.token,characterId:id,password:template.campaign.characters.find(r=>r.id===id).pcCode});
 const state=auth=>fetch(base+`/api/campaign/state?code=${code}&token=${auth}`).then(r=>r.json());let c=await state(token),p=c.starmaps.party;
 const send=(auth,kind,args={},status=200)=>post('v03/starmap',{code,token:auth,kind,...p,...args,receipt:randomUUID()},status);
 await send(token,'planetType',{terrain:'temperate',description:'Public planet lore'});
 await send(token,'planetHex',{hex:'500',description:'Public landing site',gmNotes:'Private cache coordinates'});
 // Showcase settlement terrain is randomized; this persistence test needs a long trip.
 await send(token,'planetMoveParty',{hex:'0'});c=await state(token);p=c.starmaps.party;
 assert.equal(p.hex,'0');
 const {planet}=require('../campaign-planets').context(c,p),terrain=require('../planet-terrain');
 assert.ok(terrain.validHex('0',false,planet.size));assert.ok(terrain.validHex('500',false,planet.size));
 const fixtureRoute=terrain.route('0','500',false,planet.size);assert.equal(fixtureRoute.distance,28,'fixture must retain its long-route precondition');
 await send(pc.token,'planetTravelRequest',{hex:'500'});c=await state(token);const request=c.starmaps.travelRequests.find(r=>r.status==='pending');assert.ok(request);
 await send(pc.token,'planetTravelDecision',{requestId:request.id,approve:true},400);
 await send(token,'planetTravelDecision',{requestId:request.id,approve:true});c=await state(token);const trip=c.starmaps.partyJourney;assert.equal(trip.from.hex,'0');assert.equal(trip.to.hex,'500');assert.equal(trip.total,112);assert.ok(trip.remaining>30);
 await stop();await launch();c=await state(token);assert.equal(c.starmaps.partyJourney.id,trip.id);assert.equal(c.starmaps.travelRequests.find(r=>r.id===request.id).status,'approved');
 const publicState=await state(pc.token),star=publicState.starmaps.maps.find(m=>m.id===p.mapId).stars.find(s=>s.id===p.starId),world=star.surfaces[p.planetId];assert.equal(world.description,'Public planet lore');assert.equal(world.hexes['500'].description,'Public landing site');assert.equal(world.hexes['500'].gmNotes,undefined);assert.ok(c.starmaps.visitedPlanets.length);
 assert.equal(c.starships.find(s=>s.id===p.shipId).characterLocations[id].environment,'surface');
});
