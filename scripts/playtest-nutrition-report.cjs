const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {harness,chromium}=require('./capture-console-layout.cjs'),entries=require('../console-layout-catalog').entries(require('../console-viewer').catalog);
(async()=>{const h=await harness(),browser=await chromium().launch({headless:true,channel:'chrome'}),out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-nutrition-report-')),checks=[],errors=[];try{
 const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));
 const start=async choice=>{await p.evaluate(n=>{window.savedRandom=Math.random;Math.random=()=>n/4+.01;},choice);await p.locator('[data-dispense]').click();await p.evaluate(()=>{Math.random=savedRandom;});};
 for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:1280,height:720}]){
  await p.setViewportSize(viewport);await p.goto(h.base+'/'+entries.find(e=>e.id==='nutritional-supplement').url);await p.locator('.nut-terminal-report').waitFor();await p.locator('[data-flavor=base]').selectOption('6');await p.locator('[data-flavor=blend]').selectOption('1');await p.locator('select[data-texture]').selectOption('Extra thick');
  for(let choice=0;choice<4;choice++){
   await start(choice);assert(await p.locator('[data-dispense]').isDisabled());assert.equal(await p.locator('[data-report]>div').count(),1);assert(await p.locator('.nut-blob').isHidden());
   await p.evaluate(()=>{window.scrollSamples=[];window.sampleReport=setInterval(()=>{const r=document.querySelector('[data-report]');scrollSamples.push({top:r.scrollTop,lines:r.children.length});},80);});
   await p.locator('.nut-blob').waitFor({state:'visible',timeout:4000});assert(await p.locator('[data-dispense]').isEnabled());await p.waitForFunction(()=>document.querySelector('[data-report]').children.length===11);await p.evaluate(()=>clearInterval(sampleReport));
   const text=await p.locator('[data-report]').innerText();assert(text.includes('Your Mint + Chocolate is complete.'));assert(text.includes('Applying Extra thick'));
   const samples=await p.evaluate(()=>scrollSamples);assert(samples.some((s,i)=>i&&s.lines===samples[i-1].lines&&s.top===samples[i-1].top),'discrete stationary intervals');const metrics=await p.locator('[data-report]').evaluate(e=>({behavior:getComputedStyle(e).scrollBehavior,top:e.scrollTop,height:e.scrollHeight,client:e.clientHeight,role:e.getAttribute('role')}));assert.equal(metrics.behavior,'auto');assert.equal(metrics.role,'log');if(metrics.height>metrics.client)assert(metrics.top>0);
   await p.screenshot({path:path.join(out,'report-'+viewport.width+'-'+choice+'.png')});await p.locator('.nut-blob').click();await p.waitForTimeout(450);assert.equal(await p.locator('[data-report]').innerText(),'Tastes like chicken');checks.push({viewport,choice,text,metrics,samples});
  }
  await start(0);await p.locator('.nut-blob').waitFor({state:'visible'});await start(1);assert.equal(await p.locator('[data-report]>div').count(),1);assert.match(await p.locator('[data-report]').innerText(),/^001101/);await p.evaluate(()=>document.querySelector('dialog.utility-console').close());await p.waitForTimeout(700);assert.equal(await p.locator('.nut-terminal-report').count(),0);await p.evaluate(()=>SAUtilityConsoleUI.open(SACombatBridge.state().units[0],'preview'));await p.locator('.nut-terminal-report').waitFor();assert.equal(await p.locator('[data-report]').innerText(),'No meal dispensed.');
 }
 await p.goto(h.base+'/'+entries.find(e=>e.id==='life-support').url);await p.locator('.life-machine').waitFor();assert.equal(await p.locator('.nut-terminal-report').count(),0);assert.match(await p.locator('[data-report]').innerText(),/Gravity restored/);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks,errors},null,2));console.log(out);
}finally{await browser.close();await h.stop();}})().catch(e=>{console.error(e);process.exitCode=1});
