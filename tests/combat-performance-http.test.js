const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),{once}=require('node:events'),wire=require('../combat-wire');
test('cached assets, private incremental streams and GM-owned damage pause', {timeout:30000},async t=>{
  const root=path.resolve(__dirname,'..'),child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-perf-http-'))},windowsHide:true,stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){const exit=once(child,'exit');child.kill();await exit;}});
  const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),8000);child.stdout.on('data',c=>{const m=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});child.on('error',reject);});
  const asset=await fetch(base+'/app.js');assert.equal(asset.status,200);assert.match(asset.headers.get('cache-control'),/no-cache/);assert.equal(asset.headers.get('content-encoding'),'gzip');const text=await asset.text();assert.ok(Number(asset.headers.get('content-length'))<text.length*.4);
  const unchanged=await fetch(base+'/app.js',{headers:{'If-None-Match':asset.headers.get('etag')}});assert.equal(unchanged.status,304);assert.equal(await unchanged.text(),'');
  assert.equal((await fetch(base+'/static-response.js')).status,404);
  const post=async(route,body,status=200)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;};
  const room=await post('/api/campaign/showcase/start',{}),act=body=>post('/api/action',{roomCode:room.code,gmToken:room.gmToken,...body}),state=()=>fetch(base+`/api/state?room=${room.code}&token=${room.gmToken}`).then(r=>r.json());
  let s=await state();const nova=s.units.find(u=>u.characterName==='Nova Vale'),slug=s.units.find(u=>u.characterName==='Space Slug'),ship=s.starships.find(s=>s.id===nova.location.starshipId),target=s.starships.find(s=>s.id!==ship.id),cp=ship.ship.placements.find(p=>ship.ship.sicInventory.find(i=>i.id===p.sicId)?.type==='bridge-1'),gun=ship.ship.sicInventory.find(i=>i.type==='rapid-laser-5');
  s=await act({action:'addUnit',characterName:'Second PC',team:'pc',controlledBy:'gm',speed:1,commandWindow:30,location:{starshipId:ship.id,square:ship.ship.gridCells[0],mesh:8}});const second=s.units.find(u=>u.characterName==='Second PC');
  await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});await act({action:'setHardPaused',paused:true});await act({action:'setCombatLocation',id:nova.id,location:{starshipId:ship.id,square:cp.cell,mesh:0}});await act({action:'nudge',id:nova.id,amount:100});
  s=await act({action:'weaponCommand',id:nova.id,sicId:gun.id,targetId:target.id,requestId:'gm-owned-laser'});let pending=s.units.find(u=>u.id===nova.id).delayedAction;assert.equal(pending.rollController,'gm');assert.equal(s.rollPaused,true);
  const player=room.players.find(p=>p.id===nova.characterId);
  const campaignView=await fetch(base+`/api/campaign/state?code=${room.code}&token=${player.token}`).then(r=>r.json());
  assert.equal(campaignView.combatActive,true);
  assert.equal(campaignView.starships.find(s=>s.id===ship.id).characterLocations[player.id].square,cp.cell);
  assert.equal(campaignView.starships.find(s=>s.id===ship.id).characterLocations[player.id].mesh,0);
  await post('/api/campaign/starship/move-character',{code:room.code,token:player.token,starshipId:ship.id,characterId:player.id,square:cp.cell,mesh:1},409);
  await post('/api/action',{roomCode:room.code,characterId:player.id,characterToken:player.token,action:'rollShipAction',id:nova.id,rollId:pending.id,score:100},403);
  await act({action:'rollShipAction',id:nova.id,rollId:pending.id,score:100});
  s=await state();assert.match(s.units.find(u=>u.id===nova.id).actionResults.at(-1).text,/Operating the console/);
  assert.equal(s.units.find(u=>u.id===nova.id).actionResults.at(-1).controller,'gm');
  for(let i=0;i<35;i++){s=await act({action:'step'});if(s.units.find(u=>u.id===nova.id).delayedAction?.weaponDamage)break;}
  pending=s.units.find(u=>u.id===nova.id).delayedAction;assert.ok(pending.weaponDamage);assert.equal(pending.rollController,'gm');assert.equal(s.rollPaused,true);
  await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});await act({action:'nudge',id:second.id,amount:100});
  const before=await state();assert.ok(before.command?.remaining>20,'Another PC has a real decision timer');await new Promise(r=>setTimeout(r,900));s=await state();assert.deepEqual(s.units.map(u=>u.atb),before.units.map(u=>u.atb));assert.ok(Math.abs(s.command.remaining-before.command.remaining)<.2,'Decision timer freezes during damage');
  const controller=new AbortController();t.after(()=>controller.abort());const response=await fetch(base+`/events?delta=1&room=${room.code}&token=${player.token}`,{signal:controller.signal}),reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',snapshot=null,fullBytes=0,deltaBytes=0;
  while(!deltaBytes){const {value}=await reader.read();buffer+=decoder.decode(value,{stream:true});let split;while((split=buffer.indexOf('\n\n'))>=0){const message=buffer.slice(0,split);buffer=buffer.slice(split+2);if(!message.includes('data: '))continue;const data=JSON.parse(message.split('data: ')[1]);if(message.startsWith('event: state\n')){snapshot=data;fullBytes=message.length;}else if(message.startsWith('event: state-delta')){snapshot=wire.apply(snapshot,data);deltaBytes=message.length;}}}
  assert.ok(deltaBytes<fullBytes*.2,`${deltaBytes}/${fullBytes} delta bytes`);assert.ok(!snapshot.units.some(u=>u.characterName==='Space Slug'));assert.equal(snapshot.starships.find(s=>s.id===target.id)?.ship?.placements?.length||0,0);controller.abort();
  await act({action:'rollShipAction',id:nova.id,rollId:pending.id,diceResults:[4,4,4,4]});s=await state();assert.equal(s.rollPaused,false);assert.equal(s.units.find(u=>u.id===nova.id).delayedAction,null);
  assert.match(s.units.find(u=>u.id===nova.id).actionResults.at(-1).text,/Damage confirmed: 16/);
  const privateView=await fetch(base+`/api/state?room=${room.code}&token=${player.token}`).then(r=>r.json());
  assert.deepEqual(privateView.units.find(u=>u.id===nova.id).actionResults,[],'GM-owned result notices do not leak into the player stream');
  const locationAbort=new AbortController();t.after(()=>locationAbort.abort());
  const locationStream=await fetch(base+`/campaign-events?code=${room.code}&token=${player.token}`,{signal:locationAbort.signal});
  const locationReader=locationStream.body.getReader();let locationBuffer='',locationPacket=null;
  await act({action:'setCombatLocation',id:nova.id,location:{starshipId:ship.id,square:cp.cell,mesh:1}});
  while(!locationPacket){
    const {value}=await locationReader.read();locationBuffer+=new TextDecoder().decode(value);let end;
    while((end=locationBuffer.indexOf('\n\n'))>=0){const event=locationBuffer.slice(0,end);locationBuffer=locationBuffer.slice(end+2);if(event.startsWith('event: encounter-locations\n'))locationPacket=JSON.parse(event.split('data: ')[1]);}
  }
  assert.equal(locationPacket.units.find(u=>u.characterId===player.id).location.mesh,1);
  assert.ok(!locationPacket.units.some(u=>u.location.starshipId===target.id),'Campaign position event excludes NPC ship crew');
  assert.ok(JSON.stringify(locationPacket).length<2000,'Position-only update stays small');locationAbort.abort();
  await act({action:'exitEncounter'});
  const moved=await post('/api/campaign/starship/move-character',{code:room.code,token:player.token,starshipId:ship.id,characterId:player.id,square:cp.cell,mesh:2});
  assert.equal(moved.campaign.starships.find(s=>s.id===ship.id).characterLocations[player.id].mesh,2,'Saved out-of-combat movement is not overwritten by an old encounter');
  console.log(`Combat payload: ${fullBytes} initial bytes, ${deltaBytes} incremental bytes.`);
});
