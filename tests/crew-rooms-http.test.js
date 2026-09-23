const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events'),fixture=require('./helpers/crew-room-fixture.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('automatic Medbay pauses with ATB, persists through restart and never requests dice',{timeout:45000},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sa-crew-http-'));let child,base;
 async function launch(){child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.stdout.on('data',c=>{const u=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(u){clearTimeout(timer);resolve(u);}});});}
 async function stop(){if(child?.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}}t.after(stop);await launch();
 const post=async(route,body,status=200)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;};
 const demo=await post('campaign/showcase/start',{}),created=await post('campaign/create',{name:'Medical HTTP',gmCode:'medical-gm'},201),code=created.campaign.code;let token=created.token;
 const get=route=>fetch(base+'/api/'+route).then(r=>r.json()),state=()=>get(`state?room=${code}&token=${token}`),saved=()=>get(`campaign/backup?code=${code}&token=${token}`);
 const backup=await get(`campaign/backup?code=${demo.code}&token=${demo.gmToken}`),c=backup.campaign,f=fixture();c.code=code;c.name='Medical HTTP';c.showcase=false;
 const nova=c.characters[0],ship=c.starships.find(s=>s.title==='Wayfinder'),pilot=c.encounter.units.find(u=>u.characterId===nova.id),slug=c.encounter.units.find(u=>u.team==='npc');
 ship.ship=f.ship.ship;ship.ship.id=ship.id;ship.ship.crewRoomState={rooms:{med:{supplies:30,jobs:[],notes:[]}},down:{},receipts:[]};ship.ship.confirmed=structuredClone(ship.ship);
 const loc={...f.unit.location,starshipId:ship.id};ship.characterLocations={[nova.id]:loc};nova.character.health.current=10;
 Object.assign(pilot,{location:loc,currentHp:10,atb:100,speed:5,delayedAction:null,timedAction:null,delayTimer:null,consoleHold:null,pendingShipRolls:[],defeatedAt:null});Object.assign(slug,{atb:0,speed:.1,delayedAction:null,consoleHold:null});
 Object.assign(c.encounter.starships.find(s=>s.id===ship.id),structuredClone(ship),{currentHullHp:210,maximumHullHp:210});Object.assign(c.encounter,{hasEngagedClock:true,encounterEndedAt:null,activeId:pilot.id,pausedForTurn:true,hardPaused:true,running:false,resumeAfterTurn:true,commandRemaining:120,commandTotal:120});
 await post('campaign/restore',{code,token,backup});const pc=await post('campaign/character/unlock',{code,characterId:nova.id,pcCode:nova.pcCode});
 const act=(body,status=200)=>post('action',{roomCode:code,gmToken:token,...body},status);
 let s=await state();const ai=s.units.find(u=>u.shipAi);assert.ok(ai);assert.deepEqual(ai.dexterityDice,[6,6,6,6]);
 const pausedHp=s.units.find(u=>u.id===pilot.id).currentHp;await sleep(700);assert.equal((await state()).units.find(u=>u.id===pilot.id).currentHp,pausedHp);
 await act({action:'playerCombatAction',id:pilot.id,kind:'holdConsole'});await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});
 let deadline=Date.now()+6000;while(Date.now()<deadline){s=await state();if(s.units.find(u=>u.id===pilot.id).currentHp>pausedHp)break;await sleep(100);}
 assert.equal(s.units.find(u=>u.id===pilot.id).currentHp,pausedHp+1);assert.equal(s.crewRoomRolls.length,0);assert.equal(s.rollPaused,false);
 await act({action:'setHardPaused',paused:true});await sleep(400);const hp=s.units.find(u=>u.id===pilot.id).currentHp;
 await stop();await launch();token=(await post('campaign/open',{name:'Medical HTTP',gmCode:'medical-gm'})).token;s=await state();assert.equal(s.units.find(u=>u.id===pilot.id).currentHp,hp);assert.equal(s.crewRoomRolls.length,0);
 await act({action:'crewRoomResolve',jobId:'obsolete-job',stage:'healing',kind:'result',score:12},409);assert.equal((await state()).units.find(u=>u.id===pilot.id).currentHp,hp);
 await act({action:'setHardPaused',paused:true});s=await state();await act({action:'nudge',id:ai.id,amount:100-s.units.find(u=>u.id===ai.id).atb});assert.equal((await state()).activeId,ai.id);
 await act({action:'removeUnit',id:ai.id});s=await state();assert.equal(s.units.some(u=>u.id===ai.id),false);assert.notEqual(s.activeId,ai.id);assert.equal(s.starships.find(s=>s.id===ship.id).ship.crewRoomState.rooms.ai.enabled,false);
});
