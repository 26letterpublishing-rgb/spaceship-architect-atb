const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events'),maps=require('../ship-map-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('live hacking persists private puzzles and retry receipts across a real restart, without exporting secrets',{timeout:20000},async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sa-hack-persist-'));
  let child,base;
  async function launch(){child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});child.stderr.on('data',c=>process.stderr.write(c));base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timed out')),8000);child.stdout.on('data',c=>{const u=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(u){clearTimeout(timer);resolve(u);}});});}
  async function stop(){if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}}
  t.after(stop);await launch();
  const post=async(route,body,status=200)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};
  const start=await post('campaign/showcase/start',{});await require('./helpers/combat-demo.cjs')(base,start);const template=await fetch(`${base}/api/campaign/backup?code=${start.code}&token=${start.gmToken}`).then(r=>r.json());
  const created=await post('campaign/create',{name:'Hacking Persistence',gmCode:'private-hack-test'},201),code=created.campaign.code;let token=created.token;
  const encounter=template.campaign.encounter,source=encounter.starships.find(s=>s.id==='showcase-pc-ship'),target=encounter.starships.find(s=>s.id==='showcase-npc-ship');
  const layout=maps.buildLayout(source.ship),cols=maps.gridColumns(source.ship),cell=source.ship.gridCells.find(n=>!layout.footprint.has(n)&&source.ship.gridCells.includes(n+cols)&&!layout.footprint.has(n+cols));
  source.ship.sicInventory.push({id:'persist-hack',type:'hacking-module-5'});source.ship.placements.push({sicId:'persist-hack',cell});
  source.sensorState={contacts:{[target.id]:{id:target.id,level:'detected',title:target.title,position:{q:2,r:0}}},analyses:{[target.id]:{targetId:target.id,analysis:true,layout:structuredClone(target.ship)}},reports:[],receipts:[],failures:{}};
  const nova=encounter.units.find(u=>u.team==='pc'),bridge=source.ship.sicInventory.find(i=>maps.definition(i.type).bridge),bridgeCell=[...maps.buildLayout(source.ship).footprint].find(([,c])=>c.sicId===bridge.id&&c.stations.some(s=>s.x===c.column&&s.y===c.row));
  Object.assign(nova,{hackingSkill:4,atb:100,turnSerial:4,location:{starshipId:source.id,sicId:bridge.id,square:bridgeCell[0],mesh:bridgeCell[1].stations.find(s=>s.x===bridgeCell[1].column&&s.y===bridgeCell[1].row).mesh,stationed:true}});
  Object.assign(encounter,{hasEngagedClock:true,encounterEndedAt:null,hardPaused:true,activeId:nova.id,shipPositions:[{id:source.id,q:0,r:0},{id:target.id,q:2,r:0}]});
  template.campaign.code=code;template.campaign.name='Hacking Persistence';template.campaign.showcase=false;
  await post('campaign/restore',{code,token,backup:template});
  const act=body=>post('action',{roomCode:code,gmToken:token,...body}),get=()=>fetch(`${base}/api/state?room=${code}&token=${token}`).then(r=>r.json());
  const targetSic=target.ship.sicInventory.find(i=>maps.definition(i.type).sensor).id;
  let s=await act({action:'hackingCommand',id:nova.id,kind:'open',sicId:'persist-hack',targetId:target.id,targetSicId:targetSic,requestId:'persist-open-1'}),board=s.units.find(u=>u.id===nova.id).hackingSessions[0];assert.equal(board.length,1);
  const body={action:'hackingCommand',id:nova.id,kind:'guess',sessionId:board.id,guess:[board.candidates[0]],turnSerial:s.units.find(u=>u.id===nova.id).turnSerial,requestId:'persist-solve-1'};
  s=await act(body);assert.equal(s.units.find(u=>u.id===nova.id).hackingSessions[0].control,true);
  for(const field of ['hackingPrivate','password','decoys','secretId'])assert.ok(!JSON.stringify(s).includes(`"${field}"`));
  const backup=await fetch(`${base}/api/campaign/backup?code=${code}&token=${token}`).then(r=>r.json());assert.equal(backup.campaign.encounter.hackingPrivate,undefined);
  assert.equal((await fetch(base+'/ship-hacking.js')).status,404);await sleep(350);await stop();await launch();
  const reopened=await post('campaign/open',{name:'Hacking Persistence',gmCode:'private-hack-test'});token=reopened.token;
  s=await get();board=s.units.find(u=>u.id===nova.id).hackingSessions[0];assert.equal(board.control,true);assert.equal(board.history.length,1);
  s=await act(body);assert.equal(s.units.find(u=>u.id===nova.id).hackingSessions[0].history.length,1,'retry after restart must not spend twice');assert.equal(s.hardPaused,true);
});
