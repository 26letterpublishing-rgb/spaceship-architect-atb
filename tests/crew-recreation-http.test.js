const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
const fixture=require('./helpers/crew-recreation-fixture.cjs');
test('crew rooms authorize occupants and GM records, persist on restart and wake safely after support failure',{timeout:40000},async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sa-recreation-http-'));let child,base;
  async function launch(){
    child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
    base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.stdout.on('data',chunk=>{const url=String(chunk).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
  }
  async function stop(){if(child?.exitCode===null){const done=once(child,'exit');child.kill();await done;}}
  t.after(stop);await launch();
  const post=async(route,body,status=200)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;};
  const get=route=>fetch(base+'/api/'+route).then(r=>r.json());
  const f=fixture(),created=await post('campaign/create',{name:'Recreation HTTP',gmCode:'recreation-gm'},201),code=created.campaign.code;let token=created.token,pc;
  for(const id of ['pc','outsider']){
    const character={...structuredClone(f.character.character),id,phase:'finalized',access:{pcCode:'recreation-'+id}};
    const request=await post('campaign/join/request',{code,character},201);await post('campaign/join/respond',{code,token,requestId:request.requestId,decision:'approve'});
  }
  f.ship.ship.sicInventory.find(i=>i.id==='brig').brigWidth=2;
  await post('campaign/starship/link',{code,token,starship:f.ship.ship},201);await post('campaign/starship/crew',{code,token,starshipId:f.ship.id,crewCharacterIds:['pc']});
  pc=await post('campaign/character/unlock',{code,characterId:'pc',pcCode:'recreation-pc'});const outsider=await post('campaign/character/unlock',{code,characterId:'outsider',pcCode:'recreation-outsider'});
  const move=async id=>{f.seat(id);return post('campaign/starship/move-character',{code,token,starshipId:f.ship.id,characterId:'pc',...f.unit.location});};
  const room=(sicId,kind,extra={},expected=200)=>post('campaign/starship/crew-room',{code,token:pc.token,characterId:'pc',starshipId:f.ship.id,sicId,kind,requestId:require('node:crypto').randomUUID(),...extra},expected);
  await move('bar');
  const requestId='bar-http-receipt';await room('bar','order',{text:'Amber Moon',requestId});assert.equal((await room('bar','order',{text:'Amber Moon',requestId})).result.duplicate,true);
  await room('bar','inspect',{token:outsider.token,characterId:'outsider'},403);
  let outside=await get(`campaign/state?code=${code}&token=${outsider.token}`);assert.ok(!JSON.stringify(outside).includes('Amber Moon'));
  await move('brig');await room('brig','intake',{title:'Captain Grey'},409);
  await room('brig','intake',{token,title:'Captain Grey',text:'Awaiting exchange.',requestId:'brig-http-receipt'});
  await room('brig','condition',{token,text:'Lock plate damaged.'});
  await move('sleep');await room('sleep','hibernate',{requestId:'hibernation-http-receipt'});
  await post('campaign/starship/move-character',{code,token:pc.token,starshipId:f.ship.id,characterId:'pc',square:106,mesh:4},409);
  const before=(await room('sleep','inspect')).result.details.hibernation;assert.equal(before.phase,'sleeping');
  await post('campaign/starship/save',{code,token,starship:f.ship.ship});
  await stop();await launch();token=(await post('campaign/open',{name:'Recreation HTTP',gmCode:'recreation-gm'})).token;pc=await post('campaign/character/unlock',{code,characterId:'pc',pcCode:'recreation-pc'});
  let info=(await room('sleep','inspect')).result;assert.equal(info.details.hibernation.phase,'sleeping');assert.ok(info.details.hibernation.activeSeconds>=before.activeSeconds);
  let backup=await get(`campaign/backup?code=${code}&token=${token}`),stored=backup.campaign.starships.find(s=>s.id===f.ship.id);
  assert.equal(stored.ship.crewRoomState.rooms.bar.orders.length,1);assert.equal(stored.ship.crewRoomState.rooms.brig.prisoners[0].name,'Captain Grey');assert.equal(stored.ship.crewRoomState.rooms.brig.condition,'Lock plate damaged.');assert.equal(stored.ship.sicInventory.find(i=>i.id==='brig').brigWidth,2);
  stored.ship.placements=stored.ship.placements.filter(p=>p.sicId!=='life');await post('campaign/starship/save',{code,token,starship:stored.ship});
  info=(await room('sleep','inspect')).result;assert.equal(info.details.hibernation.phase,'awake');assert.match(info.details.hibernation.wakeReason,/Life Support/);
  await stop();await launch();token=(await post('campaign/open',{name:'Recreation HTTP',gmCode:'recreation-gm'})).token;
  backup=await get(`campaign/backup?code=${code}&token=${token}`);assert.equal(backup.campaign.starships[0].ship.crewRoomState.rooms.sleep.hibernation.phase,'awake');assert.ok(backup.campaign.privateNotes.some(n=>/awakened.*Life Support/.test(n.message)));
  const invalid=structuredClone(backup.campaign.starships[0].ship);invalid.sicInventory.find(i=>i.id==='brig').brigWidth=60;await post('campaign/starship/save',{code,token,starship:invalid},400);
});
