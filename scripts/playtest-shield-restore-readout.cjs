// Owned production fixture. UI state injections below test display refresh only;
// command arithmetic/reservations are covered separately by the real engine test.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-shield-readout-')),results=[];
const seedModule=require('./fixtures/console-debug-sensors.cjs'),original=seedModule.seed;
seedModule.seed=(post,...args)=>original((route,body)=>{
 const add=s=>{if(!s.sicInventory.some(i=>i.id==='sh')){s.sicInventory.push({id:'sh',type:'shield-1'});s.placements.push({sicId:'sh',cell:220});}};
 if(route==='campaign/starship/link'&&body.starship.id==='debug-ship')add(body.starship);
 if(route==='action'&&body.action==='prepareEncounter')add(body.starships.find(s=>s.id==='debug-ship').ship);
 return post(route,body);
},...args);
let h;
async function main(){
 h=await require('./console-debug.cjs').startHarness({headless:true});
 const page=h.pc;page.setDefaultTimeout(15000);
 const baseline=process.argv.includes('--baseline');
 if(baseline){
  const before=path.resolve(__dirname,'../../SA-ATB Local Development Files/outputs/shield-restore-readout-oct30/before');
  for(const name of ['shield-console-ui.js','console-common.css'])await page.context().route('**/'+name+'*',r=>r.fulfill({status:200,contentType:name.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(path.join(before,name))}));
  await h.openConsole();
 }
 await page.getByRole('combobox',{name:'Station console',exact:true}).selectOption('sh');
 const v=page.locator('.shield-console-dialog[open]');await v.waitFor();
 await page.waitForFunction(()=>{const d=document.querySelector('.shield-console-dialog[open]');return d&&Math.abs(d.getBoundingClientRect().x)<2&&d.classList.contains('shared-console-layout');});
 let runtime;for(const f of page.frames())if(await f.evaluate(()=>typeof SACombatBridge!=='undefined'))runtime=f;
 assert.ok(runtime);
 const geometry=()=>v.evaluate(d=>Object.fromEntries(['.shield-field','.shield-timeline'].map(s=>{const r=d.querySelector(s).getBoundingClientRect();return[s,[r.x,r.y,r.width,r.height]];})));
 for(const [width,height]of [[1920,1080],[1366,768],[1280,720]]){
  await page.setViewportSize({width,height});await v.evaluate(async d=>{for(const a of d.getAnimations())await a.finished.catch(()=>{});});
  const before=await geometry();
  if(baseline){await page.screenshot({path:path.join(out,`before-${width}.png`)});results.push({width,height,geometry:before});continue;}
  await v.locator('[data-amount]').fill('3');
  await v.locator('[data-restore-readout]').filter({hasText:'Restore cost: 15 AU'}).waitFor();
  await runtime.evaluate(()=>{const old=SACombatBridge.state;const state=structuredClone(old());const ship=state.starships.find(s=>s.id==='debug-ship');ship.auState={...ship.auState,current:26,available:11,reserved:15,maximum:40};window.__readoutOriginal=old;SACombatBridge.state=()=>state;});
  await v.locator('[data-restore-readout]').filter({hasText:'Current AU: 26 / Max AU: 40'}).waitFor();
  const b=await v.locator('[data-restore-readout]').boundingBox();
  fs.writeFileSync(path.join(out,`bounds-${width}.json`),JSON.stringify({b,before,css:await v.locator('[data-restore-readout]').evaluate(e=>({display:getComputedStyle(e).display,parent:getComputedStyle(e.parentElement).display,html:e.parentElement.outerHTML}))},null,2));
  await page.screenshot({path:path.join(out,`production-${width}.png`)});
  assert.ok(b.x>=0&&b.x+b.width<=width&&b.height>0);
  assert.deepEqual(await geometry(),before,'readout must not move Field Integrity or Ring');
  await page.screenshot({path:path.join(out,`production-${width}.png`)});
  await v.locator('[data-amount]').fill('1.5');await v.locator('[data-restore-readout]').filter({hasText:'Restore cost: — AU'}).waitFor();assert.equal(await v.locator('[data-order="restore"]').isDisabled(),true);
  await runtime.evaluate(()=>{SACombatBridge.state=window.__readoutOriginal;delete window.__readoutOriginal;});
  await v.locator('[data-amount]').fill('1');results.push({width,height,geometry:before,readout:b,refresh:true,invalid:true});
 }
 if(baseline)return;
 await v.locator('[data-order="restore"]').click();
 await v.locator('[data-error]').filter({hasText:/missing|restore/i}).waitFor();
 results.push({actualServerRejection:await v.locator('[data-error]').textContent()});
 assert.deepEqual(h.errors,[]);
}
main().then(()=>console.log(JSON.stringify({out,results}))).catch(e=>{fs.writeFileSync(path.join(out,'failure.txt'),e.stack);console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));if(h)await h.stop();console.log('Evidence: '+out);});
