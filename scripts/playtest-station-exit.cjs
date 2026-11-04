const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'scripts/playtest-showcase-refresh.cjs');
process.env.SA_SHOWCASE_OUT=process.env.SA_STATION_EXIT_OUT||path.resolve(root,'../SA-ATB Local Development Files/outputs/station-exit-ui-nov03/browser');
let text=fs.readFileSync(source,'utf8');
// Reuse the real boarding/movement setup, without repeating its unrelated
// deliberate icon-child corruption probe on every station-exit journey.
const iconStart=text.indexOf('  // Exercise the actual child-replacement mutation');
const iconEnd=text.indexOf("  evidence.iconRepaired=true;",iconStart);
if(iconStart<0||iconEnd<0)throw Error('Missing icon-probe boundary');
text=text.slice(0,iconStart)+text.slice(iconEnd+"  evidence.iconRepaired=true;".length);
// This is a manually driven access test, not an unattended battle: ordinary
// unrelated earned turns must be passed before the GM can advance travel time.
const stepBoundary="break;await act({action:'step'});}";
if(!text.includes(stepBoundary))throw Error('Missing travel-step boundary');
text=text.replace(stepBoundary,"break;if(s.activeId&&s.activeId!==actor.id&&!s.activeAction){evidence.passedOtherTurns||=[];evidence.passedOtherTurns.push(s.activeId);await act({action:'completeTurn',id:s.activeId});}await act({action:'step'});}");
const marker="evidence.intruder=true;";
const probe=String.raw`
 { const doors=require('../ship-doors'), access=require('../station-access');
 await ready();
 const current=(await state()).starships.find(v=>v.id===enemy.id),layout=maps.buildLayout(current.ship);
 let chosen;
 for(const key of doors.list(current)){
  const cells=key.split(':').map(Number);
  for(const inside of cells){
   const cell=layout.footprint.get(inside);if(!cell||!maps.definition(cell.type).bridge)continue;
   const outside=cells.find(n=>n!==inside),delta=inside-outside;
   const near={square:outside,mesh:delta===1?5:delta===-1?3:delta>0?7:1};
   const far={square:inside,mesh:delta===1?3:delta===-1?5:delta>0?1:7};
   const plan=await f.evaluate(({id,d})=>SACombatMap.planMove(id,d),{id:actor.id,d:near});
   if(plan.route?.length){chosen={key,near,far,sicId:cell.sicId};break;}
  }if(chosen)break;
 }
 assert.ok(chosen,'Reachable closed Bridge door');evidence.door=chosen;
 await move(chosen.near);await ready();
 const blocked=await f.evaluate(({id,d})=>SACombatMap.planMove(id,d),{id:actor.id,d:chosen.far});
 evidence.closedDoorPlan=blocked;assert.ok(blocked.error,'PC planner blocks closed hostile doorway');
 const raw=async body=>{const r=await fetch(h.base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json',Connection:'close'},body:JSON.stringify({roomCode:demo.code,characterId:pc.id,characterToken:pc.token,id:actor.id,...body})});return{status:r.status,body:await r.json()};};
 const before=await state();
 const rejected=await raw({action:'playerCombatAction',kind:'move',route:[{environment:'starship',starshipId:enemy.id,...chosen.far,sicId:chosen.sicId}]});
 evidence.closedDoorSubmit=rejected;assert.equal(rejected.status,409);assert.match(rejected.body.error,/closed door blocks intruders/);
 const after=await state();assert.deepEqual(after.units.find(v=>v.id===actor.id).location,before.units.find(v=>v.id===actor.id).location);assert.equal(after.activeId,before.activeId);
 const unrelated=await raw({action:'operateCombatDoor',starshipId:own.id,doorKey:doors.list(own)[0]});assert.equal(unrelated.status,403);evidence.otherShipDenied=true;
 evidence.adjacentDoorOperation=await raw({action:'operateCombatDoor',starshipId:enemy.id,doorKey:chosen.key});
 assert.equal(evidence.adjacentDoorOperation.status,200);
 await f.waitForFunction(({ship,key})=>SACombatBridge.state().starships.find(v=>v.id===ship)?.ship.doorStates?.[key]==='open',{ship:enemy.id,key:chosen.key});
 const seats=require('../ship-automation').seats(current).filter(v=>v.bridge&&v.sicId===chosen.sicId);
 let destination;for(const seat of seats){const plan=await f.evaluate(({id,d})=>SACombatMap.planMove(id,d),{id:actor.id,d:seat});if(plan.route?.length){destination=seat;break;}}
 assert.ok(destination,'Available Bridge station after opening door');
 u=await move(destination);evidence.stationArrival=u.location;
 assert.equal(u.location.stationed,true);assert.equal(u.location.starshipId,enemy.id);
 s=await state();assert.ok(!s.starships.find(v=>v.id===enemy.id).crewCharacterIds.includes(pc.id));
 const consoles=access.consoles(s,s.units.find(v=>v.id===actor.id));assert.ok(consoles.some(v=>v.kind==='pilot'));evidence.physicalTakeover=consoles.map(v=>({id:v.id,kind:v.kind,ship:v.ship.id}));
 await ready();const launcher=p.getByRole('button',{name:'Console View',exact:true});await launcher.click();
 await p.screenshot({path:path.join(out,'enemy-bridge-console.png'),fullPage:true});
 evidence.consoleVisibleText=(await p.locator('body').innerText()).slice(-6000);
 const sensor=consoles.find(v=>v.kind==='sensor');
 const request={action:'sensorCommand',sicId:sensor.id,kind:'hex',hex:{q:10,r:10},requestId:'intruder-empty-hex-check'};
 const submitted=await raw(request);assert.equal(submitted.status,200);evidence.sensorSubmitted=true;
 s=await state();assert.equal(s.units.find(v=>v.id===actor.id).delayedAction.sensorOrder.shipId,enemy.id);
 f=await load();s=await state();assert.equal(s.units.find(v=>v.id===actor.id).location.stationed,true);evidence.reloadStation=true;
 for(let i=0;i<30;i++){s=await state();if(!s.units.find(v=>v.id===actor.id).delayedAction)break;await act({action:'step'});}
 s=await state();evidence.sensorCompletion={pending:s.units.find(v=>v.id===actor.id).delayedAction||null,reports:s.starships.find(v=>v.id===enemy.id).sensorState?.reports};
 assert.equal(evidence.sensorCompletion.pending,null);
 const clickExit=async(label,inline=false)=>{
  await ready();const openConsole=p.getByRole('button',{name:'Console View',exact:true});if(await openConsole.isVisible())await openConsole.click();
  const consoleLeave=p.getByRole('button',{name:'Leave Console',exact:true});
  if(await consoleLeave.isVisible())await consoleLeave.click();
  else {await p.getByRole('button',{name:'Exit Console',exact:true}).click();await f.getByRole('button',{name:'Leave Console',exact:true}).click();}
  let host=p.locator('.expanded-interior-dialog[open]');await host.waitFor();
  if(inline){await p.keyboard.press('Escape');await host.waitFor({state:'detached'});host=f.locator('[data-inline-ship-map]').filter({has:f.locator('[data-inline-get-up]')}).filter({visible:true}).first();}
  const before=(await state()).units.find(v=>v.id===actor.id),button=host.getByRole('button',{name:'Get Up',exact:true});await button.waitFor();
  await p.screenshot({path:path.join(out,label+'-get-up.png'),fullPage:true});
  if(!inline){let intercepted=0;await p.route('**/api/action',async route=>{if(route.request().postDataJSON()?.kind==='getUp'&&!intercepted++){await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Station exit test rejection; try again.'})});}else await route.continue();});
   await button.click();await host.getByText('Station exit test rejection; try again.',{exact:true}).waitFor();assert.equal((await state()).units.find(v=>v.id===actor.id).location.stationed,true);await p.unroute('**/api/action');evidence.visibleRejectedRetry=true;
  }
  const response=p.waitForResponse(r=>r.url().endsWith('/api/action')&&r.request().postDataJSON()?.kind==='getUp');await button.click();assert.equal((await response).status(),200);
  await f.waitForFunction(id=>SACombatBridge.state().units.find(u=>u.id===id)?.location.stationed===false,actor.id);
  const after=(await state()).units.find(v=>v.id===actor.id);assert.deepEqual(after.location,{...before.location,stationed:false,stationSlot:null});assert.equal(after.team,before.team);
  if(!inline)await p.locator('.expanded-interior-dialog[open]').waitFor({state:'detached'});
  evidence[label]={realConsoleLeaveClick:true,realGetUpClick:true,locationPreserved:true,inline};
 };
 await clickExit('hostile');
 s=await state();assert.equal(s.units.find(v=>v.id===actor.id).location.stationed,false);
 const denied=await raw({...request,requestId:'intruder-after-leaving'});assert.equal(denied.status,409);evidence.afterLeavingDenied=denied.body;
 const spoof=await fetch(h.base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomCode:demo.code,characterId:pc.id,characterToken:pc.token,id:pilot.id,...request,requestId:'intruder-spoof-actor'})});assert.equal(spoof.status,403);evidence.spoofDenied=true;
 await move({square:enemy.ship.airlocks[0].square,mesh:4});
 await ready();let friendlySeat;for(const seat of require('../ship-automation').seats(own).filter(v=>v.bridge)){const plan=await f.evaluate(({id,d})=>SACombatMap.planMove(id,d),{id:actor.id,d:seat});if(plan.route?.length){friendlySeat=seat;break;}}
 assert.ok(friendlySeat);await move(friendlySeat);await clickExit('friendly',true);
 f=await load();assert.equal((await state()).units.find(v=>v.id===actor.id).location.stationed,false);evidence.reloadAfterExit=true;
 assert.deepEqual(h.errors,[]);evidence.finished=true;return; }
`;
if(!text.includes(marker))throw Error('Missing insertion checkpoint');
text=text.replace(marker,marker+probe);
const mod=new Module(source,module);mod.filename=source;mod.paths=Module._nodeModulePaths(path.dirname(source));mod._compile(text,source);
