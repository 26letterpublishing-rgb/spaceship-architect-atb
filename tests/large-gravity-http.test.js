const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
test('Last Word and Menace with a planet and black hole remain responsive',{timeout:25000},async t=>{
 const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-gravity-http-'))},stdio:['ignore','pipe','pipe']});t.after(()=>child.kill());
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),8000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
 const post=async(p,b)=>{const r=await fetch(base+'/api/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b),signal:AbortSignal.timeout(8000)}),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;};
 const demo=await post('campaign/showcase/start',{}),code=demo.code,token=demo.gmToken;
 const saved=await fetch(base+`/api/campaign/backup?code=${code}&token=${token}`,{signal:AbortSignal.timeout(8000)}).then(r=>r.json()),c=saved.campaign;
 const ships=[require('../showcase-cleanser')(),require('../showcase-menace')()];
 const pc=c.characters[0],unit=c.encounter.units.find(u=>u.characterId===pc.id);ships[0].crewCharacterIds=[pc.id];
 c.starships=ships;await post('campaign/restore',{code,token,backup:saved});
 const act=b=>post('action',{roomCode:code,gmToken:token,...b});
 await act({action:'prepareEncounter',preparationId:'gravity-large-fixture',mode:'starship',starships:ships,shipPositions:ships.map((s,i)=>({id:s.id,q:i*25,r:0})),spaceObjects:[{id:'object-planet',kind:'planet',name:'Planet',quantity:1,q:10,r:2},{id:'object-blackhole',kind:'black-hole',name:'Hole',quantity:1,intensity:3,q:15,r:0}],units:[{team:'pc',characterId:pc.id,location:{...unit.location,starshipId:ships[0].id,square:ships[0].ship.gridCells[0]}}]});
 await act({action:'setRunning',running:true});
 await new Promise(r=>setTimeout(r,1300));
 const state=await fetch(base+`/api/state?room=${code}&token=${token}`,{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
 assert.equal(state.starships.length,2);assert.equal(state.spaceObjects.length,2);
 await act({action:'setRunning',running:false});
});
