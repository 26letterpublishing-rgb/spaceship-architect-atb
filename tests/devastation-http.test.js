const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
test('out-of-combat charge authorizes crew, advances with GM time, persists through restart and enters combat ready',{timeout:35000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sa-dev-http-'));let child,base;
 async function start(){child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});}
 async function stop(){if(child?.exitCode===null){const done=once(child,'exit');child.kill();await done;}}t.after(stop);await start();
 const post=async(p,b,status=200)=>{const r=await fetch(base+'/api/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;},get=p=>fetch(base+'/api/'+p).then(r=>r.json());
 const f=require('./helpers/devastation-fixture.cjs')(),created=await post('campaign/create',{name:'Devastation HTTP',gmCode:'dev-http'},201),code=created.campaign.code;let token=created.token;
 const ch=require('./helpers/crew-room-fixture.cjs')().character.character;
 const req=await post('campaign/join/request',{code,character:{...ch,id:'pc',phase:'finalized',access:{pcCode:'dev-pc'}}},201);await post('campaign/join/respond',{code,token,requestId:req.requestId,decision:'approve'});
 await post('campaign/starship/link',{code,token,starship:f.ship.ship},201);await post('campaign/starship/crew',{code,token,starshipId:f.ship.id,crewCharacterIds:['pc']});let pc=await post('campaign/character/unlock',{code,characterId:'pc',pcCode:'dev-pc'});
 await post('campaign/starship/move-character',{code,token,starshipId:f.ship.id,characterId:'pc',...f.unit.location});
 const body={code,token:pc.token,characterId:'pc',starshipId:f.ship.id,sicId:'gun',kind:'devastation-charge',receipt:'http-charge-0001'};
 let result=await post('campaign/starship/utility',body);assert.equal(result.campaign.starships[0].ship.devastationState.systems.gun.phase,'charging');
 await post('campaign/starship/utility',{...body,characterId:'someone-else'},403);
 result=await post('campaign/starship/utility',body);assert.equal(result.starship.ship.devastationState.systems.gun.phase,'charging');
 await post('campaign/time/pass',{code,token,amount:1,unit:'minutes',requestId:'time-dev-0001'});
 let campaign=await get(`campaign/state?code=${code}&token=${token}`);assert.equal(campaign.starships[0].ship.devastationState.systems.gun.phase,'ready');
 const stale=structuredClone(campaign.starships[0].ship);delete stale.devastationState;await post('campaign/starship/save',{code,token,starship:stale});
 await stop();await start();token=(await post('campaign/open',{name:'Devastation HTTP',gmCode:'dev-http'})).token;campaign=await get(`campaign/state?code=${code}&token=${token}`);assert.equal(campaign.starships[0].ship.devastationState.systems.gun.phase,'ready');
 const combat=await post('action',{roomCode:code,gmToken:token,action:'syncEncounterStarships',starships:campaign.starships});assert.equal(combat.starships[0].ship.devastationState.systems.gun.phase,'ready');
 const staleShips=structuredClone(campaign.starships);delete staleShips[0].ship.devastationState;const prepared=await post('action',{roomCode:code,gmToken:token,action:'prepareEncounter',preparationId:'dev-prepare-0001',mode:'starship',starships:staleShips,shipPositions:[{id:f.ship.id,q:0,r:0}],spaceObjects:[],units:[{team:'pc',characterId:'pc',location:f.unit.location}]});assert.equal(prepared.starships[0].ship.devastationState.systems.gun.phase,'ready');
});
