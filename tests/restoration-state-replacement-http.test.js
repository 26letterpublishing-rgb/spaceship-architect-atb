const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),{spawn}=require('node:child_process'),{once}=require('node:events');
const wire=require('../combat-wire'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('obsolete rooms cannot publish or cancel current room persistence',()=>{
 const source=fs.readFileSync(require.resolve('../server.js'),'utf8'),old={roomCode:'TEST'},current={roomCode:'TEST'},rooms=new Map([['TEST',current]]);let calls=0;
 const schedule=source.slice(source.indexOf('function scheduleRoomPersist('),source.indexOf('\nfunction publicState('));
 vm.runInNewContext(schedule+';scheduleRoomPersist(old);',{old,rooms,campaignApi:{},roomPreparations:new Map(),clearTimeout(){calls++;},setTimeout(){calls++;}});assert.equal(calls,0);
 const start=source.indexOf('function broadcast('),end=source.indexOf('\nfunction ',start+1),broadcast=source.slice(start,end);
 vm.runInNewContext(broadcast+';broadcast(old);',{old,rooms,Date,clearTimeout(){calls++;}});assert.equal(calls,0);
});
test('connected restore and reentry never receive obsolete disconnect state; genuine disconnect still works',{timeout:45000},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sa-restoration-sse-'));let child,base;const streams=[];
 async function start(){child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server startup timeout')),10000);child.once('error',reject);child.stdout.on('data',data=>{const url=String(data).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});}
 async function stop(){if(child?.exitCode===null){const done=once(child,'exit');child.kill();await done;}}
 t.after(async()=>{streams.forEach(s=>s.abort.abort());await stop();});await start();
 const post=async(route,body)=>{const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data;};
 const fixture=await require('../scripts/fixtures/console-debug-sensors.cjs').seed(post,1,'ready');const {code,token,pcToken}=fixture;
 const get=(route)=>fetch(base+'/api/'+route).then(r=>r.json()),state=(auth=token)=>get(`state?room=${code}&token=${auth}`),backup=()=>get(`campaign/backup?code=${code}&token=${token}`);
 let saved=await backup();const unitId=saved.campaign.encounter.units[0].id;
 function configure(value,duration,remaining){const room=value.campaign.encounter;Object.assign(room,{hasEngagedClock:true,encounterEndedAt:null,activeId:unitId,pausedForTurn:true,running:false,hardPaused:true,resumeAfterTurn:true,commandRemaining:120,commandTotal:120});Object.assign(room.units[0],{atb:100,liveConnections:0,playerConnected:false});for(const ships of [value.campaign.starships,room.starships]){const item=ships.find(s=>s.id==='debug-ship').ship.sicInventory.find(i=>i.id==='cp');Object.assign(item,{bootRemaining:remaining,disabled:true,status:'offline'});if(duration===null)delete item.bootDuration;else item.bootDuration=duration;}}
 const restore=value=>post('campaign/restore',{code,token,backup:value});configure(saved,72,67);await restore(saved);
 async function connect(){const abort=new AbortController(),response=await fetch(base+`/events?delta=1&room=${code}&unit=${unitId}&token=${pcToken}`,{signal:abort.signal});assert.ok(response.ok);const stream={abort,states:[],error:null};streams.push(stream);stream.done=(async()=>{let buffer='',snapshot;try{for await(const chunk of response.body){buffer+=Buffer.from(chunk).toString();let end;while((end=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const kind=block.match(/^event: (.+)$/m)?.[1],raw=block.match(/^data: (.+)$/m)?.[1];if(!raw)continue;if(kind==='state')snapshot=JSON.parse(raw);else if(kind==='state-delta')snapshot=wire.apply(snapshot,JSON.parse(raw));else continue;stream.states.push(structuredClone(snapshot));}}}catch(error){if(!abort.signal.aborted)stream.error=error;}})();for(let i=0;i<100&&!stream.states.length;i++)await sleep(20);assert.ok(stream.states.length,'initial SSE state');return stream;}
 const boot=s=>s.starships.find(x=>x.id==='debug-ship').ship.sicInventory.find(x=>x.id==='cp');
 const old=await connect();assert.equal(boot(old.states[0]).bootDuration,72);
 saved=await backup();configure(saved,null,67);await restore(saved);await old.done;
 const replacement=await connect();assert.equal(boot(await state(pcToken)).bootDuration,undefined);await fixture.act({action:'setHardPaused',paused:true});await sleep(3600);
 assert.equal(replacement.error,null);for(const s of replacement.states){assert.equal(boot(s).bootDuration,undefined,'legacy deletion must survive every newer packet');assert.equal(boot(s).bootRemaining,67);const unit=s.units.find(u=>u.id===unitId);assert.equal(unit.playerConnected,true);assert.equal(unit.liveConnections,1);assert.equal(s.activeId,unitId);}
 assert.equal(boot(await state(pcToken)).bootDuration,undefined);
 saved=await backup();configure(saved,96,42);await restore(saved);await replacement.done;const newest=await connect();await sleep(3600);
 for(const s of newest.states){assert.equal(boot(s).bootDuration,96);assert.equal(boot(s).bootRemaining,42);assert.equal(s.units.find(u=>u.id===unitId).liveConnections,1);assert.equal(s.activeId,unitId);}
 // A disconnected ready PC can immediately become the GM's ready actor again.
 // Exercise a partial clock-sourced window, not a fresh/full or manual turn.
 saved=await backup();configure(saved,96,42);Object.assign(saved.campaign.encounter,{activeSource:'clock',hardPaused:false,commandRemaining:37,commandHeldRemaining:null});saved.campaign.encounter.units[0].commandWindow=120;
 await restore(saved);await newest.done;const timed=await connect(),before=await state(),started=Date.now();
 assert.ok(before.command.remaining>0&&before.command.remaining<38);
 timed.abort.abort();await timed.done;await sleep(3600);const disconnected=await state(),elapsed=(Date.now()-started)/1000,unit=disconnected.units.find(u=>u.id===unitId);
 assert.equal(unit.playerConnected,false);assert.equal(unit.liveConnections,0);assert.equal(disconnected.activeId,unitId);assert.equal(disconnected.command.unitId,unitId);assert.equal(disconnected.pausedForTurn,true);assert.equal(unit.atb,100);
 assert.ok(disconnected.command.remaining>0);assert.ok(disconnected.command.remaining<before.command.remaining,'disconnect must not reset to a full command window');
 assert.ok(Math.abs((before.command.remaining-disconnected.command.remaining)-elapsed)<0.5,'unpaused command time follows measured wall time');
 assert.equal((await backup()).campaign.encounter.units.find(u=>u.id===unitId).commandCarrySeconds,null,'carry is consumed into the replacement deadline');assert.equal(boot(disconnected).bootDuration,96);
 await sleep(350);await stop();await start();const reloaded=await state();assert.equal(boot(reloaded).bootDuration,96);assert.equal(boot(reloaded).bootRemaining,42);assert.equal(reloaded.units.find(u=>u.id===unitId).playerConnected,false);
 // A genuinely paused partial window must remain held across disconnect too.
 saved=await backup();configure(saved,96,42);Object.assign(saved.campaign.encounter,{activeSource:'clock',hardPaused:true,commandRemaining:29,commandHeldRemaining:29});saved.campaign.encounter.units[0].commandWindow=120;
 await restore(saved);const paused=await connect(),heldBefore=await state();assert.equal(heldBefore.command.remaining,29);assert.equal(heldBefore.hardPaused,true);
 await sleep(500);assert.equal((await state()).command.remaining,29,'held window is stationary before disconnect');
 paused.abort.abort();await paused.done;await sleep(3600);const heldAfter=await state();
 console.log('paused disconnect evidence',JSON.stringify({before:heldBefore.command,after:heldAfter.command,hardPaused:heldAfter.hardPaused}));
 assert.equal(heldAfter.units.find(u=>u.id===unitId).playerConnected,false);assert.equal(heldAfter.units.find(u=>u.id===unitId).liveConnections,0);assert.equal(heldAfter.activeId,unitId);assert.equal(heldAfter.command.unitId,unitId);assert.equal(heldAfter.pausedForTurn,true);assert.equal(heldAfter.units.find(u=>u.id===unitId).atb,100);assert.equal(heldAfter.hardPaused,true);
 assert.equal((await backup()).campaign.encounter.units.find(u=>u.id===unitId).commandCarrySeconds,null);assert.equal(boot(heldAfter).bootDuration,96);assert.equal(boot(heldAfter).bootRemaining,42);
 assert.equal(heldAfter.command.remaining,29,'hard-paused command time must not elapse during disconnect');
});
