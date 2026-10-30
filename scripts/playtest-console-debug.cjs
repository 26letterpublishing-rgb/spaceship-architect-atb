'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {startHarness}=require('./console-debug.cjs');const {validate}=require('./fixtures/console-debug-sensors.cjs');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-console-debug-check-'));let h;const checks=[];
const personal=path.resolve(__dirname,'../data/campaigns.json'),hash=()=>fs.existsSync(personal)?require('node:crypto').createHash('sha256').update(fs.readFileSync(personal)).digest('hex'):null,before=hash();
(async()=>{
 assert.throws(()=>validate(10,'ready'));assert.throws(()=>validate(1,'arbitrary-server'));
 h=await startHarness({headless:true});
 assert.equal(h.listenerAddress,'127.0.0.1');assert.ok(h.data.startsWith(path.join(os.tmpdir(),'sa-console-debug-')));checks.push('fresh temp storage and verified loopback listener');
 for(let tier=1;tier<=(process.argv.includes('--interactions-only')?1:9);tier++){
  if(tier>1)await h.reset(tier,'ready');const state=await h.state();assert.equal(Boolean(state.practice||state.catalogPreview),false);assert.equal(state.starships.find(s=>s.id==='debug-ship').ship.sicInventory.find(i=>i.id==='sn').type,`sensors-${tier}`);
  const view=h.pc.getByRole('dialog',{name:'Sensor console',exact:true});await view.waitFor();assert.equal(await h.pc.locator('[data-catalog-snapshot]').count(),0);checks.push(`tier ${tier}: real combat console`);console.log(checks.at(-1));
 }
 await h.reset(1,'ready');
 for(const [width,height] of [[1920,1080],[1366,768],[1280,720]]){await h.pc.setViewportSize({width,height});await h.pc.waitForTimeout(250);await h.pc.screenshot({path:path.join(out,`sensor-${width}.png`)});const box=await h.pc.locator('.sensor-console [data-map]').boundingBox();assert.ok(box.width>200&&box.height>150);checks.push(`${width}x${height}: map reachable`);}
 await h.pc.getByRole('dialog',{name:'Sensor console',exact:true}).getByRole('button',{name:'Close dialog',exact:true}).click();await h.pc.getByRole('dialog',{name:'Sensor console',exact:true}).waitFor({state:'hidden'});await h.openConsole();checks.push('close and reopen production PC route');
 async function ready(){const u=(await h.state()).units.find(u=>u.characterId===h.fixture.characterId);await h.fixture.act({action:'nudge',id:u.id,amount:100});await h.pc.locator('.sensor-console [data-turn]').filter({hasText:'YOUR TURN'}).waitFor();return u;}
 async function completeScan(kind){
  await ready();const view=h.pc.getByRole('dialog',{name:'Sensor console',exact:true});await view.locator(`[data-order=${kind}]`).click();
  if(kind==='hex'){const p=await view.locator('[data-space-canvas]').evaluate(svg=>{const p=new DOMPoint(Math.sqrt(3)*7,0).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y};});await h.pc.mouse.click(p.x,p.y);await view.locator('[data-confirm-scan]').click();}
  await view.locator('[data-turn]').filter({hasText:/SCANNING|ROLL REQUIRED/}).waitFor();let u=(await h.state()).units.find(u=>u.characterId===h.fixture.characterId);assert.ok(u.delayedAction?.sensorOrder);
  if(u.delayedAction.awaitingRoll){const roll=h.pc.getByRole('dialog',{name:'Ship action dice roll'});await roll.waitFor();const dice=roll.frameLocator('iframe');await dice.getByRole('spinbutton',{name:'Manual Final Score',exact:true}).fill('20');await dice.getByRole('button',{name:'Calculate Manual Result',exact:true}).click();await dice.getByRole('button',{name:'Confirm and Submit',exact:true}).click();await roll.waitFor({state:'detached'});checks.push(kind+': production roll confirmation');}
  for(let i=0;i<120;i++){u=(await h.state()).units.find(u=>u.characterId===h.fixture.characterId);if(!u.delayedAction)break;await h.fixture.act({action:'step'});}
  assert.equal((await h.state()).units.find(u=>u.characterId===h.fixture.characterId).delayedAction,null);if(kind==='analysis')for(let i=0;i<20;i++)await h.fixture.act({action:'step'});await view.locator('[data-reports]').filter({hasText:kind==='analysis'?/Snapshot at scan completion/:/scan complete|No contacts resolved/i}).waitFor();await h.pc.screenshot({path:path.join(out,kind+'-result.png')});checks.push(kind+': action completed with report');
 }
 await ready();const restartUnit=(await h.state()).units.find(u=>u.characterId===h.fixture.characterId);
 await h.fixture.act({action:'shipMaintenance',id:restartUnit.id,sicId:'sn',kind:'restart',requestId:require('node:crypto').randomUUID()});
 await h.pc.locator('.sensor-console [data-range]').filter({hasText:'Sensors offline'}).waitFor();assert.equal(await h.pc.locator('.sensor-console [data-order=hex]').isDisabled(),true);
 await h.pc.getByRole('dialog',{name:'Sensor console',exact:true}).getByRole('button',{name:'Close dialog',exact:true}).click();await h.openConsole();await h.pc.locator('.sensor-console [data-range]').filter({hasText:'Sensors offline'}).waitFor();
 for(let i=0;i<120;i++){const item=(await h.state()).starships.find(s=>s.id==='debug-ship').ship.sicInventory.find(i=>i.id==='sn');if(!item.bootRemaining)break;await h.fixture.act({action:'step'});}
 await h.pc.locator('.sensor-console [data-range]').filter({hasText:'Sensor range'}).waitFor();await ready();assert.equal(await h.pc.locator('.sensor-console [data-order=hex]').isEnabled(),true);checks.push('online/offline/reopen/online: production restart and scanning recovery');
 await completeScan('hex');await completeScan('area');assert.ok(checks.some(s=>String(s).includes('production roll confirmation')),'A real roll must have been confirmed');
 for(const scenario of ['no-AU','offline','no-target']){
  await h.reset(scenario==='no-AU'?9:1,scenario);const s=await h.state(),ship=s.starships.find(s=>s.id==='debug-ship'),view=h.pc.getByRole('dialog',{name:'Sensor console',exact:true});
  if(scenario==='no-AU'){assert.equal(ship.auState.maximum,0);await completeScan('hex');await completeScan('analysis');await ready();await view.locator('.conditional-order-controls summary').click();await view.locator('[data-conditional]').check();await view.locator('[data-order=area]').click();await view.locator('[data-error]').filter({hasText:/AU/}).waitFor();assert.equal((await h.state()).units[0].delayedAction,null);checks.push('no-AU: conditional input rejected without consuming action');}
  if(scenario==='offline'){assert.equal(ship.ship.sicInventory.find(i=>i.id==='sn').status,'powered-down');assert.equal(await view.locator('.console-compromised').isVisible(),true);checks.push('offline: production blocked state');}
  if(scenario==='no-target'){assert.equal(s.starships.length,1);assert.equal(await view.locator('[data-order=analysis]').isDisabled(),true);checks.push('no-target: analysis disabled');}
  await h.pc.waitForTimeout(1000);await h.pc.screenshot({path:path.join(out,scenario+'.png')});
 }
 await h.panel.locator('#tier').selectOption('1');await h.panel.locator('#scenario').selectOption('ready');const oldCode=h.fixture.code;await h.panel.locator('#reset').click();await h.panel.locator('#status').filter({hasText:'Ready: Sensors 1, ready'}).waitFor();assert.notEqual(h.fixture.code,oldCode);await h.panel.screenshot({path:path.join(out,'controls.png')});checks.push('panel Reset creates a new disposable room');
 await h.panel.locator('#size').selectOption('1280x720');assert.deepEqual(h.pc.viewportSize(),{width:1280,height:720});await h.panel.locator('#open').click();await h.pc.getByRole('dialog',{name:'Sensor console',exact:true}).waitFor();assert.deepEqual(h.pc.viewportSize(),{width:1280,height:720});checks.push('panel viewport and Reopen controls');
 assert.deepEqual(h.errors,[]);checks.push('no uncaught browser errors');
 await h.panel.locator('#stop').click();for(let i=0;i<40&&!h.stopped;i++)await new Promise(r=>setTimeout(r,100));assert.equal(h.stopped,true);for(let i=0;i<40;i++){try{await fetch(h.base+'/api/state');await new Promise(r=>setTimeout(r,100));}catch{break;}}await assert.rejects(fetch(h.base+'/api/state'));assert.equal(hash(),before);checks.push('panel Stop stops owned server; personal data unchanged');
})().catch(async e=>{process.exitCode=1;checks.push({failure:e.stack});await h?.pc?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});console.error(e);}).finally(async()=>{await h?.stop();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(checks,null,2));console.log(out);console.log(checks);});
