const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..'),out=path.resolve(process.env.SA_MOTION_OUT||'../SA-ATB Local Development Files/outputs/ship-motion-fixed-'+(process.env.SA_MOTION_VIEW||'main')+'-'+(process.env.SA_MOTION_HOLD==='1'?'hold':'normal'));fs.mkdirSync(out,{recursive:true});let h,opera;const evidence={};
(async()=>{try{h=await require(path.join(root,'scripts/console-debug.cjs')).startHarness({headless:false});const p=await h.gm.context().browser().newPage({viewport:{width:1372,height:656}});await p.setViewportSize({width:1372,height:656});p.setDefaultTimeout(15000);await p.addInitScript(()=>{
window.__motionTrace=[];let rafTime=null;let nextId=0;const id=k=>k.__motionCheckId||(k.__motionCheckId=location.href+'#'+(++nextId));
const raf=window.requestAnimationFrame;window.requestAnimationFrame=function(fn){return raf.call(this,t=>{const prev=rafTime;rafTime=t;try{return fn(t);}finally{rafTime=prev;}})};
const set=Map.prototype.set;Map.prototype.set=function(k,v){if(k?.dataset?.spaceShip==='showcase-pc-ship'&&v?.fromX!==undefined&&v?.duration!==undefined)window.__motionTrace.push({kind:'motion',marker:id(k),origin:performance.timeOrigin,now:performance.now(),raf:rafTime,...v});return set.call(this,k,v);};
const attr=Element.prototype.setAttribute;Element.prototype.setAttribute=function(k,v){if(k==='transform'&&this.dataset?.spaceShip==='showcase-pc-ship'&&this.isConnected){const previous=this.getAttribute(k);if(previous!==v)window.__motionTrace.push({kind:'transform',view:this.closest('.space-map-dialog')?'enlarged':'main',marker:id(this),origin:performance.timeOrigin,now:performance.now(),raf:rafTime,previous,value:v,q:window.SACombatBridge?.state?.()?.shipPositions?.find(x=>x.id==='showcase-pc-ship')?.q});}return attr.call(this,k,v);};
});await p.goto(h.base+'/');await p.bringToFront();await p.screenshot({path:path.join(out,'entry.png')});console.log('ENTRY '+p.url()+' '+(await p.locator('body').innerText()).slice(0,1500));await p.getByRole('link',{name:'Tutorial / Explore Features',exact:true}).click();await p.locator('[data-perspective=gm]').waitFor();await p.frameLocator('iframe[data-explore-perspective=gm]').locator('#gmWorkspace').waitFor();const gm=p.frames().find(f=>f.url().includes('/gm.html'));await gm.getByRole('button',{name:'Combat',exact:true}).click();await gm.locator('[data-encounter-mode=starship]').click();for(const box of await gm.locator('[data-encounter-starship]').all())await box.check();
if(process.env.SA_MOTION_TWO_ACTORS==='1'){
 await gm.locator('[data-encounter-character=showcase-kip]').uncheck();
 for(const id of ['unit-showcase-voss','unit-showcase-lumen'])await gm.locator('[data-encounter-npc="'+id+'"]').uncheck();
}
await p.screenshot({path:path.join(out,'prepare.png')});const demo=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('sa-explore-room')));const state=()=>fetch(h.base+'/api/state?room='+demo.code+'&token='+demo.gmToken).then(r=>r.json());evidence.before=await state();await gm.locator('#beginEncounter').click();await p.waitForTimeout(1000);await p.screenshot({path:path.join(out,'after-begin.png')});const seat=gm.locator('[data-station-ship=showcase-pc-ship]');const option=await seat.locator('option').evaluateAll(ns=>ns.find(n=>n.textContent.startsWith('Bridge')&&!n.disabled)?.value);await seat.selectOption(option);await gm.getByRole('button',{name:'Confirm Positions / Begin Combat',exact:true}).click();await p.waitForTimeout(1500);const combat=gm.frameLocator('#atbFrame');await combat.getByRole('button',{name:/^(Engage Clock|Begin Combat, and Engage Clock!!)$/}).click();await p.waitForTimeout(2000);evidence.after=await state();await p.screenshot({path:path.join(out,'started.png')});evidence.steps=[];
for(let i=0;i<120;i++){const s=await state(),u=s.units.find(u=>u.id===s.activeId);if(u?.characterId==='showcase-mara'||s.units.some(v=>v.characterId==='showcase-mara'&&v.atb>=99))break;if(u){evidence.steps.push({pass:u.characterName});await combat.locator('#completeTurn').click();}await p.waitForTimeout(500);}
await p.locator('[data-perspective=showcase-mara]').click();
const pc=p.frameLocator('iframe[data-explore-perspective=showcase-mara]');
await pc.getByRole('button',{name:'Combat',exact:true}).click();
await p.waitForTimeout(1500);
const cf=p.frames().find(f=>f.url().includes('/index.html')&&f.url().includes('player'));
evidence.frameUrls=p.frames().map(f=>f.url());
await p.screenshot({path:path.join(out,'mara-turn.png')});
const player=pc.frameLocator('#playerAtbFrame');
evidence.buttons=(await player.locator('button:visible').allTextContents()).filter(Boolean);

if((await state()).activeId==='unit-showcase-kip'){await p.locator('[data-perspective=showcase-kip]').click();const k=p.frameLocator('iframe[data-explore-perspective=showcase-kip]');await k.getByRole('button',{name:'Combat',exact:true}).click();await k.frameLocator('#playerAtbFrame').locator('#playerEndTurn').click();await p.locator('[data-perspective=showcase-mara]').click();}await player.getByRole('button',{name:'Move Ship',exact:true}).click();
await p.waitForTimeout(500);
await p.screenshot({path:path.join(out,'planner.png')});
const dialog=pc.locator('dialog.navigation-planner');
await dialog.locator('[name=q]').fill(process.env.SA_MOTION_TWO_ACTORS==='1'?'40':'8');await dialog.locator('[name=r]').fill('0');
await dialog.locator('button[type=submit]').click();await p.waitForTimeout(400);if((await state()).activeId==='unit-showcase-kip'){await p.locator('[data-perspective=showcase-kip]').click();const kip=p.frameLocator('iframe[data-explore-perspective=showcase-kip]');await kip.getByRole('button',{name:'Combat',exact:true}).click();await kip.frameLocator('#playerAtbFrame').locator('#playerEndTurn').click();await p.locator('[data-perspective=showcase-mara]').click();}

if(process.env.SA_MOTION_HOLD==='1'){
 for(let i=0;i<100;i++){
  const hold=player.getByRole('button',{name:'Hold',exact:true});
  if(await hold.isVisible()&&await hold.isEnabled())break;
  const current=await state(),actor=current.units.find(u=>u.id===current.activeId);
  if(actor&&actor.characterId!=='showcase-mara'){
   if(actor.characterId==='showcase-kip'){
    await p.locator('[data-perspective=showcase-kip]').click();const k= p.frameLocator('iframe[data-explore-perspective=showcase-kip]');
    await k.getByRole('button',{name:'Combat',exact:true}).click();await k.frameLocator('#playerAtbFrame').locator('#playerEndTurn').click();
   }else{await p.locator('[data-perspective=gm]').click();await combat.locator('#completeTurn').click();}
   evidence.steps.push({passForHold:actor.characterName});await p.locator('[data-perspective=showcase-mara]').click();
  }
  await p.waitForTimeout(300);
 }
 await player.getByRole('button',{name:'Hold',exact:true}).click();
 await pc.getByRole('dialog',{name:'Hold at 99%',exact:true}).getByRole('button',{name:'Hold at 99%',exact:true}).click();
 for(let i=0;i<30;i++){evidence.hold=(await state()).units.find(u=>u.characterId==='showcase-mara').consoleHold;if(evidence.hold)break;await p.waitForTimeout(100);}
 require('node:assert/strict').ok(evidence.hold,'Hold must actually engage');
}
await player.locator('.combat-space-map').scrollIntoViewIfNeeded();
if(process.env.SA_MOTION_VIEW==='enlarged')await player.locator('.combat-space-map [data-space-enlarge]').click();

const client=await p.context().newCDPSession(p),frames=[];
client.on('Page.screencastFrame',e=>{void client.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});const file='travel-'+String(frames.length).padStart(4,'0')+'.jpg';fs.writeFileSync(path.join(out,file),Buffer.from(e.data,'base64'));frames.push({file,time:e.metadata.timestamp});});
await p.bringToFront();if(process.env.SA_MOTION_PROFILE==='1'){await client.send('Profiler.enable');await client.send('Profiler.start');}else await client.send('Page.startScreencast',{format:'jpeg',quality:95,maxWidth:1372,maxHeight:656,everyNthFrame:1});
evidence.states=[];
for(let i=0;i<Number(process.env.SA_MOTION_SAMPLES||40);i++){await p.waitForTimeout(500);const s=await state();evidence.states.push({t:i/2,active:s.activeId,positions:s.shipPositions,nav:s.starships.map(v=>({id:v.id,navigation:v.navigation})),running:s.running,paused:s.pausedForTurn});}

