// One disposable production combat fixture, never an existing user session.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-gravity-feedback-')),results=[];
const seed=require('./fixtures/console-debug-sensors.cjs'),original=seed.seed;
seed.seed=(post,...args)=>original((route,body)=>{const add=s=>{for(const[id,type,cell]of[['sh','shield-1',220],['gaf','gravity-absolution-field',116]])if(!s.sicInventory.some(i=>i.id===id)){s.sicInventory.push({id,type});s.placements.push({sicId:id,cell});}};if(route==='campaign/starship/link'&&body.starship.id==='debug-ship')add(body.starship);if(route==='action'&&body.action==='prepareEncounter')add(body.starships.find(s=>s.id==='debug-ship').ship);return post(route,body);},...args);
let h;
async function main(){
 h=await require('./console-debug.cjs').startHarness({headless:true});const p=h.pc;await p.bringToFront();
 await p.getByRole('combobox',{name:'Station console',exact:true}).selectOption('gaf');
 const v=p.locator('dialog.utility-console[data-sic-id="gaf"][open]');await v.waitFor();await v.getByRole('button',{name:'Exit Console',exact:true}).waitFor();
 await p.waitForFunction(()=>Math.abs(document.querySelector('dialog.utility-console[open]').getBoundingClientRect().x)<2);
 const unit=(await h.state()).units.find(u=>u.characterId===h.fixture.characterId);
 for(const active of [true,false]){
  if(!active)await h.fixture.act({action:'nudge',id:unit.id,amount:100});
  await p.evaluate(()=>{window.__feedbackRows=[];const sample=()=>{const d=document.querySelector('dialog.utility-console[open]'),b=d?.querySelector('[data-console-view]');__feedbackRows.push({at:performance.now(),stage:!!document.querySelector('.combat-effect-stage[open]'),exit:!!b&&!b.hidden&&getComputedStyle(d).visibility!=='hidden'});};window.__feedbackObserver=new MutationObserver(sample);__feedbackObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open','data-impact-presenting']});sample();});
  await v.locator('[data-toggle]').click();await v.locator('[data-phase]').filter({hasText:active?'FIELD ACTIVE':'INACTIVE'}).waitFor();
  // Observe beyond the former 1300ms stage plus 500ms launcher polling window.
  await p.waitForTimeout(1900);
  const rows=await p.evaluate(()=>{__feedbackObserver.disconnect();return __feedbackRows;});
  assert.ok(rows.every(r=>!r.stage&&r.exit),JSON.stringify(rows));assert.equal(Boolean((await h.state()).starships.find(s=>s.id==='debug-ship').ship.gravityFieldState.active),active);
  results.push({active,rows});await p.screenshot({path:path.join(out,active?'active.png':'inactive.png')});
  await v.getByRole('button',{name:'Exit Console',exact:true}).click();await v.waitFor({state:'hidden'});await p.locator('[data-console-view]').click();await v.waitFor();await v.getByRole('button',{name:'Exit Console',exact:true}).waitFor();
 }
 const beforeDamage=(await h.state()).starships.find(s=>s.id==='debug-ship');
 await h.fixture.act({action:'damageStarship',starshipId:'debug-ship',amount:11});
 const afterDamage=(await h.state()).starships.find(s=>s.id==='debug-ship');
 assert.ok(afterDamage.currentHullHp+afterDamage.currentShieldHp<beforeDamage.currentHullHp+beforeDamage.currentShieldHp,'real damage fixture must lose HP after shield reduction');
 const stage=p.locator('.combat-effect-stage[open]');await stage.waitFor();await p.screenshot({path:path.join(out,'real-damage.png')});
 await stage.waitFor({state:'detached'});await v.getByRole('button',{name:'Exit Console',exact:true}).waitFor();results.push({realDamageStage:true,exitRecovered:true});
 assert.deepEqual(h.errors,[]);
}
main().then(()=>console.log(JSON.stringify({out,results}))).catch(e=>{fs.writeFileSync(path.join(out,'failure.txt'),e.stack);console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));await h?.stop();console.log('Evidence: '+out);});
