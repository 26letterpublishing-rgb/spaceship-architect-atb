const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),before=process.argv.includes('--before'),out=fs.mkdtempSync(path.join(os.tmpdir(),`sa-shop-picker-${before?'before':'after'}-`)),data=fs.mkdtempSync(path.join(os.tmpdir(),'sa-shop-picker-data-'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),personal=path.join(root,'data/campaigns.json'),personalHash=fs.existsSync(personal)?hash(fs.readFileSync(personal)):null,errors=[],records=[];let server,browser,page;
(async()=>{try{
 const boot="const net=require('node:net'),listen=net.Server.prototype.listen;net.Server.prototype.listen=function(...a){if(typeof a[0]==='object')a[0]={...a[0],host:'127.0.0.1'};else a[1]='127.0.0.1';return listen.apply(this,a);};require('./server.js');";
 server=spawn(process.execPath,['-e',boot],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),15000);server.once('error',reject);server.stdout.on('data',d=>{const m=String(d).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const post=async(p,b)=>{const r=await fetch(base+'/api/campaign/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),v=await r.json();assert.ok(r.ok,JSON.stringify(v));return v;};
 const demo=await post('showcase/start',{});await post('shops',{code:demo.code,token:demo.gmToken,operation:'save',shop:{id:'rapid-review',name:'Rapid Review',active:true,modifier:0,maxSicLevel:5}});
 const pw=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));browser=await pw.chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});

 page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const ES=window.EventSource;window.packets=0;window.EventSource=class extends ES{constructor(...args){super(...args);this.addEventListener('campaign',()=>window.packets++);}};});
 if(before)await page.route('**/shop-ui.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.resolve(root,'../SA-ATB Local Development Files/outputs/shop-picker-lifecycle-oct26/before/shop-ui.js'),'utf8')}));
 const pc=demo.players[0];await page.goto(base+'/');await page.evaluate(({code,pc})=>sessionStorage.setItem('sa-character-token-'+code+'-'+pc.id,pc.token),{code:demo.code,pc});
 await page.goto(base+'/character.html?campaign='+demo.code+'&character='+pc.id);await page.locator('[data-character-tab="shop"]').click();
 const family=page.locator('dialog.sic-family-picker[open]'),inspector=page.locator('dialog.shared-card-inspector[open]');
 const open=async()=>{const summary=page.locator('summary[aria-label="Sensors: expand 9 cards"]').first();await summary.waitFor({state:'attached'});const category=page.locator('.sic-category').filter({has:summary}).locator('legend button').first();if(await category.getAttribute('aria-expanded')==='false')await category.click();await summary.click();await family.waitFor();await page.waitForTimeout(600);};
 const packet=async body=>{const old=await page.evaluate(()=>packets);await post('settings',{code:demo.code,token:demo.gmToken,...body});await page.waitForFunction(n=>packets>n,old);await page.waitForTimeout(150);};
 for(const [width,height]of [[1920,1080],[1366,768],[1280,720]]){
  await page.setViewportSize({width,height});await open();await page.screenshot({path:path.join(out,`family-${width}-before-packet.png`)});
  const snapshotBefore=await page.evaluate(()=>document.getElementById('playerShopPanel')._shopSession?.snapshot);await page.evaluate(()=>window.savedFamily=document.querySelector('dialog.sic-family-picker[open]'));
  await packet({commandWindowBonus:width%100});const survived=await page.evaluate(()=>savedFamily.isConnected&&savedFamily.open);records.push({width,height,irrelevantPacketSurvived:survived});if(!before&&!survived)fs.writeFileSync(path.join(out,'snapshot-change.json'),JSON.stringify({before:JSON.parse(snapshotBefore),after:JSON.parse(await page.evaluate(()=>document.getElementById('playerShopPanel')._shopSession?.snapshot))},null,2));
  await page.screenshot({path:path.join(out,`family-${width}-after-packet.png`)});
  if(before){assert.equal(survived,false);continue;}assert.equal(survived,true);
  await family.getByRole('button',{name:'Sensors 1 details',exact:true}).click();await inspector.waitFor();await packet({commandWindowBonus:width%100+1});assert.ok(await inspector.isVisible());await page.screenshot({path:path.join(out,`inspector-${width}.png`)});
  await page.keyboard.press('Escape');await inspector.waitFor({state:'hidden'});await page.keyboard.press('Escape');await family.waitFor({state:'hidden'});
 }
 if(!before){
  await open();const count=await page.evaluate(()=>packets);await page.context().setOffline(true);await page.waitForTimeout(500);await page.context().setOffline(false);await post('settings',{code:demo.code,token:demo.gmToken,commandWindowBonus:27});await page.waitForFunction(n=>packets>n,count,{timeout:15000});assert.ok(await family.isVisible());records.push({reconnectSurvived:true});
  await family.getByRole('button',{name:'Sensors 1 details',exact:true}).click();await inspector.waitFor();
  // Real inventory change arriving over SSE invalidates both owned dialogs.
  await post('shops',{code:demo.code,token:pc.token,characterId:pc.id,operation:'purchase',itemId:'sic:sensors-1',starshipId:await page.locator('select[data-destination]').inputValue(),requestId:'qa-external-purchase'});
  await family.waitFor({state:'hidden'});await inspector.waitFor({state:'hidden'});records.push({inventoryInvalidatedBoth:true});
  await open();await family.locator('[data-purchase-type="sensors-1"]').click();await family.waitFor({state:'hidden'});await page.getByText('Purchased. Added to your inventory.',{exact:true}).waitFor();records.push({actualPointerPurchase:true});
  // Actual tab transition tears down picker context; reopen is a fresh session.
  await open();await page.keyboard.press('Escape');await page.locator('[data-character-tab="sheet"]').click();await page.locator('[data-character-tab="shop"]').click();await open();await family.getByRole('button',{name:'Close dialog',exact:true}).click();await family.waitFor({state:'hidden'});records.push({cancelAndTabReopen:true});
  await open();await family.getByRole('button',{name:'Sensors 1 details',exact:true}).click();await inspector.waitFor();
  await post('shops',{code:demo.code,token:demo.gmToken,operation:'save',shop:{id:'discount-qa',name:'Discount QA',active:true,modifier:-10}});
  await family.waitFor({state:'hidden'});await inspector.waitFor({state:'hidden'});records.push({priceInvalidatedBoth:true});
  await open();await family.getByRole('button',{name:'Sensors 1 details',exact:true}).click();await inspector.waitFor();await inspector.getByRole('button',{name:'Purchase',exact:true}).click();await inspector.waitFor({state:'hidden'});await family.waitFor({state:'hidden'});records.push({inspectorPurchase:true});
  const extra={id:'shop-qa-second',title:'Shop QA Second',confirmedOnce:true,gridCells:[147,148,149,167,168,169,187,188,189],sicInventory:[{id:'en',type:'en-engine-2'}],placements:[{sicId:'en',cell:147}]};
  await post('starship/link',{code:demo.code,token:demo.gmToken,controlType:'pc',starship:extra});await post('starship/crew',{code:demo.code,token:demo.gmToken,starshipId:extra.id,crewCharacterIds:[pc.id]});
  const dest=page.locator('select[data-destination]');await dest.locator('option[value="shop-qa-second"]').waitFor({state:'attached'});await dest.selectOption(extra.id);await open();await family.locator('[data-purchase-type="sensors-1"]').click();await family.waitFor({state:'hidden'});
  const purchased=await fetch(base+'/api/campaign/state?code='+demo.code+'&token='+pc.token).then(r=>r.json());assert.ok(purchased.starships.find(s=>s.id===extra.id).ship.sicInventory.some(i=>i.type==='sensors-1'));records.push({destinationPurchase:extra.id});
 }
 assert.deepEqual(errors,[]);assert.equal(fs.existsSync(personal)?hash(fs.readFileSync(personal)):null,personalHash);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,before,records,errors,personalUnchanged:true},null,2));console.log('PASS',out);
 }catch(e){await page?.screenshot({path:path.join(out,'FAILED.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:false,error:e.stack,records,errors},null,2));console.error(e,'Evidence:',out);process.exitCode=1;}finally{await browser?.close();if(server&&server.exitCode===null)server.kill();}})();
