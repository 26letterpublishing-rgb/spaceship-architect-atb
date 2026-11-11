const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-floorplan-toolbar-')),rows=[];
let h,browser;
(async()=>{
 const {harness,chromium}=require('./capture-console-layout.cjs');h=await harness();h.errors=[];
 const post=async(route,body)=>{const r=await fetch(h.base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert(r.ok,JSON.stringify(d));return d;};
 const f=await require('./fixtures/console-debug-sensors.cjs').seed(post,1,'ready');
 await f.act({action:'setRunning',running:true});await f.act({action:'setHardPaused',paused:true});
 const state=await fetch(h.base+'/api/state?room='+f.code+'&token='+f.token).then(r=>r.json());assert.equal(state.hasEngagedClock,true);const unit=state.units.find(u=>u.characterId===f.characterId);await f.act({action:'nudge',id:unit.id,amount:100});
 browser=await chromium().launch({channel:'chrome',headless:true});const p=await browser.newPage({viewport:{width:1366,height:768}});h.pc=p;p.on('pageerror',e=>h.errors.push(e.message));
 await p.addInitScript(f=>{sessionStorage.setItem('sa-character-token-'+f.code+'-'+f.characterId,f.pcToken);localStorage.setItem('sa-character-token-'+f.code+'-'+f.characterId,f.pcToken);},JSON.parse(JSON.stringify(f)));
 await p.goto(h.base+'/character.html?campaign='+f.code+'&character='+f.characterId);
 const unlock=p.getByRole('button',{name:'Enter PC Code',exact:true});if(await unlock.isVisible()){await unlock.click();await p.getByRole('textbox',{name:'Enter PC Code',exact:true}).fill(f.password);await p.getByRole('button',{name:'Unlock Character',exact:true}).click();}
 await p.getByRole('button',{name:'Starships',exact:true}).click();
 await p.locator('[data-player-ship-details]').waitFor();
 const frame=p.frames().find(f=>f.url().includes('starship.html')&&f.url().includes('embeddedRecord'));assert(frame);
 // Let the real combat-start banner expire before comparing floorplan pixels.
 await p.waitForFunction(()=>!document.querySelector('.combat-start-banner'));
 const toolbar=frame.locator('.desktop-grid-toolbar');
 const measure=()=>toolbar.evaluate(n=>{const r=n.getBoundingClientRect(),v=n.parentElement.getBoundingClientRect();return {height:r.height,top:r.top-v.top,width:r.width,text:n.textContent,selected:!!n.parentElement.querySelector('.embedded-move-bottom')};});
 const compact=async selecting=>{const m=await measure();assert(m.height>=28&&m.height<=64,JSON.stringify(m));assert.equal(m.selected,selecting);if(selecting)assert(m.top>=5&&m.top<=10,JSON.stringify(m));return m;};
 const shot=async name=>{await p.waitForTimeout(700);await p.screenshot({path:path.join(out,name+'.png')});};
 for(const [width,height]of [[967,836],[1280,720],[1366,768],[1920,1080]]){
  await p.setViewportSize({width,height});await toolbar.scrollIntoViewIfNeeded();await p.waitForTimeout(300);
  const idle=await compact(false);
  await frame.locator('[data-action=begin]:visible').first().click();
  await frame.locator('.desktop-grid-viewport > .embedded-move-bottom').waitFor();await toolbar.scrollIntoViewIfNeeded();
  const selecting=await compact(true);await shot('selecting-'+width);
  const station=frame.locator('[data-embedded-station]:visible').first();
 await frame.waitForFunction(()=>[...document.querySelectorAll('[data-embedded-station]')].filter(n=>n.getClientRects().length).some(n=>[...n.options].some(o=>o.value&&!o.disabled&&/Sensors/.test(o.textContent))));
  const options=await station.locator('option').evaluateAll(ns=>ns.map(n=>({value:n.value,text:n.textContent,disabled:n.disabled})));
  const target=options.find(n=>n.value&&!n.disabled&&/Sensors/.test(n.text));assert(target);
  // Real pointer selection on the map, not a synthetic destination assignment.
  await frame.getByRole('button',{name:'Fit Ship',exact:true}).filter({visible:true}).first().click();
  await frame.locator('[data-grid-index="'+target.value.split(':')[0]+'"]:visible').click();
  const circle=frame.locator('[data-destination-confirm]:visible');await circle.waitFor();
  const confirm=frame.locator('.embedded-move-controls [data-action=confirm]:visible').first();
  assert.equal(await confirm.isEnabled(),true);assert.equal(await confirm.textContent(),'Confirm Move');
  await compact(true);await confirm.scrollIntoViewIfNeeded();await shot('destination-'+width);
  const camera=await frame.evaluate(()=>({zoom:mapView.zoom,panX:mapView.panX,panY:mapView.panY}));
  await frame.getByRole('button',{name:'Enlarge ship interior',exact:true}).filter({visible:true}).first().click();
  const dialog=p.getByRole('dialog',{name:'Enlarged starship interior',exact:true});await dialog.waitFor();
  await dialog.locator('[data-destination-confirm]:visible').waitFor();
  assert.equal(await dialog.locator('[data-action=confirm]').isEnabled(),true);await shot('enlarged-'+width);
  await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await circle.waitFor();await p.waitForTimeout(700);
  assert.deepEqual(await frame.evaluate(()=>({zoom:mapView.zoom,panX:mapView.panX,panY:mapView.panY})),camera);
  const returned=await compact(true);assert.equal(await confirm.isEnabled(),true);await toolbar.scrollIntoViewIfNeeded();await shot('returned-'+width);
  const cancel=frame.locator('[data-action=cancel]:visible').first();await cancel.focus();await p.keyboard.press('Enter');
  await frame.locator('.desktop-grid-viewport > .embedded-move-bottom').waitFor({state:'detached'});await compact(false);
  assert.equal(await frame.locator('[data-destination-confirm]').count(),0);
  rows.push({width,height,idle,selecting,returned,mapPointerSelection:true,cameraPreserved:true,keyboardCancel:true});
 }
 // Reopen and submit once through the existing enlarged Confirm Move control.
 await frame.locator('[data-action=begin]:visible').first().click();
 const station=frame.locator('[data-embedded-station]:visible').first();
 await frame.waitForFunction(()=>[...document.querySelectorAll('[data-embedded-station]')].filter(n=>n.getClientRects().length).some(n=>[...n.options].some(o=>o.value&&!o.disabled&&/Sensors/.test(o.textContent))));
 const target=await station.locator('option').evaluateAll(ns=>ns.find(n=>n.value&&!n.disabled&&/Sensors/.test(n.textContent))?.value);assert(target);await station.selectOption(target);
 await frame.locator('[data-destination-confirm]:visible').waitFor();await compact(true);
 await frame.getByRole('button',{name:'Enlarge ship interior',exact:true}).filter({visible:true}).first().click();
 const dialog=p.getByRole('dialog',{name:'Enlarged starship interior',exact:true});await dialog.waitFor();
 const isMove=r=>r.url().endsWith('/api/action')&&r.method()==='POST'&&r.postDataJSON()?.kind==='move',requests=[];
 p.on('request',r=>{if(isMove(r))requests.push(r.postDataJSON());});
 const response=p.waitForResponse(r=>isMove(r.request()));await dialog.locator('[data-action=confirm]').click();assert.equal((await response).status(),200);
 await dialog.locator('[data-destination-confirm]').waitFor({state:'detached'});assert.equal(requests.length,1);await shot('submitted');
 assert.deepEqual(h.errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({at:new Date().toISOString(),rows,submissions:requests.length,errors:h.errors,limits:'Disposable authenticated combat, initial encounter/clock setup through fixture API. Real map selection, keyboard cancel and one enlarged movement submission; no user save. Does not assert natural arrival.'},null,2));console.log(out);
})().catch(async e=>{console.error(e);await h?.pc?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();await h?.stop();});
