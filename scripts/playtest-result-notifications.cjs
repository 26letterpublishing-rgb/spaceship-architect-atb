const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const seedModule=require('./fixtures/console-debug-sensors.cjs'),originalSeed=seedModule.seed;
seedModule.seed=(post,...args)=>originalSeed((route,body)=>{const add=ship=>{if(!ship.sicInventory.some(i=>i.id==='lk')){ship.sicInventory.push({id:'lk',type:'lock-on-1'});ship.placements.push({sicId:'lk',cell:220});}};if(route==='campaign/starship/link'&&body.starship.id==='debug-ship')add(body.starship);if(route==='action'&&body.action==='prepareEncounter')add(body.starships.find(s=>s.id==='debug-ship').ship);return post(route,body);},...args);
const {startHarness}=require('./console-debug.cjs');
const out=path.resolve(process.argv[2]||'../SA-ATB Local Development Files/outputs/result-notices-oct26');fs.mkdirSync(out,{recursive:true});
let h;const result={rows:[],errors:[]};
(async()=>{try{h=await startHarness({headless:true});const p=h.pc;await h.panel.close();await h.gm.close();const v=p.locator('.sensor-console[open]');await v.waitFor();await v.evaluate(async n=>Promise.all(n.ownerDocument.getAnimations().filter(a=>Number.isFinite(a.effect?.getTiming().iterations)).map(a=>a.finished.catch(()=>{}))));
if(!process.argv.includes('--tooltips-only')){
async function push(suffix){await p.evaluate(s=>{SAInterfaceNotices.setCombatActive(true);SAResultFeedback.push('scan-'+s,'Scan: no dice required','Difficulty too low to fail: guaranteed contacts will be detected. Any impossible contacts remain undetected.');SAResultFeedback.push('analysis-'+s,'Systems Analysis','Systems Analysis of White Dwarf: processing (10 combat seconds).');},suffix);}
await push('baseline');const button=p.getByRole('button',{name:'Dismiss Scan: no dice required',exact:true});await button.waitFor();await p.screenshot({path:path.join(out,'before-click.png')});
const geometry=await button.evaluate(n=>{const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,180),parent:n.closest('.interface-notice-rail').parentElement.tagName}});
await p.mouse.click(geometry.x,geometry.y);const removed=await button.count()===0;result.rows.push({geometry,removed});
if(process.argv.includes('--before')){await p.waitForTimeout(8500);result.after8500=await p.locator('.result-notifications article').count();return;}
assert.ok(removed,'real pointer dismiss works in modal Console');
const second=p.getByRole('button',{name:'Dismiss Systems Analysis',exact:true});await second.focus();await p.keyboard.press('Enter');await second.waitFor({state:'detached'});
for(const [width,height]of [[1920,1080],[1366,768],[1280,720]]){await p.setViewportSize({width,height});await push('timer-'+width);const started=Date.now();await p.waitForTimeout(1000);await push('timer-'+width);assert.equal(await p.locator('.result-notifications article').count(),2,'repeat packet not duplicated');
await p.screenshot({path:path.join(out,'notices-'+width+'.png')});await p.waitForFunction(()=>!!document.querySelector('.result-notifications article')?.getAnimations().length,{},{timeout:8500});const fading=Date.now()-started;await p.waitForFunction(()=>!document.querySelector('.result-notifications article'),{},{timeout:2000});result.rows.push({width,height,fading,removedAt:Date.now()-started});assert.ok(fading>=7700&&fading<9000);await push('timer-'+width);assert.equal(await p.locator('.result-notifications article').count(),0,'expired notice does not reappear');}
await v.locator('[data-hold]').focus();await push('nested');await p.keyboard.press('Enter');const hold=p.getByRole('dialog',{name:'Hold at 99%',exact:true});await hold.waitFor();await p.getByRole('button',{name:'Dismiss Systems Analysis',exact:true}).click();assert.ok(await hold.isVisible());await p.keyboard.press('Escape');await hold.waitFor({state:'hidden'});await p.getByRole('button',{name:'Dismiss Scan: no dice required',exact:true}).click();
await push('cleanup');await p.evaluate(()=>SAInterfaceNotices.setCombatActive(false));assert.equal(await p.locator('.result-notifications article').count(),0);
for(const [width,height]of [[1920,1080],[1366,768],[1280,720]]){
 await p.setViewportSize({width,height});await p.evaluate(w=>{SAInterfaceNotices.setCombatActive(true);SAResultFeedback.critical('compact-'+w,'Enemy ship systems analysis is complete','analysis-complete');},width);
 const banner=p.locator('.combat-analysis-banner');await banner.waitFor();await p.waitForFunction(()=>getComputedStyle(document.querySelector('.combat-analysis-banner strong')).fontSize==='18px');
 const box=await banner.evaluate(e=>{const r=e.getBoundingClientRect(),t=e.querySelector('strong');return{width:r.width,height:r.height,x:r.x,font:getComputedStyle(t).fontSize,textHeight:t.getBoundingClientRect().height};});assert.ok(box.width<600&&box.height<55);assert.ok(box.textHeight<30);assert.ok(Math.abs(box.x+box.width/2-width/2)<2);assert.equal(await p.locator('.critical-flight-banner').count(),0);
 await p.screenshot({path:path.join(out,'compact-analysis-'+width+'.png')});const start=Date.now();await banner.waitFor({state:'detached',timeout:7000});assert.ok(Date.now()-start>4500);result.rows.push({analysis:box,width});
}
}
await p.getByRole('combobox',{name:'Station console',exact:true}).selectOption('lk');await p.locator('.lock-console[open]').waitFor();
let frame;for(const candidate of p.frames())if(await candidate.evaluate(()=>Boolean(window.SACombatBridge?.myUnitId?.())).catch(()=>false)){frame=candidate;break;}assert.ok(frame);
await frame.evaluate(()=>{window.__tooltipOriginal=SACombatBridge.state;window.__tooltipState=structuredClone(SACombatBridge.state());SACombatBridge.state=()=>window.__tooltipState;const s=window.__tooltipState,u=s.units.find(u=>u.id===SACombatBridge.myUnitId()),ship=s.starships.find(s=>s.id===u.location.starshipId),target=s.starships.find(s=>s.id!==ship.id);ship.sensorState??={};ship.sensorState.contacts={[target.id]:{id:target.id,title:target.title,level:'detected'}};});
await p.waitForTimeout(350);await p.locator('.lock-console[open] [data-target]').selectOption({index:1});
for(const mode of ['other','holding','ready']){
 await frame.evaluate(mode=>{const s=window.__tooltipState,u=s.units.find(u=>u.id===SACombatBridge.myUnitId());s.activeId=mode==='other'?'other-unit':u.id;u.consoleHold=mode==='holding';delete u.delayedAction;delete u.delayTimer;delete u.timedAction;},mode);
 const lock=p.locator('.lock-console[open] [data-lock]');await p.waitForTimeout(350);
 if(mode==='ready'){assert.equal(await lock.isDisabled(),false);assert.match(await lock.getAttribute('title'),/dice/i);}else{assert.equal(await lock.isDisabled(),true);assert.equal(await lock.getAttribute('title'),"It's not your turn!");}
 result.rows.push({lockMode:mode,title:await lock.getAttribute('title')});
}
await p.locator('.lock-console[open] [data-action-help=lock]').click();assert.ok(await p.getByRole('dialog',{name:'Lock-On',exact:true}).isVisible());await p.keyboard.press('Escape');await p.getByRole('dialog',{name:'Lock-On',exact:true}).waitFor({state:'detached'});
await frame.evaluate(()=>{const s=window.__tooltipState,u=s.units.find(u=>u.id===SACombatBridge.myUnitId());s.activeId='other-unit';const ship=s.starships.find(s=>s.id===u.location.starshipId);ship.sensorState.contacts={};});await p.waitForTimeout(350);assert.match(await p.locator('.lock-console[open] [data-lock]').getAttribute('title'),/Detect and choose/);
await frame.evaluate(()=>{SACombatBridge.state=window.__tooltipOriginal;});
await p.getByRole('combobox',{name:'Station console',exact:true}).selectOption('cp');await p.locator('[data-command-page]').click();
await frame.evaluate(()=>{window.__tooltipOriginal=SACombatBridge.state;window.__tooltipState=structuredClone(SACombatBridge.state());SACombatBridge.state=()=>window.__tooltipState;});
for(const mode of ['other','holding','ready']){
 await frame.evaluate(mode=>{const s=window.__tooltipState,u=s.units.find(u=>u.id===SACombatBridge.myUnitId());s.activeId=mode==='other'?'other-unit':u.id;u.consoleHold=mode==='holding';delete u.delayedAction;delete u.delayTimer;delete u.timedAction;},mode);await p.waitForTimeout(350);
 const team=p.locator('[data-command="team"]');assert.equal(await team.isDisabled(),mode!=='ready');assert.equal(await team.getAttribute('title'),mode==='ready'?await frame.evaluate(()=>SAActionHelp.descriptions.team[1]):"It's not your turn!");result.rows.push({commandMode:mode,title:await team.getAttribute('title')});
}
await frame.evaluate(()=>{SACombatBridge.state=window.__tooltipOriginal;});assert.deepEqual(h.errors,[]);result.pass=true;
} catch(e){result.errors.push(e.stack);throw e;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));await h?.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
