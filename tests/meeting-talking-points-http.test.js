const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
const fixture=require('./helpers/crew-room-fixture.cjs');
test('Meeting talking points authorize, reject conflicts, retry and persist across restart',{timeout:40000},async t=>{
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

  await post('campaign/starship/link',{code,token,starship:f.ship.ship},201);await post('campaign/starship/crew',{code,token,starshipId:f.ship.id,crewCharacterIds:['pc']});
  pc=await post('campaign/character/unlock',{code,characterId:'pc',pcCode:'recreation-pc'});const outsider=await post('campaign/character/unlock',{code,characterId:'outsider',pcCode:'recreation-outsider'});
  const move=async id=>{f.seat(id);return post('campaign/starship/move-character',{code,token,starshipId:f.ship.id,characterId:'pc',...f.unit.location});};
  const room=(sicId,kind,extra={},expected=200)=>post('campaign/starship/crew-room',{code,token:pc.token,characterId:'pc',starshipId:f.ship.id,sicId,kind,requestId:require('node:crypto').randomUUID(),...extra},expected);
  await move('meeting');
  const request={points:['Topic one','<escaped>','','','Last'],expectedRevision:0,requestId:'meeting-http-save'};
  await room('meeting','talking-points',request);assert.equal((await room('meeting','talking-points',request)).result.duplicate,true);
  await room('meeting','talking-points',{...request,requestId:'meeting-http-stale'},409);
  await room('meeting','talking-points',{...request,token:outsider.token,characterId:'outsider'},403);
  assert.deepEqual((await room('meeting','inspect')).result.details.talkingPoints,request.points);
  await stop();await launch();token=(await post('campaign/open',{name:'Recreation HTTP',gmCode:'recreation-gm'})).token;pc=await post('campaign/character/unlock',{code,characterId:'pc',pcCode:'recreation-pc'});
  assert.deepEqual((await room('meeting','inspect')).result.details.talkingPoints,request.points);
  await room('meeting','talking-points',{points:['','','','',''],expectedRevision:1,requestId:'meeting-http-clear'});
  assert.deepEqual((await room('meeting','inspect')).result.details.talkingPoints,['','','','','']);
});