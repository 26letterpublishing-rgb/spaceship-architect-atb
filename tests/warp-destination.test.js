const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events'),maps=require('../ship-map-core');
const root=path.resolve(__dirname,'..');
test('real authenticated Console destinations persist Campaign arrival and actual universal arrival stamp',{timeout:45000},async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sa-transit-http-'));let child,base;
  async function launch(){child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.stdout.on('data',c=>{const u=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(u){clearTimeout(timer);resolve(u);}});});}
  async function stop(){if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}}await launch();t.after(stop);
  const post=async(route,body,status=200)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};
  const demo=await post('campaign/showcase/start',{}),created={campaign:{code:demo.code},token:demo.gmToken},code=created.campaign.code;let token=created.token;
  const backup=await fetch(`${base}/api/campaign/backup?code=${demo.code}&token=${demo.gmToken}`).then(r=>r.json());backup.campaign.code=code;backup.campaign.name='Transit HTTP';backup.campaign.showcase=true;
  const c=backup.campaign,record=c.starships.find(s=>s.id==='showcase-pc-ship'),nova=c.characters[0],npc=c.encounter.units.find(u=>u.team==='npc'),pilot=c.encounter.units.find(u=>u.characterId===nova.id);
  const ship={gridCells:maps.rectangleCells({},42,16,16),groupCredits:10000,sicInventory:[{id:'bridge-test',type:'bridge-1'},{id:'en-test',type:'en-engine-6'},{id:'life-test',type:'life-support'},{id:'warp-test',type:'warp-drive-zero'},{id:'destruct-test',type:'self-destruct'},...Array.from({length:4},(_,i)=>({id:`thruster-test-${i}`,type:'exhaust-thruster-1'}))],placements:[{sicId:'bridge-test',cell:42},{sicId:'en-test',cell:162},{sicId:'life-test',cell:66},{sicId:'warp-test',cell:48},{sicId:'destruct-test',cell:42},...Array.from({length:4},(_,i)=>({sicId:`thruster-test-${i}`,cell:41+i*20}))],warpFuel:{D:3},minerals:{Iron:7},confirmedOnce:true};ship.confirmed=structuredClone(ship);assert.equal(maps.exteriorError(ship),'');
  record.ship=ship;record.crewNpcUnitIds=[npc.id];const stations=maps.definition('bridge-1').stations;
  const location=index=>({starshipId:record.id,sicId:'bridge-test',square:42+stations[index].y*20+stations[index].x,mesh:stations[index].mesh,stationed:true});
  record.characterLocations={[nova.id]:location(0)};Object.assign(npc,{location:location(1),currentHp:40,defeatedAt:null});c.npcRoster=[structuredClone(npc)];Object.assign(pilot,{location:location(0),currentHp:40,defeatedAt:null,atb:100});
  const source=c.encounter.starships.find(s=>s.id===record.id);Object.assign(source,structuredClone(record),{maximumHullHp:256,currentHullHp:256});Object.assign(c.encounter,{hasEngagedClock:false,encounterEndedAt:Date.now(),running:false,hardPaused:false,activeId:null});
  c.interfaceVersion='0.3';c.roomOpen=true;c.starmaps.localPositions={};c.starmaps.localJourneys={};delete c.starmaps.party;c.starmaps.navigation={mode:'galaxy',allowed:{galaxy:true,system:true,orbit:true,surface:true}};await post('campaign/restore',{code,token,backup});
  const pc=demo.players.find(p=>p.id===nova.id);

 const sector=c.starmaps.maps[0],origin=c.starmaps.positions[record.id];
 await post('campaign/v03/starmap',{code,token,kind:'scale',mapId:sector.id,scale:.01,receipt:crypto.randomUUID()});

 const target=sector.stars.find(s=>s.q!==origin.q||s.r!==origin.r),destination={mapId:sector.id,q:target.q,r:target.r,origin};
 const action=(body,auth=pc.token,status=200)=>post('campaign/starship/transit',{code,token:auth,characterId:nova.id,shipId:record.id,sicId:'warp-test',requestId:crypto.randomUUID(),...body},status);
 const starVisibility=hidden=>post('campaign/v03/starmap',{code,token,kind:'star',mapId:sector.id,starId:target.id,q:target.q,r:target.r,name:target.name,hidden,receipt:crypto.randomUUID()});
 await starVisibility(true);await action({kind:'warpStart',destination},token);
 const gmHidden=await fetch(base+'/api/campaign/state?code='+code+'&token='+token).then(r=>r.json());assert.equal(gmHidden.starships.find(s=>s.id===record.id).ship.warpState.campaignDestination.starId,target.id);
 for(const route of ['campaign/state?code=']){const hidden=await fetch(base+'/api/'+route+code+'&token='+pc.token).then(r=>r.json());const projected=hidden.starships.find(s=>s.id===record.id).ship;assert.equal(projected.warpState.campaignDestination.starId,undefined);assert.notEqual(projected.warpState.campaignDestination.name,target.name);assert.equal(projected.transitReceipts,undefined);}
 const lobby=await post('campaign/v03/join',{code,name:'Privacy lobby'}),other=c.characters.find(r=>r.id!==nova.id);
 const details=auth=>post('campaign/starship/details',{code,token:auth,ids:[record.id]});
 const assertPrivateDetails=async auth=>{const d=(await details(auth)).starships[0].ship;assert.equal(d.warpState.campaignDestination.starId,undefined);assert.notEqual(d.warpState.campaignDestination.name,target.name);assert.equal(d.transitReceipts,undefined);};
 await assertPrivateDetails(lobby.token);
 await post('campaign/v03/claim',{code,token:lobby.token,characterId:other.id,password:other.pcCode});await assertPrivateDetails(lobby.token);
 await post('campaign/v03/abandon',{code,token:lobby.token});
 const reconnect=await post('campaign/v03/join',{code,name:'Privacy reconnect'});await post('campaign/v03/claim',{code,token:reconnect.token,characterId:other.id,password:other.pcCode});await assertPrivateDetails(reconnect.token);
 const gmDetails=(await details(token)).starships[0].ship;assert.equal(gmDetails.warpState.campaignDestination.starId,target.id);assert.equal(gmDetails.warpState.campaignDestination.name,target.name);assert.ok(gmDetails.transitReceipts.length);
 await post('campaign/starship/details',{code,token:'invalid',ids:[record.id]},403);
 const doorKey=require('../ship-doors').list(record)[0];assert.ok(doorKey,'Fixture provides an existing operable door');
 const door=await post('campaign/starship/door',{code,token:pc.token,characterId:nova.id,starshipId:record.id,doorKey});assert.equal(door.starship.ship.warpState.campaignDestination.starId,undefined);assert.notEqual(door.starship.ship.warpState.campaignDestination.name,target.name);assert.equal(door.starship.ship.transitReceipts,undefined);
 const cancelledHidden=await action({kind:'warpCancel'});assert.equal(cancelledHidden.result.ship.ship.warpState.campaignDestination.starId,undefined);assert.notEqual(cancelledHidden.result.ship.ship.warpState.campaignDestination.name,target.name);assert.equal(cancelledHidden.result.ship.ship.transitReceipts,undefined);
 const authoritativeCancelled=(await details(token)).starships[0].ship;assert.equal(authoritativeCancelled.warpState.phase,'cancelled');assert.equal(authoritativeCancelled.warpState.campaignDestination.starId,target.id);assert.equal(authoritativeCancelled.warpState.campaignDestination.name,target.name);assert.ok(authoritativeCancelled.transitReceipts.length);
 await starVisibility(false);

 const quote=await action({kind:'warpPlan',destination,distanceLY:900});assert.equal(quote.result.targetLY,.03);
 await action({kind:'warpPlan',destination},'invalid-token',403);
 await action({kind:'warpStart',destination:{...destination,origin:{...origin,q:1}}},pc.token,409);
 const start={kind:'warpStart',destination,requestId:'selected-destination-once'};
 await action(start);const duplicate=await action(start);assert.equal(duplicate.result.duplicate,true);
 await action({...start,destination:{...destination,q:target.q+1}},pc.token,409);
 const jump={code,token,amount:1,unit:'days',requestId:'destination-one-day'};
 await post('campaign/time/pass',jump);await post('campaign/time/pass',jump);
 const final=await fetch(base+'/api/campaign/state?code='+code+'&token='+token).then(r=>r.json());
 assert.deepEqual(final.starmaps.positions[record.id],{mapId:sector.id,q:target.q,r:target.r});
 const visits=final.starmaps.warpVisits[record.id];assert.equal(visits.length,1);assert.equal(visits[0].name,target.name);
 assert(visits[0].elapsedSeconds>0&&visits[0].elapsedSeconds<86400,'arrival is inside the time jump, not at its old or final clock');
 assert.equal(final.starships.find(s=>s.id===record.id).ship.warpFuel.D,2);
 assert.equal(final.elapsedMinutes,1440);
 const act=body=>post('action',{roomCode:code,gmToken:token,...body});
 const before=await fetch(base+'/api/state?room='+code+'&token='+token).then(r=>r.json());
 await act({action:'prepareEncounter',confirmCampaignName:'Transit HTTP',expectedEncounterId:before.encounterId,preparationId:crypto.randomUUID(),mode:'starship',starships:before.starships,shipPositions:before.shipPositions,units:[{...pilot,preparationUnitId:pilot.id}]});
 await act({action:'setRunning',running:true});await act({action:'setHardPaused',paused:true});
 let live=await fetch(base+'/api/state?room='+code+'&token='+token).then(r=>r.json());const actor=live.units.find(u=>u.characterId===nova.id);
 await act({action:'nudge',id:actor.id,amount:100});
 const back={mapId:sector.id,q:origin.q,r:origin.r,origin:{mapId:sector.id,q:target.q,r:target.r}};
 const combatBody={action:'transitCommand',roomCode:code,characterToken:pc.token,characterId:nova.id,id:actor.id,shipId:record.id,sicId:'warp-test',kind:'warpStart',destination:back,requestId:'combat-destination-once'};
 const originStar=sector.stars.find(s=>s.q===origin.q&&s.r===origin.r);
 await post('campaign/v03/starmap',{code,token,kind:'star',mapId:sector.id,starId:originStar.id,q:originStar.q,r:originStar.r,name:originStar.name,hidden:true,receipt:crypto.randomUUID()});
 const hiddenStart=await post('action',{...combatBody,gmToken:token,characterToken:undefined,requestId:'gm-hidden-combat-start'});assert.equal(hiddenStart.starships.find(s=>s.id===record.id).ship.warpState.campaignDestination.starId,originStar.id);
 const hiddenLive=await fetch(base+'/api/state?room='+code+'&token='+pc.token).then(r=>r.json());assert.equal(hiddenLive.starships.find(s=>s.id===record.id).ship.warpState.campaignDestination.starId,undefined);assert.notEqual(hiddenLive.starships.find(s=>s.id===record.id).ship.warpState.campaignDestination.name,originStar.name);assert.equal(hiddenLive.starships.find(s=>s.id===record.id).ship.transitReceipts,undefined);
 await post('action',{...combatBody,gmToken:token,characterToken:undefined,kind:'warpCancel',requestId:'gm-hidden-combat-cancel'});
 await post('campaign/v03/starmap',{code,token,kind:'star',mapId:sector.id,starId:originStar.id,q:originStar.q,r:originStar.r,name:originStar.name,hidden:false,receipt:crypto.randomUUID()});
 await act({action:'nudge',id:actor.id,amount:100});
 const started=await post('action',combatBody);assert.equal(started.starships.find(s=>s.id===record.id).ship.warpState.phase,'activating');
 await post('action',{...combatBody,characterToken:'invalid'},403);
 await post('action',{...combatBody,kind:'warpCancel',requestId:'combat-destination-cancel'});
 const cancelled=await fetch(base+'/api/campaign/state?code='+code+'&token='+token).then(r=>r.json());assert.deepEqual(cancelled.starmaps.positions[record.id],final.starmaps.positions[record.id]);

 const pcState=await fetch(base+'/api/campaign/state?code='+code+'&token='+pc.token).then(r=>r.json());assert.deepEqual(pcState.starmaps.warpVisits[record.id],visits);assert.equal(pcState.starmaps.consoleWarpProgress,undefined);
});

