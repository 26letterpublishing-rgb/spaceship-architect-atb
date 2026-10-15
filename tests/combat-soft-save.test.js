const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const A=require('../combat-arena');
test('two walking crew update their sprites without rebuilding the ship map each tick',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../ship-combat-map.js'),'utf8');
 const fn=source.slice(source.indexOf('  function interiorStateKey('),source.indexOf('  const inlineZoom ='));
 const scope={combatState:{units:[1,2].map(id=>({id,location:{starshipId:'ship',square:id},timedAction:{kind:'move',total:10,remaining:9,routeSegment:[{square:3}]}}))},mode:'gm',mapView:{},selectedShipId:'ship',selectedUnitId:1,myUnitId:'',interaction:'view',preview:null,inlineZoom:new Map(),moveSubmitting:false,moveError:''};
 const vm=require('node:vm');vm.createContext(scope);vm.runInContext(fn,scope);
 const record={id:'ship',ship:{gridCells:[1,2,3],doorStates:{}}},initial=scope.interiorStateKey(record);
 scope.combatState.units.forEach(u=>u.timedAction.remaining-=.1);assert.equal(scope.interiorStateKey(record),initial);
 record.ship.doorStates.entry={open:true};assert.notEqual(scope.interiorStateKey(record),initial);
 const moving=scope.interiorStateKey(record);scope.combatState.units[0].timedAction=null;assert.notEqual(scope.interiorStateKey(record),moving);
});
test('shared walking presentation interpolates each character and honors door pauses',()=>{
 const coords=p=>({x:p.square,y:0}),unit={timedAction:{kind:'move',startLocation:{square:0},routeSegment:[{square:1},{square:2}],total:2,remaining:1.5}};
 assert.equal(A.movement(unit,coords).x,.5);assert.equal(A.movement(unit,coords).walking,true);
 const other=structuredClone(unit);other.timedAction.remaining=.25;assert.equal(A.movement(other,coords).x,1.75);assert.equal(A.movement(unit,coords).x,.5);
 unit.timedAction={...unit.timedAction,total:2.6,remaining:2.3,doorDelay:.6,routeSegment:[{square:1,doorKey:'a'},{square:2}]};
 assert.equal(A.movement(unit,coords).x,0);assert.equal(A.movement(unit,coords).walking,false);assert.ok(A.movement(unit,coords).openDoorKeys.has('a'));
});
test('latest combat save survives empty/ended state, restores paused and survives server restart',{timeout:45000},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sa-soft-save-'));let child,base,stderr='';
 async function start(){child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});child.stderr.on('data',d=>stderr+=d);
  base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout: '+stderr)),10000);child.stdout.on('data',d=>{const url=String(d).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});}
 async function stop(){if(!child||child.exitCode!==null)return;await new Promise(r=>{child.once('exit',r);child.kill();});}
 t.after(stop);await start();
 const post=async(p,b,status=200)=>{const r=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b),signal:AbortSignal.timeout(10000)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d).slice(0,600));return d;};
 const demo=await post('/api/campaign/showcase/start',{}),code=demo.code,token=demo.gmToken;
 const get=async p=>{const r=await fetch(base+p,{signal:AbortSignal.timeout(10000)});assert.equal(r.status,200);return r.json();};
 const state=()=>get(`/api/state?room=${code}&token=${token}`),history=()=>get(`/api/campaign/checkpoints?code=${code}&token=${token}`);
 const gm=async b=>post('/api/action',await require('./helpers/confirmed-encounter.cjs')(base,{roomCode:code,gmToken:token,...b}));
 const arena=A.normalize({width:7,height:7,floors:Array.from({length:49},(_,i)=>i)});
 let s=await gm({action:'prepareEncounter',preparationId:'soft-save-prepare',mode:'surface',arena,fog:{enabled:true},starships:[],units:demo.players.map((p,i)=>({team:'pc',characterId:p.id,location:{arenaId:'surface',square:i*7}}))});
 const first=(await history()).checkpoints.find(c=>c.id==='latest');assert.ok(first,'even the prepared encounter is protected');
 let backup=await get(`/api/campaign/backup?code=${code}&token=${token}`);backup.campaign.encounter=s;
 Object.assign(s,{running:false,hardPaused:true,hasEngagedClock:true,activeId:null,pausedForTurn:false});
 for(const u of s.units){u.atb=0;u.timedAction={kind:'move',startLocation:structuredClone(u.location),routeSegment:A.route(arena,u.location.square,u.location.square+3),total:6,remaining:4,gravityScale:1,doorDelay:0};}
 await post('/api/campaign/restore',{code,token,backup});
 await gm({action:'setCombatFog',enabled:true});
 for(let i=0;i<40;i++){const h=(await history()).checkpoints[0];if(h.at!==first.at)break;await new Promise(r=>setTimeout(r,50));}
 const latest=(await history()).checkpoints[0];assert.equal(latest.id,'latest');
 await post('/api/campaign/checkpoint/restore',{code,token:demo.players[0].token,checkpointId:'latest'},403);
 await gm({action:'exitEncounter'});assert.ok((await state()).encounterEndedAt);
 assert.equal((await history()).checkpoints[0].at,latest.at,'ending cannot overwrite the recovery slot');
 await post('/api/campaign/checkpoint/restore',{code,token,checkpointId:'latest',confirmCampaignName:'Explore Features',expectedEncounterId:'wrong'},409);
 s=await state();const c=await get(`/api/campaign/state?code=${code}&token=${token}`);
 await post('/api/campaign/checkpoint/restore',{code,token,checkpointId:'latest',confirmCampaignName:c.name,expectedEncounterId:s.encounterId});
 s=await state();assert.equal(s.hardPaused,true);assert.equal(s.running,false);assert.equal(s.encounterEndedAt,null);assert.equal(s.units.filter(u=>u.timedAction?.kind==='move').length,2);assert.ok(s.fog.enabled);assert.ok(s.visibility.surface.explored.length);
 await gm({action:'setCombatFog',enabled:true});await new Promise(r=>setTimeout(r,500));
 await stop();await start();s=await state();assert.equal(s.hardPaused,true);assert.equal(s.units.length,2);assert.equal(s.units[0].timedAction.remaining,4);assert.equal(s.accessRole,'gm');
 // The largest demo ship must continue advancing two independent walkers on
 // the actual clock, without a GM Step or browser animation acknowledgment.
 backup=await get(`/api/campaign/backup?code=${code}&token=${token}`);
 const ship=backup.campaign.starships.find(v=>v.controlType==='pc');
 s=await gm({action:'prepareEncounter',preparationId:'two-ship-walkers',mode:'starship',starships:[ship],units:demo.players.map(p=>({team:'pc',characterId:p.id,location:{starshipId:ship.id,square:ship.ship.gridCells[0],mesh:4}}))});
 backup=await get(`/api/campaign/backup?code=${code}&token=${token}`);backup.campaign.encounter=s;
 Object.assign(s,{running:true,hardPaused:false,pausedForTurn:false,activeId:null,hasEngagedClock:true});s.units=s.units.filter(u=>u.team==='pc');
 s.units.forEach((u,i)=>{const location={starshipId:ship.id,square:ship.ship.gridCells[10+i],mesh:0,stationed:false};Object.assign(u,{location,speed:1,commandWindow:120,atb:0,pendingShipRolls:[],delayedAction:null,timedAction:{kind:'move',startLocation:location,routeSegment:Array.from({length:12},(_,j)=>({...location,mesh:[1,2,1,0][j%4]})),total:12,remaining:12,gravityScale:1,doorDelay:0}});});
 await post('/api/campaign/restore',{code,token,backup});await gm({action:'setHardPaused',paused:false});await gm({action:'setRunning',running:true});await new Promise(r=>setTimeout(r,1200));s=await state();
 const walkers=s.units.filter(u=>u.team==='pc');assert.equal(walkers.length,2);assert.equal(s.running,true,JSON.stringify({paused:s.hardPaused,active:s.activeId,log:s.log.slice(0,4),units:s.units.map(u=>({id:u.id,atb:u.atb,remaining:u.timedAction?.remaining,pending:u.pendingShipRolls}))}));assert.equal(s.encounterEndedAt,null);for(const u of walkers)assert.ok(u.timedAction.remaining<11.5&&u.timedAction.remaining>0);
 const exported=await get(`/api/campaign/backup?code=${code}&token=${token}`);for(const u of exported.campaign.encounter.units.filter(u=>u.team==='pc'))assert.ok(u.timedAction.remaining<=s.units.find(v=>v.id===u.id).timedAction.remaining,'export includes current walking progress');
 assert.equal(stderr,'');
});
