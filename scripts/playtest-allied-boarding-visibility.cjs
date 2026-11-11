const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),maps=require('../ship-map-core');
const out=path.join(require('os').tmpdir(),'sa-allied-boarding-nov10');fs.mkdirSync(out,{recursive:true});let h;const evidence={};
(async()=>{
 h=await require('./console-debug.cjs').startHarness({headless:true});
 const post=async(route,body)=>{const r=await fetch(h.base+'/api/'+route,{method:'POST',headers:{'content-type':'application/json',Connection:'close'},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.ok,true,JSON.stringify(d));return d;};
 const demo=await post('campaign/showcase/start',{}),act=b=>post('action',{roomCode:demo.code,gmToken:demo.gmToken,...b});
 const state=()=>fetch(h.base+'/api/state?room='+demo.code+'&token='+demo.gmToken).then(r=>r.json());
 let s=await state();assert.deepEqual(s.starships.map(v=>v.title),['Lantern','Cinderwake']);
 evidence.fresh=s.starships.map(v=>({id:v.id,title:v.title,power:require('../ship-power').designBudget(v),airlocks:v.ship.airlocks}));
 const own=s.starships.find(v=>v.controlType==='pc'),enemy=s.starships.find(v=>v.controlType==='gm'),hatch=own.ship.airlocks[0];
 enemy.controlType='pc';
 const reserve=structuredClone(enemy);reserve.id='qa-reserve-ally';reserve.ship.id=reserve.id;reserve.title='Reserve Ally';reserve.crewCharacterIds=[];reserve.characterLocations={};s.starships.push(reserve);
 const seats=require('../ship-automation').seats(own).filter(v=>v.bridge),pcs=s.units.filter(u=>u.characterId),npc=s.units.find(u=>!u.characterId&&!u.allyNpc);
 const playerId=pcs[0].characterId;
 // Controlled boarding fixture: same-hex ships, shields deliberately powered down,
 // disclosed contact and a friendly pilot. No hostile crew privileges are granted.
 for(const v of s.starships){for(const i of v.ship.sicInventory)if(maps.definition(i.type).shield){i.disabled=true;i.status='powered-down';}v.currentShieldHp=0;v.ship.currentShieldHp=0;}
 own.sensorState={contacts:{[enemy.id]:{level:'detected'}}};
 const setup=[{...pcs[0],location:{environment:'starship',starshipId:own.id,square:hatch.square,mesh:3,stationed:false}},{...pcs[1],location:{...seats[0],environment:'starship',stationed:true}},{...npc}].map(u=>({...u,preparationUnitId:u.id,speed:1}));
 const initial=await fetch(h.base+'/api/campaign/backup?code='+demo.code+'&token='+demo.gmToken).then(r=>r.json());initial.campaign.starships=s.starships;await post('campaign/restore',{code:demo.code,token:demo.gmToken,backup:initial});
 await act({action:'prepareEncounter',confirmCampaignName:'Explore Features',expectedEncounterId:s.encounterId,preparationId:crypto.randomUUID(),mode:'starship',starships:s.starships,shipPositions:s.starships.map(v=>({id:v.id,q:0,r:0})),units:setup});
 s=await state();const actor=s.units.find(u=>u.characterId===playerId),pilot=s.units.find(u=>u.characterId===pcs[1].characterId);
 // Preparation intentionally rebuilds surveillance/power state from campaign records.
 // Restore only this disposable fixture's docking prerequisites before starting combat.
 const backup=await fetch(h.base+'/api/campaign/backup?code='+demo.code+'&token='+demo.gmToken).then(r=>r.json());
 for(const v of backup.campaign.starships)if(v.id===enemy.id)v.controlType='pc';
 const encounter=backup.campaign.encounter;for(const v of encounter.starships)if(v.id===enemy.id||v.id===reserve.id)v.controlType='pc';encounter.shipPositions=encounter.starships.map(v=>({id:v.id,q:0,r:0}));encounter.knownContacts={[own.id]:{[enemy.id]:{level:'detected'}}};
 for(const v of encounter.starships){v.currentShieldHp=0;v.ship.currentShieldHp=0;for(const i of v.ship.sicInventory)if(maps.definition(i.type).shield){i.disabled=true;i.status='powered-down';}if(v.id===own.id)v.sensorState={contacts:{[enemy.id]:{level:'detected'}}};}
 for(const v of encounter.starships){v.sensorState={contacts:{},analyses:{},reports:[]};for(const other of encounter.starships.filter(o=>o.id!==v.id)){v.sensorState.contacts[other.id]={id:other.id,title:other.title,level:'detected',position:{q:0,r:0}};v.sensorState.analyses[other.id]={layout:structuredClone(other.ship),at:'QA verified analysis'};}}
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
 await h.gm.goto(h.base+'/gm.html?campaign='+demo.code);await h.gm.evaluate(d=>sessionStorage.setItem('sa-gm-token-'+d.code,d.gmToken),demo);await h.gm.reload();await h.gm.getByRole('button',{name:'Combat',exact:true}).click();const gf=h.gm.frames().find(f=>f.url().includes('/index.html'));await gf.waitForFunction(()=>window.SACombatBridge?.state()?.units?.length);
 const visibility=async(expected,stage)=>{
  await f.waitForFunction(id=>{const ids=[...document.querySelectorAll('[data-ship-combat-lane]')].map(n=>n.dataset.shipCombatLane);return ids.length===1&&ids[0]===id;},expected);
  await gf.waitForFunction(()=>document.querySelectorAll('[data-ship-combat-lane]').length===3);
  const entry={stage,player:await f.locator('[data-ship-combat-lane]').evaluateAll(ns=>ns.map(n=>n.dataset.shipCombatLane)),gm:await gf.locator('[data-ship-combat-lane]').evaluateAll(ns=>ns.map(n=>n.dataset.shipCombatLane)),map:await f.locator('.combat-space-map [data-space-ship]').evaluateAll(ns=>ns.map(n=>n.dataset.spaceShip))};
  evidence.visibility||=[];evidence.visibility.push(entry);for(const id of [own.id,enemy.id,reserve.id])assert.ok(entry.map.includes(id),'visible map contact '+id);await p.screenshot({path:path.join(out,stage+'.png')});
 };
 await visibility(own.id,'docked-not-boarded');
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
  const response=p.waitForResponse(r=>r.url().endsWith('/api/action')&&r.request().postDataJSON()?.kind==='move');await confirm.click();const r=await response;evidence.responses||=[];evidence.responses.push({status:r.status(),body:await r.json()});assert.equal(r.status(),200);
  for(let i=0;i<60;i++){s=await state();const u=s.units.find(u=>u.id===actor.id);evidence.progress||=[];evidence.progress.push({i,location:u.location,timed:u.timedAction,activeId:s.activeId,activeAction:s.activeAction,transfers:s.starships.map(v=>v.ship.airlockDocking?.transfers)});if(!u.timedAction&&!s.starships.some(v=>v.ship.airlockDocking?.transfers?.length))break;await act({action:'step'});}
  s=await state();const u=s.units.find(u=>u.id===actor.id);assert.ok(!u.timedAction);evidence.arrivals||=[];evidence.arrivals.push({location:u.location,team:u.team});
  if(await p.locator('.expanded-interior-dialog[open]').count())await p.keyboard.press('Escape');return u;
 };
 let u=await move({square:hatch.square,mesh:4});assert.equal(u.location.starshipId,enemy.id);assert.equal(u.team,'pc');await visibility(enemy.id,'aboard-ally');
 f=await load();await visibility(enemy.id,'aboard-after-reload');
 u=await move({square:enemy.ship.airlocks[0].square-1,mesh:4},'direct');assert.equal(u.location.starshipId,enemy.id);
 u=await move({square:enemy.ship.airlocks[0].square,mesh:4},'direct');assert.equal(u.location.starshipId,own.id);await visibility(own.id,'returned-home');
 f=await load();await visibility(own.id,'returned-after-reload');
 const saved=await fetch(h.base+'/api/campaign/backup?code='+demo.code+'&token='+demo.gmToken).then(r=>r.json());assert.equal(saved.campaign.encounter.units.find(v=>v.id===actor.id).location.starshipId,own.id);
 assert.deepEqual(h.errors,[]);evidence.errors=h.errors;
})().catch(async e=>{evidence.failure=e.stack;if(h)await h.pc.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(evidence,null,2));await h?.stop();console.log(out);});