test('selected Console destination survives real server restart without offline travel or duplicate fuel',{timeout:45000},async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sa-transit-http-'));let child,base;
  async function launch(){child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.stdout.on('data',c=>{const u=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(u){clearTimeout(timer);resolve(u);}});});}
  async function stop(){if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}}t.after(stop);await launch();
  const post=async(route,body,status=200)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};
  const demo=await post('campaign/showcase/start',{}),created=await post('campaign/create',{name:'Transit HTTP',gmCode:'transit-test'},201),code=created.campaign.code;let token=created.token;
  const backup=await fetch(`${base}/api/campaign/backup?code=${demo.code}&token=${demo.gmToken}`).then(r=>r.json());backup.campaign.code=code;backup.campaign.name='Transit HTTP';backup.campaign.showcase=false;
  const c=backup.campaign,record=c.starships.find(s=>s.id==='showcase-pc-ship'),nova=c.characters[0],npc=c.encounter.units.find(u=>u.team==='npc'),pilot=c.encounter.units.find(u=>u.characterId===nova.id);
  const ship={gridCells:maps.rectangleCells({},42,16,16),groupCredits:10000,sicInventory:[{id:'bridge-test',type:'bridge-1'},{id:'en-test',type:'en-engine-6'},{id:'life-test',type:'life-support'},{id:'warp-test',type:'warp-drive-zero'},{id:'destruct-test',type:'self-destruct'},...Array.from({length:4},(_,i)=>({id:`thruster-test-${i}`,type:'exhaust-thruster-1'}))],placements:[{sicId:'bridge-test',cell:42},{sicId:'en-test',cell:162},{sicId:'life-test',cell:66},{sicId:'warp-test',cell:48},{sicId:'destruct-test',cell:42},...Array.from({length:4},(_,i)=>({sicId:`thruster-test-${i}`,cell:41+i*20}))],warpFuel:{D:3},minerals:{Iron:7},confirmedOnce:true};ship.confirmed=structuredClone(ship);assert.equal(maps.exteriorError(ship),'');
  record.ship=ship;record.crewNpcUnitIds=[npc.id];const stations=maps.definition('bridge-1').stations;
  const location=index=>({starshipId:record.id,sicId:'bridge-test',square:42+stations[index].y*20+stations[index].x,mesh:stations[index].mesh,stationed:true});
  record.characterLocations={[nova.id]:location(0)};Object.assign(npc,{location:location(1),currentHp:40,defeatedAt:null});c.npcRoster=[structuredClone(npc)];Object.assign(pilot,{location:location(0),currentHp:40,defeatedAt:null,atb:100});
  const source=c.encounter.starships.find(s=>s.id===record.id);Object.assign(source,structuredClone(record),{maximumHullHp:256,currentHullHp:256});Object.assign(c.encounter,{hasEngagedClock:false,encounterEndedAt:Date.now(),running:false,hardPaused:false,activeId:null});
  c.starmaps.localPositions={};c.starmaps.localJourneys={};delete c.starmaps.party;c.starmaps.navigation={mode:'galaxy',allowed:{galaxy:true,system:true,orbit:true,surface:true}};c.starmaps.maps[0].lightYearsPerHex=.01;await post('campaign/restore',{code,token,backup});
  const pc=await post('campaign/character/unlock',{code,characterId:nova.id,pcCode:nova.pcCode});
  const get=route=>fetch(base+'/api/'+route).then(r=>r.json()),campaign=()=>get(`campaign/state?code=${code}&token=${token}`),state=()=>get(`state?room=${code}&token=${token}`),saved=()=>get(`campaign/backup?code=${code}&token=${token}`);
  const transit=(body,auth=pc.token,status=200)=>post('campaign/starship/transit',{code,token:auth,characterId:nova.id,starshipId:record.id,requestId:crypto.randomUUID(),...body},status);

 const map=c.starmaps.maps[0],from=c.starmaps.positions[record.id],star=map.stars.find(s=>s.q===3),destination={mapId:map.id,q:star.q,r:star.r,origin:from};
 const start={kind:'warpStart',sicId:'warp-test',destination,requestId:'restart-warp-once'};
 await transit(start);await post('campaign/time/pass',{code,token,amount:1,unit:'hours',requestId:'before-restart-hour'});
 const prior=await saved(),w=prior.campaign.starships.find(s=>s.id===record.id).ship.warpState;
 assert.equal(w.phase,'traveling');assert(w.traveledLY>0&&w.traveledLY<w.targetLY);
 const priorFuel=structuredClone(prior.campaign.starships.find(s=>s.id===record.id).ship.warpFuel),priorPos=structuredClone(prior.campaign.starmaps.positions[record.id]);
 await stop();await launch();const opened=await post('campaign/open',{name:'Transit HTTP',gmCode:'transit-test'});token=opened.token;
 const after=await saved(),restored=after.campaign.starships.find(s=>s.id===record.id).ship.warpState;
 assert.equal(restored.id,w.id);assert.deepEqual(restored.campaignDestination,w.campaignDestination);assert.equal(restored.traveledLY,w.traveledLY);assert.deepEqual(after.campaign.starmaps.positions[record.id],priorPos);assert.deepEqual(after.campaign.starships.find(s=>s.id===record.id).ship.warpFuel,priorFuel);
 const unlocked=await post('campaign/character/unlock',{code,characterId:nova.id,pcCode:nova.pcCode});
 const retry=await transit(start,unlocked.token);assert.equal(retry.result.duplicate,true);
 await post('campaign/time/pass',{code,token,amount:1,unit:'days',requestId:'after-restart-day'});
 const final=await saved();assert.deepEqual(final.campaign.starmaps.positions[record.id],{mapId:map.id,q:star.q,r:star.r});assert.equal(final.campaign.starmaps.warpVisits[record.id].length,1);assert.deepEqual(final.campaign.starships.find(s=>s.id===record.id).ship.warpFuel,priorFuel);
});
