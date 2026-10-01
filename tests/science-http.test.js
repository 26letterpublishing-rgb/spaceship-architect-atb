const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
test('fabrication and blueprint inventory survive preparation and finish in combat',{timeout:35000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sa-science-http-'));let child,base;
 async function start(){child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});}
 async function stop(){if(child?.exitCode===null){const done=once(child,'exit');child.kill();await done;}}t.after(stop);await start();
 const post=async(p,b,status=200)=>{const r=await fetch(base+'/api/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;},get=p=>fetch(base+'/api/'+p).then(r=>r.json());
 const f=require('./helpers/science-fixture.cjs')(),created=await post('campaign/create',{name:'Science HTTP',gmCode:'science-http'},201),code=created.campaign.code,token=created.token;
 const ch=f.character.character;
 const req=await post('campaign/join/request',{code,character:{...ch,id:'pc',phase:'finalized',access:{pcCode:'science-pc'}}},201);await post('campaign/join/respond',{code,token,requestId:req.requestId,decision:'approve'});
 await post('campaign/starship/link',{code,token,starship:f.ship.ship},201);await post('campaign/starship/crew',{code,token,starshipId:f.ship.id,crewCharacterIds:['pc']});
 await post('campaign/starship/move-character',{code,token,starshipId:f.ship.id,characterId:'pc',...f.unit.location});
 await post('campaign/starship/crew-room',{code,token,characterId:'pc',starshipId:f.ship.id,sicId:'vr',machineId:'printer',recipeType:'sensors-7',kind:'fabricate-add',requestId:'science-http-001'});
 await post('campaign/time/pass',{code,token,amount:6,unit:'days',requestId:'science-http-time'});
 const campaign=await get(`campaign/state?code=${code}&token=${token}`),stale=structuredClone(campaign.starships);delete stale[0].ship.fabricationState;
 const prepared=await post('action',{roomCode:code,gmToken:token,action:'prepareEncounter',preparationId:'science-prepare-001',mode:'starship',starships:stale,shipPositions:[{id:f.ship.id,q:0,r:0}],spaceObjects:[],units:[{team:'pc',characterId:'pc',location:f.unit.location}]});
 const ship=prepared.starships[0];assert.ok(ship.ship.sicInventory.some(i=>i.type==='blueprint'&&i.blueprintType==='sensors-7'));assert.ok(ship.ship.fabricationState.systems.printer.queue[0].remaining<=86400);
 await post('campaign/time/pass',{code,token,amount:1,unit:'days',requestId:'science-http-done'});
 const saved=await get(`campaign/state?code=${code}&token=${token}`);assert.equal(saved.starships[0].ship.sicInventory.filter(i=>i.printed&&i.type==='sensors-7').length,1);
});
