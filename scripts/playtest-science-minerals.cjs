const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {harness,chromium}=require('./capture-console-layout.cjs');
(async()=>{const h=await harness(),browser=await chromium().launch({headless:true,channel:'chrome'}),out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-science-minerals-')),errors=[];try{
 const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(h.base+'/console-viewer.html?stage=1&family=utility&type=science-lab&inspection=interactive');
 await p.locator('.shared-power [data-lab-stock]').waitFor();
 await p.evaluate(()=>{const old=SACombatBridge.crewRoomRequest;window.stock={Iron:42,Phazon:0};SACombatBridge.crewRoomRequest=async body=>{const r=await old(body);if(body.kind==='inspect')r.result.shipMinerals=window.stock;return r;};});
 await p.waitForFunction(()=>document.querySelector('[data-lab-stock]').textContent==='Iron: 42');
 for(const [width,height] of [[1920,1080],[1366,768],[1280,720]]){
  await p.setViewportSize({width,height});await p.evaluate(()=>document.fonts.ready);
  assert.equal(await p.locator('[data-lab-stock]').count(),1);assert.equal(await p.locator('[data-common-fleet],.shared-timeline').count(),0);
  assert.equal(await p.locator('[data-console-maintenance]').count(),4);assert.equal(await p.locator('[data-common-au]').count(),1);
  const panel=await p.locator('.shared-power').boundingBox(),records=await p.locator('.crew-room-records').boundingBox();assert.ok(Math.abs(panel.y+panel.height-records.y-records.height)<2,'panel fills lower row');
  await p.screenshot({path:path.join(out,'stock-'+width+'.png')});
 }
 await p.evaluate(()=>window.stock={Iron:0});await p.waitForFunction(()=>document.querySelector('[data-lab-stock]').textContent==='No minerals in ship storage.');
 await p.evaluate(()=>window.stock=Object.fromEntries(Array.from({length:80},(_,i)=>['Mineral '+i,i+1])));await p.waitForFunction(()=>document.querySelector('[data-lab-stock]').textContent.includes('Mineral 79: 80'));
 await p.locator('[data-console-maintenance="off"]').scrollIntoViewIfNeeded();assert.ok(await p.locator('[data-console-maintenance="off"]').isVisible());
 await p.locator('[data-console-maintenance="off"]').click();await p.waitForFunction(()=>document.querySelector('.crew-room-console').classList.contains('is-powered-off'));await p.locator('[data-console-maintenance="on"]').click();
 await p.evaluate(()=>{const s=SACombatBridge.state();window.reopen={unit:s.units[0],sicId:document.querySelector('.crew-room-console').dataset.sicId};document.querySelector('.crew-room-console').close();});await p.locator('.crew-room-console').waitFor({state:'detached'});
 await p.evaluate(()=>SACrewRoomConsole.open(window.reopen.unit,window.reopen.sicId));await p.waitForFunction(()=>document.querySelector('[data-lab-stock]')?.textContent.includes('Mineral 79: 80'));
 assert.equal(await p.locator('.science-fabrication [data-fabricator]').count(),1);assert.equal(await p.locator('[data-note]').count(),1);
 await p.evaluate(()=>SACombatBridge.state().practice=false);await p.waitForTimeout(500);assert.equal(await p.locator('.shared-timeline').count(),0);
 for(const type of ['gym','library']){await p.goto(h.base+'/console-viewer.html?stage=1&family=utility&type='+type+'&inspection=interactive');await p.locator('[data-common-fleet]').waitFor();assert.equal(await p.locator('[data-lab-stock]').count(),0);assert.equal(await p.locator('.shared-timeline').count(),1);assert.equal(await p.locator('[data-console-maintenance]').count(),4);}
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,errors},null,2));console.log(out);
}finally{await browser.close();await h.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