if(process.env.SA_MOTION_PROFILE==='1'){const profile=await client.send('Profiler.stop');fs.writeFileSync(path.join(out,'cpu-profile.json'),JSON.stringify(profile));}else await client.send('Page.stopScreencast');
evidence.trace=(await Promise.all(p.frames().map(f=>f.evaluate(()=>window.__motionTrace||[])))).flat().sort((a,b)=>(a.origin+a.now)-(b.origin+b.now));fs.writeFileSync(path.join(out,'frames.json'),JSON.stringify(frames));
const assert=require('node:assert/strict'),motions=new Map(),reversals=[];let staleFrames=0,checked=0,enlargedChecked=0;
for(const r of evidence.trace){if(r.kind==='motion')motions.set(r.marker,r);else{
 const m=motions.get(r.marker);if(!m)continue;
 const numbers=v=>v.slice(v.indexOf('(')+1,-1).split(/[ ,]+/).map(Number),before=numbers(r.previous),after=numbers(r.value);assert.ok([...before,...after].every(Number.isFinite));
 checked++;if(r.view==='enlarged')enlargedChecked++;if(r.origin===m.origin&&r.raf!==null&&r.raf<m.start)staleFrames++;
 if((m.x>=m.fromX&&after[0]<before[0]-1e-6)||(m.x<m.fromX&&after[0]>before[0]+1e-6))reversals.push({m,r});
}}
evidence.reversals=reversals;evidence.staleFrames=staleFrames;evidence.checked=checked;evidence.enlargedChecked=enlargedChecked;
const moved=evidence.states.some(s=>s.positions.find(v=>v.id==='showcase-pc-ship').q>.3);
assert.ok(moved,'Must observe actual movement, not a paused fixture');assert.deepEqual(reversals,[]);assert.ok(checked>10);if(process.env.SA_MOTION_VIEW==='enlarged')assert.ok(enlargedChecked>10,'Actual enlarged marker transforms required');
await p.screenshot({path:path.join(out,'final.png')});
console.log(JSON.stringify({frames:frames.length,staleFrames,reversals:reversals.length,moved,out}));
}finally{fs.writeFileSync(path.join(out,'setup.json'),JSON.stringify(evidence,null,2));await opera?.close();await h?.stop();}})().catch(e=>{console.error(e);process.exitCode=1});
