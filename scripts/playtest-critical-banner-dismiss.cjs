'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {harness,chromium}=require('./capture-console-layout.cjs');
(async()=>{
 const h=await harness(),browser=await chromium().launch({channel:'chrome',headless:true});
 const out=fs.mkdtempSync('C:/Users/zombi/AppData/Local/Temp/sa-critical-banner-'),results=[],errors=[];
 try{
  const p=await browser.newPage({reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));
  let serial=0;
  const banner=p.locator('.critical-flight-banner:not(.combat-waiting-notice)');
  const announce=async(type='detection')=>{await p.evaluate(({key,type})=>SAResultFeedback.critical(key,'Cinderwake detected',type),{key:'test-'+(++serial),type});await banner.waitFor({state:'visible'});await p.waitForTimeout(500);};
  const pointerDismiss=async()=>{const x=banner.locator('button'),r=await x.boundingBox();assert(r);await p.mouse.click(r.x+r.width/2,r.y+r.height/2);await banner.waitFor({state:'detached',timeout:1000});};
  const keyboardDismiss=async()=>{await banner.locator('button').focus();await p.keyboard.press('Enter');await banner.waitFor({state:'detached',timeout:1000});};
  for(const [width,height] of [[1280,720],[1366,768],[1920,1080]]){
   await p.setViewportSize({width,height});
   await p.goto(h.base+'/console-viewer.html?stage=1&family=weapon&type=beam-laser-1&inspection=interactive');
   const consoleView=p.locator('dialog[data-console-owner][open]').first();await consoleView.waitFor();await p.getByRole('button',{name:/^Exit Console$/i}).waitFor({state:'visible'});
   await p.addScriptTag({url:h.base+'/result-feedback.js'});
   const before=await consoleView.boundingBox();await announce();
   assert.equal(await banner.evaluate(b=>b.parentElement.matches('dialog:modal')),true);
   assert.equal(await p.getByRole('button',{name:/^Exit Console$/i}).isVisible(),true);
   const rect=await banner.boundingBox();assert.equal(rect.x,width*.25);assert.equal(rect.width,width*.5);
   await p.screenshot({path:path.join(out,'console-banner-'+width+'.png')});await pointerDismiss();assert.deepEqual(await consoleView.boundingBox(),before);
   await p.evaluate(()=>{const d=document.querySelector('dialog[data-console-owner]'),s=SACombatBridge.state().starships[0];s.ship.sicInventory.find(i=>i.id===d.dataset.sicId).status='powered-down';});
   await announce('warning');await pointerDismiss();
   await p.evaluate(()=>{const d=document.querySelector('dialog[data-console-owner]'),s=SACombatBridge.state().starships[0];delete s.ship.sicInventory.find(i=>i.id===d.dataset.sicId).status;});
   await announce('danger');await keyboardDismiss();assert.equal(await consoleView.isVisible(),true);
   await announce();
   await p.evaluate(()=>{const d=document.createElement('dialog');d.id='diagnostic-required';d.dataset.requiredRoll='true';d.innerHTML='<p>Required roll fixture</p><button type="button">Submit roll</button>';d.addEventListener('cancel',e=>e.preventDefault());document.body.append(d);d.showModal();});
   await p.waitForFunction(()=>document.querySelector('.critical-flight-banner')?.parentElement.id==='diagnostic-required');
   await p.screenshot({path:path.join(out,'nested-banner-'+width+'.png')});await pointerDismiss();assert.equal(await p.locator('#diagnostic-required').evaluate(d=>d.open),true);
   await announce('warning');await p.evaluate(()=>document.querySelector('#diagnostic-required').remove());
   await p.waitForFunction(()=>document.querySelector('.critical-flight-banner')?.parentElement.matches('dialog:modal'));
   await keyboardDismiss();await announce('combat-start');await p.screenshot({path:path.join(out,'combat-start-'+width+'.png')});await pointerDismiss();
   await p.getByRole('button',{name:/^Exit Console$/i}).click();await consoleView.waitFor({state:'hidden'});
   await announce();assert.equal(await banner.evaluate(b=>b.parentElement.tagName),'BODY');await keyboardDismiss();
   results.push({width,height,consoleMouse:true,consoleKeyboard:true,nestedMouse:true,requiredModalPreserved:true,removedModalRecovery:true,combatStartDismiss:true,exitConsole:true,bodyKeyboard:true,consoleGeometryPreserved:true});
  }
  // Production page host, its real loaded scripts and a browser-native modal; no saved campaign loaded.
  await p.goto(h.base+'/gm.html');await p.waitForFunction(()=>Boolean(window.SAResultFeedback));
  await announce();await pointerDismiss();
  await p.evaluate(()=>{const d=document.createElement('dialog');d.id='production-host-modal';d.dataset.requiredRoll='true';d.addEventListener('cancel',e=>e.preventDefault());d.innerHTML='<p>Isolated host check</p><button>Close</button>';document.body.append(d);d.showModal();});
  await announce();await keyboardDismiss();await p.keyboard.press('Escape');assert.equal(await p.locator('#production-host-modal').evaluate(d=>d.open),true,'required decision must survive Escape in production host');
  await announce('combat-start');await p.evaluate(()=>SAResultFeedback.critical('after-expiry','Queued detection','detection'));
  await p.waitForFunction(()=>document.querySelector('.critical-flight-banner')?.dataset.type==='detection',{},{timeout:12000});
  await pointerDismiss();assert.equal(await p.locator('#production-host-modal').evaluate(d=>d.open),true);
  results.push({productionGMHost:true,bodyMouse:true,modalKeyboard:true,combatStartAutomaticExpiry:true,queueAdvance:true});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({at:new Date().toISOString(),base:h.base,data:h.data,results,errors,limits:'Console Debug fixture plus production GM host without a live campaign; required modal is a synthetic protected-decision fixture. No user saves.'},null,2));console.log(out);console.log(JSON.stringify(results));
 }finally{await browser.close();await h.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
