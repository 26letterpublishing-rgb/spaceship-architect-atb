const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events'),fixture=require('./helpers/crew-room-fixture.cjs');
test('GM Library delivery is private, durable, retry-safe, and survives live combat saves',{timeout:35000},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sa-library-http-'));let child,base;
 async function launch(){child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.stdout.on('data',c=>{const u=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(u){clearTimeout(timer);resolve(u);}});});}
 async function stop(){if(child?.exitCode===null){const done=once(child,'exit');child.kill();await done;}}t.after(stop);await launch();
 const post=async(route,body,status)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.ok(status?r.status===status:r.ok,JSON.stringify(d));return d;},get=route=>fetch(base+'/api/'+route).then(r=>r.json());
 const f=fixture(),created=await post('campaign/create',{name:'Library HTTP',gmCode:'library-gm'}),code=created.campaign.code;let token=created.token;
 for(const id of ['pc','offline','outsider']){const character={...structuredClone(f.character.character),id,phase:'finalized',access:{pcCode:'library-'+id}};const joined=await post('campaign/join/request',{code,character});await post('campaign/join/respond',{code,token,requestId:joined.requestId,decision:'approve'});}
 await post('campaign/starship/link',{code,token,starship:f.ship.ship});await post('campaign/starship/crew',{code,token,starshipId:f.ship.id,crewCharacterIds:['pc','offline']});
 const player=await post('campaign/character/unlock',{code,characterId:'pc',pcCode:'library-pc'}),outsider=await post('campaign/character/unlock',{code,characterId:'outsider',pcCode:'library-outsider'});
 const body={code,starshipId:f.ship.id,sicId:'library',requestId:'http-library-entry-1',title:'Colony Report',text:'The colony is abandoned.\n\nA beacon still repeats its last message.'};
 await post('campaign/starship/library-entry',{...body,token:player.token},403);await post('campaign/starship/library-entry',{...body,token:''},403);
 let result=await post('campaign/starship/library-entry',{...body,token});assert.equal(result.result.notified,2);assert.equal(result.campaign.libraryTargets.length,1);
 const privateState=await get(`campaign/state?code=${code}&token=${player.token}`),otherState=await get(`campaign/state?code=${code}&token=${outsider.token}`);
 assert.equal(privateState.libraryTargets,undefined);assert.match(privateState.characters.find(c=>c.id==='pc').privateNotes.at(-1).message,/Library has been updated/);assert.ok(!JSON.stringify(otherState).includes(body.text));assert.ok(!JSON.stringify(otherState).includes('Library has been updated'));
 await post('campaign/starship/crew-room',{code,token:player.token,characterId:'pc',starshipId:f.ship.id,sicId:'library',kind:'inspect'},409);
 // A stale builder save must not erase server-owned entries or receipts.
 await post('campaign/starship/save',{code,token,starship:f.ship.ship});
 let backup=await get(`campaign/backup?code=${code}&token=${token}`);assert.equal(backup.campaign.starships[0].ship.crewRoomState.rooms.library.notes.length,1);
 const demo=await post('campaign/showcase/start',{}),sample=await get(`campaign/backup?code=${demo.code}&token=${demo.gmToken}`),own=backup.campaign.starships[0],encounter=structuredClone(sample.campaign.encounter),pilot=encounter.units.find(u=>u.team==='pc');
 f.seat('library');Object.assign(pilot,{characterId:'pc',characterName:'Tester',location:{...f.unit.location},atb:100,delayedAction:null,timedAction:null,pendingShipRolls:[],consoleHold:null});
 encounter.units=[pilot];encounter.starships=[{...structuredClone(own),currentHullHp:210,maximumHullHp:210}];encounter.shipPositions=[{id:own.id,q:0,r:0}];Object.assign(encounter,{hasEngagedClock:true,encounterEndedAt:null,activeId:pilot.id,pausedForTurn:true,hardPaused:true,running:false,commandRemaining:90,commandTotal:90});backup.campaign.encounter=encounter;
 await post('campaign/restore',{code,token,backup});const state=()=>get(`state?room=${code}&token=${token}`),before=await state();
 result=await post('campaign/starship/library-entry',{...body,token,requestId:'http-library-combat',title:'Combat Intel'});assert.equal(result.result.notified,2);
 const after=await state();assert.equal(after.hardPaused,before.hardPaused);assert.equal(after.activeId,before.activeId);assert.deepEqual(after.units.map(u=>u.atb),before.units.map(u=>u.atb));assert.equal(after.starships[0].ship.crewRoomState.rooms.library.notes.length,2);
 await new Promise(r=>setTimeout(r,300));await stop();await launch();token=(await post('campaign/open',{name:'Library HTTP',gmCode:'library-gm'})).token;
 result=await post('campaign/starship/library-entry',{...body,token,requestId:'http-library-combat',title:'Combat Intel'});assert.equal(result.result.duplicate,true);
 backup=await get(`campaign/backup?code=${code}&token=${token}`);assert.equal(backup.campaign.starships[0].ship.crewRoomState.rooms.library.notes.length,2);assert.equal(backup.campaign.privateNotes.filter(n=>n.message.startsWith('Library has been updated')).length,4);assert.equal((await state()).starships[0].ship.crewRoomState.rooms.library.notes.length,2);
});
