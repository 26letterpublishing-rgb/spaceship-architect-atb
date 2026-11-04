const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {harness,chromium}=require('./capture-console-layout.cjs');
const entries=require('../console-layout-catalog').entries(require('../console-viewer').catalog);
(async()=>{const h=await harness(),b=await chromium().launch({headless:true,channel:'chrome'}),out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-repair-drone-text-'));try{
 const p=await b.newPage(),errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
 for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:1280,height:720}])for(let tier=1;tier<=5;tier++){
  await p.setViewportSize(viewport);await p.goto(h.base+'/'+entries.find(e=>e.id==='repair-drone-'+tier).url);await p.locator('.drone-console[open]').waitFor();await p.waitForTimeout(700);
  assert.equal(await p.locator('.utility-scene').innerText(),'');assert.equal(await p.locator('.utility-controls [data-drone-status]').count(),1);
  const text=await p.locator('.utility-controls').innerText();assert.match(text,/Docked.*waiting for Hull damage/);assert.match(text,/Repair rolls do not interrupt your turn/);
  const geometry=await p.locator('[data-drone-status]').evaluate(e=>({text:e.parentElement.getBoundingClientRect().toJSON(),panel:e.closest('.utility-controls').getBoundingClientRect().toJSON()}));assert(geometry.text.x>=geometry.panel.x&&geometry.text.right<=geometry.panel.right&&geometry.text.bottom<=geometry.panel.bottom);
  await p.evaluate(()=>{const s=SACombatBridge.state(),ship=s.starships[0];ship.ship.droneState={drones:{preview:{phase:'repairing',progress:50,rate:10}}};});await p.waitForTimeout(250);assert.match(await p.locator('[data-drone-status]').textContent(),/Repairing.*5.0s/);
  for(const [phase,expected] of [['returning','Returning to bay'],['destroyed','Drone destroyed']]){await p.evaluate(phase=>{SACombatBridge.state().starships[0].ship.droneState.drones.preview.phase=phase;},phase);await p.waitForTimeout(250);assert.equal(await p.locator('[data-drone-status]').textContent(),expected);}
  if(tier===1)await p.screenshot({path:path.join(out,'repair-'+viewport.width+'.png')});checks.push({tier,viewport,geometry});
 }
 // Intercept only the isolated preview bridge to check existing command wiring.
 await p.evaluate(()=>{const s=SACombatBridge.state();s.practice=false;s.activeId=s.units[0].id;s.starships[0].droneRepairTargets=[{id:'test-target',title:'Test hull'}];window.repairRequests=[];SACombatBridge.utilityAction=async body=>{repairRequests.push(body);throw Error('Isolated rejection');};});await p.waitForTimeout(250);
 await p.locator('[data-drone-target]').click();assert.match(await p.locator('[data-status]').innerText(),/Isolated rejection/);
 await p.evaluate(()=>{SACombatBridge.utilityAction=async body=>{repairRequests.push(body);};});await p.locator('[data-drone-target]').click();assert.equal(await p.locator('[data-status]').innerText(),'Repair order confirmed.');
 const requests=await p.evaluate(()=>repairRequests);assert.equal(requests.length,2);for(const r of requests){assert.equal(r.kind,'repair-ship');assert.equal(r.targetId,'test-target');assert.equal(r.sicId,'preview');}
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks,requests,errors},null,2));console.log(out);
}finally{await b.close();await h.stop()}})().catch(e=>{console.error(e);process.exitCode=1});
