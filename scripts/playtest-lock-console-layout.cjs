const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.argv[2]||'../SA-ATB Local Development Files/outputs/lock-map-fit-oct26/browser');fs.mkdirSync(out,{recursive:true});
// Reuse the owned-server helper; extend only its disposable seed requests.
const seedModule=require('./fixtures/console-debug-sensors.cjs'),seed=seedModule.seed;
function addLock(ship){if(!ship.sicInventory.some(i=>i.id==='lk')){ship.sicInventory.push({id:'lk',type:'lock-on-1'});ship.placements.push({sicId:'lk',cell:220});}}
seedModule.seed=(post,...args)=>seed((route,body)=>{if(route==='campaign/starship/link'&&body.starship.id==='debug-ship')addLock(body.starship);if(route==='action'&&body.action==='prepareEncounter'){addLock(body.starships.find(s=>s.id==='debug-ship').ship);body.shipPositions.find(p=>p.id==='debug-target').q=1;const enemy=body.starships.find(s=>s.id==='debug-target');if(enemy)enemy.ship.sicInventory.find(i=>i.id==='veil').type='lock-on-1';}return post(route,body);},...args);
const {startHarness}=require('./console-debug.cjs');seedModule.seed=seed;
let h;const result={rows:[],zoom:'100%',deviceScaleFactor:1};
(async()=>{try{
 h=await startHarness({headless:true});if(!process.env.SA_LOCK_COMPONENT)await h.gm.close();await h.panel.close();const p=h.pc;
 const select=()=>p.getByRole('combobox',{name:'Station console',exact:true});
 await select().selectOption('lk');const v=p.getByRole('dialog',{name:'Lock-On console',exact:true});await v.waitFor();
 if(process.env.SA_LOCK_COMPONENT){await componentChecks(h,p,v,result);result.errors=h.errors;assert.deepEqual(h.errors,[]);result.pass=true;return;}
 async function measure(active){return active.evaluate(el=>{const box=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};const svg=el.querySelector('[data-space-canvas]'),scope=el.querySelector('.lock-scope')||svg.parentElement;return {scope:box(scope),svg:box(svg),viewBox:svg.getAttribute('viewBox'),ships:[...svg.querySelectorAll('[data-space-ship]')].map(n=>({id:n.dataset.spaceShip,box:box(n)})),fonts:[...el.querySelectorAll('h3,button')].map(n=>[n.textContent,getComputedStyle(n).fontSize])};});}
 for(const [width,height]of [[1920,1080],[1366,768],[1280,720],[1920,1080]]){
  await p.setViewportSize({width,height});await p.waitForTimeout(500);
  const beforeCss=false;
  const normal=await measure(v);if(!beforeCss){assert.ok(normal.svg.h<=normal.scope.h+1);assert.ok(normal.svg.h>=normal.scope.h-5);for(const ship of normal.ships){assert.ok(ship.box.y>=normal.scope.y-1);assert.ok(ship.box.y+ship.box.h<=normal.scope.y+normal.scope.h+1,JSON.stringify(ship));}}
  await p.screenshot({path:path.join(out,`lock-${width}-normal.png`)});
  for(const name of ['Component','Incoming','Ship'])await v.getByRole('tab',{name,exact:true}).click();
  assert.equal(await v.locator('[data-lock]').isEnabled(),true);await v.locator('[data-lock]').scrollIntoViewIfNeeded();assert.equal(await v.locator('[data-lock]').isVisible(),true);
  for(let cycle=0;cycle<2;cycle++){await v.locator('[data-space-enlarge]').click();const large=p.getByRole('dialog',{name:'Space map',exact:true});await large.waitFor();const expanded=await measure(large);assert.ok(expanded.svg.h>normal.svg.h);if(!cycle)await p.screenshot({path:path.join(out,`lock-${width}-enlarged.png`)});await p.keyboard.press('Escape');await large.waitFor({state:'hidden'});assert.equal((await measure(v)).viewBox,normal.viewBox);}
  result.rows.push({width,height,normal,returned:await measure(v)});
 }
 result.adjacent=[];
 for(const station of ['sn','cp']){await select().selectOption(station);const dialog=p.getByRole('dialog',{name:station==='sn'?'Sensor console':'Pilot console',exact:true});await dialog.waitFor();await p.waitForTimeout(800);for(const [width,height]of [[1920,1080],[1366,768],[1280,720]]){await p.setViewportSize({width,height});await p.waitForTimeout(400);const parity=await dialog.evaluate(el=>{const rule=[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules]}catch{return []}}).find(r=>r.selectorText?.startsWith('dialog.lock-console.shared-console-layout:not'));if(!rule)throw Error('override missing');const snapshot=()=>[...el.querySelectorAll('svg,h3,button')].map(n=>{const r=n.getBoundingClientRect();return [n.tagName,r.x,r.y,r.width,r.height,getComputedStyle(n).fontSize]});const selector=rule.selectorText,before=snapshot();rule.selectorText=':not(*)';const without=snapshot();rule.selectorText=selector;return {before,without,matches:el.querySelectorAll(selector).length};});assert.deepEqual(parity.before,parity.without);assert.equal(parity.matches,0);result.adjacent.push({station,width,height,parity:true});await p.screenshot({path:path.join(out,`${station}-${width}.png`)});}}
 // Keep the original real-pointer exit/reopen assertion that exposed ownership loss.
 await select().selectOption('lk');await v.waitFor();
 await v.locator('.dialog-circle-close').click();await v.waitFor({state:'hidden'});
 result.exit=true;await p.locator('[data-console-view]').click({timeout:3000});await v.waitFor();
 result.lifecycle=[];
 for(const [width,height]of [[1920,1080],[1366,768],[1280,720]]){
  await p.setViewportSize({width,height});
  for(const [station,name]of [['lk','Lock-On console'],['sn','Sensor console'],['cp','Pilot console']]){
   await select().selectOption(station);const dialog=p.getByRole('dialog',{name,exact:true});await dialog.waitFor();await p.waitForTimeout(800);
   for(const dismissal of ['button','escape','button']){
    // Nested prompts must keep their own X and must not consume the parent Exit.
    await dialog.locator('[data-hold]').click();const hold=p.getByRole('dialog',{name:'Hold at 99%',exact:true});await hold.waitFor();
    if(dismissal==='escape')await p.keyboard.press('Escape');else await hold.getByRole('button',{name:'Close dialog',exact:true}).click();
    await hold.waitFor({state:'hidden'});assert.equal(await dialog.isVisible(),true);
    if(dismissal==='escape')await p.keyboard.press('Escape');else if(station==='sn')await dialog.getByRole('button',{name:'Exit Console',exact:true}).click();else await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();
    await dialog.waitFor({state:'hidden'});const launcher=p.locator('[data-console-view]');await launcher.waitFor({state:'visible'});assert.equal(await launcher.getAttribute('aria-hidden'),null);
    await launcher.click();await dialog.waitFor();await p.waitForTimeout(800);if(station==='sn')await dialog.getByRole('button',{name:'Exit Console',exact:true}).waitFor({state:'visible'});result.lifecycle.push({station,width,height,dismissal,pass:true});
   }
   await p.screenshot({path:path.join(out,`reopened-${station}-${width}.png`)});
  }
 }
 result.errors=h.errors;assert.deepEqual(h.errors,[]);result.pass=true;
 }catch(e){result.errors=h?.errors;await h?.pc.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});result.error=e.stack;process.exitCode=1;console.error(e);}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));await h?.stop();}})();

