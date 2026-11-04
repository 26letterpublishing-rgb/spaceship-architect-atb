'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {harness,chromium}=require('./capture-console-layout.cjs');
const catalog=require('../alma-snapshots/catalog.json');
async function run(){const out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-alma-all-browser-'));let server,browser;const results=[],errors=[],requests=[];try{
 server=await harness();browser=await chromium().launch({headless:true,channel:'chrome'});const page=await browser.newPage({viewport:{width:1920,height:1080}});
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')requests.push({url:r.url(),method:r.method()});});page.on('websocket',s=>requests.push({socket:s.url()}));
 await page.goto(server.base+'/console-layout-editor.html');await page.locator('#canvas[data-variant="warp-drive-1"]').waitFor();
 for(const e of catalog.entries){const start=errors.length;await page.locator('#console-type').selectOption(e.consoleType);await page.locator('#canvas').evaluate((el,id)=>el.dataset.variant===id,e.id);
 await page.waitForFunction(type=>document.querySelector('#console-variant option')&&document.querySelector('#console-type').value===type,e.consoleType);
 await page.locator('#console-variant').selectOption(e.id);await page.locator('#canvas[data-variant="'+e.id+'"]').waitFor();
 const boxes=await page.locator('.box').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.box,x:parseFloat(n.style.left),y:parseFloat(n.style.top),w:parseFloat(n.style.width),h:parseFloat(n.style.height)})));
 for(const b of catalog.baselines[e.id].boxes){const actual=boxes.find(x=>x.id===b.id);assert(actual,e.id+': '+b.id);for(const k of ['x','y','w','h'])assert(Math.abs(actual[k]-b[k])<.01,e.id+' geometry '+k);}
 await page.locator('#overlays').uncheck();const f=page.frameLocator('#live-underlay');await f.locator('dialog[open]').first().waitFor({timeout:15000});await page.waitForTimeout(100);
 const title=await f.locator('dialog[open]').first().innerText();assert(title.length>20,e.id+' content');
 const firstFamily=!results.some(r=>r.subroute===e.subroute);if(firstFamily){await page.screenshot({path:path.join(out,e.id+'.png'),fullPage:true});
 const off=f.locator('[data-console-maintenance="off"]');if(await off.count()&&await off.first().isVisible()&&await off.first().isEnabled()){const r=await off.first().boundingBox();await page.evaluate(y=>scrollBy(0,y-innerHeight/2),r.y);await off.first().click();await f.locator('.is-powered-off').first().waitFor();const on=f.locator('[data-console-maintenance="on"]').first();if(await on.isEnabled())await on.click();else{await page.locator('#restart-preview').click();await f.locator('dialog[open]').first().waitFor();}await f.locator('.is-powered-off').first().waitFor({state:'detached'});}
 }
 if(e.id==='nutritional-supplement'){await f.locator('[data-sound]').click();await f.locator('[data-flavor="base"]').selectOption('1');await f.locator('[data-dispense]').click();await f.getByRole('button',{name:'Eat paste',exact:true}).click();assert.match(await f.locator('[data-report]').textContent(),/Tastes like chicken/);await page.screenshot({path:path.join(out,'nutrition-after-eating.png'),fullPage:true});}
 assert.deepEqual(errors.slice(start),[],e.id+' browser errors');results.push({id:e.id,route:e.route,subroute:e.subroute,boxes:boxes.length,preview:true,buttons:await f.locator('button:enabled').count()});
 await page.locator('#overlays').check();assert.equal(await page.locator('#live-underlay').count(),0);if(firstFamily)await page.screenshot({path:path.join(out,e.id+'-boxes.png'),fullPage:true});console.log('PASS '+e.id);
 }
 assert.deepEqual(requests,[],'No mutation requests or sockets');fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors,requests},null,2));console.log(out);
 }catch(e){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:e.stack,results,errors,requests},null,2));console.error(out);throw e;}finally{await browser?.close();await server?.stop();}}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});module.exports={run};
