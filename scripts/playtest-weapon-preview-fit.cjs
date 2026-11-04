const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {harness,chromium}=require('./capture-console-layout.cjs'),entries=require('../console-layout-catalog').entries(require('../console-viewer').catalog);
const sameBox=(a,b)=>a.forEach((value,i)=>assert(Math.abs(value-b[i])<.001,'camera retained within SVG float precision'));
(async()=>{const h=await harness(),browser=await chromium().launch({headless:true,channel:'chrome'}),out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-weapon-preview-fit-')),checks=[],errors=[];try{
const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));
const box=selector=>p.locator(selector).evaluate(e=>e.getAttribute('viewBox').split(/\s+/).map(Number));
for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:1280,height:720}])for(const id of [...Array.from({length:5},(_,i)=>'rapid-laser-'+(i+1)),'phazon-torpedo-launcher']){
 await p.setViewportSize(viewport);await p.goto(h.base+'/'+entries.find(e=>e.id===id).url);await p.locator('.weapon-console[open]').waitFor();await p.waitForTimeout(900);
 const initial=await box('[data-map] svg');await p.locator('[data-map] svg').evaluate(svg=>SASpaceMap.fitRendered(svg));const explicit=await box('[data-map] svg');assert(Math.abs(initial[2]-explicit[2])<.1,'initial matches Fit '+id);assert(initial[2]<120);
 if(id==='rapid-laser-1'||id==='phazon-torpedo-launcher')await p.screenshot({path:path.join(out,id+'-'+viewport.width+'.png')});
 // Actual pan must survive periodic rendering and subsequent contact updates.
 const rect=await p.locator('[data-map] svg').boundingBox();await p.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.5);await p.mouse.down();await p.mouse.move(rect.x+rect.width*.5+45,rect.y+rect.height*.5+20,{steps:5});await p.mouse.up();const pan=await box('[data-map] svg');assert.notDeepEqual(pan,explicit);await p.waitForTimeout(450);sameBox(await box('[data-map] svg'),pan);
 await p.locator('.weapon-enlarge-map').click();await p.locator('[data-map-fit]').click();await p.locator('[data-map-zoom=".7"]').click();const zoom=await box('.space-map-dialog svg');await p.waitForTimeout(450);const zoomAfter=await box('.space-map-dialog svg');sameBox(zoomAfter,zoom);await p.keyboard.press('Escape');await p.waitForTimeout(100);sameBox(await box('[data-map] svg'),pan);
 // Reopening a preview starts fitted again, without persisting practice cameras.
 await p.evaluate(()=>{const v=document.querySelector('.weapon-console'),s=SACombatBridge.state();window.reopenWeapon={unit:s.units.find(u=>u.id===v.dataset.operatorId),sic:v.querySelector('[data-console-sic]')?.dataset.consoleSic||'preview'};v.close();});await p.waitForTimeout(100);await p.evaluate(()=>SAWeaponConsoleUI.open(reopenWeapon.unit,reopenWeapon.sic));await p.locator('.weapon-console[open]').waitFor();await p.waitForTimeout(700);assert(Math.abs((await box('[data-map] svg'))[2]-initial[2])<.1);
 checks.push({id,viewport,initial,explicit,pan,zoom});
}
await p.goto(h.base+'/'+entries.find(e=>e.id==='beam-laser-1').url);await p.locator('.weapon-console[open]').waitFor();await p.waitForTimeout(900);const other=await box('[data-map] svg');assert(other[2]>120,'Beam preview remains unchanged');
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks,other,errors},null,2));console.log(out);
}finally{await browser.close();await h.stop();}})().catch(e=>{console.error(e);process.exitCode=1});
