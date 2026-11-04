const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {harness,chromium}=require('./capture-console-layout.cjs');
const entries=require('../console-layout-catalog').entries(require('../console-viewer').catalog);
(async()=>{const h=await harness(),b=await chromium().launch({headless:true,channel:'chrome'}),out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-rapid-power-'));try{
 const p=await b.newPage(),errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
 for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:1280,height:720}])for(let tier=1;tier<=5;tier++){
  await p.setViewportSize(viewport);const entry=entries.find(e=>e.id==='rapid-laser-'+tier);await p.goto(h.base+'/'+entry.url);await p.locator('dialog[open]').waitFor();await p.waitForTimeout(700);
  const choices=p.locator('[data-sacrifice-choice]');assert.equal(await choices.count(),4);assert.equal(await p.locator('[data-sacrifice]').isVisible(),false);
  for(let n=0;n<4;n++){await choices.nth(n).click();assert.equal(await p.locator('[data-sacrifice]').inputValue(),String(n));assert.equal(await p.locator('[data-sacrifice-choice][aria-pressed="true"]').count(),1);assert.match(await choices.nth(n).textContent(),new RegExp('/ '+(5-n)+' AU'));}
  await choices.nth(0).focus();await p.keyboard.press('Enter');assert.equal(await p.locator('[data-sacrifice]').inputValue(),'0');
  const rects=await choices.evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));for(const r of rects)assert(r.x>=0&&r.right<=viewport.width&&r.y>=0&&r.bottom<=viewport.height);
  await p.waitForTimeout(300);assert.equal(await p.locator('[data-sacrifice]').inputValue(),'0');
  if(tier===1)await p.screenshot({path:path.join(out,'rapid-'+viewport.width+'.png')});checks.push({tier,viewport,rects});
 }
 // Isolated preview state and request interception exercise the real renderer's
 // command wiring; these do not stand in for authenticated engine tests.
 await p.evaluate(()=>{const s=SACombatBridge.state(),u=s.units[0];u.delayedAction={remaining:50};});await p.waitForTimeout(250);
 assert.equal(await p.locator('[data-sacrifice-choice]:disabled').count(),4);
 await p.evaluate(()=>{const s=SACombatBridge.state();delete s.units[0].delayedAction;s.activeId=s.units[0].id;});await p.waitForTimeout(250);
 assert.equal(await p.locator('[data-sacrifice-choice]:disabled').count(),0);
 const options=await p.locator('[data-target] option').evaluateAll(es=>es.map(e=>e.value).filter(Boolean));assert(options.length);await p.locator('[data-target]').selectOption(options[0]);await p.locator('[data-sacrifice-choice="2"]').click();
 await p.evaluate(()=>{window.rapidRequests=[];SACombatBridge.action=async body=>{rapidRequests.push(body);throw Error('Isolated rejection');};});await p.locator('[data-fire]').click();await p.waitForTimeout(250);
 assert.match(await p.locator('[data-error]').textContent(),/Isolated rejection/);assert.equal(await p.locator('[data-sacrifice]').inputValue(),'2');assert.equal(await p.evaluate(()=>rapidRequests[0].sacrifice),2);
 await p.evaluate(()=>{SACombatBridge.action=async body=>{rapidRequests.push(body);};});await p.locator('[data-fire]').click();await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>rapidRequests.length),2);assert.equal(await p.evaluate(()=>rapidRequests[1].sacrifice),2);
 await p.locator('[data-formula]').scrollIntoViewIfNeeded();assert(await p.locator('[data-formula]').isVisible());
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks,errors,requestWiring:'isolated preview rejection/retry'},null,2));console.log(out);
}finally{await b.close();await h.stop()}})().catch(e=>{console.error(e);process.exitCode=1});
