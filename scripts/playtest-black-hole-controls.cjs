const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {harness,chromium}=require('./capture-console-layout.cjs');
const entry=require('../console-layout-catalog').entries(require('../console-viewer').catalog).find(e=>e.id==='black-hole-gun');
(async()=>{const h=await harness(),b=await chromium().launch({headless:true,channel:'chrome'}),out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-black-hole-controls-'));try{const p=await b.newPage(),errors=[],posts=[],checks=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()==='POST')posts.push(r.url())});
for(const viewport of [{width:1366,height:900},{width:1280,height:720}]){
 await p.setViewportSize(viewport);await p.goto(h.base+'/'+entry.url);await p.locator('dialog[open]').waitFor();await p.waitForTimeout(700);
 const slider=p.locator('[data-intensity]');assert.equal(await slider.getAttribute('type'),'range');assert.equal(await slider.getAttribute('min'),'1');assert.equal(await slider.getAttribute('max'),'50');
 await slider.focus();await p.keyboard.press('Home');assert.equal(await slider.inputValue(),'1');for(let i=0;i<12;i++)await p.keyboard.press('ArrowRight');assert.equal(await slider.inputValue(),'13');assert.equal(await slider.getAttribute('data-insufficient'),'false');
 await p.keyboard.press('ArrowRight');assert.equal(await slider.inputValue(),'14');assert.equal(await slider.getAttribute('data-insufficient'),'true');assert.match(await p.locator('[data-cost]').textContent(),/105 AU.*Insufficient AU/);
 await p.keyboard.press('Home');const r=await slider.boundingBox();await p.mouse.move(r.x+8,r.y+r.height/2);await p.mouse.down();await p.mouse.move(r.x+r.width*.7,r.y+r.height/2,{steps:8});
 // Assert while the mouse is still held, before change/release.
 const drag=await slider.evaluate(e=>({value:Number(e.value),red:e.dataset.insufficient,color:getComputedStyle(e).accentColor,aria:e.getAttribute('aria-valuetext')}));assert(drag.value>14);assert.equal(drag.red,'true');assert.equal(drag.color,'rgb(255, 64, 79)');assert.match(drag.aria,/insufficient AU/);await p.screenshot({path:path.join(out,'insufficient-'+viewport.height+'.png')});await p.mouse.up();
 await slider.focus();await p.keyboard.press('End');assert.equal(await slider.inputValue(),'50');assert.match(await p.locator('[data-cost]').textContent(),/1275 AU/);await p.keyboard.press('Home');assert.equal(await slider.inputValue(),'1');assert.equal(await slider.getAttribute('data-insufficient'),'false');assert.equal(await slider.evaluate(e=>getComputedStyle(e).accentColor),'rgb(179, 69, 255)');
 await p.evaluate(()=>document.fonts.load('15px Orbitron'));assert(await p.evaluate(()=>document.fonts.check('15px Orbitron')));const font=await p.locator('.black-hole-intensity').evaluate(e=>getComputedStyle(e).font);assert.match(font,/15px.*Orbitron/);
 assert(r.x>=0&&r.x+r.width<=viewport.width&&r.y>=0&&r.y+r.height<=viewport.height);await p.screenshot({path:path.join(out,'controls-'+viewport.height+'.png')});
 await p.locator('[data-map-focus]').click();await p.waitForTimeout(150);await p.locator('[data-map-focus]').click();assert.equal(await slider.inputValue(),'1');
 checks.push({viewport,drag,font,slider:r});
}
assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,checks,errors,posts},null,2));console.log(out);
}finally{await b.close();await h.stop()}})().catch(e=>{console.error(e);process.exitCode=1});
