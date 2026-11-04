const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {harness,chromium}=require('./capture-console-layout.cjs');const entries=require('../console-layout-catalog').entries(require('../console-viewer').catalog);
(async()=>{const h=await harness(),b=await chromium().launch({headless:true,channel:'chrome'}),out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-security-toggles-'));try{const p=await b.newPage(),errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:1280,height:720}]){
 await p.setViewportSize(viewport);await p.goto(h.base+'/'+entries.find(e=>e.id==='security-droid').url);await p.locator('.security-droid-console[open]').waitFor();await p.evaluate(()=>document.fonts.load('15px Orbitron'));await p.waitForTimeout(500);
 await p.evaluate(()=>{window.droidRequests=[];window.rejectDroid=true;SACombatBridge.utilityAction=async body=>{droidRequests.push(body);if(rejectDroid)throw Error('Isolated rejection');const ship=SACombatBridge.state().starships[0];ship.ship.securityDroidState||={};ship.ship.securityDroidState.droids||={};const d=ship.ship.securityDroidState.droids[body.sicId]||={};if(body.kind==='exempt'){d.exemptions||={};d.exemptions[body.crewId]=body.enabled;}else d[body.kind]=body.enabled;};});
 const enabled=p.locator('[data-setting=enabled]');await enabled.focus();await p.keyboard.press('Space');assert.match(await p.locator('.utility-controls [role=status]').textContent(),/Isolated rejection/);assert(await enabled.isChecked());assert(await enabled.evaluate(e=>document.activeElement===e));
 await p.evaluate(()=>{rejectDroid=false;});await p.keyboard.press('Space');assert(!await enabled.isChecked());assert(await enabled.evaluate(e=>document.activeElement===e));await p.locator('[data-setting=warning]').click();assert(!await p.locator('[data-setting=warning]').isChecked());await p.locator('[data-crew-id]').first().click();assert(!await p.locator('[data-crew-id]').first().isChecked());await p.waitForTimeout(500);assert(!await enabled.isChecked());
 const metrics=await enabled.evaluate(e=>({font:getComputedStyle(e.closest('label')).font,background:getComputedStyle(e).backgroundImage,role:e.getAttribute('role')}));assert.match(metrics.font,/15px.*Orbitron/);assert.match(metrics.background,/linear-gradient/);assert.equal(metrics.role,'switch');
 await p.locator('.utility-controls').hover();await p.mouse.wheel(0,900);await p.waitForTimeout(200);await p.screenshot({path:path.join(out,'security-scrolled-'+viewport.width+'.png')});await p.locator('.utility-controls').evaluate(e=>{e.scrollTop=0;});await p.screenshot({path:path.join(out,'security-'+viewport.width+'.png')});
 await p.evaluate(()=>{const original=SAStationAccess.access;window.restoreDroidAccess=()=>{SAStationAccess.access=original;};SAStationAccess.access=(...args)=>{const a=original(...args);return a?{...a,offline:true}:a;};});await p.waitForTimeout(500);assert.equal(await p.locator('.security-droid-console input:disabled').count(),3);await p.evaluate(()=>restoreDroidAccess());await p.waitForTimeout(500);assert.equal(await p.locator('.security-droid-console input:disabled').count(),0);
  const crew=p.locator('[data-crew-id]').first();await crew.focus();await crew.evaluate(e=>{window.originalCrewToggle=e;});await p.keyboard.press('Space');await p.waitForTimeout(500);assert(await crew.isChecked());assert(await crew.evaluate(e=>document.activeElement===e&&e===originalCrewToggle));
  const crewId=await crew.getAttribute('data-crew-id');await p.evaluate(id=>{const s=SACombatBridge.state(),u=s.units.find(u=>u.characterId===id||u.id===id);u.characterName='Renamed crew';},crewId);await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>document.activeElement.dataset.crewId),crewId);
  await p.evaluate(()=>{const s=SACombatBridge.state();s.starships[0].crewNpcUnitIds=[...(s.starships[0].crewNpcUnitIds||[]),'extra-crew'];s.units.push({id:'extra-crew',characterName:'Extra crew'});});await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>document.activeElement.dataset.crewId),crewId);
  await p.evaluate(id=>{const ship=SACombatBridge.state().starships[0];ship.crewCharacterIds=(ship.crewCharacterIds||[]).filter(x=>x!==id);ship.crewNpcUnitIds=(ship.crewNpcUnitIds||[]).filter(x=>x!==id);},crewId);await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>document.activeElement.dataset.crewId),'extra-crew');
  await p.evaluate(()=>{const ship=SACombatBridge.state().starships[0];ship.crewCharacterIds=[];ship.crewNpcUnitIds=[];});await p.waitForTimeout(500);assert(await p.locator('[data-crew]').evaluate(e=>document.activeElement===e));assert.match(await p.locator('[data-crew]').innerText(),/No registered crew/);
  const requests=await p.evaluate(()=>droidRequests);assert.deepEqual(requests.map(r=>r.kind),['enabled','enabled','warning','exempt','exempt']);assert.equal(requests[3].enabled,false);assert.equal(requests[4].enabled,true);
  const delayed=[];
  for(const mode of ['success','failure','focus-moved','tab-moved','background-click']){
   await p.evaluate(mode=>{const action=SACombatBridge.utilityAction;window.previousDroidAction=action;rejectDroid=mode==='failure';SACombatBridge.utilityAction=body=>new Promise((resolve,reject)=>{window.finishDroid=()=>action(body).then(resolve,reject);});},mode);
   await enabled.focus();await p.keyboard.press('Space');await p.waitForTimeout(850);assert(await enabled.isDisabled());assert(await p.evaluate(()=>document.activeElement===document.body));
   if(mode==='focus-moved')await p.locator('[data-setting=warning]').evaluate(e=>{const heading=e.closest('dialog').querySelector('h2');heading.tabIndex=-1;heading.focus();});
   if(mode==='tab-moved')await p.keyboard.press('Tab');
   if(mode==='background-click')await p.locator('.utility-controls h3').click();
   const before=await p.evaluate(()=>document.activeElement.tagName);await p.evaluate(()=>finishDroid());await p.waitForTimeout(100);
   assert(!await enabled.isDisabled());
   if(mode==='success'||mode==='failure')assert(await enabled.evaluate(e=>document.activeElement===e),mode+' restores originating switch');
   else assert(!(await enabled.evaluate(e=>document.activeElement===e)),mode+' must not steal focus');
   if(mode==='focus-moved')assert.equal(await p.evaluate(()=>document.activeElement.tagName),'H2');
   if(mode==='failure')assert.match(await p.locator('.utility-controls [role=status]').textContent(),/Isolated rejection/);
   delayed.push({mode,before,after:await p.evaluate(()=>document.activeElement.tagName)});
   await p.evaluate(()=>{SACombatBridge.utilityAction=previousDroidAction;rejectDroid=false;});
  }
  const delayedCrew=[];
  for(const timing of ['early','late'])for(const change of ['rename','remove','empty','rename-away'])for(const failure of [false,true]){
   await p.evaluate(failure=>{const s=SACombatBridge.state(),ship=s.starships[0];ship.crewCharacterIds=[];ship.crewNpcUnitIds=['pending-a','pending-b'];s.units=s.units.filter(u=>!u.id.startsWith('pending-'));s.units.push({id:'pending-a',characterName:'Pending A'},{id:'pending-b',characterName:'Pending B'});const action=SACombatBridge.utilityAction;window.previousDroidAction=action;rejectDroid=failure;SACombatBridge.utilityAction=body=>new Promise((resolve,reject)=>{window.finishDroid=()=>action(body).then(resolve,reject);});},failure);
   await p.waitForTimeout(500);await p.locator('[data-crew-id="pending-a"]').focus();await p.keyboard.press('Space');
   if(timing==='late'){await p.waitForTimeout(850);assert(await p.evaluate(()=>document.activeElement===document.body));}
   else assert(!(await p.locator('[data-crew-id="pending-a"]').isDisabled()),'early roster update must precede pending disable');
   if(change==='rename-away')await p.locator('.utility-controls h3').evaluate(e=>{e.tabIndex=-1;e.focus();});
   await p.evaluate(change=>{const s=SACombatBridge.state();if(change.startsWith('rename'))s.units.find(u=>u.id==='pending-a').characterName='Renamed during request';else s.starships[0].crewNpcUnitIds=change==='remove'?['pending-b']:[];},change);await p.waitForTimeout(500);await p.evaluate(()=>finishDroid());await p.waitForTimeout(100);
   const focus=await p.evaluate(()=>document.activeElement.dataset.crewId||document.activeElement.getAttribute('aria-label')||document.activeElement.tagName);
   assert.equal(focus,change==='rename'?'pending-a':change==='remove'?'pending-b':change==='rename-away'?'H3':'Registered crew');
   if(failure)assert.match(await p.locator('.utility-controls [role=status]').textContent(),/Isolated rejection/);
   delayedCrew.push({timing,change,failure,focus});await p.evaluate(()=>{SACombatBridge.utilityAction=previousDroidAction;rejectDroid=false;});
  }
  checks.push({viewport,metrics,requests,delayed,delayedCrew});
}
await p.goto(h.base+'/'+entries.find(e=>e.id==='sensor-lure').url);await p.locator('.illusion-droid-console[open]').waitFor();assert.equal(await p.locator('.security-droid-console').count(),0);assert(!await p.locator('.utility-controls p').first().evaluate(e=>getComputedStyle(e).font.includes('Orbitron')));assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks,errors},null,2));console.log(out);
}finally{await b.close();await h.stop()}})().catch(e=>{console.error(e);process.exitCode=1});
