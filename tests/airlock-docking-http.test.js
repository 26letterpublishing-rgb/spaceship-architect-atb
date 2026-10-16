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