async function componentChecks(h,p,v,result){
 const sensors=require('../ship-sensors'),f=h.fixture;const step=name=>fs.appendFileSync(path.join(out,'steps.txt'),name+'\n');step('begin');
 const fetchBackup=()=>fetch(`${h.base}/api/campaign/backup?code=${f.code}&token=${f.token}`).then(r=>r.json());
 async function restore(edit){const backup=await fetchBackup();edit(backup.campaign.encounter);const response=await fetch(h.base+'/api/campaign/restore',{method:'POST',headers:{'Content-Type':'application/json',Connection:'close'},body:JSON.stringify({code:f.code,token:f.token,backup})});assert.equal(response.status,200,await response.text());await p.waitForTimeout(650);}
 await v.getByRole('tab',{name:'Component',exact:true}).click();assert.equal(await v.locator('[data-component-sic]').count(),0);await v.getByRole('tab',{name:'Ship',exact:true}).click();
 await restore(e=>{const own=e.starships.find(s=>s.id==='debug-ship'),target=e.starships.find(s=>s.id==='debug-target'),u=e.units.find(u=>u.characterId===f.characterId);target.ship.sicInventory.find(i=>i.id==='veil').type='lock-on-5';target.ship.shipDirection='up';target.ship.unifiedShipFacing=true;target.ship.shipRotation=0;const effect={id:'qa-analysis',sensorReport:{shipId:own.id,targetId:target.id,values:[20],total:20}};u.queuedEffects=[effect];sensors.resolveReport(e,u,effect);own.lockState={targets:[{targetId:target.id,systemId:'lk',sicIds:[],remaining:12}],failures:{},receipts:[],reports:[]};e.activeId=u.id;u.atb=100;u.delayedAction=null;u.delayTimer=null;u.timedAction=null;u.consoleHold=false;});
 const button=v.locator('[data-component-picker]'),select=v.locator('[data-component]'),floor=v.locator('.lock-component-floor');
 let requests=[];const track=r=>{if(r.url().includes('/api/action'))requests.push(r.postDataJSON());};p.on('request',track);
 await v.locator('[data-space-canvas]').evaluate(svg=>{const frame=Array.from({length:window.frames.length},(_,i)=>window.frames[i]).find(w=>w.SASpaceMap);(window.SASpaceMap||frame?.SASpaceMap)?.zoom(svg,1.2);});
 const camera=await v.locator('[data-space-canvas]').getAttribute('viewBox');
 await v.getByRole('tab',{name:'Component',exact:true}).click();await floor.locator('[data-component-sic="veil"]').first().waitFor();
 const original=await select.inputValue();await button.click();await v.getByRole('option',{name:/Lock-On System 5/}).hover();assert.equal(await select.inputValue(),original);assert.ok(await floor.locator('.component-preview[data-component-sic="veil"]').count()>0);await p.keyboard.press('Escape');assert.equal(await v.isVisible(),true);assert.equal(await select.inputValue(),original);
 await button.click();await p.keyboard.press('End');await p.keyboard.press('Enter');assert.ok(await select.inputValue());
 await floor.locator('[data-component-sic="cp"]').first().click();assert.equal(await select.inputValue(),'cp');
 await button.click();await v.getByRole('option',{name:/Lock-On System 5/}).click();assert.equal(await select.inputValue(),'veil');await p.waitForTimeout(450);assert.equal(await select.inputValue(),'veil');assert.equal(requests.length,0,'Preview and selection never submit an action');
 result.component=[];
 for(const [width,height]of [[1920,1080],[1366,768],[1280,720]]){
  await p.setViewportSize({width,height});await p.waitForTimeout(400);
  const geometry=await floor.evaluate(el=>{const b=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};return {floor:b(el),ship:b(el.querySelector('.inline-map-orientation')),cells:el.querySelectorAll('[data-component-sic]').length,rotation:el.querySelector('[data-display-rotation]').dataset.displayRotation};});
  assert.ok(geometry.ship.w<=geometry.floor.w&&geometry.ship.h<=geometry.floor.h,JSON.stringify(geometry));assert.ok(geometry.floor.w>300&&geometry.floor.h>200,JSON.stringify(geometry));
  await floor.locator('[data-component-sic="veil"]').last().click();assert.equal(await select.inputValue(),'veil');
  await p.screenshot({path:path.join(out,`component-${width}-closed.png`)});await button.click();await p.screenshot({path:path.join(out,`component-${width}.png`)});await v.locator('h2').click();assert.equal(await button.getAttribute('aria-expanded'),'false');result.component.push({width,height,geometry});
 }
 await v.getByRole('tab',{name:'Incoming',exact:true}).click();assert.equal(await floor.isVisible(),false);await v.getByRole('tab',{name:'Ship',exact:true}).click();assert.equal(await v.locator('[data-space-canvas]').getAttribute('viewBox'),camera);
 for(const direction of ['right','down','left']){await restore(e=>{e.starships.find(s=>s.id==='debug-ship').sensorState.analyses['debug-target'].layout.shipDirection=direction;});await v.getByRole('tab',{name:'Component',exact:true}).click();await floor.locator('[data-component-sic="veil"]').last().click();assert.equal(await select.inputValue(),'veil');const rotation=await floor.locator('[data-display-rotation]').getAttribute('data-display-rotation');assert.equal(Number(rotation),require('../ship-map-core').displayRotation({ship:{shipDirection:direction,unifiedShipFacing:true}},270));}
 step('selection geometry rotation passed');
 // Reopening preserves the selected target; tiers share the same production renderer.
 for(const tier of [1,5,10]){step('tier '+tier);await restore(e=>{e.starships.find(s=>s.id==='debug-ship').ship.sicInventory.find(i=>i.id==='lk').type='lock-on-'+tier;});await v.getByRole('button',{name:'Close dialog',exact:true}).click();await v.waitFor({state:'detached'});await p.locator('[data-console-view]').click();await v.waitFor();await v.getByRole('tab',{name:'Component',exact:true}).click();await floor.locator('[data-component-sic="veil"]').last().click();assert.equal(await select.inputValue(),'veil');assert.equal(await v.locator('[data-sic]').isEnabled(),true);}
 step('submit component order');
 const beforeOrder=await fetchBackup();
 const response=p.waitForResponse(r=>r.url().includes('/api/action')&&r.request().postDataJSON()?.action==='lockCommand');
 await v.locator('[data-sic]').click();const accepted=await response;assert.equal(accepted.status(),200,await accepted.text());const order=accepted.request().postDataJSON();assert.equal(order.kind,'sic');assert.equal(order.targetId,'debug-target');assert.equal(order.targetSicId,'veil');result.componentOrder={accepted:true,targetId:order.targetId,targetSicId:order.targetSicId};
 const reset=await fetch(h.base+'/api/campaign/restore',{method:'POST',headers:{'Content-Type':'application/json',Connection:'close'},body:JSON.stringify({code:f.code,token:f.token,backup:beforeOrder})});assert.equal(reset.status,200);await p.waitForTimeout(800);
 step('reload');await h.openConsole();await p.getByRole('combobox',{name:'Station console',exact:true}).selectOption('lk');await v.waitFor();await v.getByRole('tab',{name:'Component',exact:true}).click();await floor.locator('[data-component-sic="veil"]').last().click();assert.equal(await select.inputValue(),'veil');result.reload=true;
 // No private GM crew data may appear even when the same preview is opened by the GM.
 step('GM parity');const gmFrame=h.gm.frameLocator('#atbFrame');await gmFrame.locator('#initiativePanel').waitFor({state:'attached'});
 const frame=h.gm.frames().find(fr=>fr.url().includes('index.html'))||h.gm.frames().find(fr=>fr!==h.gm.mainFrame());
 await frame.evaluate(()=>{const b=window.SACombatBridge,u=b.state().units.find(u=>u.characterId==='debug-pc');window.SALockConsoleUI.open(u,'lk');});
 const gv=h.gm.getByRole('dialog',{name:'Lock-On console',exact:true});await gv.waitFor();await gv.getByRole('tab',{name:'Component',exact:true}).click();assert.equal(await gv.locator('.lock-component-floor .combat-token').count(),0);assert.equal(await gv.locator('[data-component-sic]').count(),await floor.locator('[data-component-sic]').count());await gv.evaluate(d=>d.close());result.gmParity=true;
 // Adjacent Consoles retain their controls; the read-only allowlist is Lock-On-scoped.
 step('adjacent parity');for(const [id,name]of [['sn','Sensor console'],['cp','Pilot console']]){await p.getByRole('combobox',{name:'Station console',exact:true}).selectOption(id);const other=p.getByRole('dialog',{name,exact:true});await other.waitFor();assert.equal(await other.locator('[data-component-picker]').count(),0);await other.getByRole('button',{name:'Close dialog',exact:true}).count();}
 await p.getByRole('combobox',{name:'Station console',exact:true}).selectOption('lk');await v.waitFor();await v.getByRole('tab',{name:'Component',exact:true}).click();
 step('target and departure transitions');
 await v.locator('[data-target]').selectOption('');assert.equal(await select.inputValue(),'');assert.equal(await floor.locator('[data-component-sic]').count(),0);await v.locator('[data-target]').selectOption('debug-target');await floor.locator('[data-component-sic="veil"]').last().click();
 const beforeDeparture=await fetchBackup();
 for(const kind of ['escape','warp']){
  await restore(e=>{const target=e.starships.find(s=>s.id==='debug-target');if(kind==='escape')target.escapedAt=new Date().toISOString();else target.ship.warpState={phase:'traveling'};});
  await p.waitForFunction(()=>document.querySelector('.lock-console [data-component]')?.value==='',{},{timeout:4000});assert.equal(await floor.locator('[data-component-sic]').count(),0);
  const response=await fetch(h.base+'/api/campaign/restore',{method:'POST',headers:{'Content-Type':'application/json',Connection:'close'},body:JSON.stringify({code:f.code,token:f.token,backup:beforeDeparture})});assert.equal(response.status,200);await p.waitForTimeout(800);await v.locator('[data-target]').selectOption('debug-target');await floor.locator('[data-component-sic="veil"]').last().click();
 }
 result.departures=true;
 step('destruction');await f.act({action:'damageStarship',starshipId:'debug-target',amount:9999});await p.waitForTimeout(800);result.destroyedState=(await h.state()).starships.map(s=>({id:s.id,hp:s.currentHullHp,destroyed:s.destroyedAt}));result.pcDestroyed=await fetch(`${h.base}/api/state?room=${f.code}&token=${f.pcToken}`).then(r=>r.json()).then(s=>({ships:s.starships?.map(t=>({id:t.id,hp:t.currentHullHp,destroyed:t.destroyedAt})),active:s.activeId}));result.clientDestroyed=[];for(const frame of p.frames()){const state=await frame.evaluate(()=>window.SACombatBridge?.state?.()).catch(()=>null);if(state)result.clientDestroyed.push({ships:state.starships?.map(t=>({id:t.id,hp:t.currentHullHp,destroyed:t.destroyedAt})),active:state.activeId});}result.targetOptions=await v.locator('[data-target]').innerHTML();await p.waitForFunction(()=>document.querySelector('.lock-console [data-component]')?.value==='',{},{timeout:4000});assert.equal(await select.inputValue(),'');assert.equal(await floor.locator('[data-component-sic]').count(),0);
 p.off('request',track);result.selectionRequests=requests.length;
 step('standalone Debug compatibility');await h.gm.goto(h.base+'/console-viewer.html');await h.gm.locator('#family').selectOption('lock');const stage=h.gm.frameLocator('#stage'),debug=stage.getByRole('dialog',{name:'Lock-On console',exact:true});await debug.waitFor();await debug.locator('[data-target]').selectOption('dummy');await debug.getByRole('tab',{name:'Component',exact:true}).click();await debug.locator('[data-component-sic]').first().waitFor();await debug.locator('[data-component-sic="target-sensor"]').first().click();assert.equal(await debug.locator('[data-component]').inputValue(),'target-sensor');assert.equal(await debug.locator('[data-sic]').isEnabled(),false);result.debugPreview=true;

}
