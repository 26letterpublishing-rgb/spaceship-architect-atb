const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),maps=require('../ship-map-core');
const out=path.resolve(process.env.SA_SHOWCASE_OUT||'../SA-ATB Local Development Files/outputs/interior-review-verified-nov03');fs.mkdirSync(out,{recursive:true});let h;const evidence={};
(async()=>{
 h=await require('./console-debug.cjs').startHarness({headless:true});
 const post=async(route,body)=>{const r=await fetch(h.base+'/api/'+route,{method:'POST',headers:{'content-type':'application/json',Connection:'close'},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.ok,true,JSON.stringify(d));return d;};
 const demo=await post('campaign/showcase/start',{}),act=b=>post('action',{roomCode:demo.code,gmToken:demo.gmToken,...b});
 const state=()=>fetch(h.base+'/api/state?room='+demo.code+'&token='+demo.gmToken).then(r=>r.json());
 let s=await state();assert.deepEqual(s.starships.map(v=>v.title),['Lantern','Cinderwake']);
 evidence.fresh=s.starships.map(v=>({id:v.id,title:v.title,power:require('../ship-power').designBudget(v),airlocks:v.ship.airlocks}));
 const own=s.starships.find(v=>v.controlType==='pc'),enemy=s.starships.find(v=>v.controlType==='gm'),hatch=own.ship.airlocks[0];
 const seats=require('../ship-automation').seats(own).filter(v=>v.bridge),pcs=s.units.filter(u=>u.characterId),npc=s.units.find(u=>!u.characterId&&!u.allyNpc);
 const playerId=pcs[0].characterId;
 // Controlled boarding fixture: same-hex ships, shields deliberately powered down,
 // disclosed contact and a friendly pilot. No hostile crew privileges are granted.
 for(const v of s.starships){for(const i of v.ship.sicInventory)if(maps.definition(i.type).shield){i.disabled=true;i.status='powered-down';}v.currentShieldHp=0;v.ship.currentShieldHp=0;}
 own.sensorState={contacts:{[enemy.id]:{level:'detected'}}};
 const setup=[{...pcs[0],location:{environment:'starship',starshipId:own.id,square:hatch.square,mesh:3,stationed:false}},{...pcs[1],location:{...seats[0],environment:'starship',stationed:true}},{...npc}].map(u=>({...u,preparationUnitId:u.id,speed:1}));
 await act({action:'prepareEncounter',confirmCampaignName:'Explore Features',expectedEncounterId:s.encounterId,preparationId:crypto.randomUUID(),mode:'starship',starships:s.starships,shipPositions:s.starships.map(v=>({id:v.id,q:0,r:0})),units:setup});
 s=await state();const actor=s.units.find(u=>u.characterId===playerId),pilot=s.units.find(u=>u.characterId===pcs[1].characterId);
 // Preparation intentionally rebuilds surveillance/power state from campaign records.
 // Restore only this disposable fixture's docking prerequisites before starting combat.
 const backup=await fetch(h.base+'/api/campaign/backup?code='+demo.code+'&token='+demo.gmToken).then(r=>r.json());
 const encounter=backup.campaign.encounter;encounter.shipPositions=encounter.starships.map(v=>({id:v.id,q:0,r:0}));encounter.knownContacts={[own.id]:{[enemy.id]:{level:'detected'}}};
 for(const v of encounter.starships){v.currentShieldHp=0;v.ship.currentShieldHp=0;for(const i of v.ship.sicInventory)if(maps.definition(i.type).shield){i.disabled=true;i.status='powered-down';}if(v.id===own.id)v.sensorState={contacts:{[enemy.id]:{level:'detected'}}};}
 await post('campaign/restore',{code:demo.code,token:demo.gmToken,backup});
 await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});await act({action:'setHardPaused',paused:true});
 s=await state();evidence.started={hasEngagedClock:s.hasEngagedClock,ended:s.encounterEndedAt,pilot:s.units.find(u=>u.id===pilot.id)?.location};assert.equal(s.hasEngagedClock,true);
 const utility=b=>post('campaign/starship/field-utility',{code:demo.code,token:demo.gmToken,starshipId:own.id,id:pilot.id,sicId:pilot.location.sicId,...b});
 const inspection=await utility({kind:'airlock-inspect'});assert.ok(inspection.result.targets.some(v=>v.id===enemy.id));
 await utility({kind:'airlock-dock',targetId:enemy.id,receipt:crypto.randomUUID()});
 for(let i=0;i<20;i++)await act({action:'step'});assert.equal((await utility({kind:'airlock-inspect'})).result.links[0].ready,true);
 evidence.dockedAfterStart=true;
 const pc=demo.players.find(p=>p.id===playerId),p=h.pc;await p.setViewportSize({width:1366,height:900});
 await p.goto(h.base+'/');await p.evaluate(({code,pc})=>{sessionStorage.setItem('sa-character-token-'+code+'-'+pc.id,pc.token);localStorage.setItem('sa-character-token-'+code+'-'+pc.id,pc.token);},{code:demo.code,pc});
 const load=async()=>{await p.goto(h.base+'/character.html?campaign='+demo.code+'&character='+pc.id);await p.getByRole('button',{name:'Combat',exact:true}).click();const f=p.frames().find(f=>f.url().includes('/index.html'));await f.waitForFunction(()=>window.SACombatBridge?.state()?.units?.length);return f;};
 let f=await load();await p.bringToFront();
 const ready=async()=>{await act({action:'nudge',id:actor.id,amount:100});await f.waitForFunction(id=>SACombatBridge.state().activeId===id,actor.id);};
 const move=async(destination,mode='direct',expanded=true)=>{
  await ready();await f.evaluate(id=>SACombatMap.openMove(SACombatBridge.state().units.find(u=>u.id===id)),actor.id);
  let d=p.locator('.expanded-interior-dialog[open]');await d.waitFor();await d.locator('[data-interior-focus]').click();
  if(!expanded){await p.keyboard.press('Escape');await d.waitFor({state:'detached'});d=f.locator('[data-inline-ship-map]').filter({has:f.locator('[data-crew-route]')}).filter({visible:true}).first();}
  await d.locator('[data-crew-route="'+mode+'"]').click();
  const plan=await f.evaluate(({id,destination})=>SACombatMap.planMove(id,destination),{id:actor.id,destination});evidence.plans||=[];evidence.plans.push(plan);assert.ok(!plan.error&&plan.route?.length,JSON.stringify(plan));
  await d.locator(`[data-map-square="${destination.square}"][data-map-mesh="${destination.mesh}"]`).click();
  const confirm=d.locator('[data-inline-confirm-move]');assert.equal(await confirm.isEnabled(),true);
  await confirm.waitFor({state:'visible'});
  const geometry=await confirm.evaluate(b=>{const r=b.getBoundingClientRect(),v=b.closest('[data-inline-ship-map]').querySelector('.inline-map-viewport').getBoundingClientRect(),c=getComputedStyle(b);return{width:r.width,height:r.height,radius:c.borderRadius,color:c.backgroundColor,x:r.left,y:r.top,right:r.right,bottom:r.bottom,viewport:{left:v.left,top:v.top,right:v.right,bottom:v.bottom}};});
  assert.ok(Math.abs(geometry.width-geometry.height)<1);assert.ok(geometry.radius==='50%');assert.equal(geometry.color,'rgb(20, 94, 60)');
  assert.ok(geometry.x>=geometry.viewport.left-1&&geometry.right<=geometry.viewport.right+1&&geometry.y>=geometry.viewport.top-1&&geometry.bottom<=geometry.viewport.bottom+1,JSON.stringify(geometry));
  evidence.geometry||=[];evidence.geometry.push(geometry);
  const pills=await d.locator('[data-crew-route]').evaluateAll(bs=>bs.map(b=>({radius:getComputedStyle(b).borderRadius,background:getComputedStyle(b).backgroundImage,pressed:b.getAttribute('aria-pressed')})));
  assert.ok(pills.every(b=>b.background.includes('gradient')));assert.equal(pills.filter(b=>b.pressed==='true').length,1);
  // Exercise the actual child-replacement mutation that previously left initials behind.
  const token=d.getByTitle(actor.characterName,{exact:true}).and(d.locator('.combat-token')).first();
  await token.evaluate(e=>e.innerHTML='<span>M</span>');
  await token.locator('.crew-figure').waitFor({state:'attached'});
  assert.ok(await token.evaluate(e=>Number(getComputedStyle(e).zIndex)>=21));
  evidence.iconRepaired=true;
  await p.screenshot({path:path.join(out,'route-'+evidence.plans.length+'.png')});
  const response=p.waitForResponse(r=>r.url().endsWith('/api/action')&&r.request().postDataJSON()?.kind==='move');await confirm.click();const r=await response;evidence.responses||=[];evidence.responses.push({status:r.status(),body:await r.json()});assert.equal(r.status(),200);
  for(let i=0;i<60;i++){s=await state();const u=s.units.find(u=>u.id===actor.id);evidence.progress||=[];evidence.progress.push({i,location:u.location,timed:u.timedAction,activeId:s.activeId,activeAction:s.activeAction,transfers:s.starships.map(v=>v.ship.airlockDocking?.transfers)});if(!u.timedAction&&!s.starships.some(v=>v.ship.airlockDocking?.transfers?.length))break;await act({action:'step'});}
  s=await state();const u=s.units.find(u=>u.id===actor.id);assert.ok(!u.timedAction);evidence.arrivals||=[];evidence.arrivals.push({location:u.location,team:u.team});
  if(await p.locator('.expanded-interior-dialog[open]').count())await p.keyboard.press('Escape');return u;
 };
 let u=await move({square:hatch.square,mesh:4});assert.equal(u.location.starshipId,enemy.id);assert.equal(u.team,'pc');assert.ok(!s.starships.find(v=>v.id===enemy.id).crewCharacterIds.includes(playerId));evidence.intruder=true;
 u=await move({square:enemy.ship.airlocks[0].square-1,mesh:4},'direct');assert.equal(u.location.square,enemy.ship.airlocks[0].square-1);
 u=await move({square:enemy.ship.airlocks[0].square-2,mesh:4},'custom',false);assert.equal(u.location.square,enemy.ship.airlocks[0].square-2);
 const expected=structuredClone(u.location);f=await load();await f.waitForFunction(({id,expected})=>JSON.stringify(SACombatBridge.state().units.find(u=>u.id===id)?.location)===JSON.stringify(expected),{id:actor.id,expected});evidence.reloadLocation=expected;
 await p.screenshot({path:path.join(out,'intruder-after-reload.png')});
 // Cancel/reopen must retain the authoritative intruder location, not its old ship origin.
 await ready();await f.evaluate(id=>SACombatMap.openMove(SACombatBridge.state().units.find(u=>u.id===id)),actor.id);
 let cancel=p.locator('.expanded-interior-dialog[open]');await cancel.waitFor();await cancel.locator('[data-inline-cancel-move]').click();await p.keyboard.press('Escape');assert.deepEqual((await state()).units.find(u=>u.id===actor.id).location,expected);
 await h.gm.goto(h.base+'/gm.html?campaign='+demo.code);await h.gm.evaluate(d=>sessionStorage.setItem('sa-gm-token-'+d.code,d.gmToken),demo);await h.gm.reload();await h.gm.getByRole('button',{name:'Combat',exact:true}).click();const gf=h.gm.frames().find(f=>f.url().includes('/index.html'));await gf.waitForFunction(({id,expected})=>JSON.stringify(window.SACombatBridge?.state()?.units?.find(u=>u.id===id)?.location)===JSON.stringify(expected),{id:actor.id,expected});evidence.gmPcAgree=true;
 u=await move({square:enemy.ship.airlocks[0].square,mesh:4},'custom');assert.equal(u.location.starshipId,own.id);assert.equal(u.team,'pc');evidence.returned=true;
 const saved=await fetch(h.base+'/api/campaign/backup?code='+demo.code+'&token='+demo.gmToken).then(r=>r.json());assert.equal(saved.campaign.encounter.units.find(v=>v.id===actor.id).location.starshipId,own.id);
 assert.deepEqual(h.errors,[]);evidence.errors=h.errors;
})().catch(async e=>{evidence.failure=e.stack;if(h)await h.pc.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(evidence,null,2));await h?.stop();console.log(out);});
