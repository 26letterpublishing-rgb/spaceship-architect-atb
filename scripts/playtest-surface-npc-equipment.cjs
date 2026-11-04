const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mode=process.env.SA_QA_EQUIPMENT||'sidearm';assert.ok(['sidearm','loaded','carried-loaded'].includes(mode));
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../SA-ATB Local Development Files/outputs/surface-npc-equipment-nov03',mode==='sidearm'?'.':mode);
fs.mkdirSync(out,{recursive:true});let h;const evidence={};
(async()=>{
 h=await require('./console-debug.cjs').startHarness({headless:true});
 const post=async(route,body)=>{const r=await fetch(h.base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',Connection:'close'},body:JSON.stringify(body)}),result=await r.json();assert.ok(r.ok,JSON.stringify(result));return result;};
 const demo=await post('campaign/showcase/start',{}),state=()=>fetch(`${h.base}/api/state?room=${demo.code}&token=${demo.gmToken}`).then(r=>r.json());
 const backup=await fetch(`${h.base}/api/campaign/backup?code=${demo.code}&token=${demo.gmToken}`).then(r=>r.json()),e=backup.campaign.encounter;
 const actor=structuredClone(e.units.find(u=>u.team==='npc')),target=structuredClone(actor);
 Object.assign(actor,{id:'equipment-npc',characterName:'Equipment NPC',weapons:[{inventoryId:'fists',weaponId:'unarmed'},{inventoryId:'sidearm',weaponId:'standard-sidearm'}],heldWeaponId:'fists',location:{arenaId:'surface',square:24,mesh:4}});
 if(mode!=='sidearm'){
  actor.weapons=[{inventoryId:'fists',weaponId:'unarmed'},{inventoryId:'launcher',weaponId:'bore-launcher'},{inventoryId:'round',weaponId:'skull-bore'}];
  actor.launcherAmmo={launcher:['round']};if(mode==='loaded')actor.heldWeaponId='launcher';
 }
 Object.assign(target,{id:'equipment-opponent',characterName:'Equipment Opponent',allyNpc:true,weapons:[{inventoryId:'opponent-fists',weaponId:'unarmed'}],heldWeaponId:'opponent-fists',location:{arenaId:'surface',square:26,mesh:4}});
 for(const u of [actor,target]){Object.assign(u,{characterId:'',team:'npc',automationMode:'npc',automationSuspended:false,atb:u===actor?99:0,exertionCurrent:2,delayedAction:null,pendingShipRolls:[],timedAction:null,delayTimer:null,consoleHold:null});require('../combat-engine').migrateUnitCombat(u);}
 Object.assign(e,{units:[actor,target],starships:[],arena:require('../combat-arena').normalize({width:7,height:7,floors:Array.from({length:49},(_,i)=>i)}),fog:{enabled:false},activeId:null,activeAction:null,attackResolution:null,itemResolution:null,hardPaused:false,holdPaused:false,pausedForTurn:false,running:false,hasEngagedClock:false,encounterEndedAt:null,surfaceVictoryAt:null,log:[]});
 await post('campaign/restore',{code:demo.code,token:demo.gmToken,backup});
 const pc=demo.players[0];await h.pc.goto(h.base+'/');await h.pc.evaluate(({demo,pc})=>sessionStorage.setItem('sa-explore-room',JSON.stringify({...demo,perspective:pc.id})),{demo,pc});
 await h.pc.goto(h.base+'/showcase.html');await h.pc.frameLocator(`[data-explore-perspective="${pc.id}"]`).getByRole('button',{name:'Combat',exact:true}).click();
 assert.equal(await h.pc.locator('[data-explore-perspective=gm]').count(),0);
 await post('action',{roomCode:demo.code,gmToken:demo.gmToken,action:'setHardPaused',paused:false});
 await post('action',{roomCode:demo.code,gmToken:demo.gmToken,action:'setRunning',running:true});
 const started=await state();assert.equal(started.hasEngagedClock,true);assert.equal(started.hardPaused,false);evidence.started=true;
 // Observe only after start: real client animation acknowledgements are untouched.
 const began=Date.now();let attackId=null,drawAt=null;const trace=[],expectedHeld=mode==='sidearm'?'sidearm':'launcher',expectedWeapon=mode==='sidearm'?'standard-sidearm':'skull-bore';
 while(Date.now()-began<150000){
  await new Promise(r=>setTimeout(r,150));const s=await state(),u=s.units.find(v=>v.id===actor.id),a=s.attackResolution;
  assert.equal(u.exertionCurrent,2);assert.deepEqual(u.location,actor.location);
  if(mode==='loaded')assert.equal(u.heldWeaponId,'launcher','a usable held launcher must stay selected');
  if(mode!=='loaded'&&!drawAt&&u.heldWeaponId===expectedHeld){drawAt=Date.now();evidence.draw={atb:u.atb,active:s.activeId,attack:a};assert.ok(u.atb<20);assert.equal(a,null);}
  if(a?.attackerId===actor.id&&!attackId){attackId=a.id;evidence.attack={elapsedAfterDraw:drawAt?Date.now()-drawAt:null,weapon:a.weaponId,plan:a.plan};if(mode!=='loaded'){assert.ok(drawAt);assert.ok(Date.now()-drawAt>1000,'drawing and attacking require separate turns');}assert.equal(a.weaponId,expectedWeapon);}
  const row={elapsed:Date.now()-began,held:u.heldWeaponId,atb:u.atb,active:s.activeId,attack:a?.id,phase:a?.phase,exertion:u.exertionCurrent};trace.push(row);
  if(attackId&&!a){evidence.completed=true;evidence.log=s.log;break;}
 }
 evidence.trace=trace;assert.equal(evidence.completed,true,'automatic attack must resolve without GM clicks');assert.deepEqual(h.errors,[]);evidence.errors=h.errors;
 await h.pc.screenshot({path:path.join(out,'resolved.png'),fullPage:true});
})().catch(async error=>{evidence.failure=error.stack;console.error(error);process.exitCode=1;await h?.pc.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}).finally(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(evidence,null,2));await h?.stop();console.log(out);});
