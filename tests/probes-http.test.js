const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('probe scan uses the shared authenticated dice flow, pauses flight, retains state through restart and rejects foreign commands',{timeout:30000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sa-probes-http-'));let child,base;
 async function start(){child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timeout);resolve(url);}});});}
 async function stop(){if(child?.exitCode===null){const done=once(child,'exit');child.kill();await done;}}t.after(stop);await start();
 const post=async(route,body,status=200)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};
 const demo=await post('campaign/showcase/start',{}),created=await post('campaign/create',{name:'Probe HTTP',gmCode:'probe-http'},201),code=created.campaign.code;let token=created.token;
 const saved=await fetch(base+`/api/campaign/backup?code=${demo.code}&token=${demo.gmToken}`).then(r=>r.json()),c=saved.campaign,f=require('./helpers/crew-room-fixture.cjs')(),s=f.ship.ship;
 c.code=code;c.name='Probe HTTP';c.showcase=false;s.sicInventory.push({id:'launcher',type:'probe-launcher'},{id:'sensor',type:'sensors-3'},{id:'probe',type:'probe-5',attachTo:'launcher'});s.placements.push({sicId:'launcher',cell:33},{sicId:'sensor',cell:111},{sicId:'probe',cell:33});f.seat('bridge');
 const source=c.starships.find(s=>s.id==='showcase-pc-ship'),target=c.starships.find(s=>s.id==='showcase-npc-ship'),person=c.characters[0],unit=c.encounter.units.find(u=>u.characterId===person.id);
 source.ship=structuredClone(s);source.ship.id=source.id;source.ship.confirmed=structuredClone(source.ship);source.characterLocations={[person.id]:{environment:'starship',...f.unit.location,starshipId:source.id}};source.crewCharacterIds=[person.id];
 Object.assign(unit,{location:source.characterLocations[person.id],atb:100,speed:.1,currentHp:30,delayedAction:null,timedAction:null,delayTimer:null,consoleHold:null,pendingShipRolls:[],defeatedAt:null});
 Object.assign(c.encounter,{starships:[{...structuredClone(source),currentHullHp:200,maximumHullHp:210},target],shipPositions:[{id:source.id,q:0,r:0},{id:target.id,q:25,r:0}],hasEngagedClock:true,encounterEndedAt:null,activeId:unit.id,pausedForTurn:true,running:false,hardPaused:true,resumeAfterTurn:true,commandRemaining:120,commandTotal:120});
 require('../ship-probes').reconcile(c.encounter);const probe=c.encounter.starships[0].ship.probeState.probes.probe;probe.phase='flying';probe.position={q:1,r:0};probe.destination={q:8,r:0};
 await post('campaign/restore',{code,token,backup:saved});const pc=await post('campaign/character/unlock',{code,characterId:person.id,pcCode:person.pcCode}),act=b=>post('action',{roomCode:code,gmToken:token,...b}),state=(auth=token)=>fetch(base+`/api/state?room=${code}&token=${auth}`).then(r=>r.json());
 let live=await act({action:'utilityCommand',id:unit.id,sicId:'launcher',kind:'scan',probeId:probe.id,receipt:'http-probe-scan'}),pending=live.units.find(u=>u.id===unit.id).delayedAction;
 assert.equal(pending.awaitingRoll,true);assert.deepEqual(pending.rollSpec.sides,[12,12,12,12]);assert.equal(pending.rollController,'gm');assert.equal(live.rollPaused,true);
 await sleep(300);assert.equal((await state()).starships.find(s=>s.id===source.id).ship.probeState.probes.probe.position.q,1);
 await post('action',{roomCode:code,characterId:person.id,characterToken:pc.token,action:'rollShipAction',id:unit.id,rollId:pending.id,diceResults:[12,12,12,12]},403);
 await post('action',{roomCode:code,gmToken:token,action:'rollShipAction',id:unit.id,rollId:pending.id,diceResults:[8,8]},400);
 await sleep(350);await stop();await start();token=(await post('campaign/open',{name:'Probe HTTP',gmCode:'probe-http'})).token;live=await state();assert.equal(live.units.find(u=>u.id===unit.id).delayedAction.id,pending.id);assert.equal(live.starships.find(s=>s.id===source.id).ship.probeState.probes.probe.id,probe.id);
 await act({action:'rollShipAction',id:unit.id,rollId:pending.id,diceResults:[12,12,12,12]});await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});
 for(let i=0;i<70;i++){live=await state();if(!live.units.find(u=>u.id===unit.id).delayedAction)break;await sleep(100);}
 assert.equal(live.units.find(u=>u.id===unit.id).delayedAction,null);assert.match(live.starships.find(s=>s.id===source.id).ship.probeState.reports[0].text,/scan:/);
 const npc=live.units.find(u=>u.team==='npc'&&u.location?.starshipId===target.id);assert.ok(npc);await post('action',{roomCode:code,gmToken:token,action:'utilityCommand',id:npc.id,sicId:'launcher',kind:'return',probeId:probe.id,receipt:'foreign-probe-command'},409);
});
