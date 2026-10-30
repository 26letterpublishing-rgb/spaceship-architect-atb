const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.argv[2]||'../SA-ATB Local Development Files/outputs/lock-map-fit-oct26/browser');fs.mkdirSync(out,{recursive:true});
// Reuse the owned-server helper; extend only its disposable seed requests.
const seedModule=require('./fixtures/console-debug-sensors.cjs'),seed=seedModule.seed;
function addLock(ship){if(!ship.sicInventory.some(i=>i.id==='lk')){ship.sicInventory.push({id:'lk',type:'lock-on-1'});ship.placements.push({sicId:'lk',cell:220});}}
seedModule.seed=(post,...args)=>seed((route,body)=>{if(route==='campaign/starship/link'&&body.starship.id==='debug-ship')addLock(body.starship);if(route==='action'&&body.action==='prepareEncounter'){addLock(body.starships.find(s=>s.id==='debug-ship').ship);body.shipPositions.find(p=>p.id==='debug-target').q=1;const enemy=body.starships.find(s=>s.id==='debug-target');if(enemy)enemy.ship.sicInventory.find(i=>i.id==='veil').type='lock-on-1';}return post(route,body);},...args);
const {startHarness}=require('./console-debug.cjs');seedModule.seed=seed;
let h;const result={rows:[],zoom:'100%',deviceScaleFactor:1};
(async()=>{try{
 h=await startHarness({headless:true});await h.gm.close();await h.panel.close();const p=h.pc;
 const select=()=>p.getByRole('combobox',{name:'Station console',exact:true});
 await select().selectOption('lk');const v=p.getByRole('dialog',{name:'Lock-On console',exact:true});await v.waitFor();
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
 }catch(e){result.error=e.stack;process.exitCode=1;console.error(e);}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));await h?.stop();}})();
