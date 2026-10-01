const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('solo exploration clock, authenticated Cleanser, cinematic freeze and persisted aftermath',{timeout:35000},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sa-cleanser-http-'));let child,base;
 async function start(){child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});}
 async function stop(){if(child?.exitCode===null){const done=once(child,'exit');child.kill();await done;}}t.after(stop);await start();
 const post=async(route,body,status=200)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};
 const demo=await post('campaign/showcase/start',{}),created=await post('campaign/create',{name:'Cleanser test',gmCode:'cleanser-test'},201),code=created.campaign.code;let token=created.token;
 const get=p=>fetch(base+'/api/'+p).then(r=>r.json()),state=()=>get(`state?room=${code}&token=${token}`),backup=()=>get(`campaign/backup?code=${code}&token=${token}`),act=body=>post('action',{roomCode:code,gmToken:token,...body});
 const saved=await get(`campaign/backup?code=${demo.code}&token=${demo.gmToken}`),c=saved.campaign,ship=require('../showcase-cleanser')(),person=c.characters[0],pilot=c.encounter.units.find(u=>u.characterId===person.id);
 Object.assign(c,{code,name:'Cleanser test',showcase:false,starships:[ship]});ship.crewCharacterIds=[person.id];ship.characterLocations={[person.id]:{starshipId:ship.id,sicId:ship.id+'-bridge',square:141,mesh:0,stationed:true}};
 Object.assign(pilot,{location:ship.characterLocations[person.id],atb:100,speed:.1,currentHp:30,defeatedAt:null,delayedAction:null,delayTimer:null,timedAction:null,consoleHold:null,pendingShipRolls:[]});
 Object.assign(c.encounter,{starships:[structuredClone(ship)],units:[pilot],shipPositions:[{id:ship.id,q:0,r:0}],spaceObjects:[{id:'object-planet',name:'Vesper',kind:'planet',variant:'ice',quantity:1,q:5,r:0}],hasEngagedClock:true,encounterEndedAt:null,activeId:pilot.id,pausedForTurn:true,running:false,hardPaused:true,resumeAfterTurn:true,commandRemaining:120,commandTotal:120});
 await post('campaign/restore',{code,token,backup:saved});const pc=await post('campaign/character/unlock',{code,characterId:person.id,pcCode:person.pcCode});
 const charge={action:'utilityCommand',id:pilot.id,starshipId:ship.id,sicId:ship.id+'-cleanser',kind:'cleanser-charge',targetId:'object-planet',receipt:'cleanser-http-charge'};
 await post('action',{roomCode:code,characterToken:'invalid',characterId:person.id,...charge},403);
 let s=await act(charge);assert.equal(s.starships[0].ship.cleanserState.remaining,120);await act(charge);assert.equal((await state()).starships[0].ship.minerals['Dark Phaeon'],2);
 await sleep(400);assert.equal((await state()).starships[0].ship.cleanserState.remaining,120);
 await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});await sleep(500);s=await state();assert.ok(s.starships[0].ship.cleanserState.remaining<120);assert.ok(s.units[0].atb>0);assert.equal(s.units.length,1);
 await act({action:'setHardPaused',paused:true});let edit=await backup();edit.campaign.encounter.starships[0].ship.cleanserState.remaining=.1;await post('campaign/restore',{code,token,backup:edit});await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});await sleep(500);
 s=await state();assert.equal(s.planetaryEvent.phase,'awaitingRoll');assert.equal(s.planetaryEvent.damage,undefined);
 const eventId=s.planetaryEvent.id,damageStep=kind=>({action:'cleanserDamage',id:pilot.id,eventId,kind});
 await post('action',{roomCode:code,characterId:person.id,characterToken:'wrong',...damageStep('roll')},403);
 await post('action',{roomCode:code,characterId:person.id,characterToken:pc.token,...damageStep('confirm')},409);
 s=await post('action',{roomCode:code,characterId:person.id,characterToken:pc.token,...damageStep('roll')});const rolled=s.planetaryEvent.damage;
 await post('action',{roomCode:code,characterId:person.id,characterToken:pc.token,...damageStep('roll')});assert.equal((await state()).planetaryEvent.damage,rolled);
 await act(damageStep('takeover'));
 await post('action',{roomCode:code,characterId:person.id,characterToken:pc.token,...damageStep('shown')},409);
 await act(damageStep('shown'));s=await act(damageStep('confirm'));assert.equal(s.planetaryEvent.phase,'firing');assert.equal(s.planetaryEvent.cinematicVersion,3);assert.equal(s.planetaryEvent.endsAt-s.planetaryEvent.startedAt,require('../ship-cleanser').CINEMATIC);assert.equal(s.rollPaused,true);const atb=s.units[0].atb,damage=s.planetaryEvent.damage;await sleep(450);assert.equal((await state()).units[0].atb,atb);
 const clip=await fetch(base+'/cleanser-zup.mp3');assert.equal(clip.status,200);assert.deepEqual(Buffer.from(await clip.arrayBuffer()),fs.readFileSync(path.resolve(__dirname,'../cleanser-zup.mp3')));
 const visible=await get(`state?room=${code}&token=${pc.token}`);assert.equal(visible.planetaryEvent.damage,damage);
 await post('action',{roomCode:code,gmToken:token,action:'setRunning',running:true},409);
 edit=await backup();edit.campaign.encounter.planetaryEvent.endsAt=Date.now()-1;await post('campaign/restore',{code,token,backup:edit});await sleep(500);s=await state();assert.equal(s.planetaryEvent.phase,'complete');assert.ok(s.spaceObjects[0].destroyedAt);assert.equal(s.starships[0].currentHullHp,198);assert.equal(s.rollPaused,false);
 // Victory acknowledgment preserves this same exploration clock and scenery.
 edit=await backup();edit.campaign.encounter.starships[0].victoryAt=new Date().toISOString();await post('campaign/restore',{code,token,backup:edit});await act({action:'acknowledgeVictory'});assert.equal((await state()).encounterEndedAt,null);
 await sleep(450);await stop();await start();token=(await post('campaign/open',{name:'Cleanser test',gmCode:'cleanser-test'})).token;s=await state();assert.ok(s.spaceObjects[0].destroyedAt);assert.equal(s.planetaryEvent.damage,damage);assert.equal(s.starships[0].ship.minerals['Dark Phaeon'],2);
});
