const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {harness,chromium}=require('./capture-console-layout.cjs');
const entries=require('../console-layout-catalog').entries(require('../console-viewer').catalog);
(async()=>{const h=await harness(),b=await chromium().launch({headless:true,channel:'chrome'}),out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-breach-text-'));try{
 const p=await b.newPage(),errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
 for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:1280,height:720}]){
  await p.setViewportSize(viewport);await p.goto(h.base+'/'+entries.find(e=>e.id==='hull-breach-repair-drone').url);await p.locator('.breach-drone-console[open]').waitFor();await p.evaluate(()=>document.fonts.load('15px Orbitron'));await p.waitForTimeout(700);
  const metrics=await p.locator('.utility-controls').evaluate(e=>({font:getComputedStyle(e.querySelector('p')).font,heading:getComputedStyle(e.querySelector('h3')).font,overflow:getComputedStyle(e).overflowY,scroll:e.scrollHeight,height:e.clientHeight,bounds:e.getBoundingClientRect().toJSON(),loaded:document.fonts.check('15px Orbitron')}));assert(metrics.loaded);assert.match(metrics.font,/15px.*Orbitron/);assert.match(metrics.heading,/15px.*Orbitron/);assert(['auto','scroll'].includes(metrics.overflow));
  await p.locator('.utility-controls').hover();await p.mouse.wheel(0,600);await p.waitForTimeout(250);const visible=await p.locator('[data-queue]').evaluate(e=>{const r=e.getBoundingClientRect(),q=e.closest('.utility-controls').getBoundingClientRect();return r.top>=q.top&&r.bottom<=q.bottom;});assert(visible);
  await p.screenshot({path:path.join(out,'breach-scrolled-'+viewport.width+'.png')});
  await p.locator('.utility-controls').evaluate(e=>{e.scrollTop=0;});await p.screenshot({path:path.join(out,'breach-'+viewport.width+'.png')});
  await p.evaluate(()=>{const ship=SACombatBridge.state().starships[0];ship.ship.breachState={holes:{a:{sealed:false},b:{sealed:true}}};ship.ship.breachDroneState={drones:{preview:{phase:'repairing',die:8,remaining:5}}};});await p.waitForTimeout(300);assert.equal(await p.locator('[data-status]').innerText(),'Sealing breach: D8 in 5.0s');assert.equal(await p.locator('[data-queue]').innerText(),'1 open breach');assert.equal(await p.locator('[data-progress]').evaluate(e=>e.value),7);
  await p.evaluate(()=>{SACombatBridge.state().starships[0].ship.breachDroneState.drones.preview.phase='awaiting-roll';});await p.waitForTimeout(300);assert.equal(await p.locator('[data-status]').innerText(),'Awaiting GM repair roll: D8');
  checks.push({viewport,metrics});
 }
 // Shared stylesheet consumer remains on its original typography.
 await p.goto(h.base+'/'+entries.find(e=>e.id==='repair-drone-1').url);await p.locator('.drone-console[open]').waitFor();const otherFont=await p.locator('.utility-controls p').first().evaluate(e=>getComputedStyle(e).font);assert(!otherFont.includes('Orbitron'));
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks,otherFont,errors},null,2));console.log(out);
}finally{await b.close();await h.stop()}})().catch(e=>{console.error(e);process.exitCode=1});
